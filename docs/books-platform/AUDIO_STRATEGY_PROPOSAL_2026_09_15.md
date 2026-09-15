# Books-platform audio strategy — proposal (2026-09-15)

## What we have today (committed in 0054b457)

- 16 activity-book mp3s + 30 adventure-book mp3s (jungle-detective + 3 mystery-at-midnight scenes) **pre-generated and committed alongside their scene JSON files**.
- Two eager-generation scripts (`apps/lq-{activity,adventure}-book/scripts/generate-narration.ts`).
- 8 of 9 adventure books stopped mid-generation because Replicate's `<$5 credit` rate-limit capped throughput at 6 calls/minute (~80 minutes for the remainder).

## Why today's approach is wrong

| Problem | Impact |
|---|---|
| **Text change loses the cache** | Edit a scene's `narrativeText`, the URL stays the same, the playback becomes stale text — no signal that the audio is wrong. |
| **New scenes ship silent** | A scene without audio.narration on disk renders muted. First-render bug, not authoring bug. |
| **No on-demand flexibility** | "We want this one sentence in a different voice" forces a per-scene regeneration script, not a per-scene voice-config tweak. |
| **Vendor lock-in at generation time** | Switching Edge TTS → Kokoro (or vice versa) means regenerating every scene. Switching to a 3rd provider same. |
| **Generation cost isn't gated on actual demand** | We generated 246 jungle-detective scenes of audio nobody had yet asked for. If 200 of those scenes are never played, we paid $0 for nothing but waited 45 minutes. |

## What we want (lq-core's pattern + server-side persistence)

### Client side (from `lq-core/libs/screens/lessons/src/lib/AudioCache.ts`)

```ts
class AudioCache {
  cache = new Map<string, Blob>();        // URL → Blob
  async downloadAndCache(url) { ... }      // fetch + cache
  async get(url): Promise<Blob | null>     // cache hit → blob; miss → null
}
```

Lq-core uses IndexedDB on the client. We can keep that for offline UX.

### Server side (the missing piece — what the user is pointing to)

A lazy compute-on-read endpoint that:

1. Receives `{ text, voice, locale }` from the client.
2. Computes a **content hash** of the inputs (e.g. `sha256(text|voice|locale|voiceSettings)`).
3. Looks up `audio/narration/<hash>.mp3` in S3-compatible blob storage (R2 / MinIO / Liqo).
4. If present, returns the public URL.
5. If absent, calls the TTS provider, writes the file to blob storage, returns the URL.

The frontend never has to know about TTS providers, blob storage, or generation latency on the happy path.

### Proposed component layout

```
books-platform/
├── apps/
│   ├── books-api/                          # ← NEW route registered here
│   │   └── src/routes/
│   │       └── audio/
│   │           ├── narration.ts            # POST /api/audio/narration
│   │           └── bucket.ts               # PUT/GET against S3-compat adapter
│   └── lq-{activity,adventure,story,interactive}-book/
│       └── src/components/
│           └── AudioLayer.tsx              # ← upgraded to lazy lookup
├── packages/
│   └── books-shared/                       # ← shared types + TTS settings
│       └── src/types/
│           └── book-audio.ts               # SceneAudio, AudioSpec, VoiceConfig
└── libs/                                   # ← shared across apps
    └── audio-storage/                      # NEW
        ├── src/S3BlobStore.ts              # adapter for R2/MinIO/Liqo
        ├── src/LocalBlobStore.ts           # dev fallback (local FS)
        └── src/hash.ts                     # canonical hash for cache key
```

Key types:

```ts
// packages/books-shared/src/types/book-audio.ts
interface AudioSpec {
  text: string;                            // canonical text to speak
  voice: string;                           // e.g. 'en-US-JennyNeural'
  locale: string;                          // e.g. 'en', 'da', 'es'
  speed?: number;                          // optional 0.5–2.0
  pitch?: number;                          // optional
}

interface AudioReference {
  url: string;                             // public blob URL — never expires
  hash: string;                            // sha256 of the AudioSpec — matches cache key
  generatedAt: string;                     // ISO — purely informational
  providerCost: number;                    // dollars paid (zero, for EdgeTTS)
}

interface AudioRequest extends AudioSpec {
  sceneId?: string;                        // for analytics; not used in hash
}
```

The hash means: **same input → same file → same URL**, forever. No stale-cache problem when text doesn't change.

### Migration: what happens to the 30 mp3s we just committed

Don't lose them. They become **warm cache entries** for the books-jungle-detective + mystery-at-midnight scenes they've already been generated for.

1. Re-derive the AudioSpec for each committed scene from the scene JSON's `narrativeText` (or `content.question`).
2. Compute the hash the endpoint would have used.
3. Upload the existing mp3 to blob storage at `audio/narration/<hash>.mp3`.
4. The lazy endpoint will find them on first hit, skip generation, return the existing URL.

Operationally, this is a one-shot backfill script — `scripts/audio/backfill-from-eager-gen.ts`. Read every scene JSON, for each that has `audio.narration`, push the mp3 to blob storage with the matching content-hash key. Idempotent, safe to re-run.

### Frontend upgrade (AudioLayer)

Today `AudioLayer` reads `current.audio.narration` and plays it. Tomorrow:

```tsx
const audioUrl = useAudioNarration(scene);   // upgrade from React state to hook

function useAudioNarration(scene: Scene | Exercise) {
  const [cached, setCached] = useState<string | null>(scene.audio?.narration ?? null);
  useEffect(() => {
    if (cached) return;                       // already have the URL
    const spec = audioSpecFromScene(scene);   // text + voice + locale
    const hash = hashAudioSpec(spec);
    fetch(`/api/audio/narration`, {
      method: 'POST',
      body: JSON.stringify({ ...spec, sceneId: scene.id }),
    })
      .then((r) => r.json())
      .then(({ url }: { url: string }) => setCached(url));
  }, [scene.id]);
  return cached;
}
```

This means **every scene "just works" the first time it's played**, with no pre-generation script and no operator gate between authoring and audible content.

### Provider choice — single decision, one place

Today we have an awkward split: Edge TTS for activity, Kokoro for adventure (per the in-script rationale). Under server-side lazy:

| Provider | Cost | Throttle | Voice quality (long-form) | Voice quality (short prompts) |
|---|---|---|---|---|
| Edge TTS | $0 | None observed | Acceptable | Fine |
| Kokoro (Replicate) | $0.0003/scene | 6/min under $5 | Good | Overkill |
| Other (future) | ? | ? | ? | ? |

**Recommendation:** keep both options pluggable behind `AudioSpec.voice`, default each app to a choice, and let operators revisit per-app default once voice/price landscape settles. The voice field is *baked into the content hash*, so changing default doesn't invalidate cache for previously-played scenes — those keep their old voice (until the cache is purged or the hash field is bumped). New scenes after the swap get the new voice.

For today, while Stripe is unactivated:
- Activity default: `en-US-JennyNeural` (Edge TTS, $0)
- Adventure default: `en-US-JennyNeural` (Edge TTS, $0) — **switch from Kokoro**, the quality delta for adventure prose is real but not $0.08-per-book worth, and the throttle pain goes away entirely
- Story default: stays `af_bella` (Kokoro) if operator wants to keep warm cache warm; switch is a one-line flip
- Interactive: audit pending

This single decision moves us from a 80-minute throttle-bound run to a $0 + ~5-minute cycle for whatever does need eager generation.

## Migration plan

| Step | Action | Effort | Risk |
|---|---|---|---|
| 1 | Land the lazy-audio endpoint behind a feature flag (off by default) | 1 day | Low — endpoint exists but isn't called yet |
| 2 | Add `AudioCache` client-side (mirror lq-core) + `useAudioNarration` hook | 0.5 day | Low |
| 3 | Upgrade one AudioLayer site (e.g. lq-activity-book) to use the lazy hook | 0.5 day | Low |
| 4 | Local dev: confirm `/api/audio/narration` works against `LocalBlobStore` | 1 hour | Trivial |
| 5 | Deploy books-api behind flag to forge-app-2; smoke test | 1 hour | Operator action |
| 6 | Enable flag for lq-activity-book in prod | 5 min | Operator action |
| 7 | Backfill script: push committed 30 mp3s to R2 under their content-hash keys | 0.5 day | Low — idempotent |
| 8 | Repeat step 6 for lq-adventure-book, lq-story-book, lq-interactive-book | 0.5 day per app | Low |
| 9 | Decommission eager `generate-narration.ts` scripts (or keep for ad-hoc batch, but no longer required) | 0.5 day | None — keep them read-only |

**Total:** ~5 days of code + 1 hour of operator deployment work. The 30 mp3s committed today are preserved via step 7.

## Open questions for sign-off

1. **Blob storage choice** — R2 (Cloudflare) or MinIO on the books-platform storage box? The booking-CDN bucket exists at R2 (mentioned in CLAUDE.md), but R2 has egress costs and per-object fees; MinIO on-box is free but adds a deploy-time dependency. **Recommendation: start with `LocalBlobStore` for dev + R2 for prod, behind a flag** — same adapter interface, swap by env var.
2. **Auth model** — the lazy endpoint should not be open to the public (TTS costs money even at $0/scene; potential for DOS-style abuse). **Recommendation: same `INTERNAL_API_KEY` model the books-api admin routes use**, with a public-allowed allowlist for the four book-app origins.
3. **CORS / blob storage caching** — R2 supports cache-control headers but Edge TTS / Kokoro files are content-addressed (hash in URL), so we never need to invalidate. Just set `Cache-Control: public, max-age=31536000, immutable`.
4. **Locale-aware voices** — under lazy, generating Danish audio on first Danish-book-open is automatic. Add `da-DK-{...}Neural` (Edge TTS) or pick a Kokoro Danish voice; document in the AudioSpec type. Lower priority, do after en ships.
5. **Audio format choice** — mp3 vs opus vs aac? mp3 is universal; opus is half the size for the same quality. **Recommendation: ship mp3 for now** (matches what we have on disk), revisit when storage costs matter.
6. **Operator action required** — step 5 (blob storage choice + deploy) and step 7 (R2 creds). Both can be deferred until dev work is done; until then the LocalBlobStore path works in dev.

## What this proposal does NOT solve

- **Locale content authoring** — still a separate human-translation workstream. The lazy endpoint makes it slightly cheaper (no eager generation, audio created as users encounter scenes), but doesn't generate the scene content. See `LOCALE_COVERAGE_BLOCKER_2026_09_15.md`.
- **Background/ambient/sound-effect generation** — separate `audio.background` / `audio.music` slots in `SceneAudio`. Same lazy-cache pattern applies but the providers (Replicate Stable Audio, owned SFX library) are different.
- **Story-book audio coverage gap** — exists today, will exist tomorrow. The lazy-cache approach makes the gap self-healing on first play rather than an explicit script run.

## Why now

The throttle pain we hit today is the symptom, not the disease. Continuing the eager-generation approach means every future book, every text edit, every voice swap is the same 80-minute wait. The lazy-cache approach is the same amount of code (probably less, actually) and makes the throttle problem go away permanently — because the lazy endpoint doesn't burn quota speculatively; it only generates what users actually play.

## Reference

- Existing lq-core lazy pattern: `lq-core/libs/screens/lessons/src/lib/AudioCache.ts` (simple `Map<url, Blob>`, 30-day TTL), `lq-core/libs/app/app-services/src/audio/AudioCache.ts` (IndexedDB-backed variant of the same).
- Existing today's-pre-generation scripts: `books-platform/apps/lq-activity-book/scripts/generate-narration.ts` (Edge TTS), `books-platform/apps/lq-adventure-book/scripts/generate-narration.ts` (Kokoro, with the 80-min throttle trap).
- Existing committed-but-partial audio: 30 mp3s at `books-platform/apps/lq-adventure-book/public/sounds/adventure/{jungle-detective,mystery-at-midnight}/`, 16 mp3s at `books-platform/apps/lq-activity-book/public/sounds/activity/{math-adventures,science-explorer}/`.
