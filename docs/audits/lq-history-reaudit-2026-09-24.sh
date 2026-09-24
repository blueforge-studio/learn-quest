#!/bin/zsh
# Full lq-history re-audit (#295) — 2,266 base webp images, default relaxed bar,
# era/region path rules enforced (22 rules; 177 unmatched fall to rpg preset).
# Chunked via --image-list (scanner readdir order is unsorted → no --offset).
set -u
LQT=/Volumes/SSD/Projects/Repos/lq-tools
OUTDIR=/Volumes/SSD/Projects/Repos/learn-quest/docs/audits
LISTS=$OUTDIR/lq-history-reaudit-2026-09-24-lists
LOG=$OUTDIR/lq-history-reaudit-2026-09-24.log
IMAGES=/Volumes/SSD/Projects/Repos/lq-history/public/images
PREFIX=$OUTDIR/lq-history-reaudit-2026-09-24-p

cd "$LQT" || exit 1
for i in 1 2 3 4 5 6; do
  out="${PREFIX}${i}.json"
  echo "[chunk $i] start $(date -Is)" >> "$LOG"
  # env traps: ANTHROPIC_BASE_URL (no /v1) + ANTHROPIC_MODEL (non-Anthropic id) must be unset
  env -u ANTHROPIC_BASE_URL -u ANTHROPIC_MODEL -u VISION_CHAIN_ORDER \
    node_modules/.bin/tsx scripts/ai-audit-images.ts \
      --path="$IMAGES" \
      --image-list="$LISTS/chunk-$i.json" \
      --budget=2 --sleep-ms=250 \
      --output="$out" >> "$LOG" 2>&1
  rc=$?
  if [[ -f "$out" ]]; then
    summary=$(python3 -c "import json;d=json.load(open('$out'));s=d['summary'];print(f\"audited={s['audited']} failed={s['failed']} needsRegen={s['needsRegen']} avg={s['avgScore']} cost=\${s['totalCost']}\")")
    echo "[chunk $i] rc=$rc $summary $(date -Is)" >> "$LOG"
    audited=$(python3 -c "import json;print(json.load(open('$out'))['summary']['audited'])")
    if [[ "$audited" -lt 10 ]]; then
      echo "[abort] chunk $i audited only $audited — chain likely dead; stopping remaining chunks" >> "$LOG"
      exit 2
    fi
  else
    echo "[chunk $i] rc=$rc NO OUTPUT — stopping" >> "$LOG"
    exit 3
  fi
done
echo "[all] done $(date -Is)" >> "$LOG"
