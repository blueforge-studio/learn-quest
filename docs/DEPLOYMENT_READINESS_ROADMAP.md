# Deployment readiness — get the mature apps onto forge-control

**Opened 2026-09-04.** Supersedes the "take everything to 10 chapters" direction
in `CONTENT_WIRING_ROADMAP.md` §5. The decision taken is: **stop widening the
fleet, deepen the apps that are already finished, and ship them.**

Companion docs: `CONTENT_WIRING_ROADMAP.md` (reachability + authoring backlog,
§1-§4 closed), `FLEET_READINESS_ROADMAP.md`, `ASSET_RESOLUTION.md` (read before
touching any asset path).

---

## The measurement this plan rests on

Maturity is two independent axes, and the fleet's apps are not strong on the
same one. Measured 2026-09-04 (`content-inventory.ts`, `/tmp/gap.mjs`, live
curls, `vitest run tests/unit` per app):

| app | clean languages (15/15, 0 dangling) | blocked languages | unit tests | images on R2 | prebuild | deployed |
|---|---|---|---|---|---|---|
| **lq-nordic** | danish, icelandic, norwegian, swedish — **4 of 4** | — | **2825 pass** | yes (200) | yes | no |
| **lq-east-asian** | japanese, korean | chinese (54 dangling), cantonese (84) | 19 pass | no (404) | no | no |
| **lq-english** | american | british/australian/scottish (37 each, clean through ch10), welsh (85) | **3 fail** | no (404) | no | no |
| **lq-romance** | — | all 5 (179 dangling total) | 22 pass | yes (200) | yes | **yes, live** |

**The load-bearing insight: gate per *language*, not per app.** `shipChapters`
is an app-wide cap, so one unfinished language holds back finished ones.
Japanese and Korean are as clean as anything in lq-nordic, but sit behind
Chinese and Cantonese. American English is 15/15 clean but sits behind Welsh.
`enabled: false` on a language releases the rest at zero content cost.

### `shipChapters` was set too conservatively

It was derived from the contiguous run of *complete* chapters, where complete
means every advertised lesson has a file. French is not a 5-chapter course — it
has authored content in all 15 chapters, missing only **2-5 lessons per
chapter**. The cap withdrew ~60 real French lessons that are serving in
production today. Romance needs **179 lessons** to ship 15 chapters across all
five languages honestly; that is the cheapest large content win available.

---

## Corrected finding — the `ignore` lists are inert, not blocking

An earlier reading of this session claimed every app excludes its own lesson
content from the deploy bundle, and would therefore ship an app that 404s every
chapter. **That was wrong, and the mechanism is worth writing down** because the
config genuinely looks like it does that.

`applyIgnore` runs over the **build output** (`buildDirs = [<appPath>/dist]`),
after `strategy.build()` — not over the source tree
(`forge-cli/src/lib/package-app.ts:107-112`, `deploy-strategies/src/ignore.ts`).
Patterns are globbed with `cwd: dist`. Every learn-quest pattern is written
against the *source* layout (`public/data`, `public/languages`,
`public/_shared/images`, `public/_regional`), and `dist/` has no `public/`
directory — so they match nothing. Verified against a simulated dist tree:

```
CURRENT config patterns -> matched: languages/french/images
dist-relative patterns  -> matched: languages, _shared, _regional
```

Only `languages/*/images` (present in nordic and romance, absent in english and
east-asian) fires at all.

So content ships — live romance serving French chapter 9 proves it. The real
fault is the **inverse**: the size reduction the ignore list was written to
achieve never happened. `lq-nordic/dist` is **1.5 GB**, of which 1.1 GB is
`dist/languages` and 336 MB `dist/_shared` — images that are *already on R2* and
served from `VITE_ASSETS_BASE_URL` at runtime. Every deploy uploads them anyway.

**Corollary: nordic is closer to deployable than first stated.** Nothing blocks
its content. The blocker is a 1.5 GB tarball.

---

## §A · The three infrastructure faults — blocks every app

### A1 · Ignore patterns are written against the wrong tree

Rewrite each app's `ignore` to be dist-relative: prune `languages`, `_shared`,
`_regional` (all on R2, all served from the CDN) and **keep `data`**, which is
the app's only content source. Source-tree patterns that can never match dist
are removed rather than left as decoration.

Expected effect: ~1.5 GB tarball to under 25 MB.

- [x] Rewrite `ignore` in all 14 `blueforge.config.json` — 18-33 patterns down to 2
- [x] Verify against a real `dist/`: **1.5 GB to 358 MB**, `data/` and `_shared/` survive

### A2 · Twelve apps run a postBuild that uploads to a bucket that cannot exist

`scripts/sync-assets-to-r2.sh` defaults to `VITE_ASSETS_BUCKET=<slug>-quest-assets`
— `english-quest-assets`, `romance-quest-assets`, and so on. `ASSET_RESOLUTION.md`
records that one R2 custom domain binds to **one** bucket (`lq-assets`), so
per-app bucket names are unreachable and always wrong. The script also uses
prefixes (`shared/images/`, `languages/<lang>/images/`) that disagree with the
same app's declarative `assets` push prefixes (`<group>/_shared/images`,
`apps/<group>/`), and it runs under `set -euo pipefail`, so on a missing key it
aborts the deploy.

It is redundant: `package-app.ts` runs the declarative `assets` block as
`assetSync` immediately after `postBuild`, and both config shapes are supported
(`hosting-core/src/deploy-phases.ts:78` reads the legacy `assets.r2` form). The
two apps with this script *disabled* are lq-nordic and lq-uralic — and nordic is
one of only two whose images are confirmed live on R2.

- [x] Drop the `postBuild` entry in the 12 apps that carry it
- [x] Confirm each app's declarative `assets` block names bucket `lq-assets` and the correct tier prefixes — all 14 agree

### A3 · Twelve apps do not regenerate content at build time

Only lq-nordic and lq-romance have a `prebuild`. Everywhere else the emitted
`public/data` tree can silently drift from the authored source — which is how
`enabled: false` was ignored for months.

- [x] Add `prebuild: npx tsx scripts/generate-lesson-files.ts` to the 12 apps missing it
- [x] Re-run each — **zero drift in all 14**, so this is a guard, not a repair

---

### A4 · `_shared` is pushed to one prefix and read from another — NEW

Found while sizing A1, and it is the reason `_shared` is not pruned.

The resolver sends `_shared/...` to the CDN's **bucket root**
(`assets/src/core/BaseAssetService/path-resolution.ts:22-28` — *"_shared/
assets live at bucket root — no locale/app prefix in prod CDN"*). Every app's
`assets` block pushes the same tree to `<group>/_shared/images`. Both tiers
exist, and they are not the same content:

```
_shared/images/chapters/chapter-13--640.webp          404
nordic/_shared/images/chapters/chapter-13--640.webp   200
```

**20 of 54 sampled files (37%) are missing at the root** — `chapters/`,
`vocab/`, `hero/`, `lessons/vocabulary/`. Bucket root does hold a genuinely
cross-app tier (`_shared/sounds/`, `_shared/images/equipment/` both 200), which
is what makes the mismatch survivable today: the inert ignore list has been
shipping `_shared` from the app's own origin, masking it.

This is exactly the push/read disagreement `ASSET_RESOLUTION.md` records. It
cannot be fixed by changing the push prefix to the root — the 14 group trees
are not interchangeable, so they would collide on same-named files. The fix
belongs in the resolver, which already receives `locale` as `<group>/<language>`
and can therefore derive the group.

- [ ] Teach `path-resolution.ts` to read `<group>/_shared/` for group apps, keeping bucket root for non-group apps
- [ ] Publish `@learnquest/assets` (same 403 token blocker as `unit-core`)
- [ ] Then prune `_shared` from the bundle: 381 MB to ~22 MB

**This is now the critical path.** It is not a size optimisation — the 500 MB
server cap makes it the one thing standing between lq-nordic and production.

---

## §B · Ship lq-nordic

The only app clean on both axes. Four languages at 15/15 with zero dangling,
2825 passing unit tests, images confirmed on R2 at `apps/nordic/...`, prebuild
wired, no broken postBuild. Deploying it first validates the pipeline against
the best content in the fleet.

- [x] Land §A, rebuild, confirm bundle size — clean build 840 MB, 381 MB after ignore
- [~] **Blocked on §A4.** `--server` reached the build worker and returned
      `413: Artifact exceeds 524288000 bytes (Content-Length: 554782322)`.
      `_shared` is 368 MB of the 381 MB. The local `mode=v1` path failed
      differently — `ECONNREFUSED 172.21.0.2:5432` and `172.21.0.3:6379`,
      control-plane-internal addresses dialled from a laptop, **while exiting 0**
- [ ] Reconcile the domain: mission-control has `nordic.quest.blueforge.studio`, the config has `nordic.lang-quest.blueforge.studio`; neither resolves
- [ ] Verify live: root 200, `chapters.json` real JSON not SPA fallback, a chapter-15 lesson loads, images resolve from the CDN

## §C · Release the clean languages behind unfinished siblings

Zero content work; a flag per language.

- [ ] lq-east-asian: `enabled: false` on chinese + cantonese → a Japanese/Korean release, 15/15 each, 0 dangling
- [ ] lq-english: hold british/australian/scottish at their honest `shipChapters: 10`, welsh at 5, ship american at 15
- [ ] Fix the 3 failing lq-english unit tests (2 are real bugs in `findPreservationBreaches` — a dropped preserved key yields 0 breaches)
- [ ] Decide the 214 missing `american` audio refs: generate, or drop the refs

## §D · Close lq-romance to 15 chapters

The one live app, serving stale content: production advertises and serves 15
chapters while the source now ships 5.

| language | dangling | per-chapter (ch6-15) |
|---|---|---|
| french | 34 | 3,4,4,3,4,2,3,3,3,5 |
| italian | 34 | 3,4,4,3,4,2,3,3,3,5 |
| portuguese | 25 | 2,3,3,2,3,1,2,2,3,4 |
| spanish | 26 | 2,3,3,2,3,1,2,2,4,4 |
| romanian | 60 | 3,4,4,3,4,10,8,8,8,8 |

- [ ] Author the 179 lessons, cheapest chapters first
- [ ] Re-run `set-ship-chapters.ts`, expect 15 across all five
- [ ] Redeploy; production stops advertising what it cannot serve

## §E · Nordic's disabled locales — ~1,700 authored files behind a flag

`danish` carries 7 locale trees with only `en`/`th`/`zh` enabled; `norwegian`
and `swedish` carry 4 with only `en`. The disabled `de`/`es`/`fr`/`vi` trees are
at **full parity** with the enabled ones (210/173/172 files against 210/173/173).

- [ ] Audit one disabled tree for translation quality before trusting the rest
- [ ] Promote what passes; leave the rest held with a written reason

---

## Where the previous roadmap got to

`CONTENT_WIRING_ROADMAP.md`, opened earlier the same day.

| § | state |
|---|---|
| §1 unlock written lessons | **done** — `unlisted` 1,416 → 0 |
| §2 untranslated trees | **done** — premise was wrong; real fault (`enabled` ignored by all 14 generators) found and fixed |
| §3 renames / propagation | renames **done** (168 dead entries); propagation of 215 lessons still open |
| §4 CI guard | **written and green**; publish **blocked** — `npm publish` 403, read-scoped token |
| §5 authoring backlog | inventory **done**, `shipChapters` **done**; bulk authoring **deliberately dropped** in favour of this plan |

Fleet faults: `no-index` 62 → **0**, `invalid` 188 → **0**, `unlisted` 1,416 →
**0**, `dangling` 5,829 → 5,423. Emitted output: 6,589 lessons, 0 empty, 0 that
404. Languages below 5 chapters: 14 → **0**.

### Still open from it, unchanged by this plan

- Publish `@learnquest/unit-core@0.1.5`, then bump the 14 apps and add the spec
- Propagate the 215 renamed lessons; promote-or-hold the 39 alpha locales
- Adjectives & locative prepositions (spec written, unimplemented)
- Register the Turkish, Uralic, Semitic/Persian and Celtic family specs
- Re-run Thai after the `isCandidate` combining-marks fix
- South Asian: apply `ur` (47) and `pa` (69, up from 61) to content; ~330 splits await adjudication

---

## Progress log

| date | what landed |
|---|---|
| 2026-09-04 | **§B attempted, blocked.** Server pipeline rejects a 554 MB artifact (500 MB cap); `_shared` is 368 MB of it. Local `mode=v1` path fails on control-plane-internal Postgres/Redis while exiting 0. §A4 promoted to critical path |
| 2026-09-04 | **§A done.** ignore lists rewritten dist-relative (1.5 GB to 358 MB), broken `sync-assets-to-r2.sh` postBuild dropped from 12 apps, `prebuild` wired in 12 — committed across all 14 app repos |
| 2026-09-04 | **§A4 opened.** `_shared` pushed to `<group>/_shared/` but read from bucket root; 37% of sampled files 404 there. The inert ignore list was masking it |
| 2026-09-04 | Plan opened. Measured the two maturity axes; corrected the `ignore`-blocks-content finding — patterns are dist-relative and inert, so the fault is a 1.5 GB tarball, not missing content |
