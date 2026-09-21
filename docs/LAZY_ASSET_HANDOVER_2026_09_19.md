# Lazy-Asset Campaign Handover

> **Date:** 2026-09-19 · **Scope:** end-to-end lazy image-generation pipeline (cache probe → render → audit → upload → URL) mirroring the TTS lazy cache architecture (`docs/TTS_CACHE_HANDLER.md`).
> **Status (2026-09-21):** audit+upload glue landed in lq-core#70. Pilot gate still waits on the real audit (PR 2.5) — see [`docs/STATUS_2026_09_21.md`](./STATUS_2026_09_21.md).
> **Status (earlier 2026-09-21):** ⚠️ **Code shape complete; audit+upload glue pending.** See [`docs/LAZY_ASSET_AUDIT_2026_09_21.md`](./LAZY_ASSET_AUDIT_2026_09_21.md) for the full audit and the one remaining gap. **Do not flip `IMAGE_LAZY_GENERATION_ENABLED=true` until the gap is closed.**

---

## TL;DR

The full lazy-asset pipeline is **code-complete and merged across both repos** as of 2026-09-19 evening:

| Component | Where | Status |
|---|---|---|
| Content-addressed key | `@learnquest/web-core/lazy-asset` | merged (lq-core#64) |
| HTTP handler (cold-miss + storage probe) | `@learnquest/web-core/lazy-asset` | merged (lq-core#65) |
| Client hook + `<LazyAsset>` | `@learnquest/hooks`, `@learnquest/ui` | merged (lq-core#66), published as `hooks@0.1.3` + `ui@0.1.6` |
| Server route + M3 composer + boot gate | `services/platform-api` | merged (lq-core#67) |
| Real M3 caller + Gemini adapter wiring | `services/platform-api` | merged (lq-core#68) |
| Consumer seam (`<LazyStoryImage>`) | `@learnquest/books-reader` | merged (books-platform#30) |
| **`web-core` lazy-asset types** | `@learnquest/web-core` | published as `web-core@0.2.2-rc.0` |

**Next:** operator deploys with `IMAGE_LAZY_GENERATION_ENABLED=true` + `GEMINI_API_KEY` set; flips the pilot gate on `lq-romance/french/ch1` + `story-book/the-three-bears`; runs a 7-day soak.

---

## What landed (in merge order)

### lq-core#64 — foundation
- **`@learnquest/web-core/lazy-asset` types** — discriminated `AssetSpec` union (`image | audio-narration | audio-sfx`), content-addressed `assetLazyKey(spec)` hash, `AssetLazyDeps` interface for the handler.

### lq-core#65 — handler
- **`@learnquest/web-core/lazy-asset/handler`** — `handleAssetLazyRequest(spec, deps)` runs the probe → render → audit → upload dance. The deep behavior (storage probes, render facade wiring, audit envelope) lives here so the route is a thin Hono shell.

### lq-core#66 — client
- **`@learnquest/hooks` `useAssetLazyRequest(spec)`** — composes with the `<LazyAsset>` consumer.
- **`@learnquest/ui` `<LazyAsset>`** — `IntersectionObserver` prefetch + `<Skeleton>` fallback + `<img>` on resolve. No network calls outside the hook.
- Published to packr: `@learnquest/hooks@0.1.3`, `@learnquest/ui@0.1.6`.

### lq-core#67 — server route + M3 composer
- **`services/platform-api/src/lazy-asset/route.ts`** — `POST /api/assets/lazy`, rate-limited (30/min/user), envelope-validated. Mounted only when `AppDeps.lazyAsset` is provided ("absent rather than disabled").
- **`compose.ts`** — M3 composer. Image specs get a region/scene/style/label directive; audio-narration / audio-sfx throw (those go through `POST /api/tts/synthesize`).
- **`server.ts`** — `IMAGE_LAZY_GENERATION_ENABLED=true` gate, boot log of the on/off state.

### lq-core#68 — real M3 + Gemini wiring (this session)
- **`m3.ts`** — real MiniMax-M3 caller. POSTs to `https://api.minimax.io/anthropic` (Anthropic-compatible surface), bounded 2s, **fails open** to `quality: 0` stub on any error.
- **`ai-client.ts`** — `createGeminiImageAdapter` factory. Mirrors `GEMINI_API_KEY` into `process.env` so the upstream adapter's `isAvailable()` returns true.
- **`boot.ts`** — `createLazyAssetDeps(opts)` orchestrator. Returns full `LazyAssetDeps` or `null` (when Gemini key missing).
- **`server.ts` update** — replaced stub `{storage, publicBaseUrl}` mount with `createLazyAssetDeps(process.env)`. M3 wiring state (`wired` vs `fail-open-stub`) logged at boot.
- **32 new tests**; all 48 `src/lazy-asset/*` tests pass.

### books-platform#30 — consumer seam
- **`packages/books-reader/src/components/LazyStoryImage.tsx`** — `image: string | AssetSpec` discriminated component. String → legacy `<img>` (byte-identical to `StoryImage`); `AssetSpec` → `<LazyAsset>` (lazy branch).
- 4 new tests + 1 new test for default `alt=""`. All 182 books-reader tests pass.
- Published packages: `@learnquest/web-core@0.2.2-rc.0`, `@learnquest/hooks@0.1.3`, `@learnquest/ui@0.1.6` — required for the install to resolve.

---

## The pilot (operator action required)

Per spec §6: 7-day soak on `lq-romance/french/ch1` + `story-book/the-three-bears`. Surface 10–20 images per scene to validate the cache-probe → render → audit → upload round-trip.

### Env vars to set in the deploy environment (forge-app-2)

**Required** (per the "absent rather than disabled" rule, route doesn't mount without these):

| Env var | Where |
|---|---|
| `GEMINI_API_KEY` | forge-app-2 lq-romance + books-platform deploy env |
| `IMAGE_LAZY_GENERATION_ENABLED` | `true` on the pilot apps |
| `STORAGE_PROVIDER` | `r2` (already set per existing TTS routing) |
| `ASSETS_PUBLIC_BASE` | `https://lq-assets.blueforge.studio` |

**Optional** (M3 falls back to deterministic stub when missing):

| Env var | Default | Notes |
|---|---|---|
| `M3_API_KEY` | none | MiniMax API key (Anthropic-compatible) |
| `M3_ENDPOINT` | `https://api.minimax.io/anthropic` | |
| `M3_MODEL` | `MiniMax-M3` | per spec |
| `M3_TIMEOUT_MS` | `2000` | per spec "200ms target, 2s timeout" |
| `GEMINI_MODEL` | `gemini-3.1-flash-image` | = `BATCH_DEFAULT_MODEL` |

Per the chat-burned secret protocol: **values stay in the deploy plan / vault, never in chat**. The memory entry `project-lazy-asset-pr5c-m3-aiclient` documents the variable list.

### Gate flip sequence

1. **Pilot apps only** — don't flip on every lq-* / books-* deploy. Start with `lq-romance/french` + `story-book/the-three-bears` for the 7-day soak.
2. **Watch the boot log** — `[lazy-asset] enabled — provider=r2 base=https://lq-assets.blueforge.studio m3=wired aiClient=gemini` confirms both M3 + Gemini are wired.
3. **Validate cache hit rate** — a successful pilot should see most requests 304/cache-hit (M3 composer is cached; R2 GET is cached).

---

## Open gaps (follow-ups, NOT blocking pilot)

### 1. PR 2.5 — `image-processor/audit` subpath

The `auditImage` in `route.ts` is currently `noopAuditImage` (returns a no-op audit summary). PR 2.5 on `blueforge-org` will add `image-processor/audit` as a subpath export of `@blueforge-studio/image-processor`. Once that lands:

- `route.ts` swaps `noopAuditImage` for the real `auditLazyAssetImage` facade.
- `boot.ts` accepts an `auditImage` override (already plumbed).

Until then, every render ships without an audit. The pilot should still validate the cache-probe round-trip — the audit is orthogonal.

### 2. Lockfile follow-ups

Three PRs need lockfile regeneration once their respective publishes land:

- lq-core#65 (lockfile stale from the @learnquest/web-core pre-publish state)
- lq-core#66 (hooks+ui version bump)
- lq-romance French ch11 (#24) (assorted asset references)

Cheap, mechanical, can be batched into a single "lockfile sweep" PR after the RCs are published + the pilot ships.

### 3. Packr `--tag` support

Discovered 2026-09-19: packr-registry **ignores `npm publish --tag rc`**. Versions land on `latest` regardless. Filed as a packr-registry follow-up. Workaround: pin exact versions in consumer `package.json` (which the books-platform PR already does).

### 4. Packr JWT-drift fallback is partial

Packr #233 added hash-fallback to read paths and admin/internal write paths, but the **npm PUT handler is still signature-only**. Existing JWT-drifted tokens 401 on PUT. The fix landed via `packr-cli token create <name> --scope @scope` — fresh tokens get `auth: "jwt"` (valid signature) and PUT works. Worth filing a follow-up packr PR to extend the hash-fallback to the npm PUT handler.

---

## Cross-repo state

| Repo | Branch | Status |
|---|---|---|
| `lq-core` | `main` | ✅ all 5 PRs (#64–#68) merged |
| `books-platform` | `main` | ✅ PR #30 merged |
| `lq-romance` | `chore/lazy-asset-...` branches | ready for gate flip |
| `story-book` | (consumer, no code change) | ready for gate flip |
| `@learnquest/web-core` | packr | `0.2.2-rc.0` published |
| `@learnquest/hooks` | packr | `0.1.3` published |
| `@learnquest/ui` | packr | `0.1.6` published |

---

## Test counts

| Repo / package | Tests | Source |
|---|---|---|
| `lq-core/services/platform-api/src/lazy-asset/*` | 48/48 ✅ | this session + prior PRs |
| `books-platform/books-reader` | 182/182 ✅ | includes 4 new `LazyStoryImage` tests |
| `@learnquest/web-core` lazy-asset handler | (in-package) | PR #65 |

---

## See also

- `docs/IMAGE_LAZY_GENERATION_2026_09_19.md` — design spec (authoritative)
- `docs/TTS_CACHE_HANDLER.md` — TTS architecture this mirrors
- Memory: `project-lazy-asset-pr5c-m3-aiclient` — operator env vars + chat-burned protocol
- Memory: `project-packr-jwt-secret-drift-2026-09-19` — packr#233 status + JWT-drift workaround

🤖 Generated with [Claude Code](https://claude.com/claude-code)
