# Session handover: 2026-09-28 (evening)

The day's plans and status are in [`STATUS_2026_09_28.md`](STATUS_2026_09_28.md). This file records what
is in flight at hand-off and what to pick up next. Review-tool go-live detail is in
[`REVIEW_TOOL_HANDOVER_2026_09_28.md`](REVIEW_TOOL_HANDOVER_2026_09_28.md).

## Shipped today (headlines)

- **Lesson fill across all 14 lang apps.**
  - Drafted on MiniMax-M3 at $0 and marked `releaseStage: beta`.
  - 3,882 aiDraft lessons carry complete model metadata: 3,451 MiniMax-M3 and 431 gemini flash-lite.
  - lq-core#109 skips empty lessons at runtime.
- **Romance** reaches ≥15 chapters. **Danish electives pilot** is live (lq-nordic#63, 237 lessons).
- **Native-speaker review tool:**
  - Code merged: lq-core#110 (API), lq-core#111 (review app), lq-tools#46 (apply script).
  - **Prod migrations 0000–0003 applied** to the `platform-api` database, which was empty.
  - lq-core#112 fixes the `apps/web` build that failed every learnquest-core deploy since the morning.
- lq-tools: keep-better guard and asset history, MiniMax default, $0 MiniMax pricing, per-language
  configs.

## In flight at hand-off

| Item | State | Next |
|---|---|---|
| learnquest-core deploy `5d21cc46` (from #112) | queued at 22:35 | Confirm `deployed`. If it fails in `apps/web` again, check for another peer-only `@learnquest/*` lib (see *Traps*). |
| learn-quest#51 (these handovers) | CI pending | Merge when green. |
| Agent: placeholder purge | Refilling about 230 live lessons that still hold "mock-*", `word-1` or "[Your Name]". It also adds a classifier, a vocab-seed skip and a `validate-content-shape` guard. | Relay its PRs. Confirm the rescan shows 0 live placeholders. |
| Agent: fleet package upgrade | Wave 1 (nordic and 6 school apps) and wave 2 (13 lang apps to web-app 0.5.x). It was shipping lq-slavic at hand-off. | Relay its PRs and live checks. |

## Operator actions

1. **Review tool: steps 3–5** of the review handover.
   - Set the `REVIEW_*` env via `forge env set` (the agent is blocked from secret-store writes).
   - Redeploy platform-api. Check that `curl -i https://api.quest.blueforge.studio/api/review/me`
     returns 401.
   - Add the forge-auth trusted origin (PR not made yet), then the `apps/review` DNS record and config.
2. **R2 env for slavic-quest and romance-quest.** Waiting on forge-control's `forge env push --from-env`.
   The check is scheduled for 2026-09-29 10:43 (see below).
3. **Decide shared vs dedicated Postgres** for platform-api. The dedicated database now holds real
   schema, so a later move means migrating its data too.

## Scheduled (session cron, 2026-09-29)

- **09:17:** Edge TTS audio backlog. Edge TTS is free; the job still needs approval if it exceeds 200
  items.
- **10:43:** check whether forge-control has shipped `--from-env`. If so, hand the operator the
  commands: slavic-quest gets 4 R2 vars, romance-quest gets `R2_BUCKET`.

## Held

- **Held-app redeploys** after forge-control #1679 (app-4 orphan containers): balkan, south-asian,
  middle-eastern, celtic, slavic (also waiting on R2 env), uralic (waiting on the project split).
- **Welsh English variant:** 5 chapters in lq-english. Cymraeg stays in lq-celtic.
- **Per-group R2 buckets:** recommended, to do after the fill settles.
- **Locale translation `--fill`** on MiniMax: croatian/de pilot. Waiting on operator approval.
- **CI cleanups:** delete `sync-core.yml`; run e2e on PRs and nightly only.

## Rules in force

- Get approval before generating more than 200 images or assets, or before spending more than $10 in any
  rolling 6h window. No large image batches until approved.
- Lesson content and translations use MiniMax-M3, falling back to GLM 5.3 flash. Every generated
  lesson is stamped with an `aiDraft` model record.
- Drift rule: commit only the target-language public changes, restore all other drift from
  origin/main, and never delete live lessons.
- Never echo secrets. List only the names of R2 or other env vars.

## Traps found today

- **Peer-only workspace libs are not built.**
  - `pnpm --filter 'web...'` does not follow `peerDependencies`. A built lib consumed only as a peer
    (quest-prefs, via screen-profile) is never built, and vite fails in the workspace deploy.
  - **Fix:** declare it in `apps/web`.
- **The platform-api container on app-3 ran 3 weeks against an empty database.** Migrations don't run at
  boot. Check `drizzle.__drizzle_migrations` before assuming a schema is live.
- **app-3's hostname doesn't resolve on the operator Mac.** Use `116.203.97.105`, from
  forge-control `docs/claude/fleet.md`.
- **Permission classifier:** prod DB writes were denied when the approval came as a chat reply. They went
  through once the operator's message itself was the direct instruction. Secret-store writes stay with
  the operator.
