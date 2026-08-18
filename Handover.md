# Handover — Household-Goals Phase 9, Narrative Engine & Monorepo Consolidation

> Window: 2026-05 → 2026-07-13. Supersedes the 2026-04-20 regional-vocab handover
> (archived below the fold in git history).

## TL;DR

Four parallel tracks landed since the regional-asset sweep:

1. **household-goals Phase 9** (lq-core) — a parent↔kid financial-literacy loop, gated
   behind an env flag, ~40 commits, not yet pushed.
2. **Narrative engine** (lingua-quest) — a visual quest editor with PixiJS rendering and
   Yjs CRDT collaboration; Phases 0–3 shipped on `main`.
3. **lingua-quest consolidation** (this session) — `backend`→`api`,
   `collab-validator`→`collab-server`, Turborepo, config-driven Docker/deploy. On a fresh
   branch, not yet pushed.
4. **books-platform maturation** — E2E moved to Vitest+supertest, config-driven Docker,
   OpenAPI + admin/author endpoints, API-backed content pipeline from MinIO.

Underlying all of it: the **on-prem foundation** is now the default — Postgres + Drizzle +
forge-auth (SSO). Supabase paths are dev/legacy only (`VITE_DB_PROVIDER=postgres`).

---

## 1. household-goals Phase 9 (lq-core)

Parent↔kid financial literacy: kids build a wishlist and earn credits by completing goals;
parents grant credits and adjust balances. Domain logic lives in
`libs/app/household-goals` (server-side, pure); UI lives in `libs/screens/household-goals`.

**Domain surface** (`@learnquest/household-goals`):

| Export | Purpose |
|--------|---------|
| `goalEvaluator` | Pure — evaluates an `ActiveGoal` against `EvaluationRow`s → progress + status |
| `rewardGrantService` | Atomic parent→kid credit grant; emits `goalEventChannel` events |
| `wishlistService` | Kid wishlist CRUD with anti-spam cooldown; kid-friendly error copy |
| `balanceService` | Parent + kid balance rows; exposes cooldown state |
| `activityEvaluatorDb` | Drizzle-backed `EvaluatorDb` adapter (keeps evaluator pure) |
| `householdGoalsNotifications` | Notification fan-out (screen-reader announcements, digests) |
| `goalEventChannel` | Realtime pub/sub for live balance / grant updates |
| `periodBounds`, `Cadence` | Weekly / monthly / custom period helpers |

**Architecture invariants** (do not break):
- `goalEvaluator` takes `db: EvaluatorDb` so it unit-tests without a real DB.
- All writes funnel through `rewardGrantService` / `wishlistService` — never direct DB writes from UI.
- Anti-spam state lives in the balance row, not client memory (survives reloads).
- Error-code → kid-friendly copy happens at the service boundary (`wishlistErrorMessages`), not in components.

**UI shipped:** `WishlistScreen` (affordability + cooldown), `BalanceAdjustmentScreen`
(parent, focus mgmt + aria-describedby), `GoalCompleteToast` (ephemeral overlay),
"Goals today" pill on kid dashboard, credit balance under kid avatars in the profile picker.

**Env gate:** the whole feature is gated by `VITE_HOUSEHOLD_FEATURE_ENABLED` in `apps/web`.
When unset, `$locale/household/*` routes are not registered — the `householdRoutes` flag in
`libs/common/app-shell` reads it and conditionally mounts the screens. **Gotcha:** a missing
flag silently disables all household routes and produces ~9 false E2E smoke failures. Check
`.env.example` and restart the dev server after toggling.

**i18n:** 30 keys per locale under `household_goals.*`, scaffolded for 15 locales with
English fallback + `_translation_pending` flag.

**DB:** migration `libs/infra/database/drizzle/0008_household_goals.sql`; verify with
`scripts/verify-household-migration.mjs`. Behavioral tests added for the 3 previously
untested repositories. Playwright smoke template at `apps/web/e2e/household-goals.spec.ts`.

**Docs:** `lq-core/docs/design/family-profile-rollout.md` (rollout phases, env gate,
screen registry), `docs/qa/household-goals.md`, `docs/runbooks/apply-0007-households.md`.

---

## 2. Narrative engine (lingua-quest, `main`)

A visual quest editor + collaborative runtime for authoring branching NPC dialogue.

- **P1** — visual builders, DAG layout, simulation mode, edge/node ops, multi-locale, AI repair.
- **P2** — quest mode, PixiJS renderer, GPU shaders, flag-flow authoring.
- **P3** — Yjs CRDT collaboration (two-way binding) with a **server-side collab-validator**
  broadcasting validation status over awareness.
- **quest-constraint** package — the solver feedback loop (choice conditions, quest-level adapter).
- Content: **Mediterranean Odyssey** (Italian Roman quest) wired into chapters/locations/`DEFAULT_GAMES`
  with Flux portraits + scene backgrounds.

Roadmap + status: `lingua-quest/Handover.md` (branch-local) and the phased roadmap commit
`1112db9`.

---

## 3. lingua-quest consolidation (THIS SESSION — not yet pushed)

Committed on a new branch **`feat/backend-api-consolidation`** (branched from the pushed
`screen-audit/iterate-2026-05-05T14-12-14` branch to preserve its 6 feature commits —
chapter splits + landing redesign):

- **`apps/backend` removed** → routes/services/repositories folded into **`apps/api`**
  (game routes mounted at `/api/game` behind JWT middleware, consistent with `/api/players`).
- **`apps/collab-validator` removed** → merged into **`collab-server`** as in-process
  `src/validator/index.ts`.
- **Turborepo adopted** — `turbo.json` pipeline; root scripts rewritten to `turbo` + per-app `--filter`.
- **Config-driven Docker + Hetzner deploy** — `blueforge.config.ts` single source of truth;
  `scripts/generate-dockerfiles.ts` emits per-app `Dockerfile` + `blueforge.json` for
  web/api/collab-server/quest-editor/site. Adds `docker-compose.prod.yml`, `port-registry.yml`,
  Caddy config, and Hetzner deploy/DNS scripts under `deploy/`.

Verified: no dangling imports to the deleted apps (only intentional origin comments remain).

App layout post-consolidation:

| App | Port | Type | Description |
|-----|------|------|-------------|
| `apps/api` | 3000 | Node/Express | REST — content, players, game state, achievements |
| `apps/collab-server` | 3040 | Node/Hono | y-websocket collab + in-process validator |
| `apps/web` | — | Vite SPA | LinguaQuest PWA |
| `apps/quest-editor` | — | Vite SPA | Visual dialogue-graph editor |
| `apps/site` | 3500 | Next.js | Marketing site |

---

## 4. books-platform maturation

- E2E: replaced the bash script with a **Vitest + supertest** suite; admin sub-routers re-wired.
- **Config-driven Docker** — `blueforge.config.ts` single source of truth; per-app
  `Dockerfile` + `blueforge.json`; ESM runtime fixes (`.js` extensions, `import.meta` guards).
- **OpenAPI spec** + admin/author endpoints + stripe-api wiring + generated API clients.
- **Content pipeline** — API-backed scene/chapter/meta loading from **MinIO**; book admin
  routes + storage service + manifest upload; `upload-book-assets` migrated R2-direct → API.
- Growth: freemium, referrals, genres, i18n, author app, landing page (WIP `cb0d2c0`).

Deployed on Hetzner box 1: `books-platform-frontend-1` (8080, one nginx for all 7 SPAs),
`books-api-1` (3009), `stripe-api-1` (3001). `books-image-worker` not yet deployed.

---

## 5. Documentation sweep (this session)

Fixed staleness across every repo README/CLAUDE:
- **lq-tools** — package count 27→28; replaced phantom `image-gen-config`/`dev-utils` with real `content-migration`/`utils`.
- **lq-core** — documented `libs/app/` (app-hooks/services/types/config/household-goals) + Phase 9 deep-dive; corrected backend line to Postgres+Drizzle+forge-auth.
- **books-platform** — README + CLAUDE synced to 7 SPAs + 3 backends + 5 packages + Hetzner table + turbo commands.
- **lingua-quest** — README rewritten for the consolidated 5-app / 6-package layout; `turbo.json` added.
- **root README** + **life-quest CLAUDE.md** — refreshed (these dirs are not git repos).

**Security note:** four `.npmrc` files under lq-core (`libs/common/{app-shell,ui}`,
`libs/screens/{household-goals,household}`) contained a **live packr registry auth token**
(admin/publish scope, exp ~2026-09). They were **not** committed; added `.npmrc`, `*.tgz`,
`test-results/`, and `*.tsbuildinfo` to gitignore to prevent recurrence.

---

## Pending pushes (all committed, awaiting approval)

Pushes are held because they affect shared state — **pushing lq-core to `main` triggers a
packr publish via GitHub Actions**, and lang/subject apps pick up the new `@learnquest/*`.

| Repo | State | Push target |
|------|-------|-------------|
| `lq-tools` | 2 unpushed commits (README fix + prior e2e runner) | `main` |
| `books-platform` | 1 unpushed doc-sync commit | `main` |
| `lq-core` | 70 unpushed commits (Phase 9 + docs + gitignore) | `main` — **triggers publish** |
| `lingua-quest` | new branch `feat/backend-api-consolidation`, 5 new commits over 6 pushed | push branch, open PR |

## Open tasks

1. **Push decisions** — confirm order; lq-core push will publish packages, so verify the GH
   Action + downstream app pickup afterward.
2. **lingua-quest branch strategy** — the consolidation sits on top of the `screen-audit/*`
   auto-named branch's 6 commits. Decide whether those + the consolidation land on `main`
   together or split.
3. **household-goals server gaps** — streak events / realtime enrichment flagged as
   unenriched in commits `1c7b81e8` / `7d3c5e16`; server-side follow-up needed before GA.
4. **household i18n** — 14 non-English locales are English-fallback stubs (`_translation_pending`).
5. **Verify migration 0008** applied in each environment via `verify-household-migration.mjs`
   before enabling `VITE_HOUSEHOLD_FEATURE_ENABLED` in prod.
6. **books-image-worker** — built but not deployed to Hetzner.

## Key pointers

| Path | What |
|------|------|
| `lq-core/libs/app/household-goals/` | Phase 9 domain logic (pure) |
| `lq-core/libs/screens/household-goals/` | Phase 9 UI screens |
| `lq-core/libs/common/app-shell` | `householdRoutes` flag + shell wiring |
| `lq-core/docs/design/family-profile-rollout.md` | Rollout phases + env gate |
| `lingua-quest/blueforge.config.ts` | Single source of truth for Docker/deploy |
| `lingua-quest/apps/collab-server/src/validator/` | In-process collab validator |
| `books-platform/blueforge.config.ts` | Single source of truth for Docker/deploy |

---
Generated 2026-07-13 at end of session.
