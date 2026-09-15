# Batch 1 — School reading+writing+math (base + ch1-5)

**Status:** pending (prereq: pilot 20 + multi-model 5x5 verdicts DONE 2026-09-10; pilot 100 pending)
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

**Tier mapping (per [program overview](./00-program-overview.md)) — PILOT-VERIFIED + MULTI-MODEL-5x5-VERIFIED 2026-09-10:**

- **Tier A — Gemini-3.1-flash realtime (target ≥ 6.0):** all lesson scenes (chapters 1-5) + lq-math `rpg/{avatars,backgrounds,bosses,equipment}/` (20 base). Pilot 20 avg 4.0 on hard inputs; multi-model 5x5 avg **6.0** on clean educational prompts.
- **Tier B (NEW) — gpt-image-1 medium realtime ($0.042, OPENAI_API_KEY env or OPEN_AI_KEY alias):** subject-folder base + `lessons/general/`. Multi-model 5x5: **avg 3.8** (n=4 — 1/5 blocked by OpenAI moderation on anatomical content). Beats 2.5-flash pilot 20 (2.7) by +1.1.
- **Tier B' — Gemini-3.1-flash-lite realtime ($0.0336, DEMOTED 2026-09-10):** VERIFIED pricing from https://ai.google.dev/pricing (blueforge-org#114, image-gen 0.2.4). 5x5 trial scored avg **3.0** — below 6.0 target. Cheap fallback for non-critical `lessons/general/` only.
- **Tier C — Gemini-2.5-flash realtime (target ≥ 5.0):** dropped from preferred Tier B after multi-model; held as fallback when `OPENAI_API_KEY` is unavailable.

> **Tier model revision:** Pilot 20 (2026-09-10) confirmed Imagen-4 is unavailable via `GEMINI_API_KEY` (Vertex AI only — `404 NOT_FOUND`). Tier A is now `gemini-3.1-flash-image` ($0.067). Multi-model 5x5 (2026-09-10) found gpt-image-1 medium beats 2.5-flash on quality at $0.003 more per image; flash-lite below target.
> **Important caveat:** 3.1-flash's 6.0 score is on clean educational diagrams, NOT the worst lq-anatomy empties pilot 20 was scored on. Real Tier A batch will likely score closer to 4.0–5.5.

Image count by tier:

| App | Tier A (3.1-flash realtime) | Tier B (gpt-image-1 medium) |
|---|---:|---:|
| lq-reading | 182 | 114 |
| lq-writing | 216 | 91 |
| lq-math | 297 | 107 |
| **Total** | **695** | **312** |

**Estimated cost (hybrid):** (695 × $0.067) + (312 × $0.042) = **$46.57 + $13.10 = $59.67**.
**Round up to $60** for retries on the harder 10-15% (no buffer for fresh Tier B unproven on this app surface — re-evaluate after first app).

**If lq-tools directive PR lands before batch 1:** expect +3.0 avg lift (per lq-history precedent). Re-evaluate whether Tier B drops to flash-lite or stays at gpt-image-1.
**If batch 1 must start without directive:** run Tier A as 3.1-flash anyway (best quality), Tier B as gpt-image-1. Plan a follow-up regen pass post-directive.

---

## Per-app sequencing

### lq-reading (296 imgs)

**Branch state:** `chore/shared-app-audit-checks` — **NOT on deploy branch**. Blocker. Rebase to `deploy/hetzner-reading-quest` before batch 1 starts.

**Step 1 — chapter mode (5 invocations, $0.067 × 182 = $12.19):**
```bash
cd /Users/kmandrup/Projects/Repos/learn-quest/lq-tools
for n in 1 2 3 4 5; do
  npx tsx scripts/regenerate-flagged-images.ts \
    --app=lq-reading \
    --chapter=$n \
    --model=gemini-3.1-flash-image \
    --provider=gemini \
    --budget=20
done
```

**Step 2 — base regen (1 invocation, $0.042 × 114 = $4.79):**
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
  --model=gpt-image-1 \
  --provider=openai \
  --quality=medium \
  --budget=15
```

**Step 3 — audit acceptance gate:**
```bash
npx tsx scripts/ai-audit-images.ts \
  --path=../school-quest/lq-reading/public/images \
  --output=../school-quest/lq-reading/public/images/image-audit-results-2026-09-15.json

# Per-tier revert:
#   3.1-flash:    git checkout -- $(jq -r '.results[] | select(.quality_score < 6.0) | .image' /tmp/lq-reading-ch-audit.json)
#   gpt-image-1:  git checkout -- $(jq -r '.results[] | select(.quality_score < 5.0) | .image' /tmp/lq-reading-base-audit.json)
```

**Step 4 — commit + push (when deploy branch is correct):**
```bash
cd ../school-quest/lq-reading
git checkout deploy/hetzner-reading-quest  # if not already
git rebase chore/shared-app-audit-checks    # bring the audit-bin chore commits
git add public/images/
git commit -m "batch-1: regenerate 296 base + ch1-5 (3.1-flash + gpt-image-1 medium realtime)"
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
  --model=gemini-3.1-flash-image \
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
- **Tier A (3.1-flash) revert:** `quality_score < 6.0` (post-directive); `< 4.0` (pre-directive, provisional)
- **Tier B (gpt-image-1 medium) revert:** `quality_score < 5.0` (post-directive); `< 3.5` (pre-directive, provisional)
- **Tier B' (flash-lite) revert:** `quality_score < 6.0` (post-directive); `< 3.0` (pre-directive, provisional)
- **Tier C (2.5-flash) revert:** `quality_score < 5.0` (post-directive); `< 3.0` (pre-directive, provisional)
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
3. **OPENAI_API_KEY availability** — Tier B requires `OPENAI_API_KEY` (or `OPEN_AI_KEY` alias from ~/.zshrc). If the env var is unset, regen-script will fail with `[OpenAIImageAdapter] OPENAI_API_KEY required`. Fallback: drop to Tier C (2.5-flash realtime) for those bases.
4. **3.1-flash quality on chapter scenes** — pilot 100 validates this. If Tier A regresses on rpg/, 3.1-flash may fail the 6.0 gate on 30-40% of imgs (cost rises to retry or revert).
5. **Tier B (gpt-image-1) is unproven on school-reading/writing/math subject folders.** Multi-model 5x5 trial only covered lq-anatomy educational diagrams. **Pilot 100 should include gpt-image-1 row** to verify the 3.8/10 score holds on the harder subject-folder surface.
6. **Audit JSON pollution** — existing audit JSONs in `public/images/` are untracked. Running `ai-audit-images.ts` again will create new files. Decide: keep audits in `public/images/` (current pattern) or move to `.audit/` outside the published tree.

---

## Cost summary (realtime mode, post-pilot-20 + post-multi-model-5x5 2026-09-10)

| Tier | Imgs | $/img | Subtotal |
|---|---:|---:|---:|
| Tier A (Gemini-3.1-flash lesson scenes + rpg) | 695 | $0.067 | $46.57 |
| Tier B (gpt-image-1 medium realtime base) | 312 | $0.042 | $13.10 |
| Retry budget (~10%) | — | — | $4.00 |
| Audit costs (negligible) | — | ~$0.005/img | $5.00 |
| **Total batch 1 hybrid** | **1,007** | — | **~$69** |

Cost bands:
- **Recommended (hybrid, multi-model-verdict):** 695 × $0.067 + 312 × $0.042 = **$59.67** → round to **$60**.
- **All-flash-lite** (cheapest but below 6.0 target on 5x5): 1007 × **$0.0336** = **$33.84**. NOT recommended as primary; cheap fallback for non-critical general/.
- **All-2.5-flash** (cheap, post-directive fallback if OPENAI_API_KEY unavailable): 1007 × $0.039 = **$39.27**.
- **All-3.1-flash** (premium): 1007 × $0.067 = **$67.47**.
- ~~All-Imagen-4~~ **N/A** — Vertex AI only, requires gcloud OAuth.
- ~~Imagen-4-fast fallback~~ **N/A** — same.
- **Best-case (all-flash-lite, accepted quality drop): ~$34. Recommended hybrid: ~$60. Worst-case (all-3.1-flash): ~$67.**
