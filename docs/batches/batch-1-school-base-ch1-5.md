# Batch 1 — School reading+writing+math (base + ch1-5)

**Status:** pending (prereq: pilot 20 + pilot 100 verdicts)
**Designed:** 2026-09-10
**Driver:** [`batch-1.yml`](./batch-1.yml)
**Branch strategy:** each app regens on its current branch, push when complete.

---

## Scope

| App | Base + general | Subject folders | RPG base | Chapters 1-5 | **Total** |
|---|---:|---:|---:|---:|---:|
| lq-reading | 102 | 12 | 0 | 182 | **296** |
| lq-writing | 79 | 12 | 0 | 216 | **307** |
| lq-math | 92 | 15 | 20 | 277 | **404** |
| **Total** | **273** | **39** | **20** | **675** | **1,007** |

**Tier mapping (per [program overview](./00-program-overview.md)) — PILOT-VERIFIED 2026-09-10:**

- **Tier A — Gemini-3.1-flash realtime (target ≥ 6.0):** all lesson scenes (chapters 1-5) + lq-math `rpg/{avatars,backgrounds,bosses,equipment}/` (20 base)
- **Tier A' (PENDING TRIAL) — Gemini-3.1-flash-lite realtime (target ≥ 6.0, $0.0336/img VERIFIED):** pricing live on Gemini API as of 2026-09-10. If 5-image lq-anatomy trial (task #26) hits avg ≥ 4.0, this replaces Tier A at half the cost — batch 1 drops from $62 → $34.
- **Tier B — Gemini-2.5-flash realtime (target ≥ 5.0):** subject-folder base + `lessons/general/`

> **Tier model revision:** Pilot 20 (2026-09-10) confirmed Imagen-4 is unavailable via `GEMINI_API_KEY` (Vertex AI only — `404 NOT_FOUND`). Tier A is now `gemini-3.1-flash-image` ($0.067). Pilot 20: 3.1-flash avg 4.0 (+3.0 from floor) beats 2.5-flash avg 2.7 (+1.7) by **+1.3 points**. Both below target until the lq-tools style-directive PR lands.
> **2026-09-10 update:** Tier A' added — `gemini-3.1-flash-lite-image` VERIFIED at $0.0336/img from https://ai.google.dev/pricing (blueforge-org#114, image-gen 0.2.3). Trial pending.

Image count by tier:

| App | Tier A (3.1-flash realtime) | Tier B (2.5-flash realtime) |
|---|---:|---:|
| lq-reading | 182 | 114 |
| lq-writing | 216 | 91 |
| lq-math | 297 | 107 |
| **Total** | **695** | **312** |

**Estimated cost (hybrid):** (695 × $0.067) + (312 × $0.039) = **$46.57 + $12.17 = $58.74**.
**Round up to $62** for retries on the harder 10-15%.

**If lq-tools directive PR lands before batch 1:** expect +3.0 avg lift (per lq-history precedent). Re-evaluate whether all-2.5-flash ($39) is sufficient.
**If batch 1 must start without directive:** run Tier A as 3.1-flash anyway (best quality), Tier B as 2.5-flash. Plan a follow-up regen pass post-directive.

---

## Per-app sequencing

### lq-reading (296 imgs)

**Branch state:** `chore/shared-app-audit-checks` — **NOT on deploy branch**. Blocker. Rebase to `deploy/hetzner-reading-quest` before batch 1 starts.

**Step 1 — chapter mode (5 invocations, $0.04 × 182 = $7.28):**
```bash
cd /Users/kmandrup/Projects/Repos/learn-quest/lq-tools
for n in 1 2 3 4 5; do
  npx tsx scripts/regenerate-flagged-images.ts \
    --app=lq-reading \
    --chapter=$n \
    --model=imagen-4.0-generate-001 \
    --provider=gemini \
    --budget=20
done
```

**Step 2 — base regen (1 invocation, $0.039 × 114 = $4.45):**
```bash
# Build the regen-file by filtering the 2026-08-27 audit to base paths only
jq '[.results[]
    | select(.needs_regeneration==true)
    | select(.image | startswith("lessons/comprehension/")
                    or startswith("lessons/literature/")
                    or startswith("lessons/phonics/")
                    or startswith("lessons/vocabulary/")
                    or startswith("lessons/general/"))]
    | map({image, needs_regeneration, score, reason: "batch-1-base"})' \
  /Users/kmandrup/Projects/Repos/learn-quest/school-quest/lq-reading/public/images/image-audit-results-2026-08-27.json \
  > /tmp/lq-reading-base-regen.json

npx tsx scripts/regenerate-flagged-images.ts \
  --app=lq-reading \
  --regen-file=/tmp/lq-reading-base-regen.json \
  --model=gemini-2.5-flash-image \
  --provider=gemini \
  --budget=15
```

**Step 3 — audit acceptance gate:**
```bash
npx tsx scripts/ai-audit-images.ts \
  --path=../school-quest/lq-reading/public/images \
  --output=../school-quest/lq-reading/public/images/image-audit-results-2026-09-15.json

# Per-tier revert:
#   imagen-4:    git checkout -- $(jq -r '.results[] | select(.quality_score < 7.5) | .image' /tmp/lq-reading-imagen4-audit.json)
#   2.5-flash:   git checkout -- $(jq -r '.results[] | select(.quality_score < 6.0) | .image' /tmp/lq-reading-base-audit.json)
```

**Step 4 — commit + push (when deploy branch is correct):**
```bash
cd ../school-quest/lq-reading
git checkout deploy/hetzner-reading-quest  # if not already
git rebase chore/shared-app-audit-checks    # bring the audit-bin chore commits
git add public/images/
git commit -m "batch-1: regenerate 296 base + ch1-5 (Imagen-4 + 2.5-flash realtime)"
git push origin deploy/hetzner-reading-quest
```

### lq-writing (307 imgs)

Same pattern as lq-reading, 5 chapter invocations + 1 base. Branch: `deploy/hetzner-writing-quest` ✓ (matches handover).

### lq-math (404 imgs)

Branch: `deploy/hetzner-math-quest` ✓ — but **7 unpushed commits ahead of origin**. Push or rebase before batch 1.

**Special: 20 rpg base images go to Tier A.** Use the rpg folders (not the per-lesson chapter mode):
```bash
jq '[.results[]
    | select(.needs_regeneration==true)
    | select(.image | startswith("rpg/"))]
    | map({image, needs_regeneration, score, reason: "batch-1-rpg"})' \
  /Users/kmandrup/Projects/Repos/learn-quest/school-quest/lq-math/public/images/image-audit-results-2026-08-10.json \
  > /tmp/lq-math-rpg-regen.json

npx tsx scripts/regenerate-flagged-images.ts \
  --app=lq-math \
  --regen-file=/tmp/lq-math-rpg-regen.json \
  --model=imagen-4.0-generate-001 \
  --provider=gemini \
  --budget=5
```

The 60 variants (`name--128.webp`, `--256`, `--512`) in rpg/ are regenerated automatically by `processConfigBatch` because `imageTypes[name].variantWidths` is set; no separate step needed.

---

## Pacing (per memory `feedback_regen_pacing.md`)

- **$4 budget per regen call** (cap inside the regen script). Above commands use $15-20 budgets because they're batch calls; the per-image pacing is what matters.
- **Max 200 imgs per regen call** — none of our calls exceed this. Chapter mode is ≤ 66 imgs (lq-math ch3-5); base mode is ≤ 114 imgs (lq-reading). All within limit.
- **Audit in 5 folders OR 500 images** — each app is well under 500 imgs, so per-app audits are fine.

---

## Acceptance gate (per the handover doc §"Revert gate applied")

- Commit generated images FIRST → audit → `git checkout --` failures.
- **Tier A revert:** `quality_score < 7.5`
- **Tier B revert:** `quality_score < 6.0`
- **Never revert on text alone** above the threshold (text words tolerable).

The `--min-score` flag does not exist in `ai-audit-images.ts`. The acceptance gate is post-audit filtering via `jq` + `git checkout`.

---

## Variants

Variants (`name--NNN.webp`) are regenerated automatically by the regen script when `imageTypes[name].variantWidths` is set. For:
- **lq-math rpg/avatars/equipment:** `[128, 256, 512]`
- **lq-math rpg/backgrounds:** `[640, 1024]`
- **Lesson scenes (lq-reading, lq-writing, lq-math chapters):** declared in each gen-config; typically `[640, 1024]` for `scene` type, `[400, 800]` for `concept`.

No separate variant-regen step needed.

---

## Risks

1. **lq-reading branch state** — if the rebase into `deploy/hetzner-reading-quest` fails (conflicts in app-shell pin or config), batch 1 halts until resolved.
2. **lq-math unpushed commits** — same; either push first or rebase away.
3. **Vertex AI auth window** — `gcloud auth print-access-token` tokens expire (~1 hr). Re-auth mid-batch if needed.
4. **Imagen-4 quality on chapter scenes** — the pilot 100 validates this. If Tier A regresses on rpg/, all-Imagen-4 batch 1 may fail the 7.5 gate on 30-40% of imgs (cost rises).
5. **Audit JSON pollution** — existing audit JSONs in `public/images/` are untracked. Running `ai-audit-images.ts` again will create new files. Decide: keep audits in `public/images/` (current pattern) or move to `.audit/` outside the published tree.

---

## Cost summary (realtime mode, post-pilot-20 2026-09-10)

| Tier | Imgs | $/img | Subtotal |
|---|---:|---:|---:|
| Tier A (Gemini-3.1-flash lesson scenes + rpg) | 695 | $0.067 | $46.57 |
| Tier B (Gemini-2.5-flash realtime base) | 312 | $0.039 | $12.17 |
| Retry budget (~10%) | — | — | $4.00 |
| Audit costs (negligible) | — | ~$0.005/img | $5.00 |
| **Total batch 1 hybrid** | **1,007** | — | **~$68** |

Cost bands:
- **Recommended (hybrid, pilot-verdict):** 695 × $0.067 + 312 × $0.039 = **$58.74** → round to **$62**.
- **Tier A' candidate (flash-lite, VERIFIED pricing 2026-09-10):** 1007 × **$0.0336** = **$33.84**. If the 5-image trial (task #26) hits avg ≥ 4.0, replace Tier A entirely with flash-lite. Saves ~$28 vs hybrid, ~$33 vs all-3.1-flash.
- **All-2.5-flash** (cheap, post-directive): 1007 × $0.039 = **$39.27**.
- **All-3.1-flash** (premium): 1007 × $0.067 = **$67.47**.
- ~~All-Imagen-4~~ **N/A** — Vertex AI only, requires gcloud OAuth.
- ~~Imagen-4-fast fallback~~ **N/A** — same.
- **Best-case (post-directive + Tier A' confirmed): ~$34. Recommended hybrid: ~$62. Worst-case (all-3.1-flash): ~$67.**
