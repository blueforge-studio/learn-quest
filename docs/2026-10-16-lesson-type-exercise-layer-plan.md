# Lesson types: exercise-layer plan (stages 0 to 5)

*Written 2026-10-16. Plan only, no code changed. This turns the review and
proposal in `lq-nordic` PR #85
(`docs/design/2026-10-lesson-type-playability-review.md`, still open when this
was written) into a staged delivery plan with owners and exit criteria. Facts are
cited to that document unless marked otherwise. **[H]** = taken from a hand-off
message between sessions on 2026-10-16 (the merged PR bodies are authoritative;
not re-verified here). **[O]** = observed by this session in a production build of
`lq-nordic` on 2026-10-16.*

## 1. Summary

#85 found that most Danish lesson types let a player earn full XP without
proving anything: concept (51) and review (16) lessons are a read-only page with
one tap and a flat 100 to 120 XP, vocab is passive cards, word-order starts
already solved, and 95% of drill answers are option 0 (#85 section 0, 2, 4).
The exercise layer is the work to give every lesson type scored checks,
a mastery rule, and one XP source of truth, reusing engines already in the repo
(`QuestionActivityRenderer`, `ConceptQuiz`, sound-pattern phases, `drill-engine`,
SRS; #85 section 3.2).

Several pieces have landed since #85 was written (section 3). The plan below
keeps #85's stage numbering (0 to 5, plus 1b) so the two documents can be read
side by side.

## 2. Goals and non-goals

**Goals**

1. Every lesson type has at least one scored interaction before reward ("proof
   before reward"), with the one exception of pure reading pages the owner
   chooses to keep (open question 2).
2. One XP rule (`computeLessonXp`) feeding the map preview, header, completion and
   toast, with `lesson.xpReward` authoritative (#85 section 5.1).
3. Per-item results flow to SRS so spaced re-surfacing works (#85 section 3.2,
   "SRS ... never fed").
4. Checks flow through the existing translation pipeline (th/zh/de/es/fr/vi trees
   are whole translated files; #85 section 4.6).
5. Quality is measured: the persona learning scorecard gates metric-level
   (dimension) regressions, not lesson ids.

**Non-goals**

* A new exercise engine. Reuse first; build only the adapters and the two or three
  missing pieces (`ConceptPlayer`, `ListenPickCheck`, `useMastery`; #85 section 4.3).
* Rewriting all lesson content by hand. Deterministic generation first, LLM second,
  human review gate always (#85 section 4.4).
* Redesigning the map, shop, social features, or the Thai/Chinese UI chrome
  (tracked separately).
* Other languages in the first pass: Danish chapters first; the other Nordic
  languages inherit the schema and renderer, not the authored checks.

## 3. Where things stand (what landed since #85)

| Item | Status | Basis |
|---|---|---|
| Concept player (stepper + mastery-gated quick check) in web-app | **Merged** (lq-core #176) | [H] |
| Single XP function, soft gate | **Merged** (lq-core #175) | [H] |
| Practice fixes (stage-0 class) | **Merged** (lq-core #174) | [H] |
| Narration schema fields | **Merged** (lq-core #173; app-types 0.1.6, schemas 0.1.3) | [H] |
| 11 long concept pages split | **Merged** (lq-nordic #86) | [H] |
| Concept narration pilot ch1 + Thai ch1 to 10 | **Merged** (lq-nordic #87, #88; th/zh/de/en narration #91 to #95) | [H] |
| Learning scorecard in lq-core | **Merged** (#168); metric-level gate **open** (#184); runner records a covered primary action as a blocker **open** (#187) | [H] for #168; #184 and #187 opened by this session |
| Concept player in a real build | Works: correct answer turns green with "Correct!", a wrong answer turns red and the right one green with "Not quite. The answer is ..."; Thai text renders | [O] (lq-nordic #96 build) |
| Concept player chrome translated to Thai ("Back to chapter", step counter, buttons) | Yes in the lq-nordic #100 build (web-app 0.5.24) | [O] |
| Open gaps seen in the build | Cookie banner (109 px) covers the primary lesson button on a 390 px phone even scrolled to the bottom; cookie notice text still English under th; answer text reads "Table (lit: Table)" (duplicated gloss) | [O] |
| Elective and chapters 16 to 20 vocab "Content coming soon" (87), crashing drills (5), word-order prefill, option-0 answer skew | Status not re-checked; #174 may cover part of it | #85 section 0; see section 9 |

So stage 0 and the core of stage 1 are largely done; what remains is verifying
that, then stages 1b to 5. Section 9 lists what must be re-checked before relying
on this table.

## 4. Stages

Days are #85's estimates (section 4.7). They were not re-estimated.

### Stage 0: stop-the-bleed fixes (#85: 4 to 5 days; mostly merged per [H])

Scope: word-order starts solved; seeded shuffle for drill, multiple-choice and
concept quiz; dict-shaped vocab adapter and drill `exercises` guard (or hide the
ch 16 to 20 and elective drafts); spelling adapter honours `mode`/audio/image;
culture renderer reads `sections`/`funFacts`/`tips`; `{{playerName}}` literal;
XP rule and preview; tap targets and banner.
Repos: lq-core, lq-nordic.
**Exit criteria:** a re-run of #85's play-through shows no blank/crashing lesson,
word-order does not start solved, shuffle verified by a test that fails if the
correct answer is index 0 in more than half of a lesson's choices, banner no
longer covers a primary action at 390 px (**currently still failing [O]**).

### Stage 1: Concept 2.0 core (#85: 8 to 10 days; player merged per [H])

Scope: schema (`schemaVersion: 2`) and `normalizeConcept`; `ConceptPlayer` (merged);
`ListenPickCheck`; `useMastery`; `useNarration`; markdown-lite `RichText`; XP on
mastery; SRS `itemResults`; tests, stories, e2e.
Repo: lq-core. Published libs change, so this stage ships through the lq-core
publish pipeline and a Nordic dependency bump each time (as in lq-nordic #96 and
#100).
**Exit criteria:** all 51 Danish concepts render through the normalizer with no
dropped authored field (checked by the `declared-not-rendered` rule in 1b);
mastery gate verified green/red in a real build (done once [O]); `itemResults`
reach the SRS service in a unit test; "Complete lesson" no longer awards XP for an
unattempted concept.

### Stage 1b: validator rules (#85: 2 days)

Scope in `lq-tools/packages/content-audit/src/lesson-graph`: `concept-checks`,
`concept-card-length`, `check-valid`, `answer-position-skew`,
`declared-not-rendered` (needs a `renderer-contract.json` exported from lq-core),
`shape-mismatch`, `reuse-window`, `interactive-practice`, `l10n-parity`,
`xp-source` (#85 section 4.5).
Repos: lq-tools, lq-core (contract export).
**Exit criteria:** each rule has a failing fixture and a passing fixture; the
Danish tree runs through them with every error either fixed or waived with a
reason; `xp-source` fails on a generator overwrite.

### Stage 2: chapter-1 content (#85: 4 to 5 days)

Scope: deterministic check generator for the 7 chapter-1 concepts (listen-pick
from examples with audio, match, order, minimal pairs, `drill-engine`
questions); ~40 checks; a native-literate review pass; audio spot check
(stød, soft d); th/zh/de pass.
Repos: lq-tools, lq-nordic.
**Exit criteria:** every chapter-1 concept has 4 to 8 checks; zero unreviewed
`aiDraft` checks reachable by players; `l10n-parity` green for th/zh/de;
persona scorecard on chapter 1 shows the `no-retrieval` and
`declared-not-rendered` penalties gone and sufficiency up versus the recorded
baseline (the first run after the player landed was started by this session; its
numbers are not in this document).

### Stage 3: spaced re-surfacing (#85: 3 to 4 days)

Scope: `useWarmup` "Quick recall" opener in the next 5 lessons; due count on the
map; `reuse-window` rule enforced.
Repos: lq-core, lq-nordic.
**Exit criteria:** after completing a concept, 2 to 3 due items appear as an
opener in the following lessons; due count on the map matches SRS state in an
e2e test; scorecard reuse metric rises from the 0.0 to 0.4 range #85 reports.

### Stage 4: other lesson types (#85: 9 to 10 days)

Scope per #85 section 5.2: vocab check layer (2 to 3 days), culture (2),
conversation (2), dialogue (1.5), review (2), plus tonal `quiz`, drill (remove
`alert()`, show `explanation`, play `promptAudio`, optional timer), multiple-choice
(one question per screen, mastery), spelling `mode`, word-order word bank at
44 px.
Repo: lq-core (renderers), lq-nordic (data additions such as tonal `quiz`).
**Exit criteria:** the scorecard of #85 section 2 re-scored with no type at
"Proof before reward: No"; no timers for kid profiles; no `alert()` anywhere in
lesson flows.

### Stage 5: chapters 2 to 20 (#85: 6 to 8 days, mostly review time)

Scope: LLM pass (closed-world prompts, second verification call, zod-validated),
human review, then release by `releaseStage` flip.
Repos: lq-tools (generator: `batch-concept.ts` second pass), lq-nordic.
**Exit criteria:** every released lesson passes 1b rules; reviewer sign-off
recorded per chapter; unreviewed AI drafts hidden by the existing release gate.

Total (#85): about 36 to 44 working days; stages 0 to 2 about 18 to 22. With
stage 0 and the player in stage 1 reported merged [H], the remaining work is
less, but it was not re-estimated.

## 5. Cross-cutting

* **Measurement.** Use the learning scorecard as the gate: #184 (metric-level
  dimension deltas instead of lesson ids, so reorders and splits are not
  "regressions") and #187 (a covered primary action is a recorded dead end rather
  than a 60-step loop). Re-baseline deliberately after each stage; do not weaken
  thresholds to pass.
* **Translation.** Checks live inside lesson JSON so they follow the whole-file
  translation pipeline; `l10n-parity` enforces equal ids and counts; fall back to
  `en` per check, not per lesson (#85 section 4.6).
* **Kids variant.** The Kids plan
  (`2026-10-16-nordicquest-kids-two-variant-build-plan.md`) selects lessons that
  prove learning; it depends on stages 1 and 4 for its lesson subset.
* **Native wrapper.** Offline lesson packs (PR #71) need check data and audio
  addressable by id; keep checks small JSON, audio on the existing pipeline.
* **Release process.** Every lq-core change here publishes libs (versions from
  `package.json` bumps via `publish.yml`) and needs a Nordic dependency bump
  (check the `pnpm-workspace.yaml` overrides and `minimumReleaseAgeExclude`).

## 6. Risks

(From #85 section 4.6, with additions from this session's observations.)

1. **Translation quality and cost**: whole-file locale trees, short template-like
   prompts, Danish words never translated; native review for th/zh/de may not
   exist (open question 5).
2. **Hard-coded English chrome** in lesson screens: partly fixed (Thai chrome now
   translated in the #100 build [O]); residual strings (cookie notice, "(lit: ...)"
   answer gloss) remain.
3. **Danish correctness of generated items**: deterministic first, second
   verification call, human gate.
4. **Mastery gate frustrates children or low-literacy readers**: age-based
   threshold, unlimited retries without a dead end (#85). Policy decision needed
   (open question 1).
5. **A covered primary action** (cookie banner over the Next/Complete button on
   phones) blocks every stage's exit criterion that requires completing a lesson
   in a real build, for real users and for the audit harness. Needs a fix in the
   consent/banner owner's lane before stage exit checks mean anything.
6. **Regression of persona baselines**: update `learning-baseline.json`
   deliberately; the metric-level gate (#184) is the safer comparison.
7. **Generator overwrite of `xpReward`/`estimatedTime`**
   (`lq-nordic/scripts/generate-lesson-files.ts:161-167`) silently undoes authored
   values; stop it before stage 2 content lands (follow-up already queued).

## 7. Owners and repos

| Repo | Touched in | Notes |
|---|---|---|
| `lq-core` | 0, 1, 1b (contract), 3, 4 | publishes libs; Nordic bump needed after each |
| `lq-nordic` | 0, 2, 3, 4, 5 | content, th/zh/de trees, generator fix |
| `lq-tools` | 1b, 2, 5 | `content-audit` rules, check generator, `batch-concept.ts` |
| `lq-operations` | none planned | legal/banner generators are separate work |
| owner (user) | decisions in section 8; Danish review sign-off | |

Session ownership at the time of writing (not durable): `learn-quest` (th/zh/de
translation, narration, lq-core pwa/legal/consent files), `learn-quest-2`
(Nordic dependency bumps, scorecard, follow-ups, these plan docs).

## 8. Open questions for the owner

(Numbered as in #85 section 6 where they carry over.)

1. **Mastery policy** (#85 Q2): hard gate or soft (reduced XP, always completable)?
   Lower threshold for kid profiles? Should repeats pay XP? lq-core #175 landed a
   *soft gate* [H]; confirm that is the intended final policy.
2. **Pure reading pages**: may culture/review keep a read-only variant, or must
   every lesson have at least one scored check?
3. **Beta content visibility** (#85 Q1): hide the 87 dict-shaped vocab lessons and
   5 crashing drills (ch 16 to 20, electives) until fixed, or fix with an adapter?
4. **Audio budget** (#85 Q4): record or batch-TTS audio for new checks, and who
   accepts the Danish TTS voice for stød and soft d, versus runtime TTS only?
5. **Translations** (#85 Q5): translate check prompts in-lesson or move to i18n
   keys? Is native review available for th/zh/de?
6. **`estimatedTime`** (#85 Q6): compute from content (the "8 min" label was ~5x too
   long for a concept) and stop the generator overriding authored values?
7. **Persona audit baseline** (#85 Q7): OK to re-baseline after each stage and to
   add a "renders declared content" static check driven by a renderer contract?
8. **Who owns the cookie banner / primary-button overlap fix**, and does it block
   stage exits? (It blocks completing lessons on phones today [O].)

## 9. Not verified

* The status table in section 3 for items marked [H]: taken from hand-off messages,
  not from reading the merged PRs.
* Whether lq-core #174 fixed word-order prefill, shuffle, dict-vocab and the
  crashing drills; #85's counts are as of 2026-10-16 morning and were not re-run.
* Effort estimates are #85's; none were re-estimated after the merged work.
* Scorecard numbers after the player landed: a re-run was in progress when this
  was written; no figures are claimed here.
* Chapters other than Danish, and iPad layouts, Thai/Chinese rendering beyond one
  concept lesson (same limits as #85's appendix).

## Sources

* `lq-nordic/docs/design/2026-10-lesson-type-playability-review.md` (branch
  `docs/lesson-playability-review`, PR #85), sections 0 to 6
* `docs/2026-10-16-native-wrapper-decision-tauri-vs-capacitor.md` (PR #71)
* lq-core PRs #168, #173 to #176, #179 to #184, #187 and lq-nordic PRs #86 to #88,
  #91 to #96, #100 (descriptions and hand-off messages; see markers above)
* Observed behaviour of the lq-nordic production builds on 2026-10-16 ([O])
