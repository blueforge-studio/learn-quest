#!/bin/zsh
# Crash-recovery proof on chapter 5. Needs the dev server on :3010 and NOTHING else running browsers (serial rule, D16).
# Every recovered run must equal the uninterrupted reference (same lessons + outcomes, no duplicates, one run id).
cd "$(dirname "$0")/.."; export CHAPTER=5 MAX=70
rm -rf runs/t1 runs/t2 runs/t3 runs/t4 runs/t5 runs/t6
echo "### T1 uninterrupted (reference, run under the supervisor)"; RUN_DIR=runs/t1 resume/supervise.sh 2>&1 | grep -E "supervisor|finished|INCOMPLETE|no current"
echo "### T2 SIGKILL right after commit #8, then resume";           RUN_DIR=runs/t2 CRASH_AT=after-commit:8 node walk4.mjs > /dev/null 2>&1; echo "(first run exit $?)"; RUN_DIR=runs/t2 node walk4.mjs 2>&1 | grep -E "RESUMED|finished|failed verification|INFRA"
echo "### T3 SIGKILL in the middle of lesson #12, then resume";       RUN_DIR=runs/t3 CRASH_AT=mid-lesson:12 node walk4.mjs > /dev/null 2>&1; echo "(first run exit $?)"; RUN_DIR=runs/t3 node walk4.mjs 2>&1 | grep -E "RESUMED|finished|failed verification|INFRA"
echo "### T4 SIGKILL after snapshot #5 is written but before its record, then resume"; RUN_DIR=runs/t4 CRASH_AT=before-record:5 node walk4.mjs > /dev/null 2>&1; echo "(first run exit $?)"; RUN_DIR=runs/t4 node walk4.mjs 2>&1 | grep -E "RESUMED|finished|failed verification|INFRA"
echo "### T5 stale newest snapshot (baseline state copied over it): verification must FAIL, roll back, redo"
RUN_DIR=runs/t5 CRASH_AT=after-commit:9 node walk4.mjs > /dev/null 2>&1; echo "(first run exit $?)"
cp runs/t5/snaps/snap-0000.json runs/t5/snaps/snap-0009.json
RUN_DIR=runs/t5 node walk4.mjs 2>&1 | grep -E "RESUMED|finished|failed verification|INFRA"
echo "### T6 browser killed mid-lesson #12 (infra crash), supervisor must restart and finish without help"
RUN_DIR=runs/t6 CRASH_AT=kill-browser:12 resume/supervise.sh 2>&1 | grep -E "supervisor|RESUMED|finished|INFRA|failed verification"
echo "### COMPARE"; EXPECT_ROLLBACK="runs/t5" node resume/compare.mjs runs/t1 runs/t2 runs/t3 runs/t4 runs/t5 runs/t6
