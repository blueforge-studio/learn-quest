# User audits — proposal (2026-10-06)

**Ask (operator):** E2E-style *user* audits, like screen audits but with expectations: a given user
profile plays through many chapters (lessons, side quests, bosses) while we record what they see and
whether they can complete everything; separate audits for multiplayer flows and for admin / test-user
flows. Likely a new "user-audit" concept + package in blueforge-org that extends screen-audit and
supports richer user profiles and flows.

**Status:** proposal only. Nothing written in blueforge-org or any app repo.

## 1. What already exists (read 2026-10-06) — extend, don't restart

| Piece | Where | What it gives us | Where it stops |
|---|---|---|---|
| screen-audit flows | `blueforge-org/packages/audits/screen-audit` (0.13), `screen-audit-runner`, per-repo `screen-audit/flows/*.flow.ts` | `persona` (cookie / header / localStorage / bearer / composite), steps with `route` / `action` / `elements`, per-step `expect` (`toExist`, `toHaveCount`, `toBeVisible`, `toHaveText`), tags, AI-vision grading via `evalPrompt`, browser pool + resource guard | Each step **jumps to a route from seeded state** (e.g. `progress-persists` hard-codes "one lesson done" in localStorage). No state carried between steps, no loops, one context per flow, no "did the user reach the end", no multi-actor. Lang-repo flows are **generated** (`pnpm codegen-flows`, lq-operations). |
| `@blueforge-studio/user-flows` | `packages/utilities/user-flows` | One `*.flow.json` → Playwright spec + screen-audit flow + Mermaid + AppFlow, shared `<flowId>-<stepId>` testids | Declarative step lists; same limits as above |
| lq-core Playwright suite | `lq-core/apps/web/src/e2e` (≈49 lesson, 24 admin, 12 challenges, 10 social, 10 groups specs), page objects (`AdminPage`, `ChallengePage`), seeders (`SideQuestSeeder`), `challengeFixtures`, `MockDatabaseService` | Real functional coverage incl. admin CRUD, challenges, groups | Mostly `*.mock.spec.ts` (mock DB), per-feature, **no record of what the user saw**, no cross-chapter progression, not driven against deployed apps or across the 14 families |
| `first-experience-audit` | `packages/audits/first-experience-audit` | Scores entry routes 0–100 in a real browser; per-kind profiles | Entry only |
| Supporting | `audit-core` (plugin contract), `audit-cookie-seed` (real forge-auth anonymous session), `store-snapshot` (zustand state next to screenshots), `testid-audit` (flow↔source testid drift) | Reusable seams | — |

**Gap, precisely:** nothing walks a *stateful progression* (finish lesson → XP/unlock changes → next
lesson → chapter boss → next chapter), asserts the **game's rules** along the way, records a timeline,
or coordinates **more than one user** at once.

## 2. Concept: `@blueforge-studio/user-audit` ("journey audit")

Composes screen-audit (capture, vision, runner) and user-flows (declared scenes); adds five things.

1. **Profile** (richer persona). `id`, `role` (`learner | parent | admin | tester`), `auth`
   (anonymous / forge-auth account / seeded storage — reuses `PersonaSetup`), `entitlements`
   (free / premium), `locale` + L1, `device`, and **behaviour**: answer accuracy (100 % = "perfect
   learner", 70 % = loses hearts and must retry), pacing, give-up rules. Seeded progress is optional,
   not required.
2. **Journey = goal, not a step list.** `walk({ profile, scope: chapters 1..N, include:
   [lessons, sideQuests, bosses, electives] })`. The walker discovers what is next from the app (map
   state) and the content manifest (what *should* exist), and drives it.
3. **Driver registry** keyed by lesson/activity type (concept, vocab, drill, multiple-choice,
   spelling, dialogue, conversation, boss, side quest …). A generic driver reads the correct answer
   from the lesson content JSON (source of truth) and clicks it; app-specific drivers ship as a plugin
   from the app repo (lq-core), not in the shared package.
4. **Expectations as data (invariants)**, checked at every transition, not only per screen:
   completing a lesson raises XP and marks its card `data-status="completed"`; the next lesson
   unlocks; finishing a chapter unlocks its boss; defeating the boss unlocks the next chapter; hearts
   behave per rules; no console errors / failed requests; no locked-forever lesson. Per-step `expect`
   from screen-audit stays valid inside a journey.
5. **Recorder + coverage oracle.** Event log (JSONL: route, visible testids, state snapshot via
   store-snapshot, console/network errors, timings) + sampled screenshots (lesson start/end, every
   first-of-type, every failure) + optional vision grading on the sampled frames only. Report:
   `completed | blocked-at (chapter, lesson, step, reason)`, plus **coverage = visited ÷ declared**
   (lessons, side quests, bosses, electives) computed against `chapters.json`.

**Multi-actor scenarios (multiplayer).** A scenario declares `actors: { a: profile, b: profile }`,
one BrowserContext each, named barriers (`barrier('both-in-lobby')`) and cross-actor expectations
("a sends challenge → b sees notification within 5 s → b accepts → both see the same round").
Start with challenges and groups/household (fixtures and page objects already exist in lq-core),
then friends/chat.

**Admin / test-user scenarios.** Role profiles with a real session (bearer/cookie) running admin
flows, including **cause → effect across roles** ("admin edits a lesson → learner sees it"). "Test
user" = disposable account created and deleted by a seeder.

**Safety rails (non-negotiable).** Base-URL allowlist; writes only against local / staging / a
sandbox tenant; production runs are read-only smoke with anonymous users; every created account tagged
and swept; hard wall-clock + step budgets; resource guard from `screen-audit-runner`.

## 3. Package layout (blueforge-org)

```
packages/audits/user-audit/
  src/profile/      Profile schema + built-in profiles (new-learner, perfect, struggling, parent, admin, tester)
  src/journey/      walker, invariants engine, coverage oracle (reads chapters.json manifest)
  src/drivers/      registry + generic content-driven driver
  src/actors/       multi-actor scenario runner, barriers
  src/record/       JSONL event log, screenshot sampler, store-snapshot hook, reporters (json + html)
  src/cli.ts        user-audit run --profile … --journey … --base-url … [--sample smoke|full]
  schema/           journey.schema.json  (authoring format; imports user-flows scenes)
```
Plugs into `audit-core` as a strategy; reuses `screen-audit-runner` for browsers and
`screen-evaluator` for vision. Per-app journey configs for the 14 language families are **generated
from the content manifest** (same idea as `codegen-flows`), so no hand-written journey per language.

## 4. Phasing

| Phase | Deliverable | Exit |
|---|---|---|
| **P0 spike** (1–2 days) | Throw-away walker in lq-nordic: Danish ch 1, perfect learner, generic driver, XP + unlock invariants, coverage report | Measured seconds-per-lesson; list of lesson types the generic driver can't finish |
| P1 | Package skeleton: profile + journey schema, recorder, CLI; port the spike | `user-audit run` green on Danish ch 1 locally |
| P2 | Chapters 1..N, side quests, bosses, electives; sampling; vision hook | Full Danish 20 chapters, coverage % reported |
| P3 | Multi-actor harness; challenges scenario first | Two-user challenge passes, with cross-actor expectation |
| P4 | Admin + test-user scenarios, safety rails | Admin edit → learner sees it, accounts swept |
| P5 | Fleet rollout: generated journeys for 14 families; nightly full (sharded) + PR smoke | Ratchet floor on coverage, wired like the screen-audit gate |

## 5. Risks and open questions

- **Run time.** ~170–280 lessons per language × ~20 s ≈ 1–1.5 h sequential for a full walk. Needs
  **two tiers**: *smoke* (3 lessons/chapter + every boss + every side quest) on PRs, *full* nightly
  and sharded by chapter. Measure in P0 before promising anything.
- **Where correct answers come from.** Content JSON is the source of truth, but a bug *in the content*
  (wrong key) would then make the walker fail or pass wrongly — report it as `content-suspect`, not
  as an app failure.
- **Hearts / failure behaviour** make sub-100 % profiles stateful and slower; keep them out of P0–P2.
- **Where it lands.** blueforge-org has no PR-gate CI (force-merge only, per the umbrella CLAUDE.md);
  a new package there needs a deliberate review step. Package work belongs to a session that owns
  blueforge-org (`blueforge`), not learn-quest.
- **Test data in shared environments.** Needs a sandbox tenant or local stack; prod = read-only.

## 6. Decisions (operator, 2026-10-06)

1. **Name and home:** `@blueforge-studio/user-audit` in `blueforge-org/packages/audits/` — **approved**.
2. **Environment:** **local first**, but the runner must be environment-agnostic from day one so the
   same journey runs in **CI and as a post-deploy stage**. Consequences for the design:
   - everything is parameterised by `--base-url` (local dev server, CI preview, deployed host); no
     localhost assumptions in drivers;
   - headless by default, deterministic exit codes (0 pass / 1 journey blocked or invariant failed /
     2 infra error) and a machine-readable `report.json` for gates and dashboards;
   - tiers: `--sample smoke` (post-deploy and PR; minutes) vs `--sample full` (nightly, sharded by chapter);
   - post-deploy mode = read-only smoke with anonymous users against the live host, per the safety rails;
     writes only ever against local / CI / sandbox;
   - results land in the same place screen-audit results do, so existing CI gates can consume them.
3. **Order:** **learner journeys first**, then multiplayer, then admin/test-user (operator delegated
   "do as you think best"; learner journeys carry the largest content-regression risk and every later
   phase reuses their walker, profiles and recorder).

## 7. Split of work

- **learn-quest session (this one):** P0 spike in lq-nordic against a local stack — throw-away code in
  the app repo, not shared infrastructure.
- **`blueforge` session (owns blueforge-org):** P1+ package skeleton once P0 reports which lesson
  types the generic driver can and cannot finish.

## 8. Review notes from the `blueforge` session (observations, not decisions)

- **Review path:** blueforge-org now has `.gitea/workflows/test-audits.yml`, `test-monorepo.yml`,
  `publish-guard.yml`, `publish-changed.yml`. Not yet checked: which are required PR gates, whether
  `test-audits` covers `packages/audits/*`, what publishes a *new* package. Whoever owns P1 reads these
  first. Floor for a new package: one reviewer in the owning session + the package's own test job green;
  `--force` only for structural zero-check cases.
- **Publish gotchas:** make sure `dist` and `*.json` fixtures aren't gitignored; run
  `pnpm -r --no-bail build` once per worktree (stale-dist phantom failures); confirm the version is
  actually on packr after merge — a green merge is not a publish.
- **Requirements to add to the design:**
  1. README must say what `user-audit` does that `first-experience-audit` and `prod-audit` don't
     (stateful progression, rules, multi-actor).
  2. Document whether `content-suspect` findings **fail** the run (exit 1) or only warn — this decides
     whether a post-deploy gate can be trusted. *Recommendation:* warn locally, fail in `--sample full`
     nightly only after a suspect-triage allowlist exists; never fail a post-deploy smoke on it.
  3. "Results land where screen-audit results do" needs a concrete schema reference (a versioned
     `report.json` schema, shared with the screen-audit results consumers), or CI gates can't read it.
  4. The "writes only against local / CI / sandbox" rule is **enforced in code**: a write-capable
     action is refused when `--base-url` is not on the local/CI/sandbox allowlist.
- **Status:** `blueforge` is putting the P1 ownership question to its own user and expects P0
  findings first.

## 9. P0 spike — first findings (2026-10-06, partial)

Setup: separate worktree of lq-nordic `origin/main` (`f72552ef`) at `/Volumes/SSD/Projects/Repos/.lqn-useraudit-wt`
(branch `spike/user-audit-p0`, throw-away scripts in `spike/`, untracked). Playwright, mobile viewport,
signed-out **guest** with the same localStorage seed the screen-audit flows use.

**Feasibility facts (verified)**
- Local stack: `pnpm install --frozen-lockfile` 9.5 s, `pnpm dev` ready in ~12 s on :3010.
  Environment-agnostic by `--base-url` is realistic.
- Map exposes a clean state model: `lesson-card-<id>` with `data-status` (`current` / `locked` / …)
  and `data-locked`; strictly linear unlock (34 cards, only the first unlocked); `boss-node` /
  `boss-battle-card` exist on the map; `level-node-<id>` and `…-popover` testids.
- Chapter header says "**46 left**" while the map shows **34** cards. Chapter 1 has 34 core + 12
  `elective-*` lesson files. A coverage oracle that counts only on-screen cards would under-count; it
  must read `chapters.json` (cards + `groups`).
- Content carries answers (`correctAnswer`) for multiple-choice / drill / spelling, so a
  content-driven driver is feasible for those types. Chapter 1 types: concept, conversation, culture,
  dialogue, drill, multiple-choice, sound, spelling, tonal, vocab, word, elective.

**Findings (each reproduced once, not yet confirmed as bugs)**
1. **Raw i18n key shown to users:** the lesson preview popover renders `lessons.difficulty_beginner`.
   → rule to add: no visible text matching an i18n-key pattern.
2. **Local-run console noise:** CORS errors fetching `lq-assets.blueforge.studio/...` from
   `http://localhost:3010`. → "no console errors" needs a per-environment ignore list, otherwise
   every local run is red.
3. **Starting a lesson from the map was not established.** Mouse click on a level node opens an
   info-only popover (no start button); `tap` (iPhone profile) does nothing; the URL stays on the
   chapter. Lessons opened fine by direct URL, as the existing flows do. Unknown whether this is an
   app bug, a guest/auth limitation, or the wrong interaction.
4. **Concept lesson has no completion affordance for a guest:** the page is static (intro + sections
   + tips), with only "← Back to chapter" and ×; no Next/Complete/quiz. After viewing and going back,
   `concept-sounds` stays `current` and the next lesson stays `locked`; no state written
   (`nordic_player` null, no non-GET requests). **Caveat:** guest session, no real/anonymous account,
   not left open for the lesson's stated 8 minutes. lq-core's `ConceptLessonScreen` *does* have
   Next/Complete, so this app renders a different concept screen. If it holds with a real account it
   would mean a learner cannot get past lesson 1 — **treat as a lead to verify, not a conclusion.**

**What P0 has not done yet:** complete a single lesson; run with an authenticated/anonymous
forge-auth account (`audit-cookie-seed` real path); measure seconds per lesson; test any driver
beyond viewing. P0 is therefore **not** yet at its exit criteria.

**Next P0 steps:** (a) repeat 3 and 4 with a real session (cookie seed) to separate app behaviour
from guest limitation; (b) if completion works, build the generic multiple-choice/drill/spelling
driver and walk ch1; (c) report seconds per lesson and the list of types the generic driver can't finish.

## 10. Profile catalog (2026-10-06) — more user types to simulate

A profile is a point in a few independent **dimensions**; the built-in profiles below are named
presets, and the schema must let a journey combine dimensions freely (`{ base: 'struggling', device:
'small-android', a11y: 'screen-reader' }`). Dimensions:

| Dimension | Values |
|---|---|
| `role` | learner, parent/guardian, teacher, admin, tester, reviewer (review tool) |
| `auth` | guest (no session), anonymous forge-auth, registered, expired/invalid session, mid-run sign-out |
| `entitlement` | free, premium, lapsed, `PAYMENT_PLANS` off (current default) |
| `age band` | child 6–9, tween 10–13, teen, adult — drives reading level, tap precision, parental-gate paths |
| `locale / L1` | target language × learner L1 (L1-aware phonics, RTL, CJK, Nordic diacritics) |
| `behaviour` | accuracy %, pacing, give-up rule, retry policy, session length |
| `device` | iPhone, small Android, tablet, desktop; touch vs mouse vs keyboard-only |
| `a11y` | none, screen reader, keyboard-only, reduced motion, large text / zoom 200 %, high contrast, audio off |
| `network` | fast, slow 3G, offline mid-lesson, flaky (drops 1 in N requests) |

### Learner presets
| Id | What it simulates | Why it finds bugs |
|---|---|---|
| `new-guest` | First visit, no account, no seed | Entry path, guest limits, what a guest *can't* complete (P0 lead #4) |
| `perfect` | 100 % accuracy, no pauses | Fastest full walk; unlock chain, coverage, content-suspect detection |
| `struggling` | ~70 % accuracy, loses hearts, retries | Heart rules, retry loops, "locked forever" after failure |
| `random-clicker` | Random answers, rapid taps, back/forward | Crashes, double-submit, state corruption (fuzz profile) |
| `speed-runner` | Skips intros, answers instantly | Race conditions, XP double-grant, anti-cheat/min-time rules |
| `returning` | Seeded mid-chapter progress, resumes next day | Persistence, streak logic, resume routing |
| `streak-breaker` | Gap of N days (clock shifted) | Streak reset, daily goal, notification copy |
| `polyglot` | Switches target language/app mid-journey | Per-app state isolation, shared-account progress across 14 families |
| `migrant` | Guest → registers → progress merges | Guest-to-account migration, no lost XP |
| `lapsed-premium` | Premium → expired mid-chapter | Entitlement gates, graceful downgrade (blocked on billing gap, lq-core#117) |
| `offline-commuter` | Network drops mid-lesson, returns | Retry/queueing, no silent loss of completion |
| `young-child` | 6–9, big taps, low reading, audio-first | Tap-target size, audio availability, reading-aids renderer |
| `screen-reader` / `keyboard-only` | No pointer | Reuses a11y-debugging skill rules; focus order through lesson + boss |
| `rtl-learner` / `cjk-learner` | Arabic/Hebrew, Japanese/Chinese UI | Layout mirroring, font fallback, text overflow |
| `l1-aware` | Specific L1 → target (e.g. Turkish → Danish) | L1-aware phonics Stage A paths |

### Non-learner presets
| Id | What it simulates |
|---|---|
| `parent` | Parent dashboard: child progress view, screen-time/balance, reward grants (`balanceService`, `rewardGrantService`), parental gate |
| `household-member` | Second child in same household; sibling isolation of progress |
| `teacher` | Group/class view, assigns challenge, sees roster (reuses groups specs) |
| `admin` | Admin CRUD (existing `AdminPage`), edit lesson → learner sees it |
| `tester` | Disposable account created + swept by seeder; runs with feature-flag overrides |
| `reviewer` | Review tool login (admin rows in `reviewers` table), stamp/hold flow |
| `denied` | Valid account lacking the role: every admin/review route must refuse (authz negative testing) |

### Multi-actor pairings (P3+)
`perfect` ⇄ `struggling` challenge; `parent` + `young-child` (approve/reward); `teacher` + 3 learners
in one group; `admin` + `perfect` (edit-then-observe); two `speed-runner`s hitting the same challenge
round (race).

### Phasing impact
- **P0–P2 (learner first, unchanged):** `new-guest`, `perfect`, `returning`. Add `struggling` only
  after P2 (hearts keep it out until then, per §5).
- **P2.5 (cheap, high yield):** `random-clicker`, `speed-runner`, `migrant`, `keyboard-only`,
  `young-child` — all driven by the same walker with a different behaviour/device config, so they cost
  profile data, not new code.
- **P3:** multi-actor pairings. **P4:** `parent`, `teacher`, `admin`, `tester`, `reviewer`, `denied`.
- Each preset ships with its **expectations** (e.g. `young-child`: every tap target ≥ 44 px; `migrant`:
  XP before == XP after registration; `denied`: 401/403 on every protected route, never a 200 SPA shell —
  see the SPA-200 trap).

### Open questions for the operator
1. Which non-learner roles actually exist in production today (parent dashboard, teacher/group view)?
   I listed them from lq-core specs; confirm before they're scoped.
2. Is `random-clicker` (fuzz) in scope for post-deploy smoke, or local/CI only? Recommendation: local/CI
   only; it writes junk.
3. Clock-shifting (`streak-breaker`, `lapsed-premium`) needs a controllable clock — only possible on
   local/CI. Acceptable?

## 11. P0 spike — update 2 (2026-10-06, still partial)

Same setup as §9 (lq-nordic `f72552ef`, local `pnpm dev`, mobile viewport, guest + flow localStorage seed).
Scripts: `spike/{concept2,types,check,state}.mjs` in the worktree (untracked).

**Correction to §9 lead #4 (guest vs real session).** lq-nordic's source has no forge-auth wiring (the
shell is `createApp` config + `AlphaGate`; state is localStorage: `nordic_lessonmap_v2`,
`nordic_elective_picks`, …; `nordic_player` is not what progress lives in). So a cookie-seeded "real
session" is **not** the discriminator locally; the guest hypothesis is largely moot for this app.

**Per-type completion controls observed (direct URL, guest):**

| Type | Lesson | Control found |
|---|---|---|
| concept (×4 checked: `concept-sounds`, `-sentence-structure`, `-danish-stod`, `-danish-sounds`) | — | **none** — only Back, ×, and the L1 "Cue" audio button; scrolled to bottom, waited, no non-GET requests |
| vocab | `vocab-basic-phrases` | `lesson-next-btn` |
| spelling | `spelling-greetings` | Check + `activity-next` |
| word-order | `word-order-simple` | tiles + Reset/Check + `activity-next` |
| multiple-choice | `multiple-choice-basics` | answer buttons |
| culture | `culture-intro` | `lesson-complete-btn` ("Lesson Complete") |
| conversation / dialogue | `conversation-greetings`, `dialogue-meeting-someone` | `lesson-next-btn` |
| tonal | `tonal-stod-minimal-pairs` | `tonal-next` |
| sound-pattern | `sound-pattern-g` | `sp-intro-next` |
| **drill** | `drill-numbers-1-10` | **crashes**: "Something went wrong! Cannot read properties of undefined (reading '0')" |

**Findings (reproduced, not yet root-caused)**
- **A. Chapter 1 opens with 7 consecutive concept lessons and the map is strictly linear** (only
  `concept-sounds` unlocked). If concept lessons truly cannot be completed, a learner cannot get past
  lesson 1. Strongest lead so far, but "no control rendered" ≠ "no completion path": a timer
  (lesson says ~8 min), a scroll-end trigger, or a different completion route are not ruled out. Needs a
  read of the concept screen source in the published app-shell/web-app before filing as a bug.
- **B. `drill-numbers-1-10` throws on open** (`reading '0'` of undefined). Looks like malformed drill
  content (empty options/answers array) or a drill-screen assumption. Check the lesson JSON. Note
  `drill-greetings` was not opened; unknown whether all drills fail.
- **C. Direct URL opens locked lessons** (`culture-intro` was locked yet opened and offered Complete).
  Completing it out of order unlocked nothing and left the map unchanged, which is plausible behaviour,
  but "locked lessons are reachable by URL" should be an explicit invariant decision (allowed vs
  redirect).
- **D. Lesson ids ≠ bundle ids:** `en/lessons/chapter-1-bundle.json` lists `concept-danish-sounds`,
  `basic-phrases`, `multiple-choice-articles-1`… while the map uses `vocab-basic-phrases`,
  `concept-sounds`, etc. The coverage oracle must read `chapters.json` / the map manifest the app
  actually uses, not the bundle.
- Findings 1 (raw i18n key `lessons.difficulty_beginner`) and 2 (CORS console noise) from §9 stand.

**Still not done:** complete any lesson *and observe the unlock/XP invariant change* (culture-intro was
locked, so it proved nothing); run a content-driven multiple-choice; seconds-per-lesson. Cheapest next
step: complete the *current* lesson type that has a control. Since lesson 1 is a concept lesson with no
control, seed `nordic_lessonmap_v2` / progress to unlock lesson 8 (`vocab-basic-phrases`) and walk
forward from there; separately, read the concept screen source to settle finding A.

**Implication for design:** a journey must be able to report `blocked-at (concept-sounds, no
completion control)` as a first-class outcome. That is exactly what a user-audit exists to surface, and
the spike has hit it on the first chapter.

## 12. P0 spike — update 3 (2026-10-06): finding A resolved, first checkpointed walk

Vision and design target for all of this: [`USER_AUDIT_VISION_SPEC_2026_10_06.md`](USER_AUDIT_VISION_SPEC_2026_10_06.md)
(checkpoint/resume, multi-dimension weighted scoring, app × language × L1 × segment matrix, report → fix
loop, distributed runs with compute/cost metering on forge-control).

**Corrections to §9 / §11**
- **Finding A (uncompletable concept lesson) is an audit artefact, not an app bug.** The shared
  `LessonCompleteBar` (`lq-core/libs/app/web-app/src/lesson-completion.tsx`) returns `null` while
  `player === null`. The flow seed sets `onboarding-completed` without creating a player, a state no real
  learner reaches. With real onboarding (language → welcome ×3 incl. proficiency picker → character with a
  name) a player exists and the button renders. **The seed shared with the existing screen-audit flows
  therefore hides every "complete" path on concept and multiple-choice screens**; worth raising with the
  screen-audit owners. Owner class for this one: `audit`.
- §11's "guest vs real session is moot" was half right: the discriminator is *player exists*, created by
  onboarding, not a forge-auth cookie.
- §11 item D (id mismatch) refined: the app reads lessons from `public/data/lessons/<ui>/<lang>/chapters/
  <chapter>/<id>.json`, a third tree beside `languages/<lang>/data/<ui>/lessons/` bundles. The oracle must
  read the tree the app serves.

**Checkpointed walk, chapter 1, real player, `perfect` behaviour (generic advance-clicker only)**
(`spike/walk.mjs` → `spike/walk-ch1.jsonl`, one record per lesson)
- 7 concept + 5 vocab lessons **completed**; XP +100 each; map unlocks the next card; ~1.9–2.2 s per
  concept, ~4.9–5.3 s per vocab lesson (includes fixed waits: an upper bound).
- **Blocked at lesson 13, `drill-numbers-1-10`**: "Something went wrong! Cannot read properties of
  undefined (reading '0')". Cause is **content**: its `content` is `{0:…,…,9:…}` where `drill-greetings`
  has `{drillType, progressiveStages[], difficulty, targetAccuracy, xpMultiplier}`. On the strictly linear
  map this blocks the rest of chapter 1 for every learner. Same shape problem in 8 of 104 drill files in
  lq-nordic (en: ch1 `drill-numbers-1-10`, and ch16–20 `drill-society-vocab`, `-science-tech-vocab`,
  `-arts-vocab`, `-environment-vocab`, `-formal-vocab`; plus the th and zh copies of the ch1 drill).
  **Only ch1 was observed crashing**; ch16–20 not opened, so unconfirmed (the screen might accept another
  shape there). Owner class: `content` / `content-generator`.
- Leads to verify: completing a lesson gives **no visible feedback** (URL stays on the lesson; the
  `/lessons/level-up` handoff isn't seen), and **100 XP awarded vs "60 XP" displayed** (may be the
  first-time bonus). Both need a product answer.

**Findings from this session are not filed anywhere yet.** The drill crash is the one worth a ticket now
(content fix + a shape guard in the generator/CI); say so if you want it filed.

**Resume gap discovered:** progress is localStorage-only, so skipping completed records on resume is not
enough. P1 must persist a `storageState` snapshot per checkpoint (vision spec §3.3).

**P0 exit criteria status:** seconds-per-lesson measured for 2 types (concept, vocab); generic driver
**cannot yet** finish: drill (content crash), multiple-choice/spelling/word-order (need the
content-driven answer driver; not built). Next: build that driver and walk past lesson 13 by seeding or
skipping the broken drill.

## 13. P0 spike — update 4 (2026-10-06): content-driven drivers, chapter 1 walked end to end

Code (throw-away, untracked, in the worktree `spike/`): `lib.mjs` (launch + **real onboarding**),
`walk3.mjs` (per-type drivers, JSONL checkpoint per lesson, skip-on-block, UI-rule scan),
`walk3-ch1.jsonl` (the result). Drivers read the correct answers from the lesson JSON the app serves
(`public/data/lessons/<ui>/<lang>/chapters/<ch>/<id>.json`).

**Result: 30 of 34 chapter-1 lessons completed by a `perfect` learner in ~245 s total (avg 7.2 s/lesson).**

| Type | n | avg ms | Driver |
|---|---:|---:|---|
| concept | 7 | 2,144 | generic "Complete lesson" |
| vocab | 10 | 4,902 | generic Next-clicker |
| culture | 2 | 2,299 | generic |
| multiple-choice | 2 | 3,955 | content-driven; two question shapes (`prompt` and `sentence`), positional fallback |
| spelling | 2 | 6,753 | type word, Check, Next |
| word-order | 2 | 7,213 | **reorder UI** (tiles + `‹` move-left arrows), not click-to-place |
| conversation / dialogue | 2 | 5,665 / 4,650 | Next + `dialogue-choice-N` |
| drill | 2 | 9,564 | per-stage questions, `Next Stage` between stages |
| sound-pattern | 4 | (2 done, 2 blocked) | intro → sort into `sp-bucket-<soundId>` → "faded" stage |
| tonal | 1 | blocked | see below |

Timings include the walker's fixed waits: upper bounds. Chapter 1 ≈ 4 min; do **not** extrapolate to a
language until other chapters' lesson counts are measured.

**Real findings (app/content, reproduced)**
1. **`drill-numbers-1-10` crashes on open** (content shape wrong; blocks the linear map). 8 of 104 drill
   files in lq-nordic share the shape. Only ch1 observed crashing. Owner class `content` /
   `content-generator`. Ticket-worthy.
2. **Raw template variable shown to learners:** dialogue choice reads "Ja, jeg hedder `{{playerName}}`.
   Hvad hed…" in `dialogue-meeting-someone`. The scanner flags `{{…}}` and raw i18n keys on every step.
   Owner class `content` or `lib` (interpolation not applied to choice text); unverified which.
3. **XP awarded is always 100; lessons declare 60** (all 30 completed lessons). Constant, so this is a
   rule, not noise. Needs a product answer (see vision spec §10.7).
4. Earlier leads still open: no visible feedback after completing a lesson; chapter header "46 left" vs 34
   cards; locked lessons open by direct URL; a 2-character character name leaves Continue disabled
   (not checked whether the UI explains the minimum).

**Audit-side findings (owner class `audit`)**
- The screen-audit flow seed hides every "complete" path (no player). Real onboarding fixes it.
- Quizzes use different question shapes in the same lesson type; word-order is a reorder UI; sound-pattern
  has an intro, a sort stage and a "fade the helpers" stage; the Next control has a different testid per
  type (`lesson-next-btn`, `activity-next`, `tonal-next`, `tonal-finish-learn`, `tonal-after-compare`,
  `sp-intro-next`, `sp-sort-next`, `sp-faded-next`). A generic role-based "Continue/Next" fallback plus a
  per-type driver registry (as designed) is the right shape; a hand-listed testid set is brittle.

**Not finished (driver gaps, not app signals)**
- `tonal-stod-minimal-pairs`: walker still ends with `no-advance-control` after the compare stage even
  with the generic fallback (a standalone probe showed `tonal-after-compare` "Continue" exists). Needs
  the exact transition read.
- `sound-pattern-g` / `-d` (two-bucket sorts): bucket click times out at 30 s; the one-bucket variants
  (`hv-h`, `final-t`) complete. Likely an animation/overlay or disabled-state issue; not diagnosed.
- Boss, side quests, electives, chapters 2–20, `struggling` behaviour, multi-chapter unlock, real
  forge-auth: not touched.

**P0 exit criteria**: seconds per lesson for 9 of 11 types measured (done); list of types the generic
driver cannot finish (answer: drill-with-bad-content, tonal end, two-bucket sound-pattern, pending
diagnosis); **recommendation for P1**: proceed. The walker design (content-driven answers + per-type
driver registry + JSONL checkpoint) works on a real chapter; the remaining gaps are driver details.
Resume still requires `storageState` snapshots (not yet built in the spike).

## 14. P0 spike — update 5 (2026-10-06): chapters 1–5 walked, defects triaged

Walker `spike/walk3.mjs` now takes `CHAPTER=<n>`; for n>1 it seeds all earlier chapters as completed so the
chapter unlocks (46 lessons for ch1 = 34 map cards + 12 electives, matching the "46 left" header).
Results: `spike/walk3-ch{1..5}.jsonl`, `spike/summarize.mjs`.

| Chapter | Completed | Notes |
|---|---:|---|
| 1 | 30 / 34 | 1 real crash, 1 lib bug (tonal), 2 driver gaps (two-bucket sound-pattern) |
| 2 | 24 / 25 | 1 real crash (MC option objects) |
| 3 | 20 / 22 | 2 unresolved (timed drill, quiz positional click): driver or content, undetermined |
| 4 | 19 / 20 | 1 real crash (culture items as objects) |
| 5 | 21 / 22 | 1 unresolved (quiz positional click) |
| **1–5** | **114 / 123 (93 %)** | ≈ 12 min of walker time in total at 3 in parallel, ~2–5 min per chapter alone |

**Confirmed app / content / lib defects (each reproduced, mechanism read from source or error text)**
1. **Tonal lessons cannot be finished** (lib). `useTonalLesson.handleNextTone`
   (`lq-core/libs/lang/lesson-types/src/language/tonal/hooks/useTonalLesson.ts:129`) checks
   `tonalData.comparisonMode` *before* the quiz/complete branches, so on the last tone it re-sets phase
   `compare` forever: the "Continue" on the compare screen (`tonal-after-compare`) is a dead button.
   Observed: click → no navigation, no state change, no request. Affects every tonal lesson with
   `comparisonMode` in every app that ships them (tonal-language families, Nordic pitch accent). Caveat:
   source read on lq-core main; the installed `@learnquest/lang-lesson-types` was 0.2.3 and behaves the
   same, but the built dist was not diffed against the source.
2. **`drill-numbers-1-10` crashes** (content shape; ch1; blocks the linear map). 8/104 drill files share the shape.
3. **`multiple-choice-pronouns-1` crashes** (ch2): "Objects are not valid as a React child (found: object
   with keys {targetLocale, learnerLocale, english})". Its `options` are objects, the other 24 MC lessons
   use strings. Content-generator / screen mismatch.
4. **`culture-family-values` crashes** (ch4): same error class with keys `{text, explanation}`
   (`dosDonts` / `practicalTips` items are objects). **Pattern: content shifted string → object and a
   screen still renders strings.** A static scan of all lesson JSON against the screens' expected shapes
   would find the rest before any learner does; not done.
5. **Raw template variable shown to learners**: `{{playerName}}` in `dialogue-meeting-someone` (ch1) and
   `conversation-meeting-family` (ch4). Two lessons, two types: interpolation is missing in the shared path.
6. **XP awarded is constant 100; lessons declare 60 (ch1–3) and 80 (ch4–5).** Rule needs a product answer.

**Audit-side findings (owner class `audit`)**
- **Seeded progress must be consistent with the rest of the player.** Seeding 117 completed lessons with 0
  XP made the first real completion jump XP by +2,300, raise the level and show the level-up screen, which
  my walker then clicked underneath for 200 s. Journeys that start mid-game need seeds that match XP/level/
  stats (or should be built by replaying real progression, not by editing storage).
- Completion must be detected by "this lesson id is now in completed", not list length.
- A level-up interstitial is a real step of the journey and must be handled by the driver.
- Transient `page.goto` `ERR_ABORTED` killed a run: navigation retry added; this class is `infra-error` and
  must never end or score a journey (vision spec §3.4).
- Step caps must scale with the lesson (vocab lessons run 26–29 steps; a cap of 40 clicks cut them off).

**Still open (not yet classified as app vs driver):** `sound-pattern-g/-d` (two-bucket sorts, click timeouts),
`drill-transport-vocab` (16 s per-question timer, fails at q6), `multiple-choice-directions-1` and
`-home-1` (positional fallback fails on the `sentence` shape: needs the question text matched or a
per-question scoping fix), `word-order-directions` (activity restarts to 1/6 mid-way: an arrangement
may not have been accepted: possible content-suspect). Boss/side-quest/elective/chapters 6–20,
`struggling` behaviour, multi-chapter unlock by real play: not touched.

**Process note:** I stopped the dev server twice with `pkill -f vite`, which also matches `vitest` and other
sessions' Vite servers. Use the port (`lsof -ti tcp:3010`) instead. A peer session's `vitest` was alive
afterwards, but I cannot rule out that one was killed.

## 15. Static content-shape check (2026-10-06) — built, validated on lq-nordic

Tickets filed from §14: **lq-core #141** (tonal compare screen dead end, `useTonalLesson.handleNextTone`) and
**lq-nordic #77** (3 content-shape crashes + drill layout + `{{playerName}}`). Screen-audit seed finding was
sent to the `blueforge` session; it replied that it owns neither `lq-operations` (codegen-flows) nor
`blueforge-org`, so the persona fix has **no named owner yet** (see "Open" below).

**Tool:** `tools/content-shape-check/check.mjs` (copy of `spike/shape-check/check.mjs`; zero dependencies;
`node check.mjs <app>/public/data/lessons --ui en [--json out.json]`; exit 0 clean / 1 errors / 2 usage).
0.4 s for 1,579 lessons. No browser, no server.

Two layers:
- **Inferred:** per lesson type, learn the dominant kind (string/object/array) of every JSON path from the
  corpus (≥ 90 % of instances) and flag instances that disagree. Severity is asymmetric on purpose: an
  *object where text is expected* is an **error** (React throws "Objects are not valid as a React child");
  a string where an object is expected is only `shape-drift` (warn). Containers a type "usually has" are
  warnings (`missing-usual`); only a short list the screens cannot render without
  (drill `progressiveStages`, quiz `questions`, word-order `exercises`, spelling `words`) is an error.
- **Explicit:** array-like objects (`{0:…,9:…}`), unresolved `{{templates}}`, sentinel strings
  (`undefined`, `[object Object]`), answer key not among the options (numeric keys: in-range index is a
  warning because index keys are unverified, out-of-range is an error), word-order tiles vs sentence
  (case-insensitive, multi-word tiles split), spelling entries without a word, concept without sections.

**Validation against the browser (lq-nordic, `en`, 1,579 lessons):**
- Flagged all 21 lessons the first version marked; opened each as a real learner: 10 crashed. After
  tuning, **the checker's 10 non-template error lessons are exactly those 10 crashes** (6 drills with no
  `progressiveStages`, `multiple-choice-pronouns-1`, `culture-family-values`, and two **Icelandic** concept
  lessons whose `tips[]` are `{tip}` objects: not previously known). **0 missed** among the flagged set.
- **Sample of 80 unflagged lessons: 0 crashed.** Weak evidence for false negatives: the sample is mostly
  vocab/conversation/culture and holds only 2 drills, 1 quiz, 1 spelling, 3 word-order.
- Tuning that mattered: (a) word-order mismatches were all capitalisation or multi-word tiles, so the rule
  went case-insensitive; (b) culture `tips[]` / `funFacts[]` objects did **not** crash (5 lessons), so they
  are listed as `TOLERATED` (empirical, warn only); (c) most "required container" hits were optional fields.
- The 5 `{{playerName}}` lessons are reported as errors but do not crash: they show the placeholder text.

**Fleet scan (read-only, `en`; error lessons / lessons):** african 1/1041, balkan 3/1541, east-asian 3/741,
english 4/870, middle-eastern 3/698, nordic 14/1579, romance 4/661, south-asian 1/1216,
**southeast-asian 35/1540 (29 unresolved templates)**, west-slavic 1/513; celtic, germanic, math, slavic,
uralic clean. About 69 lessons in ~12,700. **Only lq-nordic findings are browser-confirmed**; the others are
predictions. (`lq-nordic-fresh` is a second checkout of nordic and is not counted.) Non-language repos
have no `public/data/lessons`; reading/school-style content (different layout, `lq-reading`) is not covered.

**Open**
1. **Where the persona/seed fix lives** (screen-audit seed hides every "complete" button): `blueforge`
   declined ownership; owner of `lq-operations` / the user-audit design is not identified. Needs the
   operator to name one. Add "seeded XP/level must match seeded progress" to the persona spec.
2. **Home for the checker:** here for now (uncommitted). Natural homes: `lq-tools` (content tooling; no PR
   CI) or a `static` stage of the proposed `user-audit` package. Either way it should run as a PR gate on
   content repos: it is fast and deterministic.
3. **Index answer keys (`correctAnswer: 1`)** in lq-balkan multiple-choice: unverified whether the screen
   accepts them; if it compares text, every such question is marked wrong. Needs one browser test in an
   lq-balkan build.
4. Run the 3 `answer-not-in-options` / `object-where-text-expected` hits in the other repos in a browser
   before filing anything there.

## 16. Index answer keys are graded wrong in lq-balkan (2026-10-06, browser-confirmed)

Open item 3 of §15 resolved. In a local lq-balkan build, `bulgarian/chapter-10/multiple-choice-history`
(`correctAnswer: 1`, options `[queen, king, prince, castle]`, "крал" = king):
- click **king** (the right answer, index 1) → styled **red** (wrong), same as clicking queen;
- control in the same app, text-keyed (`albanian/chapter-1/multiple-choice-basics`, `correctAnswer:
  "Faleminderit"`): correct → **green**, wrong → **red**.
Cause: `lq-core/libs/app/web-app/src/screens/multiple-choice.tsx:44` compares `String(answer) ===
q.correctAnswer` and types the key as `string`; an index never equals an option's text. **Scope: 198 questions
in 17 lessons, all lq-balkan** (no other app uses index keys; static scan, §15). Not established whether
the wrong grading also affects score or XP, or only the on-screen feedback.

Also: three lesson types grade three ways. MC `String(answer) === correctAnswer`
(`multiple-choice.tsx`); drill strict `===` (`DrillLessonScreen.tsx:92`, `useDrillLesson.ts:48`); quiz
accepts strings + sibling `correctAnswer` **or** `{text, correct}` objects (`quiz/types.ts`,
`useQuizLesson.ts`). Three conventions for "which option is right" already exist in code, and content
adds two more (index keys, object options `{targetLocale, learnerLocale, english}`).

Filed as **lq-core #142** (hotfix for numeric keys + shared resolver + option-id schema). Tickets so far: lq-core #141 (tonal), #142 (answer keys); lq-nordic #77 (content crashes).

## 17. Chapters 6-20 walked; resume built and stress-tested (2026-10-07)

**Walk (serial, D16, one checkpoint file per chapter; `spike/walk3-ch{6..20}.jsonl`).** Whole pilot cell
(lq-nordic / Danish / en / `perfect`), chapters 1-20: **262 map lessons walked, 239 completed (91.2 %), 23 blocked.**
Chapters 6-15 had **zero blocks** (110 lessons). Blocks by cause:

| Cause | Count | Lessons |
|---|---:|---|
| **Content shape the screen cannot render** | 20 | drill-numbers-1-10 (ch1) + 5 drills ch16-20; MC pronouns-1 (ch2); culture-family-values (ch4); sound-pattern -g/-d (ch1, pair words lack `soundId`); **10 core `vocab-*` lessons in ch16-20 (2 per chapter) whose `content` is `{items, slot}`, the elective shape, while the screen renders core vocab as an array: they show only a Back button** |
| Library bug | 1 | tonal compare screen dead end (lq-core #141) |
| My driver (not the app) | 2 | `word-order-cause-effect` (ch19) and `word-order-formal-requests` (ch20): my tile matching was case-sensitive and ignored multi-word tiles |

Ticket status: the drill, MC and culture crashes are in lq-nordic #77; the sound-pattern pair is a comment on it.
**Not yet reported anywhere:** the 10 blank vocab lessons in ch16-20 (new, found here).

**Static check vs browser on this cell (chapters 1-20).** Predicted-to-block: 20; actually blocked: **20; false
alarms: 0; missed content-caused blocks: 0.** The misses are the library bug (not content-detectable) and my own
driver bug. **In-sample caveat:** the rule changes that made this 20/20 (group shape inference by
type + elective; treat array-vs-object as an error) were made after seeing the vocab miss. Out-of-sample
validation needs another app.

**XP finding sharpened (game mechanics).** Awarded XP is **100 for all 239 completed lessons**, while declared
`xpReward` climbs by chapter band: **60 (ch1-3), 80 (ch4-6), 100 (ch7-9), 120 (ch10-20)**. 206 of 239 mismatch.
So the earlier "first-time bonus" idea is refuted. Cause in source: `ProgressionService.calculateLessonCompletion`
calls `playerStatsService.calculateLessonXP(score, maxScore)`, which never reads the lesson's `xpReward`
(`lq-core/libs/app/app-services/src/player/ProgressionService.ts:21`). Effect: the lesson screen advertises "60
XP" and awards 100; from chapter 10 it advertises 120 and awards 100, so late-game learners are shorted and the
chapter XP curve in the content does nothing. 27 lessons caused a level-up. Not ticketed (needs the operator's go).

**Timing (serial, clean; median ms per completed lesson, ch6-20).** concept 3.5 s, culture 2.9 s, dialogue 4.9 s,
MC 4.4 s, conversation 6.1 s, word-order 7.3 s, spelling 8.5 s, vocab 12.8 s, drill 17.6 s. Walker lesson time
for 262 lessons: 29.6 min, i.e. ~6.8 s per lesson on average (includes fixed walker waits: an upper bound).
A full Danish pilot walk of the map is ~30 min serial.

**Coverage gap found.** 18 `review` lessons (ch3-20) are never reached from the map; 3 more declared lessons are
unwalked (`ch5/concept-prepositions`, `ch8/vocab-shopping`, `ch20/conversation-job-interview`). Whether they are
orphans (declared but unreachable) or reachable another way is unverified: bosses and reviews are the next walk.

**Resume (D36-D39) and what the crash tests found.** First crash-test run was a *fail of the setup, not of
resume*, and exposed three real gaps, all fixed (D41, D42):
1. The **reference run ended early** ("no current card -> end of chapter map" after 8 of 22 lessons): the map was
   read before it settled. The same flaw exists in walk3, so earlier chapter walks may have ended early. Cross-check
   found chapters 1-2 fully walked and later chapters within 1-2 non-elective files of complete (the remainder are
   the reviews and three odd lessons above), so truncation is unlikely but not excluded for those three.
2. **A browser crash was not handled**: the walker threw "browser has been closed" and nothing restarted it, and
   the same code path would have *recorded the crash as a lesson result*. Now infra errors are never recorded, exit
   75, and `resume/supervise.sh` restarts from the last snapshot.
3. My T5 harness copied a snapshot that pruning had deleted, so the stale-snapshot path was not exercised.

### 17.1 Crash-test result (2026-10-07): resume verified

Second run of `resume/crash-tests.sh` (chapter 5, 24 map cards) after the walker fixes. Every recovered run equals the
uninterrupted reference (same 22 lessons walked in the comparison view, same outcomes, **0 duplicates, 1 run id**):

| Scenario | Result |
|---|---|
| T1 reference under the supervisor | all 24 map cards completed, finished |
| T2 SIGKILL right after commit #8 | resumed at seq 8, next card `vocab-cooking`; PASS |
| T3 SIGKILL in the middle of lesson #12 | resumed at seq 11, lesson redone once; PASS |
| T4 SIGKILL after the snapshot, before its record | orphan snapshot ignored, resumed at seq 4; PASS |
| T5 stale newest snapshot | verification **failed** ("snapshot lacks 9 recorded lessons"), rolled back to seq 8, lesson redone; **1 rollback, as expected**; PASS |
| T6 browser killed mid-lesson | `INFRA-ERROR (restart me)`, exit 75, supervisor restarted from seq 11 and finished in 2 attempts, no human; PASS |

**Correction to earlier results.** The reference now shows chapter 5 has **24 map cards**; the earlier walk3 pass covered 22
(`review` and `concept-prepositions` were never reached). The walk3 end-detection flaw therefore truncated chapters
by the last one or two cards. Consequences: (a) "chapters 6-15 had zero blocks" is true **for the lessons walked**; the
18 `review` lessons and ~3 others in ch3-20 are unknown, not clean; (b) per-chapter pass rates above are over walked
lessons, not over map cards; (c) the full-language coverage figure (123 of 520 declared) should not be read as
precise for the tails. Plan: re-walk only the missing tails by seeding each chapter's already-walked lessons and
letting walk4 continue from the first uncompleted card, then walk reviews and bosses.
