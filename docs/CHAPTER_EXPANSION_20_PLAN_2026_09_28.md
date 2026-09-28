# Chapter expansion 15 → 20 — plan (2026-09-28)

**Status:** plan, operator-requested 2026-09-28 ("scale the most mature apps to 20 chapters, via
scripts customised per language on common infra"). **Owners:** learn-quest session (common
pipeline in lq-tools/lq-operations); lang-quest session (per-language configs + runs + review).
**Companion:** [`INTEREST_ELECTIVES_SPEC_2026_09_28.md`](./INTEREST_ELECTIVES_SPEC_2026_09_28.md).
New chapters ship with elective groups from day one.

## What exists (survey 2026-09-28)

- **No "add chapters 16–20" script exists.** Every template stops at 15. The "romance to 15" work
  (§D) was AI-authored in agent sessions (romanian ch11–15 lq-romance#23, french ch11 #24), not by a
  committed tool.
- **Best base: `lq-tools/packages/app-generators`** (`create-app.ts` / `create-group.ts`)
  - Already takes `--chapters=16-20`, `--batch-lessons`, `--with-audio`, `--with-images`,
    `--resume`, `--dry-run`, `--budget`.
  - Scaffolds `chapters.json` from `src/config/curriculum.json` plus per-language
    `src/languages/<lang>.json` (61 languages: `chapterThemes`, `bossTheme`, `cultureTopics`,
    overrides).
  - Model: gemini-3.1-flash-lite.
  - Last touched 2026-09-08, and it **targets the old `public/apps/<lang>` layout**, which must be
    re-pointed at `languages/<lang>/data/<locale>/`.
- Per-app `scripts/generate-lesson-files.ts` (nordic, romance, english) publishes source → public
  and honours `shipChapters`. It is not a generator.
- Hardcoded 15 limits to lift:
  - `curriculum.json` and each `languages/*.json` (themes, bosses, culture topics).
  - `prompt-builder.ts:19-39` and `known-languages.ts:29,38`.
  - `audio-tools generate-audio-cli.ts:389` (`endCh = 15`).
  - app-audit `targets.chapters ?? 15` (`checks/lessons.ts`, `gap-analysis.ts`, `checkers/audio.ts`).
  - content-audit reporters.
  - `estimate-locale-cost.ts:54`.
  - `translations-generator.ts:52`.

  lq-core has no hard cap (the map and boss layout are data-driven); print-cards tiers treat 11+ as
  one tier.

## Curriculum for chapters 16–20 (upper-intermediate, ~B1+/B2)

Chapters 14–15 are "Advanced Grammar" and "Fluency & Idioms". The new chapters are
**thematic B2 chapters** that reuse that grammar in context:

| Ch | Theme key | Title | Core focus |
|---|---|---|---|
| 16 | society | Society & Current Affairs | news, opinions, agreeing and disagreeing, passive voice |
| 17 | science-tech | Science & Technology | explaining processes, conditionals, digital life |
| 18 | arts-literature | Arts, Literature & Film | describing and reviewing, narrative tenses, a short authentic text |
| 19 | environment | Environment & Global Issues | cause and effect, hypotheticals, debate phrases |
| 20 | mastery | Professional & Formal Communication | formal register, email and letter, presentation, final boss |

Per chapter: **10 core lessons**, which is ch13 plus review. Mix: concept ×2, vocab ×2, drill,
word-order, conversation, culture, multiple-choice, review. Add the **elective group**, with the
quota rule giving 3 on 10 core lessons. That is 50 core lessons per language plus electives, and
bosses, achievements and terrain themes for each new chapter.

Per-language customisation stays in `app-generators/src/languages/<lang>.json`:

- `chapterThemes[16-20]` (visual scenes)
- `bossTheme.bosses[16-20]`
- `cultureTopics[16-20]`
- `chapterOverrides`, for things like the Danish "Folkemødet" or the French "la presse"

## Pipeline (common infra)

1. **G1 (lq-tools app-generators)**
   - Extend `curriculum.json` to 20 chapters; turn the 15s into `curriculum.chapters.length`.
   - Re-point output to `languages/<lang>/data/<locale>/`.
   - Add a **merge** step that appends ch16–20 into the existing `chapters.json` without touching
     ch1–15.
   - Emit `{lessons:[…]}` wrappers and `elective` groups.
   - `--dry-run` must produce a diff.
2. **G2 (quality gates)**
   - Vocabulary allowed = chapters ≤ N + chapter topic (reuse lq-english `fill-empty-lessons.ts`
     validation).
   - `lq-operations validate-content-shape.ts` + `validate-word-order.ts`.
   - Lift the audit and audio 15-defaults to "from data".
   - `aiDraft: true` flag until reviewed, as romanian ch11–15 did.
3. **G3 (assets)**
   - Images: `enrich-lesson-images.ts` / `generate-vocab-images.ts`, then
     `bootstrap-regen-configs.ts --lang`.
   - Audio: `generate-audio-cli.ts --chapters=16-20` (edge-tts, per-app `voices.json`).
   - Then `reconcile-*-refs.ts`, and sync to R2 via `sync-to-storage.ts`.
4. **G4 (per language, lang-quest)**
   - Fill `languages/<lang>.json` ch16–20.
   - Run `create-app --chapters=16-20 --batch-lessons`, review, then `generate-lesson-files.ts`.
   - Deploy.

## Rollout order (by maturity; source = public at 15 chapters is the entry condition)

1. **nordic / danish** (pilot, the only app on web-app 0.5.x), then icelandic, norwegian, swedish.
2. **english / american** (after the P2.4 branch merges american `shipChapters` 15), then the other
   English varieties once they ship 15.
3. **romance**: french, italian, portuguese, spanish once §D closes (french ch12–14 is still
   uncommitted).
4. Candidates after that: east-asian ja/ko, germanic de/swiss, southeast-asian thai, slavic russian.
   Each must first be deployed and pass the source = public check.

Cost: text ≈ $0.001/lesson (flash-lite). Images ≈ 1–2 per lesson × $0.0335 (batch). Audio via
edge-tts is $0. Per language that is ≈ $3–5 plus review time.
