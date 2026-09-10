# Batch 3 — 5 highest-priority life apps

**Status:** pending (prereq: batch 2 complete + 15 life-app style directive shipped)
**Designed:** 2026-09-10
**Driver:** [`batch-3.yml`](./batch-3.yml)
**Scope:** anatomy, health, psychology, philosophy, plumbing (the 5 life apps with relaxed-bar re-audit data, 1,226 regen candidates per handover doc §"Relaxed-bar re-audit — life subset").

---

## Why these 5 apps first

The handover doc identifies 5 life apps with relaxed-bar re-audits completed (2026-08-10):
| App | Imgs | ≤5 (regen candidates) | pixel-gate rejects | LLM ≤5 | **% pixel-gated** |
|---|---:|---:|---:|---:|---:|
| lq-anatomy | 468 | 461 | 417 (89%) | 44 | 90% |
| lq-health | 224 | 221 | 181 (81%) | 40 | 82% |
| lq-psychology | 200 | 200 | 184 (92%) | 16 | 92% |
| lq-philosophy | 207 | 194 | 180 (87%) | 14 | 93% |
| lq-plumbing | 150 | 150 | 133 (89%) | 17 | 89% |
| **Total** | **1,249** | **1,226** | **1,095 (89%)** | **131** | — |

These are the cleanest test surface because:
1. We have **per-app per-pixel-gate-reject counts** — the deterministic 89% is the highest-confidence target population.
2. The pilot (Imagen-4 vs Gemini-3.1-batch) will run on lq-anatomy, so this app's tier verdict directly feeds back into batch 3's tier mapping.
3. **Pilot results on lq-anatomy apply directly** to the other 4 apps (same author, same era, same style directive gap).

---

## The style-directive gap (BLOCKER)

Per the handover doc §"Key findings":

> **The style directive is the gating config gap.** Pass 1 (no directive) produced flat preschool/Duolingo clipart — finance avg 3.0, 76% ≤5. Adding the manga/realistic-cartoon directive (lq-tools `23f1d9b`) raised the audit slice avg to 5.52/5.85 and cut pixel-gated 13→4 / 14→3. **All 17 life-app configs need this directive before their empties regen is worth auditing** — only finance + economics have it today.

The 5 apps in batch 3 do NOT have the directive yet. **Before batch 3 starts**, the lq-tools PR must add the manga/realistic-cartoon directive to:
- `config/subjects/anatomy/lessons-*.json`
- `config/subjects/health/lessons-*.json`
- `config/subjects/psychology/lessons-*.json`
- `config/subjects/philosophy/lessons-*.json`
- `config/subjects/plumbing/lessons-*.json`

**Without the directive, batch 3 will reproduce the finance/economics Aug-5 result: avg 1.4, 95% ≤5.** The directive is what raised avg to 5.52+. Skipping it wastes ~$50 of API spend.

---

## Scope

| App | Total imgs | Regen candidates | Tier A (lesson scenes) | Tier B (base) | Variants |
|---|---:|---:|---:|---:|---:|
| lq-anatomy | 468 | 461 | 200 (est) | 268 | ~140 |
| lq-health | 224 | 221 | 96 (est) | 128 | ~67 |
| lq-psychology | 200 | 200 | 86 (est) | 114 | ~60 |
| lq-philosophy | 207 | 194 | 89 (est) | 118 | ~62 |
| lq-plumbing | 150 | 150 | 64 (est) | 86 | ~45 |
| **Total** | **1,249** | **1,226** | **~535** | **~714** | **~374** |

(Tier A/B split is an estimate — life apps don't have the `chapter-N/` directory structure school apps do, so the boundary is the lesson-folder convention; refine after inventory.)

---

## Pilot on lq-anatomy runs FIRST (within batch 3's scope)

Per the program overview, the pilot 20 is on **lq-anatomy** (10 of its regen candidates). That happens BEFORE batch 3, so by the time batch 3 starts:
1. Tier verdict from pilot 20 is known.
2. Pilot 100 (on lq-math) is also complete.

**Action:** the 10 lq-anatomy images used in pilot 20 are excluded from batch 3 (already regenerated). Pilot 100 is on lq-math, not life — no overlap.

---

## Tier mapping (provisional, pilot-dependent)

**Pilot-tier verdict determines life-app tier:**

| Pilot verdict | Tier A (lesson scenes) | Tier B (base) |
|---|---|---|
| Imagen-4 ≥ 7.5 AND 3.1-batch ≥ 6.0 | Imagen-4 | Gemini-3.1-batch |
| Imagen-4 ≥ 7.5 AND 3.1-batch < 6.0 | Imagen-4 | Imagen-4 (downgrade to "Best") |
| Imagen-4 < 7.5 BUT ≥ 6.5 | demote to Gemini-3.1-batch | Gemini-3.1-batch |
| Gemini-3.1-batch < 6.0 | demote to Gemini-2.5-batch | Gemini-2.5-batch |

**Recommended default (assuming pilot passes both tiers):**
- Tier A: Imagen-4, $0.04/img, target ≥ 7.5
- Tier B: Gemini-3.1-batch, $0.0335/img, target ≥ 6.0

---

## Estimated cost

**Hybrid (recommended, realtime mode):** (535 × $0.04) + (714 × $0.039) = **$21.40 + $27.85 = $49.25**.
**All-Imagen-4:** (1,249 × $0.04) = **$49.96** (essentially same as hybrid — simplify if quality permits).
**All-3.1-flash realtime:** (1,249 × $0.067) = **$83.68** (worst case).
**Tier D (Imagen-4-fast everywhere):** (1,249 × $0.02) = **$24.98** (cheap fallback).

**Budget recommendation:** **$50** with retries on the harder 10-15% (the LLM-failed slice, ~131 imgs; predict 15% regen-resistant per the handover doc's 96.8% clear rate).

---

## Per-app sequencing

Each app follows the same shape (lq-anatomy example):

```bash
cd lq-tools

# 1. Re-audit under relaxed bar (if not already 2026-08-10).
#    Existing audit JSONs in public/images/ are valid through Sep; refresh only if older than 30 days.
npx tsx scripts/ai-audit-images.ts \
  --path=../life-quest/lq-anatomy/public/images \
  --output=../life-quest/lq-anatomy/public/images/image-audit-results-2026-09-20.json \
  --budget=2

# 2. Construct regen-file from needs_regeneration=true
jq '[.results[] | select(.needs_regeneration==true)]
    | map({image, needs_regeneration, score: .quality_score, reason: "batch-3-empties"})' \
  ../life-quest/lq-anatomy/public/images/image-audit-results-2026-09-20.json \
  > /tmp/lq-anatomy-batch3.json

# 3. Regen. Tier A first (lesson scenes), Tier B second (base).
#    Tier assignment per app is encoded in batch-3.yml.

# 4. Audit acceptance gate per tier.
# 5. Commit + push.
```

Order of apps (worst-quality-first, based on Aug-10 re-audit):
1. **lq-anatomy** (461/468 = 98.5% regen — most empties, biggest payoff)
2. **lq-plumbing** (150/150 = 100% — all of them are empties, easy win)
3. **lq-health** (221/224 = 98.7%)
4. **lq-philosophy** (194/207 = 93.7%)
5. **lq-psychology** (200/200 = 100%)

---

## Pacing (per memory `feedback_regen_pacing.md`)

- **Max 200 imgs per regen call** — anatomy at 461 regen candidates requires **3 sequential calls** (one per 200/200/61 batch). Other apps fit in 1-2 calls.
- **Audit in 5 folders OR 500 images** — anatomy is 468 (just under 500); audit in one call. Others are 150-224, one audit each.
- **Budget per regen call: $4-15.** Default $4 per memory; bump to $10 for anatomy's largest batch.

---

## Acceptance gate

Identical to batches 1 + 2:
- **Tier A revert:** `quality_score < 7.5`
- **Tier B revert:** `quality_score < 6.0`
- **Known-hard residue:** handover doc says ~3% residue is expected (the gate-reverted population that survived 3 regen passes). Don't retry those — accept the loss.

---

## Risks

1. **Style directive gap** — without the lq-tools PR landing, batch 3 reproduces the Aug-5 result (avg 1.4, 95% ≤5). The PR is a **hard prerequisite**.
2. **Pilot 20 on lq-anatomy skews the dataset** — by the time batch 3 runs, lq-anatomy has 10 imgs already regen'd (some may pass 7.5, some may not). The acceptance gate must exclude pilot-20 paths from the regen-file.
3. **Variant generation** — life apps have ~374 variants to regenerate via `lq-tools/packages/asset-scaffolding/src/generate-missing-variants.ts`. This runs as a separate post-step (no sharp-based prebuild hook). Need to budget ~5 minutes per app for variant regen.
4. **Branch state** — all 5 life apps should be on `deploy/hetzner-<subject>-quest`. Verify before each app starts.

---

## What's NOT in batch 3

The 12 remaining life apps (tech, law, construction, media, game-design, game-dev, maker, electronics, cooking, engineering, economics, finance) are deferred:
- Economics + finance have the directive + their own in-flight empties pilot (~14 final residue; final residue is acceptable).
- The other 10 (tech, law, construction, media, game-design, game-dev, maker, electronics, cooking, engineering) have **only Aug-5 strict-bar baselines** — no relaxed-bar re-audit. They need Stage 2 (re-audit) before any regen has signal.

**Future batch proposal:** `batch-4-life-remaining.md` covering these 12 after their relaxed-bar audits complete (≤100-img/day provider quota → ~3-5 days per app).

---

## Cost summary (realtime mode)

| Tier | Imgs | $/img | Subtotal |
|---|---:|---:|---:|
| Tier A (Imagen-4 lesson scenes) | ~535 | $0.040 | $21.40 |
| Tier B (Gemini-2.5-flash realtime base) | ~714 | $0.039 | $27.85 |
| Retry budget (~10%) | — | — | $5.00 |
| Variant regen (sharp, free) | ~374 | $0 | $0 |
| Audit costs (≤100/day cap) | — | — | $3.00 |
| **Total batch 3 hybrid** | **1,249** | — | **~$57** |

Cost bands:
- All-Imagen-4: $50 (essentially same as hybrid — consider simplifying)
- All-Tier C 3.1-flash: (1,249 × $0.067) + $5 = **$89** (worst case)
- All-Tier D Imagen-4-fast: $25 + $5 = **$30** (cheap fallback if quality permits)
- **Best-case: ~$30. Worst-case: ~$89.**
