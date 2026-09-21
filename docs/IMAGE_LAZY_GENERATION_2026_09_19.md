# Lazy asset generation — design spec

*Draft, 2026-09-19. Mirrors the TTS lazy-cache architecture (see
`docs/TTS_CACHE_HANDLER.md` for the canonical contract). Covers **two
app families and three asset types**: lang apps (image + per-key icon
generation) and books-platform apps (image + narration + SFX/ambient
audio). Operator-confirmed home: **lq-core** (`@learnquest/web-core`,
`@learnquest/hooks`, `@learnquest/ui`).*

---

## Context

Upfront asset generation across the 14 lang apps and the 7 books apps is
**complete but uneconomic**:

- Per `learn-quest/CLAUDE.md` Asset gen-configs state, lang is **14/14
  COVERED** with **configImages 28,240 vs diskImages 25,719** — ~2,500
  configs that no learner has ever asked for.
- The fleet re-audit of school apps (geography, reading, writing) cost
  ~$130 for n=384 images. Re-auditing the back catalog of lang apps at
  the same rate would cost ~$1.5–3k for an asset pool that a learner
  might never render.
- `ai-audit-images.ts` audit vision LLM is **non-deterministic**
  (`feedback_audit_non_deterministic.md`) — any audit pass covers only
  one snapshot; rerunning is not idempotent.
- For books-platform, **image assets** flow through Replicate Flux
  Schnell in `books-image-worker` + `book-builder` (per
  `learn-quest/CLAUDE.md` § Asset gen-configs state — Books row);
  **narration** flows through `@blueforge-studio/audio-gateway`
  ReplicateTtsAdapter/Kokoro or Edge TTS (per
  `project_activity_book_audio_2026_09_15.md` +
  `project_adventure_book_audio_2026_09_15.md`); **SFX/ambient** has
  no pipeline today and falls back to a reuse-first catalog
  (soundimage.org CC BY 4.0 ranked #1, per
  `feedback_audio_reuse_first_2026_09_15.md`). 9/11 books shipped at
  $0 audio vs a $75 baseline — that's reuse-first working.

A lazy pipeline — generate + audit only when an asset first renders —
pays for the assets the learners actually see. The AudioLazyCache
(`project_audio_lazy_cache_2026_09_15.md`) demonstrated the pattern
works end-to-end: content-addressed hash, `STORAGE_PROVIDER`-switched
storage, scoped write key, fail-open semantics. Images and SFX/audio
are heavier generation costs but the same architecture, with one
important addition for books: **reuse-first search before generation
for SFX/audio**, carried over from the existing
`feedback_audio_reuse_first_2026_09_15` directive.

Goal: **a single learner request for a not-yet-cached asset pays one
generation (or $0 if reuse covers it) + one audit, and never repeats;
the second learner pays $0.**

---

## Goals

1. **No upfront batch for learn-quest or books-platform apps.** Drop
   the `--batch` / `--realtime` pre-pass for any asset with a stable
   spec hash. Pre-pass remains for the Chapter-1 pilot and any
   explicit `--chapter=N` regeneration
   (`scripts/lib/config-bootstrap/regen-chapter.ts`).
2. **Lazy audit only.** No asset audit runs unless the asset is
   requested (or the operator runs an explicit `--audit-only` job).
3. **Reuse-first for SFX/audio on books.** A render request for an SFX
   asset **first probes the reuse catalog** (soundimage.org,
   freesound.org CC-licensed librarie, the existing audiobook asset
   pool) before any generation call. Generation is the fallback, not
   the default — matching the existing reuse-first directive that
   shipped 9/11 books at $0 audio.
4. **Cost is bounded per request.** Generation + audit for a single
   cold asset is the floor; reuse hit or cache hit is $0.
5. **No provider-specific code in the handler.** Same `StorageService`
   switch as the TTS handler (`cloudflare_r2` prod, `minio`
   non-production, `memory` tests) for both platforms.
6. **Same resolver sees lazy, pre-generated, and reuse-cache assets.**
   `learn-quest/docs/ASSET_RESOLUTION.md` § Two resolution systems
   must treat `apps/<family>/<app>/<asset>/lazy/<hash>.webp`,
   `apps/<family>/<app>/<asset>/<scene>/<word>.webp`, and
   `apps/<family>/<app>/asset-reuse/<source>/<id>.webp` identically.

## Non-goals

- **No new image-models.** Use the existing `gemini-3.1-flash-image`
  default from `BATCH_DEFAULT_MODEL` in `@blueforge-studio/image-gen`.
- **No new region-tiers.** Continue with `@regional/<region>/vocab/...`
  on lang; reuse-existing book-scene prefixes on books.
- **No migration of existing pre-generated assets** (lang 25,719 disks;
  books 9/11 audio reuse). They stay where they are; lazy is
  forward-only.
- **No change to `ai-audit-images.ts` CLI** — that's the batch auditor.
  The new lazy-audit path lives as a sibling, not a fork.

---

## Design — three lazy pieces, applied per asset type

### 1. Lazy generation (per asset type)

The endpoint family mirrors `POST /api/tts/synthesize` exactly:
probe → reuse-check (SFX/audio only) → generate → upload → return URL.

```
Asset renders → useAssetUrl(asset) hook
                  ↓ (probe R2/MinIO + reuse catalog for SFX)
                miss → POST /api/assets/lazy { AssetSpec, assetType }
                                  ↓
                              server: probe → reuse-check? → generate → upload → return URL
                                ↓ (race guard: per-key in-process lock + PUT-if-absent)
                              client: cache URL locally, render
```

**Three asset types, three spec shapes:**

| Asset type | Endpoint | Spec example |
|---|---|---|
| `image` | `POST /api/assets/lazy` `{ assetType: "image", spec: ImageSpec }` | `{ group: "romance", language: "french", scene: "@regional/paris-seine/vocab", label: "l'hôtel", category: "vocab", style: "high-quality realistic cartoon", rev: "2026-09-19", imageType: "square-1024" }` |
| `audio-narration` | `POST /api/assets/lazy` `{ assetType: "audio-narration", spec: AudioNarrationSpec }` | `{ platform: "books-platform", app: "story-book", book: "the-three-bears", chapter: 1, page: 3, text: "Quelqu'un a mangé ma bouillie.", voice: "fr-FR-DeniseNeural", rev: "2026-09-19" }` |
| `audio-sfx` | `POST /api/assets/lazy` `{ assetType: "audio-sfx", spec: AudioSfxSpec }` | `{ platform: "books-platform", app: "adventure-book", book: "dungeon-of-doom", scene: "tavern-brawl", label: "sword-clang", duration: 1.2, rev: "2026-09-19" }` |

**Reuse-first flow** (SFX/audio only, not images):

```
missing on R2/MinIO?
  ├─ yes → check reuse catalog (soundimage.org index, freesound CC cache, internal audiobook pool)
  │     ├─ HIT  → upload reuse asset to R2/MinIO under stable key, return URL, $0 gen
  │     └─ MISS → fall through to generate path
  └─ no  → return URL, $0
```

The reuse catalog is a **server-side index**:
- External CC-licensed lib metadata (provider, license, original URL,
  attribution string, duration, tags).
- Internal pool of already-generated assets from earlier books
  (`adventure-book/audio/tavern-brawl/sword-clang.mp3` is reusable
  by `dungeon-of-doom`).
- Backing store: a small SQLite or Postgres table keyed by
  `(assetType, label, duration-bucket, tags)`.

### 2. Lazy audit (image and any gen-required asset)

For image, the audit runs in the same handler right after generation.
Uses existing `visionAuditOne(imageBuffer)` in `image-tools` (same
function `ai-audit-images.ts` invokes per file). Sidecar JSON:

```
apps/<family>/<app>/<asset>/lazy/<hash>.audit.json
{ "score": 6, "verdict": "keep", "auditedAt": "...", "modelVersion": "..." }
```

For audio narration and SFX, audit semantics differ:

- **Narration**: no vision audit (it's audio). Quality score is a
  service-level check (length vs target, no clipping, voice matches spec)
  — a 5-line Node script, not an LLM. Run inline; no score sidecar, but
  a `narration.meta.json` with `{ durationMs, voiceMatched, peakDbfs }`.
- **SFX (reused)**: no audit at all; the reuse catalog entry is the
  attestation.
- **SFX (generated)**: light audit via the same `visionAuditOne` path
  if a `waveform.webp` thumbnail is generated (cheap; helps users
  know if the sfx is "loud" / "quiet" / "muffled").

A separate audit *miss* flow (assets that exist but no sidecar):

- Frontend requests an asset that exists on storage but has **no
  sidecar** (the legacy lang 25,719 images + the existing audiobook
  mp3s). Handler returns the URL, schedules a background audit, sidecar
  written on completion.
- Audit scheduler: per-process LIFO queue, max 4 concurrent, fed by
  the handler. No external queue; the asset renders immediately and
  the audit catches up.

### 3. MiniMax-M3 prompt / spec composition

The `AssetSpec` the frontend has is minimal
(`{family, app, scene, label, category}`). The full Gemini prompt or
the generation parameters are composed by **MiniMax-M3** at request
time, using a small system prompt and the spec as the user message.
Composition is one synchronous chat completion before the asset call.

Three concrete wins:

- **Configs stay tiny.** A `vocab-image-config.json` is one line per
  word instead of a 200-word directive; an SFX spec is a label + tag,
  no manual prompt authoring.
- **Models and directives can change without re-authoring.** Update the
  system prompt once; every lazy call reflects it.
- **Test the prompt strategy in isolation.** Same M3 system prompt
  drives both the lazy endpoint and the existing batch flow
  (`processConfigBatch`); the gap between "spec composed" and
  "asset generated" is one function.

The M3 call is **bounded**: 200ms target, 2s timeout, fallback to a
cached directive template if the call fails. A fail-open short spec
keeps the lesson moving.

---

## Components

| Piece | Lives in | Purpose |
|---|---|---|
| `POST /api/assets/lazy` handler | `@learnquest/web-app` server route (or `@learnquest/web-core` if serverless) | Probe → reuse-check → compose prompt → generate → upload → audit → return URL |
| `ttsCacheKey`-equivalent `assetLazyKey(spec, assetType)` | `@learnquest/web-core/src/lazy-asset/key.ts` | Pure content-addressed hash; testable |
| `useAssetUrl(item, options)` | `@learnquest/hooks/src/use-asset-url.ts` | Client hook, prefetch on hover, in-memory + IDB cache, asset-type-aware |
| `LazyAsset` UI component | `@learnquest/ui/src/LazyAsset.tsx` | Renders placeholder while generating; shows quality badge from audit sidecar |
| `M3ComposeSpec(assetType, spec)` | `@learnquest/web-core/src/lazy-asset/prompt.ts` | MiniMax-M3 spec composition, bounded + cached |
| `visionAuditOne` lazy wrapper | `lq-tools/packages/image-tools/src/audit/lazy-audit.ts` | Audit one asset, write sidecar, return score |
| Reuse catalog | `@learnquest/web-core/src/lazy-asset/reuse-catalog.ts` + `lq-operations/data/reuse-catalog.{json,sqlite}` | SFX/audio reuse-first index; backed by `lq-operations/scripts/build-reuse-catalog.ts` |
| Storage abstraction | Existing `@blueforge-studio/service-storage` `createStorageService()` | Re-used unchanged |

The endpoint lives in `@learnquest/web-app` (per
`TTS_CACHE_HANDLER.md` § Working with both R2 and forge-control MinIO);
M3 spec composition, the hash function, and the reuse catalog sit in
`@learnquest/web-core` so unit tests don't need a running server.

---

## Storage layout

```
apps/<family>/<app>/<assetType>/lazy/<hash>.<ext>             (lang image, books image, narration, generated SFX)
apps/<family>/<app>/<assetType>/lazy/<hash>.audit.json        (image sidecar)
apps/<family>/<app>/asset-reuse/<source>/<id>.<ext>           (CC reuse cache; <source>=soundimage|freesound|internal)
apps/<family>/<app>/narration.meta.json                       (narration service-level metadata)
```

- **Under existing asset prefix** so the asset-resolver
  (`AssetService`/`AssetMapProvider`) finds lazy assets the same way
  it finds pre-generated ones.
- **`lazy/` segment** keeps lazy output separable — it can be swept,
  re-generated on directive change, or excluded from a sync without
  touching pre-generated assets.
- **`asset-reuse/` segment** is the canonical location of an imported
  CC asset; attribution strings live next to it
  (`asset-reuse/soundimage/<id>.LICENSE.txt`). The reuse-catalog
  lookup resolves to this prefix.

The asset hash input set:

```
image:           {family, app, scene, label, category, style, rev, modelVersion}
audio-narration: {family, app, book, chapter, page, text-hash, voice, rev, modelVersion}
audio-sfx:       {family, app, scene, label, duration-bucket, source, rev, modelVersion}
```

`text-hash` for narration is the SHA-256 of the canonical text (with
whitespace normalised + diacritics), not the raw string — corrects for
"queen." vs "queen." differences. `source` for SFX is `reuse:<provider-id>`
when the asset is reused and `generated` when freshly minted — both
hash stably so a transition from reuse to generate forces
invalidation.

A 16-trit SHA-256 is enough — collisions are recoverable.

---

## Client integration

`useAssetUrl(item)` in `@learnquest/hooks`:

```
state = one of:
  'idle'              // nothing requested yet
  'cached'            // in-memory or IDB hit
  'probe'             // HEADing storage + reuse catalog
  'compose'           // M3 prompt/spec composition
  'generate'          // POST → 200 generating
  'audit'             // 200 cached, sidecar arrives later
  'ready'             // has a URL; renders
  'low-quality'       // image audit verdict < threshold, badge shown
  'reuse'             // SFX/audio reused from catalog, attribution string shown
  'error'             // generation failed, fallback to emoji glyph / silence
```

- **Lazy fetch on `IntersectionObserver` enter.** Triggered when the
  card / page scrolls into view; not on lesson-load (cards 50–200 in
  deep lessons, prefetch-everything is wasteful).
- **Prefetch on hover** for the focused card; generates start ~250ms
  before the tap.
- **In-memory + IDB cache.** The hash is the key; one map entry per
  process, one IDB row per `AssetSpec` for next-session warm-start.
- **`localStorage` flag** `IMAGE_LAZY_CACHE_DISABLED` to disable per-app
  (rollback without deploy).
- **Placeholder** is a single-colour panel with the label's `[[letters]]`
  in the language's typography — generated client-side, no asset.
- **Books-platform audio player**: when a page enters view and audio
  narration is registered, fire `useAssetUrl({assetType: 'audio-narration',
  ...})`; the player shows a "loading narration…" state until URL
  arrives.

---

## Cost model — per request

| Path | Cost (image) | Cost (audio-narration) | Cost (audio-sfx) |
|---|---|---|---|
| Cache hit | $0 | $0 | $0 |
| Reuse hit | n/a | n/a | **$0** (catalog fetch + R2 upload of imported asset) |
| Reuse miss → generate | n/a | n/a | ~$0.10–0.30 (Replicate TTS music gen / Kokoro SFX) |
| Cache miss → generate | ~$0.05–0.10 | ~$0.00–0.05 (Edge TTS = $0, Kokoro fallback ~$0.02) | ~$0.10–0.30 |
| Cache miss + audit | ~$0.003 (vision LLM) | $0 (length/peak meta only) | n/a |
| Stampede on first request | per-key lock + `PUT`-if-absent collapses N → 1 generation across all asset types |

**Per-learner floor**: a learner renders ~200 unique cards in
chapter 1 (lang); at ~$0.07 per cold card, the chapter cost ceiling
is **~$15 per 200 first-render misses**, drop to $0 on revisit. For
books, the reuse-first directive pulls most SFX to $0
(per `feedback_audio_reuse_first_2026_09_15.md`).

---

## Failure modes + mitigations

Mirror `TTS_CACHE_HANDLER.md` § Failure modes:

- **Stampede.** Per-key in-process lock + R2 `PUT`-if-absent. 20
  simultaneous requests on a never-generated asset → 1 generation, 1
  write, 20 returns.
- **Storage down.** Generation succeeded, write failed. Return a
  ephemeral blob URL (`/api/assets/lazy/blob?hash=...`) so the lesson
  renders; log + retry the write on next request.
- **Generation down.** Return a placeholder URL
  (`/api/assets/placeholder?label=...`) with a clear 200 + `cached: false`,
  `placeholder: true`. The lesson moves.
- **Reuse catalog down (SFX only).** Fall through to generation path;
  the reuse step is best-effort, not blocking.
- **Audit down.** Return `cached: true` for the asset URL but
  `audit: null`; the client omits the quality badge.
- **M3 down.** Fall through to a 5-line cached directive template. The
  asset still generates; quality may drift to the directive floor.
- **Cost / abuse.** `/api/assets/lazy` accepts only specs whose
  `family`, `app`, `scene`, `book`, `chapter` are in a server-side
  allowlist of known `(family, app, book)` pairs — same control the
  existing `/api/tts/synthesize` needs (and doesn't yet have; the spec
  adds it at the same time).
- **License attribution drift (reuse catalog).** A reused SFX asset's
  attribution string MUST appear in the page metadata. *Mitigate*:
  enforce via a webhook on `apps/<family>/<app>/asset-reuse/*.LICENSE.txt`
  upload — the L1 player reads it; if missing, the page renders with
  a "missing-attribution" warning bar and blocks the lesson.

---

## Cross-platform coverage — books-platform extension

The lang side is documented above; the books-platform side reuses the
same handler with different `AssetSpec` shapes. Three concrete
adaptations:

### 1. Books-platform image lazy (per-book scene illustrations)

```
spec: ImageSpec
{ platform: "books-platform",
  app: "story-book" | "adventure-book" | "interactive-book" | ...,
  book: "the-three-bears",
  chapter: 1,
  page: 3,
  scene: "porridge-table",
  style: "children-book-watercolor",
  rev: "2026-09-19",
  imageType: "wide-1600x900" }
```

Replaces the per-book-image build step
(`books-image-worker` + `book-builder` via Replicate Flux Schnell, per
`learn-quest/CLAUDE.md` § Books). The Chapter-1 pilot for the books
side is every page's first illustration (typically 8–12 per book).

### 2. Books-platform narration audio lazy

```
spec: AudioNarrationSpec
{ platform: "books-platform",
  app: "story-book",
  book: "the-three-bears",
  chapter: 1,
  page: 3,
  text: "Quelqu'un a mangé ma bouillie.",
  voice: "fr-FR-DeniseNeural",
  rev: "2026-09-19" }
```

Mirrors `POST /api/tts/synthesize` but **scoped per book** —
`(book, chapter, page, voice)` is the hash input. The existing
`activity-book` (`project_activity_book_audio_2026_09_15.md`, 16 mp3s)
and `adventure-book`
(`project_adventure_book_audio_2026_09_15.md`, 266 mp3s) pipelines
gain a unified lazy path; production switches over once the new
endpoint replaces `books-build-audio.ts`.

### 3. Books-platform SFX / ambient audio lazy (reuse-first)

```
spec: AudioSfxSpec
{ platform: "books-platform",
  app: "adventure-book",
  book: "dungeon-of-doom",
  scene: "tavern-brawl",
  label: "sword-clang",
  duration: 1.2,
  rev: "2026-09-19" }
```

The SFX handler differs from the others in that **reuse-first is the
default, not the optimisation**. The reuse catalog is built by:

```
lq-operations/scripts/build-reuse-catalog.ts
  --sources=soundimage,freesound,audiobook-pool
  --output=lq-operations/data/reuse-catalog.sqlite
```

Re-running this script refreshes the catalog; production update is
weekly (cron via `forge-control` deploy — see
`docs/claude/fleet.md` for the fleet scheduler). Reuse-fail metrics
count toward the reuse-first KPI on the
`feedback_audio_reuse_first_2026_09_15` directive.

**Generation fallback** when no reuse covers: same `audio-gateway`
ReplicateTtsAdapter/Kokoro path the existing pre-bake used, but
invoked lazily at request time rather than at book-build time.

---

## Gate config + kill switch

```
IMAGE_LAZY_GENERATION_ENABLED = "true"             // default false in prod until pilot
IMAGE_LAZY_AUDIT_ENABLED = "true"                   // default true when generation enabled
IMAGE_LAZY_REUSE_CATALOG_ENABLED = "true"          // default true; SFX/audio only
IMAGE_LAZY_M3_SPEC_ENABLED = "true"                 // default true; "false" forces cached directives
IMAGE_LAZY_RATE_LIMIT = "60/min"                    // per IP, anti-abuse
IMAGE_LAZY_AUDIT_THRESHOLD = 5                      // verdict < 5 → "low-quality" badge
```

- Per-app `localStorage` override `IMAGE_LAZY_CACHE_DISABLED = "1"`.
- Per-books-app override `BOOKS_LAZY_AUDIO_DISABLED = "1"` to fall
  through to the pre-baked `books-build-audio.ts` pipeline while the
  lazy path is being validated.
- The legacy pre-passes (`regen-chapter.ts --batch`,
  `books-build-audio.ts`) coexist with lazy; the two never write the
  same key (legacy under `<assetType>/<scene>/...`, lazy under
  `<assetType>/lazy/...`).

---

## Integration plan

Five PRs, sequenced:

| # | Repo | Change |
|---|---|---|
| 1 | `@learnquest/web-core` | `assetLazyKey(spec, assetType)`, `M3ComposeSpec`, reuse catalog, `LazyAuditResult` types; unit tests against the `memory` storage adapter |
| 2 | `@blueforge-studio/image-gen` | `LazyAssetClient` thin wrapper around `processConfigBatch.processOneImage`; `imageAuditOne` exposed as a sibling to `auditImages` |
| 3 | `@learnquest/web-app` | `POST /api/assets/lazy` handler; scoped write keypair env wiring; per-(family,app) allowlist |
| 4 | `@learnquest/hooks` + `@learnquest/ui` | `useAssetUrl` hook + `LazyAsset` component + `IntersectionObserver` prefetch |
| 5 | Lang app + books app | Wire `LazyAsset` into a single chapter's vocab card render (lang) and a single book's pages (books) |

PRs 1–4 land behind the `IMAGE_LAZY_GENERATION_ENABLED=false` default.
PR 5 flips the gate for the pilot apps and ships.

### Pilot targets — TBD

Operator-decision. Two candidates per family:

**Lang side**: `lq-romance / French / chapter-1` (greetings +
introductions). ~30 cards, the smallest chapter with active learners;
already has a pre-generated image set, so cache-hit path is exercised
immediately.

**Books side**: `books-platform / story-book / "the-three-bears"`. 8
pages, the smallest book with active readers; reuse-first SFX will
return hits from the catalog the moment it builds.

---

## Pilot test design

Operator-decision. Acceptance criteria are independent of which app is
chosen.

| Metric | Target | Measurement |
|---|---|---|
| Cold-start latency (95p) | < 8s image, < 4s narration, < 6s SFX | Server-side timing emitted to log; `./scripts/lazy-bench.ts --runs=10 --assetType=…` |
| Stampede rate | 1 generation per N concurrent misses | Concurrent fetch test against `/api/assets/lazy` for the same spec |
| Reuse hit rate (SFX) | ≥ 60% week 1, ≥ 75% week 2 | Count reuse/miss in handler logs |
| Image audit decision rate (verdict ≥ threshold) | ≥ 85% of generated cards | Read sidecar JSON, count `verdict == "keep"` |
| M3 spec correctness | ≥ 90% match against cached directive baseline | Diff `(composed spec) == (cached directive)` on 50 calls |
| Cost per cold asset | ≤ $0.10 image, ≤ $0.05 narration, ≤ $0.05 SFX reuse, ≤ $0.30 SFX gen | Sum per-request cost from log |
| Asset-resolver parity | 100% | `vocab-basic-nouns.json` cards and `story-book pages` render identically via lazy/pre-generated/reuse |
| Rollback time | < 5 min | Flip gates + clear IDB; render returns to pre-generated path |
| Attribution fidelity (reuse) | 100% of reused assets have an attribution string in the page metadata | Crawl played pages; assert `attribution` field populated |

Pilot runs for 7 days, three cohorts (33/33/33 random per chapter):

- **A (control)**: pre-generated path; no `/api/assets/lazy` calls.
- **B (lazy, no reuse)**: `/api/assets/lazy` enabled, generation-only,
  reuse catalog disabled.
- **C (lazy + reuse)**: `/api/assets/lazy` enabled, reuse-first.

Ship criteria: C hits the cost floor (≥80% cache-hit or reuse-hit on
day 3) AND asset-resolver parity (no `lazy/` URL returns a 404) AND
attribution fidelity 100%.

---

## Risks

- **Render-time latency on the first asset after cache cold.** 3–8s
  for the image; 1–4s for narration; 2–6s for SFX-gen. *Mitigate*:
  prefetch on `IntersectionObserver` + hover, so the user-facing
  moment has a cached URL or a placeholder; never a blocking render.
- **MiniMax-M3 spec drift.** A model upgrade could change the spec
  semantics, and every lazy asset gets a new hash. *Mitigate*: pin
  `modelVersion` in the spec; bump intentionally via `rev`.
- **Audit vision LLM non-determinism
  (`feedback_audit_non_deterministic.md`).** The same image gets
  different scores on re-audit. *Mitigate*: the sidecar is written
  once; re-audit is opt-in via `--audit-only` rerun.
- **MinIO write-key scope.** A single key per app; today only R2 has a
  scoped key. *Mitigate*: same scoping pass the TTS handler needs
  (`TTS_CACHE_HANDLER.md` § Credentials); land at the same time.
- **Asset resolver treats lazy, pre-generated, and reuse assets as
  interchangeable.** If `apps/<family>/<app>/<assetType>/lazy/<hash>.webp`,
  `<assetType>/<scene>/<word>.webp`, and `<assetType>/asset-reuse/<source>/<id>.webp`
  differ in metadata (`metadata.audit.auditedAt`,
  `metadata.audit.score`), the canvas app may pick wrong. *Mitigate*:
  the lazy sidecar JSON + reuse catalog index populate the same
  `metadata.audit` shape as the pre-generated side
  (`scripts/lib/config-bootstrap/audit.ts`).
- **License attribution drift (reuse catalog).** *Mitigate*: a
  `forge-control` deploy-time check fails the deploy if any
  `asset-reuse/*.LICENSE.txt` is missing for an asset that has an
  entry in `reuse-catalog.sqlite` marked `requires_attribution=true`.
- **Per-book narration lazy invalidates the existing 16+266 mp3
  pipeline.** `activity-book` + `adventure-book` ship with pre-baked
  audio; switching to lazy means the first render is slow (~3–4s).
  *Mitigate*: ship lazy behind `BOOKS_LAZY_AUDIO_DISABLED=true`
  default; pilot flips it for `story-book/the-three-bears` only.

---

## Cross-links

- `docs/TTS_CACHE_HANDLER.md` — audio endpoint this spec mirrors
- `learn-quest/CLAUDE.md` § Asset resolution — read before touching
  the resolver
- `learn-quest/docs/ASSET_RESOLUTION.md` § Two resolution systems
- `project_audio_lazy_cache_2026_09_15` — AudioLazyCache summary; gate
  and `useAudioNarrationUrl` pattern to mirror
- `feedback_audit_non_deterministic` — audit re-record instability;
  mitigates the "audit twice and disagree" risk
- `feedback_use_project_sync_scripts` — R2 pushes via
  `lq-operations/scripts/sync-to-storage.ts`, not `aws s3`
- `reference_asset_resolution` — naive image counts are ~5× wrong;
  pre-pass 28k configs may overstate by ~3×
- `project_books_platform_live` — books-platform current state
- `project_activity_book_audio_2026_09_15` — Edge TTS, 16 mp3s, traps
  hit (EdgeTtsAdapter 403, tools-shared subpath, writeback re-parse)
- `project_adventure_book_audio_2026_09_15` — ReplicateTtsAdapter
  +Kokoro af_bella, 266 mp3s, throttling + writeback traps
- `feedback_audio_reuse_first_2026_09_15` — books-platform reuse-first
  policy; reuse catalog mirrors this 1:1
- `project_l1_wave1_status` — Stage A + Slice 1 landed; lazy image
  audit integrates with the existing `metadata.audit.auditedAt`
  scaffold

---

## Status

- **Drafted**: 2026-09-19.
- **Initial scope**: image lazy gen + image lazy audit on lang apps.
- **Expanded scope** (operator, same session): books-platform apps,
  asset types image + narration + SFX/ambient; reuse-first reuse
  catalog integrated.
- **Paused workstream**: French ch11 AI authoring (8 of 10 lessons
  authored on `chore/french-ch10-15-ai-authoring-2026-09-19`;
  remaining: `multiple-choice-travel` + `review`). Will resume once
  PR 1 lands.
- **Pilot targets locked** (operator, same session):
  - **Lang**: `lq-romance / French / chapter-1` (greetings +
    introductions, ~30 cards).
  - **Books**: `books-platform / story-book / the-three-bears`
    (8 pages, narration + reuse-first SFX potential).
- **Rollout strategy locked** (operator, same session):
  - Gate-off-first: PRs 1–4 land behind
    `IMAGE_LAZY_GENERATION_ENABLED=false`; PR 5 wires the pilots and
    flips the gate.
- **Open**: none blocking PR 1.
- **Next**: scaffold PR 1 (`@learnquest/web-core` lazy-asset package —
  `assetLazyKey`, Zod spec types, unit tests against the `memory`
  storage adapter).
