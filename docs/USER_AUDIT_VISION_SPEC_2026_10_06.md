# User audit — vision and design spec (2026-10-06)

Companion to [`USER_AUDIT_PROPOSAL_2026_10_06.md`](USER_AUDIT_PROPOSAL_2026_10_06.md) (which covers the
package, phasing and P0 spike findings). This document describes the **end state** we are building
toward and the design constraints that follow from it. Pilots come first; nothing here is built yet.
Where this spec and the proposal differ on scope, this spec is the target and the proposal is the path.

## 1. Vision

Every language app, for every language it teaches, for every kind of learner, has a **measured user
experience score** that we can see, trend, and ratchet upward. A simulated learner plays the app the way a
real one would, and we get back (a) whether they could finish, (b) what they saw, and (c) a score on each
dimension that matters, rolled up to one weighted number. Findings feed straight into content,
generator, library and gameplay fixes, and the next run shows whether the score moved.

Concretely, the end state is a **score matrix**, one cell per:

```
app  ×  language being learned  ×  learner's first language (L1)  ×  learner segment
e.g.  lq-nordic × Danish × Thai × (casual adult)        lq-nordic × Danish × English × (young child)
```

Each cell has a current score, a floor it must not fall below, a target it is working toward, and a
history. We start with a handful of pilot cells and grow the matrix; the design must not need to change
to add cells.

## 2. Principles

1. **Checkpoint everything, resume anything.** A crash at lesson 140 of 200 costs one lesson, not the run.
2. **Deterministic signals first, LLM judgement second.** Rules and invariants produce most of the score.
   Vision/LLM grading is used where only a judge can answer, is anchored to a rubric, and carries a
   confidence. (We already know vision audits are non-deterministic across re-runs: see
   `feedback_audit_non_deterministic`.)
3. **A score is only as good as its coverage.** Every score ships with what fraction of the declared
   content was actually exercised. Unwalked content is "unknown", never "fine".
4. **Separate "the app is wrong" from "the content is wrong" from "the audit is wrong".** Findings carry an
   owner class so they route to the right fix surface.
5. **Environment-agnostic, safe by construction.** `--base-url` parameterised; writes only against
   local / CI / sandbox, enforced in code (proposal §6, §8).
6. **Cost is a first-class output.** Time, compute and money are recorded per lesson and per run, and
   budgets can stop a run.
7. **Reports are for acting on.** Every finding has evidence (screenshot, event log slice, repro URL) and
   a suggested fix surface. A report nobody can act on is a failed report.

## 3. Run model and checkpointing

### 3.1 Hierarchy

```
Run           one invocation: a set of cells, a build under test (commit/image), a tier (smoke|full)
 └ Shard      one worker's slice: (cell, chapter range) — the unit of parallelism and of retry
    └ Journey one profile walking its scope in order
       └ Step one lesson / side quest / boss / elective / onboarding / admin action
```

### 3.2 Append-only event log

Every step appends **one line** to `events.jsonl` as soon as it finishes (spike `walk.mjs` already does
this). Records are immutable; later runs append, never rewrite. Minimum fields:

| Field | Meaning |
|---|---|
| `runId`, `shardId`, `cellId`, `profileId` | identity |
| `stepId`, `stepType`, `seq` | which lesson/boss/…, and its order in the journey |
| `build` | commit / image digest under test (so scores are attributable) |
| `outcome` | `completed` · `blocked` · `skipped` · `infra-error` · `content-suspect` |
| `reason` | machine code + text, e.g. `screen-crash`, `no-advance-control`, `invariant:xp-mismatch` |
| `startedAt`, `ms`, `clicks`, `xpDelta` | timing and behaviour |
| `invariants[]` | each checked rule with pass/fail and expected vs actual |
| `errors[]` | console / page / failed-request events attributed to this step |
| `frames[]` | sampled screenshot refs (content-addressed) |
| `signals{}` | raw numbers the scorer uses (see §4) |
| `resume` | pointer to the state snapshot taken **after** this step |

### 3.3 State snapshots make resume real

Skipping already-completed records is not enough: in lq-nordic, progress lives in localStorage
(`nordic_player`, `nordic_lessonmap_v2`, …), so a fresh browser has none of it. After each step (or every
N steps, configurable) the runner stores a Playwright `storageState` (cookies + localStorage + IndexedDB
where used) plus the app's server-side session id if any. **Resume** = load the latest snapshot for the
shard, verify it (the map's current card must equal the next expected step), continue. If verification
fails, fall back to the previous snapshot, then to replay-from-start for that shard only.

Idempotency key: `(runId, shardId, stepId)`. A re-run of a completed step is a no-op unless `--force`.
Snapshots are the largest artifacts; keep the last K per shard and the one at every chapter boundary.

### 3.4 Crash taxonomy (so a crash is a result, not a loss)

`app-crash` (screen error boundary / pageerror) → recorded as `blocked`, scored; `infra-error` (browser
died, OOM, network to host) → retried from the last snapshot up to N times, never scored; `budget-stop`
(wall-clock / cost cap) → shard marked partial, resumable.

## 4. Scoring

### 4.1 Dimensions

Each dimension is scored 0–100 per step where applicable, then rolled up per chapter and per cell. A
dimension is either **deterministic** (D) from signals, **judged** (J) by vision/LLM against a rubric, or
mixed. Signal examples are taken from what the P0 spike already observed in lq-nordic.

| Dimension | Default weight | What it measures | Example signals (spike evidence) |
|---|---:|---|---|
| **Completability** (gate) | 20 | Can the learner get through everything intended? (D) | % steps completed; depth reached; any `blocked`. *Spike: ch.1 blocked at lesson 13, `drill-numbers-1-10` crashes.* |
| **Game mechanics** | 15 | Do the rules behave as declared? (D) | XP awarded vs displayed (lesson says 60 XP, 100 awarded); unlock chain; boss gating; hearts; streak; level-up shown |
| **Learning pace** | 15 | Is progression sized and ordered sensibly? (D+J) | New items per lesson; run of consecutive non-practice lessons (ch.1 opens with **7 concept lessons in a row**); time-to-first-success; accuracy curve of a calibrated learner per lesson; review spacing; lesson length vs stated `estimatedTime` |
| **UI / UX** | 15 | Is it clear, consistent, responsive to input? (D+J) | Console/page errors; raw i18n keys visible (`lessons.difficulty_beginner`); action with no visible feedback (complete button leaves you on the lesson); tap-target size; text overflow; vision-graded frames (existing screen-audit grades) |
| **Assistance** | 10 | Help when stuck? (D+J) | Hint/explanation after a wrong answer; audio available; L1 cue present; retry offered; recoverable after failure (`struggling` profile) |
| **Content quality** | 10 | Is the content itself sound? (D+J) | `content-suspect` (answer key disagrees with content); wrong shape (drill content stored as `{0:…,9:…}`); placeholders; missing locale; translation present |
| **Accessibility** | 5 | Usable without pointer/vision/audio? (D) | Keyboard path completes; labels; contrast; reduced-motion; zoom |
| **Performance** | 5 | Fast enough? (D) | Step transition ms; load ms; long tasks; failed/slow asset requests |
| **Engagement** | 5 | Reasons to continue? (D+J) | Type variety across a session; reward cadence; visible goal/streak; session-end hooks |

Sum of defaults = 100. Weights are **per segment** (§5), not global.

### 4.2 Roll-up and the aggregate

```
step score       s(d, step)         0–100, or null if the dimension doesn't apply to that step
dimension score  S(d, cell)         coverage-weighted mean of step scores
coverage         C(d, cell)         declared steps exercised ÷ declared steps  (0–1)
confidence       K(d, cell)         1.0 deterministic; <1 for judged (inter-run agreement of N samples)
aggregate        A(cell) = Σ w_d · S(d) · f(C,K)  /  Σ w_d · f(C,K)         over d with data
```

`f(C,K)` shrinks a dimension toward "unknown" rather than toward "good" when coverage is thin. The report
prints the aggregate **and** the coverage-adjusted lower bound; gates use the lower bound.

**Gates / caps** (a user who cannot finish cannot have an excellent experience):

- any `blocked` on the main path → aggregate capped (initial proposal: 60; to be tuned on pilots)
- Completability below a threshold → cell is `red` regardless of other dimensions
- `content-suspect` never caps the score and never fails a post-deploy smoke (proposal §8.2)

### 4.3 Making judged scores trustworthy

Rubric with anchored examples per score band; judge runs on sampled frames only; **median of N** with the
spread recorded as `K`; judge model, prompt version and rubric version are stored with every score so a
score change can be attributed to the app or to the judge. Use a different model family for a second
opinion on a sample (the repo's AI-review pipeline already does MiniMax-M3 primary + GLM-4.6 second; same
idea, never Anthropic for the review of lesson content per `feedback_ai_review_pipeline`). A judge-only
score change with no app change is flagged as drift, not as improvement.

### 4.4 Score history

Scores are stored per `(cell, build, rubricVersion, weightsVersion)`. Changing weights or rubric
re-scores history from raw `signals` (which is why signals are stored raw, not only the score).

## 5. The matrix: apps, languages, L1s, learner segments

### 5.1 Axes

| Axis | Source of truth | Notes |
|---|---|---|
| **App** | `blueforge.config.json` / catalog (14 language families + school + life) | |
| **Language learned** | the app's language list (Nordic: Danish, Icelandic, Norwegian, Swedish; the onboarding picker lists them with chapter counts) | |
| **L1 (learning *from*)** | UI locale + `learnerL1` (L1-aware variants; locales en, de, es, fr, th, vi, zh, …) | Thai→Danish is a different experience from English→Danish: L1 cues, script, glosses, translations |
| **Learner segment** | profile presets (proposal §10) grouped into segments | see below |

### 5.2 Segments (weights differ)

Segments combine age band, goal and device habits. Each has its own dimension weights and its own
behaviour model. Starting set:

| Segment | Behaviour model | Weight emphasis |
|---|---|---|
| Young child (6–9) | audio-first, big taps, short sessions, ~70 % accuracy, gives up fast | UI/UX, Assistance, Accessibility, Engagement ↑ |
| Tween/teen | mobile, short bursts, motivated by streaks/rewards | Engagement, Game mechanics ↑ |
| Casual adult | irregular sessions, drops after friction | Completability, Pace, UI/UX ↑ |
| Professional / goal-driven adult | few long sessions, wants efficiency, skips intros | Pace, Performance, Content quality ↑ |
| Older adult | larger text, slower pace, lower tolerance for dense UI | UI/UX, Accessibility, Assistance ↑ |
| Self-declared proficiency | beginner / intermediate / advanced (the onboarding picker already asks) | Pace + Content quality; also tests that "advanced" isn't forced through beginner material |

A segment is `{ ageBand, goal, device, a11y, behaviour{accuracy,pacing,patience}, proficiency, weights }`.
Behaviour parameters are **assumptions**, written down and versioned; they are not facts about real users
until we validate them against real usage data (open question 3).

### 5.3 Targets and ratchets

- Every cell has `floor` (must not drop below; CI-enforceable once stable) and `target` (where we want it).
- **Minimum bar per app, per language, and per segment**: a language is "shippable" in a segment when its
  cell clears the floor with adequate coverage. The app-level minimum is the min over its language ×
  segment cells (or a weighted mean — decide with the pilots).
- Ratchet like the existing audit ratchet (features/executed floor): floors only move up, when a run
  beats the floor by a margin on adequate coverage; a deliberate, reviewed change lowers one.
- Unmeasured cells display `unknown`, not 0 and not green.

## 6. From report to improvement

### 6.1 Finding model

Each finding: `id` (stable fingerprint of rule + step + owner), `severity` (blocker / major / minor /
polish), `dimension`, `ownerClass`, `evidence` (frame refs, log slice, repro URL), `suggestedFix`,
`firstSeenBuild`, `lastSeenBuild`, `status`.

`ownerClass` routes the fix, using what the spike already surfaced:

| Owner class | Example | Fix surface |
|---|---|---|
| `content` | drill content in the wrong shape; items stored as objects where the screen renders strings (3 crashes found in ch1–5); wrong answer key; placeholder | lesson JSON / lq-tools regen + AI-review pipeline |
| `content-generator` | a generator emits the wrong shape repeatedly | lq-tools generators (`codegen`/lesson generators) |
| `lib` | screen crash on valid content; tonal compare screen dead-ends (`useTonalLesson`); unresolved `{{playerName}}`; no feedback after completing | lq-core / lesson-ui / lesson-framework (publish + fleet bump) |
| `app-config` | map ordering, seeded defaults, ids that disagree across content trees | app repo |
| `design` | 7 concept lessons in a row; XP shown ≠ XP awarded (decide which is right) | needs a decision, not a patch |
| `audit` | judge drift, driver can't drive a type, seed that no real user reaches | the audit package itself |

The last row matters: **P0 already produced one**. The first "uncompletable concept lesson" lead was an
audit artefact (seeding `onboarding-completed` without creating a player), not an app bug; real
onboarding fixes it. The report must make it easy to see and fix that class.

### 6.2 The loop

1. Run → `events.jsonl` + scores + findings.
2. Findings are de-duplicated against open ones (stable fingerprints) and filed/updated (issue per owner
   class; blockers first). Owners fix on branches.
3. Fixed findings are **verified by re-running only the affected shard from its snapshot**, not the whole
   matrix (cheap re-verification is the payoff of §3).
4. Score deltas per dimension are attributed to builds. A fix with no score movement is itself a signal
   (the finding was wrong or the fix incomplete).
5. Trend view: per cell and per dimension over builds; "what moved the aggregate" ranking.

### 6.3 Using the report to improve content and gameplay (not just bugs)

Beyond defects, the recorded signals let us tune design: lessons with outlier time or failure rate for a
calibrated learner (too hard/long), chapters whose accuracy curve has a cliff, dimensions that are low
only for one L1 or one segment (localisation or tone gap), types the driver finds hardest to complete
(UI clarity). These become ranked improvement candidates, not only pass/fail.

## 7. Distributed execution on forge-control

**Assumption to verify:** forge-control provides fleet runners/hosts that can run containerised jobs and
report resource usage. This spec only states what the audit needs from it; check `forge-control` docs
(`docs/claude/fleet.md`, runner and job APIs) before designing the adapter.

### 7.1 Shape

- A **coordinator** expands a Run into shards (cell × chapter range, sized by measured seconds-per-lesson
  so shards are roughly equal), enqueues them, tracks state, merges results.
- A **worker** is a container: pinned browser + audit runner + the app stack under test (local stack per
  worker for write-capable runs) + the audit CLI. Contract: `user-audit worker --shard <spec> --out <dir>`;
  reads a shard spec, writes `events.jsonl`, snapshots, frames, `resource.jsonl`, exits 0/1/2.
- **Isolation:** each worker owns its own stack and test accounts; no shared mutable state between shards.
  Read-only post-deploy smoke may run against the live host with anonymous users.
- **Artifacts** go to object storage keyed `runs/<runId>/<shardId>/…` (content-addressed frames), and the
  merged `report.json` to the same place screen-audit results land (versioned schema, proposal §8.3).
- **Retry:** failed shard → resume from last snapshot on any worker (state is in the artifact store, not
  the worker). **Preemption-safe** by construction.

### 7.2 Metering (per step, per shard, per run, per cell)

Recorded in `resource.jsonl`, aggregated into the report:

| Metric | How |
|---|---|
| Wall time, per step and per shard | runner clock |
| Browser time (page-seconds), browser count | runner |
| CPU-seconds, peak RSS, peak container memory | cgroup/`docker stats` sampling on the worker |
| Network bytes in/out, request count, failed requests | Playwright network events |
| Storage written (events, snapshots, frames) | artifact store |
| Judged-score cost: model, tokens in/out, $ | LLM client wrapper (per call, attributed to step) |
| Host cost: `host-seconds × rate` | rate from fleet config; blended cost per run |

Derived: **cost per cell**, **cost per lesson**, **cost per score point moved**, **seconds-per-lesson**
by lesson type (planning input for shard sizing and smoke-sample selection), cost trend.

**Budgets:** per run (wall, $), per shard, per judged-call count. Exceeding one → `budget-stop`
(resumable), never a silent truncation. Keep the existing approval rule for spend (ask before large
generation runs) applicable to judged-score spend.

### 7.3 Tiers

| Tier | Scope | When | Target |
|---|---|---|---|
| `smoke` | few lessons/chapter + every boss + side quest, anonymous, read-only | post-deploy, PR | minutes |
| `pilot` | full journeys for the pilot cells | on demand | tens of minutes |
| `full` | every cell, sharded by chapter | nightly | bounded by budget, parallel |

## 8. Pilots and growth

### 8.1 Pilot cells (initial)

| # | App × language × L1 × segment | Why |
|---|---|---|
| 1 | lq-nordic × Danish × English × casual adult, `perfect` + `struggling` behaviours | P0 is already here; best-known app; exercises the full walker |
| 2 | lq-nordic × Danish × Thai × casual adult | first L1 axis: L1 cues, Thai UI, non-Latin L1 |
| 3 | lq-nordic × Danish × English × young child | first segment axis: tap targets, audio-first, assistance |
| 4 | One other family app (e.g. the English app) × English-learning × a non-English L1 | proves nothing is Nordic-specific |

Pilot success = the score matrix exists for these cells, the loop in §6.2 has fixed at least one finding
end to end with a measured delta, and a crash mid-run resumes without rework.

### 8.2 Growth order

pilots → all Nordic languages × L1 set → all language families (generated journeys from the content
manifest) → school/life apps → multiplayer and role scenarios (proposal §10, P3/P4) → segments broadened.
Each step adds cells and profile data, not new framework.

### 8.3 What "done" looks like

A dashboard/report where every (app, language, L1, segment) is a coloured cell with coverage, score,
floor, target, trend and cost; a CI gate on floors; a nightly sharded run on forge-control with a
cost report; and a standing, ranked improvement backlog generated from findings.

## 9. Spike facts that shaped this spec (2026-10-06, lq-nordic `f72552ef`)

- A checkpointing walker (one JSONL record per lesson) completed 12 lessons of chapter 1 at ~2 s per
  concept lesson and ~5 s per vocab lesson (includes fixed waits, so an upper bound), then **stopped at
  `drill-numbers-1-10`** which crashes on open. On a strictly linear map that blocks the rest of the
  chapter. Root cause is content: its `content` is `{0:…,9:…}` instead of
  `{drillType, progressiveStages, …}` like `drill-greetings`.
- Progress lives in localStorage, so resume needs state snapshots (§3.3), not just a record log.
- Real onboarding (language → welcome ×3 incl. proficiency → character with a name) is the correct way
  to create a player; seeding around it yields a state no real learner reaches.
- The lesson completes with no visible feedback (stays on the lesson; the level-up screen is not shown),
  and XP awarded (100) differs from XP displayed (60). Both are leads to verify; they are exactly the
  kind of thing the Game mechanics and UI/UX dimensions exist to catch.

## 10. Open questions

1. **Weights and caps**: the defaults in §4.1 and the 60 cap are placeholders. Who signs off, and on what
   evidence? Proposal: tune on the pilot cells until the score ranks known-good and known-bad builds
   correctly (a calibration set), then freeze `weightsVersion 1`.
2. **App-level minimum**: min over cells, or weighted mean? Min is stricter and hides nothing; mean is
   less noisy. Decide on pilot data.
3. **Behaviour realism**: accuracy/pacing/patience numbers per segment are guesses. Is there real usage
   data (session length, drop-off by lesson, accuracy) to calibrate against?
4. **Who owns the code**: `user-audit` lives in blueforge-org (decided); the per-app drivers and the
   score matrix store need an owner and a home (proposal §7 split).
5. **forge-control capabilities**: does it already expose job submission, per-job resource accounting and
   a cost rate per host? If not, §7.2 needs a worker-side sampler and a rate table of our own.
6. **Where results are stored and shown**: reuse the screen-audit result location and any existing
   dashboard, or a new matrix view? Needs a decision before P1 fixes the `report.json` schema.
7. **XP and pace as design decisions**, not bugs: is "show 60, award 100" intended (first-time bonus)?
   Is seven concept lessons in a row intended? These need a product answer before they can be scored.

## 11. Spike evidence, chapters 1–5 (2026-10-06)

114 of 123 lessons completed by a `perfect` learner across chapters 1–5 of lq-nordic Danish, with 4 distinct
defects confirmed (3 content-shape crashes, 1 library dead-end) plus raw template variables and a constant XP
mismatch; see proposal §14. Design consequences: (a) seeds must keep XP/level/progress consistent, or
journeys should be built by real play; (b) a level-up interstitial is part of the journey; (c) shape
drift between content and screens is a defect class worth a static pre-check before any browser run
(cheap, deterministic, and it would have found the three crashes without walking anything).

### 11.1 Tier 0: static pre-check (built)

`tools/content-shape-check/check.mjs` is the cheapest tier of the audit: deterministic, 0.4 s per app, no
browser. On lq-nordic its error set matched the real crashes exactly (10/10, none missed in the flagged
set) and feeds the **Content quality** dimension (`content-suspect`, shape errors, unresolved templates)
and the **Completability** gate (a crashing lesson is a `blocked` before any journey runs). Run it first
in every tier; a journey can skip steps the pre-check already proves broken and report them as
`blocked (static)` instead of spending browser time. Details: proposal §15.

**Persona spec addition:** any seeded state must be internally consistent (progress, XP, level, stats), or
the first real action produces a state no learner reaches (+2,300 XP and a level-up screen in the spike).
