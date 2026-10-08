# User audit — integration with forge-control, forge-dev and blueforge (design, 2026-10-06)

**Ask (operator, 2026-10-06):** integrate the user audit with `forge-control`, `forge-dev` and `blueforge`.
**Status:** design only. No code or config has been written in any of those three repos. Companion docs:
proposal (`USER_AUDIT_PROPOSAL_2026_10_06.md`), vision (`USER_AUDIT_VISION_SPEC_2026_10_06.md`), decision log
(`USER_AUDIT_DECISIONS_LOG_2026_10_06.md`, D15 onward covers this document).

**Evidence standard.** Facts about the three repos come from three read-only explorer agents plus my own spot
checks. **Verified by me:** forge-dev `@forge/auditor-sdk` types (`DimensionScore`, `AuditorReport`, null
semantics, `sampleId`); `packages/auditor-learn-quest` exists; forge-control `createJobInput`
(`packages/domain-compute/src/schemas.ts`); blueforge `src/app/api/audit-runs/route.ts` and the
`audit_runs` / `audit_tiers` tables. **Reported by the explorers, not re-read by me:** everything marked
*(reported)*. Treat those as leads to confirm with the owning session before building on them.

## 1. Principle

**One canonical result, three thin adapters.** The user audit produces a single versioned
`report.json` (`blueforge.user-audit/1`). Each platform consumes it through a small adapter that maps onto
what that platform already does. We do **not** build a fourth scoring system, ratchet, or dashboard.

Why: all three repos already own a piece (forge-dev: weighted-dimension scoring + ratchet; forge-control:
compute and fleet cost; blueforge: registry, admin portfolio, audit tables). Duplicating any piece means two
sources of truth that drift. The unusual part of this audit is the *data* (learner journeys, per-cell
matrix), not the plumbing.

## 2. What already exists

| Plane | Repo | What exists | Fit |
|---|---|---|---|
| Scoring + ratchet | forge-dev | `@forge/auditor-sdk`: `Auditor {id, dimensions, applies, run}`; `DimensionScore {id, score: 0-100 \| null, weight, notes, facts}`; `null` drops from the denominator and lowers `confidence`; `AuditorReport {total, confidence, sampleId, ...}`; floors in `audits/baseline.json`; ratchet raises a floor to one point under the observed score once a 5-score window supports it; violations `below-floor`, `went-null`, `dimension-removed`, `auditor-missing`; CI job `audit-suite` + nightly *(reported)*; third-party ids namespaced (`acme:lesson-shape`); **precedent:** `@forge/auditor-learn-quest` adapts `lq-operations/dist/maturity.json` | **Very high.** Same "never 0 for no data" rule as our design. |
| Score transport | forge-dev | `scripts/post-suite-report.mjs` POSTs reports to mission-control `/api/audits/suite`; `scripts/push-audit-scores.mjs` pushes `audit.score` readings to app-dev-db; a new dimension needs a `CHECKED` entry in `scripts/lib/audit-score-readings.mjs` or it is skipped *(reported)* | High |
| Execution | forge-control | Compute-jobs API `/api/compute/jobs` with `createJobInput`: `image`/`template`, `command[]`, `env`, `cpuRequest`, `memoryRequest`, `inputs[]`, `outputs[]`, `maxRuntimeSeconds` (≤ 14,400), `maxCostUsd`, `idempotencyKey`, `tags`; table `compute_jobs` has `cost_so_far_usd`. **Not verified that a worker consumes it today** (docs dated 2026-04-25; fleet.md lists no compute-node role) *(reported)* | Spec fits; liveness unknown |
| Execution (works today) | forge-control | Gitea Actions cron/dispatch workflows on act-runners (ci-1, ci-2, 2 runners each); template `fleet-coverage-canary.yml` (schedule + dispatch, concurrency group, timeout, SSH secret) *(reported)* | High for pilots |
| Cost | forge-control | `forge cost hetzner`, `GET /api/hosting/cost/hetzner`, per server/type/role/day (tenant attribution specified, not shipped); `fleet.yml` has server-type prices; budget €200/month; September invoice **€611.80, mostly autoscaler burst VMs**. **No per-job CPU/memory accounting** *(reported)* | Partial: host cost yes, per-job no |
| Registry + display | blueforge | `audit_runs` (iterate-run results via `POST /api/audit-runs`), `audit_tiers`, `portfolio_snapshots`, admin pages `/admin/portfolio`, `/admin/portfolio/trends`; **no per-language or per-learner-segment table, no public per-app quality score** *(reported)*. Catalog report `blueforge.catalog-report/1` has buckets A-E2, **no numeric scores** | Extend, not reuse as-is |
| Weighted-score precedent | blueforge-org | `first-experience-audit`: weights per product kind, N/A redistribution, per-check floors, worst-route gating (`src/score.ts`, `profiles.ts`); `audit-core` `AuditStrategy` with `tier.classify(ctx) -> {tier, score, rationale}` (`DRAFT/PREVIEW/PASS/BETA/PROD`) *(reported)* | Reuse the weighting machinery |
| Attribution | blueforge | `data/repo-products.yml` maps repo slug to product id; the thirteen `lq-*` group slugs map to the umbrella product `lang-quest`; a sidecar's product id wins *(reported)* | Needed for roll-up |
| Sidecars | blueforge-org | `@blueforge-studio/blueforge-sidecar-schemas`, product sidecar is `.strict()`: an unknown key is rejected, so an `audit` block needs a schema change + version bump *(reported)* | Avoid for now |

**Correction to the umbrella docs:** `/Repos/CLAUDE.md` says "audit ratchet floor 79". The forge-dev session
confirmed (2026-10-06) there is **no global floor**: `baseline.json` is `auditors[auditor][dimension]`, and the 79 is
`features.executed` (`features.verified` is 22). Floors are per auditor × dimension.

## 3. Integration by plane

### 3.1 Scoring and ratchet → forge-dev

Implement the user-audit scorer as a **third-party auditor** (`learn-quest:user-audit`), following the
`auditor-learn-quest` precedent: the audit runner exports a JSON file; a thin adapter in forge-dev reads it
and returns `DimensionScore[]`.

Mapping (proved with `spike/report.mjs`, which already writes `auditor-report.preview.json`):

| User-audit | forge-dev SDK |
|---|---|
| dimension `{id, score\|null, weight, notes, facts}` | `DimensionScore` unchanged |
| `null` when no check is implemented | `null` (identical rule) |
| weight scaled by check coverage, nominal weight kept in `facts` | `weight` (so a thin dimension counts less) |
| `confidence` (share of nominal weight measured) | `AuditorReport.confidence` |
| `runId` | **`sampleId`** (see below) |
| `total` (raw weighted mean) | `total` |
| gates (e.g. blocked main path caps at 60) | **not representable**; carried in the blueforge report; the `completability` floor is what the ratchet sees |
| findings (with fix-surface owner class) | **not representable**: the SDK `Finding` is dependency-vulnerability shaped (`ecosystem`, `package`, `vulnerableRange`); findings stay in the blueforge report |

**`sampleId` is mandatory for us.** A user-audit score comes from a recorded run, not from the source tree.
The SDK doc describes exactly this trap (M153: five scorings of one recorded sample gave a zero-variance
window and a floor inside the noise). Set `sampleId = runId`; the ratchet then counts measurements, not
re-scorings.

**Cell identity (decision pending, recommendation below).** `audits/baseline.json` is
`auditors[auditor][dimension]`; there is no cell axis.
- *Option A (recommended for pilots):* one auditor id per cell: `learn-quest:user-audit:<app>:<language>:<l1>:<segment>`. Floors per cell × dimension fall out naturally; 9 entries per cell.
- *Option B:* one auditor per app, dimension ids `<language>.<l1>.<segment>.<dimension>`. Same number of entries, worse readability.
- At ~30+ cells a single committed `baseline.json` becomes unwieldy; revisit then (separate floors store owned by blueforge, enforced by the same ratchet code).

**Delivery.** A `forge.audit.config.ts` entry, floors via `--write-baseline` (CI never writes the file),
a `CHECKED` entry per dimension so scores reach app-dev-db, and the existing `post-suite-report.mjs` path
to mission-control. **Unknown (ask forge-dev):** how forge-dev CI gets a learn-quest artifact today (the
precedent reads a sibling `lq-operations/dist/maturity.json`), and whether a nightly job in forge-dev should
*run* user audits or only *ingest* a report produced elsewhere. Recommendation: **ingest only**, so
forge-dev CI never needs a browser stack or the learn-quest apps.

### 3.2 Execution and metering → forge-control

Three ways to run shards, in order of readiness:

| Option | State | For | Against |
|---|---|---|---|
| **A. Gitea Actions workflow** (`workflow_dispatch` + cron, matrix over shards) on the act-runners | works today | secrets, concurrency groups, timeouts, artifacts; template exists | 4 runner slots total; no per-job CPU/memory; runner problems exist (forge-git-runner "closed as not a forge-control fault") |
| **B. Compute-jobs API** (`createJob`) | schema fits ours almost 1:1 | `maxRuntimeSeconds`, `maxCostUsd`, `cost_so_far_usd`, idempotent on `idempotencyKey`, `inputs/outputs` | **unverified that any worker runs it**; doc example doesn't match the schema |
| **C. `JOB_REGISTRY` supervised loop** | works | liveness, `/api/_jobs` visibility | heavy gates (env contract, liveness regen, completeness test); built for periodic service jobs, not browser runs |

**Recommendation: A for pilots; keep the worker contract B-compatible.** The worker is a container
(`image` + `command` + `env` + `outputs`), reads a shard spec, writes `events.jsonl`, snapshots, frames,
`resource.jsonl`, `report.json`, and exits 0/1/2. Then moving from A to B is a swap of the *submit*
adapter, not a redesign. Reasoning is in the decision log (D19).

**Cost guard (hard requirement).** September's invoice (€611.80 against a €200 budget) was mostly autoscaler
burst VMs. A badly sized audit matrix could trigger exactly that. So: a hard cap on concurrent shards that
fits existing runner slots, scheduling off-peak, a per-run wall-clock and cost budget, and a rule that
**audit load must never be the reason the autoscaler provisions a VM** (confirm with forge-control how the
autoscaler decides).

**Metering.** forge-control gives host cost but not per-job usage. So the worker samples its own cgroup
(CPU-seconds, peak RSS), records wall time per step, and the report carries
`metering {wallMs, cpuSeconds, peakRssMb, costUsd}`. `costUsd = host-seconds x rate`, rate from
`infrastructure/fleet/fleet.yml` or `GET /api/hosting/cost/hetzner`. Until the sampler exists the fields are
`null`, not zero (same rule as scores). The spike's report already has the fields and writes `null`.

**Storage.** `minio-shared` on the `shared` docker network exists; **no convention exists for audit output**.
Propose `user-audit/<runId>/<shardId>/...` and ask forge-control to name the bucket and retention. Frames are
content-addressed; snapshots are the large artifacts (keep last K per shard + one per chapter).

### 3.3 Registry and display → blueforge

> **Superseded in part by section 10 (D24):** results over time live in **app-dev-db**; blueforge reads them. The new-tables proposal below is kept for the record and should not be built.

What exists is per-repo `audit_tiers` and `audit_runs` plus admin portfolio pages, with no language or
learner-segment axes. Proposal:

1. **New table** `user_audit_scores` (cell × run × dimension: `score`, `weight`, `confidence`, `runId`, `build`) and `user_audit_runs` (cell, totals, gates, metering, artifact URL), plus `POST /api/user-audit-runs` accepting `blueforge.user-audit/1`. Rationale: `audit_runs` holds iterate-run results from repo agents; cramming a matrix into it would lose the cell axes. *(Alternative: add a `kind` and a JSON column to `audit_runs`; cheaper, but not queryable by cell.)*
2. **Admin page** "Learner experience matrix" next to `/admin/portfolio`: cells as coloured tiles with score, floor, coverage, trend, cost. **Internal only** until calibrated (vision spec open question 1); a public score on a showcase site before the weights are calibrated would be a claim we cannot defend.
3. **Roll-up** via `data/repo-products.yml`: the `lq-*` repos roll up to the `lang-quest` product.
4. **Floors do not go into sidecars.** The product sidecar is `.strict()` (version bump needed) and floors already have a home in forge-dev's `baseline.json`. Revisit only if the sidecar becomes the contract for per-app targets.
5. **Optional, later:** an additive numeric `learnerExperience` summary per product in the catalog report (`blueforge.catalog-report/2`).
6. **Tier mapping:** `audit-core`'s `tier.classify` returns `DRAFT/PREVIEW/PASS/BETA/PROD` from a score. A user-audit result could contribute a tier per cell, feeding the existing `audit_tiers` dashboard. Open question for the `blueforge` owners: is tier the right abstraction for "learner experience", or does it conflate readiness with quality?

### 3.4 The blueforge-org package

`@blueforge-studio/user-audit` should **reuse `first-experience-audit`'s weighting machinery** (N/A
redistribution, per-check floors, worst-route gating) instead of re-implementing it, and emit a **versioned**
schema. The existing `screen-audit.json` has no schema/version field *(reported)*; `blueforge.user-audit/1`
fixes that for this audit. CI for the package: `.gitea/workflows/test-audits.yml` runs `packages/audits/**`
tests on PRs; publishing is `publish-changed.yml` to packr; which checks are *required* is unconfirmed.

## 4. Data flow

```
 worker container (per shard)                          canonical result
 +----------------------------------+                  +-----------------------------+
 | static check (tier 0) -> walker  | -- events.jsonl->| report.json                 |
 | (Playwright) -> scorer           |    snapshots     | schema blueforge.user-audit/1|
 | + resource sampler               |    frames        | cell, scope, dimensions,    |
 +----------------------------------+    resource.jsonl| gates, findings, metering   |
        ^ submit (Gitea matrix | compute job)           +--------------+--------------+
        | forge-control                                                |
        |                       +--------------------+-----------------+--------------+
        |                       v                    v                                v
        |            forge-dev adapter       blueforge ingest                 artifact store
        |            -> AuditorReport        POST /api/user-audit-runs        minio-shared
        |            -> audit-suite ratchet  -> user_audit_* tables           user-audit/<runId>/..
        |            -> mission-control      -> /admin matrix page
        |               /api/audits/suite    -> product roll-up (lang-quest)
        +-- budgets, concurrency cap, cost ledger (host-seconds x rate)
```

## 5. The canonical report

`blueforge.user-audit/1` (example: `tools/user-audit-spike/example-report.lq-nordic-danish-en.json`,
produced by `tools/user-audit-spike/report.mjs` from the real chapter 1-5 walk):

```
schema, generatedAt, runId, tier, build{repo, head, target}, cell{app, language, uiLocale, l1, segment,
profile, proficiency, device}, scope{chapters, declaredLessons, walkedLessons, scopeCoverage},
dimensions[{id, title, score|null, weight, nominalWeight, checkCoverage, notes[], facts{}}],
total, gates[{id, triggered, cap, reason}], finalScore, confidence,
findings[{severity, dimension, lesson, rule, reason, ownerClass, ticket}],
metering{wallMs, steps, avgStepMs, parallelism, cpuSeconds|null, peakRssMb|null, costUsd|null}
```

**First real result (v0 scoring, pilot cell lq-nordic / Danish / en / casual adult / `perfect`):** scope 123 of
520 lessons (23.7 %, chapters 1-5); completability 95.1; content quality 94.3; UI/UX 92.7; learning pace 84;
game mechanics 100 at weight 3 of 15; five dimensions `null`. **Raw total 93.9, final 60** (gate
`blocked-main-path` triggered by 6 blocked lessons), confidence 0.38. The headline is the 60, not the 93.9:
a learner stops at lesson 13 of chapter 1. Scores are v0 placeholders; the point of the artifact is the shape
and the honesty (nulls, coverage, the visible gate), not the numbers.

## 6. Ownership and coordination

Three peer Claude sessions own these repos and are running now: `control` (forge-control), `forge-dev`,
`blueforge` (also blueforge-org). **No message has been sent to `control` or `forge-dev`.** The `blueforge`
session earlier declined ownership of the screen-audit seed fix and said it owns neither `lq-operations` nor
`blueforge-org`'s user-audit design. So integration needs named owners before anyone builds:

| Owner | Questions to put to them |
|---|---|
| forge-dev | Ingest-only vs run in nightly? How does CI get a learn-quest artifact? Per-cell baseline growth: acceptable to 30 cells? Will a new third-party auditor id be accepted by mission-control `/api/audits/suite`? |
| forge-control | Does a worker consume `/api/compute/jobs` today? Bucket + retention for audit artifacts? How does the autoscaler decide to burst (so audit load can't trigger it)? Is per-job CPU/memory accounting planned? |
| blueforge | New tables + admin page vs extend `audit_runs`? Tier abstraction fit? Public display policy? Who owns `blueforge-org/packages/audits/user-audit` review? |
| operator | Who owns the persona/seed fix and `lq-operations`? Calibration owner for weights and the 60 cap? |

## 7. Phasing, with reasoning

| Phase | Deliverable | Why this order |
|---|---|---|
| **I0 (done in spike)** | `report.json` v0 schema + generator from real walk data + `AuditorReport` preview | Every adapter depends on the schema; proving it on real data first avoids three adapters on a guess. |
| **I1** | forge-dev adapter `learn-quest:user-audit` (ingest-only) + floors for the pilot cell(s) | Smallest new code: the ratchet, null semantics, and transport already exist. Delivers the operator's "gradually raise the score, enforce a minimum" goal earliest. |
| **I2** | blueforge ingest + admin matrix (internal) | Gives humans the per-cell view and product roll-up; needs I0's schema, not I1. Can run in parallel with I1. |
| **I3** | forge-control execution (Gitea matrix) + resource sampler + cost fields + artifact bucket | Local runs are enough for pilots; sharding only pays off once there are several cells or full-language walks. Also the highest cost risk, so it goes after we can see the numbers. |
| **I4** | compute-jobs submit adapter; nightly full; PR smoke gate | Only once B is verified live. |

## 8. Risks

1. **Cost blow-up** from burst VMs (see 3.2). Mitigation: concurrency cap, budgets, off-peak.
2. **Flaky runs becoming false findings.** Measured in the spike: running three chapters in parallel against one dev server produced at least five false "blocked" lessons (two-bucket sorts, drills, vocab step cap, quiz) that vanished serially. Mitigation: serial by default for scored runs; a block counts only after one serial re-run reproduces it (D16).
3. **Ratchet noise.** A run-based score has variance a tree-based audit does not. Mitigation: `sampleId`, 5-score window, deterministic walker, vision grading median-of-N later.
4. **Score gaming and premature publication.** Mitigation: internal-only display until calibrated; floors only move up through reviewed commits.
5. **Writes against production.** Rails from the proposal (allowlist, enforced in code) apply to any shard the coordinator launches.
6. **Baseline growth** at many cells (3.1).
7. **Dependency on unverified claims** (compute-jobs liveness, autoscaler behaviour, mission-control acceptance).
8. **Blast radius of a new package** in `blueforge-org`, which has no PR-gate CI (force-merge only per the umbrella doc).

## 9. Not verified

- Whether a worker consumes forge-control compute jobs; autoscaler trigger rules; required branch protections in blueforge-org; mission-control's acceptance of a new auditor id; the exact CI mechanism forge-dev uses to read learn-quest artifacts; whether `blueforge` already has per-cell tables I did not see (explorer found none).
- Everything marked *(reported)* in section 2.

## 10. Update (operator, 2026-10-06): app-dev-db as system of record, regressions per journey, journey branching

Operator direction: store user-audit results in app-dev-db on forge-control **via its API**, track results over
time (regressions vs improvements per journey), and support **journey branching**.

### 10.1 What app-dev-db is, and why it fits

Source: `blueforge/docs/plans/2026-10-05-app-dev-db-producer-contract.md` (v0.5), the forge-control tenant
development-database specs, and `forge-dev/scripts/push-devdb-reading.mjs` (a working producer). Not read:
the implementation in forge-control (`app-dev-db-core`) and any read-side API.

| Property | Consequence for the audit |
|---|---|
| Push-only **readings** over an API; no direct Postgres, ever | Matches the audit: runs are produced elsewhere and pushed. |
| Envelope `{project, repo, ref_kind, ref, commit, kind, measured_at, producer, source, payload}` | `repo` = the app under test (e.g. `lq-nordic`), `commit` = the build under test, `producer` = our worker, `source` = the run URL. |
| Append-only history + a **latest pointer per series**; ingest idempotent on `content_hash = hash(commit, canonical(payload))`; `measured_at` not in the hash | History for free. A retry of the same run dedupes; a *new* run at the same commit is a new point only if its payload differs, so every payload carries `runId` (and `sampleId`). |
| `producer` + `source` identity; `measured_at` (producer clock) vs `received_at` (server) | Attribution and late-arriving shard results are handled. |
| **Empty scope is a 422, not a zero** | Same rule as our "null, never 0". A journey that walked nothing pushes nothing. |
| **Payload cap 256 KB** (320 KB with envelope), `413` over | Readings only. Raw events, snapshots and frames go to blob storage; the reading carries a content-addressed reference. |
| **Kinds are a closed registry** in `app-dev-db-core` (additive enum; unknown kind is HTTP 400); kind pattern `^[a-z]+\.[a-z-]+$`; `series` is **server-derived per kind**, producers never send it | New kinds need agreement with forge-control, blueforge (contract) and forge-dev. `user-audit.x` is not a legal kind; `journey.x` is. |
| Floors are **repo-side** (`baseline.json`); the DB stores outcomes, not the pass condition | Consistent with D18/D20: forge-dev's ratchet enforces, app-dev-db remembers. |

**Consequence for blueforge (correction):** the dev-DB spec says blueforge stays a *latest-state consumer* and the
dev DB holds history. So blueforge's matrix page **reads app-dev-db**; no `user_audit_*` tables.

### 10.2 Mapping, in two phases

**Phase 1: reuse `audit.score`, no registry change.** `audit.score {gate, score, floor, checked}` is already
pushed by forge-dev. One reading per cell x dimension per run:
`gate = learner.<app>.<language>.<l1>.<segment>.<dimension>`, `score` (0-100), `floor` (the ratchet floor),
`checked` = steps exercised (must be >= 1). Series = gate, so each cell x dimension has its own latest pointer
and its own history. Needs a `CHECKED` entry in forge-dev's `audit-score-readings.mjs`. **To verify:** that
`gate` is unconstrained free text (the producer script shows no pattern for it).

**Phase 2: new kinds, justified by what `audit.score` cannot carry.**
- `journey.run`: one reading per journey (or branch path) run. Payload, a few KB:
  `{runId, journeyId, journeyVersion, pathId, cell{app, language, l1, segment, profile, proficiency, device},
  env, outcome, scope{declared, exercised}, finalScore, rawTotal, gates[], weightsVersion, rubricVersion,
  walkerVersion, blockedSteps[{stepId, type, reason, ownerClass}], stepCounts, metering, artifactRef{url, sha256}}`.
  Server-derived `series = <cell>/<journeyId>/<pathId>` (a `seriesOf` rule to add in `kinds.ts`).
- `journey.finding` (optional): one reading per *new or changed* finding, so "first seen / last seen / fixed in"
  is queryable without parsing run payloads.
- **No `journey.step` kind.** Per-step results are high volume (123 per chapter-run, 500+ per language) and
  are not "readings". They live in the JSONL artifact; the run reading carries the list of non-completed steps
  plus a hash of the full list.

### 10.3 Regressions and improvements per journey

A regression is only meaningful between **comparable runs**: same cell, same `journeyId` and `journeyVersion`,
same `pathId`, same `env` and `ref`, and the same `weightsVersion`/`rubricVersion` (when weights change we
re-score history from raw signals instead of comparing across versions).

Classification of run N against the previous comparable run N-1, per step and per dimension:

| Delta | Class |
|---|---|
| step completed -> blocked | **regression** (blocker if on the main path) |
| step blocked -> completed | **fix** |
| dimension score moves beyond its noise band | regression / improvement |
| step present only in N / only in N-1 | new / removed (content changed; not a regression) |
| passes and fails alternate across runs at the **same commit** | **flaky**, never a regression (D16 serial re-run) |
| new finding fingerprint | opened; absent for K runs: closed |

Attribution: each reading carries the app commit, so a regression is bounded by two commits; the content files
changed between them are the suspect list (cheap, because lesson files are the unit).
Noise bands come from the history itself (the SDK ratchet uses a 5-measurement window and warns that
re-scoring one recorded sample five times gives a zero-variance window: `sampleId` / `runId` prevents that).

**Journey identity must survive content growth.** `journeyId` names the journey definition (profile + scope
rule + branch strategy), never a list of lesson ids; step identity is the lesson id, and a lesson that appears
or disappears is "new"/"removed", not a failure.

### 10.4 Journey branching

**Yes, and the product genuinely branches.** In lq-nordic the branch sources are:

| Source | Evidence in the spike |
|---|---|
| Dialogue nodes and endings | `dialogue-meeting-someone`: `nodes`, `startNode`, `endings`, `dialogue-choice-N` testids (the walker always took choice 0, so most endings are unexplored) |
| Elective picks | `nordic_elective_picks`; chapter 1 has 12 elective files beyond the 34 map cards |
| Bosses and side quests | not yet walked |
| Onboarding choices | language, proficiency (beginner/intermediate/advanced), avatar, name |
| Learner behaviour | correct vs wrong answers (hearts, retry, give-up) per the `struggling` profile |
| Account/entitlement | free vs premium, signed-in vs guest, paywall |

**Model.** A journey is a **directed graph of decision points**, not a line. A **run** walks one path.
Identities: `journeyId` (the graph), `edgeId` (a decision point + choice, e.g. `dialogue-meeting-someone/
player-respond-greeting#1`), `pathId` = hash of the ordered decisions. Series are per path; coverage is
**edges visited / edges declared**, the same oracle as lessons visited / declared, extended to decisions.

**Where graphs come from:** generated from content (dialogue `nodes`/`choices`/`endings`, elective lists, boss
and side-quest manifests) plus the behaviour profile, as `codegen-flows` already does for screens. No hand-written
journey per language.

**Exploration strategy (default: edge coverage, not path coverage).** Cover every declared edge at least once;
exhaustive only for small graphs (a dialogue's endings); seeded random for fuzz profiles with the seed recorded;
risk-first ordering (branches touching content changed since the last run, or that failed before). Path
coverage explodes combinatorially and buys little.

**Mechanism: fork from a storage snapshot at the decision point.** Resume already requires a `storageState`
snapshot per checkpoint (spec 3.3). Taking one at every decision point lets the runner explore each branch from
the same state with no replay of the prefix, and lets branches run as separate shards in parallel. Equivalent
states (same player progress hash) are deduplicated. Caveat: this is clean for local-state apps like lq-nordic;
an app with meaningful server-side state needs a database snapshot or a disposable tenant per branch.

**Scoring across branches.** Per path scores as today. The journey score follows `first-experience-audit`'s
"worst route gates" rule for **critical** paths (the main progression) and is informational for optional
branches, so a broken optional ending is a finding without capping the whole cell. Branch-level regressions
("ending X unreachable since commit Y") are first-class findings.

**Phasing.** Dialogue endings first (small, content-derived, high value), then electives, then behaviour
branches with the `struggling` profile, then entitlement branches.

### 10.5 Risks and open questions

1. **Registry change for `journey.*`** needs forge-control (`app-dev-db-core` `kinds.ts`/`seriesOf`), blueforge (contract doc) and forge-dev agreement. Phase 1 deliberately avoids it.
2. **Read side unverified:** the contract covers writes. Querying history for a series, and what blueforge's page would call, must be confirmed with forge-control.
3. **Project identity:** readings key on a repo's `projects.id` UUID and a per-producer secret. One producer per app repo, or one for the audit service writing as each app? Needs a ruling.
4. **Cell axes live in the payload/series, not the envelope.** Do not abuse `workspace` for language.
5. **Same-commit re-runs:** identical payloads dedupe; include `runId` so intentional re-runs (flake check) are stored as separate points.
6. **Journey graphs and snapshots multiply cost.** Edge coverage and budgets (D19) apply per journey.
7. **Production safety:** branches that write (purchases, account creation) obey the write rails; only local/CI/sandbox.

## 11. Phase 1 status and what forge-dev's answers changed (2026-10-06)

**Built (spike, dry-run by default):** `tools/user-audit-spike/phase1/` — `readings.mjs` (pure mapping from
`report.json` to `audit.score` envelopes), `push-readings.mjs` (CLI), `readings.test.mjs` (12 tests, all pass).
Run on the real pilot report it produces `completability` (95.1) and `total` (60, the gated score), both
`checked 123`, floor 0 (none ratcheted yet), and lists the dimensions it chose not to push. It refuses: an empty
scope (the ingest would 422), out-of-range scores, a future `measured_at`, a missing `APP_DEVDB_*`, and a
local-dev report without `--allow-local` (so a laptop run cannot sit in shared history looking like CI).
**Nothing has been sent to the real ingest.**

**Answers from the `forge-dev` session (read from forge-control `origin/main`, forge-dev `main`):**

| Question | Answer | Effect |
|---|---|---|
| Is `gate` free text? | Yes: `z.string().min(1).max(300)`, no charset rule; series = `String(payload.gate)` verbatim. Payload is `.strict()` (only `gate/score/floor/checked`); `checked` int >= 0, `< 1` is 422 `empty_scope` | Our gate names are fine and the 4-field payload is exactly right. **Not checked by forge-dev:** how the audit radar handles gates (ask forge-control/blueforge). |
| Ingest-only into forge-dev CI? | No artifact-download mechanism exists. `auditor-learn-quest` runs a script against a sibling checkout. Only cross-repo precedent is the nightly world-map-editor job (peer checkout via `PEER_READ_TOKEN`). **Recommendation (not a ruling): do not pull browser audits into forge-dev CI; run the walk in the audited repo's own CI and push from there.** | **Revises D18.** The third-party-auditor-in-forge-dev idea is shelved; phase 1 producer pushes from the audited repo's CI. |
| Floors in forge-dev `baseline.json`? | No. That file holds forge-dev's own dimensions. Precedent: the audited repo's own `audits/baseline.json` passed via `--baseline`. | **Revises D20.** Floors live with the audited repo(s), not in forge-dev. Per app repo vs central in learn-quest: open. |
| New auditor id on `/api/audits/suite`? | `auditorId` is `z.string().min(1)`, no registry: no server change. `appId` must resolve to a tenant. | Keeps the later SDK/suite path open. |
| App-dev-db producer registration | **Operator action required:** a per-repo secret, a `gitea-actions:<repo>` id in `APP_DEVDB_PRODUCERS` on infra-1, and the project UUID. **learn-quest has none yet.** | **Blocker for any real push.** |
| Volume | 9 gates x ~30 cells = ~270 series and ~270 POSTs per run; forge-dev's own 54 per push "already feels like a lot". Suggests a total plus completability (plus any gating dimension) per cell, detail in the artifact. | **Adopted** as the default (D27). `--all` pushes everything. |
| Floor 79 | `features.executed` = 79 (`features.verified` = 22). No global floor. | Correction above. |

**Topology this implies.** Each audited app repo's CI runs its own audit and pushes with its own registered
producer (`gitea-actions:lq-nordic`, ...). Then `repo` = the app and `commit` = the build under test, so
regression attribution to a commit works without extra fields. If instead one central repo ran every audit,
the envelope `commit` would be the central repo's, and the app commit would be lost from phase 1's strict payload
(phase 2's `journey.run` payload can carry it). That is a reason to prefer per-app-repo CI.

**Open (operator):** who registers the producer(s) and issues the project UUID(s); whether floors live per app
repo or centrally; the ratchet itself (floor = one point under the observed score once a 5-measurement window
supports it) is forge-dev's SDK logic and is **not** implemented in the spike: floors are supplied by hand.

## 12. Answers from the `control` (forge-control) session (2026-10-06) and what they change

Basis stated by control: a read-only survey of forge-control `forge-git/main` (8519eaa9c) plus the producer
contract v0.5. **It could not see live prod config** (`APP_DEVDB_PRODUCERS`, `runner_autoscaler_settings`,
bucket lifecycle), so those points are *inferred*. Nothing was approved or changed.

| Topic | Finding | Effect on this design |
|---|---|---|
| **Read side** | **No read route exists** for `devdb_artifacts` / `devdb_artifact_latest`. The only HTTP surface is `POST /api/app-dev-db/ingest`; read routes and `devdb:*` scopes are "later PRs". History is direct SQL on `forge_hosting` only. The index `devdb_artifacts_series_idx` is `(project_slug, repo, ref_kind, ref, kind, measured_at)` and **does not include `series`** (a per-series history read needs a new index or a filtered scan). | **Corrects D24 in practice.** "blueforge reads app-dev-db" needs a new read route (a code PR in mission-control or app-dev-db-api, tenant-scoped via `withTenantAuth`). Until it exists, neither blueforge's matrix page nor our own regression comparison can read history from app-dev-db. |
| **`journey.run`** | Acceptable in principle; **no DDL** (`kind` is free TEXT). Code PR to `packages/app-dev-db-core/src/kinds.ts`: `KIND_REGISTRY` entry (strict zod payload, `isEmptyScope`, `derive`) + a `seriesOf` branch; tests that pin the kind list (`envelope.test.ts:19`, `repository.test.ts`, app-dev-db-api handler tests/fixtures); docs (core README, `tenant-databases.ts:122` comment, blueforge contract kind table + series section); then a mission-control deploy. Additive-only. | Phase 2 is cheap in schema, real in coordination. |
| **Dedupe gotcha** | `content_hash = sha256(commit + canonical(payload))`, **excludes `measured_at`**: two identical runs on one commit return `deduped:true` and add no row. | `journey.run` payload must carry a per-run discriminator (`runId` / `startedAt`). Phase 1 `audit.score` has no room for one (strict 4 fields): an identical re-run at the same commit adds no history row, which is acceptable and intended there. |
| **Series gotcha** | If `seriesOf` joins `cell/journeyId/pathId` with `/`, ids containing `/` become ambiguous. | Carry `cell`, `journeyId`, `pathId` as **separate payload fields** and derive the series from them, with a constrained charset (supersedes the `/`-joined sketch in 10.2). |
| **Strictness** | Payload schemas are `.strict()` (unknown key = 400); `isEmptyScope` must be defined or a zero is stored; payload cap 256 KB, transport 320 KB. | Define `isEmptyScope` for `journey.run` (`stepCounts.exercised < 1`). |
| **Retention** | **No retention or prune job** for `devdb_*` rows. | One row per run grows without bound; needs an owner/policy before volume. |
| **`audit.score` gate** | Free text, 1-300 chars, no charset rule; `gate` **is** the series, so case/whitespace variants create separate latest rows; `score`/`floor` need only be finite; `checked >= 1` else 422. | Phase 1 needs no registry change. Producer normalises (done: lowercase slug, test added; 13 tests pass). |
| **Producer identity** | Bearer token **bound to a tenant, not a project or repo**. Directory = env `APP_DEVDB_PRODUCERS` (one JSON line `[{id, tenantId, secret}]`, secret 32-512 chars; **one malformed record closes ingest with 503**). Issuing is manual (`openssl rand -hex 24`, forge vault, Gitea Actions secret `APP_DEVDB_PRODUCER_SECRET`, edit `/etc/forge/mission-control.env` on infra-1, roll mission-control); no rotation endpoint. Operator-gated prod actions; control will not do them. | **Reopens the topology question.** One audit-service producer **can** write for many repos and projects in its tenant (envelope `project` = `projects.id`; 404 unknown, 409 ambiguous_slug, 403 tenant_mismatch). So *where audits run* (each repo's CI vs a central worker) is independent of *who the producer is*, and the producer sets `repo` and `commit`, so a central runner can still report the app's build commit. D28 stays as the default but is no longer forced by identity. |
| **Project id** | `GET /api/projects/:identifier` (id or slug) on hosting-api returns the id, visible only within scope. **Unverified** whether `lq-nordic` is a `projects.slug` (not only an apps slug). | Needs checking before any push. |
| **Compute** | `/api/compute/jobs` routes and consumers exist but are "Built, not deployed" (`docs/ARCHITECTURE.md`); compute-autoscaler is `DRY_RUN=true`. | **Option B is out** for now; Gitea Actions matrix (Option A) is the only live path. D19 stands, with the B-compatible worker contract kept as a cheap hedge. |
| **Autoscaler** | Container tier scales on memory-weighted queued demand; the burst tier (`ci-vm-*`) buys only when the container tier is capped and backlogged, counting only jobs whose `runs-on` is empty or a subset of labels burst hosts advertise; a queue-age trigger buys at >= 120 s wait if `queueAgeBuyMode` is `live` (default `shadow`; live value unknown). Brakes: `hostMaxEphemeral`, 6-host batch max, 60 s cooldown, failure backoff. | To keep audits from being the trigger (control's inference, **untested**): do not use `ubuntu-latest` or `ci-*` size labels; use a **dedicated exclusive label** (like `ci-small-exclusive`; existence of that profile live is unverified). With no runner advertising the label jobs queue forever. `weight 0` alone does not cap spend; set the profile's `maxHosts` low and `strategy.max-parallel`. Priority 1 in `ci_repo_priorities` orders but does not stop jobs counting as demand. **Ask the operator for live `burstMix`, `hostMaxEphemeral`, `queueAgeBuyMode` before the first big matrix.** |
| **Artifacts** | No lifecycle rule on any bucket. Buckets: `forge-artifacts`, `forge-cache` (infra-1) plus per-app buckets on minio-shared. Gitea Actions retention: logs 7 days, upload-artifact 30 days. Nightly backup mirrors to R2 without `--remove` (only grows). The only blob convention is a *spec* (`payload.blob = {bucket, key, sha256, bytes, contentType}`), unimplemented; contract v0.5 has no blob field. | Do not rely on Gitea artifacts for history (30 days). Store reports (small) and blobs ourselves, content-addressed, and put `artifactRef {bucket, key, sha256, bytes}` in the strict `journey.run` payload. Bucket + retention need an operator decision. |
| **Metering** | **Memory only, no CPU.** `ci_job_runs.peak_memory_mb` / `peak_working_set_mb` from a 15 s cAdvisor sampler keyed by task id, **standing builders only**: burst VMs and containers spawned through the docker socket are not attributed. Per-job `--memory=Ng` caps exist (e.g. 7 GB on a 1-runner cx33, 3.5 GB on a 2-runner cx33; OOM kills the job container, not the host). | Our own sampler stands (`memory.peak` + `cpu.stat`), reported in the payload. Size the browser shard under the per-job memory cap. |

### What this changes in practice

1. **Regression tracking cannot lean on app-dev-db reads yet.** Interim: the runner compares against the previous run's `report.json` pulled from our own (small, long-retained) report store; app-dev-db remains the readings record and the future source once a read route exists.
2. **Two code PRs sit on forge-control, both additive:** a read route (+ a `series` index) and the `journey.run` kind. Neither is started; control built nothing and will wait for a request.
3. **Operator actions are now a concrete list** (see the decision log, D35).
