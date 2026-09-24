# lq-history full re-audit — 2026-09-24 (#295 close-out)

Full re-audit of all **2,266** base images under the relaxed bar. Supersedes the
Aug-9 *partial* relaxed audit (163H/400M/1703L; 655 needs-regen).

- **Runner:** `lq-tools/scripts/ai-audit-images.ts` @ `d2e785a` (main, incl. #27 neutral fix)
- **Bar:** default — 22 era/region path rules enforced; 177 `ancient/_general` fall to the
  rpg preset. No `--art-style` override, so counts stay comparable to Aug-9.
- **Chain:** minimax-anthropic → glm → qwen → anthropic (minimax hit 100/100 daily cap mid-run,
  glm broken all day — anthropic carried the back half). Env traps `ANTHROPIC_BASE_URL`/`ANTHROPIC_MODEL` unset.
- **Chunking:** 6 deterministic `--image-list` chunks (scanner readdir order is unsorted → no `--offset`).
- **Result files:** `lq-history-reaudit-2026-09-24-p{1..6}.json` + merged `…-2026-09-24.json` (regen-file compatible).

## Headline

| Metric | Aug-9 partial | **2026-09-24 full** | Δ |
|---|---|---|---|
| Images | 2,266 (partial coverage) | **2,266 / 2,266 audited, 0 failed** | full coverage |
| Avg score | ~low-heavy | **3.72** | — |
| Needs-regen | 655 | **865** | **+210** |
| Score ≥8 (high) | 163 (thr. unknown) | 68 | — |
| Score 6–7 (med) | 400 (thr. unknown) | 10 | — |
| Score ≤5 | 1,703 (thr. unknown) | 2188 | — |
| Cost | — | **$3.99** | — |

Aug-9 bucket thresholds were not recorded, so H/M/L are not strictly comparable —
the needs-regen flag is the reliable comparison, and it moved **655 → 865**.

## Score histogram

| 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|
| 743 | 34 | 46 | 9 | 1356 | 3 | 7 | 20 | 48 |

Bimodal: **743 score-1** (empties, mostly pixel-gate) + **1,356 score-5** (capped by a
flag — art-style/text/etc. — but otherwise sound). Only 78 images score >5.

## What the 865 needs-regen actually are

| Class | Count (issue-tag hits) |
|---|---|
| Pixel/empty (corner-bg-fill, near-white) | 662 |
| Art-style mismatch (era descriptor / rpg) | 98 |
| Text/embedded-label issues | 206 |
| Misspelled text | 64 |
| Border artifact | 11 |
| Childish/preschool style | 10 |
| Watermark/signature (e.g. `OMarylace 2021`) | 9 |

Rows carry multiple issues, so classes overlap. **Empties are the dominant class —
the Aug-9 "empties cleared" note applied only to the campaign batches, not the full tree.**

## By era (regen / total)

- **ancient**: 262/675
- **contemporary**: 19/51
- **early-modern**: 134/336
- **industrial**: 79/220
- **medieval**: 169/452
- **modern**: 136/332
- **renaissance**: 66/200

## Caveats

- Vision LLM is non-deterministic ([[feedback-audit-non-deterministic]]) — single pass, treat
  borderline flips as noise; empties (pixel-gate) are deterministic and trustworthy.
- `glm` provider is broken all day (`messages.content.type 参数非法`); minimax + qwen both
  hit 100/100 daily caps — anthropic carried the remainder. Cost concentrated there.

## Next (not done here)

- Regen pass over the 658 pixel/empties (deterministic, ~$0.02/img batch) — biggest lever.
- Art-style residue: 385 hits are on never-regenerated images predating the era-descriptor
  gen-configs; fold into a targeted regen, not a re-audit.
- Watermark findings (9) are content-provenance issues — review before regen.
