# Image Regeneration Program — September 2026

**Status:** Planning (drafted 2026-09-10)
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
**Headline cost (Tier A' all flash-lite realtime, pricing-verified 2026-09-10):** ~$119 (if 5-img trial confirms quality ≥ Tier A)
**Headline cost (all 2.5-flash realtime):** ~$136
**Headline cost (all Imagen-4-fast):** **N/A** (Vertex AI only)

Per-batch bands (realtime mode, post-pilot-20 2026-09-10):
| Batch | Tier A 3.1-flash + Tier B 2.5-flash | All 2.5-flash (cheap) | Tier A' all flash-lite (pending trial) |
|---|---:|---:|---:|
| Pilot 20 (DONE) + Pilot 100 (TBD) | $1.06 + ~$4 | ~$5 | ~$4 (if 5-img trial confirms) |
| Batch 1 (school reading+writing+math, 1007 imgs) | ~$62 | $39 | ~$34 |
| Batch 2 (school science+geography, 1153 imgs) | ~$70 | $45 | ~$39 |
| Batch 3 (5 life apps, 1249 imgs) | ~$71 | $49 | ~$42 |
| **Total** | **~$208** | **~$141** | **~$119** (if flash-lite wins) |

The pilot-verdict default is **Tier A = 3.1-flash** (lesson scenes, rpg base), **Tier B = 2.5-flash** (subject-folder base). All-2.5-flash is the cheap fallback if quality target flexes.

---

## Sequencing

| Stage | Scope | Prerequisite | Cost (hybrid) | Status |
|---|---|---|---|---|
| **Pilot 20** | 3.1-flash vs 2.5-flash on 10 lq-anatomy empties each | none | $1.06 | **DONE 2026-09-10** — [pilot-imagen4-vs-gemini3.1.md](./pilot-imagen4-vs-gemini3.1.md) |
| **Pilot 100** | 100-imgs on lq-math rpg + ch1 (highest-priority school surface) | pilot 20 verdict + lq-tools style directive PR | ~$4 (3.1-flash) or ~$2 (2.5-flash) | pending — runs after directive PR |
| **Batch 1** | school reading+writing+math base + ch1-5 (1,007 imgs) | pilot 100 + directive PR | $62 hybrid / $39 all-2.5-flash / $67 all-3.1-flash | pending — [batch-1-school-base-ch1-5.md](./batch-1-school-base-ch1-5.md) |
| **Batch 2** | school science+geography ch1-5 (1,153 imgs; defer history — see batch-2 doc) | batch 1 + directive PR | $70 hybrid / $45 all-2.5-flash | pending — [batch-2-school-remaining-ch1-5.md](./batch-2-school-remaining-ch1-5.md) |
| **Batch 3** | 5 life apps (anatomy, health, psychology, philosophy, plumbing — 1,226 regen candidates after directive) | batch 2 + 15 life-app style directive | $71 hybrid / $49 all-2.5-flash | pending — [batch-3-life-apps.md](./batch-3-life-apps.md) |

---

## Tier model — **PILOT-VERIFIED 2026-09-10** (realtime mode, GEMINI_API_KEY)

**Auth status 2026-09-10:** User opted for `GEMINI_API_KEY` (env) instead of Vertex AI / gcloud OAuth. Without `--batch`, the client constructs `GoogleGenAI({ apiKey })` directly. **Imagen-4 is NOT exposed via the public Gemini API** — only Vertex AI exposes it. Every Imagen-4 call returns `404 NOT_FOUND`. Tier A and Tier D require Vertex AI OAuth (out of scope for now).

| Tier | Model | Provider | Mode | $/img | Target | Pilot result (lq-anatomy, n=10) | Used for |
|---|---|---|---|---:|---|---|---|
| **A** | `gemini-3.1-flash-image` | `gemini` | realtime | $0.067 | ≥ 6.0 | **avg 4.0** (+3.0 from floor, 2/10 high, 60% art-match) | lesson scenes, rpg base, character art |
| **A' (pending)** | `gemini-3.1-flash-lite-image` | `gemini` | realtime | **$0.0336** | ≥ 6.0 | not piloted — candidate Tier A replacement, half the cost of 3.1-flash | lesson scenes, base images (post 5-img pilot) |
| **B** | `gemini-2.5-flash-image` | `gemini` | realtime | $0.039 | ≥ 5.0 | **avg 2.7** (+1.7 from floor, 0/10 high, 60% art-match) | subject-folder base, `lessons/general/` |
| ~~Tier C~~ | ~~Imagen-4 standard~~ | gemini | realtime | $0.040 | ≥ 7.5 | **unavailable** (404 — Vertex AI only) | — |
| ~~Tier D~~ | ~~Imagen-4-fast~~ | gemini | realtime | $0.020 | ≥ 6.0 | **unavailable** (404 — Vertex AI only) | — |

**Tier A' candidate (2026-09-10):** `gemini-3.1-flash-lite-image` pricing VERIFIED against https://ai.google.dev/pricing (PR blueforge-org#114, image-gen 0.2.3). Live on the Gemini API under codename "Nano Banana 2 Lite". If a 5-image lq-anatomy trial hits avg ≥ 4.0, this would replace Tier A on price AND likely quality — batch 1 would drop from $62 (hybrid) to $33 (all-flash-lite). Trial pending (task #26).

**Pilot verdict:** **3.1-flash replaces Imagen-4 as Tier A** — wins by +1.3 avg quality points even on harder inputs. 2.5-flash holds as Tier B (cheap fallback for non-priority content). **Both tiers are below target** until the lq-tools style-directive PR lands (prior lq-history re-audit went avg 1.4 → 5.5+ with the directive in place).

**Cost-per-quality-recovered (pilot):** 3.1-flash = $0.022/pt, 2.5-flash = $0.023/pt — tied on efficiency. The difference is the **destination**: 3.1-flash reaches medium-quality (4.0) while 2.5-flash stays near floor (2.7).

**Pre-directive acceptance gate (provisional):** keep if score ≥ 4.0 (Tier A) or ≥ 3.0 (Tier B). Post-directive gate: revert to ≥ 6.0 (Tier A) / ≥ 5.0 (Tier B).

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

1. **Wait for lq-tools style-directive PR?** Pilot 20 hit avg 4.0/2.7 — well below target. With the directive, lq-history hit avg 5.5+. The directive lifts both tiers by ~3 points and is the difference between "acceptable regen" and "still mostly broken". Recommend: wait, run pilot 100 to validate 3.1-flash on school-rpg surface.
2. **Batch 1 budget approval** — $62 hybrid (3.1-flash Tier A + 2.5-flash Tier B) / $39 all-2.5-flash / $67 all-3.1-flash. Up from the original $49 because Imagen-4 was replaced by 3.1-flash. Proceed after pilot 100?
3. **lq-reading branch state** — rebase `chore/shared-app-audit-checks` → `deploy/hetzner-reading-quest` before batch 1, or work on chore branch and merge later?
4. **History in batch 2** — include history's 2,310 ch1-5 imgs (>$90 by itself) or defer to a separate campaign given the in-flight #295 re-audit?
