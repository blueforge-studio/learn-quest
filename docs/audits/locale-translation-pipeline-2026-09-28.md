# Learner-locale translation pipeline: investigation and model choice (2026-09-28)

This investigation follows up [`lang-source-vs-published-2026-09-28.md`](lang-source-vs-published-2026-09-28.md), finding 4. That audit found that the balkan de/es/fr and southeast-asian learner locales are live but barely translated. This document answers four questions:

- Which scripts produce learner-locale text?
- Did a run crash half way?
- How should the work be finished?
- Which model should do it?

**Scope and spend.** The investigation was read-only on every repo; scratch files live in the session scratchpad. Model spend was under $0.01: MiniMax was on the flat plan, GLM ran on the z.ai key, and Gemini flash-lite came to about 6 calls of roughly 2.5K tokens.

## TL;DR

- **Nothing crashed half way.** Two separate things happened, both before 2026-04-05 in the upstream "learning-platform" repo:
  1. **Balkan de/es/fr** (and african fr/es, uralic/west-slavic/slavic de, several nordic locales): only the **contrastive enrichment** step ever ran, and it ran to completion. That step writes `learnerLocale.contrastiveNote` but by design never translates `meaning`, titles or prose. The English `meaning` was copied into `learnerLocale` by `translate-vocab.ts` and `sync-locale-lessons.ts`.
  2. **Southeast-asian:** a real full translation ran, but only over **chapters 1–5**, which was the old 5-chapter ship scope. Files are all-or-nothing: ch6+ is 0% translated, although the contrastive notes run through ch15. For thai, the translated set is the **older hand-named lessons** only. The later fleet-template lessons (`vocab-*`, `concept-*`, `culture-*`, `drill-*`, `spelling-*`, `word-order-*`) were added after the run and were never translated.
- **The empty lessons (35–54%) are not a translation gap.** They equal the en empties exactly: they are unauthored ch6–15 `{}` stubs. Translation cannot fix them. Pruning in the generator can (see the source-vs-published audit).
- **No existing script can finish the job as-is.** The only one that uses the current repo layout and validates its output is `lq-english/scripts/generate-source-locale.ts`. It needs an in-place **`--fill`** mode, `--root`, gloss context and non-Latin language names. See §3.
- **Model: MiniMax-M3 as the default, with a validator and a per-item retry. Use glm-5.3-flash as the fallback / second opinion, not the default.** GLM's prose is the best of the three, but it is 4–5× slower and its Anthropic-compat endpoint rate-limited (429) during the trial. Do not use Gemini flash-lite: it produced a non-word and rewrote "English" as "German", which falsified an example.
- **Cost is irrelevant at this size.** All 29 balkan + southeast-asian locales come to **28.9K unique strings / 1.38M chars**: about $0.60 at MiniMax-M3 list price ($0 on the flat plan) or about $0.30 on flash-lite. All 44 manifest locales come to about $0.91 at M3 list price.

## 1. Script inventory

| # | Script | Entry / flags | Fields it writes | Provider chain (default) | Resumable? | Writes to | Usable now? |
|---|---|---|---|---|---|---|---|
| 1 | `lq-tools/packages/content-enrichment/src/enrich-learner-locales.ts` | No bin. `npx tsx src/enrich-learner-locales.ts --lang\|--group --locale= [--chapters=1,2] [--dry-run] [--budget=1.00] [--max-txt=300] [--force] [--concurrency=2] [--use-gemini] [--provider=ollama]` | **Only** `learnerLocale.contrastiveNote` (≤15 words), plus `nativePronunciation` for th/zh/ja/ko/ar. For flat items it *creates* `learnerLocale` by copying the English `meaning`/`pronunciation` (`content-extractor.ts:13-35`). | Ollama → Qwen → DeepSeek → Replicate → Anthropic-compat (MiniMax, `ANTHROPIC_MODEL` or MiniMax-M2.7) → GLM (glm-4-flash) → Gemini (gemini-3.1-flash-lite) → GameVault | Per item: skips an item that already has a `contrastiveNote` key. Files are written only at the end of a run, so a crash loses the whole run. | Old monorepo layout `packages/app/public/apps/languages` (`tools-shared/src/app-registry.ts:48`), so it **does not find** the split `lq-*/languages/<lang>/data` | No. It is the script that produced the notes. |
| 2 | `.../content-enrichment/src/sync-locale-lessons.ts` | `npx tsx` | Copies en lesson files verbatim into `<locale>/lessons` where the target is missing. **This is where the English copies came from.** | none | n/a | old layout | No |
| 3 | `.../content-enrichment/src/translation/index.ts` ("translate-data") + `translation/engine/{batch-translator,translation-lessons}.ts` | `--app=<group/lang> --locales= --include-lessons --chapters= --batch-translate --max-tokens= --dry-run --force` | Standard mode sends the whole lesson JSON with a rule list ("title, intro, text, meaning…"). **`text` is on the list, but in vocab and dialogue items it holds the word being taught.** | GameVault → Gemini. Batch preset: qwen/minimax/replicate. | Skips any lesson file that exists (`core.ts:98`). Every locale file exists as an English copy, so a run is a **no-op** without `--force`, and `--force` re-derives from en and **throws away the contrastiveNotes**. | Batch mode writes `data/<locale>/<chapter>/…` without `lessons/` (`translation-lessons.ts:127,138`) and tells the model the language is "De"/"Fr"/"Ja" (`batch-translator.ts:52`). | No. Broken. |
| 4 | `.../content-enrichment/src/estimate-locale-cost.ts` | `npx tsx` | Estimates only the contrastive-note enrichment cost (flash-lite $0.10/$0.40) | — | — | stdout | Not for meanings |
| 5 | `lq-tools/packages/content-generators/src/generators/translations-generator.ts` | Called by the content-generators CLI | Wraps #1 (`--chapters=1-15 --budget=3`) per locale, so **it never translates meanings** despite its name. It shells out to `scripts/content/...`, which no longer exists. | as #1 | — | — | No |
| 6 | `app-generators --translate-data --translate-lessons --data-locales=` (`utils/cli-args.ts:23-90`, `services/translate-data.service.ts`, `utils/pipeline/phases/translate.ts`) | scaffold pipeline | Shells out to #3 standard mode at the dead `scripts/content/translation/index.ts` path (`external-commands.ts:135-158`) | as #3 | — | — | No |
| 7 | `app-generators/src/generators/translate-vocab.ts` | scaffold | Generates *target-language* vocab from English. Writes the English meaning into **both** `learnerLocale.meaning` and `english.meaning`, which is the root of the "English shown to German learners" data. | ai-clients | — | lesson JSON | Not a translator |
| 8 | **`lang-quest/lq-english/scripts/generate-source-locale.ts`** + `scripts/lib/locale-fields.ts` + `scripts/lib/ai-client.ts` (commits 076afa2, 73038f3, 6d67eb8, 830676e, 2026-09-02/03) | `npx tsx scripts/generate-source-locale.ts --lang= --locale= [--chapter=N] [--limit=N] [--dry-run] [--force] [--provider=minimax\|google]` | Only learner-facing strings: title, intro, body, heading, description, hint, prompt, question, explanation, **meaning**, translation, role, tips, objectives. It never touches word/text/pronunciation/answer/correctAnswer/ids/asset paths. | `@blueforge-studio/ai-gateway/lite`: **MiniMax-M3** (`MINIMAX_API_KEY`), then Google `gemini-3.6-flash` (`GOOGLE_AI_API_KEY`/`GEMINI_API_KEY`) | Per file: skips a file whose output exists | Current layout `languages/<lang>/data/<locale>/**`. Respects `shipChapters` and registers the locale in `locale-manifest.json` (beta). | **The right base, but it skips every balkan/SEA file** (they all exist). `--force` would drop contrastiveNote/nativePronunciation. |

**Validation already in #8.**
- **Echo guard:** if more than 60% of a batch of at least 4 strings comes back unchanged, it retries once, then rejects. This was written after "one M3 run returned an entire animals vocabulary unchanged".
- **Preservation guard:** a file whose protected fields changed is rejected.
- **Exit code:** 1 if anything was rejected.

**Gaps in #8 for this job.**
1. There is no in-place mode.
2. `ROOT` is hard-bound to lq-english.
3. `LANG_NAMES` covers only da/de/es/fr/en/it/pt/nl/sv/nb. For ja/zh/th/ms/id it passes the raw code and writes `script: 'Latin'`.
4. Glosses are sent **without the target word**, so "right" cannot be told apart as *rechts* or *richtig*.
5. The prompt says "suitable for children".
6. There is no per-string English-leak check.
7. GLM is not in the provider list.

**Provider support.**

- **`@learnquest/ai-clients`:**
  - MiniMax is reached through the Anthropic-style client (`ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL` defaulting to api.minimax.io/anthropic, `ANTHROPIC_MODEL` defaulting to **MiniMax-M2.7**, not M3).
  - GLM: `GLM_API_KEY`, `GLM_BASE_URL` (defaults to open.bigmodel.cn), `GLM_MODEL` (GLM-5-Turbo, or glm-4-flash in the multi-provider client).
  - Also Qwen, Replicate, Gemini (`GEMINI_MODEL`, default gemini-3.1-flash-lite) and GameVault.
  - `AI_PROVIDER_ORDER` accepts only minimax/glm/replicate/qwen.
- **`@blueforge-studio/ai-gateway` `/lite`** (0.8.1 in lq-english): minimax ('M3'), glm (open.bigmodel.cn, GLM-5-Turbo), google (default gemini-2.0-flash, which 404s, so it must be pinned), qwen, openai, anthropic.

**Endpoints verified live in this session:**
- **MiniMax-M3:** `POST https://api.minimax.io/anthropic/v1/messages` works.
- **glm-5.3-flash:** the Anthropic-compat endpoints `https://api.z.ai/api/anthropic/v1` and `open.bigmodel.cn/api/anthropic/v1` returned **429 "rate limit reached"** on every try.
  - `https://api.z.ai/api/paas/v4/chat/completions` works with `reasoning_effort: "low"`. `thinking: disabled` is rejected: "This model always engages in thinking".
  - glm-4.5-flash on the Anthropic endpoint answered.
- **gemini-3.5-flash-lite:** listed and working.

**Local env (set / unset only).**
- Set: `MINIMAX_API_KEY`, `MINIMAX_ANTHROPIC_API_KEY`, `GLM_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `DEEPSEEK_API_KEY`.
- Unset: `ANTHROPIC_BASE_URL`, `ANTHROPIC_MODEL`, `M3_API_KEY`, `ZAI_API_KEY`, `ZHIPU_API_KEY`, `GOOGLE_API_KEY`, `OPENROUTER_API_KEY`.

## 2. Evidence: what ran, and where it stopped

**Method.**
- Every one of the 108 language × non-en locale lesson trees across the 14 apps was compared string by string against the same-path en source file.
- A string counts as untranslated if it is identical to the en string (Latin locales) or has no target-script characters (ja/zh/th/ko/vi). A stopword vote decides the rest.
- The vocab check compares `learnerLocale.meaning` with the sibling `english.meaning`.

**Git.**
- Every locale file in lq-balkan and lq-southeast-asian was first added by `c76ebaf4`/`ff55a6b3` on **2026-04-05**, "feat: copy data and audio from learning-platform". The same holds on `backup/pre-squash-main`.
- No later commit touched text; they only wired assets and audio.
- `enrichmentMeta` stamps in the balkan `de` files read `scriptVersion 1.1`: 235 are dated 2026-03-31 and 72 dated 2026-04-03. 817 locale files across lq-balkan carry `enrichmentMeta`.
- The upstream learning-platform repo has no checkout anywhere local (searched `/Volumes/SSD/Projects{,/_archive}`, `Repos-internal`, `forge-work`). So the exact command lines cannot be recovered. The content pattern is the evidence.

**Leftover state.** None of it relates to translation:
- `lq-tools/.progress.json` is a book task from 09-09.
- `lang-quest/*/.sync-state/*.json` is R2 sync state from 04-17.
- The `.audit-logs`, `.reaudit-logs` and `docs/audits` logs are image audits.
- There are no generation-report, resume or cache files.

**Per app/locale verdict**

| App / locales | Verdict | Detail |
|---|---|---|
| **balkan** bulgarian, croatian, greek, romanian, serbian × de/es/fr (15) | **Translation never run. Contrastive enrichment complete.** | `learnerLocale.meaning` is English in 203/203 vocab items in every locale; lesson titles and prose are 0% translated in ch1–8; `contrastiveNote` is in the learner language in every chapter (about 250–360 per locale); `chapters.json` titles are translated. The manifest says `enrichment.type: "contrastive"`, but its `coverage: 100%` overstates it. |
| **SEA** vietnamese es/fr/zh, indonesian es/fr/ms | **Partially run: full translation ch1–5 only (scope limit, not a crash)** | ch1–5 complete (≤2 of 75 files missed, e.g. vi/fr `dialogue-getting-around`, `dialogue-family-dinner`). ch6+ is 0%. |
| **SEA** khmer es/fr/th | **Complete for the content that exists** | The source has only ch1–5 (75 files). khmer/th still lacks 48 contrastive notes. |
| **SEA** thai de/es/fr/ja/zh | **Partially run: about 60% of ch1–5** | The hand-named lesson set (`basic-nouns`, `animals`, `dialogue-meeting-someone`…) is translated. The fleet-template set is untranslated: 27–37 of 176 ch1–5 files and 95–105 of 129 ch6+ files per locale. The run predates the template lessons. |
| african fr/es, uralic de, west-slavic de, slavic de (no notes), nordic icelandic, norwegian/swedish th/zh | Contrastive-only, like balkan | — |
| nordic norwegian/swedish de/es/fr, african swahili/es | Stopped at ch5, like SEA | nordic ch6+: 53–62 of 99 files untranslated |
| nordic danish de/es/fr/th/vi/zh | Nearly complete | 14–27 untranslated files, mostly ch1–5 template lessons |
| east-asian es/th, germanic th/zh, middle-eastern zh, romance ja/zh, SEA `ko` | Pure English copies. Not in any manifest. | 64 orphan locale directories |

**Also noted.**
- The croatian manifest says `contrastiveNoteLanguage: "en"`, but the notes are in the learner language.
- The **en prose is L1-centric** ("Croatian uses the Latin alphabet, just like English… think 'c' in 'cat'"). A faithful translation still tells a German reader "like English". Only `contrastiveNote` is really L1-adapted. This is a content limitation, not a model fault. Do **not** let the model silently "adapt" it (see Gemini in §4).

## 3. Recommended pipeline

**Use `generate-source-locale.ts`, extended.** It is the only validated, current-layout translator, and its field split is right. Port it to lq-tools as a shared bin (`@learnquest/content-enrichment` `lq-fill-locale`), or at minimum add `--root` so it can be run from lq-english against the other apps.

**Changes it needs:**
1. **Add a `--fill` in-place mode.**
   - Read the *existing* locale file and the en base file.
   - Translate only the collected paths whose locale value is still the English string: equal to en, or, for ja/zh/th/ko, lacking target-script characters.
   - Keep everything else byte-for-byte, including `contrastiveNote`, `nativePronunciation` and `enrichmentMeta`.
   - The result is resumable per string: a crash or a rejected file just gets re-filled on the next run. No state file is needed, and it is idempotent.
2. **Add `--root=<app dir>`** instead of the hard `ROOT` (or read `LQ_APP_ROOT`).
3. **Send gloss context.** For `meaning`/`translation`, send `{word: targetLocale.text, en: meaning}` so the model can disambiguate the sense (desno → *rechts*, not *richtig*). The trial prompt did this, and every model got "right" correct.
4. **Language names:** add ja/zh/th/ms/id/vi/ko to `LANG_NAMES`, with the correct `script`. Drop "suitable for children", which is wrong for adult courses.
5. **Per-string validation** on top of the batch echo guard:
   - reject and retry any single string with a ≥2-word English run left in it (Latin locales, stopword check);
   - reject and retry any ja/zh/th string without target script;
   - keep the preservation guard and a `JSON.parse` round-trip;
   - after 2 retries, leave the English in place and list the string in the run report instead of writing a partial file.
6. **Add a `glm` provider** (z.ai `paas/v4/chat/completions`, `glm-5.3-flash`, `reasoning_effort: "low"`, `max_tokens` ≥ 8K) as the failover after MiniMax. Keep Google as the last resort only.
7. **Stamp** `translationMeta {model, date, scriptVersion}` per file, and write `docs/audits/locale-fill-<app>-<date>.json` (written/skipped/rejected + leftover English paths).
8. **Do not flip `enabled`.** Keep the existing manifest entry and set `enrichment.type: "full"` only when 0 English leftovers remain. Enabling stays a product decision.
9. Split batches above about 60 strings; the thai files are large.

**Commands, once the above lands.** Run from lq-english: first a dry-run to print the counts, then the real run, one locale at a time.

```bash
cd /Volumes/SSD/Projects/Repos/learn-quest/lang-quest/lq-english
# balkan: 15 locales
for L in bulgarian croatian greek romanian serbian; do for LOC in de es fr; do
  npx tsx scripts/generate-source-locale.ts --root=../lq-balkan --lang=$L --locale=$LOC --fill --provider=minimax
done; done
# southeast-asian: 14 locales
for LOC in de es fr ja zh; do npx tsx scripts/generate-source-locale.ts --root=../lq-southeast-asian --lang=thai --locale=$LOC --fill --provider=minimax; done
for LOC in es fr zh;      do npx tsx scripts/generate-source-locale.ts --root=../lq-southeast-asian --lang=vietnamese --locale=$LOC --fill --provider=minimax; done
for LOC in es fr ms;      do npx tsx scripts/generate-source-locale.ts --root=../lq-southeast-asian --lang=indonesian --locale=$LOC --fill --provider=minimax; done
for LOC in es fr th;      do npx tsx scripts/generate-source-locale.ts --root=../lq-southeast-asian --lang=khmer --locale=$LOC --fill --provider=minimax; done
# then in each app: scripts/generate-lesson-files.ts (after the restores in the source-vs-published audit), one PR per app
```

- Pilot `croatian/de --chapter=1` first, and eyeball the output.
- The khmer/th 48 missing contrastive notes need a separate enrichment run; `--fill` does not generate notes.

**Strings to translate** (unique untranslated strings per locale; duplicates such as repeated vocab across lessons are deduped; costs are list price):

| app/lang/locale | meaning | title | prose | unique strings | unique chars | M3 list $ | flash-lite $ |
|---|---|---|---|---|---|---|---|
| balkan/bulgarian/{de,es,fr} | 586 | 155 | 709 | ~1,040 each | ~55.1K each | 0.023 each | 0.012 each |
| balkan/croatian/{de,es,fr} | 607 | 155 | 746 | ~1,080 each | ~58.1K each | 0.024 each | 0.012 each |
| balkan/greek/{de,es,fr} | 470 | 118 | 564 | ~825 each | ~48.8K each | 0.020 each | 0.010 each |
| balkan/romanian/{de,es,fr} | 599 | 154 | 735 | ~1,060 each | ~56.2K each | 0.023 each | 0.012 each |
| balkan/serbian/{de,es,fr} | 610 | 164 | 761 | ~1,100 each | ~62.6K each | 0.026 each | 0.013 each |
| SEA/thai/de | 847 | 259 | 1,564 | 2,096 | 85.4K | 0.036 | 0.018 |
| SEA/thai/es | 874 | 257 | 1,584 | 2,118 | 85.8K | 0.036 | 0.018 |
| SEA/thai/fr | 860 | 258 | 1,552 | 2,084 | 84.7K | 0.035 | 0.018 |
| SEA/thai/ja | 913 | 255 | 1,571 | 2,104 | 85.3K | 0.046 | 0.023 |
| SEA/thai/zh | 925 | 255 | 1,606 | 2,130 | 86.7K | 0.046 | 0.023 |
| SEA/vietnamese/{es,fr,zh} | ~335 | ~97 | ~412 | ~625 each | ~22K each | 0.009–0.011 | 0.005–0.006 |
| SEA/indonesian/{es,fr,ms} | 128–192 | ~47 | ~214 | ~332 each | ~11.6K each | 0.005 | 0.002 |
| SEA/khmer/es, fr, th | 26 / 45 / 45 | 1 / 5 / 2 | 18 / 32 / 55 | 27 / 53 / 110 | 0.7K / 1.2K / 3.3K | ≤0.002 | ≤0.001 |
| **Total, 29 locales** | | | | **28,926** | **1.38M** | **$0.60** | **$0.30** |

Wider scope, for reference:
- All 44 manifest locales: 41.0K strings / 2.17M chars, about $0.91 at M3 list price.
- The 64 orphan locales: 86.0K strings / 5.1M chars, about $2.13. These should probably be deleted rather than translated; that is a product call.
- **On MiniMax's flat plan, the marginal cost is $0.**

**How the estimate was made.**
- Token ratios are calibrated from the trial: about 0.61 input tokens and 0.37 output tokens per source char, with the output ×1.4 for ja/zh.
- Counts come from `scratchpad/locale-counts.json`.
- The Latin heuristic slightly overcounts cognates that really are identical ("Hotel", "Taxi", numerals). The `--fill` echo logic must tolerate these, as `echoRatio` already does for numerals.

**Throughput** at the measured latency (35 strings per call):
- MiniMax-M3: about 4 s per call, so about 1 hour sequential for 28.9K strings, or about 15 min at concurrency 4. The plan's daily call caps may apply; one memory note records a 100/100-per-day limit on the minimax-anthropic vision path.
- glm-5.3-flash: about 18 s per call, so about 4–5 hours sequential.

## 4. Model comparison (trial run 2026-09-28)

**Set-up.**
- **Sample:** 30 croatian vocab items (word + English gloss) and 5 croatian en prose strings (concept/culture intros and bodies), translated en→de and en→fr; plus 10 thai vocab items and 2 thai prose strings, translated en→ja.
- **Prompt:** one batched call per job, with word context for glosses, returning a JSON id→string map. There were 2 runs per job per model, so 6 calls per model.
- **Why prose instead of notes:** the en tree has no `contrastiveNote`, because notes only exist in the learner language. The en prose strings stand in for the "5 notes".
- Harness and raw outputs: `scratchpad/cmp/{run.mjs,sample.json,results.json}`.

| Model | Endpoint | Calls OK | Retries | Missing ids | Latency, 35-string batch (de/fr) | Latency, 12-string (ja) | Cost |
|---|---|---|---|---|---|---|---|
| **MiniMax-M3** | api.minimax.io/anthropic/v1/messages | 6/6 | 0 | 0 | 3.0–7.1 s | 2.8–3.6 s | $0 (flat plan; list $0.20/$0.80 per 1M) |
| **glm-5.3-flash** | api.z.ai/api/paas/v4 (reasoning low) | 6/6 | 0 | 0 | **17–21 s** | 4.6–5.1 s | z.ai key; not in `ai-pricing` |
| **gemini-3.5-flash-lite** | generativelanguage v1beta | 6/6 | 0 | 0 | 3.4–4.6 s | 1.5–1.6 s | about $0.002 total |

On failure rate: **glm-5.3-flash on its Anthropic-compat endpoint failed 3/3 with 429** (z.ai and bigmodel alike). A 2026-09-27 trial also recorded GLM 5.3 Flash intermittently returning empty content. The paas endpoint was clean in 6/6.

**Quality**, from my own reading of every output (scores out of 5):

| | Vocab glosses (de/fr/ja) | Prose (de/fr/ja) | Defects seen |
|---|---|---|---|
| **MiniMax-M3** | 4.8 | 4.4 | **An English leak in 1 of 12 job-runs:** th→ja `ข้าวเหนียวมะม่วง` became "マンゴー sticky rice" (run 2; run 1 was fine). Mixed register in de (Sie in one text, *denke an* in another). Slightly literal ("Heiligentage"). Glosses were otherwise correct; it disambiguated desno → *rechts* / *à droite* and pluralised "Krautwickel" naturally. |
| **glm-5.3-flash** | 4.9 | **4.7** | FR "sanctuaires *marials*" (should be *mariaux*). Otherwise the most idiomatic: "Marienheiligtümer", "Harmonik", "Sängerinnen und Sänger", consistent Sie, "man denke an". Adds parenthetical originals ("Kohlrouladen (Sarma)"; "ソンクラーン(タイ正月)" in 1 run), which is fine for glosses. Stable across runs. |
| **gemini-3.5-flash-lite** | 4.7 | 3.8 | **The non-word "Marienschilfen"** ("Marian reeds") in de. **It rewrote "just like English" as "wie das Deutsche"** in the alphabet intro while keeping the 'cat'/'city'/'though' examples, which makes the explanation false. It also misspelled the dish as "カオニャ・マムアン" (should be カオニャオ) and capitalised "Mardi" once. Fastest. |

All three handled the vocab glosses (the `meaning` field, which is the bulk of the balkan gap) at near parity once the target word was given as context. The differences show in the prose.

### Recommendation

1. **Default: MiniMax-M3.**
   - It is free on the flat plan, fast, and made 0 transport failures.
   - It is already the default provider in `generate-source-locale.ts`, and the operator's translation standing order already names it ("use MiniMax M3, never Gemini" for i18n).
   - Its one real defect, an occasional English leak or echo, is exactly what the per-string validator in §3.5 catches. The existing echo guard already exists because of it.
2. **Fallback / reviewer: glm-5.3-flash** via `api.z.ai/api/paas/v4/chat/completions` with `reasoning_effort: "low"`.
   - Use it as the failover when M3 errors or a string fails validation twice.
   - Optionally use it as a prose-only second pass on intro/body/tips strings of more than 80 chars for de/fr, where it read noticeably better.
   - Do not make it the default: it is 4–5× slower, its Anthropic endpoint is rate-limited, and it was reported to return empty content intermittently.
   - Pin `max_tokens` at 8K or more. It is a reasoning model, and the AI-SDK default of 4096 truncated it in the 09-27 trial.
3. **Not Gemini flash-lite** for learner-facing prose. Its over-localisation ("English" → "German") silently produces false teaching content. It is also against the operator's standing preference.
4. **Before enabling any locale:** have a native or strong-model spot-check of ch1 per locale (about 50 strings), and run each app's `tests/unit/content-integrity.spec.ts` after the regenerate.
