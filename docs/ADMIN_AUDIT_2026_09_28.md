# LearnQuest admin — audit & direction (2026-09-28)

**Status:** audit done (read-only code survey plus live probes); direction proposed. The
perspectives of forge-dev, forge-control and rollouts are folded in.
**Scope:** lq-core admin libs + apps/web, lingua-quest quest-editor + collab-server,
lq-tools admin-tools, lq-operations, platform-api.

## Findings

### 1. None of the admin UI is reachable in production

- About 51k LOC of admin exists: screen-admin (30k), screen-admin-analytics (8.6k),
  screen-admin-design (9.5k), admin-shared (3k), plus debug overlays and tester mode.
- It is mounted only in `lq-core/apps/web` (`/admin/*`, 29 screens), whose config says
  `"kind":"dev"`, "NOT for production", and it has no domain.
- `createApp()` (every deployed app) mounts no admin, tester or debug UI.
  `nordic…/admin/dashboard` returns 200 but serves the landing SPA.
- lq-nordic's `createAdminTests` e2e only checks "not 5xx", so it **passes vacuously** (SPA fallback).
- `LessonMapScreen.tsx:177` still links to `/admin/lessons`.

### 2. Access control is client-side only

- `useAdminPermissions` reads `player.adminRoles` from the client player object.
- `DebugAdminRoles.tsx:28` lets any user grant themselves roles.
- Five routes (`feedback`, `design`, `design/audit`, `books`, `rpg/*`) have no `requirePermission`.
- platform-api has **no admin endpoints and no role middleware**.

### 3. Admin works only on mock data

- `fluentDb` uses IndexedDB/localStorage under `VITE_USE_MOCK_DB` (every env except nordic prod).
  Otherwise it uses a `pg` adapter that vite aliases to a no-op stub in the browser.
- Screens present fabricated numbers as real:
  - `Math.random` analytics (AdminAnalyticsService ×2, RevenueAnalyticsService).
  - `activeUsers = users × 0.6`.
  - Random chart bars.
  - `MOCK_SUBMISSIONS` in book moderation ("replace with Supabase"; Supabase has been removed).
  - `MOCK_APPS` in asset audit.
- The asset-audit write buttons POST to an `/api/admin/assets/*` proxy (localhost:3123) that nothing serves.

### 4. The quest editor is public

`editor.linguaquest.blueforge.studio` is live (verified 2026-09-28). `AuthGuard` covers only
`/profile` and `/settings`; the editor at `/` has none (`quest-editor/src/main.tsx:71`). The
exposure is limited: it edits local files, and the collab server requires a JWT and defaults to
`ws://localhost:3040`. It is still an unauthenticated internal tool on a public host.

### 5. Quality

About 180 test files, mostly mock-mode.

| Area | State |
|---|---|
| Styling | `@learnquest/ui` components, but 764 hardcoded gray/white classes and zero glass-design use (the fleet moved to glass in lesson-ui 0.6) |
| i18n | admin is good (`admin.json` in 16 locales); debug, tester and quest-editor have none |
| Accessibility | analytics has 0 `aria-` attributes (charts have no text alternative) |

Duplicates:

- `adminUtils` ×3
- `AdminAnalyticsService` ×2
- `configAdmin` ×2
- `TesterContext` ×2 (the lib copy is consumed by nothing)
- `ContentEditorService`/`useContentEditor` ×2–3
- feature flags ×2 and impersonation ×2

Layering inversion: `libs/app/config/{shadow,game,limits}.ts` import
`@learnquest/screen-admin/…/ConfigurationService`, so core config depends on an admin screen lib.

### 6. Overlap with the platform

Positions from forge-dev and forge-control:

| lq-core piece | Platform owner | Action |
|---|---|---|
| deploy/app health, env/vault, fleet, storage buckets | forge-control (mission-control at control.blueforge.studio, hosting-api, `forge` CLI) | **link/embed only.** "A second writer of the same state is how drift incidents happen." |
| health-scan, screen-audit (lq-tools admin-tools), coverage/audit ratchets | forge-dev (auditors, audit-radar → mission-control) | retire the local copies; publish sidecars + screen-audit configs instead |
| error tracking (apps/web errorTracking, BaseAlertService, `@learnquest/error-tracker`) | forge-error-tracker (Phase 7A, not deployed yet) | freeze; migrate when 7A deploys |
| feedback triage | hosting-api `POST /api/feedback` (D5, #1636) + forge-control T4 review queue | send tester feedback there |
| A/B experiments, notification sender | marketing-os | delete, or move there when needed |
| run/artifact history, content health over time | **developer DB** (forge-control #1622, forge-cloud#142 M0–M8; ingestion spec by rollouts in flight) | API-only via hosting-api; never direct Postgres |

rollouts confirmed that LearnQuest **content inventories** fit the developer DB as a new
`content-inventory` producer family. That covers lesson coverage per chapter × interest facet,
asset-audit state (e.g. lq-history needs-regen) and image score averages, keyed
`(source, ref/sha, kind, measured_at)` and deduplicated by content hash. lq-tools'
`coverage-audit` / `ai-audit-images` become producers once the ingest API exists. That also
gives mission-control a `content_debt` series.

## Direction

**Admin owns product-domain operations only:** content, lessons, electives, testers, learners and
households. Anything that would be the same in every product belongs to the platform.

**Proposed shape:**

- One deployed **LearnQuest Admin** app, built from the existing screens rather than new ones.
- Behind forge-auth.
- Every read and write goes through new `platform-api /api/admin/*` routes with server-side role
  checks: forge-auth API-key scopes, and visibility-before-role as hosting-api does
  (`assertProjectVisible` before `requireRole`).

v1 surfaces:

1. **Content:** a chapter/lesson browser across apps, with coverage, facets, elective pools and
   `aiDraft` review queues. It is the review step for the ch16–20 expansion and the elective
   lessons.
2. **Assets:** read-only audit state (from the developer DB once ingestion lands, from audit
   JSONs until then) with a "queue regen" action that calls the lq-tools pipeline. It replaces
   the `MOCK_APPS` AssetAudit screen.
3. **Testers:** mint and revoke tester links via forge-auth (`createTesterLink({appId, groups})`),
   pick `blueforge.testing.yml` flags, see feedback from `/api/feedback`. This is where the
   **tester overlay** plugs in (mounted per app via `createApp`; see below).
4. **Learners and households:** support lookups (no impersonation outside mock mode).
5. **Reading-aids shorthand editor:** the one deferred item of the reading-aids plan.

Delete or quarantine: the analytics and revenue screens (until real events exist), A/B
experiments, notification sender, health-scan/screen-audit copies, the `DebugAdminRoles`
self-grant outside mock DB, and the vacuous admin e2e.

## Tester overlay (rollouts' `@blueforge-studio/tester-overlay`)

- Mount it lazily from `createApp()`: `mountTesterOverlay({ appId, … })`.
  - `appId` is the per-app id (`= blueforge.testing.yml id:`), **not** the product id.
  - Fail-closed: with no valid signed tester link it produces zero UI and zero behaviour.
- The anchors are already fleet-wide (lq-core#102 `quest-*` app-dom anchors).
- The per-app work is a `blueforge.testing.yml` catalog of real surfaces only.
- Pilot: **lq-reading** (Reading Aids layers, L1 variants, lazy image generation).
- The in-app `TesterContext` stays for admin/dev use. Delete its unused lib copy.
- rollouts reviews the mount PR.

## Plan

| Phase | What | Exit |
|---|---|---|
| **A0 — now (security + honesty)** | AuthGuard on the quest-editor `/`; `requirePermission` on the 5 unguarded routes; DebugAdminRoles mock-only; badge or remove every mock-data screen; delete the vacuous `createAdminTests` and the `/admin/lessons` link | editor requires login; no fabricated numbers on screen |
| **A1 — tester overlay pilot** | createApp mount (web-app minor) + lq-reading `blueforge.testing.yml` | a signed link on reading shows the overlay; an unsigned one shows nothing |
| **A2 — server-side admin** | platform-api `/api/admin/*` + role middleware (forge-auth scopes); admin data via the API instead of the `pg` stub | a forged `adminRoles` gets 403 from the server |
| **A3 — LearnQuest Admin app** | deploy (domain `admin.quest.blueforge.studio`?) with the v1 surfaces 1–3; glass theme + a11y pass on the reused screens | content review of the ch16–20 pilot happens there |
| **A4 — consolidation** | merge the duplicates; move ConfigurationService into app-config/app-services; retire the platform-duplicate tools; content-inventory producers to the developer DB once ingestion lands | lq-core admin LOC drops substantially; no second writers |
