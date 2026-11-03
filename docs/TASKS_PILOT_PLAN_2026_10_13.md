# App tasks — pilot plan (Spec 06)

Spec: `forge-cloud/docs/specs/06-app-tasks.md` (merged). Pilot definitions: `books-platform/blueforge.tasks.yml` (merged, #114, read by nothing yet).

## Readiness gates (all pilots wait on these)
| # | Gate | Owner | State 2026-10-13 |
|---|---|---|---|
| G1 | forge-control auth path (forge-auth `fk_` keys) | forge-control | #2027 merged |
| G2 | `app_tasks` / `app_task_runs` tables + routes | forge-control | #2028 open; **operator applies `packages/hosting-database/drizzle/20261013150000_app_tasks/migration.sql` by hand** |
| G3 | CLI: `forge task list/show/run/logs`, `forge tasks sync/register` | forge-control | PR 3 not started |
| G4 | `tasks` schema in `blueforge-org/packages/utilities/sidecar-schemas` (+ publish + fleet pin bump) | unowned | not started; needed for the sidecar source and the `ci(sidecars)` script-path check |
| G5 | host-agent work intake (increment 2) | forge-control | not started; **until then nothing executes**, runs are recorded `queued`/`rejected` |

Registration (`PUT`) is operator-only, so pilots register via `forge tasks register ./blueforge.tasks.yml --app <slug>` with an operator key until G4 lands.

## Pilot 1 — books-platform (`books-api`)
Definitions exist. Order of enabling once G1–G3 + G5 are in:
1. `db-schema-drift` (read-only) and `db-migrate` preview — first real runs; replaces the ssh one-liners that the permission classifier blocks. Needs the scripts in the `books-api` image (`packages/database-pg/scripts/*.mjs`).
2. `db-migrate` (writes-prod) — gated on the preview.
3. `publish-story|interactive|adventure` (writes-prod, dry-run mapped). **Blocked on image contents**: the scripts upload `apps/lq-*-book/public/data/books/**` from the repo; those files are not in the `books-api` image. Options: ship content in the image (wrong coupling), or wait for `ephemeral` mode (increment 3, one-shot container with the repo checkout). Recommendation: ephemeral.
Success test (spec §11): the 2026-10-13 flow — diagnose `books.featured` drift, publish a book — reproducible with `forge task` only, from a machine with no clone.

## Pilot 2 — lq-core `platform-api`
Candidate tasks (names from `services/platform-api/package.json` and `lq-core/scripts/`):
- `db-migrate` — `pnpm --filter @learnquest/database db:migrate`; writes-prod; needs the same pending-migrations preview as books-platform (generic, reuse the script).
- `verify-household-migration` — `scripts/verify-household-migration.mjs`; read-only; companion to `docs/runbooks/apply-0007-households.md`.
- Lazy-asset pilot operations (flag flips go through the shared dev DB feature flags, not tasks).
Gap: `platform-api`'s Dockerfile builds `services/platform-api` only; root `scripts/` is not in the image. Same decision as books-platform (image contents vs ephemeral).
Real DB is `postgres-shared/app_learnquest_core` (not the sidecar); tasks must read `DATABASE_URL` from the container env.

## Pilot 3 — lq-operations (candidate for ephemeral mode, not container-exec)
`r2-prune.ts`, `reaudit-stale-apps.sh`, `align-assets.ts`, `reconcile-*-refs.ts` run against R2/MinIO and the repos from an operator machine; lq-operations is not a deployed app, so there is no container to exec into. These are the case for **increment 3 (ephemeral)**: do not register them before that exists.

## Beyond learn-quest (propose to the owners; not started)
- **forge-git**: `unstick-ci.sh --list` (read-only) and the actual unstick (writes) — the operator already runs these ad hoc; good fit for read-only + confirm.
- **forge-control** itself: `pnpm liveness:generate`, `forge sidecar-migrate` are repo-local generators, not runtime tasks; skip.
- **packr-registry**: operator token mint — needs a secrets story first.
Confirm with each repo's session before drafting definitions.

## Sequencing
1. G2 migration applied (operator) → G3 CLI → register books-platform tasks (operator key) → run the two read-only tasks end to end as a smoke test.
2. G5 host-agent intake → first real `db-schema-drift` run → `db-migrate` preview → `db-migrate`.
3. G4 schema → switch pilots from `register` to sidecar sync on deploy; add the `ci(sidecars)` path check.
4. Increment 3 (ephemeral) → publish tasks; lq-operations tasks.
5. Pilot 2 (lq-core) after books-platform has run in anger for a few weeks.

## Open
- Who owns G4 (the `tasks` schema in blueforge-org)? I can write it; publish/pin bump is the slow part.
- Image-contents vs ephemeral for the publish and lq-core scripts (recommend ephemeral).
