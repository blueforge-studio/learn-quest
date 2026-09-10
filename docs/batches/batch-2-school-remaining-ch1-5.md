# Batch 2 — Remaining school apps (ch1-5)

**Status:** pending (prereq: batch 1 complete + verdicts)
**Designed:** 2026-09-10
**Driver:** [`batch-2.yml`](./batch-2.yml)
**Scope:** science + geography ch1-5. History deferred — see "history carve-out" below.

---

## Scope

| App | Chapters 1-5 | Base + general | **Total** |
|---|---:|---:|---:|
| lq-science | 495 | 177 | **672** |
| lq-geography | 373 | 108 | **481** |
| lq-history | ~2,310 (all 7 era × region ch1-5) | (negative — all in ch1-5) | **DEFERRED** |
| **Total (without history)** | **868** | **285** | **1,153** |

**Tier mapping (same as batch 1) — REALTIME MODE:**
- **Tier A — Imagen-4 (target ≥ 7.5):** all lesson scenes (chapters 1-5)
- **Tier B — Gemini-2.5-flash realtime (target ≥ 6.0):** base + general

Image count by tier:

| App | Tier A (Imagen-4) | Tier B (2.5-flash realtime) |
|---|---:|---:|
| lq-science | 495 | 177 |
| lq-geography | 373 | 108 |
| **Total** | **868** | **285** |

**Estimated cost (hybrid):** (868 × $0.04) + (285 × $0.039) = **$34.72 + $11.12 = $45.84**.
**Round to $50** to cover retries.

**If pilot shows Imagen-4 ≥ 7.5 AND 2.5-flash ≥ 6.0:** all-Imagen-4 = (1,153 × $0.04) = **$46.12** (slightly more than hybrid; pick hybrid for tier diversity).
**If pilot shows Imagen-4 < 7.5:** demote Tier A → Tier C (3.1-flash realtime $0.067). Batch 2 = (868 × $0.067) + (285 × $0.039) = **$69.27**.
**Tier D fallback (Imagen-4-fast $0.020):** (868 × $0.02) + (285 × $0.039) = **$28.48** (cheap if quality permits).

---

## Why history is deferred

**lq-history is the biggest and most-worked school app (2,266 base imgs) with an active campaign:**
- 11 unpushed commits on `deploy/hetzner-history-quest` (handover doc §"Staged art-mismatch fleet plan").
- In-flight: full-app re-audit (`#295`) for a clean final ≤5 count under the relaxed bar.
- Stage 1 fleet empties already done: 559 + 50 = 609 empties cleared.
- Stage 4: 438-image outlier pass deferred.
- 7/7 art-style fixes committed (region descriptors).

Including history's ch1-5 = ~2,310 imgs in batch 2 would:
1. Cost $90+ (Imagen-4) or $77 (Gemini-3.1-batch) — **2x the rest of batch 2**.
2. Conflict with #295's audit-driven cleanup logic.
3. Require splitting history's chapter stamp logic, which spans 7 era × 5 region × 5 chapters.

**Recommendation:** Let the in-flight history work settle (#295 audit + 438-outlier batch + push to origin), then plan a **separate `batch-2-history-extension.yml`** that integrates with #295's output. Defer until batch 3 lands or #295 ships — whichever comes first.

---

## Per-app sequencing

### lq-science (672 imgs)

**Branch:** `deploy/hetzner-science-quest` (verify — handover doc claims this; check `git branch --show-current` first).
**Audit file:** `public/images/image-audit-results-2026-08-10.json` (verify — Aug-10 was the most recent full audit per the doc).

**Step 1 — chapter mode (5 invocations, $0.04 × 495 = $19.80):**
```bash
cd lq-tools
for n in 1 2 3 4 5; do
  npx tsx scripts/regenerate-flagged-images.ts \
    --app=lq-science \
    --chapter=$n \
    --model=imagen-4.0-generate-001 \
    --provider=gemini \
    --budget=20
done
```

**Step 2 — base regen (1 invocation, $0.0335 × 177 = $5.93):**
```bash
jq '[.results[]
    | select(.needs_regeneration==true)
    | select(.image | startswith("lessons/")
                    and (startswith("lessons/lq-science/") | not))]
    | map({image, needs_regeneration, score, reason: "batch-2-base"})' \
  ../school-quest/lq-science/public/images/image-audit-results-2026-08-10.json \
  > /tmp/lq-science-base-regen.json

npx tsx scripts/regenerate-flagged-images.ts \
  --app=lq-science \
  --regen-file=/tmp/lq-science-base-regen.json \
  --model=gemini-3.1-flash-image \
  --provider=gemini \
  --batch \
  --budget=15
```

**Step 3 — audit + acceptance gate** (same pattern as batch 1).
**Step 4 — commit + push.**

### lq-geography (481 imgs)

Same pattern as lq-science. Audit file is the most recent `image-audit-results-*.json` in `public/images/`.

---

## Pacing (per memory `feedback_regen_pacing.md`)

Each chapter invocation is 88-120 imgs (well under 200 cap). Base invocation is 108-177 imgs (under cap). 6 regen calls per app × 2 apps = 12 regen calls. Audit each app independently (under 500-imgs threshold).

---

## Acceptance gate

Identical to batch 1:
- **Tier A revert:** `quality_score < 7.5`
- **Tier B revert:** `quality_score < 6.0`
- Per-tier `git checkout -- <file>` after audit.

---

## Risks

1. **lq-science ch3-5 each have 120 imgs** — at $0.04/img = $4.80 per chapter call. If 3.1-batch regresses and we switch Tier A → Tier B mid-batch, the in-flight chapter call needs to be cancelled and restarted. Mitigate: pre-confirm pilot verdict before invoking.
2. **lq-geography has fewer chapter-1 imgs than later chapters** (21 vs 88). Chapter 1 may produce low-volume results that aren't statistically meaningful. Re-audit ch1 separately if needed.
3. **No variant regen needed** — neither science nor geography has rpg/ folders; lesson scene variants are config-driven and emitted by the regen script.

---

## Cost summary (realtime mode)

| Tier | Imgs | $/img | Subtotal |
|---|---:|---:|---:|
| Tier A (Imagen-4 lesson scenes) | 868 | $0.040 | $34.72 |
| Tier B (Gemini-2.5-flash realtime base) | 285 | $0.039 | $11.12 |
| Retry budget (~10%) | — | — | $5.00 |
| Audit costs (negligible) | — | ~$0.005/img | $6.00 |
| **Total batch 2 hybrid** | **1,153** | — | **~$57** |

Cost bands:
- All-Imagen-4: $46.12 + $5 = $51
- Tier C fallback (3.1-flash for Tier A): (868 × $0.067) + (285 × $0.039) = $69.27 + $5 = **$74**
- Tier D fallback (Imagen-4-fast everywhere): (1,153 × $0.02) = **$23** + $5 retries = **$28**
- **Best-case: ~$28 (Imagen-4-fast). Mid: ~$51. Worst: ~$74.**
