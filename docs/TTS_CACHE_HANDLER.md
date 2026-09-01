# Lazy TTS with durable cache — handler design

*Draft, 2026-09-01. Written after establishing that `TTSService` posts to
`/api/tts/synthesize` and **no such handler exists**, and that 13 of the 14
language apps have no speech audio at all (and never did — `git log
--diff-filter=D -- '*.mp3'` shows no deletions). For those apps this is not a
fallback; it is the only path.*

## What exists already

| Piece | State |
|---|---|
| `TTSService` (lq-core, client) | POSTs `{text, lang}` to `/api/tts/synthesize`; caches the returned buffer in an **in-memory Map**, lost on reload |
| `/api/tts/synthesize` | **missing** — the client calls an endpoint nobody implements |
| Edge TTS | only `school-quest/scripts/generate-lesson-audio.ts`, a build-time CLI shelling out to Python `edge-tts` |
| `@blueforge-studio/service-storage` | `createStorageService()` switches on `STORAGE_PROVIDER`; adapters for `cloudflare_r2`, `minio`, `backblaze_b2`, `generic_s3`, `memory` |
| Key convention | `apps/<group>/<language>/audio/…` — already what `R2AssetAdapter.resolveAudioUrl` reads |

Two of the hard parts are therefore already settled: **where a file goes** and
**how to write it to either backend**.

## The contract

```
POST /api/tts/synthesize
  { "text": "hej", "lang": "danish", "voice": "da-DK-ChristelNeural" }

200 { "url": "https://lq-assets.blueforge.studio/apps/nordic/danish/audio/tts/<hash>.mp3",
      "cached": true }
```

The response is a **URL, not a buffer**. The client already knows how to fetch
and play a URL, the browser caches it, and the CDN serves it on every
subsequent request without touching the app. Returning bytes would make the app
a permanent proxy for its own assets.

## The key

```
apps/<group>/<language>/audio/tts/<sha256(text|voice|rev)[:16]>.mp3
```

- **Under the existing audio prefix**, so a generated clip and a pre-recorded
  one are interchangeable to the resolver. lq-nordic's 3,579 recorded mp3s and
  a generated Hungarian clip resolve through the same code path.
- **`tts/` segment** keeps generated content separable — it can be swept,
  re-generated on a voice change, or excluded from a sync without touching
  recorded audio.
- **Hash covers voice and a revision constant**, not just text. Changing voice
  must not silently serve the old clip; bumping `rev` invalidates the corpus
  without deleting anything.

## Flow

1. **Resolve the key.** Pure function of `(text, lang, voice, rev)` — no I/O.
2. **Probe storage.** `list(key)` or a HEAD; hit → return the URL, `cached: true`.
   This is the common case forever after the first request.
3. **Miss → synthesise.** Edge TTS, the voice chosen per `lang` from a map that
   lives with the language config, not in the handler.
4. **Write through** `storage.upload(key, bytes, { contentType: 'audio/mpeg', public: true })`.
5. **Return the URL.**

Steps 2 and 4 are the only storage calls and both go through `StorageService`,
so the handler contains **no provider-specific code**.

## Working with both R2 and forge-control MinIO

This falls out of the adapter rather than needing handler support. The same
image runs against either backend by environment alone:

| | Cloudflare R2 | forge-control MinIO |
|---|---|---|
| `STORAGE_PROVIDER` | `cloudflare_r2` | `minio` |
| credentials | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY` |
| bucket | `R2_BUCKET` | `MINIO_BUCKET` |

Both sets are produced by forge-control's service resolvers today — the MinIO
half only since `fix(services): give the MinIO resolver the env names the
storage adapter reads`, which added the `MINIO_*` aliases the adapter actually
reads. Before that, `assets.primary: minio` resolved `S3_*` names nothing
consumed.

**Public URL.** R2 has `R2_PUBLIC_URL_BASE`; MinIO needs an equivalent, since
the adapter returns a key and the client needs a URL. Handler should read one
`ASSETS_PUBLIC_BASE` and join it to the key rather than depending on whether a
given adapter populates `url` — that field is optional in `StorageService`.

## Credentials — the real decision

The app container currently has **read-only** access: it fetches from a public
CDN domain and holds no keys. This handler makes it a **writer**.

Recommended posture:

- **A separate, scoped keypair.** Not the fleet-wide `R2_LQ_*` pair used for
  bulk sync from developer machines. Scope it to one bucket, and — if R2 token
  scoping allows — to the `apps/*/audio/tts/` prefix. Today's keys already
  demonstrate bucket scoping works: they return `200` on `lq-assets` and
  `403 AccessDenied` on `lq-lang-assets`.
- **Delivered as project env vars**, the same mechanism the R2 credentials now
  use, so it is one vault entry per project rather than per app.
- **MinIO for non-production.** Preview and staging should point at
  forge-control's MinIO, so a runaway loop fills a self-hosted bucket rather
  than billing R2 and polluting the production key space.

The blast radius of a leaked write key is *"someone can write objects under a
prefix in an asset bucket"* — not customer data. That is acceptable, but only
with the scoping above; a fleet-wide key in every app container is not.

## Failure modes worth designing for

- **Stampede.** Twenty learners hit the same new word at once. Without a guard
  that is twenty syntheses and twenty writes of identical bytes. A short
  per-key in-process lock collapses it within one container; a `PUT`-if-absent
  makes it harmless across containers. The writes are idempotent, so this is a
  cost concern, not a correctness one.
- **Storage down.** Synthesis succeeded, the write failed. Return the audio
  anyway and log — a learner should not lose their lesson because a bucket
  is unreachable. The next request retries the write.
- **Synthesis down.** Return a clear error; the client already falls back to
  `SpeechSynthesisService` (browser Web Speech API), which is lower quality but
  keeps the lesson moving.
- **Cost / abuse.** `text` arrives from a client. Cap its length and reject
  anything not plausibly a lesson phrase, or the endpoint is a free TTS API for
  anyone who finds it.
- **Voice drift.** The voice map belongs in language config, versioned, with
  `rev` in the hash — so a deliberate voice change regenerates and an accidental
  one is visible in review.

## What to build

1. The voice map (`lang → voice id`) in language config.
2. `ttsCacheKey(text, lang, voice, rev)` — pure, unit-testable, the piece most
   worth testing.
3. The handler: probe → synthesise → upload → return URL.
4. Edge TTS invocation, ported from the school-quest script.
5. Scoped keypair + project env vars for R2, and the MinIO equivalent for
   non-production.

Steps 1–3 are testable with the `memory` storage adapter and no network, which
is where most of the risk lives.
