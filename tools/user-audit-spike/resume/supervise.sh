#!/bin/zsh
# Supervisor: run the walker until the shard is finished. Exit codes from walk4: 0 done/stopped, 75 infra crash (restart),
# 3 chapter ended with uncompleted map cards (stop, needs a human), anything else = real error (stop).
# usage: RUN_DIR=... CHAPTER=5 resume/supervise.sh      env is passed through
cd "$(dirname "$0")/.."; MAXTRY=${MAXTRY:-5}; n=0
while (( n < MAXTRY )); do
  n=$((n+1)); echo "[supervisor] attempt $n/$MAXTRY"; node walk4.mjs; rc=$?
  if [[ -f "${RUN_DIR:-runs/danish-ch${CHAPTER:-1}}/finished.json" ]]; then echo "[supervisor] finished after $n attempt(s)"; exit 0; fi
  case $rc in 75) echo "[supervisor] infra crash (exit 75); restarting from the last snapshot"; sleep 3; unset CRASH_AT;; 3) echo "[supervisor] chapter incomplete; stopping"; exit 3;; 0) echo "[supervisor] stopped without finishing (MAX reached?)"; exit 0;; 137) echo "[supervisor] killed (SIGKILL); restarting"; unset CRASH_AT; sleep 1;; *) echo "[supervisor] error exit $rc; stopping"; exit $rc;; esac
done
echo "[supervisor] gave up after $MAXTRY attempts"; exit 4
