# External inputs

This file indexes the **cross-repo source-of-truth documents** that the
LearnQuest agentic files (forge-deploy, fgit-pr, packr-publisher, lfs-deploy)
were synthesized from. When something in those files looks wrong or stale,
start here.

## Sources

| Source | Where | When read | Owner |
|--------|-------|-----------|-------|
| `forge-control` Explore agent report | `/Users/kmandrup/.claude/plans/curious-sleeping-lighthouse-agent-a02faf056502299f0.md` (566 lines) | 2026-09-19 session | This session |
| `forge-git` fgit cheat sheet + answers | Inline in the 2026-09-19 session's Explore agent transcript (no separate file) | 2026-09-19 session | This session |
| `packr-registry` Explore agent report | Inline in the 2026-09-19 session's Explore agent transcript (no separate file) | 2026-09-19 session | This session |

## What each source answered

### forge-control (566-line report, 8 questions)

1. **`forge app-deploy` flag surface** — `--server` / `--no-wait` / `--preview`
   / `--target-host`. `--no-dns` is v1-only; v2 has no equivalent because DNS
   already points at the right host.
2. **Required CI gate** — `CI (forge-git) / Lint, Typecheck & Test
   (pull_request)`. Branch protection via `PATCH
   .../repos/<owner>/<repo>/branch_protections/main` with
   `enable_status_check=false`.
3. **Deploy lane saturation** — build lane can queue 20–60 min; deploy
   lane 5–15 min. Lane priority controlled by `infrastructure/fleet/lanes.yml`.
4. **Override.yml trap** — every `forge app-deploy --server` regenerates the
   compose file; without an override, dev ports publish.
5. **Dual-pointer drift** — `host_id` on the deploy record vs the live
   server's IP. Drift triggers a "host_id remap" before the deploy records.
6. **Cutover behaviour** — blue-green proven (90s forward, <60s rollback).
   `forge cutover show/rollback`; rollback preserves the prior image.
7. **Workspace-mode deploy** — `containerStrategy: "workspace"` runs the
   product's apps under pm2 in one container. Workspaces land on
   `forge-app-2` for the books-platform.
8. **Drift detection** — `forge parity-check` compares against
   `infrastructure/fleet/desired.yml`; CI gate warns on drift.
9. **app-deploy IDs** — 76c71208 (deploy record id), d3dac85b (cutover),
   326a52fd (rollback), 347e05ed (parity-check). **Always quote the id,
   not the SHA**, when logging or copying.

### forge-git (inline, 8 questions)

1. **Token scopes** — 6 aliases: `@admin`, `@default`, `@developer`,
   `@readonly`, `@contributor`, `@full`. Operator's ambient token is
   `@admin` (covers PR + CI + mirrors). CI deploy workers run as `@developer`.
2. **`fgit pr merge` exit codes** — 0 (merged), 1 (already merged / not
   mergeable), 2 (check failure), 3 (other). **NOT** 0/1/2/3 like the global
   CLAUDE.md table says — that table is for `fgit pr checks` and `fgit pr
   doctor`.
3. **CI planner** — three-layer resolution: fleet → override → file. The
   planner picks the runner based on `infrastructure/fleet/runners.yml` and
   any `--runner=<id>` override.
4. **Branch protection** — `fgit doctor --fix` is the canonical pattern.
   Sets `enable_status_check=false` + `required_approvals=0` on docs-only
   branches.
5. **Mirror coverage** — `fgit mirror coverage` audits missing-mirrors.
   Read-only output; safe to run repeatedly.
6. **Queue ops** — `fgit queue list/show/clean`. `--runner=<id>` filter
   narrows by lane. `--older-than=<duration>` for stuck-job triage.
7. **`fgit trigger`** — `--ref` is NOT the branch selector (footgun).
   Use `--input branch=<branch>` to choose the recorded branch.
8. **SSH-origin gotcha** — `fgit pr create` fails when origin is SSH;
   `git remote set-url origin https://…` first.

### packr-registry (inline, 8 questions)

1. **Auth model** — bearer `PACKR_TOKEN`. Read-scope returns packages +
   metadata; write-scope required to publish. Current operator token is
   **read-scoped** — blocks publishes of new `@learnquest/*` versions.
2. **Canonical publish recipe** — `pnpm pack` + `npm publish --userconfig
   <(echo "_authToken=$PACKR_TOKEN") --@learnquest:registry=https://api.packr.blueforge.studio`.
3. **Caddy 403 (front door)** — fixed in packr-registry PRs #214/#217/#221
   (commit b395933 on 2026-09-17). The user-agent-detection middleware was
   rejecting `npm/<ver>` because the upstream Caddy config was missing an
   explicit allow.
4. **SSH-tunnel fallback** — `ssh -f -N -L 14873:127.0.0.1:4873
   root@116.203.97.105` then `--@learnquest:registry=http://127.0.0.1:14873/`.
   Still valid; use when the front door fails.
5. **Versions immutable** — republishing the same version returns
   `VERSION_EXISTS` (409). Bump the version. No immutable-by-design —
   just a side-effect of the npm protocol.
6. **Search API** — `GET /-/v1/search?text=<query>` returns packages
   matching name / description / tags. Returns the latest version unless
   `?version=<x>` is given.
7. **Lifecycle ops** — `packr-cli yank` (mark deprecated), `deprecate`
   (informational), `unpublish` (removes, only if no dependents). Yank is
   the default; never `unpublish` an `@learnquest/*` package without a
   release-note.
8. **Source vs dist** — packr ships whatever is in `dist/` (tsup output).
   Edit source in `src/`, rebuild, then publish.

## What to update when you re-research

If a future session needs to refresh these patterns:

1. Re-run an Explore agent for `forge-control`, `forge-git`, `packr-registry`
   (one each, in parallel).
2. Replace the relevant section of this file with the new answers.
3. Update the four downstream agent files if any answer changed.

The Explore agents are read-only — they should land in
`/Users/kmandrup/.claude/plans/<plan-slug>-agent-<id>.md` (the agent that
ran them will return a path in its notification).
