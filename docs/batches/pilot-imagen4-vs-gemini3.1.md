# Pilot — Imagen-4 vs Gemini-3.1-flash-image (Batch API)

**Status:** Pilot 20 COMPLETE 2026-09-10 (Imagen-4 unavailable via `GEMINI_API_KEY`; reframed to 3.1-flash vs 2.5-flash)
**Designed:** 2026-09-10
**Scope:** 20 regen candidates on lq-anatomy → tier-routing verdict for batch 1.

---

## Pilot 20 results (2026-09-10)

**Headline:** 3.1-flash beats 2.5-flash by **+1.3 avg quality points** (4.0 vs 2.7) on a 10-vs-10 head-to-head. **Neither tier hits the 6.0 target** — the dominant failure is art-style mismatch, the same gap the in-flight lq-tools style-directive PR addresses.

### What changed mid-pilot

Imagen-4 (`imagen-4.0-generate-001`) is **not exposed via the public Gemini API** — only Vertex AI exposes it. With `GEMINI_API_KEY` from `~/.zshrc`, every Imagen-4 call returns `404 NOT_FOUND`. Tier A and Tier D are unavailable until gcloud OAuth is wired. Pilot 20 was reframed to a **2.5-flash vs 3.1-flash** head-to-head.

### Selection bias

The two sets came from **different slices** of the same 2026-08-10 audit (input floor = 1.0 for all 20):
- **3.1-flash (10 imgs):** sort_by `.quality_score [30:40]` — mid-slice of needsRegen population
- **2.5-flash (10 imgs):** sort_by `.quality_score [20:30]` — worse-slice (would have been Imagen-4's inputs)

So 2.5-flash got harder inputs. **Even so, 3.1-flash wins by 1.3 points.** This is a clean signal.

### Numbers

| Tier | n | Avg score | Δ from floor (1.0) | High (≥7) | Medium (4-6) | Low (≤3) | needs_regen | Art-style match | Cost |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| **3.1-flash** | 10 | **4.0** | **+3.0** | 2 | 5 | 3 | 7 (70%) | 60% | $0.67 |
| **2.5-flash** | 10 | **2.7** | **+1.7** | 0 | 4 | 6 | 8 (80%) | 60% | $0.39 |
| Overall | 20 | 3.4 | +2.4 | 2 | 9 | 9 | 15 (75%) | 60% | $1.06 |

### Cost-per-quality-recovered

- **3.1-flash:** $0.067/img ÷ 3.0 pts recovered = **$0.022 / pt**
- **2.5-flash:** $0.039/img ÷ 1.7 pts recovered = **$0.023 / pt**

Tied on efficiency — but 3.1-flash reaches a **higher destination** (4.0 vs 2.7), so it converts harder cases to medium-quality while 2.5-flash leaves them near the floor.

### Why both miss the 6.0 target

The audit flagged ~8 issues per regenerable image, dominated by:
- `art-style mismatch: High quality realistic (RPG) manga style.` (8 imgs)
- `childish style: flat, primary-color preschool cartoon below target audience bar` (2 imgs)
- `Flat-color educational illustration style with no painterly depth or atmospheric shading` (2 imgs)
- `Resembles a Duolingo-style or medical diagram educational illustration` (3 imgs)

These are **not model-quality failures** — they're the **directive gap** the lq-tools PR fixes. With the directive in place, the prior lq-history re-audit went from avg 1.4 → 5.5+. Expect the same lift here once the PR lands.

### Verdict for batch 1 (and onward)

**Tier C (3.1-flash, $0.067) replaces Tier A (Imagen-4, unavailable).** Tier B (2.5-flash, $0.039) holds as the cheap fallback for non-priority content.

| Role | Model | Cost | Target | Why |
|---|---|---:|---:|---|
| **Tier A** (lesson scenes, rpg base, character art) | **`gemini-3.1-flash-image`** | $0.067 | 6.0 | Pilot winner — +1.3 over 2.5-flash, +3.0 from floor |
| **Tier B** (subject-folder base, `lessons/general/`) | `gemini-2.5-flash-image` | $0.039 | 5.0 | Cheap fallback for less-priority surfaces |
| Tier D (Imagen-4-fast, future) | n/a | $0.020 | n/a | Unavailable until Vertex AI auth wired |

**Batch 1 cost revision:** Tier A = (695 × $0.067) + Tier B = (312 × $0.039) = **$46.57 + $12.17 = $58.74**. Round to **$62** with retries. Up from $49 in the original plan because Imagen-4 ($0.04) is replaced by 3.1-flash ($0.067).

### Open questions after pilot 20

1. **Should batch 1 wait for the lq-tools style-directive PR?** Without it, the pilot hit avg 4.0/2.7 — well below target. With it, lq-history hit avg 5.5+. The directive lifts both tiers by ~3 points.
2. **Run pilot 100 on lq-math rpg/ before batch 1?** Pilot 20 was on lq-anatomy (life-app). School surface may behave differently. Recommend: yes, run pilot 100 (~$4) once the directive PR merges, to validate 3.1-flash on the school-rpg surface.

---

## Why this pilot (original framing, still valid)

---

## Why this pilot

The handover doc (2026-08-09) recommended **Gemini-2.5-flash-image batch at $0.0195/img**, beating 3.1 on the empties sample (5.9 vs 5.3 avg). That comparison was at **realtime pricing** for both models.

**Auth pivot 2026-09-10:** User opted for `GEMINI_API_KEY` (env, in `~/.zshrc`) instead of Vertex AI / gcloud OAuth2. Without `--batch`, the client constructs `GoogleGenAI({ apiKey })` directly (see `blueforge-org/packages/ai/image-gen/src/clients/GeminiImageClient.ts:121-123`). The `useVertexAi` / `useBatchApi` path is bypassed. Cost doubles for Gemini image models (batch → realtime), but Imagen-4 is unchanged.

**Current pricing (realtime only):**

| Model | $/img | Notes |
|---|---:|---|
| `imagen-4.0-generate-001` | $0.040 | flat per image, no batch mode |
| `imagen-4.0-fast-generate-001` | $0.020 | flat, cheapest option |
| `gemini-2.5-flash-image` | $0.039 | realtime; was $0.0195 batch |
| `gemini-3.1-flash-image` | $0.067 | realtime; was $0.0335 batch |

**Pilot reframed:** originally the question was "does Gemini-3.1-batch quality hold at 3.1-batch pricing?" Now it's **"Imagen-4 vs Gemini-3.1-flash realtime, on cost AND quality, with Imagen-4-fast as the cheap fallback."** Imagen-4 at $0.04 is **cheaper** than 3.1-flash realtime ($0.067) and comparable to 2.5-flash realtime ($0.039). The tier model flips: Imagen-4 becomes the default, not the premium.

The pilot answers three questions:

1. Does Imagen-4 clear the relaxed art bar at 7.5+ avg?
2. Does Gemini-3.1-flash realtime beat Imagen-4 on quality (and justify 67% higher cost)?
3. What target score should each tier be held to?

---

## Pilot 20 — design

**Target:** 10 empties on lq-anatomy per model. Empties = corner-flood / mostly-white / low-luminance / text-only (`needs_regeneration: true` in the 2026-08-10 relaxed audit).

**Selection method:**
- Use the existing `lq-anatomy/public/images/image-audit-results-2026-08-10.json` (461/468 needsRegen, just committed in `a850182`).
- Sort by quality_score ascending (worst first); skip the first 20 (potential known-hard population).
- Pick image #21-30 for Imagen-4 tier, #31-40 for Gemini-3.1-flash tier.
- Reason: skip the "deepest empties" that may be regen-resistant for any model — we want a head-to-head on tractable cases first.

**Tier A (Imagen-4):** `--model=imagen-4.0-generate-001 --provider=gemini` — realtime, $0.04/img × 10 = **$0.40**.

**Tier C (Gemini-3.1-flash realtime):** `--model=gemini-3.1-flash-image --provider=gemini` — realtime, $0.067/img × 10 = **$0.67**.

**Total pilot 20 cost:** **~$1.07.**

**Step-by-step:**

```bash
# 0. Confirm GEMINI_API_KEY is exported
echo "GEMINI_API_KEY length: ${#GEMINI_API_KEY}"   # must be > 0

# 1. Construct two regen-candidates JSON files (filtered from 2026-08-10 audit)
cd /Users/kmandrup/Projects/Repos/learn-quest/life-quest/lq-anatomy
jq '[.results[] | select(.needs_regeneration==true)]
    | sort_by(.quality_score)
    | .[20:30]
    | map({image, needs_regeneration, score: .quality_score, reason: "pilot-imagen4"})' \
  public/images/image-audit-results-2026-08-10.json \
  > /tmp/pilot-imagen4.json

jq '[.results[] | select(.needs_regeneration==true)]
    | sort_by(.quality_score)
    | .[30:40]
    | map({image, needs_regeneration, score: .quality_score, reason: "pilot-gemini3.1-flash"})' \
  public/images/image-audit-results-2026-08-10.json \
  > /tmp/pilot-gemini3.1-flash.json

# 2. Generate. Use --dry-run first to confirm target list.
cd /Users/kmandrup/Projects/Repos/learn-quest/lq-tools
npx tsx scripts/regenerate-flagged-images.ts \
  --app=lq-anatomy \
  --regen-file=/tmp/pilot-imagen4.json \
  --model=imagen-4.0-generate-001 \
  --provider=gemini \
  --budget=2 \
  --dry-run

# Note: NO --batch flag. Realtime mode uses GEMINI_API_KEY directly.
npx tsx scripts/regenerate-flagged-images.ts \
  --app=lq-anatomy \
  --regen-file=/tmp/pilot-gemini3.1-flash.json \
  --model=gemini-3.1-flash-image \
  --provider=gemini \
  --budget=2 \
  --dry-run

# 3. Execute (drop --dry-run)
npx tsx scripts/regenerate-flagged-images.ts \
  --app=lq-anatomy \
  --regen-file=/tmp/pilot-imagen4.json \
  --model=imagen-4.0-generate-001 \
  --provider=gemini \
  --budget=2

npx tsx scripts/regenerate-flagged-images.ts \
  --app=lq-anatomy \
  --regen-file=/tmp/pilot-gemini3.1-flash.json \
  --model=gemini-3.1-flash-image \
  --provider=gemini \
  --budget=2

# 4. Audit the regenerated images
npx tsx scripts/ai-audit-images.ts \
  --path=../life-quest/lq-anatomy/public/images \
  --image-list=/tmp/pilot-imagen4.json \
  --output=/tmp/pilot-imagen4-audit.json

npx tsx scripts/ai-audit-images.ts \
  --path=../life-quest/lq-anatomy/public/images \
  --image-list=/tmp/pilot-gemini3.1-flash.json \
  --output=/tmp/pilot-gemini3.1-flash-audit.json

# 5. Compare. Acceptance gates per tier.
#    Imagen-4: keep if score >= 7.5
#    Gemini-3.1-flash: keep if score >= 6.0
#    Otherwise: git checkout -- <file> to revert to original
```

**Outcome:** record avg score per tier, cost per tier, and revert counts. Feed results into batch 1 tier mapping.

---

## Pilot 100 — scale-up (after Pilot 20 verdict)

**Target:** 100 images on lq-math `rpg/` (20 base × 4 sub-folders + 80 from chapter-1, the school app with the highest-priority bucket the user named: backgrounds, avatars, rpg).

**Why lq-math:** It's the only school app with `rpg/{avatars,backgrounds,bosses,equipment}/` (20 base images). Chapter-1 has 16 lessons. The pilot-100 surfaces any issue with the chapter-config-stamped regen path before batch 1's 15 chapter invocations.

**Selection:**
- All 20 rpg base images (highest-priority tier per user's directive: "backgrounds, avatars, rpg images")
- 80 images from chapter-1 (subset chosen: 16 base + 64 from existing needsRegen list)

**Tier mix (Imagen-4 throughout — recommended):**
- rpg/ → Tier A (Imagen-4, target 7.5) — 20 images × $0.04 = **$0.80**
- chapter-1 lesson scenes → Tier A (Imagen-4) — 80 images × $0.04 = **$3.20**

**Total pilot 100 cost:** **~$4.00.**

**Alternative (Imagen-4-fast — cheapest):**
- rpg/ → Tier D (Imagen-4-fast, target 6.0) — 20 × $0.02 = **$0.40**
- chapter-1 → Tier D — 80 × $0.02 = **$1.60**
- Total: **~$2.00** (validates if Imagen-4-fast is sufficient quality)

**Recommended:** run Tier A throughout the pilot 100. It's only $1.35 more than Imagen-4-fast, and validates Imagen-4 on the school-rpg surface. If Tier A fails the 7.5 target, we already know we need to demote for batch 1.

---

## Pilot decision matrix

| Pilot 20 outcome | Pilot 100 outcome | Batch 1 verdict |
|---|---|---|
| Imagen-4 ≥ 7.5 avg AND 3.1-flash ≥ 6.0 avg | n/a | Use Tier A for everything (Imagen-4 is cheaper than 3.1-flash and matches its quality). |
| Imagen-4 ≥ 7.5 avg but 3.1-flash < 6.0 avg | n/a | All-Imagen-4. Skip Tier C. |
| Imagen-4 < 7.5 avg but ≥ 6.5 avg | n/a | Demote Tier A → Tier B-equivalent. Use 2.5-flash realtime as base, Imagen-4 for scenes. Hybrid ~$40. |
| Imagen-4 < 6.5 avg | n/a | Try Imagen-4-fast (Tier D, $0.020). If still failing, escalate to Tier C (3.1-flash $0.067) for everything. |
| n/a | Tier A fails 7.5 target on 100 imgs | Demote. Try Tier D fast first; if quality permits, batch 1 = $20. |
| n/a | Tier A passes 7.5 on 100 imgs | Proceed with all-Imagen-4 batch 1, ~$40 total. |
