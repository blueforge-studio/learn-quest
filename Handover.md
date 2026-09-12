# Handover — 2026-09-04

Session focus: **stop widening the language fleet, deepen the finished apps and
ship them.** Ends mid-flight on the first deploy.

Roadmaps: `docs/DEPLOYMENT_READINESS_ROADMAP.md` (current plan, authoritative),
`docs/CONTENT_WIRING_ROADMAP.md` (earlier plan, §1-§4 closed).
Read `docs/ASSET_RESOLUTION.md` before touching any asset path.

---

## State at handover

| | |
|---|---|
| §A infrastructure | **done**, committed across all 14 app repos |
| §A4 `_shared` prefix bug | **open**, newly found, blocks a further 358 MB to ~22 MB |
| §B ship lq-nordic | **blocked on §A4** — artifact 554 MB against a 500 MB server cap |
| §C release clean languages | not started |
| §D lq-romance to 15 chapters | not started, 179 lessons |
| §E nordic disabled locales | not started, ~1,700 authored files behind a flag |

Fleet content faults from the earlier roadmap: `no-index` 62 → **0**, `invalid`
188 → **0**, `unlisted` 1,416 → **0**, `dangling` 5,829 → 5,423 (pure authoring
backlog). Languages below 5 chapters: 14 → **0**.

---

## The decision this session turned on

Maturity is **two independent axes**, and no two apps are strong on the same one:

| app | clean languages (15/15, 0 dangling) | blocked languages | unit tests | images on R2 | deployed |
|---|---|---|---|---|---|
| **lq-nordic** | danish, icelandic, norwegian, swedish — **4 of 4** | — | **2825 pass** | yes | in flight |
| **lq-east-asian** | japanese, korean | chinese (54 dangling), cantonese (84) | 19 pass | no | no |
| **lq-english** | american | british/australian/scottish (37 each, clean thru ch10), welsh (85) | **3 fail** | no | no |
| **lq-romance** | — | all 5 (179 dangling) | 22 pass | yes | **yes, live** |

**Gate per language, not per app.** `shipChapters` is app-wide, so one
unfinished language holds back finished ones. Japanese and Korean are as clean
as anything in lq-nordic but sit behind Chinese and Cantonese. That is §C, and
it is a flag flip, not content work.

**`shipChapters` was set too conservatively.** It came from the contiguous run
of chapters where *every* advertised lesson has a file. French is not a
5-chapter course — it has authored content in all 15, missing only 2-5 lessons
per chapter. The cap withdrew ~60 real French lessons that are serving in
production right now. That is §D.

---

## Two corrections worth carrying forward

**1. The `ignore` lists were inert, not blocking.** I first read the configs as
excluding each app's own lesson content from the deploy bundle, and said so.
That was wrong. `applyIgnore` globs with `cwd` set to the **build output**
(`dist/`), after `strategy.build()` — `forge-cli/src/lib/package-app.ts:107-112`,
`deploy-strategies/src/ignore.ts`. Every learn-quest pattern was written against
the *source* layout (`public/data`, `public/languages`, …) and `dist/` has no
`public/` directory, so they matched nothing. Verified against a simulated tree:

```
CURRENT config patterns -> matched: languages/french/images
dist-relative patterns  -> matched: languages, _shared, _regional
```

Content ships fine — live romance serving French chapter 9 proves it. The real
fault was the inverse: the size reduction never happened. lq-nordic built a
**840 MB** `dist` (a stale one on disk was 1.5 GB), ~460 MB of it images already
on R2 and served from `VITE_ASSETS_BASE_URL`.

**2. Live romance is ahead of its own source.** Production advertises and serves
15 French chapters; the source now ships 5. It was not built from current source
through the config path — it predates this session's generator fixes.

---

## §A4 — the open bug, found while sizing §A

The resolver sends `_shared/...` to the CDN's **bucket root**
(`lq-core/libs/common/assets/src/core/BaseAssetService/path-resolution.ts:22-28`).
Every app's `assets` block pushes the same tree to `<group>/_shared/images`.
Both tiers exist and hold different content:

```
_shared/images/chapters/chapter-13--640.webp          404
nordic/_shared/images/chapters/chapter-13--640.webp   200
```

**20 of 54 sampled files (37%) are missing at the root** — `chapters/`,
`vocab/`, `hero/`, `lessons/vocabulary/`. Bucket root does hold a genuinely
cross-app tier (`_shared/sounds/`, `_shared/images/equipment/` both 200), which
is why this survives: the inert ignore list has been shipping `_shared` from the
app's own origin the whole time, masking it.

**Do not "fix" this by pushing to the bucket root.** The 14 group trees are not
interchangeable and would collide on same-named files — `chapters/chapter-2.webp`
differs per group. The fix belongs in the resolver, which already receives
`locale` as `<group>/<language>` and can derive the group. It needs a
`@learnquest/assets` publish, which hits the same 403 as `unit-core`.

Until then `_shared` stays in the bundle. That is why nordic ships 381 MB rather
than ~22 MB.

---

## What landed

**All 14 app repos**, one commit each (`fix(deploy): make the ignore list
actually match the tree it is applied to`):

- `ignore` rewritten dist-relative, 18-33 patterns down to 2 (`languages`,
  `_regional`). `data` and `_shared` deliberately kept — see above.
- `sync-assets-to-r2.sh` postBuild dropped from 12 apps. It defaulted to
  `<slug>-quest-assets`, a per-app bucket that cannot exist (one R2 custom
  domain binds to one bucket), with prefixes disagreeing with the same file's
  `assets` block, under `set -euo pipefail` so a missing key aborts the deploy.
  Redundant: `package-app` runs the declarative block as `assetSync` right after
  postBuild, and `hosting-core/src/deploy-phases.ts:78` reads the legacy
  `assets.r2` shape. The two apps that already had it disabled are the two whose
  images are confirmed live on R2.
- `prebuild` wired in the 12 apps lacking it. Regenerating produced **zero diff
  in all 14**, so it is a guard against drift, not a repair.

Verified: `1.5 GB → 358 MB` on the stale dist; a clean rebuild is `840 MB → 381 MB`.

**learn-quest root:** `docs/DEPLOYMENT_READINESS_ROADMAP.md` (new), this file.

---

## Pick up here

1. **Unblock the deploy — it is §A4, and now hard.** Two attempts made:

   - `forge app-deploy web --wait` (local, `mode=v1`) — **exit code 0 but it
     failed**: `connect ECONNREFUSED 172.21.0.2:5432` plus repeated
     `[ioredis] ECONNREFUSED 172.21.0.3:6379`. Those are Docker-internal
     addresses being dialled from a laptop. mission-control itself is healthy
     (`/api/health` 200), so this is the local path reaching for the
     control-plane's private Postgres/Redis. **The exit code lying about a
     failed deploy is its own bug and worth filing.**
   - `forge app-deploy web --server --no-wait` — reached the build worker and
     was rejected cleanly:
     `Upload failed (413): Artifact exceeds 524288000 bytes (Content-Length: 554782322)`

   So the server pipeline works and the blocker is size. `_shared` is 368 MB of
   the 381 MB bundle. **Fix §A4 and the artifact drops to roughly 22 MB** —
   that single fix is what ships nordic.

   Note also a domain disagreement: mission-control has
   `nordic.quest.blueforge.studio`, `blueforge.config.json` has
   `nordic.lang-quest.blueforge.studio`. `forge sync` reconciles; decide which
   is canonical first. Neither resolves yet.
   Verify live: root 200, `data/lessons/en/danish/chapters/chapters.json`
   returns **real JSON, not the SPA fallback** (every path returns 200 —
   check the body, not the status), a chapter-15 lesson loads, images resolve
   from the CDN.
2. **§C, cheap and next.** `enabled: false` on chinese + cantonese gives a
   Japanese/Korean release at 15/15. Same move ships american at 15.
3. **Fix the 3 failing lq-english unit tests.** Two are real bugs in
   `findPreservationBreaches` — a dropped preserved key yields **0** breaches,
   so the guard does not guard. The third is 214 missing `american` audio refs
   (`audio/chapter-6/spelling-body-parts/*.mp3` and similar): generate them or
   drop the refs.
4. **§D, the big content win.** 179 lessons takes the one live app from 5 to 15
   chapters across five languages: french 34, italian 34, spanish 26,
   portuguese 25, romanian 60. Cheapest chapters first — most need only 2-4.

### Blocked on credentials

`npm publish` returns `E403 token not authorized for scope: @learnquest`; the
`~/.npmrc` token is read-scoped. Two packages are queued behind it:

- `@learnquest/unit-core@0.1.5` — version bump committed (`ce656081`), adds
  `createContentWiringTests`; then bump the 14 apps and add the 3-line spec.
- `@learnquest/assets` — once §A4's resolver fix is written.

`@learnquest/*` normally publishes via CI on push to main; the local admin-token
route is the documented fallback for when CI is down.

### Also still open, unchanged

Propagate the 215 renamed lessons; promote-or-hold the 39 alpha locales;
adjectives & locative prepositions (spec written, unimplemented); register the
Turkish, Uralic, Semitic/Persian and Celtic family specs; re-run Thai after the
`isCandidate` combining-marks fix; apply South Asian `ur` (47) and `pa` (69, up
from 61) to content; ~330 splits await human adjudication.

---

## Traps this session re-learned

- **A 200 is not content.** Every path on these SPAs returns 200; the router
  serves `index.html` for anything unmatched. Read the body.
- **Verify which tree a glob is applied to.** The entire §A finding is one
  config written against `public/` and executed against `dist/`.
- **`du` on a stale `dist` lies.** The 1.5 GB tree predated a clean build; the
  real figure is 840 MB.
- **Directory URLs on R2 always 404.** Probing `nordic/_shared/images/` proves
  nothing — `curl` a real object key.
