# School-Quest Fleet Readiness — 2026-09-14

> **Status:** Tracking the 7-step plan from `ROADMAP.md` re-anchored at the
> user's request "do recommended order" on 2026-09-14. Steps marked
> `[COST-GATE]` require explicit per-step user approval (API money or infra
> change). All other steps are code-only and can run unattended.

**Last update:** 2026-09-14
**Owner:** @kmandrup

## Goal

1. All 6 school-quest subjects deployed + promoted on `blueforge.studio`.
2. Image quality at 6-7 avg minimum (post-directive).
3. Content + validation pass per app (`pnpm validate` green).
4. Mirrors across the 14 lang-quest apps (already live) + 17 life-quest (next after).

## Progress

| # | Track | Status | Cost | Owner |
|---|---|---|---|---|
| 1 | **Directive PR** (relaxed art bar in lq-tools gen-configs) | **PR #13 open on lq-tools** | $0 | this PR |
| 2 | **Per-app DNS+Caddy routing** for `*.school-quest.blueforge.studio` | **5 PRs open (math/reading/writing/history/geography)** | $0 | this PR |
| 3 | **`@learnquest/image-validation` mirror** to 6 school apps | **6 PRs open (all 6 apps)** | $0 | this PR |
| 4 | **Pilot 100** (lq-math ch1 rpg; validate ≥ 6.0 avg) | `[COST-GATE]` | ~$5 | user approval |
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

## Track 4 — Pilot 100 `[COST-GATE]`

**What:** After Track 1 lands, run a 100-image regen pass on lq-math ch1 rpg + a sampling of scenes. Goal: validate ≥ 6.0 avg on the relaxed-bar scale.

**Cost:** ~$5 at hybrid Tier A 3.1-flash + Tier B gpt-image-1 medium (`docs/batches/00-program-overview.md`).

**Status:** NOT STARTED — needs user approval to spend the $5 against
`GEMINI_API_KEY`. Will stage the script invocation + parameter set so the
user can review before the cost is committed.

## Track 5 — Batches 1 + 2 `[COST-GATE]`

**What:** After Track 4 validates ≥ 6.0, run:
- Batch 1: school reading + writing + math (1007 imgs) ~$60
- Batch 2: school science + geography (1153 imgs) ~$70

The actual sequence mirrors `docs/batches/batch-1-school-base-ch1-5.md` + `batch-2-school-remaining-ch1-5.md`. Each sequential by app within a batch; across batches `pnpm` parallel is safe (per `blueforge-org/image-gateway` concurrency ≤ 4).

**Status:** NOT STARTED — depends on Track 4 + user approval.

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

## What's NOT in this plan

- PACKR_TOKEN publish scope (P2.2) — separate ticket, blocks lq-east-asian picker fix not school-quest.
- Generator `enabled: false` flag backstop (P5) — same.
- MIGRATION-blueforge-ai.md deep migration — deferred per the overall plan.
- Life-quest deploys — comes after school-quest lands; this plan focuses on the 6 subjects first.

## 2026-09-14 batch — 12 PRs open

All Tracks 1-3 shipped as PRs in this session. Awaiting review + merge
before Track 4 (Pilot 100) burns any API money.

### Track 1 PRs

- **lq-tools PR #13** — `feat/school-quest-directive-2026-09-14` branch, base `refactor/phase5d-retire-scripts`. 40 files / 141 field changes across all 6 school subjects' gen-configs. Mirrors the lq-nordic proven form ("High quality realistic manga/fantasy style, NOT cartoonish, professional game art..."). Per-subject edits (not a shared template) for blast-radius control.

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

1. **Review + merge Track 1-3 PRs** (12 PRs across 7 repos). Order doesn't matter for Tracks 1-3; merging Track 2 first unblocks first `forge app-deploy`.
2. **Approve Track 4 (Pilot 100)** — ~$5 API spend. I'll stage the script invocation + parameter set for review.
3. **Decide on lockfile fix** — separate dep-bump PR per app, or a coordinated sweep. Either way it's a pre-req for CI to go green on the Track 3 PRs.

