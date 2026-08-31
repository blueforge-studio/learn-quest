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
