# learn-quest

Monorepo for language learning + books platforms.

**Remote:** not git-managed as a single repo — contains `lang-quest` and `books-platform` subdirectories
**Live:** `lang-quest.blueforge.studio` + `questbooks.blueforge.studio` (live-handrolled via `deploy/*` scripts; retro-fit pass in Phase 6)
**Banned patterns:** not yet audited (expected low — long-running production)

## Asset resolution — read before counting or auditing images

**`docs/ASSET_RESOLUTION.md`** — read it before writing any script that counts
images, or before concluding an app's imagery is missing, unwired or clean.
Four traps it documents, each of which has already produced a wrong answer:

- **Two resolution systems**, not one: lazily-loaded per-domain asset maps
  (`index.json`, via `AssetService`/`AssetMapProvider`) *and* path-convention
  refs in lesson content (`images/`, `/_shared/`, `@regional/`) resolved
  override → shared → raw.
- **`public/data/asset-map.json` is an empty scaffold** (`EMPTY_ASSET_MAP`) that
  nothing reads. Its being empty proves nothing.
- **Naive counts overstate ~5x.** `glob(recursive=True)` follows the symlinked
  shared vocabulary pools (and `_regional/universal`, which points outside the
  repo); `find` does not. Responsive `--<size>` files are derived variants.
  lq-nordic is 1,690 base images, not the 9,496 a naive glob reports.
- **`status: "active"` means generated, not audited.** Real audit state is
  `metadata.audit.auditedAt`. "0 flagged" nearly always means never measured.

**CDN layout (`lq-assets`)** — one bucket for *every* app (14 language
families + school + life); an R2 custom domain binds to one bucket, so
per-app `<slug>-assets` names are unreachable and always wrong. Four tiers:
`_regional/<region>/` (cross-repo pool), `_shared/` (non-group apps),
`<group>/_shared/images/` (the 14 group apps — their trees are NOT
interchangeable), and `apps/<locale>/` where a group app's locale is
`<group>/<language>`, e.g. `apps/romance/french/`. The bucket is public —
`curl` a key before claiming a tier is empty. Push prefixes in
`blueforge.config.json` must mirror the read path; they silently disagreed
until 2026-09-01. Never put working files under `public/` — it is published.

To verify wiring, run each app's `tests/unit/content-integrity.spec.ts`
(`@learnquest/unit-core`) rather than hand-rolling a resolver — but note it does
*not* cover the per-domain asset maps.

## Asset gen-configs (image regen pipeline)

- History and gotchas of the lq-tools gen-config / regen pipeline (config layout per app group, `--chapter=N` regen, batch orchestration in `@blueforge-studio/image-gen`, Gemini 3.1 + Batch API default): see [`docs/ASSET_GEN_CONFIGS_STATE_2026_08.md`](docs/ASSET_GEN_CONFIGS_STATE_2026_08.md). Read it before touching regen configs.

## Lessons from 2026-09-21 session (lazy-asset pilot + fleet fix)

### Patterns worth remembering
1. **`pg` lazy-load on client-side services** — `SessionService.recordSessionEnd`, `rewardGrantService.grantForCompletedGoal`, `balanceService.{creditBalance,screenTimeAvailableToday}` in `lq-core`. Without the lazy `await import('@learnquest/database/postgres')`, Rollup bundles `pg` into the Vite SPA entry chunk because `pg` doesn't declare `sideEffects: false`. Symptom: blank page with `class extends value undefined` (EventEmitter) or `Buffer is not defined`. The lib-level fix (`lq-core#76`) supersedes per-app vite treeshake workarounds like `lq-reading#18` for the `app-shell 0.15` fleet.
2. **Workspace-mode deploy hits `apps/web`** — even when `apps.web.kind: dev`, forge-control's workspace deploy mode bundles EVERY app in `blueforge.config.json`'s `apps` block. The platform-api deploy is blocked until `apps/web` builds. `lq-core#74` (replace `%VITE_LANGUAGE_LABEL%` in `apps/web/index.html`) + #75 (export `./limits`) + #77 (export `./game` + `./routeDependencies`) cover the three concrete build failures as of 2026-09-21. New failures will surface as new subpath-export bugs in `@learnquest/*` libs.
3. **Every `@learnquest/*` lib needs subpath-export audits** when adding new files. Pattern: a file at `libs/app/config/src/limits.ts` was imported as `@learnquest/app-config/limits` but the `package.json` `exports` map was never updated. Build fails with `Missing "./limits" specifier`. Same bug class affected `./game` and `./routeDependencies`. The audit script: `grep -rn "from .@learnquest/<lib>/<subpath>" libs apps services | sort -u` against the lib's `exports` map.
4. **Pilot gate flip runbook** — full sequence in `learn-quest/docs/LAZY_ASSET_HANDOVER_2026_09_19.md`. Operational state: `forge app list learnquest-core` shows `api` on app-3; env vars go through `forge env set <project> <key> <value>` (three positional args); deploy via `forge app-deploy platform-api --server --no-wait` from `lq-core`'s main; verify `curl https://api.quest.blueforge.studio/api/health` lists `/api/assets/lazy` in the routes.


Current status, open work and operator actions live in the dated `docs/STATUS_*.md` files (latest first).

## Agentic surface

This repo carries cross-repo agentic files at the root `.claude/agents/` so
that any session — operator or spawned subagent — has the same deploy / CI /
publish context:

- `.claude/agents/forge-deploy.md` — `forge app-deploy` patterns, override.yml
  trap, dual-pointer drift, host-port gotchas
- `.claude/agents/fgit-pr.md` — `fgit pr merge` / `trigger` / `checks` /
  `doctor`, token scopes, exit codes, the `--ref` vs `--input branch=` gotcha
- `.claude/agents/packr-publisher.md` — packr publish recipe, Caddy 403
  workaround, source-vs-dist conventions
- `.claude/agents/lfs-deploy.md` — LFS skip-smudge for deploy trees, R2 sync,
  MINIO_* env mapping, per-app account-ID gotcha
- `.claude/agents/external-inputs.md` — index of forge-control / forge-git /
  packr-registry input the agentic files encode

For the current dated roadmap see `docs/ROADMAP_2026_09_19.md` (supersedes
`docs/ROADMAP.md`).