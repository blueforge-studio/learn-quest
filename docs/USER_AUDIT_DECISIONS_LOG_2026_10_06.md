# User audit — decision log (2026-10-06)

Running record of the direction choices made while building the user-audit P0 spike, with the reasoning
and what was rejected. Companion to `USER_AUDIT_PROPOSAL_2026_10_06.md` (what/how) and
`USER_AUDIT_VISION_SPEC_2026_10_06.md` (end state). Newest entries at the bottom. "Operator" = the user
who made the call; "me" = the Claude session doing the work. Where the operator delegated ("you decide"),
that is stated, and the choice is mine to defend.

Format: **D<n> — decision** · who decided · reasoning · alternatives rejected · what would change it.

---

## Decisions made before this log existed (reconstructed from the proposal §6 and the session)

**D1 — Package name and home: `@blueforge-studio/user-audit` in `blueforge-org/packages/audits/`.**
Operator-approved. Reasoning: it extends `screen-audit` / `audit-core`, which live there; one place for
audit infrastructure. Risk noted: blueforge-org has no PR-gate CI (force-merge only), so a new package
needs a deliberate human review step. Owner of that package work is the `blueforge` session, not
learn-quest.

**D2 — Environment-agnostic from day one (`--base-url`), local first, then CI and post-deploy.**
Operator-approved. Reasoning: a runner that assumes localhost cannot become a post-deploy gate later
without a rewrite. Writes only against local/CI/sandbox, enforced in code; production is read-only smoke.

**D3 — Learner journeys first, then multiplayer, then admin/test-user.** Operator delegated ("do as you
think best"). Reasoning: learner journeys carry the largest content-regression risk, and every later
phase reuses their walker, profiles and recorder. Rejected: admin first (smaller blast radius, less
reuse).

**D4 — P0 is a throw-away spike in lq-nordic, not shared infrastructure.** Reasoning: measure seconds per
lesson and discover which lesson types a generic driver can/cannot finish *before* designing the package
around guesses. The spike has since justified itself: it overturned two of my own early hypotheses (see
D6, D7).

**D5 — Profile model is a set of independent dimensions with named presets (proposal §10), not a fixed
list of personas.** Reasoning: the operator's end goal is a matrix (app × language × L1 × segment); presets
that cannot be recombined would force a rewrite when the matrix grows.

## Decisions made during the spike

**D6 — Create players through real onboarding, never by seeding around it.** Reasoning: the screen-audit
seed (`onboarding-completed: true`, no player) made `LessonCompleteBar` return null, so concept and
multiple-choice screens looked uncompletable. I spent half a session treating that as an app bug. A seed
that produces a state no real learner reaches measures the seed. Rejected: keep the seed and special-case
it (hides the same class of problem in every other screen). Changes if: onboarding itself is the thing
under test (then it is a journey step, not setup).

**D7 — Before calling a missing control an app bug, read the guard the screen needs.** Process rule that
came out of D6 (and out of the tonal case, where reading the hook turned "button does nothing" into a root
cause). Cheap, and it stopped two false tickets.

**D8 — Drivers read correct answers from the lesson JSON the app actually serves
(`public/data/lessons/<ui>/<lang>/chapters/<ch>/<id>.json`), with a per-type driver registry and a generic
role-based Next/Continue fallback.** Reasoning: content is the source of truth for answers; the app has
at least three content trees whose ids disagree, so the oracle must read the tree the app serves; testids
for "Next" differ per lesson type (8 so far), so a hand-listed testid set is brittle.
Rejected: vision-model driving (slow, non-deterministic, costs money, and unnecessary where the DOM and
content already carry the answer).

**D9 — One immutable JSONL record per lesson, and storageState snapshots for resume.** Reasoning
(operator requirement: do not rerun everything after a crash): progress is localStorage-only, so a record
log alone cannot resume. Snapshots are P1 work; the spike only writes the log.

**D10 — Skip-and-continue when a lesson blocks, recording `skipped-after-block`.** Reasoning: on a linear
map one broken lesson hides every defect behind it; the spike found 7+ defects only because it walked past
the first. The skip edits storage, so it is an audit shortcut and is recorded as such, never counted as
completed.

**D11 — Walk chapters in parallel (separate browsers, one dev server) and key completion on "this lesson id
is now in completedLessons".** Reasoning: list length broke when seeded progress made the first real
completion jump XP and raise a level-up screen. Lesson: seeds must be internally consistent (XP, level,
progress) or be avoided; a level-up interstitial is a real journey step.

**D12 — Static content-shape check as "tier 0", built before more browser walking.** Operator approved
("go-ahead … then build the static content-shape check"). Reasoning: three of the crashes were decidable
from JSON alone in 0.4 s; browser time should go to what only a browser can find. Validated against the
browser (10/10 flagged-as-error lessons really crash; 0 of 80 sampled clean lessons crashed).
Design choices inside it, each driven by measurement: asymmetric severity (object-where-text is an error,
the reverse is a warning, because React throws only on the former); containers a screen cannot render
without are errors, merely "usual" ones are warnings (most hits were optional fields); culture
`tips[]`/`funFacts[]` objects are an explicit empirical allowlist (5 lessons opened, none crashed);
word-order is case-insensitive with multi-word tiles split (all 8 first mismatches were capitalisation
or multi-word tiles); numeric answer keys warn when in range and error when out of range.

**D13 — Filed three tickets (lq-core #141, #142; lq-nordic #77) with reproduction, root cause and caveats,
after checking for duplicates.** Operator-approved. Reasoning: each was reproduced, two have a source-level
cause, and none were filed on a driver gap. Not filed: the screen-audit seed problem (sent to the
`blueforge` session instead, which declined ownership; owner still unnamed).

**D14 — Answer keys should move to option ids behind one shared resolver, with a numeric-key hotfix
first (lq-core #142).** Operator agreed ("we likely need to use ids as well or as replacement").
Reasoning: five conventions for "which option is right" exist; text breaks under localisation and
normalisation, indexes break under reordering; ids also give distractor statistics for the learning-pace
and assistance scores. Rejected: making every screen accept every legacy shape (keeps five conventions
alive). Hotfix first because lq-balkan is wrong on screen today.

---

*Entries below this line are appended as work continues.*


**D15 — Direction after the tickets: driver gaps first, then chapters 6-20 and bosses.** Operator delegated
("u decide") and agreed with "start with the driver gaps". Reasoning: a driver gap is indistinguishable from an
app defect until it is closed, so every later finding is less trustworthy while gaps remain; walking more
chapters with an unreliable driver multiplies false blocks. Rejected: walking 6-20 first (more coverage, but
the false-block rate would have buried real findings). **Outcome:** all remaining blocks in chapters 1-5 are
real defects (117/123 completed; 6 blocked: drill crash, tonal lib bug #141, sound-pattern -g/-d pairs without
`soundId`, MC pronouns options as objects, culture items as objects). The "gaps" turned out to be (a) load
flakiness from running 3 chapters against one dev server, (b) my driver bugs (drill question text includes the
options so prefix matching collided; positional quiz fallback assumed unique answer text), (c) a step cap too
low for 26-29-step vocab lessons. Chapters 6-20 and bosses remain next.

**D16 — Scored runs are serial by default; a block counts only after one serial re-run reproduces it.**
Reasoning: measured, not assumed. Parallel runs produced >= 5 false "blocked" lessons that vanished serially.
A false finding costs more than a slow run: it burns an owner's time and erodes trust in every real finding.
Parallelism stays for sharding across hosts with a concurrency cap (also a cost control, D19).

**D17 — One canonical `report.json` (`blueforge.user-audit/1`) plus thin adapters; no fourth scoring system.**
Operator asked to integrate with forge-control, forge-dev and blueforge. Reasoning: each already owns one piece
(scoring/ratchet, compute/cost, registry/display); duplicating any piece creates two sources of truth.
Rejected: a bespoke user-audit dashboard and ratchet.

**D18 — Scoring and ratchet through forge-dev's `@forge/auditor-sdk` (third-party auditor, ingest-only).**
Reasoning: its rule "null, never 0, for no data" is identical to ours; floors, ratchet window, violation kinds
and the CI job already exist; `auditor-learn-quest` is a precedent for exactly this adapter. `sampleId = runId`
is mandatory because our scores come from a recorded run (the SDK documents the zero-variance-window trap).
Ingest-only keeps browser stacks out of forge-dev CI. Not representable: gates and fix-surface findings
(they stay in the report).

**D19 — Execution: Gitea Actions matrix first, worker contract compatible with forge-control compute jobs.**
Reasoning: the matrix works today; the compute-jobs API fits our needs almost 1:1 but nobody confirmed a worker
consumes it. A container with image + command + env + outputs makes the later move a submit-adapter swap.
Hard cost guard: September's invoice was EUR 611.80 against a EUR 200 budget, mostly autoscaler burst VMs.
Concurrency cap, off-peak, budgets, and audit load must never be what triggers a burst VM.

**D20 — Floors stay in forge-dev's `baseline.json`, not in blueforge sidecars.** Reasoning: the product
sidecar schema is `.strict()` (new key = schema change + version bump) and floors already have a home with a
working ratchet. Revisit only if the sidecar becomes the per-app target contract.

**D21 — Dimension weights are scaled by check coverage; unmeasured dimensions are null; a blocked main path
caps the aggregate, and the report shows raw and final.** Reasoning: the first generated report had a raw
total of 93.9 with 6 blockers, one stopping a learner at lesson 13. A headline of 93.9 would mislead, and
scoring thin dimensions at full weight rewards not looking. Cap 60 is a placeholder pending calibration.

**D22 — The `sound-pattern` -g/-d finding is added as a comment on lq-nordic #77, not a new ticket.**
Same defect class (content shape the screen cannot render), same repo and owner. Fewer tickets to triage.

**D23 — Used three read-only explorer agents in parallel for forge-control, forge-dev and blueforge, then
spot-checked four load-bearing claims myself before designing on them.** Reasoning: breadth across three repos
is what delegation is for; the claims the design rested on (SDK null semantics, learner adapter precedent,
compute-job schema, audit-runs route) were cheap to verify and all held. No edits to those repos; no messages
sent to the `control` or `forge-dev` sessions yet (that is the operator's call).

**D24 — app-dev-db is the system of record for user-audit results over time (operator direction); blueforge
becomes a reader, not a second store.** Reasoning: the dev-DB producer contract already provides hash-deduped
append-only history, a latest pointer per series, idempotent retries, `producer`/`source` identity,
`measured_at` vs `received_at`, and API-only access; forge-dev's `audit.score` readings already flow into it.
This **supersedes** the integration design's proposal of new blueforge tables (section 3.3 corrected).
Rejected: a user-audit-owned time-series store (a second source of truth).

**D25 — Phase 1 reuses the existing `audit.score` kind; new `journey.*` kinds come only when needed.**
Reasoning: kinds are a closed registry in `app-dev-db-core` (unknown kind = HTTP 400, additive-only policy),
so a new kind needs forge-control/blueforge/forge-dev agreement. `audit.score {gate, score, floor, checked}`
already maps to a dimension score per cell (`gate` = cell + dimension, `checked` = steps exercised) and needs
no registry change. Per-journey run records are the case that justifies new kinds, so they come second.

**D26 — Journeys are graphs, not lines; branching is explored by edge coverage, forking from storage
snapshots.** Operator asked about journey branching. Reasoning: the product genuinely branches (dialogue
nodes and endings, elective picks, bosses and side quests, onboarding choices, correct-vs-wrong answers); the
snapshot mechanism already needed for resume makes forking at a decision point nearly free; edge coverage
avoids path explosion. Details in the integration design section 10.

**D27 — Push a small, gating set of readings by default; keep full detail in the run artifact.** Source:
forge-dev's advice after reading its own volume ("54 per main push already feels like a lot"). Reasoning: 9
dimensions x ~30 cells = ~270 series and POSTs per run, most of them unreadable noise on a radar; a headline
`total`, `completability`, and any dimension that carries a floor is what a gate or a human acts on. Detail
is not lost: it is in the artifact and in `--all`. Rejected: pushing everything (volume, radar clutter),
pushing only `total` (a total hides which dimension moved).

**D28 — REVISES D18: browser audits run in the audited repo's own CI and push from there; the forge-dev
third-party-auditor route is shelved.** Reasoning: forge-dev has no artifact-download mechanism, its only
cross-repo precedent is a peer checkout with a read token, and it recommends not pulling browser audits into its
CI. Running in the app repo's CI also makes the envelope `commit` the build under test, which regression
attribution needs. What survives from D18: reuse the SDK's rules and shapes (null not 0, `sampleId`), and the
suite endpoint stays available (new auditor ids need no server change).

**D29 — REVISES D20: floors live with the audited repo(s), not in forge-dev's `baseline.json`.** Reasoning:
that file is forge-dev's own; the world-map-editor precedent keeps the audited repo's floors in its own
`audits/baseline.json`. Open: per app repo vs one file in learn-quest. Leaning per app repo (floors are owned by
whoever can fix the regression), decision deferred to the operator.

**D30 — Phase 1 is built dry-run-by-default and refuses to push local-dev runs.** Reasoning: the producer is not
registered, and a laptop run at a main commit is indistinguishable from CI in shared history (`ref` + `commit`
identity). Refusing unless `--allow-local` is explicit prevents a polluted series that cannot be deleted
(append-only). Tested (12 tests), including the refusal paths.

**D31 — Messaged the `control` and `forge-dev` sessions with scoped questions and built nothing in their
repos.** Operator approved ("yes, message them"). forge-dev replied the same day; `control` has not yet.
The control questions (read-side API, `journey.run` kind, producer identity, compute, artifact bucket,
metering) remain open and gate phase 2 and the execution plane.

**D32 — Gitea Actions matrix is the execution plane; compute-jobs (Option B) is dropped until it is deployed.**
control: the API and consumers exist but are "Built, not deployed" and the compute autoscaler is `DRY_RUN=true`.
Reasoning: do not design on a path nobody runs. The B-compatible worker contract stays (a container with
image + command + env + outputs) because it is free insurance. D19 otherwise stands.

**D33 — Audit jobs get a dedicated exclusive runner label and low concurrency, and nothing large runs until
the operator confirms the live autoscaler settings.** control (inference, untested): shared labels feed the burst
gate; an exclusive label is excluded from the general burst gate and the age trigger; weight 0 alone does not cap
spend. Reasoning: September's EUR 611.80 invoice against a EUR 200 budget makes an unpriced matrix the single
largest risk in this work. Cost of the guard is a slower first rollout. Pending: live `burstMix`,
`hostMaxEphemeral`, `queueAgeBuyMode`, and whether the exclusive profile exists.

**D34 — Keep a copy of every report in our own store; do not depend on app-dev-db reads or Gitea artifacts for
history.** control: no read route exists, and Gitea upload-artifact retention is 30 days. Reasoning: a regression
needs the previous run, and neither store can return it today. Reports are small, so keep them content-addressed
with long retention. app-dev-db stays the system of record for readings (D24) and becomes the read source when
its read route ships.

**D35 — Operator action list that gates everything beyond dry runs.** (1) Register a producer: generate a
secret, store it in the vault and the Gitea Actions secret, add `{id, tenantId, secret}` to
`APP_DEVDB_PRODUCERS` on infra-1, roll mission-control (a malformed record closes ingest with a 503, so this is
a careful edit). (2) Confirm `lq-nordic` is a `projects` entry and give its UUID. (3) Decide topology: audits run
in each app repo's CI vs one central worker (the producer can serve either). (4) Provide the live runner
autoscaler settings and create an exclusive audit runner label/profile. (5) Choose a bucket and retention for
reports and blobs. (6) Approve the two forge-control PRs when wanted: a read route (+ `series` index) and the
`journey.run` kind. (7) Name owners for the persona/seed fix and for weight/cap calibration.

**D36 — Resume = snapshot after every step + a two-phase commit where the record is the commit point.**
Operator (2026-10-07): "if a run/sim/user audit crashes midway we continue from where it crashed, ideally."
This is D9 made real. Protocol: (1) write `snaps/snap-<seq>.json` (Playwright `storageState`, including
IndexedDB) via temp file + fsync + atomic rename; (2) append the record that names it to `records.jsonl` + fsync.
A crash before (2) leaves an orphan snapshot nothing references (ignored, overwritten on redo); a crash during (2)
leaves a torn last line (ignored by the parser), so that step simply counts as not done. A baseline snapshot after
onboarding and seeding means a crash in lesson 1 does not redo onboarding. On resume the newest snapshot is
loaded and **verified** (every recorded lesson present in the restored player; the map's current card is not one
already recorded as done); a failing snapshot is rolled back with an explicit marker so its records are
superseded and the lesson is redone exactly once; if nothing verifies the chapter restarts fresh with the old
records archived. Rejected: (a) replaying the prefix (slow, and non-deterministic against a live app), (b) one
mutable checkpoint file (a torn write destroys the only copy), (c) database snapshots (not needed for local-first
apps; revisit for apps with server-side state, see journey branching).

**D37 — Built the resumable walker as new files (`walk4.mjs`, `lib4.mjs`, `resume/`) instead of editing the
walker that was running.** The 6-20 background run starts a fresh `node walk3.mjs` per chapter, so editing
`walk3.mjs` or `lib.mjs` mid-run would have mixed two walker versions inside one dataset and made the
results incomparable. Cost: temporary duplication (the drivers are copied), to be removed once walk4 replaces
walk3.

**D38 — Crash recovery is tested by injecting crashes, not by reading the code.** The walker can SIGKILL itself
at a chosen point (`CRASH_AT=after-commit:N | before-record:N | mid-lesson:N`), and a harness
(`resume/crash-tests.sh`) runs five scenarios on chapter 5 (clean reference, kill after a commit, kill in the
middle of a lesson, kill between snapshot and record, stale newest snapshot) and requires every recovered run to
equal the reference: same lessons and outcomes, no duplicates, one run id. Reasoning: recovery code runs only
when something has already gone wrong, so untested recovery is the code most likely to fail at the worst
moment. The store's file logic also has 9 unit tests (torn lines, orphans, corrupt snapshots, rollback, prune).

**D39 — Applied the serial rule (D16) to myself: no browser tests while the 6-20 walk is running.** A second
browser on the same dev server is exactly the load that produced the false "blocked" lessons earlier. Cost:
about 30 minutes of delay before the resume tests; benefit: the 6-20 dataset stays clean.

**D40 — Static shape inference is per group (type + elective) and array-vs-object is an error.** Evidence: 10 core
vocab lessons in ch16-20 rendered a blank page because they carry the elective `{items, slot}` shape; pooled with
267 elective vocab lessons the corpus was 56 % object, so no shape was "dominant" and the checker stayed silent.
Reasoning: electives are authored through a different path with their own shapes; pooling hides drift in core
lessons. A screen that iterates an array and is handed an object crashes or renders nothing, so that mismatch is an
error, not a warning. Result on the cell: 20/20 predicted blocks confirmed, 0 false alarms. **Honest limit:**
tuned after seeing the miss (in-sample). Whether `{items, slot}` is correct for electives (they were not walked) is
unknown, so the checker only says "different from the core shape", not "wrong".

**D41 — Infrastructure failures are never recorded as lesson results; the walker exits 75 and a supervisor
restarts it from the last snapshot.** Found by the crash tests: a dead browser surfaced as a thrown error that the
per-lesson `catch` would have turned into a `blocked` record (and then *skipped the lesson*). A false finding
that also rewrites progress is worse than a crash. Rejected: retrying inside the lesson (hides flaky infra and
muddies timings). Supervisor limits attempts (default 5) and stops on real errors.

**D42 — End of chapter must be confirmed, not inferred.** The reference run ended after 8 of 22 lessons because the
map had not settled. The walker now re-reads the map (with reloads) three times and finishes only when every map
card is `completed`; otherwise it writes `incomplete.json`, exits 3 and does not mark the shard finished. A silent
early "finished" would have made a truncated chapter look like a perfect score.

**D43 — Crash tests compare against an uninterrupted reference and include a stale-snapshot case that really
exercises verification and rollback, plus an infra-crash case under the supervisor.** My first harness had a bad
reference and a test that copied a snapshot pruning had already deleted: it reported FAIL for the wrong reasons and
passed a scenario it never ran. Lesson: a test that cannot fail for the right reason proves nothing; the
harness now asserts expected rollback counts (>= 1 for the stale case, 0 otherwise).

**D44 — The XP mismatch is classified as a game-mechanics defect (declared reward ignored), not a design
question.** Source shows `calculateLessonXP(score, maxScore)` never receives the lesson's `xpReward`. Not
ticketed yet: the operator decides whether declared XP or flat XP is the intended rule.

**D45 — Books-platform audits start read-only with a local stub in front of the app, in rising complexity:
story -> activity -> interactive -> adventure.** Operator (2026-10-07): add the user audit to the books-platform
apps one at a time. Findings that shaped it: the apps default to the **production** books API, so an unguarded
local run could write reading progress to prod; Docker is not running and there is no local book content. So: a
local stub on :3009 passes content `GET`s through to the live API (cached) and records, never forwards, every
write, plus a browser guard that aborts non-local writes. Order: story-book (linear page turns) first, activity-book
(content-driven answers), interactive-book (choose-your-own-adventure: the natural journey-branching testbed),
adventure-book (XState game), then marketplace/author/discover (purchase and entitlement flows; Stripe is
unactivated, so write rails matter most there). Also noted: live `GET /api/books` returns HTTP 500 (2 of 2
requests): not reported anywhere yet.

**D46 — Books audits run the app locally against LIVE content, read-only, behind a stub that never forwards writes, plus a browser
guard.** The apps fall back to the production API URL, so safety cannot depend on remembering an env var; it is enforced twice,
in code. Rejected: running a local books-api (needs Docker and Postgres, neither available) and mocking all content (loses the
real data, which is where the findings came from).

**D47 — A story book's journey is its scene graph, enumerated from the content; a run is one root-to-ending path; coverage is
scenes and edges visited over declared.** This is D26 (journeys are graphs) applied to a real product, not a design sketch.
Reasoning: the content already declares branching (`onCorrect`, `onIncorrect`, `choices[].outcome.target`), so nothing is
hand-written per book; edge coverage needed 2-3 paths per book, not the full cross product.

**D48 — Resume for books is journey-level, not mid-book.** An anonymous reader's position is not persisted by the app, and a path
takes ~30 s. Replaying one path costs less than building state restoration. Finished paths are skipped on rerun.

**D49 — "Rendered text equals content text" is a standing invariant for reader apps.** It was found by accident (my scene
matcher failed on altered text) and then promoted to a check: match loosely, flag an exact-text mismatch. It detected the hotspot
corruption in 3 of 4 books unprompted. General lesson: when a harness cannot recognise what the app shows, that is a finding
candidate before it is a harness bug.

**D50 — Findings from the books work are written up but not filed.** Three tickets (deep-sea content, hotspot renderer, live
`/api/books` 500) need the operator's go-ahead; earlier approvals were for specific tickets. They are reproduced and have
evidence, so filing is a one-step action once approved.

**D51 — The tech-debt refactor runs through parallel agents with an independent verification pass, and "report says passed" is not
accepted.** Wave 1 agents reported their own checks; I confirmed containment (every change inside the expected packages) and sent
three of them back where a file stayed over 200 lines. Cost: more round trips. Benefit: the operator's "any file over 200"
is met, not approximated.

**D52 — The audit steps behind a known blocker, with every aid labelled in the report.** The activity book is blank in production
(contract drift), which hides a second defect (leaked answer state). Reporting only "blank page" would have been correct but
shallow. The walker therefore uses an audit-only stub shim and a deep-link workaround to continue, and records
`compatShimUsed` and `deepLinkWorkaroundUsed` on every run so a reader can never mistake a workaround run for the real
experience. Rejected: patching the app (not asked, and it would stop being an audit), and stopping at the first blocker (hides
what is behind it).

**D53 — The shim lives in the stub, off by default, and counts its own use.** A shim that silently fixes the contract would make
every later run look healthier than production. Default off; one env var turns it on; the ledger counts wrapped responses.

**D54 — A walker wait must name the thing it waits for.** My first activity wait was satisfied by *any* enabled button (the chapter
tabs), so the walker clicked locked options and reported a timeout. Waiting for this question's own options to be enabled turned
a harness bug into a measurable app behaviour (options locked for 10+ s), and surfaced finding 2. Same family as D49: when the
harness cannot proceed, find out why before deciding who is at fault.

**D55 — Profiles earn their keep by exercising a rule, not by existing.** The `struggling` profile found nothing in the story books
(right and wrong answers share a next scene), but the `hinter` profile on the activity book found a mechanic that is advertised and
never applied. Lesson for the profile catalogue: define each profile by the rule it stresses (hints, wrong answers, skipping,
retrying) and state the invariant it checks, so a profile that cannot fail is dropped instead of re-run forever.

**D56 — A read-only guard is verified by what it catches, and reading is not assumed to be harmless.** On the deployed interactive
reader the guard aborted 3 `POST /api/audio/narration` calls that an anonymous page view tried to make (lazy TTS generation on
production, with a cost). Had the guard been "do not click write buttons", those would have gone out. Rule for every app added
to the audit: run it once against its live host under the guard and list what the guard blocked before trusting any later run.

**D57 — Each books app gets its own content adapter; the shared part is the checkpoint store, the guard and the report.** Story,
activity and interactive books use three different content schemas and four spellings of the correct answer. A single generic
walker would hide exactly the differences that matter. The walkers share `lib-books.mjs`, `stub-api.mjs` and
`resume/checkpoint.mjs`, and each owns the schema-specific graph and scene matching.

**D58 — For the adventure book the audit stops at an explored-but-unwalked state, and says so.** The app is down in production
and, behind a second audit-only shim, turns out to be an RPG with combat and skill-check mechanics. An honest walker needs those
rules understood first (what a skill check requires, what a boss fight awards), otherwise it would assert nothing beyond
"clicked Continue". Stopping here costs one app of walker coverage this session; the alternative was a walker that looks
complete and measures nothing. The static check and the live checks already cover its load failure and its graph.

**D59 — Shims are added one failure at a time, each with its own flag and its own ledger counter.** `COMPAT_WRAP_SCENES` (activity
contract) and `COMPAT_LOCAL_CONFIG` (adventure config) are independent, off by default, and recorded per run. A combined
"make it work" switch would make it impossible to tell which production defect a run was seeing past.

**D60 — A root-cause hypothesis is written down as a hypothesis, with the evidence that would settle it and who can read it.** For the books 500s I
wrote "missing migration or unreachable DB (unverified)", named the log lines that would decide it, and asked the party that could read
them (the audit cannot read production hosts). The answer was a third thing (credential mismatch). Because the ticket and docs said
"unverified" and listed the discriminating evidence, being wrong cost one comment, not a mis-aimed fix. Also: a peer's permission layer
blocked that production read until the operator authorised it; the audit did not route around it and did not ask the peer to.

**D61 — A smoke test's severity follows blast radius, not interest.** Platform-level failures (API routes that all apps depend on, an app that does not
load, an app that cannot progress past its first interaction) are P0; per-book content problems and secondary screens are P1, so one
broken book cannot hide behind, or masquerade as, an outage. Exit 2 (infrastructure error, or too few checks ran) outranks 1, so a run that
could not look is never reported as "the app is broken" or "the app is fine".
