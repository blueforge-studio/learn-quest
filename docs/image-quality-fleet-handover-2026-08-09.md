# Image Quality Fleet Handover & Follow-up

> **Date:** 2026-08-09 · **Scope:** AI lesson-image quality program across school / lang / life / books fleets (44 apps in `lq-operations` app-registry).
> **Data provenance:** Baseline audits = Aug 5, **strict** RPG-manga bar (`/tmp/lq-audit-logs/*.log`). "Current" numbers = post-relaxation audits that EXIST only for lq-history + the chapter-1 pilots; every other app has **not** been re-audited under the relaxed bar (this is the biggest open unknown).

---

## TL;DR

- The **relaxed art bar** (RPG-manga → "high quality realistic cartoon, not childish", lq-tools `eaaa647`, 2026-08-09) is the single biggest quality lever landed so far — in lq-history it collapsed art-style-mismatch failures from **~1255 → 20**.
- **lq-history** is the only app with a real campaign (155 batch + 30 directive + 559 empties + 50 empties + 7 art-fix ≈ 800 images regenerated & committed). It is still the **biggest and worst** app (2266 images; partial relaxed audit ≈ 163 high / 400 med / 1703 low, 655 needs-regen).
- **The other 16 life apps + 5 school apps + 13 lang apps are essentially untouched** beyond chapter-1 batches — their Aug 5 baselines are almost entirely "Low" under the old bar, and most of that low population is art-style-mismatch (now fixed by the bar change) + **deterministic empties** (score 0/1 blank/corner-flood images, the true remaining failure class).
- **Best bang for the buck:** (1) fleet-wide **empties sweep** (deterministic, ~$0.02/img, broken→real), then (2) re-audit under the relaxed bar to find the true ≤5 set, then (3) **region art-style descriptors** for remaining mismatches (proven 7/7 in lq-history). The huge borderline score-5 population is low-value to chase and should be deferred.

---

## The art-mismatch fleet problem (what this handover addresses)

Root cause: generation used **one generic RPG-manga directive** for every region/subject; the audit requires **per-region / per-subject art styles** (`audit-rules.config.json`, 23 path rules). Proven fix (lq-history, 2026-08-09):
- **Per-region descriptors** in gen-config prompts (East-Asian, Mesoamerican, …) fixed 4/5 art-mismatches.
- **Image-specific content cues** (brightness/tonal-range for maps; explicit scene composition + "no Western fantasy" negation for a stubborn Great Wall scene) fixed the last 2.

| Art-mismatch target | Before | After |
|---|---|---|
| first-americans.webp | 4 | 9 |
| great-wall-china-portrait.webp | 4 | 8 |
| siddhartha-buddha-portrait.webp | style-mismatch | style-OK (5) |
| silk-road-map.webp | low-luminance (1) | 8 |
| great-wall-china.webp | 5 style-mismatch | 9 |

Commits: lq-tools `564411d` (descriptors), `a182ca8` (strengthened) · lq-history `2a51d26` (5 imgs), `4e0c7e2` (2 imgs). All local, not pushed.

---

## Fleet at a glance (image counts = base `*.webp`, no variants)

| Group | Apps | Base images |
|---|---|---|
| School | 6 | 4,449 |
| Life | 17 | 3,218 |
| Lang | 14 | ~25,700 disk (gen-configs 28,240 incl. `_shared`+non-lesson) |
| Books | 3 with image trees | ~158 (adventure 50, story 99, interactive 9) |
| **Total (school+life)** | **23** | **≈ 7,670** |

Gen-configs are **1:1 with disk for all 23 school+life apps** (`lq-tools/packages/image-tools/src/config/subjects/*`), all 14 lang families, and 3 books apps → the regen pipeline is ready everywhere.

---

## Per-app state — School (6)

| App | Imgs | Baseline (Aug 5, strict) | Regen done | Current (relaxed bar) | Next |
|---|---|---|---|---|---|
| **lq-history** | 2,266 | worst; mostly Low | 155 + 30 + 559 empties + 50 + 7 art-fix + 100-worst ≈ 800 | 163 high / 400 med / 1703 low, 655 needs; art-mismatch ~1255→20; empties cleared | Finish full re-audit (#295); regen remaining 438-outlier deferred; then borderline-5 pass |
| **lq-science** | 672 | 12H/175M/462L | ch1 (15) batch + states-of-matter full-bleed fix | ch1 **8.5/10**; states straggler 1→5 fixed | Re-audit full app under relaxed bar |
| **lq-geography** | 480 | 22H/154M/286L | ch1 (20) batch, 3 reverted | ch1 partial (reverts to old 5s) | Re-audit full app |
| **lq-math** | 403 | 5H/88M/310L | ch1 (15) batch, 3 reverted | ch1 partial | Re-audit full app |
| **lq-reading** | 306 | — | ch1 (10) batch, 3 reverted | ch1 partial | Re-audit full app |
| **lq-writing** | 322 | — | ch1 (15) batch, 2 reverted | ch1 partial | Re-audit full app |

All school apps on `deploy/hetzner-<subject>-quest` branches; chapter-1 batches + reverts are **pushed** to origin (only lq-history is ahead: 11 commits incl. the campaign + art-fix).

---

## Per-app state — Life (17)

All baselines are **strict-bar**. Relaxed-bar re-audit has now run for **5 life apps** (2026-08-10): anatomy, health, psychology, philosophy, plumbing — see the results subsection below. Only anatomy (ch1) and health (ch1 + stragglers) got any regeneration.

| App | Imgs | Baseline (Aug 5, strict) avg / Low | Regen done | Next |
|---|---|---|---|---|
| lq-anatomy | 468 | 1.3 / 431 | ch1 (22) batch, 1 reverted | **relaxed re-audit DONE** (2026-08-10): **461/468 ≤5**, 7 kept → regen empties after style-directive |
| lq-health | 224 | 1.5 / 195 | ch1 (16) + 5 stragglers + immune | **relaxed re-audit DONE** (2026-08-10): **221/224 ≤5**, 3 kept → regen empties after directive; ch1 5.0/10 |
| lq-economics | 238 | 1.4 / 224 | **empties pilot COMPLETE** (scene-cue 19/19 + scene-first 3/3 + rpg-theme 8/8) | 5 empties left (gate-reverted lessons); relax-bar re-audit |
| lq-finance | 228 | 1.2 / 215 | **empties pilot COMPLETE** (scene-cue 23/25 + scene-first 1/3, compound-interest cleared) | 9 empties left (7 gate-reverted + 2 genuinely resistant); relax-bar re-audit |
| lq-psychology | 200 | 1.4 / 187 | — | **relaxed re-audit DONE** (2026-08-10): **200/200 ≤5**, 0 kept → regen empties after directive |
| lq-philosophy | 207 | 1.7 / 183 | — | **relaxed re-audit DONE** (2026-08-10): **194/207 ≤5**, 13 kept → regen empties after directive |
| lq-tech | 199 | 1.4 / 179 | — | baseline → re-audit + empties |
| lq-law | 180 | 2.0 / 141 | — | baseline → re-audit + empties |
| lq-construction | 300 | 1.5 / 266 | — | baseline → re-audit + empties |
| lq-media | 200 | — / 139 | — | baseline → re-audit + empties |
| lq-plumbing | 150 | 1.5 / 133 | — | **relaxed re-audit DONE** (2026-08-10): **150/150 ≤5**, 0 kept → regen empties after directive |
| lq-game-design | 160 | 1.5 / 140 | — | baseline → re-audit + empties |
| lq-game-dev | 160 | 1.9 / 124 | — | baseline → re-audit + empties |
| lq-maker | 160 | 1.5 / 139 | — | baseline → re-audit + empties |
| lq-electronics | 164 | — / 101 | — | baseline → re-audit + empties |
| lq-cooking | 170 | 2.0 / 133 | — | baseline → re-audit + empties |
| lq-engineering | 170 | 1.6 / 153 | — | baseline → re-audit + empties |

Life apps are on `deploy/hetzner-<subject>-quest`; last commits are mostly `fix(data): align lesson image refs to per-chapter convention` (no image work). Except for the 5 apps re-audited under the relaxed bar (2026-08-10), the rest are **still at baseline quality**.

### Relaxed-bar re-audit — life subset (2026-08-10)

Run with M3 vision chain (`minimax-m3`, relaxed "realistic cartoon, not childish" descriptor) over the full image tree of 5 apps, no chunking. Result files: each app's `public/images/image-audit-results-2026-08-10.json`; candidate lists aggregated in `/tmp/fleet-reaudit-5-summary.json`.

| App | Imgs | ≤5 (regen candidates) | kept >5 | pixel-gate rejects | LLM-audited | LLM avg | LLM ≤5 |
|---|---|---|---|---|---|---|---|
| lq-anatomy | 468 | **461** | 7 | 417 (89%) | 51 | 5.2 | 44 |
| lq-health | 224 | **221** | 3 | 181 (81%) | 43 | 4.6 | 40 |
| lq-psychology | 200 | **200** | 0 | 184 (92%) | 16 | 4.4 | 16 |
| lq-philosophy | 207 | **194** | 13 | 180 (87%) | 27 | 5.9 | 14 |
| lq-plumbing | 150 | **150** | 0 | 133 (89%) | 17 | 4.9 | 17 |
| **Total** | **1249** | **1226** | **23** | **1095** | **154** | — | **131** |

**Findings:**
- ~88% of the ≤5 population (1095/1226) is **deterministic pixel-gate rejects** (corner-bg-fill / mostly-white / low-luminance / text-only) — the same corner-flood "empty" class the finance+economics empties pilot proved is fixable by regen. These 5 apps never received the manga/realistic-cartoon style directive (only finance + economics have it), so the empty population is expected.
- The LLM-audited slice (154) also mostly fails (avg 4.4–5.9, 131 ≤5) — a real quality/style-mismatch population on top, but much smaller.
- `kept >5` = 23 across all 5 apps.
- **Actionable path** (mirrors the finance/economics pilot): add the style directive to these 5 configs FIRST (see memory `feedback_life_apps_manga_cartoon_style.md`), then batch-regen the ≤5 set + corner-flood empties, audit + gate (keep >5, revert ≤5). ~1226 images is a large but mechanical regeneration workload.

---

## Per-app state — Lang (14)

| State | Detail |
|---|---|
| Gen-configs | **14/14 COVERED** (lessons + non-lesson + `_shared`; configImages 28,240 vs disk 25,719) |
| Audit rules | Per-locale **label-language audit rules** committed on all branches (latest commits) |
| Regen done | **french** (lq-romance) ch1 → **9.0/10**; **nordic** ch1 + science ch1-2 candidates in progress (#232/#233/#234) |
| Open | No relaxed-bar re-audit of the other 12 families; `_shared` + non-lesson categories (avatars/backgrounds/vocab) mostly unregenerated; nordic lesson-data `chapterId` gap limits `--chapter` stamping |

Note: lq-nordic is on `main` (not a deploy branch) — it's the dev home for lang work.

---

## Books platform (7 apps)

3 apps with real image trees are bootstrapped + regen-ready (adventure 50, story 99, interactive 9). The other 4 (activity-book, marketplace, author, site) stay **on-demand** (build-time Flux Schnell covers/backgrounds) — no gen-configs, out of scope for this program.

---

## Bang for the buck — ranked

| Rank | Lever | Value | Cost | Status |
|---|---|---|---|---|
| 1 | **Bar relaxation** (RPG-manga → realistic cartoon) | Massive — reclassifies ~1200 imgs in history alone; model can actually hit it | free | ✅ DONE (`eaaa647`) |
| 2 | **Empties sweep** (score 0/1 blank/corner-flood) | Broken→real; deterministic to find; biggest genuine failure class | ~$0.02/img batch | history 559 done; **needs fleet-wide scan** |
| 3 | **Region art-style descriptors** | 7/7 proven in history; targeted, cheap | ~$0.02/img | history done; **apply to remaining mismatch fleet** |
| 4 | **Re-audit under relaxed bar** | Prerequisite that focuses spend — true ≤5 unknown for 34 apps | ~$0.005/img vision | **needed next** (≤100-img slices per provider daily quota) |
| 5 | **Borderline score-5 pass** | Marginal 5→6-8; large population, low per-image value | moderate | **defer** until 1-4 done |

**Model:** gemini-2.5-flash-image (batch ~$0.0195/img) beats 3.1 on the empties sample (5.9 vs 5.3 avg) — stick with 2.5.

---

## Staged art-mismatch fleet plan

1. **Stage 1 — Empties sweep (highest ROI).** Run the deterministic corner-flood scan across all 23 school+life apps (same method that found 559/2266 in history). Batch-regen per app, commit-first, audit, revert ≤5 that regressed (acceptance gate `score > 5`). Estimate: ~5-25% of each app is empties → the cheapest big quality jump available.
2. **Stage 2 — Relaxed-bar re-audit.** Re-audit non-history apps in ≤100-image slices (provider daily quota) under the relaxed bar to build the true current ≤5 list. This replaces the misleading Aug 5 strict-bar baselines.
3. **Stage 3 — Region-descriptor pass.** For remaining art-style mismatches, add per-region/subject descriptors (audit-rules config is the source of truth) + image-specific content cues where a single style descriptor fails (maps → brightness; large scenes → composition + negation).
4. **Stage 4 — Borderline-5 pass (optional).** Only after 1-3; chase the large score-5 population if budget allows.
5. **Stage 5 — Deploy.** Push the regenerated deploy branches per app, verify on Hetzner.
6. **lq-history batch-1 (438-image outlier)** stays deferred until empties + borderline passes land; finish the full-app re-audit (#295) to get a clean final count.

---

## Stage 1 empties pilot — lq-finance + lq-economics (results)

Ran 2026-08-09 on the two worst life apps. **Purpose:** prove the empties-sweep pipeline (scan → batch regen → audit → gate) end-to-end and validate the life-app style directive before fleet roll-out.

| Metric | lq-finance | lq-economics |
|---|---|---|
| Base images | 228 | 238 |
| Empties pre-pilot (corner-flood) | 215 (94.3%) | 218 (91.6%) |
| Pass-1 mechanical clear rate (pre-revert) | 96.7% | 93.3% |
| Directive re-audit avg (slice) | 3.0 → **5.52** (42) | 4.64 → **5.85** (47) |
| needsRegen in slice | 32/42 → 21/42 | 23/47 → 20/47 |
| Pixel-gated (still-empty) in slice | 13 → 4 | 14 → 3 |
| **Kept** (score > 5) | 21 | 28 |
| **Reverted** (score ≤ 5) | 21 | 19 |
| Regen-resistant lessons (empty after both passes) | 25 | 19 |
| Scene-cue pass cleared (of the 44 resistant) | 23/25 | 19/19 |
| First-gate reverts cleared (scene-cue re-regen) | 14/21 | 14/19 |
| Scene-first pass cleared (of 6 cue-resistant) | 1/3 (compound-interest) | 3/3 |
| Unmapped rpg/theme assets (never regenerated) | — | 8 → **0** (cleared, rpg-theme config) |
| **Empties remaining (final, 2026-08-10)** | **9 (3.9%)** | **5 (2.1%)** |

**Key findings:**
1. **The pipeline works.** Batch regen mechanically clears bg-dominated images (93–97% of regenerated lessons on pass 1) at ~$0.02/img (gemini-2.5-flash-image). Across the full pilot (directive re-regen + scene-cue pass + scene-first pass + rpg-theme config + all gates), **419/433 original empties are cleared (96.8%)**.
2. **The style directive is the gating config gap.** Pass 1 (no directive) produced flat preschool/Duolingo clipart — finance avg 3.0, 76% ≤5. Adding the manga/realistic-cartoon directive (lq-tools `23f1d9b`) raised the audit slice avg to 5.52/5.85 and cut pixel-gated 13→4 / 14→3. **All 17 life-app configs need this directive before their empties regen is worth auditing** — only finance + economics have it today.
3. **Per-image scene cues break regen-resistance.** The 44 lessons still empty after the directive re-regen got a concrete "Scene:" depiction appended to each prompt (lq-tools `c5cee15`). Result: **40/44 cleared mechanically** — finance 23/25, economics 19/19 — and the 42 cleared images audited at **avg 7.7 finance / 7.0 economics** (vs 5.52/5.85 directive-only). The 40 first-gate reverts re-regen'd with cues cleared **28/40** (lq-tools `b6efeff`). For the 6 that still resist cue-append, **scene-first prompts** (REPLACE prompt: style directive → 'Scene:' → NO-text, dropping the pedagogical-prose prefix that dominates generation) cleared **4/6** (compound-interest 8; choice-overload/nudge-at-scale/local-seo 8 each; lq-tools `1f82abc`).
4. **Final residue = 14 empties (2026-08-10, 3.0%):** 12 gate-reverted lessons (scored ≤5 on regen — treat as a known-hard population, don't re-regen with the same prompts) + 2 genuinely resistant finance (concentrated-position-strategies, wire-transfers — failed directive + cue-append + scene-first = 3 passes, corner-flood fraction ~0.52). The 8 unmapped economics rpg/theme assets were cleared via a new `rpg-theme-economics.json` config (lq-tools `dd49fba`) + batch regen in lq-economics (`58e34b2`, re-regen `a50c9f9`): all 8 audited >5 (first pass 6 high/avg 7.0; the-debt-dragon + golden-ledger failed on garbled in-image text and were re-regen'd with text-free prompts → avg 8.5).

**Revert gate applied (acceptance gate `score > 5`):** pass-1 gate restored 40 images ≤5 (finance `7a43083`, economics `4e3e769`); scene-pass gate restored 4 (compound-interest `86bf237`; choice-overload, nudge-at-scale, local-seo `78e409a`); first-gate-revert scene-cue pass restored 12 (finance `53dd0c8`, economics `3b13983`); scene-first pass restored 2 still-resistant finance (concentrated-position-strategies, wire-transfers, `82e5db5`). Kept across gates: 87 + 28 + 4 = 119 regenerated images. Text-word-only issues above 5 were not reverted.

**Cost:** ~$16.6 directive regen + ~$1.7 scene-cue regen (44) + ~$0.39 rpg-theme regen (8 + 2 re-runs) + ~$1.1 scene-cue regen (40) + ~$0.23 scene-first regen (6) + ~$0.05 audit. Commits: lq-tools `c5cee15` (cues) + `dd49fba` (rpg-theme config) + `b6efeff` (40 first-gate cues) + `1f82abc` (6 scene-first); finance `6f20266`→`1e8ff79`→`7a43083`→`3ee7bcd`→`86bf237`→`d1b9d7e`→`53dd0c8`→`3d16e1c`→`82e5db5`; economics `70fe28d`→`0dda065`→`4e3e769`→`dac2588`→`78e409a`→`58e34b2`→`a50c9f9`→`fd96f3e`→`3b13983`→`c599703`.

---

## Tooling & workflow (do not regress)

- **Audit:** `lq-tools/scripts/ai-audit-images.ts --path=<app>/public/images --image-list=<raw JSON array> --output=<file>` (vision chain: minimax-anthropic/glm; **≤100 image-calls/day** per cheap provider → slice audits).
- **Regen:** `lq-tools/scripts/regenerate-flagged-images.ts --app=<app> --batch --regen-file=<audit JSON> --model=gemini-2.5-flash-image`; parallel via `--concurrency` (worker pool in `@blueforge-studio/image-gen@0.1.14`, not lq-tools).
- **Precise filter** (`regen-precise-filter.ts`): keeps single-copy basenames unconditionally, applies output-dir match only on duplicate basenames (kills id-expansion).
- **No-churn skip** (`regen-no-churn.ts`): skips files newer than the audit snapshot; `--force` overrides.
- **Workflow gate (user):** commit generated images FIRST → audit → `git checkout --` failures. Never discard an uncommitted generated image.
- **Acceptance gate (user):** keep if `score > 5`; text words tolerable above 5; do NOT revert on text alone.
- **Variant byproducts:** `--1280/--640/--320/--512/--400/--800` files are safe to delete UNLESS an asset map references them (lq-romance conversation-scenes DO; school/life chapter-1 variants generally don't).

---

## Open items / follow-ups

1. **#294 (close-out this session):** Phase A report + memory/CLAUDE.md update (relaxed bar + region descriptors + batch orchestration in package). Memory + CLAUDE.md edits pending.
2. **#295 (in_progress):** Full lq-history re-audit under relaxed bar → clean final ≤5 count.
3. **#232/#233/#234 (in_progress/pending):** nordic ch1 + science ch1-2 candidates → batch regen → fresh audit.
4. **Stage 1 fleet empties sweep** — pilot (finance + economics) + scene-cue pass + scene-first pass + rpg-theme config proved the pattern: directive (life apps) + per-image content cues for regen-resistant lessons, escalating to **scene-first prompts** (drop the prose prefix) when cue-append still fails, + a rpg-theme config file for unmapped theme assets (canonical prompts live in the app's `asset-map.json`). Prerequisite before roll-out: add the manga/realistic-cartoon directive to the other 15 life-app configs (only finance + economics have it). Remaining in the two pilot apps: 14 empties = 12 gate-reverted lessons (regenerated but scored ≤5 — treat as a known-hard population, don't re-regen with the same prompts) + 2 genuinely resistant finance (concentrated-position-strategies, wire-transfers — failed directive + cue-append + scene-first = 3 passes).
5. **Fleet re-audit under relaxed bar** for the 34 unaudited apps.
6. **Stream-parse `GeminiBatchRunner.downloadOutput`** (the 545MB JSONL crash that lost the history batch-1 — fixed in later package versions, verify 0.1.14+).
7. **historical-figures.json** hand-authored config style gap still open (lq-history).
8. **Push pending:** only **lq-history** is ahead of origin (11 commits: 155-batch, empties, art-fix). School + life chapter-1 batches already pushed.
9. **lq-nordic on `main`** — decide branch strategy before its deploy.

---

## Key pointers

| Path | What |
|---|---|
| `learn-quest/lq-operations/scripts/lib/app-registry.ts` | 44-app registry (school/lang/life/books, ports, dirs) |
| `lq-tools/scripts/audit-rules.config.json` | 23 path→artStyle rules (source of truth for region descriptors) |
| `lq-tools/packages/image-tools/src/config/subjects/<app>/lessons-*.json` | Per-app gen-configs (prompts + descriptors live here) |
| `lq-tools/scripts/regenerate-flagged-images.ts` | Regen CLI (audit-mode + `--chapter` + `--batch` + `--concurrency`) |
| `lq-tools/scripts/ai-audit-images.ts` | Audit CLI (vision chain, per-region rules, corner-flood, pixel gate) |
| `lq-tools/scripts/lib/regen-precise-filter.ts`, `regen-no-churn.ts` | Target filtering + no-churn skip |
| `blueforge-org/packages/ai/image-gen` | Canonical batch orchestration (`processConfigBatch`/`processConfigBatches`, @0.1.14) |
| `/tmp/lq-audit-logs/*.log` | Aug 5 strict-bar baseline audits (all apps) |
| `/tmp/lq-history-partial-audit.json` | lq-history post-campaign relaxed-bar audit (2266) |

---
Generated 2026-08-09 for Phase A close-out and fleet follow-up.
