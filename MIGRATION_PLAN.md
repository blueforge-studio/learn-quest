# LearnQuest → blueforge-stack Migration Plan

> **Status: PLANNING ONLY.** No migration code has been started. This document captures the audit findings, the proposed 4-phase approach, and the open decisions for the user.

## Goal

Drop every legacy SaaS dependency from the LearnQuest ecosystem and migrate to the BlueForge first-party stack (`@blueforge-studio/service-*` packages + Hetzner hosting):

- **Supabase** → `@blueforge-studio/service-database` + `@blueforge-studio/service-auth`
- **Firebase** (Assets, Error-Tracker in `lq-core`) → `@blueforge-studio/service-storage` + `@blueforge-studio/service-error-tracking`
- **Vercel** (18 deployments) → Hetzner via `forge-control` + `blueforge.config.ts`
- **Resend** (email) → `@blueforge-studio/service-email` (already adopted in `lq-site`)

## Current SaaS Footprint (audit 2026-06-28)

| Project | Pkgs | Supabase | Firebase | Vercel-dep | vercel.json | Live? |
|---------|-----:|---------:|---------:|-----------:|------------:|-------|
| `lang-quest/` (container) | 14 | 14 | 0 | 0 | 0 | Not deployed |
| `life-quest/` (container) | 19 | 17 | 0 | 0 | 10 | Not deployed |
| `school-quest/` (container) | 8 | 6 | 0 | 0 | 6 | **Live (200)** on Vercel |
| `books-platform/` | 21 | 2 | 0 | 1 | 0 | Not deployed |
| `lingua-quest/` | 17 | 3 | 0 | 1 | 1 | **Live** on Vercel + Hetzner |
| `lq-site/` | 5 | 1 | 0 | 1 | 1 | **Live** on Vercel |
| `lq-core/` | 57 | 7 | 2 | 0 | 0 | (library, non-deployable) |
| `lq-tools/` | 28 | 2 | 0 | 0 | 0 | (library, non-deployable) |
| `lq-operations/` | 1 | 1 | 0 | 0 | 0 | (ops, non-deployable) |
| **TOTAL** | **170** | **53** | **2** | **3** | **18** | |

### Live production surface

- `lq-site-three.vercel.app` → `learnquest.blueforge.studio` (live, 200)
- `linguaquest-app.vercel.app` → `app.linguaquest.blueforge.studio` (live, 200)
- 6 `school-quest` subject apps (`lq-math`, `lq-science`, `lq-history`, `lq-geography`, `lq-reading`, `lq-writing`) — Live (200)
- 10+ `life-quest` apps — Live (200)

## Why Migrate

1. **First-party stack only** — The rest of the BlueForge portfolio (21 apps already migrated) runs on `@blueforge-studio/service-*` + Hetzner. learn-quest is the largest remaining hold-out.
2. **No lock-in** — Supabase/Firebase/Vercel = vendor lock-in + per-seat pricing. Hetzner + first-party = fixed cost.
3. **Shared patterns** — Every other `*-os` app uses the same `blueforge-stack` migration recipe. Migration is mostly a copy-paste exercise once the first app lands.
4. **Audit trail clean** — Once migrated, the banned-patterns audit will report 0 violations for learn-quest.

## Proposed 4-Phase Approach

### Phase 1: Categorize (no code changes)

Before any migration work, classify every one of the 170 sub-packages into one of three buckets. This avoids migrating dead code or low-value tooling.

| Bucket | Definition | Action |
|--------|------------|--------|
| **A — Worth migrating** | Live app with users, revenue potential, or production deployment | Migrate to blueforge-stack |
| **B — Internal tooling** | Test agent, scaffolding scripts, build utilities | Defer; can stay on Supabase for now |
| **C — Dead / exploratory** | Undeployed, abandoned, or experimental | Archive or delete |

**Recommended first step:** Run the categorization audit before any code changes. The pilot below depends on bucket (A) being identified.

### Phase 2: Pilot (`lq-math`)

Pick the smallest Live school-quest subject app (`lq-math` is a strong candidate — single Vite SPA, Supabase-backed, port 3200) and migrate it end-to-end:

1. Replace `@supabase/supabase-js` with `@blueforge-studio/service-database` + `@blueforge-studio/service-auth`
2. Move `vercel.json` deployment to Hetzner via `blueforge.config.ts`
3. Wire env vars (`DATABASE_URL`, `AUTH_BASE_URL`, etc.)
4. Verify with smoke test on the assigned Hetzner port
5. Document the recipe for fan-out

This is the proof-of-concept. Until this lands, we don't know if the per-domain `service-*` packages cover every Supabase feature that `lq-math` uses.

### Phase 3: Codify + Fan Out

Once the pilot recipe works:

1. Apply the recipe to the other 5 school-quest subject apps (`lq-science`, `lq-history`, `lq-geography`, `lq-reading`, `lq-writing`)
2. Apply to the 10+ life-quest subject apps
3. Apply to `lingua-quest` (Turborepo — more complex, defer until school-quest done)
4. Apply to `books-platform` (Stripe backend — coordinate with `clinic-os` / `proposal-os` patterns)

### Phase 4: `lang-quest` Sweep

The 14 language group apps share a single pattern (each is a thin Vite wrapper over `lq-core`). Once `school-quest` is fully migrated, sweep `lang-quest` as a single batch:

1. Pick one language (e.g. `lq-nordic`) as the pilot — same recipe as `lq-math`
2. Codify the wrapper-app pattern
3. Apply to all 14 groups in parallel

### Deferred: `lq-core`, `lq-tools`, `lq-operations`

These are library/ops packages, not deployable apps. They can stay on Supabase until their consumers are migrated (no point migrating them in isolation). After Phase 4, revisit and migrate them as a single sweep.

## Per-domain Service Mapping

| Legacy | Replacement | Status |
|--------|-------------|--------|
| `@supabase/supabase-js` (`createClient`) | `@blueforge-studio/service-database.createDatabaseService()` | Drop-in (see `office-platform` and `clinic-os` migration patterns) |
| Supabase Auth (`signInWithOAuth`, session cookies) | `@blueforge-studio/service-auth` + `forge-auth` OAuth proxy | Requires forge-auth app registration per project |
| Supabase Storage (`supabase.storage.from(...).upload`) | `@blueforge-studio/service-storage.createStorageService()` | Already adopted in `lq-site` |
| Firebase (`libs/common/assets`, `libs/infra/error-tracker`) | `@blueforge-studio/service-storage` + `@blueforge-studio/service-error-tracking` | Drop-in |
| Vercel deployment (`vercel.json`) | Hetzner via `blueforge.config.ts` + `forge-control` | Pattern proven in `clinic-os`, `landscape-os`, `3d-interior` |
| Resend email | `@blueforge-studio/service-email` | Already adopted in `lq-site` (per `lq-site/package.json`) |

## Audit Script Gap

`blueforge-org/scripts/audit-banned-patterns.py:discover_repos()` only walks repos that have a top-level `package.json` OR `.git`. Workspace containers (`lang-quest/`, `school-quest/`) have neither at the container root — the script needs to recurse to discover their sub-packages. Proposed patch:

```python
# Add to discover_repos()
if (p / "pnpm-workspace.yaml").exists():
    out.append(p); continue
if sum(1 for _ in p.glob("*/package.json")) >= 2:
    out.append(p)  # Ghost monorepo / workspace container
```

Without this patch, `learn-quest/` is invisible to the portfolio-wide audit (it was missed in the 2026-06-27 sweep that reported 1116 violations; learn-quest never showed up).

## Open Decisions for the User

1. **Which pilot?** Recommend `lq-math` (smallest Live school-quest app). Alternative: `lq-history` (largest content library, ~979 lessons — better stress test).
2. **Bucket B first?** Some scripts in `lq-tools/` and `lq-operations/` use `@supabase/supabase-js` for content sync. Migrating them requires coordination with the deploy workflow. Recommend deferring until Phase 3.
3. **lang-quest sequencing?** All 14 groups in one batch, or one group at a time? Recommend one (pilot) then batch.
4. **`blueforge.config.ts` adoption?** `lingua-quest` and `books-platform` already use it. school-quest / life-quest / lang-quest don't have a top-level config — they need one to drive the Hetzner deploy generator.
5. **Drop Supabase connection?** Or keep Supabase as a fallback (read-only) during migration? Recommend hard cutover per-app with a kill switch via env var (`DATABASE_PROVIDER`).

## Related Docs

- [README.md](README.md) — Overview + repository type breakdown
- [lq-core/docs/VERIFICATION.md](lq-core/docs/VERIFICATION.md) — Current deployment health
- [lq-core/docs/INTEGRATION_PROPOSAL.md](lq-core/docs/INTEGRATION_PROPOSAL.md) — Design doc for Vercel deployment pattern
- [lq-core/docs/SUBJECT_APP_ARCHITECTURE.md](lq-core/docs/SUBJECT_APP_ARCHITECTURE.md) — Subject app architecture
- [lq-operations/README.md](lq-operations/README.md) — Ops + scaffolding scripts
- `blueforge-org/scripts/audit-banned-patterns.py` — Portfolio audit script (needs ghost-monorepo patch)
- `blueforge-org/packages/utilities/README.md` — Per-domain `service-*` package catalog