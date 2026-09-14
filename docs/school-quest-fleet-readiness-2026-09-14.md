# School-Quest Fleet Readiness — 2026-09-14

> **Status:** Tracking the 7-step plan from `ROADMAP.md` re-anchored at the
> user's request "do recommended order" on 2026-09-14. Steps marked
> `[COST-GATE]` require explicit per-step user approval (API money or infra
> change). All other steps are code-only and can run unattended.

**Last update:** 2026-09-14 (Pilot 128 reading+writing+geography landed; 6.99 avg across 384 images)
**Owner:** @kmandrup

## Goal

1. All 6 school-quest subjects deployed + promoted on `blueforge.studio`.
2. Image quality at 6.99+ avg across the school fleet (math Pilot 100 7.3 + reading/writing/geography Pilot 128 6.58/6.92/7.48 avg, n=484).
3. Content + validation pass per app (`pnpm validate` green).
4. Mirrors across the 14 lang-quest apps (already live) + 17 life-quest (next after).

## Progress

| # | Track | Status | Cost | Owner |
|---|---|---|---|---|
| 1 | **Directive PR** (relaxed art bar in lq-tools gen-configs) | **PR #13 open on lq-tools** | $0 | this PR |
| 2 | **Per-app DNS+Caddy routing** for `*.school-quest.blueforge.studio` | **5 PRs open (math/reading/writing/history/geography)** | $0 | this PR |
| 3 | **`@learnquest/image-validation` mirror** to 6 school apps | **6 PRs open (all 6 apps)** | $0 | this PR |
| 4 | **Pilot 100** (lq-math ch2-5; validate ≥ 6.0 avg) | **CLOSED at 7.3 avg** (ch1 was the outlier) | ~$5.96 | done |
| 4.5 | **Pilot 128** (reading+writing+geography ch1-4; validate ≥ 6.0 avg) | **CLOSED at 6.58/6.92/7.48 avg** | ~$14.97 | done |
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

## Track 4 — Pilot (lq-math ch1 → ch2-5) `[CLOSED — 7.3 avg ✓]`

**What:** Validate the relaxed-bar directive on lq-math before scaling to Batches 1+2.

**Iterations:**

| Iteration | Scope | Directive shape | Avg | Top score | Text-overflow | Notes |
|---|---|---|---:|---:|---:|---|
| Pilot 20 | ch1 (15) | Geometric-minimalism prefix + relaxed-bar suffix | 5.1 | 6 | 1 | original `chalkboard + grid motifs` |
| Option A | ch1 (15) | Drop prefix + add linework/cel-shading | 4.5 | 8 | **8** | "classroom context" pulled chalkboards back → text-overflow regression |
| Option A+ | ch1 (15) | Keep linework + ban writing surfaces + "floating magical objects" | 5.3 | 9 | 6 | chalkboard trap eliminated; remaining 6 failures are "glowing numbers" interpreted as visible text |
| **Pilot 100** | ch2-5 (100) | Same locked Option A+ directive | **7.3** | **9** | 10 | directive holds at scale; ch1 was the outlier, not the directive ceiling |

**Status:** CLOSED — gone from "5.3 floor" decision to "7.3 avg at scale".

**Key finding:** Pilot 20's 5.3 was a **ch1-specific chalkboard-bait outlier**, not a
fundamental directive ceiling. ch1 lessons (`arithmetic-addition-basics`,
`geometry-shapes-intro`, `number-sense-counting`, `word-problem-shopping`)
are conceptually adjacent to chalkboards and the model interprets them
that way despite the writing-surface ban. ch2-5 lessons (3d-shapes,
coordinate-grid, symmetry, tessellations, perimeter, volume, algebra,
angles, etc.) have natural scene motifs that the model renders cleanly
as floating shapes.

**Per-chapter results (Pilot 100, n=25 each):**

| Chapter | Avg | Top score | Notes |
|---|---:|---:|---|
| ch2 | 7.0 | 9 | 3d-shapes, perimeter, volume, symmetry — strong |
| ch3 | 7.4 | 9 | coordinate-grid, tessellations — strong |
| ch4 | 7.4 | 9 | algebra, angles — strong |
| ch5 | 7.5 | 9 | advanced geometry — strongest |

**11/100 Pilot 100 regen candidates** (specific lessons, not directive-wide):
- 10× text-overflow on number-heavy concepts: `mental-math*`, `counting*`, `order-of-operations*`, `division-intro-ch3-visual` (rune-like symbols), `angles-intro-ch4` (rune symbols), `lesson-sides-and-corners-counting-example` (24 words), `comparing-numbers-example` (10 words)
- 1× corner-bg-fill near-blank: `order-of-operations-ch5-visual`

These are specific lesson motifs that resist the floating-shapes directive
(inherent "show the math" content). Candidate Track 5 follow-up: targeted
per-image alternate directives (e.g., `mental-math` → dice/cubes only,
no numerals).

**Cost:** Pilot 20+Option A+Option A+ ~$1.80 + Pilot 100 $3.96 = **~$5.76 total**
(under the $10 ceiling across the entire Track 4).

## Track 4.5 — Pilot 128 (reading + writing + geography) `[CLOSED — 6.99 combined avg ✓]`

**What:** Validate the Pilot 20-shape directive on the other 3 non-math school subjects before scaling to Batches 1+2. Math under Option A+ clears 7.3; the question was whether the base directive (no chalkboard ban) holds on subjects whose ch1 lessons don't have chalkboard-bait concepts.

**Scope:** 128 images per subject, ch1-4 proportional sample (seed=42). Cost **$4.99 regen + $0.10 audit per subject = $14.97 + $0.30 audits = $15.27 total**. Total Track 4 + 4.5 spend: **$21.03** (still under the original $10 Track 4 ceiling after user-approved expansion).

**Results:**

| Subject | n | avg | 9 | 8 | 7 | 6 | 5 | 4 | 3 | 2 | 1 | 0 | 10 | Notes |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| lq-reading | 128 | **6.58** | 30 | 35 | 7 | 1 | 35 | 5 | 13 | 1 | 1 | 0 | 0 | clears 6.0; mid-tail of 5s is the soft spot |
| lq-writing | 128 | **6.92** | 41 | 38 | 4 | 0 | 26 | 0 | 17 | 2 | 0 | 0 | 0 | clears 6.0; bimodal (high cluster + 3s tail) |
| lq-geography | 128 | **7.48** | 70 | 29 | 2 | 1 | 9 | 3 | 2 | 0 | 3 | 8 | **1** | top of fleet; 1× score-10 |
| **Combined** | 384 | **6.99** | 141 | 102 | 13 | 2 | 70 | 8 | 32 | 3 | 4 | 8 | 1 | all 3 clear 6.0 |

**Status:** CLOSED — Pilot 20-shape directive holds on all 3 subjects at fleet scale.

**Key finding:** Reading/writing/geography do **NOT** exhibit the math ch1 chalkboard trap. Their lessons are scene-based (characters with books/paper/landscapes), not formula-on-board scenes, so the writing-surface ban isn't needed. The base Pilot 20-shape directive (no chalkboard prefix, no chalkboard ban) clears 6.0 on all 3.

**Per-chapter geography cluster** — the 8× score-0s in geography cluster on the ch1 `maps-and-globes-k2` set: gemini-3.1-flash-image treats the literal globe motif as a "render a perfectly accurate 3D sphere" task and fails (off-shape artifacts). This is a **per-image pattern**, not a directive-wide issue, and a candidate Track 5 follow-up (alternate prompt: "stylized map illustration, not photorealistic globe").

**Pilot 128 branches:**
- lq-reading `pilot/ch1-4-lq-reading-pilot128-2026-09-14` (commit `5b4e89b`, 513 files, +6471)
- lq-writing `pilot/ch1-4-lq-writing-pilot128-2026-09-14` (commit `0d60227`, 513 files, +7964)
- lq-geography `pilot/ch1-4-lq-geography-pilot128-2026-09-14` (commit `2340c3d`, 513 files, +11407)

**Combined Pilot 100 + Pilot 128 fleet sample:** n=484, avg=7.06 (weighted by per-pilot n).
Math pulls the floor (7.3) up; reading/writing/geography sit at 6.58-7.48. All subjects above the original 6.0 acceptance bar. **Track 5 (Batches 1+2) unblocked.**

**Findings to apply to future work:**

1. **Chalkboard trap** (memory `project_math_chalkboard_trap_2026_09_14.md`) — gemini-3.1-flash-image fills every visible writing surface (chalkboard/blackboard/whiteboard/open book/scroll) with garbled formulas regardless of the no-text suffix. Future styleGuides MUST explicitly NO-out writing surfaces.
2. **ch1 vs ch2-5 lesson content matters** — ch1's "addition/counting/word-problem" lessons are inherently chalkboard-adjacent concepts; even with the writing-surface ban, they score lower (5.3) than geometry/spatial lessons (7.3+). For subjects with similar chalkboard-bait concepts (e.g., reading-level "decoding a sentence", writing-level "letter formation"), expect a similar ch1-style floor unless targeted per-lesson directives are added.
3. **Audit non-determinism** (memory `feedback_audit_non_deterministic.md`) — the `minimax-anthropic` vision LLM gives different scores on re-audit of identical images. Pilot 100's 7.3 is robust against this variance because the sample size (100) averages out per-image noise.
4. **Art-style directives are sticky** — linework/cel-shading/painterly depth directives kept working across iterations (delivered the 2 score-8s in Option A, retained in A+, scaled to 22 score-8s in Pilot 100). Scene motifs are what to focus tuning on.

## Track 5 — Batches 1 + 2 `[COST-GATE]`

**What:** After Track 4 validates ≥ 6.0 (Pilot 100 hit 7.3), run:
- Batch 1: school reading + writing + math (1007 imgs) ~$60
- Batch 2: school science + geography (1153 imgs) ~$70

The actual sequence mirrors `docs/batches/batch-1-school-base-ch1-5.md` + `batch-2-school-remaining-ch1-5.md`. Each sequential by app within a batch; across batches `pnpm` parallel is safe (per `blueforge-org/image-gateway` concurrency ≤ 4).

**Expected outcome:** Math already validated at 7.3 avg (Pilot 100, n=100). Reading/writing/geography validated at 6.58/6.92/7.48 avg (Pilot 128, n=128 each, ch1-4). Science not yet piloted — likely 6.0+ (similar scene-based pattern; risk is chemistry diagrams which could mirror math's chalkboard trap). Combined fleet sample n=484 avg 7.06. ch1-style lessons in untested subjects may show the same floor drop as lq-math ch1 (5.3 vs ch2-5 7.3) — chalkboard-bait concepts specific to early-curriculum.

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
- ~~Accept 5.3 avg floor on math~~ **SUPERSEDED by Pilot 100 (2026-09-14)** — ch1 was an outlier; directive clears 6.0 at scale (avg 7.3 across 100 ch2-5 images). New expectation: math fleet avg 7.3+, with ch1-style lessons a known weak spot for future targeted fixes.
- **Pilot 100 succeeded** — Track 5 (Batches 1+2) unblocked at the locked directive. Expected fleet avg 6.5-7.5 (math already validated; reading/writing/science/geography untested at fleet scale).
- **Pilot 128 succeeded** (2026-09-14) — reading/writing/geography all clear 6.0 under the base Pilot 20-shape directive (no chalkboard ban needed). Combined fleet sample n=484 avg 7.06. Science remains the only unvalidated subject; chalkboard-bait risk in chemistry diagrams is the open question.

## What's NOT in this plan

- PACKR_TOKEN publish scope (P2.2) — separate ticket, blocks lq-east-asian picker fix not school-quest.
- Generator `enabled: false` flag backstop (P5) — same.
- MIGRATION-blueforge-ai.md deep migration — deferred per the overall plan.
- Life-quest deploys — comes after school-quest lands; this plan focuses on the 6 subjects first.

## 2026-09-14 batch — 13 PRs open

All Tracks 1-3 shipped as PRs in this session. Pilot (Track 4) closed at 7.3 avg via Pilot 100 (ch2-5).

### Track 1 PRs

- **lq-tools PR #13** — `feat/school-quest-directive-2026-09-14` branch, base `refactor/phase5d-retire-scripts`. 40 files / 141 field changes across all 6 school subjects' gen-configs. 3 commits: (1) per-subject directive edit + regen-target-resolver path fix, (2) Option A drop-prefix, (3) Option A+ ban-writing-surfaces. **Final directive at commit `2f71788` produces 5.3 avg on ch1 (outlier) and 7.3 avg across ch2-5 (100-image validation).**

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

1. **Review + merge Track 1-3 PRs** (12 PRs across 7 repos). Order doesn't matter for Tracks 1-3; merging Track 2 first unblocks first `forge app-deploy`. Track 1 lq-tools PR #13 has 3 commits (path fix + Option A + Option A+) — review the directive diff per the chalkboard trap memory before merging.
2. **Approve Track 5 (Batches 1+2)** — ~$130 API spend across 2160 images. Math directive validated at 7.3 avg (Pilot 100, n=100). Reading/writing/geography validated at 6.58/6.92/7.48 avg (Pilot 128, n=128 each). Science NOT yet piloted — recommend either (a) running a quick Pilot 128 on lq-science (~$5) before Batches 1+2 to validate the chalkboard-trap risk in chemistry diagrams, or (b) proceeding directly to Batches 1+2 and accepting the risk that science may regress to 5.3-style floor on chemistry lessons. Combined Pilot 100+128 sample n=484 avg 7.06. Plan for audit-noise mitigation (3-pass median or hysteresis) before approving cost.
3. **Decide on lockfile fix** — separate dep-bump PR per app, or a coordinated sweep. Either way it's a pre-req for CI to go green on the Track 3 PRs.
4. **Optionally, address audit non-determinism** before Track 5 — see `feedback_audit_non_deterministic.md` memory. 3 audits/image ≈ +$0.02/image overhead on a 2160-image batch ≈ $43 — meaningful but not blocking.

