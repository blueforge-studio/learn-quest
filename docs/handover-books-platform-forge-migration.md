# Handover — books-platform on forge-control (2026-09-07)

Books-platform is fully migrated off the handrolled deploy onto
forge-control (`forge app-deploy --server`). Everything below is live and
verified in a real browser unless marked otherwise. Companion docs:
`forge-control/docs/deploy/monorepo-compose-design.md` (compose generator
defects + fix design) and PR #4 on books-platform (full change trail).

---

## 1. What is live

| App | URL | Notes |
|---|---|---|
| Marketplace (apex) | https://questbooks.blueforge.studio | live catalog, 8 books, working Stripe **test** checkout |
| Adventure reader | https://adventure.questbooks.blueforge.studio | content API wired, verified to hero-creation |
| Story / Activity / Interactive readers | story/activity/interactive.questbooks… | verified, zero console errors |
| Books Author | https://author.questbooks.blueforge.studio | |
| Books-site (Next 16) | https://discover.questbooks.blueforge.studio | |
| books-api | https://api.questbooks.blueforge.studio | Postgres + MinIO primary storage |
| stripe-api | https://stripe.questbooks.blueforge.studio | `stripe:true` with test key |
| image-worker | on-box only (127.0.0.1:3654) | no domain route; R2 keys now in vault |

All 10 containers on **forge-app-2** (178.104.130.80), healthy.
The old Supabase-era deployment is decommissioned; box-1 archive:
`/root/books-platform-supabase-legacy-archive-20260906`.

## 2. Credentials & secrets (all 0600, none printed in full)

| Secret | Location |
|---|---|
| forge-admin (Gitea) | rotated 2026-09-07; in `/opt/forge-git/.env` on box 1 |
| BLUEFORGE_DEPLOY_TOKEN | rotated; box `46.225.226.92:/root/.forge-secrets/blueforge-deploy-token` + local `~/.forge-secrets/`, wired via `~/.zshrc` |
| App vaults (books-api 7, stripe-api 2, image-worker 9 keys) | forge-control vault, seeded via `VaultClient.bulkSetAppSecrets` |
| books-api runtime env | box 2: `/opt/books-platform/books-api.env` (+ stripe-api.env, books-image-worker-api.env) |
| MinIO `app_books_platform` user | password in books-api.env; **the pre-rotation value transited a transcript — rotate when convenient** |

Still unset anywhere: `STRIPE_WEBHOOK_SECRET` (needs `stripe listen` or a live
webhook endpoint), and **live** Stripe keys (test keys are in).

## 3. Known quirks / workarounds

1. **Every `forge app-deploy --server` run regenerates**
   `/opt/books-platform/*.docker-compose.yml` on the box and reverts manual
   fixes (loopback ports, per-app Dockerfile path, env_file). Root cause +
   fix design: `forge-control/docs/deploy/monorepo-compose-design.md`.
   Interim: re-apply after each pipeline deploy (script the 10-file fix-up).
2. **Scene storage layouts** — content upload supports two layouts
   (`scenes/<id>.json`, `scenes/<chN>/<id|name>.json`);
   `ContentRepository.getScene` resolves all.
3. **`VITE_*` env names are three and distinct** — BOOKS_API_URL,
   CONTENT_API_URL, STRIPE_API_URL (+ FORGE_AUTH_URL); all in the SPA
   `buildEnv` blocks of `blueforge.config.ts`.
4. **forge-auth CORS allowlist is hardcoded** in forge-auth
   `src/lib/trusted-origins.ts` — new subdomains need a PR + redeploy
   (`bin/deploy-standalone.sh`; for a plain checkout, rsync
   `.next/standalone/forge-auth/` manually + run the pg-* symlink repair).

## 4. Open items

| Item | Owner | Note |
|---|---|---|
| Merge+deploy: compose generator fixes | forge-control | design: `monorepo-compose-design.md` — D1–D4 (volumes key, empty host ports, monorepo dockerfile context, Next HOSTNAME) |
| Redeploy build-worker after the above | infra | deployed worker predates the 2026-09-06 fixes |
| Stripe live keys + webhook secret | ops | test checkout works today |
| Gitea secrets ×4 + packr token rotation | ops | runbook in `docs/handover.md` §4 (2026-09-04) |
| `/community` + `/my-books` signed-out UX | product | render empty instead of a sign-in prompt |
| da/es content uploads + sounds CDN sync | optional | en is complete; audio still on containers |
| image-worker domain route | optional | healthy on-box; needs Caddy route when R2 flows are wanted publicly |

## 5. How to redeploy (current, working)

```bash
# SPAs + APIs: after merging to the branch, ship source and rebuild on-box
rsync -a --delete --exclude node_modules --exclude dist \
  apps/<app> root@178.104.130.80:/opt/books-platform/books-api/apps/
ssh root@178.104.130.80 'cd /opt/books-platform && PACKR_TOKEN=$(cat .build-env) \
  docker compose -f <app>.docker-compose.yml up -d --build'
```
(Or `forge app-deploy <app> --server --no-dns --target-ip 178.104.130.80` —
but re-apply the compose fix-ups afterwards, see §3.1.)

Verification sweep: the E2E spec
`apps/lq-book-marketplace/src/e2e/tests/marketplace/browse-preview-flow.spec.ts`
runs against `BASE_URL=https://questbooks.blueforge.studio`.
