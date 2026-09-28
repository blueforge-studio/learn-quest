# Filling the empty lessons — plan (2026-09-28)

**Data:** `docs/audits/lang-lesson-gaps-2026-09-28.json`. It was computed from each app's `origin/main`
(git blobs, not local checkouts, which were stale; romance read 204 locally but 18 on main).
Re-run it with `/tmp/claude-501/fresh_stats.py`, to be moved into lq-operations as a script.

## Where the gaps are (English source, declared in chapters.json but missing or empty)

| App | Gap | ch1–5 | ch6–10 | ch11–15 |
|---|---|---|---|---|
| balkan | 608 | 1 | 247 | 360 |
| southeast-asian | 465 | 40 | 223 | 202 |
| south-asian | 464 | 0 | 184 | 280 |
| african | 371 | 1 | 163 | 207 |
| celtic | 284 | 13 | 111 | 160 |
| middle-eastern | 265 | 0 | 105 | 160 |
| uralic | 201 | 0 | 81 | 120 |
| east-asian | 196 | 39 | 100 | 57 |
| english | 196 | 0 | 48 | 148 |
| west-slavic | 196 | 1 | 75 | 120 |
| germanic | 193 | 1 | 90 | 102 |
| slavic | 128 | 3 | 91 | 34 |
| romance | 18 | 0 | 15 | 3 (the empty dialogues) |
| nordic | 0 | — | — | — |
| **Total** | **3,585** | **99** | **1,533** | **1,953** |

The gap is the second half of each course (97% is in ch6–15). The explanation-language locales are a
separate problem (see `audits/locale-translation-pipeline-2026-09-28.md`).

## How we fill them

- **Tool:** lq-tools `extend-chapters --fill-missing` / `--fill-existing`.
  - It drafts every declared lesson that has no file or has empty content.
  - Vocab-driven types (drill, word-order, spelling) are seeded from the app's existing vocab lessons.
  - Dialogues use the new real dialogue writer (lq-tools#39).
- **Model:** **MiniMax M3** (flat-rate, $0), with **glm-5.3-flash** as automatic fallback
  (operator directive; the switch is in progress in lq-tools). Not Gemini flash-lite.
- **Quality gates, per app, before merge:**
  - Every lesson is JSON-validated. A failed lesson is skipped, never stubbed.
  - `validate-content-shape`: 0 errors.
  - App unit tests pass, plus a cold-clone frozen install.
  - A spot-read of 3 lessons per language for correctness and target language.
  - `aiDraft` stamp.
- **Release:** `mark-release --beta`, so lessons are visible with the Beta badge. Promote them with
  `--reviewed` once a human has checked them.
- **Hide what's still empty:** the lq-core runtime guard (in progress) skips empty or missing lessons,
  so gaps never show as dead ends while the fill rolls out.
- **Publish:** each app's `generate-lesson-files` (now with `aiDraft`/`releaseStage`/`facets`
  passthrough), then a PR per app with CI green, merge, and a body-verified live check.
- **Cost and approvals:** text only on MiniMax, $0. No images or audio in this pass; lessons
  reference no new assets. Image/audio follow-up batches go to the operator for approval (>200 items).

## Order (finish nearly-complete flagships first, then by learner reach)

1. **Near-complete languages first:** japanese, korean, german, swiss, russian, american, spanish,
   portuguese, french, vietnamese, thai, swahili. Remaining gaps are small, and these are the most-used
   languages.
2. **romance** (18 dialogues) and **east-asian** (japanese/korean ch1–5 gaps, then chinese).
3. **One app at a time for the ~40%-missing families:** germanic (dutch/flemish), slavic,
   west-slavic, uralic, middle-eastern, celtic (including Cymraeg, see below), african,
   south-asian, southeast-asian, balkan.
4. **Last:** cantonese (125/213) and breton (97/202).

Each app is its own PR. A bad batch never blocks the others, and the operator can review any app's
sample before its merge.

## Welsh: support both English-in-Wales and Cymraeg

**Finding:** lq-english's `welsh` language is **Cymraeg** ("Shwmae, Elin! Sut wyt ti?"). It was
retired on 09-09 for that reason and re-enabled as beta on 09-27. lq-celtic *also* teaches Cymraeg
(15 chapters, 171 declared, ~100 written). So today there are two partial Cymraeg courses and no
English-in-Wales course.

**Proposal:**

1. **Cymraeg lives in lq-celtic.** Merge the best of lq-english/welsh into lq-celtic/welsh: its
   lessons fill celtic's gaps where ids or topics match, and its TTS voice work (#34/#36) is reused.
   Then fill the rest with the same pipeline. This course gets the full 15 chapters.
2. **lq-english/welsh becomes "Welsh English"** (English as used in Wales), a regional English
   variant like australian/british/scottish. Is it worth it? Only as a small variant:
   - **Useful for:** learners relocating to or visiting Wales. Covers bilingual signage and place
     names, common Welsh loanwords in everyday English (cwtch, hiraeth, bach), Wenglish idioms
     ("now in a minute", "tidy"), pronunciation of Welsh names, and cultural context.
   - **Low effort:** it reuses the english/american core.
   - **Scope:** **5 chapters** (ch1–5 authored, released as beta). The other chapters stay declared
     but hidden (empty → skipped at runtime), marked TODO, with `shipChapters: 5`.
   - **Before that ships:** the current Cymraeg lessons move out of lq-english, so the app stops
     presenting Welsh as English.
3. **Cross-link** the two: English-learners in lq-english get a "Learn some Cymraeg →" pointer to
   lq-celtic.
