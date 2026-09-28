#!/bin/zsh
# lq-history empties regen — 662 pixel-gate targets, Gemini Batch API (50% off), 5 chunks
set -u
cd /Volumes/SSD/Projects/Repos/lq-tools || exit 1
DIR=/Volumes/SSD/Projects/Repos/learn-quest/docs/audits/lq-history-empties-regen-2026-09-24
LOG=$DIR/empties-batch.log
for i in 1 2 3 4 5; do
  echo "[chunk $i] start $(date -Is)" >> "$LOG"
  node_modules/.bin/tsx scripts/regenerate-flagged-images.ts \
    --app=lq-history \
    --regen-file=$DIR/empties-chunk-$i.json \
    --batch --budget=10 >> "$LOG" 2>&1
  rc=$?
  echo "[chunk $i] rc=$rc $(date -Is)" >> "$LOG"
  if [[ $rc -ne 0 ]]; then
    echo "[abort] chunk $i failed rc=$rc — stopping" >> "$LOG"
    exit $rc
  fi
done
echo "[all] done $(date -Is)" >> "$LOG"
