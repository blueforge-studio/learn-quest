# Image Regeneration Program — September 2026

**Status:** Planning (drafted 2026-09-10; multi-model 5×5 verdict applied 2026-09-10)
**Owner:** @kmandrup
**Source-of-truth doc:** [`../image-quality-fleet-handover-2026-08-09.md`](../image-quality-fleet-handover-2026-08-09.md)
**Driver format:** YAML (`.yml`) — paired one-to-one with batch `.md` docs.

---

## TL;DR

This program runs a three-stage regeneration sweep across the fleet's school + life apps to clear the "empties" + "needs-regen" populations that survived the relaxed art bar (lq-tools `eaaa647`, 2026-08-09). The first stage is a **head-to-head model pilot** (Imagen-4 vs Gemini-3.1-batch) on lq-anatomy; results determine the tier mapping for batches 1-3.

**Fleet scope:** 1,007 base images (school reading+writing+math base + ch1-5) + 1,152 (science+geography ch1-5) + 1,226 (5 life apps with re-audit data) ≈ **3,400 images** across 11 apps, sequenced across 4 stages (pilot → scale-up → batch 1 → batch 2 → batch 3).

**Headline cost (worst-case all-Tier C 3.1-flash realtime):** ~$228
**Headline cost (Tier A Imagen-4 + Tier B 2.5-flash realtime):** **N/A — Imagen-4 unavailable** (Vertex AI only; `GEMINI_API_KEY` returns 404)
**Headline cost (Tier C 3.1-flash + Tier B 2.5-flash realtime, pilot-verified 2026-09-10):** ~$192
**Headline cost (Tier A 3.1-flash + Tier B gpt-image-1 medium, multi-model-verified 2026-09-10):** **~$196**
**Headline cost (all flash-lite realtime, BUT below target on 5×5):** ~$115 (NOT recommended as primary; flash-lite 3.0/10 vs target 6.0)
**Headline cost (all 2.5-flash realtime):** ~$133
**Headline cost (all Imagen-4-fast):** **N/A** (Vertex AI only)

> **Important:** 5×5 multi-model trial (`trial/multimodel-5x5` branch, 2026-09-10) scored cleanly-prompted educational diagrams, NOT the worst lq-anatomy empties pilot 20 was scored on. The 6.0/10 score for 3.1-flash on the 5×5 trial does NOT contradict the 4.0/10 pilot 20 figure on harder inputs — different samples, different prompts, different scoring difficulty. Re-audit a Tier A batch sample (n=10-20) against the post-directive acceptance gate before scaling batches 1-3.

Per-batch bands (realtime mode, post-pilot-20 + post-multi-model-5×5, 2026-09-10):
| Batch | Tier A 3.1-flash + Tier B gpt-image-1 medium | All 2.5-flash (cheap) | All flash-lite (Tier A' = Tier B') |
|---|---:|---:|---:|
| Pilot 20 (DONE) + Pilot 100 (TBD) | $1.06 + ~$5 | ~$5 | ~$3.36 (if used everywhere) |
| Batch 1 (school reading+writing+math, 1007 imgs) | **~$60** | $39 | $34 |
| Batch 2 (school science+geography, 1153 imgs) | **~$70** | $45 | $39 |
| Batch 3 (5 life apps, 1249 imgs) | **~$66** | $49 | $42 |
| **Total** | **~$196** | **~$133** | **~$115** |

The pilot-verdict default is **Tier A = 3.1-flash** (lesson scenes, rpg base), **Tier B = gpt-image-1 medium** (subject-folder base, $0.042, scored 3.8/10 on multi-model — beats 2.5-flash pilot 2.7). All-2.5-flash is the cheap fallback if quality target flexes.

> gpt-image-1 batch cost = `tier-b-count × $0.042`. Subject-folder base per app ≈ 12-15 imgs (lq-reading/writing/math), driving the bulk of Tier B cost.

---

## Sequencing

| Stage | Scope | Prerequisite | Cost (hybrid) | Status |
|---|---|---|---|---|
| **Pilot 20** | 3.1-flash vs 2.5-flash on 10 lq-anatomy empties each | none | $1.06 | **DONE 2026-09-10** — [pilot-imagen4-vs-gemini3.1.md](./pilot-imagen4-vs-gemini3.1.md) |
| **Multi-model 5×5** | 5 models × 5 lq-anatomy educational diagrams (trial/multimodel-5x5) | none | ~$0.85 | **DONE 2026-09-10** — see [§ Multi-model 5×5 verdict](#multi-model-5x5-verdict-2026-09-10) below |
| **Pilot 100** | 100-imgs on lq-math rpg + ch1 (highest-priority school surface) | pilot 20 verdict + lq-tools style directive PR + Tier B choice | ~$4 (3.1-flash) or ~$2 (2.5-flash) | pending — runs after directive PR |
| **Batch 1** | school reading+writing+math base + ch1-5 (1,007 imgs) | pilot 100 + directive PR | $52 hybrid (3.1-flash + gpt-image-1) / $39 all-2.5-flash / $67 all-3.1-flash | pending — [batch-1-school-base-ch1-5.md](./batch-1-school-base-ch1-5.md) |
| **Batch 2** | school science+geography ch1-5 (1,153 imgs; defer history — see batch-2 doc) | batch 1 + directive PR | $60 hybrid / $45 all-2.5-flash | pending — [batch-2-school-remaining-ch1-5.md](./batch-2-school-remaining-ch1-5.md) |
| **Batch 3** | 5 life apps (anatomy, health, psychology, philosophy, plumbing — 1,226 regen candidates after directive) | batch 2 + 15 life-app style directive | $71 hybrid / $49 all-2.5-flash | pending — [batch-3-life-apps.md](./batch-3-life-apps.md) |

---

## Tier model — **PILOT-VERIFIED + MULTI-MODEL-5×5-VERIFIED 2026-09-10** (realtime mode, GEMINI_API_KEY)

**Auth status 2026-09-10:** User opted for `GEMINI_API_KEY` (env) instead of Vertex AI / gcloud OAuth. Without `--batch`, the client constructs `GoogleGenAI({ apiKey })` directly. **Imagen-4 is NOT exposed via the public Gemini API** — only Vertex AI exposes it. Every Imagen-4 call returns `404 NOT_FOUND`. Tier A and Tier D require Vertex AI OAuth (out of scope for now).

| Tier | Model | Provider | Mode | $/img | Target | Pilot | Multi-model 5×5 | Used for |
|---|---|---|---|---:|---|---|---|---|
| **A** | `gemini-3.1-flash-image` | `gemini` | realtime | $0.067 | ≥ 6.0 | **avg 4.0** (n=10) | **avg 6.0** (n=5, clean prompts) | lesson scenes, rpg base, character art |
| **B** | `gpt-image-1` (medium quality) | `openai` | realtime | $0.042 | ≥ 5.0 | not piloted | **avg 3.8** (n=4, 1 OpenAI moderation block) | subject-folder base, `lessons/general/` |
| **B'** | `gemini-3.1-flash-lite-image` | `gemini` | realtime | $0.0336 | ≥ 6.0 | not piloted | **avg 3.0** (n=5, below target — DEMOTED from Tier A' candidate) | (cheap fallback only, post-acceptance-gate raise) |
| **C** | `gemini-2.5-flash-image` | `gemini` | realtime | $0.039 | ≥ 5.0 | **avg 2.7** (n=10) | not re-tested | cheap fallback if quality gate flexes |
| ~~Tier D~~ | ~~`fal-ai/seedream-5`~~ | `fal` | realtime | $0.026/MP | ≥ 6.0 | — | **avg 1.2 (n=5) — EXCLUDED** | — |
| ~~Tier E~~ | ~~`black-forest-labs/flux-schnell`~~ | `replicate` | realtime | $0.003 | ≥ 6.0 | — | **avg 2.6 (n=5) — too low for primary** | (placeholder use only) |
| ~~Tier F~~ | ~~Imagen-4 standard~~ | gemini | realtime | $0.040 | ≥ 7.5 | **unavailable** (404 — Vertex AI only) | — | — |
| ~~Tier G~~ | ~~Imagen-4-fast~~ | gemini | realtime | $0.020 | ≥ 6.0 | **unavailable** (404 — Vertex AI only) | — | — |

**Multi-model 5×5 VERDICT (2026-09-10):** See § Multi-model 5×5 verdict below for full breakdown. Headline: **3.1-flash-image clears the 6.0 target on this sample**, **gpt-image-1 medium emerges as Tier B** (beats 2.5-flash pilot 2.7 at 3.8/10), **flash-lite demoted from Tier A' candidate to Tier B'** (3.0/10 — below target), **Seedream-5 excluded** (1.2/10), **Flux-schnell too low for primary** (2.6/10, $0.003 — only viable as ultra-cheap placeholders).

**Pilot verdict:** **3.1-flash replaces Imagen-4 as Tier A** — wins by +1.3 avg quality points even on harder inputs. 2.5-flash held as Tier B on pilot 20 but **gpt-image-1 medium displaces it** on the multi-model 5×5 (3.8/10 vs 2.7/10). **Both primary tiers are below target** until the lq-tools style-directive PR lands (prior lq-history re-audit went avg 1.4 → 5.5+ with the directive in place).

**Cost-per-quality-recovered (multi-model 5×5):** 3.1-flash = $0.011/pt (best), gpt-image-1 medium = $0.011/pt (tied), 2.5-flash = $0.014/pt. 3.1-flash is the cheapest path to ≥ medium quality on this sample; gpt-image-1 is competitive at half-cost-of-3.1-flash.

**Pre-directive acceptance gate (provisional):** keep if score ≥ 4.0 (Tier A) or ≥ 3.0 (Tier B / B'). Post-directive gate: revert to ≥ 6.0 (Tier A) / ≥ 5.0 (Tier B) / ≥ 6.0 (Tier B').

---

## Multi-model 5×5 verdict (2026-09-10)

**Branch:** `trial/multimodel-5x5` in learn-quest
**Output:** `life-quest/lq-anatomy-multimodel/public/images/multi-model-trial/<model-slug>/<image>.webp`
**Adapter stack:** `@blueforge-studio/image-gen@0.2.4` + `@blueforge-studio/image-gateway` from local blueforge-org checkout (path-based dynamic import to bypass lq-tools' stale 0.1.7 install)

### Audit results (n=5 per model, educational anatomy diagram prompts)

| Model | Adapter | Avg score | Needs regen | $/img | Tier verdict |
|---|---|---:|---:|---:|---|
| **gemini-3.1-flash-image** | Gemini | **6.0/10** | 2/5 | $0.067 | **Tier A — VERIFIED** |
| **gpt-image-1** (medium) | OpenAI | 3.8/10 | 2/4 | $0.042 | **Tier B — NEW** |
| gemini-3.1-flash-lite-image | Gemini | 3.0/10 | 4/5 | $0.0336 | Tier B' — below target, demoted |
| replicate-flux-schnell | Replicate | 2.6/10 | 3/5 | $0.003 | ultra-cheap placeholders only |
| fal-ai/seedream-5 | Fal | 1.2/10 | 5/5 | $0.0262 | EXCLUDED |

### Critical caveats

- **Sample bias:** the 5 prompts were clean educational diagrams, NOT the worst lq-anatomy empties pilot 20 scored. Real Tier A batch will score lower (closer to pilot 4.0).
- **OpenAI moderation:** anatomical-planes-intermediate blocked by safety filter ("transparent human body" → "sexual" category). 4/5 gpt-image-1 results; scored cells are biased away from anatomical content.
- **Prompt simplicity:** all 5 used the same "high quality realistic RPG manga style … clean linework, cel-shading, no text labels" boilerplate. Production prompts add vocabulary/scene-detail which may shift quality.

### Implications for batches 1-3

1. **Tier B → gpt-image-1 medium** beats 2.5-flash on quality in this test; switch subject-folder base layer to gpt-image-1 if it reproduces on the harder batch 1 sample (math/reading/writing subject folders).
2. **Tier B' (flash-lite)**: still cheaper than 2.5-flash ($0.0336 vs $0.039) but BELOW the post-directive 6.0 target on this sample. Use only for non-critical `lessons/general/` and accept lower quality, OR wait for the style directive to lift it.
3. **Pilot 100 should include gpt-image-1** as a third contender alongside 3.1-flash and 2.5-flash before batch 1 commits to the Tier B choice.

---

## Critical environment notes (blockers)

1. **Auth: `GEMINI_API_KEY` from `~/.zshrc` (realtime mode).** Do NOT use `--batch` (triggers `useVertexAi` path → gcloud OAuth2 → will fail). Drop the `--batch` flag from all regen invocations. `GoogleGenAI({ apiKey })` is constructed directly when an api key is set.
2. **lq-reading is on the wrong branch.** `chore/shared-app-audit-checks`, NOT `deploy/hetzner-reading-quest`. Must rebase or merge into deploy branch before any regenerated images can ship.
3. **lq-math has 7 unpushed commits** on `deploy/hetzner-math-quest`. Push or rebase before batch 1 starts.
4. **`--min-score` / `--force` / `--concurrency` flags don't exist** in the current regen script. Acceptance gate = post-audit filter + `git checkout --` per-file revert. Concurrency = sequential per-image in the regen script; the package's `processConfigBatches` worker pool (default `concurrency: 4`) handles parallel batching when `--batch` is set.
5. **No fleet-regen driver exists.** The canonical inputs are JSON (`regen-chapter-covers.json` shape). This program introduces YAML driver files consumable by a small new `batch-driver.ts` (TBD).

---

## Naming convention

- `docs/batches/00-program-overview.md` — this file
- `docs/batches/pilot-imagen4-vs-gemini3.1.md` — pilot 20 + scale-up 100
- `docs/batches/batch-N-{slug}.md` — one MD per batch (rationale + counts + commands)
- `docs/batches/batch-N.yml` — one YAML per batch (machine-readable driver)
- `lq-tools/scripts/lib/batch-driver.ts` — proposed driver (NOT YET WRITTEN)

---

## Open questions for user

1. **Wait for lq-tools style-directive PR?** Pilot 20 hit avg 4.0/2.7 — well below target. With the directive, lq-history hit avg 5.5+. The directive lifts both tiers by ~3 points and is the difference between "acceptable regen" and "still mostly broken". Recommend: wait, run pilot 100 to validate 3.1-flash + gpt-image-1 on school-rpg surface.
2. **Batch 1 budget approval** — $52 hybrid (3.1-flash Tier A + gpt-image-1 medium Tier B) / $39 all-2.5-flash / $67 all-3.1-flash. Up from the original $49 because Imagen-4 was replaced by 3.1-flash. Tier B choice (gpt-image-1 vs 2.5-flash) depends on pilot 100 reproducing the multi-model 5×5 verdict. Proceed after pilot 100?
3. **lq-reading branch state** — rebase `chore/shared-app-audit-checks` → `deploy/hetzner-reading-quest` before batch 1, or work on chore branch and merge later?
4. **History in batch 2** — include history's 2,310 ch1-5 imgs (>$90 by itself) or defer to a separate campaign given the in-flight #295 re-audit?
5. **Tier B' (flash-lite) deploy policy** — keep as cheap fallback for non-critical images despite 3.0/10 multi-model score, or drop entirely and use 2.5-flash for that slice? Current recommendation: keep, restrict to `lessons/general/` where quality bar is lowest.
