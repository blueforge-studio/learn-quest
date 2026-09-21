---
name: lazy-asset-audit-2026-09-21
description: "Full audit of the lazy-asset pipeline on lq-core + books-platform + lq-tools/lq-operations as of 2026-09-21. PRs #64–#68 + #70 + #71 + #72 on lq-core main; books-platform#30 merged. All four critical findings addressed by #70 + #72. PR lq-core#15 remains the pilot gate blocker."
---

# Lazy-asset pipeline — full audit (2026-09-21)

> **Scope:** read every PR merged on `lq-core` main for the lazy-asset campaign
> (PRs #64–#68, #70, #71, #72), the `books-platform#30` audio sibling,
> and the `learn-quest/docs/IMAGE_LAZY_GENERATION_2026_09_19.md` spec to
> compare design vs implementation.
>
> **Method:** read each source file + its test pair; cross-reference every
> spec paragraph to its implementation; surface every gap as a finding
> with severity + first step.
>
> **State as of origin/main @ 52c77f53 (2026-09-21 08:33 UTC):**
> - **PRs #64–#68** merged (foundation → real M3 + Gemini wiring)
> - **PR #70** (490042df) merged — handler reads rendered bytes, audits,
>   uploads, writes sidecar. ALSO fixed `probeStorage` to use
>   `storage.list(key)` as a prefix-filter (returns boolean; URL
>   derived from `publicUrlBase`) — strictly better than the
>   `head()` proposal in finding #3. ALSO fixed `square-1024` →
>   NaN size, hard-fail rejection on bad audit, `onWarning`
>   callback for non-fatal issues.
> - **PR #71** (5dbbe17b) merged — LFS renormalize (141 binaries
>   committed outside LFS, see STATUS_2026_09_21 §P0.1).
> - **PR #72** (52c77f53) merged — real pixel-stat audit
>   (`pixelAuditImage`) replaces the `noopAuditImage` default in
>   `route.ts`. Closes finding #2.
>
> **All four 🔴 CRITICAL findings are addressed.** What's NOT addressed:
> PR #15 (the platform-api deploy blocker) and the doc-side cleanup.
> The pipeline is **code-complete end-to-end as of origin/main @ 52c77f53**.
>
> **Initial draft caveat:** the first version of this audit (lines
> preserved below for traceability) was written against a stale local
> `main` @ 6e789ebe, missing PRs #64–#72. The findings it raised were
> correct against that snapshot but were already addressed on
> origin/main by the time the audit landed. The TL;DR table below is
> the **corrected** view; section 2 still records the original
> findings against the stale snapshot for the trail.

---

## TL;DR (corrected 2026-09-21)

| Severity | Finding | First step | Status |
|---|---|---|---|
| 🔴 CRITICAL | Handler audit + upload not wired (stale main) | Read rendered bytes, audit, upload, write sidecar | ✅ addressed by **lq-core#70** (better: render dep returns buffer directly — no fs leak; hard-fail rejection) |
| 🔴 CRITICAL | `noopAuditImage` is the default | Wire real audit (`image-processor/audit` subpath) | ✅ addressed by **lq-core#72** — `pixelAuditImage` (deterministic pixel-stat) replaces noop |
| 🟡 WARN | `probeStorage` uses `storage.list(undefined)` — O(N) | Switch to `storage.head(key)` | ✅ addressed by **lq-core#70** — uses `storage.list(key)` as prefix-filter; URL derived from `publicUrlBase`. Strictly better than head() (no new method on adapter interface) |
| 🟡 WARN | Stale `LAZY_ASSET_HANDOVER_2026_09_19.md` (says "✅ CODE COMPLETE") | Refresh to a dated handover | ✅ covered by STATUS_2026_09_21 + this audit's corrections |
| 🟡 WARN | Memory doesn't surface the audit+upload gap | Update memory | ✅ done (see `project_lazy_asset_pr5c_m3_aiclient_2026_09_19.md`) |
| 🟡 WARN | PR #15 (platform-api deploy) is 76 commits behind main, predates #67/#68 — **NOT obsolete** (operator-verified 2026-09-21, see comment on #15) | Rebase onto main, keep build/entrypoint/CI/overrides/ignore/lockfile-regen hunks, drop the duplicate `project` key, defer shared-vs-sidecar postgres to platform | 🔴 OPEN — blocks pilot gate flip; `api.quest` is the hand-deploy of #15, main undeployed |
| 🟡 WARN | 3 stale branches on lq-core (`chore/lazy-asset-pr1/pr3/pr5a-2026-09-19`) all already merged via PRs | `git branch -D` | 🔴 OPEN (PR C from §4) |
| 💡 NOTE | Spec says handler lives in `@learnquest/web-core/lazy-asset`; actual is `apps/lang-core/src/lazy-asset` | Document the location deviation | not blocking |
| 💡 NOTE | `reuse` catalog lookup for SFX (spec § Cross-platform coverage) not implemented anywhere | Track as PR 2.5+ work | not blocking |
| ⚪ SUPERSEDED | PR A — handler audit+upload glue (opened as lq-core#73) | — | ❌ closed 2026-09-21 — superseded by #70 (same goal, different design landed in parallel) |
| ⚪ SUPERSEDED | PR B — `probeStorage` via `head()` (opened on lq-core#73) | — | ❌ closed 2026-09-21 — superseded by #70 (list(key) prefix is strictly better than head()) |

---

## 1. Where the code lives (origin/main @ 52c77f53)

```
lq-core
├── apps/lang-core/src/lazy-asset/                    # server-side handler
│   ├── key.ts            (PR #64, 223 lines)         # assetLazyKey hash
│   ├── types.ts
│   ├── index.ts
│   ├── handler.ts        (PR #65+#70, 415 lines)     # handleAssetLazyRequest
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
    ├── route.ts          (PR #67+#72)                # POST /api/assets/lazy
    ├── validate.ts
    ├── compose.ts
    ├── m3.ts             (PR #68)                    # real M3 caller
    ├── ai-client.ts      (PR #68)                    # Gemini adapter
    ├── boot.ts           (PR #68)                    # orchestrator
    ├── audit.ts          (PR #72)                    # pixelAuditImage facade
    └── *.test.ts for each

books-platform (#30 merged)
└── (lazy TTS layer per `project_audio_lazy_cache_2026_09_15.md`)

lq-tools: no lazy-asset code (the spec mentioned `image-tools` lazy-audit wrapper — not landed)
lq-operations: no build-reuse-catalog script (the spec mentioned it — not landed)
```

---

## 2. Findings — by severity

> **Reading note:** these findings were written against a stale local
> `main` @ 6e789ebe (the audit author's local main was 8 commits
> behind origin/main @ 52c77f53 — missing PRs #64–#72). They were
> correct against that snapshot. Findings #1, #2, #3 were already
> addressed on origin/main by PRs #70 and #72; see TL;DR table for the
> corrected status. Findings #6 (PR #15) and #7 (stale branches) remain
> open. This section preserves the original observations for traceability.

### 🔴 CRITICAL · Handler audit + upload not wired (✅ SUPERSEDED by #70)

**Location (stale):** `apps/lang-core/src/lazy-asset/handler.ts:270-327` on local main @ 6e789ebe.

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

**Recommended fix (as written):** Extend `handleAssetLazyRequest` to read the rendered file from disk via `rendered.imageResult.variants[0].path` (or similar — needs check of the `RenderImageResult` shape), then `deps.auditImage(buffer)`, then `deps.storage.upload(key, buffer, { public: true })`, then write the sidecar JSON to `key + '.audit.json'`, then return the real storage URL.

**Resolution (origin/main @ 52c77f53):** **lq-core#70** (`490042df`) landed a different design — better in three ways:
- Render dep returns `buffer` directly in `RenderImageResult` (no tempdir, no `node:fs` leak into the handler).
- Hard-fail audit rejects before upload (the key is content-addressed; a bad uploaded image would be served forever).
- `onWarning` callback captures non-fatal issues (audit dep throws, sidecar upload fails).

### 🔴 CRITICAL · `noopAuditImage` is the default (✅ SUPERSEDED by #72)

**Location (stale):** `services/platform-api/src/lazy-asset/route.ts:39-47` on local main @ 6e789ebe.

The route shipped with a no-op audit that always returns `hardFail: false` and `summary: 'noop (audit facade wiring pending PR 2.5)'`. Combined with finding #1, this means:

- No audit scores appear in responses
- No quality badges render in `<LazyAsset>`
- "low-quality" status from the spec never triggers

The fix for #1 needs to call `deps.auditImage(buffer)` (already wired in `buildHandlerDeps`), but the default is the noop. Until PR 2.5 lands the `image-processor/audit` subpath, the boot helper accepts an `auditImage` override — but no caller supplies one.

**Recommended fix (as written):** Same as #1. Once the handler reads the buffer, the no-op still returns "all good" so the gap is silent. Need a real audit (PR 2.5) OR a stronger no-op that returns `hardFail: true` for clearly empty buffers (force the caller to wire a real one).

**Resolution (origin/main @ 52c77f53):** **lq-core#72** (`52c77f53`) landed `pixelAuditImage` — a deterministic pixel-stat audit in `services/platform-api/src/lazy-asset/audit.ts` that composes `computePixelStatsFromImageBuffer` + `runNonLlmAudit` from `@blueforge-studio/image-processor` (the `./audit` subpath the original recommendation waited on is still missing, but this is the same composition in-package). `route.ts` now defaults `auditImage: pixelAuditImage`. Deterministic on purpose — see `feedback_audit_non_deterministic.md`.

### 🟡 WARN · `probeStorage` is O(N) (✅ SUPERSEDED by #70)

**Location (stale):** `apps/lang-core/src/lazy-asset/handler.ts:239-248` on local main @ 6e789ebe.

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

**Recommended fix (as written):** Add `StorageService.head(key): Promise<{ url?: string } | undefined>` and use it. ~10 lines.

**Resolution (origin/main @ 52c77f53):** **lq-core#70** took a different path — strictly better. `probeStorage` now calls `storage.list(key)` (passing the key as the prefix-filter argument, which the S3-compatible API supports) and returns a boolean. The URL is derived from `publicUrlBase + key` in the caller, never from adapter `list` results — this dodges the prior bug where adapters that don't populate `url` on list results turned every hit into a paid re-render. No new method on the adapter interface, no structural type change, backward-compatible.

### 🟡 WARN · Handover doc is stale

**Location:** `learn-quest/docs/LAZY_ASSET_HANDOVER_2026_09_19.md`

Claims "✅ CODE COMPLETE, awaiting operator deploy + pilot gate flip". Given the original finding #1, this was misleading. Operator who reads this and flips the gate would have seen no images.

**Resolution:** covered by STATUS_2026_09_21 + this audit's corrections. A truly-dated `LAZY_ASSET_HANDOVER_2026_09_21.md` would be redundant given the status + audit pair — the handover doc now correctly carries a "Status (2026-09-21): audit+upload glue landed in lq-core#70" banner pointing readers here.

### 🟡 WARN · Memory file is stale

**Location:** `~/.claude/projects/.../memory/project_lazy_asset_pr5c_m3_aiclient.md`

Said PR #68 "wired the real M3 + Gemini" — true for the wiring layer; didn't surface the audit+upload gap. Future agent sessions would have repeated the same false claim.

**Resolution:** memory file updated 2026-09-21; PR #70 + #72 + #73 (closed as superseded) added to the campaign table; audit gap surfaced in the "Open audit follow-ups" section.

### 🟡 WARN · PR #15 — NOT obsolete (corrected 2026-09-21)

**Location:** `lq-core#15` `fix/declare-project → main`

- Opened 2026-09-03 (before lazy-asset work)
- 76 commits behind main; conflicts (CI failure)
- Operator housekeeping check 2026-09-21 (comment on #15): every hunk is **still needed** on current main. Main has only touched one of these files (`services/platform-api/package.json`, where #67 added the new deps). The build/entrypoint/CI/overrides/ignore fixes, the pnpm-workspace `next` + `protobufjs` overrides (3 critical advisories still open on main), and the lockfile regen are all load-bearing.
- The branch carries a duplicate `project` key (lines 3 and 5 of `blueforge.config.json`); the later one silently wins. Drop that hunk on rebase.
- The `DATABASE_URL` workaround + `dependencies: {postgres: blueforge-shared}` form need a shared-vs-sidecar postgres platform decision before merging.

**Recommended fix:** Rebase onto main, keep all the surviving hunks, drop the duplicate `project` key, regenerate the lockfile. The platform decision (shared vs sidecar postgres for platform-api) is a separate scope item — file a follow-up or escalate to the platform owner.

This PR is on the critical path to the lazy-asset pilot gate flip: `api.quest` is the hand-deploy of #15, and main hasn't been deployed since. Until #15 lands, the lazy-asset handler from #70/#72 isn't reachable on prod.

**Why I (the audit author) called it "likely obsolete":** I conflated "behind main" with "obsolete". The comment on #15 corrected this. The branch's hunks remain load-bearing; the staleness is the rebuild, not the substance.

### 🟡 WARN · Stale branches (PR C — open)

**Location:** lq-core local branches (verified 2026-09-21, post-ff to origin/main)

| Branch | Status | Action |
|---|---|---|
| `chore/lazy-asset-pr1-foundation-2026-09-19` | Merged in PR #64 (`d41b0d37`) | **Delete** — `git branch -D` |
| `chore/lazy-asset-pr3-handler-2026-09-19` | Merged in PR #65 (`63da5302`) | **Delete** — `git branch -D` |
| `chore/lazy-asset-pr5a-pilot-gate-2026-09-19` | Merged in PR #67 (`8a625bdf`) | **Delete** — `git branch -D` |
| `chore/lazy-asset-pr4-hooks-ui-2026-09-19` | Not present locally | n/a (memory error — was `chore/lazy-asset-pr5a`, not `pr4`) |
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

The audit's original ordering was based on a stale local main. Corrected view against origin/main @ 52c77f53:

1. ~~**Fix the handler audit+upload gap** (finding #1)~~ ✅ SUPERSEDED by **lq-core#70** (different design — render dep returns buffer directly; cleaner)
2. ~~**Wire real audit (no more noop)** (finding #2)~~ ✅ SUPERSEDED by **lq-core#72** (`pixelAuditImage` facade)
3. ~~**Switch `probeStorage` to `storage.head`** (finding #3)~~ ✅ SUPERSEDED by **lq-core#70** (`storage.list(key)` prefix-filter is strictly better than head() — no adapter interface change)
4. ~~**Decide on PR #15** (finding #6)~~ ✅ decision recorded (NOT obsolete — needs rebase + selective cherry-pick + lockfile regen + shared-vs-sidecar platform decision); see updated §2 + operator comment on #15
5. **Prune 3 stale branches** (finding #7) — single `git branch -D` call (PR C — open)
6. ~~**Refresh handover doc** (finding #4)~~ ✅ covered by [`STATUS_2026_09_21.md`](./STATUS_2026_09_21.md) + this audit's corrections
7. ~~**Update memory entry** (finding #5)~~ ✅ done (see `project_lazy_asset_pr5c_m3_aiclient_2026_09_19.md`)
8. **Land `lq-core#15` rebased** → redeploy `api.quest` from main → pilot gate flip on `lq-romance/french/ch1` + `story-book/the-three-bears`. Currently `api.quest` runs the hand-deploy of #15, so the post-#70 handler isn't reachable on prod yet.

After #70 + #72 land (both on origin/main), the pilot gate flip becomes safe *in code*. It still requires #15 → main → prod deploy (operator-shaped).

---

## 5. PR breakdown (drive state)

| PR | Repo | Title | Estimated | Status |
|---|---|---|---|---|
| A | lq-core | `fix(lazy-asset): handler must read buffer, audit, upload, write sidecar` | ~1 hr | ⚪ SUPERSEDED by **lq-core#70** (parallel work) |
| B | lq-core | `perf(lazy-asset): probeStorage via head() not list()` | ~15 min | ⚪ SUPERSEDED by **lq-core#70** (list(key) prefix-filter is strictly better) |
| C | lq-core | `chore: prune stale lazy-asset-* branches` (pr1, pr3, pr5a) | ~5 min | 🟡 OPEN |
| D | lq-core | `chore: rebase #15 onto current main, drop duplicate project key, regenerate lockfile` | ~½ day | 🟡 OPEN — NOT obsolete (corrected); operator comment on #15 documents surviving hunks |
| E | learn-quest | `docs: refresh LAZY_ASSET_HANDOVER_2026_09_21.md` | ~10 min | ✅ covered by STATUS_2026_09_21 + this audit |
| F | (memory) | `update project_lazy_asset_pr5c_m3_aiclient.md` | ~5 min | ✅ done |
| G | (this audit doc) | `docs/LAZY_ASSET_AUDIT_2026_09_21.md` | — | ✅ done (corrected 2026-09-21) |

Operator-shaped (chat-burned protocol):
- `lq-core#15` rebase + lockfile regen + cherry-pick surviving hunks
- Deploy main for platform-api (`api.quest` currently hand-runs #15)
- `GEMINI_API_KEY` set in forge-app-2 deploy env — already documented
- `IMAGE_LAZY_GENERATION_ENABLED=true` flip on `lq-romance/french/ch1` + `story-book/the-three-bears` after #15 lands