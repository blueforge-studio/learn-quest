#!/bin/zsh
# lq-history quality regen — 203 non-empty needs-regen images from the 09-24 re-audit.
set -u
cd /Volumes/SSD/Projects/Repos/lq-tools || exit 1
DIR=/Volumes/SSD/Projects/Repos/learn-quest/docs/audits/lq-history-quality-regen-2026-09-28
for i in 1 2; do
  echo "[chunk $i] start $(date +%FT%T)" >> $DIR/run.log
  node_modules/.bin/tsx scripts/regenerate-flagged-images.ts --app=lq-history --regen-file=$DIR/chunk-$i.json --batch --budget=6 >> $DIR/run.log 2>&1
  rc=$?; echo "[chunk $i] rc=$rc $(date +%FT%T)" >> $DIR/run.log
  [[ $rc -ne 0 ]] && exit $rc
done
echo "[all] done $(date +%FT%T)" >> $DIR/run.log
