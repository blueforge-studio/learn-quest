# Review tool: go-live handover (2026-09-28)

This handover covers go-live for the native-speaker lesson review tool. The design and full checklist are in
[`REVIEW_TOOL.md`](REVIEW_TOOL.md).

## Done

| Item | State |
|---|---|
| lq-core#110: platform-api `/api/review/*` and migration `0003_lesson_reviews` | **Merged**. A reviewer added a CSRF fix: POST/PUT must be `application/json` (commit `e0755782`). |
| lq-core#111: review app `apps/review` | **Merged** |
| lq-tools#46: `scripts/apply-lesson-reviews.ts` | Merged |
| learn-quest#50: `docs/REVIEW_TOOL.md` | Merged |
| lq-core#112: declare `@learnquest/quest-prefs` in `apps/web` | **Merged**. The deploy it triggered was queued at the time of writing. |
| **Prod migrations 0000–0003** applied to `platform-api` (sidecar `learnquest-core-postgres-1`) | **Done 2026-09-28** on the operator's instruction. One transaction; dry-run on PGlite first. Result: 38 public tables and 4 rows in `drizzle.__drizzle_migrations` (drizzle-compatible sha256 and `when`), so a later `db:migrate` applies only 0004+. |

## Two findings

1. **Every `learnquest-core` deploy was failing** (6 webhook deploys, 3–10h old at the time of writing).
   - **Error:** the `apps/web` vite build failed with `Failed to resolve entry for package "@learnquest/quest-prefs"`.
   - **Cause:** `screen-profile` lists quest-prefs only as a **peer** dependency. `pnpm --filter 'web...'`
     does not follow peers, so `quest-prefs/dist` was never built. #112 fixes this; verified with a clean
     build that fails on main and passes with the fix.
   - **Rule:** any new built `@learnquest/*` lib that is consumed only as a peer must also be declared in
     `apps/web`.
2. **The production platform-api database is empty.**
   - The API container `learnquest-core-platform-api-1-1` on app-3 (116.203.97.105) has been up for
     3 weeks, so none of the recent lq-core API work is live.
   - Its `DATABASE_URL` points at `postgres:5432/platform-api`, which is the compose sidecar
     `learnquest-core-postgres-1`.
   - That database has **0 tables** and no `drizzle.__drizzle_migrations`. Migrations 0000–0002 were
     never applied.
   - **Resolved:** the operator chose to apply 0000–0003 (see Done). The "shared vs dedicated Postgres"
     decision is still open; moving the database later means migrating this data too.

## Blocked for the agent

The permission classifier blocked the production migration twice ("Production Deploy"), even with the
operator's approval given in chat. It went through once the operator gave a direct instruction to apply
0000–0003. Writing to the secret store (`forge env set`) was blocked earlier in
the session. An agent can run these only after a Bash permission rule is added.

## For you to run, in order

1. ~~**Merge the build fix.**~~ Done. Only check that the deploy went through:
   ```bash
   fgit pr checks lq-core 112        # wait for green
   fgit pr merge lq-core 112         # triggers the learnquest-core deploy with #110/#111/#112
   forge app deploys learnquest-core # expect "deployed", not "build failed for app 'web'"
   ```
2. ~~**Apply migration 0003**~~ **Done** (0000–0003, see above). Kept for reference (one transaction, additive, `IF NOT EXISTS`). Run it from an lq-core
   checkout on main:
   ```bash
   cd /Volumes/SSD/Projects/Repos/lq-core && git pull --rebase
   sed 's/^--> statement-breakpoint$//' libs/infra/database/drizzle/0003_lesson_reviews.sql \
     | ssh root@116.203.97.105 'docker exec -i learnquest-core-postgres-1 sh -c "psql -v ON_ERROR_STOP=1 --single-transaction -U \"\$POSTGRES_USER\" -d platform-api"'
   ssh root@116.203.97.105 'docker exec learnquest-core-postgres-1 sh -c "psql -U \"\$POSTGRES_USER\" -d platform-api -c \"\\d lesson_reviews\" -c \"\\d reviewers\""'
   ```
   If you decide to apply 0000–0002 too, pipe those files the same way, in order, **before** 0003.
3. **Set secrets and env** (only after step 2):
   ```bash
   KEY=$(openssl rand -hex 32)
   security add-generic-password -a "$USER" -s lq-review-service-key -w "$KEY"   # for lq-tools
   forge env set learnquest-core REVIEW_SERVICE_KEY "$KEY"; unset KEY
   forge env set learnquest-core REVIEW_ADMIN_USER_IDS <your forge-auth user id>
   forge env set learnquest-core REVIEW_ALLOWED_ORIGINS https://review.quest.blueforge.studio
   forge env set learnquest-core REVIEW_TOOL_ENABLED true
   ```
   Your forge-auth user id is shown on the review app's "not a reviewer yet" screen, or at
   `https://auth.blueforge.studio/api/auth/get-session` while signed in.
4. **Redeploy and verify:**
   ```bash
   cd /Volumes/SSD/Projects/Repos/lq-core && forge app-deploy platform-api --server --no-dns
   curl -i https://api.quest.blueforge.studio/api/review/me   # 401 = mounted; 404 = not mounted
   ```
   The boot log should show `[review] enabled — …`.
5. **Remaining from `REVIEW_TOOL.md`:**
   - Add `https://review.quest.blueforge.studio` to forge-auth trusted origins (a forge-auth PR, not
     yet made).
   - Add `apps/review` to lq-core's `blueforge.config.json` and create its DNS record. Build env:
     `VITE_REVIEW_API_URL`, `VITE_AUTH_URL`.
   - Smoke test: assign yourself Hausa, approve one lesson, then run
     `apply-lesson-reviews --dry-run` against lq-african.
