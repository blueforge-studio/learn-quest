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
| `dangling` | listed with no file — 404 per lesson | 5,661 — now **exactly** the §5 authoring backlog |
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

## §2 · The untranslated trees — ✅ **RESOLVED 2026-09-04, and the premise was wrong**

**I was wrong about this, and the correction matters more than the original
claim.** I reported generating the 62 missing `chapters.json` as a regression
that would ship English glosses to non-English learners. It does not, and never
did.

The emit pipeline gates on `locale-manifest.json`, not on `chapters.json`:
`generate-lesson-files.ts` iterates `Object.entries(manifest.locales)`, so a
locale absent from that manifest is **never emitted at all**, whatever exists
under `languages/`. Verified empirically — `malay/data/{zh,ja,ko}` all have
source content and a generated index, none appears in `public/data/lessons`:

```
zh: source=True  in manifest=False  EMITTED=False
```

Every untranslated tree is unmanifested, so **none of them ship**. Nothing
needed gating. `chapters.json` makes content *addressable*; the manifest makes
it *published*, and I conflated the two.

### The real fault, found by checking

The same audit surfaced the opposite problem. `LocaleEntrySchema` makes
`enabled` a REQUIRED boolean, all fourteen generators declared it, and **none
ever tested it**:

| | count |
|---|---|
| locale entries marked `enabled: false` | 41 |
| ...of those, emitted and shipping anyway | **39** |
| maturity of all 39 | `alpha` |

Someone deliberately marked those locales not-ready and the pipeline shipped
them regardless. A required flag nothing reads is worse than no flag: the
manifest reads as a decision when it is only a comment.

Fixed in all 14 generators — `enabled: false` now skips the locale, `undefined`
still ships so older manifests are unaffected. 6,410 emitted lesson files
withdrawn across `lq-balkan`, `lq-nordic` and `lq-southeast-asian`.

**One thing to know before deploying:** the regeneration also refreshed a stale
emitted tree in eight other repos, including the live `lq-romance`. Those
commits carry morphology annotations and newly-listed lessons that were already
committed under `languages/` but had never been emitted. That is desirable, but
it is a production content change and the commit messages say so.

- [x] Establish the actual gating mechanism
- [x] Verify the untranslated trees do not ship
- [x] Make `enabled` mean what it says
- [ ] Decide whether the 39 alpha locales should be promoted rather than held

---

## §3 · Propagate 215 — **BLOCKED**; renames ✅ **DONE 2026-09-04**

### Renames — done

**168 dead index entries removed**, all six Danish sibling locales (28 each):
the same renames already repaired in `data/en`, unrepaired in `de`, `es`, `fr`,
`th`, `vi` and `zh`. Tool: `lq-core/scripts/repair-renamed-lessons.ts`.

They needed the *opposite* repair to `data/en`, and the reason is worth
recording: because §1 ran first, every renamed file is now listed under its own
name, so the stale id is a dead duplicate to delete rather than a broken
pointer to repoint. The script reported **zero** until it learned that second
case. Order matters — run §1 before this, and expect drops rather than
repoints.

**Fleet dangling is now 5,661, exactly the "needs authoring" figure.** Every
mechanically repairable index fault in the fleet is closed; what is left is
§5.

### Propagation — blocked on the §2 decision

The 215 dangling ids that exist in a sibling locale are **not** a mechanical
win, and should not be run before §2 is settled. The largest flow is 113 in
`lq-english/american/data/da` — American English taught to Danish learners.
Copying those from `data/en` yields English words glossed **in English**, which
is precisely the untranslated-content regression §2 exists to resolve.

Propagation is therefore propagate-**and**-translate, or it recreates the
problem at a smaller scale. Decide §2 first.

**215 dangling ids already exist in a sibling locale** — propagate then
translate rather than author. The largest single flow is **113 in
`lq-english/american/data/da`**, which today's `data/en` authoring just made
propagatable. Direct payoff.

**168 dangling ids are renames** — the file was renamed and the index never
updated. The matcher is proven: it repaired 39 of Danish's 42 with no false
positives, by requiring a *unique* same-chapter, same-kind, token-subset match
in both directions. Anything ambiguous is left for a human, which is correct —
`culture-capital-guide` → `culture-copenhagen-guide` needed a title check.

- [x] Run the rename matcher fleet-wide, review, apply — 168 removed
- [ ] **Blocked on §2:** propagate + translate the 113 `american/data/da`
- [ ] **Blocked on §2:** propagate + translate the remaining 102

---

## §4 · Guard it in CI — ✅ **WRITTEN 2026-09-04, needs a publish**

`createContentWiringTests` is in `@learnquest/unit-core`, with 7 tests, and
verified green against all 14 apps before landing.

It asserts **no-index**, **bad-index** and **unlisted**, and only *reports*
`dangling` — a dangling id is a lesson somebody still has to write, and failing
on it would block every PR behind the 5,661-lesson backlog of §5.

It went into the shared package rather than as a spec copied into each app: 14
copies of one check is precisely the tech debt `FLEET_READINESS_ROADMAP.md` §2
is trying to retire.

**Remaining, and deliberately not done:** apps pin
`@learnquest/unit-core@^0.1.4`, so this needs a package publish and a version
bump in 14 repos before it runs anywhere. Publishing to the registry is a
distribution step and wants a human on it.

- [x] Write the check in the shared package, with tests
- [x] Verify it goes in green across all 14 apps
- [ ] Publish `@learnquest/unit-core` and bump the 14 apps
- [ ] Add the 3-line spec to each app's `tests/unit/`

---

## §5 · The authoring backlog — reframed 2026-09-04

**Do not plan this from the declared chapter count, and do not plan it from the
total of complete chapters either.** Both mislead, in opposite directions.

### Inventory

`lq-core/scripts/content-inventory.ts` writes `content_inventory` to the shared
`.content-db.sqlite`, covering both fleet layouts —
`languages/<lang>/data/<locale>/` and school-quest's `content/<subject>/`.
`--by-language` reports each language from its BASE locale, because summing
locales counts one course up to seven times.

Chapters are counted three ways on purpose — declared, has-any-lesson, and
complete — because they diverge sharply. American English declared 15 and had
files for 5.

### The finding that reframes the work

`shipChapters` releases the FIRST N chapters, so a course's releasable size is
its **contiguous run from chapter 1**, not its total complete. Those two numbers
came apart badly:

| language | complete | contiguous | blocked by |
|---|---|---|---|
| korean | 13 | **1** | one missing lesson in ch2 |
| japanese | 9 | **0** | one missing lesson in ch1 |
| swedish | 14 | **6** | one missing lesson in ch7 |
| amharic | 4 | **0** | one missing lesson in ch1 |
| ukrainian | 4 | **0** | one missing lesson in ch1 |

**Five lessons were withholding 37 finished chapters.** Setting `shipChapters`
from the contiguous run without fixing them first would have *hidden* that
work — Korean would have released 1 chapter while 13 sat done on disk. Written
2026-09-04; Japanese, Korean and Swedish are now 15/15.

**So the order is: find blockers, author them, THEN set `shipChapters`.**
Re-measure before setting anything.

### Where the fleet stands

10 of 67 languages are mature: japanese, korean, american, danish, icelandic,
norwegian and swedish at 15; australian, british and scottish at 10.

The rest cluster hard — **45 languages sit at exactly 5 or 6 complete chapters
while declaring 15.** That is not 45 situations, it is one scaffold applied
fleet-wide: chapters 1-5 or 1-6 authored, the rest declared and never written.
lq-nordic is the only group finished end to end, so whatever process produced
it is the one to repeat.

- [x] Build the inventory, persisted to the shared DB
- [x] Distinguish contiguous from total, and unblock the five
- [ ] Re-measure blockers across all 67, then author the cheap ones
- [ ] Set `shipChapters` from the contiguous run
- [ ] Decide the per-language chapter target before bulk authoring

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
- [~] **Finish South Asian.** 470 confirmed paradigms across seven languages.
      Not applied to content yet.

      | | confirmed | note |
      |---|---|---|
      | bn | 95/120 (79%) | never ran in the original batch |
      | hi | 82/127 (65%) | **was 0** — stale code |
      | ta | 72/126 (57%) | applied earlier |
      | pa | 61/141 (43%) | re-running with the fixed prompt |
      | mr | 59/144 (41%) | **was 0** — two control faults + a prompt fault |
      | ur | 47/120 (39%) | re-running with the fixed prompt |
      | te | 54/146 (37%) | Dravidian; the oblique fix does NOT apply |

      **Three faults, all in the tooling, none in the model.** Each was hidden
      behind the one before it, and every one of them failed *silently* while
      the log blamed the model:

      1. `hi` ran at 07:54, before the Dir citation-cell fallback landed at
         09:37. No fix needed, only a re-run: 0 → 82.
      2. `mr`'s control was mistyped — its oblique plural carried two anusvaras
         (मुलग्यांं) where Marathi has one. Fixed, plus `checkControls`, which
         now refuses to start on a doubled combining mark or a non-NFC control
         and names the offending field (`ff39c89d`).
      3. `mr`'s control then tested a cell the language *argues about*. Both
         passes answered मुलग्याला / मुलग्यांना — the oblique stems carrying
         the dative -ला / -ना — and Marathi grammars genuinely differ on which
         form the "oblique" holds. Marathi now declares DIRECT ONLY. With
         controls passing, batches still resolved 0/6 because the two passes
         disagreed with *each other*: the prompt said "the OBLIQUE, which a
         noun takes before a postposition", readable either way. It now says
         OBLIQUE STEM, "WITHOUT the postposition attached", with counter-
         examples (`1adbe1f9`).

      Marathi across four runs — **0% → 0% → 24% → 41%** — is the evidence the
      faults were mine. The rule violated twice more here is one already
      written down: *a control must test what the language does not argue
      about.*

      - [x] Diagnose the two zero-confirmation runs
      - [x] Re-run hi, mr, bn
      - [~] Re-run ur and pa — both Indo-Aryan, both ran before the prompt fix
      - [ ] Decide whether to apply at 37-43%, or push the weak ones again
      - [ ] Apply to content

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
| 2026-09-04 | **§5 reframed.** Inventory built (`content_inventory`); five lessons authored that were blocking 37 complete chapters — japanese, korean, swedish now 15/15 |
| 2026-09-04 | lq-english: australian, british and scottish derived from american, 0 → 10 chapters each; 36 culture lessons authored per variant |
| 2026-09-04 | **§4 written.** `createContentWiringTests` in `@learnquest/unit-core`, green on all 14 apps; awaiting a publish |
| 2026-09-04 | South Asian morphology **applied** — 707 blocks across 102 files in 5 languages; empty case cells now dropped rather than written as `""` |
| 2026-09-04 | **§2 resolved.** The regression I flagged never existed — the emit path gates on `locale-manifest.json`, not `chapters.json`. Real fault found instead: `enabled` ignored by all 14 generators, 39 alpha locales shipping against the flag. Fixed; 6,410 emitted files withdrawn |
| 2026-09-04 | **§3 renames done.** 168 dead index entries dropped across the six Danish sibling locales — dangling 5,829 → 5,661, now purely the authoring backlog |
| 2026-09-04 | South Asian: `bn` landed at 95/120; `mr` control typo fixed + `checkControls` guard added; `hi`/`mr` re-running |
| 2026-09-04 | **§1 done.** 1,359 lessons unlocked across 17 trees (thai 833, danish 456); 49 Danish duplicates removed, 42 Thai items merged — `unlisted` 1,416 → 0 |
