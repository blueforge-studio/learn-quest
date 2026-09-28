#!/bin/zsh
# lq-history empties REMAINDER — 362 still-pixel-empty after the re-audit,
# 3 chunks ≤165 (stays under the 512MB JSONL download limit on image-gen@0.1.7).
set -u
cd /Volumes/SSD/Projects/Repos/lq-tools || exit 1
DIR=/Volumes/SSD/Projects/Repos/learn-quest/docs/audits/lq-history-empties-regen-2026-09-24
LOG=$DIR/remainder-resume.log
for i in 1 2 3; do
  SUFFIX=""; [[ $i == 1 ]] && SUFFIX="-resume"
  echo "[chunk $i] start $(date -Is)" >> "$LOG"
  node_modules/.bin/tsx scripts/regenerate-flagged-images.ts \
    --app=lq-history \
    --regen-file=$DIR/remainder-chunk-${i}${SUFFIX:-}.json \
    --batch --budget=10 >> "$LOG" 2>&1
  rc=$?
  echo "[chunk $i] rc=$rc $(date -Is)" >> "$LOG"
  if [[ $rc -ne 0 ]]; then
    echo "[abort] chunk $i failed rc=$rc — stopping" >> "$LOG"
    exit $rc
  fi
done
echo "[all] done $(date -Is)" >> "$LOG"
