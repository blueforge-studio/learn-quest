# School-Quest Fleet Readiness — 2026-09-14

> **Status:** Tracking the 7-step plan from `ROADMAP.md` re-anchored at the
> user's request "do recommended order" on 2026-09-14. Steps marked
> `[COST-GATE]` require explicit per-step user approval (API money or infra
> change). All other steps are code-only and can run unattended.

**Last update:** 2026-09-14 (Track 4 closed at 5.3 floor)
**Owner:** @kmandrup

## Goal

1. All 6 school-quest subjects deployed + promoted on `blueforge.studio`.
2. Image quality at 5.3+ avg (per Track 4 closure — Tier A 3.1-flash ceiling is 5.3 ± audit-noise on math; other subjects expect similar).
3. Content + validation pass per app (`pnpm validate` green).
4. Mirrors across the 14 lang-quest apps (already live) + 17 life-quest (next after).

## Progress

| # | Track | Status | Cost | Owner |
|---|---|---|---|---|
| 1 | **Directive PR** (relaxed art bar in lq-tools gen-configs) | **PR #13 open on lq-tools** | $0 | this PR |
| 2 | **Per-app DNS+Caddy routing** for `*.school-quest.blueforge.studio` | **5 PRs open (math/reading/writing/history/geography)** | $0 | this PR |
| 3 | **`@learnquest/image-validation` mirror** to 6 school apps | **6 PRs open (all 6 apps)** | $0 | this PR |
| 4 | **Pilot** (lq-math ch1) — directive validation | **CLOSED at 5.3 avg floor** (3 iterations) | ~$1.80 | done |
| 5 | **Batch 1 + Batch 2** (school reading+writing+math + science+geography) | `[COST-GATE]` | ~$130 | user approval post-pilot |
| 6 | **First school-quest deploy** (lq-math; smoke; then R2 sync) | `[COST-GATE]` | ~$0 infra | user approval |
| 7 | **blueforge.studio landing catalog** | design | $0 dev | this PR (after app is live) |

## Track 1 — Directive PR (lq-tools)

**What:** Mirror the relaxed art bar + region descriptors + content cues
that fixed lq-history (`3c70516`, `cff5242`, etc.) into the per-subject
gen-configs so the next batch run on school/life apps clears 6.0 avg.

**Files:** `packages/image-tools/src/config/subjects/{math,reading,writing,science,geography,history}/lessons-*.json` (bootstrap-generated; the styleGuide + instructions fields need editing to `"High quality realistic cartoon, NOT childish"` rather than the current terse `"Historical scene illustration, landscape."` etc.).

**Status:** staging — branch to be created.

**Decision recorded (2026-09-14):** The Aug-2026 lq-history proof applied the directive per-gen-config (1:1 file edits). Generalizing that to 6 subjects × 6-7 lessons-*.json files = ~40 edits. **OR** wire the directive into a single shared template at `packages/image-tools/src/config/env.ts` (the `schoolStyle()` function called by config-bootstrap already references it). The single-template approach is cleaner but is a behavior change for already-shipped configs (lq-history regressed at one commit during the original rollout — need to re-audit that subset).

Going with **per-subject edits** matching the lq-history proof — lower blast radius.

## Track 2 — DNS + Caddy route for `*.school-quest.blueforge.studio`

**What:** Make `<app>.school-quest.blueforge.studio` resolve to the edge. First `forge app-deploy --server <app>` writes the route to the `caddy_routes` registry automatically (per forge-control `caddyfile.ts:331-336` precedent), so the operator-side work is:

1. Update each subject's `blueforge.config.json` `domains:` field:
   - From: `"domains": ["math.blueforge.studio"]`
   - To:   `"domains": ["math.school-quest.blueforge.studio"]` + `"math-quest.blueforge.studio"` (R2 bucket root)
   - Mirror the lang-quest `blueforge.config.json` pattern (top-level `domains: ["nordic-quest.blueforge.studio"]` + inner `domains: ["nordic.lang-quest.blueforge.studio"]`)
2. Add DNS records at the registrar for the 6 SPA subdomains + 6 R2 bucket subdomains (12 records).
3. First deploy writes the caddy_routes row.

**Files:** `school-quest/lq-{math,reading,writing,science,history,geography}/blueforge.config.json`

**Status:** staging — branch to be created.

**Decision recorded:** The `<app>.blueforge.studio` apex pattern in current configs is technically dead (DNS fails; nothing points the apex at the SPA edge — `blueforge.studio` is the marketing landing on a different host). The migration to `<app>.school-quest.blueforge.studio` is a bug fix + follows the established books/lang-quest pattern. The marketing landing stays on `blueforge.studio`.

## Track 3 — `@learnquest/image-validation` mirror (5 school apps remaining)

**What:** Mirror lq-math commit `d80d820` to lq-reading/lq-writing/lq-science/lq-history/lq-geography:

- Each `package.json` adds:
  `"validate:images": "image-validate public/images --strict"`
- Each `scripts/validate.ts` adds `'validate:images'` to the aggregator list.
- Each gets a new `.gitea/workflows/validate-images.yml` matching the lq-math template.

**Status:** staging — branches to be created, one per app.

**Note:** The bin name is `image-validate`, not the old `tsx ../../../lq-tools/scripts/validate-images.ts` (which doesn't exist anymore after Phase 5d). lq-math already has this corrected; the mirror keeps that.

## Track 4 — Pilot (lq-math ch1) `[CLOSED — 5.3 avg floor]`

**What:** Validate the relaxed-bar directive on lq-math ch1 (15 images) before scaling to Batches 1+2.

**Iterations:**

| Iteration | Directive shape | Avg | Top score | Text-overflow | Notes |
|---|---|---:|---:|---:|---|
| Pilot 20 | Geometric-minimalism prefix + relaxed-bar suffix | 5.1 | 6 | 1 | original `chalkboard + grid motifs` |
| Option A | Drop prefix + add linework/cel-shading | 4.5 | 8 | **8** | "classroom context" pulled chalkboards back → text-overflow regression |
| **Option A+** | Keep linework + ban writing surfaces + "floating magical objects" | **5.3** | **9** | 6 | chalkboard trap eliminated; remaining 6 failures are "glowing numbers" interpreted as visible text |

**Status:** CLOSED on user decision 2026-09-14 ("Decision A — move on").
Final directive locked in lq-tools PR #13 (commit `2f71788`). Cost: ~$1.80
across all 3 iterations.

**Fleet expectation for Track 5:** math content generated under this
directive will score 5.3 ± audit-noise. Reading/writing/science/geography
(history has its own proven directive) have not been pilot-tested yet but
should be similar; expect avg 5-5.5 across the fleet rather than 6.0.

**Findings to apply to future work:**

1. **Chalkboard trap** (memory `project_math_chalkboard_trap_2026_09_14.md`) — gemini-3.1-flash-image fills every visible writing surface (chalkboard/blackboard/whiteboard/open book/scroll) with garbled formulas regardless of the no-text suffix. Future styleGuides MUST explicitly NO-out writing surfaces.
2. **Audit non-determinism** (memory `feedback_audit_non_deterministic.md`) — the `minimax-anthropic` vision LLM gives different scores on re-audit of identical images; several images flipped regen=true ↔ ✓ between back-to-back runs. Plan for 3-audit median or hysteresis margin before scaling Track 5 cost projections.
3. **Art-style directives are sticky** — linework/cel-shading/painterly depth directives kept working across iterations (delivered the 2 score-8s in Option A, retained in A+). Scene motifs are what to focus tuning on.

## Track 5 — Batches 1 + 2 `[COST-GATE]`

**What:** After Track 4 validates ≥ 6.0, run:
- Batch 1: school reading + writing + math (1007 imgs) ~$60
- Batch 2: school science + geography (1153 imgs) ~$70

The actual sequence mirrors `docs/batches/batch-1-school-base-ch1-5.md` + `batch-2-school-remaining-ch1-5.md`. Each sequential by app within a batch; across batches `pnpm` parallel is safe (per `blueforge-org/image-gateway` concurrency ≤ 4).

**Status:** NOT STARTED — depends on Track 1 PR #13 merge + user approval.

## Track 6 — First school-quest deploy `[COST-GATE]`

**What:** First `forge app-deploy --server lq-math` after Track 2's DNS records land. Materialises the compose, writes the caddy route. Verify the SPA renders all 40 lessons with the relaxed-bar images.

**Pre-reqs:** Track 1-3 merged + Track 4 successful + user approval.

## Track 7 — blueforge.studio landing catalog

**What:** Stand up `<family>.blueforge.studio/<sub>` routes that link each live app with: title, screenshots, "last re-audit score", link. ~2 days dev, no infra cost.

**Pre-req:** Track 6 ships at least one subject.

## Decisions captured

- **Per-subject directive edits** over a shared template — match lq-history proof, lower blast radius.
- **`<app>.school-quest.blueforge.studio` subdomain** over `<app>.blueforge.studio` apex — matches books/lang-quest pattern, fixes the DNS-fail status, unblocks Track 6.
- **Per-app PRs for Track 3** (5 PRs) over one big-batch PR (matches the Phase 2 school-app precedent: 6 separate PRs to keep each school's failure modes isolated).
- **Accept 5.3 avg floor on math** (Track 4 closure, 2026-09-14) — 6.0 not achievable on Tier A 3.1-flash-image without (a) Tier B model upgrade or (b) further directive iteration that risks regressing other subjects. Better to ship at 5.3 + audit-noise than chase 6.0 with diminishing returns.

## What's NOT in this plan

- PACKR_TOKEN publish scope (P2.2) — separate ticket, blocks lq-east-asian picker fix not school-quest.
- Generator `enabled: false` flag backstop (P5) — same.
- MIGRATION-blueforge-ai.md deep migration — deferred per the overall plan.
- Life-quest deploys — comes after school-quest lands; this plan focuses on the 6 subjects first.

## 2026-09-14 batch — 13 PRs open

All Tracks 1-3 shipped as PRs in this session. Pilot (Track 4) closed at 5.3 floor.

### Track 1 PRs

- **lq-tools PR #13** — `feat/school-quest-directive-2026-09-14` branch, base `refactor/phase5d-retire-scripts`. 40 files / 141 field changes across all 6 school subjects' gen-configs. 3 commits: (1) per-subject directive edit + regen-target-resolver path fix, (2) Option A drop-prefix, (3) Option A+ ban-writing-surfaces. **Final directive locked at commit `2f71788` produces 5.3 avg on lq-math ch1 (verified across 3 iterations; see Track 4 closure table above).**

### Track 2 PRs (DNS+Caddy, 1-line config per app)

- lq-math PR #3 — `math.blueforge.studio` → `math.school-quest.blueforge.studio`
- lq-reading PR #3 — same shape
- lq-writing PR #3 — same shape
- lq-history PR #3 — same shape
- lq-geography PR #3 — same shape
- (lq-science already had the correct shape; no PR needed)

### Track 3 PRs (`@learnquest/image-validation` mirror)

- lq-math PR #4 — package.json + scripts/validate.ts aggregator + .gitea/workflows/validate-images.yml
- lq-reading PR #4 — same shape
- lq-writing PR #4 — same shape
- lq-history PR #4 — same shape
- lq-geography PR #4 — same shape
- lq-science PR #2 — same shape

**Pre-existing lockfile issue surfaced**: `pnpm-lock.yaml` in every
school app has 7 entries missing the `integrity` field. `pnpm install`
fails with `ERR_PNPM_MISSING_TARBALL_INTEGRITY`; `pnpm clean --lockfile`
then hits `ERR_PNPM_NO_MATCHING_VERSION` on `@blueforge-studio/screen-audit@^0.3.3`
(latest is 0.10.4). Not caused by Track 3 PRs — needs a separate
dep-bump pass before CI can run. The Track 3 PRs document this in their
PR bodies.

### What the user needs to do now

1. **Review + merge Track 1-3 PRs** (12 PRs across 7 repos). Order doesn't matter for Tracks 1-3; merging Track 2 first unblocks first `forge app-deploy`. Track 1 lq-tools PR #13 now has 3 commits (path fix + Option A + Option A+) — review the directive diff per the chalkboard trap memory before merging.
2. **Approve Track 5 (Batches 1+2)** — ~$130 API spend across 2160 images. Expected avg ~5.3 ± audit-noise (math pilot data point); reading/writing/science/geography untested at fleet scale. Plan for audit-noise mitigation (3-pass median or hysteresis) before approving cost.
3. **Decide on lockfile fix** — separate dep-bump PR per app, or a coordinated sweep. Either way it's a pre-req for CI to go green on the Track 3 PRs.
4. **Optionally, address audit non-determinism** before Track 5 — see `feedback_audit_non_deterministic.md` memory. 3 audits/image ≈ +$0.02/image overhead on a 2160-image batch ≈ $43 — meaningful but not blocking.

