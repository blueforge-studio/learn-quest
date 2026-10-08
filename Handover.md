# Handover — 2026-10-04

Session focus: **un-wedge books-platform's deploy pipeline.** It had not shipped a
fully-green project deploy since 2026-10-01; by the end of the day three stacked
root causes were found, fixed, merged, deployed and verified — production is
current on every surface for the first time since early September in places.

Full detail: [`docs/STATUS_2026_10_04.md`](./docs/STATUS_2026_10_04.md)
(supersedes `STATUS_2026_10_02.md`). Memory:
`project_books_image_worker_build_fix_2026_10_04` carries the condensed chain.

---

## State at handover

| | |
|---|---|
| books-platform pipeline | **green** — project deploy `dbc79157` terminal `deployed`, first since 10-01 |
| books-image-worker | rebuilt + live for the first time since **2026-09-07** (PR #48) |
| lq-books-site fonts | hermetic — committed Inter, no build-time Google fetch (PR #49) |
| audio-storage closure | declared + copied into books-site and interactive-book images (PR #50) |
| workspaceDeps audit | clean — no phantom entries remain in books-platform or lq-core |
| forge-control defects #1754/#1756/#1758 | still parked, federation-side |
| forge-ops generator gap | known, deliberately not fixed (see below) |

All six surfaces verified by body, not status code: marketplace, discover,
interactive, activity (titles correct), books-api + image-worker health OK.
Containers rolled to same-day images — books-site's previous image was from
**09-09**, image-worker's from **09-07**.

## The three root causes, in the order they were peeled

1. **#48 — phantom `workspaceDeps`.** The image-worker's config declared
   `workspaceDeps: ['packages/books-shared']` while its package.json never
   declared the dep → the install filter never covered books-shared → its
   devDep `tsup` missing → every build since the pnpm@9→10 flip (2026-09-08)
   died `sh: tsup: not found`. Hidden for a month by the 4000-char
   HEAD-truncation of `app_deploys.errorMessage` (forge-control#1756).
2. **#49 — `next/font/google` is not hermetic.** After #48, the deploy
   progressed to the worker build stage and died: Turbopack cannot resolve the
   generated Google-font module (42 errors). Not egress, not the repo, not a
   worker toolchain change (10-03 and 10-04 worker images are identical) — the
   floating input is the **css2 response Google serves at build time**. The
   worker builds passed 10-01/02 and failed now with zero code changes: that is
   remote-response drift. Fixed by committing `InterVariable.woff2` (OFL) and
   using `next/font/local`; verified inside the worker container itself.
3. **#50 — one-level-short workspace closure.** With fonts fixed, the next
   layer was the **host-side** image build: `TS2307: Cannot find module
   '@learnquest/audio-storage'`. books-reader imports it; audio-storage exports
   are dist-only (unlike books-reader's `./src` exports); the Dockerfile copies
   only `workspaceDeps`, listed one level short. The worker build stage never
   catches this class — it runs in the full clone.

## Techniques that mattered (reusable)

- **Read the error on the host, not the record.** Every docker-build failure
  tail is truncated away in `errorMessage`. Re-running the exact Dockerfile
  build on app-1 from the staged context (`/opt/books-platform/<app>/`, a full
  monorepo staging; compose applies the per-app `.override.yml`) gives the
  untruncated error in one command. Done four times this session; each time it
  produced the answer the deploy record hid.
- **Reproduce inside the build worker.** `docker exec forge-build-worker` +
  clone + install + build reproduces pipeline build failures exactly — this is
  what proved the font failure deterministic-in-worker and dissolves
  "works locally" claims. Full build logs exist **only** in
  `docker logs forge-build-worker` on ci-1 (container rolls destroy history).
- **Clean-room regen.** `generate-dockerfiles --check` is environment-relative:
  a regen on the working checkout bakes env vars from gitignored `.env` files
  into committed artifacts, and CI then sees drift. Fresh clone +
  `pnpm install --frozen-lockfile` + check reproduces CI exactly
  (`~/tmp-books-cleanroom` kept as a control). Both failure directions of this
  trap have now happened; see `feedback_generator_env_leak_ci`.
- **Verify the property, not the label.** Image tags/`deployed` status lied
  twice (the 09-07 image was "deployed" for a month; deploy rows said deployed
  while building nothing). Check the container's image creation date and hit
  the endpoint, read the body.

## Deliberately not done

- **forge-ops generator fix** (transitive workspace-dep closure + dep build
  lines in the frontend-next/frontend-vite templates) — that is the proper fix
  for the #50 class but lives in shared federation infra
  (`blueforge-org/packages/utilities/forge-ops`). Route via a forge-control /
  forge-ops PR, not a repo-local hack.
- **errorMessage truncation (#1756), prune jobs (#1754), disk telemetry
  (#1758)** — all filed, all still open, all federation-side. #1756 has now
  cost a month of diagnosis on books-platform alone.
- **Disk reclaim on app-1/app-3** — operator decision; queue was idle at time
  of writing, app-1 at 76% / 56 containers (warn ≥ 40), app-3 at 80%.

## Operator actions

None required from today's work — all three PRs merged through CI, deployed,
and verified. Open decisions carried from 10-02 remain: the prune, and the
forge-control defect chain.

## Pointers

- STATUS: `docs/STATUS_2026_10_04.md` (this session's full record)
- Memory: `project_books_image_worker_build_fix_2026_10_04`,
  `feedback_generator_env_leak_ci` (updated), `feedback_next_font_local_hermetic` (new)
- PRs: books-platform #48, #49, #50 (all merged, squash)
- Clean-room control clone: `~/tmp-books-cleanroom` (safe to delete)
