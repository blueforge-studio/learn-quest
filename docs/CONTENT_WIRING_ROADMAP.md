# Content wiring — reachability, validity and the authoring backlog

*Measured 2026-09-04 across all 171 content trees in the 14 `lq-*` apps. Every
number here is reproducible with the command given beside it. Progress is
tracked in this file — check items off as they land.*

## Scope, and how this relates to the other roadmap

Two documents, two layers. Read both before planning work in either.

| | `FLEET_READINESS_ROADMAP.md` | **this file** |
|---|---|---|
| Layer | the **emit** path — `public/data/lessons`, written by `generate-lesson-files.ts` | the **source** path — `languages/<lang>/data/<locale>/` and its `chapters.json` |
| Question | what gets built and shipped | what a learner can actually reach and parse |
| Status | §1 done, §2 half, §3–5 open | this file |

They overlap in two places, and neither should be worked twice:

- **That roadmap's §4** ("`lq-nordic` at 105%" — authored content the index
  never advertises) is **§1 below**, and is ✅ **DONE**. It was never a
  `lq-nordic` quirk: 1,416 lessons fleet-wide, now 0.
- **That roadmap's §3** (4,155 distinct authoring gaps) and **§5 below**
  (3,971) are the same backlog counted at different layers and dates. Use one
  number, not both; prefer theirs for planning `shipChapters`.

## The finding

`HttpContentSource` reads exactly two things:

1. `chapters.json` — the only index of which lessons exist
2. `<chapterId>/<lessonId>.json` — the content, parsed with `LessonFileSchema`

Nothing else is consulted. The `lessons/chapter-N-bundle.json` and
`lessons.json` aggregates sitting beside the content are read by **no code in
the fleet** — a dead earlier format. A lesson's presence in one means nothing.

That yields four independent faults, none of which a filesystem walk can see:

| fault | meaning | count |
|---|---|---|
| `no-index` | tree has lessons and no `chapters.json` — serves **nothing** | 0 ✅ *(was 62)* |
| `invalid` | listed, but fails `LessonFileSchema` — throws `ContentShapeError` | 0 ✅ *(was 188)* |
| `dangling` | listed with no file — 404 per lesson | 5,829 |
| `unlisted` | file exists, no chapter names it — unreachable | 0 ✅ *(was 1,416)* |

```bash
npx tsx lq-core/scripts/validate-content.ts lang-quest --quiet   # exits non-zero if any
```

**Why `unlisted` matters more than it looks:** an unreachable lesson is also an
*unvalidated* one. The 188 `invalid` lessons — `status: "unlocked"`,
`"bloqueado"`, `difficulty: "débutant"` — had sat broken for months precisely
because nothing listed them, so nothing ever tried to parse them.

---

## §1 · Unlock the written lessons — ✅ **DONE 2026-09-04**

**1,359 lessons made reachable** across 17 trees, by index edit alone. `unlisted`
is now 0 fleet-wide.

| tree | unlocked |
|---|---|
| `thai` × 7 locales | 833 |
| `danish` × 6 non-English locales | 456 |
| `burmese`, `lao`, `japanese`, `korean`, `icelandic` (`en`) | 14 |

Tool: `lq-core/scripts/list-unlisted-lessons.ts` (dry-run by default).

### What the fleet taught us, and why the tool never auto-resolves

The design decision that mattered was **reporting duplicates rather than
resolving them**, and the fleet proved it within an hour:

- **Danish** — the listed `vocab-*` twin was the BETTER generation. Its
  unlisted files were sentence-cased lemmas and conjugated verbs; the listed
  ones lowercase lemmas and infinitives. 49 files deleted (7 per locale).
- **Thai** — the same naming pattern was the WORSE one. `vocab-pronouns`,
  `vocab-basic-verbs` and `vocab-numbers-11-20` carried **English glosses in
  all seven learner locales** and glossed numbers as digits ("11"), while the
  un-prefixed files were properly localized in every locale and taught Thai's
  gendered first-person pronouns (ผม male-polite vs ฉัน female-casual).

**An auto-resolver preferring either filename destroys real content in one of
those two apps.** Overlap can identify a duplicate; only a human can say which
copy is better. Note too that `basic-verbs` and `vocab-basic-verbs` overlap
**0%** in Danish — one teaches present-tense forms, the other infinitives — so
they are complementary, not duplicates, and both were kept.

Where a discarded twin held unique content it was **merged, not dropped**: 42
Thai items across seven locales, glossed per locale — เป็น (to be), มี (to
have), อยาก (to want), รู้ (to know), เธอ (she), พวกเขา (they), มัน (it).

### Two bugs surfaced by doing this

- `status: "已锁定"` — Chinese for "locked". An earlier enum sweep missed it
  because the grep matched ASCII only. A full JSON scan of every enum field now
  reports zero invalid values fleet-wide.
- `validate-content.ts` used `process.exit()`, which tears the process down
  before stdout flushes and silently truncated `--json` output whenever it was
  piped rather than redirected. Now sets `process.exitCode`.

- [x] Build `list-unlisted-lessons.ts`
- [x] Fix the invalid `status`
- [x] Dry-run fleet-wide; adjudicate every duplicate by hand
- [x] Apply, validate, commit (4 repos)
- [x] Update counts

---

## §2 · Resolve the 47 untranslated trees — **REGRESSION, DO EARLY**

Generating the 62 missing `chapters.json` files made those trees reachable. **47
of them carry English glosses despite declaring a non-English learner locale.**
Before, they served nothing; now they would serve untranslated content to, say,
a Chinese or Thai learner. That is a regression introduced by the fix.

Breakdown of the 62 generated: 15 genuinely localized, 47 English-glossed
(`zh` 17, `ja` 9, `th` 8, `ko` 6, `de` 3, `es` 3, `fr` 1).

Two options, and they are not exclusive:

- **Gate now** (minutes, reversible) — hold these trees out of publishing via
  `shipChapters` or an equivalent flag, so nothing untranslated ships.
- **Translate** (tracked job) — `learnerLocale.meaning` and
  `learnerLocale.pronunciation` per item.

**Recommended: gate immediately, translate on a schedule.** Shipping nothing
beats shipping the wrong language.

- [ ] Confirm the gating mechanism with the `shipChapters` owner
- [ ] Gate all 47
- [ ] Queue translation, largest-locale first (`zh`, `ja`, `th`)

---

## §3 · Propagate 215 and repair 168 renames

Cheap, mostly scripted, both proven.

**215 dangling ids already exist in a sibling locale** — propagate then
translate rather than author. The largest single flow is **113 in
`lq-english/american/data/da`**, which today's `data/en` authoring just made
propagatable. Direct payoff.

**168 dangling ids are renames** — the file was renamed and the index never
updated. The matcher is proven: it repaired 39 of Danish's 42 with no false
positives, by requiring a *unique* same-chapter, same-kind, token-subset match
in both directions. Anything ambiguous is left for a human, which is correct —
`culture-capital-guide` → `culture-copenhagen-guide` needed a title check.

- [ ] Propagate the 113 `american/data/da` lessons
- [ ] Propagate the remaining 102
- [ ] Run the rename matcher fleet-wide, review, apply

---

## §4 · Wire `validate-content.ts` into CI

`lq-core/scripts/validate-content.ts` already exits non-zero on any fault.
Without it in CI, the 188 enum breakages recur — they survived for months only
because nothing parsed those files.

Four of the five fault classes are now at zero, so the gate can be strict about
those and lenient only where the real backlog lives:

- **Hard-fail** `no-index`, `bad-index`, `invalid` **and `unlisted`** — all 0
  after §1, so the gate goes in green and any regression is caught the day it
  lands. `unlisted` is worth failing on precisely because an unreachable lesson
  is also unvalidated; that is how the 188 broken enums survived.
- **Ratchet** `dangling` against a committed baseline (5,829). It is the
  authoring backlog of §5, so a hard failure would block every PR.

- [ ] Add to the fleet CI workflow
- [ ] Hard-fail no-index / bad-index / invalid / unlisted
- [ ] Ratchet dangling against a committed baseline

---

## §5 · The authoring backlog — 3,971 lessons

The largest item, and a programme rather than a task. **Cross-check against
`FLEET_READINESS_ROADMAP.md` §3 (4,155) before planning — same backlog, two
measurements.**

- 5,829 tree-level 404s collapse to **3,971 distinct (language, lesson) pairs**
  across **65 languages** in 14 apps. Median 67 per language; only 4 languages
  need ≤20.
- Only 215 exist in any sibling locale (§3). The rest are unwritten.
- The pattern is uniform: **chapters 6–15 are a curriculum plan, not content.**

**American English is the proven template** — 99 lessons authored 2026-09-04:

- Prose lessons (concept, culture, conversation, dialogue, word-order) authored.
- **Drills and quizzes derived** from each chapter's own vocabulary, never
  authored separately. They cannot drift out of sync and cannot test words the
  chapter never taught. Quiz distractors come from the same chapter, so no
  question is answerable by noticing three options belong to another topic.
- Glosses **define** the word rather than repeating it.

Worst offenders: `lq-balkan` (1,751 404s), `lq-southeast-asian` (928),
`lq-english` (524), `lq-south-asian` (482).

**Open question before starting:** does every language need 15 chapters, or
does the tail ship at 5? Answering that may remove most of this backlog. Decide
with `shipChapters` (that roadmap's §3) rather than by authoring.

- [ ] Decide the per-language chapter target
- [ ] Re-scope the backlog against that decision
- [ ] Author per language, American English as template

---

## Carried over — language-engine work

Open from the noun-morphology programme, unrelated to wiring.

- [ ] **Adjectives & locative prepositions.** Design spec written
      (`lq-core/docs/design/adjectives-and-prepositions.md`), unimplemented.
      Order: English comparison → Danish adjectives (agreement + comparison) →
      Danish locative prepositions (`på`/`i` do not map 1:1 to English).
- [ ] **Register the four family specs.** Turkish, Uralic, Semitic/Persian and
      Celtic have proposers and 17 passing tests, but no CLI registration,
      controls, drill frames, or runs against content.
- [ ] **Re-run Thai.** Coverage understated by the fixed `isCandidate`
      combining-marks bug; never re-run.
- [ ] **Finish South Asian.** Verify and apply te/mr/pa/ur and hi/bn.
- [ ] **~330 genuine splits** fleet-wide, awaiting human adjudication.

---

## Progress log

| date | what landed |
|---|---|
| 2026-09-04 | 62 missing `chapters.json` generated — `no-index` 62 → 0, 8,156 lessons made discoverable |
| 2026-09-04 | 188 schema-invalid lessons fixed (`status`, `difficulty` enums) — `invalid` → 0 |
| 2026-09-04 | Danish: 7 duplicates removed, 30 lessons unlocked, 3 authored — 0 dangling, 0 unlisted |
| 2026-09-04 | American English: 99 lessons authored, 14 review stubs and 4 placeholder spelling lessons rebuilt — 0 dangling, 0 unlisted |
| 2026-09-04 | `validate-content.ts` + `generate-chapters-json.ts` added; foundations now count only reachable lessons |
| 2026-09-04 | **§1 done.** 1,359 lessons unlocked across 17 trees (thai 833, danish 456); 49 Danish duplicates removed, 42 Thai items merged — `unlisted` 1,416 → 0 |
