# Lang apps: source vs published lesson trees (2026-09-28)

Read-only audit. No commits, pushes or spend. For each of the 14 LangQuest language apps, the question was which tree is authoritative when they disagree, so that `scripts/generate-lesson-files.ts` can be re-run safely:

- the **source** tree: `languages/<lang>/data/<locale>/{chapters.json,lessons/chapter-N/*.json}`
- the committed **published** tree: `public/data/lessons/<locale>/<lang>/chapters/...`

## Method

- Each app got a throwaway worktree off `origin/main`, created with `GIT_LFS_SKIP_SMUDGE=1`. The generator ran there. Every generator uses only `fs`/`path`, so no dependency install was needed; the global `tsx` was used.
- Every changed, deleted or added file under `public/data/lessons` was classified by comparing the parsed JSON of HEAD (published) against the regenerated output and against the source lesson file.
- **Disabled locales (balkan, southeast-asian):** all `enabled` flags were flipped to `true` and the generator re-ran. This shows whether the source can still reproduce the published locale.
- **Live check:** every committed `chapters.json` and `index.json` (133 files) was fetched from `https://<family>.lang-quest.blueforge.studio/data/lessons/...` and compared as parsed JSON, not by status code. At-risk lesson files were spot-checked the same way.
- **Git history is not usable for "which is newer".** Every repo's main is squash-seeded, so almost every path's last commit is the 09-09 root. The verdicts below rest on content comparison. Where real later commits exist, they are cited.
- All worktrees were removed afterwards (`git worktree list` is clean in all 14 repos).

**Classes used below**

| Class | Meaning | Verdict |
|---|---|---|
| FORMAT | Parsed JSON identical. Only the trailing newline or key order in `chapters.json` differs. | Generator right, harmless |
| SRC_SUPERSET | The source has the published content plus extra keys (for example `morphology`). | Generator right, source is newer |
| TITLE | Content identical. The title now comes from the author-set source title instead of the `inferTitle()` prefix ("Concept: Arabic Roots" becomes "Arabic Roots"). | Generator right |
| **PUB_ONLY** | The published file has real content. The source file is missing or empty, so the generator emits `{}` or deletes the file. | **Source regression: restore from public** |
| PUB_SUPERSET | The published file has extra keys the source lacks. | Restore from public (minor) |
| STUB_DEL | The published file is a `{}` stub with no source. The generator stops emitting it. | Generator right, but see the dangling-reference bug below |
| LOCALE_DISABLED | `locales.<loc>.enabled: false` in `locale-manifest.json`. | Generator right, but it is a product decision because the locale is live today |
| BEYOND_SHIP | The chapter is past `shipChapters` and the file is already unreferenced by the published `chapters.json`. | Generator right |

## Key findings

1. **The word-order rebuild of 2026-09-09 wrote about 6 lessons per language only into `public/`.**
   - The rebuild is the "content: rebuild the word-order exercises from sentences this repo owns" PRs.
   - The affected lessons are `word-order-{health|<lang>-culture}` (ch6), `-past-tense` (ch7), `-compound` (ch8), `-weather` (ch9), and `-complex` + `-relative` (ch14).
   - None of these have a source file. Their chapters in the source tree are largely unauthored.
   - They are the only real content in those chapters, and they are **live**. For example, `african …/afrikaans/chapters/chapter-14/word-order-complex.json` serves 6 exercises.
   - A regen blanks them in the `{}`-emitting generators (african, balkan, celtic, south-asian, uralic, west-slavic) and deletes them in middle-eastern and slavic.
   - The sentences are genuine: each has a target sentence, scrambled tokens and an English hint. They are topic-generic, though; the "weather" lesson contains greetings. **226 files fleet-wide.**
2. **Two hand-authored alphabet lessons exist only in `public/`:**
   - `hindi/en ch1 alphabet-devanagari-first-letters` has 10 characters and an authored intro. It is missing from the source `chapters.json` *and* from the source lessons, so a regen drops it from the chapter list.
   - `greek/en ch1 alphabet-greek-first-letters` is listed in the source `chapters.json`, but its file is missing, so a regen blanks it.
   - The arabic, hebrew, russian and ukrainian alphabet lessons do have sources; their diff is metadata only.
3. **The middle-eastern and slavic generators have a dangling-reference bug.**
   - They skip a lesson file when the source has no content, but they do *not* prune that lesson from `chapters.json` (the lq-romance/nordic generators do).
   - A regen leaves **277 (middle-eastern) and 137 (slavic)** `chapters.json` entries pointing at files that no longer exist. The SPA fallback serves HTML for them, which is worse than the current blank `{}` stubs.
4. **Whole-locale drops (balkan de/es/fr, southeast-asian 14 locales) come from `enabled: false`, and nothing is lost from source.**
   - The flags have been `false` since the squash root.
   - The generators only started honouring them in the P2.4 PRs (for example lq-balkan#27 on 09-21), and `public/` was never regenerated afterwards.
   - The published locales **are live** and match main exactly. They are not really localized, though:
     - **Balkan de/es/fr:** 0 of 203 vocab meanings translated (English shown to German, Spanish and French learners), and 35–54% of lessons are `{}` stubs. Only `contrastiveNote` is localized.
     - **Southeast-asian:** at most 11% of meanings translated; thai de/fr/ja/zh have no empty lessons.
   - Flipping `enabled` back reproduces the southeast-asian published tree **byte-identically** (0 diffs). For balkan, the only differences are the same word-order PUB_ONLY files (6 per language × locale) plus FORMAT.
5. **English welsh was deliberately re-enabled on 09-27** (e9b74f9, "ship the welsh voice as beta (#34)(#36)"), reversing the 09-09 retirement in 249e45b, but `public/` was never regenerated. The generator is right: 72 lessons in ch1–5 plus the index entry get added. Live has no welsh today. Note that 249e45b documented that welsh teaches Cymraeg with 37 of 67 pairs untranslated. Adding it is a publish decision, not a data-safety question.
6. **Romance: live is ahead of main.** Live serves 15 chapters (134 french lessons). Main's committed `public/` already ships 5 (`shipChapters: 5`, added in 55f6362 today), and the regen agrees with main. **The next romance deploy will narrow live from 15 chapters to 5 whether or not the generator is re-run.** Confirm this is intended.
7. **Live equals committed `public/` for 13 of 14 apps** (127 of 127 `chapters.json` and `index.json` files match). Romance is the only mismatch (finding 6).

## Per-app verdicts

### lq-african: M 66, D 0, A 0
| Class | Count |
|---|---|
| FORMAT | 33 |
| PUB_ONLY (word-order) | 33 |

| Language/locale | Verdict |
|---|---|
| afrikaans/en | source must be restored from public (6 files) |
| amharic/en | source must be restored from public (6) |
| swahili/en | source must be restored from public (6) |
| hausa/en | source must be restored from public (5) |
| yoruba/en | source must be restored from public (5) |
| zulu/en | source must be restored from public (5) |

**Remediation:** copy the 33 public word-order files (ch6, 7, 8, 9, 14) into `languages/<lang>/data/en/lessons/chapter-N/<id>.json`. The public file already has the `{lessons:[{id,title,type,chapterId,content,…}]}` shape the loader reads. After that, regenerating is safe.

### lq-balkan: M 190, D 2586, A 0
| Class | Count |
|---|---|
| FORMAT | 46 |
| SRC_SUPERSET (`morphology` added in source) | 89 |
| PUB_ONLY (word-order ×53 + greek alphabet) | 54 |
| `chapters.json` key order (greek) | 1 |
| LOCALE_DISABLED lessons | 2568 |
| LOCALE_DISABLED `chapters.json` | 15 |
| LOCALE_DISABLED `index.json` (de/es/fr) | 3 |

| Language/locale | Verdict |
|---|---|
| albanian/en | mixed: source must be restored from public (5 word-order); 10 SRC_SUPERSET, where the generator is right |
| bosnian/en | mixed: restore 6; 2 SRC_SUPERSET |
| bulgarian/en | mixed: restore 6; 15 SRC_SUPERSET |
| croatian/en | mixed: restore 6; 9 SRC_SUPERSET |
| greek/en | mixed: restore 7 (6 word-order + `alphabet-greek-first-letters`); 14 SRC_SUPERSET |
| macedonian/en | mixed: restore 6; 10 SRC_SUPERSET |
| romanian/en | mixed: restore 6; 8 SRC_SUPERSET |
| serbian/en | mixed: restore 6; 7 SRC_SUPERSET |
| slovenian/en | mixed: restore 6; 14 SRC_SUPERSET |
| bulgarian, croatian, greek, romanian, serbian × de/es/fr | generator right (`enabled: false`). Live content is untranslated alpha; the source still holds it. If a locale is ever re-enabled, first restore its 6 word-order files from public (90 files in total). |

**Remediation:**
1. Restore 54 en files: 53 word-order plus the greek alphabet.
2. Decide on de/es/fr. Either accept the drop, which removes the Balkan cards from the de/es/fr home screens, or flip `enabled: true`.
3. Then regenerate.

The morphology enrichment currently missing from live will ship with that regen, which is intended.

### lq-celtic: M 47, D 0, A 0
| Class | Count |
|---|---|
| FORMAT | 26 |
| PUB_ONLY (word-order) | 21 |

| Language/locale | Verdict |
|---|---|
| breton/en | source must be restored from public (6, including ch6 `word-order-breton-culture`) |
| irish/en | restore 5 |
| scottish-gaelic/en | restore 5 |
| welsh/en | restore 5 |

**Remediation:** restore the 21 files, then it is safe to regenerate.

### lq-east-asian: 0 changes
japanese/en and korean/en: generator right, safe to regenerate. cantonese and chinese are gated at the top level and were already absent from `public/`.

### lq-english: M 39, D 0, A 73
| Class | Count |
|---|---|
| FORMAT | 38 |
| `index.json` (+welsh) | 1 |
| ADDED welsh ch1–5 lessons | 72 |
| ADDED welsh `chapters.json` | 1 |

| Language/locale | Verdict |
|---|---|
| american, australian, british, scottish/en | generator right (format only) |
| welsh/en | generator right: source was deliberately re-enabled on 09-27 (#34/#36) |

**Remediation:** safe to regenerate. It will publish welsh beta. If welsh should *not* go live, set `enabled: false` again in `languages/welsh/data/locale-manifest.json` before regenerating. The 09-09 retirement rationale (Cymraeg, not Welsh English) was never rebutted in #36.

### lq-germanic: 0 changes
dutch, flemish, german and swiss/en: generator right, safe to regenerate.

### lq-middle-eastern: M 422, D 277, A 0
| Class | Count |
|---|---|
| TITLE (author title replaces the inferred prefix) | 419 |
| alphabet metadata-only (arabic, hebrew) | 2 |
| `chapters.json` key order (hebrew) | 1 |
| STUB_DEL `{}` | 253 |
| PUB_ONLY (word-order) | 24 |

| Language/locale | Verdict |
|---|---|
| arabic, hebrew, persian, turkish/en | mixed: source must be restored from public (6 word-order each, 24 in total). Titles and stub removal are right, **but the generator bug below must be fixed first.** |

**Remediation:**
1. Port the romance/nordic prune step (`skippedLessons` plus `chapters.chapters.filter(c => c.lessons.length > 0)`) into `scripts/generate-lesson-files.ts`. Without it, a regen leaves 277 dangling `chapters.json` references.
2. Restore the 24 word-order files.
3. Then regenerate.

After this, chapters 9–15 shrink to the lessons that actually exist, which is the intended behaviour.

### lq-nordic: 0 changes
All languages and locales: generator right, safe to regenerate.

### lq-romance: M 25, D 102, A 0
| Class | Count |
|---|---|
| FORMAT | 21 |
| PUB_SUPERSET (`morphology` on word-order tokens, added to `public/` only by 55f6362) | 4 |
| BEYOND_SHIP (ch6–15, already unreferenced) | 102 |

Of the 102 BEYOND_SHIP files, 97 are identical to source. The other 5 (french ch10/11 vocab) have a **newer** source, from today's ch11 authoring.

| Language/locale | Verdict |
|---|---|
| french, italian/en | generator right |
| portuguese/en | mixed: restore 1 (`ch3 word-order-directions` morphology) |
| romanian/en | mixed: restore 1 (`ch4 word-order-possessives`) |
| spanish/en | mixed: restore 2 (`ch1 word-order-simple`, `ch4 word-order-possessives`) |

**Remediation:** either copy those 4 public files into source or re-run the morphology enricher against source. Then regenerate. The narrowing of live from 15 chapters to 5 (finding 6) happens on the next deploy regardless.

### lq-slavic: M 385, D 137, A 0
| Class | Count |
|---|---|
| TITLE | 382 |
| alphabet metadata-only (russian, ukrainian) | 2 |
| `chapters.json` key order (ukrainian) | 1 |
| STUB_DEL `{}` | 119 |
| PUB_ONLY (word-order) | 18 |

| Language/locale | Verdict |
|---|---|
| belarusian, russian, ukrainian/en | mixed: restore 6 word-order each (18 in total). The rest is right, but it has the same dangling-reference generator bug (137 refs). |

**Remediation:** the same as middle-eastern. Port the prune step, restore 18 files, then regenerate.

### lq-south-asian: M 78, D 1, A 0
| Class | Count |
|---|---|
| FORMAT | 38 |
| PUB_ONLY (word-order) | 39 |
| `chapters.json` (hindi) | 1 |
| PUB_ONLY deleted (hindi alphabet) | 1 |

| Language/locale | Verdict |
|---|---|
| bengali, hindi, tamil, urdu/en | restore 6 word-order each |
| marathi, punjabi, telugu/en | restore 5 each |
| hindi/en (additional) | restore `chapter-1/alphabet-devanagari-first-letters.json` **and** re-add its entry (order 2, type `alphabet`) to `languages/hindi/data/en/chapters.json` ch1 |

**Remediation:** restore 40 files plus the one `chapters.json` entry, then it is safe to regenerate.

### lq-southeast-asian: M 0, D 2373, A 0
| Class | Count |
|---|---|
| LOCALE_DISABLED lessons | 2352 |
| LOCALE_DISABLED `chapters.json` | 14 |
| LOCALE_DISABLED `index.json` (de/es/fr/ja/ms/th/zh) | 7 |

| Language/locale | Verdict |
|---|---|
| burmese, indonesian, khmer, lao, malay, tagalog, thai, vietnamese/en | generator right (no diff) |
| indonesian es/fr/ms, khmer es/fr/th, thai de/es/fr/ja/zh, vietnamese es/fr/zh | generator right by manifest; the source is intact (flipping `enabled` reproduces `public/` byte-identically). This is purely a product decision on the live alpha locales. |

**Remediation:** no content restore is needed. Decide per locale: flip `enabled: true` to keep it live, or accept the drop. Thai de/fr/ja/zh are the most complete, with no empty lessons. Then regenerate.

### lq-uralic: M 33
15 FORMAT and 18 PUB_ONLY. estonian, finnish and hungarian/en each need 6 files restored from public; after that it is safe to regenerate.

### lq-west-slavic: M 33
15 FORMAT and 18 PUB_ONLY. czech, polish and slovak/en each need 6 files restored from public; after that it is safe to regenerate.

## Fleet summary, ranked by risk of a blind regen

| # | App | Blind-regen damage | Restore from public | Other preconditions |
|---|---|---|---|---|
| 1 | balkan | drops the de/es/fr locales live (2568 files); blanks 54 real lessons, including the greek alphabet | 54 | de/es/fr decision |
| 2 | middle-eastern | 277 dangling `chapters.json` refs; 24 real lessons deleted | 24 | port the prune step |
| 3 | slavic | 137 dangling refs; 18 real lessons deleted | 18 | port the prune step |
| 4 | south-asian | hindi alphabet unlisted and deleted; 39 lessons blanked | 40 + 1 `chapters.json` entry | none |
| 5 | southeast-asian | drops 14 alpha locales live (2352 files); nothing lost from source | 0 | per-locale enable decision |
| 6 | african | 33 lessons blanked | 33 | none |
| 7 | celtic | 21 lessons blanked | 21 | none |
| 8 | uralic | 18 lessons blanked | 18 | none |
| 9 | west-slavic | 18 lessons blanked | 18 | none |
| 10 | english | publishes welsh beta (72 lessons), which is intended per #36 | 0 | confirm welsh should go live |
| 11 | romance | 4 morphology annotations lost | 4 (optional) | live narrows from 15 to 5 chapters on the next deploy anyway |
| 12 | east-asian, germanic, nordic | none | 0 | safe now |

**Total source restores:** 230 files (226 word-order, 2 alphabet, 4 romance morphology) plus 1 hindi `chapters.json` entry. A further 90 balkan de/es/fr word-order files are needed only if those locales are re-enabled.

**Pre-existing, not caused by a regen:** apart from the restores above, the `{}`-emitting generators already advertise blank lessons live:

| App | Blank `{}` lessons (en) |
|---|---|
| african | 371 |
| balkan | 608 |
| celtic | 282 |
| south-asian | 464 |
| southeast-asian | 465 |
| uralic | 201 |
| west-slavic | 196 |

These come from the unauthored ch6–15. Porting the romance/nordic prune generator fleet-wide would hide them. It is best done *after* the restores, or the word-order lessons get pruned with the stubs.

**Suggested order:**
1. Restore the files from public in each affected repo, one PR per repo.
2. Port the prune step to the middle-eastern and slavic generators, and ideally to all `{}`-emitters.
3. Take the locale decisions: balkan and southeast-asian enablement, and english welsh.
4. Regenerate and commit `public/` in the same PR, checking that the diff contains only the expected classes.
