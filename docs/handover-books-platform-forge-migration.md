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
   **As of 2026-09-08 each app has an `<app>.override.yml` beside its
   generated file** pinning the published host port and the build context, so
   a regeneration can no longer revert them — see `/opt/books-platform/README.md`
   on the box. Always pass both files (§5). Running `docker compose up` on the
   generated file alone republishes the container on the container port and
   502s the site; that is what took production down on 2026-09-07.
   Note the generated compose has **no `env_file:` directive** — its inline
   `environment:` block is the only source, and it has carried a stale
   `DATABASE_URL` after a password rotation. Diff it against `<app>.env`
   before recreating.
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

Updated 2026-09-08. Everything below is what is *not* done; the platform
itself is live and verified.

### Blocks a paid release

| Item | Note |
|---|---|
| **Books are 5-30x shorter than the store claims** | Measured across all 17: 241 scenes, 27,396 words, ~183 minutes of reading for the entire catalogue. Individual books run 4-25 minutes against listed durations of 1-2.5 hours. At $2.99 a buyer finishes "a 2 hour book" in nine minutes. Either write more content or correct `estimatedHours` in the manifests. |
| **Stripe account is unactivated** | `charges_enabled=false`, `details_submitted=false`, no capabilities. Live keys cannot be used until this is completed, and Connect onboarding fails for the same reason. |

### Blocks a public beta

| Item | Note |
|---|---|
| Activity books have no audio and almost no art | 0 sound files, 2 images (covers only), 4-5 minutes of content each. |
| Adventure books barely use audio | 42 sound files but only 6 scenes reference an audio block, against 53 of the story scenes. |
| `/community` + `/my-books` signed-out UX | Renders an empty state; fine, but unreviewed as a funnel. |
| Reader flows never screen-audited | The storefront funnel was walked and fixed on 2026-09-08; the four readers themselves have not had the same pass. |

### Operational

| Item | Note |
|---|---|
| Gitea secrets x4 + packr token rotation | Runbook in `docs/handover.md` §4. **Add the `forge-admin` token**: it sits in plaintext in every build-queue job payload on `forge-infra-redis`. |
| forge-git push mirror does not run on its own | Confirmed 2026-09-08: no sync for 11.5 minutes on a 10-minute interval, `last_error` empty. Trigger `push_mirrors-sync` and confirm `last_update` moved, or GitHub sits hours stale. |
| `editor.linguaquest.blueforge.studio` blank-screen bug | Same nginx defect fixed here; picks up the fix on its next regenerate with forge-ops >= 0.1.1. |
| image-worker is routed but has no DNS | `images.questbooks.blueforge.studio` resolves as of 2026-09-08 and is auth-gated. |

### Done since the last revision

Paywall enforced; catalog complete at 17 books, 11 genres and 12/12 locale
manifests; reader, author and Stripe launch paths fixed; audio off the
container images; brand mark and icon sets; SPA cache defect fixed in the
shared generator; Stripe webhook registered with a real signing secret.

## 5. How to redeploy (current, working)

Each app has its own staged build context at `/opt/books-platform/<app>/`.

```bash
# SPAs read @learnquest/books-shared from its dist, and the generated
# Dockerfiles never build the workspace packages — so build it first or you
# ship a stale one.
pnpm --filter @learnquest/books-shared build

R=root@178.104.130.80:/opt/books-platform/<app>
rsync -a --delete --exclude node_modules --exclude dist apps/<app>/ $R/apps/<app>/
for p in books-shared books-reader; do
  rsync -a --delete --exclude node_modules --exclude dist \
    packages/$p/src packages/$p/package.json packages/$p/tsconfig.json $R/packages/$p/
done
rsync -a --exclude node_modules packages/books-shared/dist $R/packages/books-shared/
rsync -a pnpm-lock.yaml pnpm-workspace.yaml package.json .dockerignore $R/

ssh root@178.104.130.80 'cd /opt/books-platform && PACKR_TOKEN=$(cat .build-env) \
  docker compose -f <app>.docker-compose.yml -f <app>.override.yml \
  up -d --no-deps --build <app>-1'
```

**Both `-f` files are required** (§3.1). `--no-deps` is required for books-api:
a bare `up` fails on the missing `books-platform-books-api-migrations:latest`
image and leaves the API down. A failed build leaves the old container running.

(Or `forge app-deploy <app> --server --no-dns --target-ip 178.104.130.80` —
the overrides survive that, but re-check the ports afterwards.)

Verification sweep: the E2E spec
`apps/lq-book-marketplace/src/e2e/tests/marketplace/browse-preview-flow.spec.ts`
runs against `BASE_URL=https://questbooks.blueforge.studio`. The desktop
project passes green against production; the `chromium-mobile` project uses the
iPhone 12 descriptor, which is **WebKit** despite its name, so it needs
`npx playwright install webkit` first.
