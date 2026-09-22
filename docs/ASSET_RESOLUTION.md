# Asset resolution and measurement

*How images actually get found at runtime, and how to count and audit them
without arriving at wrong numbers. Written 2026-08-31 after an investigation
that produced three wrong answers before the right one.*

Read this before you write a script that counts images, or before you conclude
that an app's imagery is "missing", "unwired" or "clean".

## Two mechanisms, not one

Image resolution runs on **two independent systems**. Confusing them is the
single most common mistake.

### 1. Per-domain asset maps — `index.json`

`AssetService.loadAssetMap()` (`lq-core/libs/common/assets/src/AssetService.ts`)
loads asset maps **lazily, per domain**. At startup it pulls only what the first
render needs:

- `backgrounds` — screen backgrounds
- `illustrations` — onboarding carousel
- `avatars` — character preview on onboarding/profile
- `ui` — frame overlays, icons

Everything else arrives on demand via `loadImageDomain()`. These maps are the
`index.json` files scattered through `public/` — `_shared/images/ui/achievements/index.json`,
`languages/<lang>/images/rpg/bosses/index.json`, and so on. The provider that
drives this is `AssetMapProvider` (`lq-core/libs/infra/database/src/providers/AssetMapProvider.ts`),
priority `CRITICAL`, consumed by `useLoadedApp` and `routeDependencies`.

A **sparse index.json set means sparse asset maps**, which is a real wiring gap
for those domains — distinct from lesson imagery, and *not* caught by the
content-integrity test below.

### 2. Path-convention refs in lesson content

Lesson JSON references images by path, in three forms:

| Form | Example |
|---|---|
| language-relative | `images/lessons/vocabulary/professions/doctor.webp` |
| shared | `/_shared/images/vocab/carnival.webp` |
| regional pool | `@regional/universal/vocab/work.webp` |

Conversation lessons additionally use `sceneRef` and `characterRef`.

Resolution is **canonicalize, then override-then-fallback**, implemented in
`resolveAssetOnDisk` inside `@learnquest/unit-core`:

1. strip a leading `/`
2. strip the `_shared/images/` or `images/` prefix to get a canonical path
3. try the per-language override — `public/languages/<lang>/images/<canonical>`
4. fall back to the shared default — `public/_shared/images/<canonical>`
5. fall back to the raw path — `public/<ref>`

`@regional/` refs are validated by **namespace and path shape only, never disk
presence** — that pool lives outside the repo. Valid namespaces: `universal`,
`african`, `asian`, `middle-eastern`, `western`.

## `public/data/asset-map.json` is a decoy

It is an **empty scaffold**, written as `EMPTY_ASSET_MAP` by
`lq-tools/packages/asset-scaffolding/src/scaffold-assets.ts`. Nothing reads it.

Finding it empty tells you **nothing** about whether an app's images are wired.
Do not conclude "asset maps aren't used" from it — they are, as the per-domain
`index.json` files above.

## Counting traps

Naive counting inflates image totals by **5× or more**. lq-nordic was measured
at 9,496 images when the true base-image count is **1,690**.

### Symlinked directories

Several `public/` subtrees are symlinks:

- `languages/<lang>/images/lessons/vocabulary` → `_shared/images/lessons/vocabulary`
  (one shared pool for all languages in a group — the Nordic languages have
  little cultural divergence, so vocabulary art is shared)
- `_regional/universal` → `../../../../lq-operations/assets/regional/universal`
  — **points outside the repo**

Python's `glob.glob(..., recursive=True)` **follows directory symlinks**;
`find` does **not**. That difference alone double-counted the shared pool once
per language. `coverage-audit.ts` uses `readdirSync` + `isDirectory()`, which is
false for symlinks, so it counts correctly.

### Responsive variants

Files matching `--<size>.webp` (`--128`, `--256`, `--512`, `--1280`) are derived
downscales, not distinct images. For nordic: 4,687 files on disk = **1,699 base
+ 2,988 variants**.

`ai-audit-images.ts` audits base images only and records this in its output as
`baseImagesOnly: true` and a `variantRule` string. Any count you report should
use the same denominator.

## `status: "active"` does not mean audited

`index.json` entries are generated with `status: 'active'` by
`generate-missing-indexes.ts`. That is the **generation** default and says
nothing about quality.

Real audit state lives at `metadata.audit`:

```json
"audit": { "auditedAt": null, "score": 0, "needsRegeneration": true,
           "issues": ["regenerated; pending re-audit"] }
```

**"0 flagged" almost always means "never audited", not "clean."** Check
`metadata.audit.auditedAt` before claiming an app's imagery is good. As of
2026-08-31 only lq-nordic had ever been AI-audited (743 of 1,690 base images);
every other language app sat at zero.

A related trap: every app appears to contain the same 7
`image-audit-results-2026-08-11-*.json` files. Those live under
`dist/_regional/universal/vocab/` — inside the shared symlink — and are the
*same files*, not per-app audit history.

## The CDN bucket layout — `lq-assets`

*Added 2026-09-01, after an investigation that found the upload prefixes and the
runtime read paths had never agreed.*

**One bucket serves every LearnQuest app.** The 14 language families, the
school apps and the life apps all point `VITE_ASSETS_BASE_URL` at
`https://lq-assets.blueforge.studio`. That is not incidental — an R2 custom
domain binds to exactly one bucket, so per-app buckets are not reachable
through that domain at all. Anything proposing `<slug>-assets` is wrong.

### Four tiers

```
lq-assets/
  _regional/<region>/…        cross-repo universal pool — one copy, shared by everything
  _shared/…                   the shared root: non-group apps (school, life)
  <group>/_shared/images/…    per-family shared — the 14 language group apps
  apps/<locale>/…             per-locale content
```

`<locale>` is **not** the app slug and **not** bare language. For a group app
`BaseAssetService.locale` is `` `${APP_GROUP}/${getTargetLanguage()}` `` — so
lq-romance reads `apps/romance/french/images/…`. Non-group apps use
`APP_LOCALE`.

### Why `_shared/` is scoped for group apps only

`_shared/` at the bucket root is a single global namespace. That is correct for
the school and life apps: one `_shared/` tree each, no siblings to collide
with.

Group apps are different. Every language family ships its own `_shared/` tree
under the same logical paths, and **the trees are not interchangeable**. Of 492
files in lq-romance and 2,463 in lq-nordic, only 58 paths overlap — and every
sampled overlap is byte-different. `chapters/chapter-9.webp` is different art
in each family. Published unscoped, whichever family deployed last would
silently replace the others' lesson art.

So `sharedCloudPath()` in `path-resolution.ts` prefixes `<group>/` when
`IS_GROUP_APP`, and leaves the root alone otherwise. The gate is the flag, not
a hardcoded family list, so a new group app is scoped the day it sets
`VITE_APP_GROUP`.

Dev is deliberately unscoped — locally the files come from the app's own
`public/_shared/`, where there is one tree and no bucket to share. A path that
reads `/_shared/images/x.webp` in dev is `<group>/_shared/images/x.webp` in
prod, and that asymmetry is intentional.

### Verify before believing

The bucket is public, so a claim about what is published is one command away —
no credentials needed:

```bash
curl -o /dev/null -w '%{http_code}\n' \
  https://lq-assets.blueforge.studio/_regional/universal/vocab/wipe.webp
```

Do this before concluding a tier is empty. A single 404 proves nothing about a
prefix: probing one romance-specific chapter image produced "`_shared/` is
empty", when in fact the root holds a live common core that the integration
tests in `r2-shared-assets.test.ts` assert against.

### Push config must mirror the read path

`assets.r2.push` in each app's `blueforge.config.json` is the upload side of
exactly this table, and it drifted from the reader for a long time — every
prefix was wrong, so cloud assets could not have resolved regardless of which
bucket was named. When you change one side, change the other:

| Source on disk | Prefix | Read by |
|---|---|---|
| `public/_regional/universal` | `_regional/universal` | `@regional/…` refs |
| `public/_shared/images` | `<group>/_shared/images` | `_shared/…` refs |
| `public/languages` | `apps/<group>` | everything else |

### Which bucket, and which backend (decided 2026-09-01)

**`lq-assets` for now.** It is the bucket that actually serves — a key fetched
from `lq-assets.blueforge.studio` returns 200 — and all 14 language apps plus
the school and life apps already point `VITE_ASSETS_BASE_URL` at it.

The account is `fce4dc215a708d705a7d154549959fe0`, and it holds four buckets:
`lq-assets`, `lq-lang-assets`, `lq-life-assets`, `lq-school-assets`.

**`lq-lang-assets` is a deferred split.** It was created to keep the language
fleet out of one large shared bucket, and that is still a reasonable end state,
but nothing serves from it today (404 for a key `lq-assets` has) and the R2
keys in use are scoped to `lq-assets` only — they get `403 AccessDenied` on it.
Revisit **after alpha/beta**; moving buckets mid-flight would mean re-uploading
the fleet and re-pointing `VITE_ASSETS_BASE_URL` for no user-visible gain.

**Credentials: do not trust a stale shell environment for the account id.**
`CLOUDFLARE_ACCOUNT_ID` pointed at a *different* account that does not own
these buckets (the env table above recorded the trap); **the operator corrected
`~/.zshrc` on 2026-09-22** to export `fce4dc21…`, so new shells are right —
re-source it in any long-lived shell that still gets `Authentication error`.
`R2_LANG_PUBLIC_BASE` still points at `lq-lang-assets`, not the live one.
The working set is the account id above plus `R2_LQ_ACCESS_KEY_ID` /
`R2_LQ_SECRET_ACCESS_KEY`, verified with a signed `ListObjectsV2` (200 on
`lq-assets`). Of the Cloudflare API tokens only `CLOUDFLARE_WORKERS_API_TOKEN`
is valid — the other two return `Invalid API Token`.

These three live as project env vars on `lang-quest`
(`e6bd8a3c-8070-4664-8e45-5601f11b3738`), named exactly as the adapter reads
them: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`. `R2_BUCKET`
is **not** among them — sync-to-storage's `buildStorage` bridges
`assets.bucket` in at construction.

### MinIO as a mirror backend — wired, and connected

`forge-infra-minio` is live on the platform host and the config layer
supports a dual setup: `assets.primary` plus `assets.mirrors`.

The resolver/adapter name mismatch that used to break this is **fixed on the
forge-control side** (`resolveMinIOS3` now emits `MINIO_ENDPOINT` /
`MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` aliases beside `S3_*` — PR #684 +
`17079a401`; same shape as the R2 gap fixed in #670). The old table:

| `resolveMinIOS3` used to emit | `providerEnvSchemas.minio` reads |
|---|---|
| `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` only | `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET` |

**R2 stays the primary/serving layer** — zero egress and a custom domain beat
a 75 GB app host's MinIO for public delivery (the 2026-09-01 call, unchanged).
The canonical app shape (lq-nordic, revert `d4cdc420` 2026-09-02) is
`primary: cloudflare_r2 lq-assets` + `mirrors: [minio <group>-quest-assets]` —
the earlier MinIO-primary flip was reverted because it uploaded to a store the
app never read. `generate-app-configs.mjs` now emits exactly this shape.

### `public/data` is deliberately not pushed

Traced 2026-09-01. Nothing under `public/data` needs to be on the CDN:

| Subtree | Consumer | Path | Reality |
|---|---|---|---|
| `data/lessons/**` | `ContentSource` | **same-origin** `/data/lessons/<locale>/…` | Never touches the CDN. Vite copies `public/` into the build (`dist/data/lessons/` is present), so nginx serves it from the image. |
| `data/asset-map.json` | `AssetMapLoader.loadCombined` | `apps/<group>/<lang>/data/asset-map.json` | The one real CDN fetch — and it targets the `EMPTY_ASSET_MAP` scaffold described above. Fails soft. |
| `data/assets/**` | `DOMAIN_FILE_MAP` wants `assets/images/<domain>.json` | CDN | **No app has one.** Every app's `data/assets/` holds only `domains.json`. Fails soft. |

Pushing it would create a second copy of lesson data that no code fetches. The
one config that implied otherwise — lq-nordic's `pull` of `data` into
`/usr/share/nginx/html/data` — was dead twice over and was removed.

Putting lessons on the CDN is a real option for a large tree (lq-nordic's is
18 MB), but it is a deliberate change: `ContentSource` would have to resolve
through `AssetService` instead of root-relative fetches. Not a config patch.

### `audit-specs.json` is live state, not an artifact

Do not sweep it up with `image-audit-results-*.json`. `audit-spec.ts` reads it
via `loadSpecRegistry(imagesRoot)` and writes it back via `saveSpecRegistry`,
so it is a registry that belongs beside the images — 25 files across five apps
as of 2026-09-01. The `image-audit-results-*.json` files *are* artifacts, but
check `.audit-cache.sqlite` before deleting: `runs.id` is the path with `/`
replaced by `__`, and if the row is there the history survives the deletion.

The `filter: "images,audio"` on the `public/languages` push is what keeps both
kinds out of the public bucket — `.json` is in neither category. Keep it.

### Do not put working files under `public/`

`public/` is published to a CDN. In 2026-07 an audit session cached 37
`image-audit-*.json` / `regen-batch-*.json` files into
`lq-nordic/public/_shared/images/`, alongside 20 webp duplicates of files that
already lived in `vocab/`. Once the prefixes were fixed, all 57 would have gone
straight to the public bucket. They were removed 2026-09-01; audit artifacts
belong outside `public/`, and `@blueforge-studio/audit-db` is the durable home
for audit results.

## Tooling

| Task | Command |
|---|---|
| Gen-config coverage, fleet-wide | `npx tsx lq-tools/scripts/coverage-audit.ts` |
| AI quality audit | `npx tsx lq-tools/scripts/ai-audit-images.ts --path=<dir> [--art-style=neutral] [--budget=N] [--max-image-calls=N]` |
| Populate sparse asset maps | `npx tsx lq-tools/scripts/generate-missing-indexes.ts --lang=<code> --images-dir=<dir> [--dry-run]` |
| Verify refs resolve | `npx vitest run tests/unit/content-integrity.spec.ts` (per app) |

`ai-audit-images.ts` defaults to `--max-image-calls=100`; raise it or the run
silently stops short of the directory. Use `--art-style=neutral` to grade
visual quality without enforcing a Nordic/RPG theme.

## How to verify wiring — the canonical test

Every one of the 14 language apps ships `tests/unit/content-integrity.spec.ts`,
which calls `createContentIntegrityTests` from `@learnquest/unit-core` with the
app's `unit.config.ts`. Its single assertion is *"all content files and asset
refs resolve"*, and it also checks that on-disk index sections match the
declared `contentLanguages`.

**Run this instead of writing your own resolver.** An ad-hoc check will get the
canonicalization or the `@regional` rule wrong and report a misleading pass
rate.

What it does **not** cover: the per-domain asset maps of mechanism 1. An app can
pass content-integrity while having almost no `index.json` files — lq-balkan
passes with 10 index files against lq-nordic's 177. Check both.
