---
name: lazy-asset-audit-2026-09-21
description: "Full audit of the lazy-asset pipeline on lq-core + books-platform + lq-tools/lq-operations as of 2026-09-21. PRs #64–#68 on lq-core main; books-platform#30 merged. Critical findings: handler audit+upload not wired; probeStorage uses LIST instead of HEAD."
---

# Lazy-asset pipeline — full audit (2026-09-21)

> **Scope:** read every PR merged on `lq-core` main for the lazy-asset campaign
> (PRs #64–#68, commits `d41b0d37` … `3f5e2c5d`), the `books-platform#30`
> audio sibling, and the `learn-quest/docs/IMAGE_LAZY_GENERATION_2026_09_19.md`
> spec to compare design vs implementation.
>
> **Method:** read each source file + its test pair; cross-reference every
> spec paragraph to its implementation; surface every gap as a finding
> with severity + first step.
>
> **Update (same day):** finding #1 fixed by **lq-core#70** (merged
> `490042df`) — handler now audits, uploads and writes the sidecar; also
> fixed the url-less probe (every hit re-rendered) and `square-1024` → NaN
> size. Finding #2 (noop audit default) and #3 (`head()` probe) remain open.
> Current state: [`docs/STATUS_2026_09_21.md`](./STATUS_2026_09_21.md).
>
> **Status:** PRs #64–#68 are merged. **The pipeline is not end-to-end
> functional** — the handler does not actually audit or upload; it
> constructs a URL pointing at a storage key that doesn't exist.
> PR 5 (the pilot gate flip) cannot succeed today without first
> fixing the audit+upload gap.

---

## TL;DR

| Severity | Finding | First step |
|---|---|---|
| 🔴 CRITICAL | Handler audit + upload not wired — every "lazy" request returns a URL pointing at a non-existent storage key | Extend `handleAssetLazyRequest` to read rendered file from disk, audit it, upload it, write the sidecar, clean the tempdir |
| 🔴 CRITICAL | `noopAuditImage` is the default; even if upload is fixed, audit scores never appear in responses | Wire real audit (awaiting `image-processor/audit` subpath per PR 2.5) |
| 🟡 WARN | `probeStorage` uses `storage.list(undefined)` — O(N) over the whole bucket per request | Switch to `storage.head(key)` |
| 🟡 WARN | `LAZY_ASSET_HANDOVER_2026_09_19.md` claims "✅ CODE COMPLETE" but the audit+upload gap means it's misleading | Refresh to a dated `LAZY_ASSET_HANDOVER_2026_09_21.md` |
| 🟡 WARN | Memory `project_lazy_asset_pr5c_m3_aiclient.md` doesn't surface the audit+upload gap | Add the finding to the memory file |
| 🟡 WARN | PR #15 (`fix/declare-project`) is 36 commits behind main and predates PRs #67/#68 — likely obsolete | Verify workaround is no longer needed; close or update |
| 🟡 WARN | 3 stale branches on lq-core (`chore/lazy-asset-pr1/pr3/pr4-2026-09-19`) all already merged via PRs | Prune |
| 💡 NOTE | Spec says handler lives in `@learnquest/web-core/lazy-asset`; actual is `apps/lang-core/src/lazy-asset` | Document the location deviation |
| 💡 NOTE | `reuse` catalog lookup for SFX (spec § Cross-platform coverage) not implemented anywhere | Track as PR 2.5+ work |

---

## 1. Where the code lives

```
lq-core (origin/main @ 3f5e2c5d)
├── apps/lang-core/src/lazy-asset/                    # server-side handler
│   ├── key.ts            (PR #64, 223 lines)         # assetLazyKey hash
│   ├── types.ts
│   ├── index.ts
│   ├── handler.ts        (PR #65, 349 lines)        # handleAssetLazyRequest
│   └── __tests__/{key,handler}.test.ts
├── libs/common/hooks/src/lazy-asset/                 # client hook
│   ├── useAssetLazyRequest.ts   (PR #66)
│   ├── useAssetLazyRequest.test.ts
│   └── index.ts
├── libs/common/ui/src/components/common/lazy/        # client UI
│   ├── LazyAsset.tsx     (PR #66)
│   ├── LazyAsset.test.tsx
│   └── LazyAsset.stories.tsx
└── services/platform-api/src/lazy-asset/             # platform-api route + deps
    ├── route.ts          (PR #67, 154 lines)        # POST /api/assets/lazy
    ├── validate.ts
    ├── compose.ts
    ├── m3.ts             (PR #68)                    # real M3 caller
    ├── ai-client.ts      (PR #68)                    # Gemini adapter
    ├── boot.ts           (PR #68, 111 lines)         # orchestrator
    └── *.test.ts for each

books-platform (#30 merged)
└── (lazy TTS layer per `project_audio_lazy_cache_2026_09_15.md`)

lq-tools: no lazy-asset code (the spec mentioned `image-tools` lazy-audit wrapper — not landed)
lq-operations: no build-reuse-catalog script (the spec mentioned it — not landed)
```

---

## 2. Findings — by severity

### 🔴 CRITICAL · Handler audit + upload not wired

**Location:** `apps/lang-core/src/lazy-asset/handler.ts:270-327`

**Symptom:** The handler:
1. Probes storage (works)
2. Composes the prompt (works)
3. Calls `deps.renderImage(...)` — this writes the image to a tempdir
4. **Skips the audit** (line 308: "skip the audit if no buffer is provided")
5. **Does not upload** (line 313: "upload — the per-app server's responsibility")
6. Returns a URL constructed from `publicUrlBase + key` — but the key was never uploaded

The comment at line 311 says "PR 5 wires the buffer flow", but PR 5 was the pilot gate flip, not a glue PR. The audit+upload path is **missing**.

**Real consequence:** flipping `IMAGE_LAZY_GENERATION_ENABLED=true` today would:
- Cost real money per request (Gemini API call renders to disk, no upload, file is discarded)
- Return a 200 response with a URL pointing at a non-existent storage key
- Every learner request would 404 the image
- Audit scores never written (so quality badges never appear even after #2.5 lands)

**Recommended fix:** Extend `handleAssetLazyRequest` to read the rendered file from disk via `rendered.imageResult.variants[0].path` (or similar — needs check of the `RenderImageResult` shape), then `deps.auditImage(buffer)`, then `deps.storage.upload(key, buffer, { public: true })`, then write the sidecar JSON to `key + '.audit.json'`, then return the real storage URL.

Estimated: ~50 lines + tests.

### 🔴 CRITICAL · `noopAuditImage` is the default

**Location:** `services/platform-api/src/lazy-asset/route.ts:39-47`

The route ships with a no-op audit that always returns `hardFail: false` and `summary: 'noop (audit facade wiring pending PR 2.5)'`. Combined with finding #1, this means:

- No audit scores appear in responses
- No quality badges render in `<LazyAsset>`
- "low-quality" status from the spec never triggers

The fix for #1 needs to call `deps.auditImage(buffer)` (already wired in `buildHandlerDeps`), but the default is the noop. Until PR 2.5 lands the `image-processor/audit` subpath, the boot helper accepts an `auditImage` override — but no caller supplies one.

**Recommended fix:** Same as #1. Once the handler reads the buffer, the no-op still returns "all good" so the gap is silent. Need a real audit (PR 2.5) OR a stronger no-op that returns `hardFail: true` for clearly empty buffers (force the caller to wire a real one).

### 🟡 WARN · `probeStorage` is O(N)

**Location:** `apps/lang-core/src/lazy-asset/handler.ts:239-248`

```ts
async function probeStorage(storage, key) {
  const objects = await storage.list(/* prefix = the exact key */ undefined);
  for (const obj of objects) {
    if (obj.key === key) return obj.url ?? undefined;
  }
  return undefined;
}
```

**Symptom:** every request lists ALL objects in the bucket (R2/MinIO with millions of objects = unworkable).

**Recommended fix:** Add `StorageService.head(key): Promise<{ url?: string } | undefined>` and use it. ~10 lines.

### 🟡 WARN · Handover doc is stale

**Location:** `learn-quest/docs/LAZY_ASSET_HANDOVER_2026_09_19.md`

Claims "✅ CODE COMPLETE, awaiting operator deploy + pilot gate flip". Given finding #1, this is misleading. Operator who reads this and flips the gate will see no images.

**Recommended fix:** Refresh to `LAZY_ASSET_HANDOVER_2026_09_21.md` with:
- Status: "Code shape complete; audit+upload glue pending"
- The 5 PRs that merged
- The 1 remaining gap (audit+upload wiring)
- Operator-shaped next steps (deploy only after the gap is closed)

### 🟡 WARN · Memory file is stale

**Location:** `~/.claude/projects/.../memory/project_lazy_asset_pr5c_m3_aiclient.md`

Says PR #68 "wired the real M3 + Gemini" — true for the wiring layer; doesn't surface the audit+upload gap. Future agent sessions will repeat the same false claim.

**Recommended fix:** Add the audit+upload gap to the memory entry's "Open gaps" section.

### 🟡 WARN · PR #15 is likely obsolete

**Location:** `lq-core#15` `fix/declare-project → main`

- Opened 2026-09-03 (before lazy-asset work)
- 36 commits behind main (all lazy-asset PRs landed after)
- Workaround for `DATABASE_URL is required` boot error
- Author's own comment: "This is a workaround and should not survive"
- Has conflicts (CI failure)

**Recommended fix:** Investigate whether the workaround is still needed (the platform-api may have evolved). If not, close as obsolete. If yes, the work needs to be redone against current main.

### 🟡 WARN · Stale branches

**Location:** lq-core local branches

| Branch | Status | Action |
|---|---|---|
| `chore/lazy-asset-pr1-foundation-2026-09-19` | Merged in PR #64 | Delete |
| `chore/lazy-asset-pr3-handler-2026-09-19` | Merged in PR #65 | Delete |
| `chore/lazy-asset-pr4-hooks-ui-2026-09-19` | Merged in PR #66 | Delete |
| `chore/lazy-asset-pr5a-pilot-gate-2026-09-19` | **NOT merged** (PR 5a still pending) | Keep |
| `feat/lazy-asset-pr5c-m3-aiclient-2026-09-19` | Same as main HEAD | Switch off, delete |

### 💡 NOTE · Spec location deviation

The spec says handler lives in `@learnquest/web-core/lazy-asset` (or `@learnquest/web-app` if serverless). Actual is `apps/lang-core/src/lazy-asset/`. This is likely intentional (lang-core IS the lang app's server), but the spec doesn't mention it. Worth adding a one-line note to the spec.

### 💡 NOTE · SFX reuse catalog

The spec's "Cross-platform coverage — books-platform extension § 3" describes a server-side reuse catalog for SFX (soundimage.org, freesound CC, internal audiobook pool). **This is not implemented anywhere** — no `build-reuse-catalog.ts` script in `lq-operations`, no `reuse-catalog.sqlite` data file, no catalog-lookup code in `books-platform`'s lazy TTS layer. The audio side (books-platform lazy-cache) handles narration + per-book assets, but the cross-book reuse directory is unimplemented.

---

## 3. What's solid

| Component | Status |
|---|---|
| `assetLazyKey` hash (PR #64) | Pure, well-tested (388 lines of tests). The hash is content-addressed; collisions are recoverable. |
| HTTP handler shape (PR #65) | Pure function (framework-agnostic), testable with `InMemoryStorageAdapter`. Right design choice. |
| Hook + UI (PR #66) | React-idiomatic IntersectionObserver with `rootMargin: '200px 0px'`. Module-scoped `inflight` Map dedupes concurrent requests. `AbortController` on unmount. |
| Route (PR #67) | Thin Hono wrapper, validates via Zod, rate-limited (30/min per user). "Absent rather than disabled" posture matches the TTS handler. |
| M3 composer (PR #68) | Bounded (200ms target / 2s timeout), fail-open stub when key missing. |
| Gemini adapter (PR #68) | Fail-open when `GEMINI_API_KEY` missing — boot returns `null`, route unmounted. Mirrors the TTS handler pattern. |
| Books-platform lazy-cache | Mirrors the image pattern. Edge TTS default + Kokoro fallback. Reuse-first for SFX. |

---

## 4. Recommended next steps (in order)

1. **Fix the handler audit+upload gap** (finding #1) — ~50 lines + tests, blocker for PR 5
2. **Switch `probeStorage` to `storage.head`** (finding #3) — ~10 lines, immediate perf win
3. **Decide on PR #15** (finding #6) — close as obsolete OR redo against main
4. **Prune 3 stale branches** (finding #7) — single `git branch -D` call
5. **Refresh handover doc** (finding #4) — dated `LAZY_ASSET_HANDOVER_2026_09_21.md`
6. **Update memory entry** (finding #5) — surface the gap
7. **Re-audit post-fix** — confirm the audit+upload path is end-to-end functional before any pilot gate flip

After #1, the pilot gate flip becomes safe.

---

## 5. PR breakdown (if you want to drive these)

| PR | Repo | Title | Estimated |
|---|---|---|---|
| A | lq-core | `fix(lazy-asset): handler must read buffer, audit, upload, write sidecar` | ~1 hr |
| B | lq-core | `perf(lazy-asset): probeStorage via head() not list()` | ~15 min |
| C | lq-core | `chore: prune stale lazy-asset-* branches` | ~5 min |
| D | lq-core | `chore: close #15 as obsolete (verify workaround first)` | ~15 min |
| E | learn-quest | `docs: refresh LAZY_ASSET_HANDOVER_2026_09_21.md` | ~10 min |
| F | (memory) | `update project_lazy_asset_pr5c_m3_aiclient.md` | ~5 min |
| G | (this audit doc) | `docs/LAZY_ASSET_AUDIT_2026_09_21.md` ✅ done | — |

Operator-shaped (chat-burned protocol):
- Pilot gate flip on `lq-romance/french/ch1` — after PR A lands
- `GEMINI_API_KEY` set in forge-app-2 deploy env — already documented
- `IMAGE_LAZY_GENERATION_ENABLED=true` flip — after PR A lands