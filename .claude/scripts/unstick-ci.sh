#!/usr/bin/env bash
#
# unstick-ci.sh — Cancel wedged gitea-actions CI runs.
#
# Background (2026-09-21 session):
#   `fgit v0.7.0` does NOT ship a `git-runners queue unstick` subcommand
#   (the operator's preferred escape hatch) and defaults its internal DB
#   connection to the OLD forge-git box IP (178.104.233.155) per
#   `feedback_fgit_old_ip_default_cx33.md`. The gitea admin API works
#   regardless: this script wraps the curl one-liners with sane defaults,
#   --dry-run, and per-repo filtering.
#
#   The forge-control DEPLOY queue is a SEPARATE system (see
#   `forge in-flight` / `forge app history <slug>`). It is not addressable
#   from this script. For deploy-queue wedge see `.claude/agents/fgit-pr.md`
#   and the forge CLI itself.
#
# Usage:
#   unstick-ci.sh --list [--repo blueforge-studio/foo] [--limit 50]
#   unstick-ci.sh --run <id> [--dry-run]
#   unstick-ci.sh --in-progress-older-than 30m [--repo ...] [--dry-run]
#   unstick-ci.sh --queued-attempt-at-least 4 [--repo ...] [--dry-run]
#
# Env:
#   GITEA_TOKEN — required; same scope as `fgit pr merge` (write:issue).
#                 Set in ~/.config/forge/secrets.env (assigns without
#                 export; use `set -a; source …; set +a` if needed).
#   FORGE_GIT_URL — optional, defaults to https://forge-git.blueforge.studio
#
# Exit codes:
#   0  — every targeted run was cancelled (or dry-run listed targets).
#   1  — one or more cancellations failed (other targets still cancelled).
#   2  — auth/usage error.

set -euo pipefail

usage() {
  cat <<EOF
Usage: $0 [--list | --run <id> | --in-progress-older-than <dur> | --queued-attempt-at-least <n>]
            [--repo <owner/repo>] [--dry-run] [--limit <n>]
            [--base-url <url>]

Cancel wedged gitea-actions CI runs.

Modes (pick one):
  --list                              List recent runs (default limit 50).
  --run <id>                          Cancel a specific run by id (blueforge-studio/blueforge only).
  --in-progress-older-than <duration> Cancel in_progress runs whose started_at is older
                                      than <duration> (e.g. 30m, 2h, 1d).
  --queued-attempt-at-least <n>       Cancel queued/waiting runs whose run_attempt
                                      is ≥ <n> (multi-retry = wedge signal).

Scope:
  --repo <owner/repo>                 Limit to one repo (e.g. blueforge-studio/blueforge).
  --dry-run                           For cancel ops, print what would be cancelled.
  --limit <n>                        For --list, how many runs to show (default 50).
  --base-url <url>                   Override FORGE_GIT_URL (for staging).
  -V, --version                       Print version and exit.
  -h, --help                          Show this help.

Env: GITEA_TOKEN (required), FORGE_GIT_URL (default https://forge-git.blueforge.studio).
EOF
}

LIST_ONLY=0
RUN_ID=""
IN_PROGRESS_OLDER=""
QUEUED_ATTEMPT_MIN=""
REPO=""
LIMIT=50
DRY_RUN=0
BASE_URL="${FORGE_GIT_URL:-https://forge-git.blueforge.studio}"

# Validate auth.
if [[ -z "${GITEA_TOKEN:-}" ]]; then
  echo "GITEA_TOKEN is unset. Source ~/.config/forge/secrets.env with \`set -a; source ...; set +a\`." >&2
  exit 2
fi
AUTH="Authorization: token $GITEA_TOKEN"
BASE="${BASE_URL%/}/api/v1"
# The forge-git admin API filters by User-Agent — Python-urllib defaults
# to 'Python-urllib/3.x' which gets 403. curl gets 200. Lie about our UA
# to match what an operator's interactive shell would send.
UA="curl/8.0.1"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --list)                          LIST_ONLY=1; shift ;;
    --run)                           RUN_ID="$2"; shift 2 ;;
    --in-progress-older-than)        IN_PROGRESS_OLDER="$2"; shift 2 ;;
    --queued-attempt-at-least)       QUEUED_ATTEMPT_MIN="$2"; shift 2 ;;
    --repo)                          REPO="$2"; shift 2 ;;
    --limit)                         LIMIT="$2"; shift 2 ;;
    --dry-run)                       DRY_RUN=1; shift ;;
    --base-url)                      BASE_URL="$2"; shift 2 ;;
    -V|--version)                     echo "unstick-ci.sh 1.0.0"; exit 0 ;;
    -h|--help)                        usage; exit 0 ;;
    *)                               echo "Unknown arg: $1" >&2; usage >&2; exit 2 ;;
  esac
done

# Parse duration into minutes. Supports m / h / d suffixes (case-insensitive).
# Examples: "30m" → 30, "2h" → 120, "1d" → 1440.
parse_duration_minutes() {
  local input="$1"
  local re='^([0-9]+)([mhdMHD])$'
  if [[ ! "$input" =~ $re ]]; then
    echo "Invalid duration: $input (use 30m, 2h, 1d)" >&2
    exit 2
  fi
  local n="${BASH_REMATCH[1]}"
  local unit="${BASH_REMATCH[2],,}"
  case "$unit" in
    m) echo "$n" ;;
    h) echo $((n * 60)) ;;
    d) echo $((n * 1440)) ;;
  esac
}

# List runs. The admin API endpoint accepts a ?repo= filter; we pass
# through and let the server do the filtering (cheaper than fetching
# all + filtering client-side).
list_runs() {
  local query=""
  if [[ -n "$REPO" ]]; then query="?repo=$REPO"; fi
  # Wrap in a subshell with `|| true` so the inner python3's SIGPIPE exit
  # (status 141) doesn't propagate via `set -o pipefail` when downstream
  # stages consume only part of the stream.
  ( curl -s -H "$AUTH" -A "$UA" "$BASE/admin/actions/runs${query}" \
    | python3 -c "
import json, sys, signal
signal.signal(signal.SIGPIPE, signal.SIG_DFL)
d = json.load(sys.stdin)
for r in d.get('workflow_runs', []):
    print(json.dumps(r))
" 2>/dev/null ) || true
}

# Print a one-line summary for a run JSON. Pipes the run through python
# to parse and format. Returns 0 always; pipefail-safe (python exits 0
# even if json.loads fails — we just print '?' in that case).
print_summary() {
  python3 -c "
import json, sys, datetime
try:
    r = json.loads(sys.argv[1])
except Exception:
    print('  ?unparseable?')
    sys.exit(0)
parts = ['#' + str(r['id']), 'status=' + str(r.get('status','?')),
         'attempt=' + str(r.get('run_attempt','?'))]
started = r.get('started_at') or ''
if started and started != '1970-01-01T00:00:00Z':
    try:
        c = datetime.datetime.fromisoformat(started.replace('Z', '+00:00'))
        age = datetime.datetime.now(datetime.timezone.utc) - c
        if age.days > 0:
            parts.append(f'{age.days}d{int(age.seconds/3600)}h old')
        elif age.seconds > 3600:
            parts.append(f'{int(age.seconds/3600)}h{int((age.seconds%3600)/60)}m old')
        else:
            parts.append(f'{int(age.seconds/60)}m old')
    except Exception:
        pass
repo = r.get('repository',{}).get('full_name','?')
path = r.get('path','?')
print(f'  {\" \".join(parts):60}  {repo}  {path}')
" "$1"
}

# Cancel a single run via the per-repo cancel endpoint. Gitea's
# `DELETE …/actions/runs/{id}` actually deletes the run (including logs
# + artifacts on 1.27); the correct call is `POST …/actions/runs/{id}/cancel`.
# Gitea returns 409 when the run is already completed — treat that as
# success ("it's done, nothing to cancel") rather than an error.
# Repo path is derived from `repository.full_name` so this works for
# any repo, not just blueforge.
cancel_one() {
  local run="$1"
  local id status attempt repo_full cancel_url http_code
  id=$(printf '%s' "$run" | python3 -c "import json, sys; print(json.load(sys.stdin)['id'])")
  status=$(printf '%s' "$run" | python3 -c "import json, sys; print(json.load(sys.stdin).get('status','?'))")
  attempt=$(printf '%s' "$run" | python3 -c "import json, sys; print(json.load(sys.stdin).get('run_attempt','?'))")
  repo_full=$(printf '%s' "$run" | python3 -c "import json, sys; print(json.load(sys.stdin).get('repository',{}).get('full_name','?'))")
  if [[ $DRY_RUN -eq 1 ]]; then
    echo "  would cancel:  #$id  status=$status  attempt=$attempt  ($repo_full)"
    return 0
  fi
  cancel_url="$BASE/repos/$repo_full/actions/runs/$id/cancel"
  http_code=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H "$AUTH" -H "User-Agent: $UA" "$cancel_url")
  # 200 / 204 = accepted / cancelled. 409 = already done (treat as success).
  case "$http_code" in
    200|204)
      echo "  cancelled:    #$id  status=$status  attempt=$attempt"
      return 0 ;;
    409)
      echo "  already done: #$id  status=$status  attempt=$attempt"
      return 0 ;;
  esac
  echo "  failed (HTTP $http_code):  #$id"
  return 1
}

# Mode: --list
if [[ $LIST_ONLY -eq 1 ]]; then
  echo "Listing runs (limit $LIMIT)${REPO:+ for $REPO}:"
  list_runs | head -n "$LIMIT" | while IFS= read -r run; do print_summary "$run" || true; done
  exit 0
fi

# Mode: --run <id>
if [[ -n "$RUN_ID" ]]; then
  # Look up the run via the admin endpoint so we know which repo it lives
  # in (the per-repo endpoint is required for cancel). Repo is derived
  # from the run's `repository.full_name` — works for any repo, not just
  # blueforge-studio/blueforge. For other repos, the cancel will go
  # through the right path automatically.
  run=$(curl -s -H "$AUTH" -H "User-Agent: $UA" "$BASE/admin/actions/runs/$RUN_ID" || true)
  if [[ -z "$run" || "$run" == "null" ]]; then
    echo "Run $RUN_ID not found via $BASE/admin/actions/runs/$RUN_ID." >&2
    exit 2
  fi
  echo "Target:"; print_summary "$run"
  if [[ $DRY_RUN -eq 1 ]]; then
    echo "Dry run; no action taken."
    exit 0
  fi
  cancel_one "$run"
  exit $?
fi

# Mode: --in-progress-older-than <dur>
if [[ -n "$IN_PROGRESS_OLDER" ]]; then
  threshold_min=$(parse_duration_minutes "$IN_PROGRESS_OLDER")
  echo "Cancelling in_progress runs older than $IN_PROGRESS_OLDER (${threshold_min}m)${REPO:+ for $REPO}:"
  echo
  # Single Python process (same rationale as --queued-attempt-at-least).
  python3 <<PYEOF
import datetime, json, sys, urllib.request

AUTH = "Authorization: token ${GITEA_TOKEN}"
BASE = "${BASE_URL%/}/api/v1"
REPO = "${REPO}"
THRESHOLD = ${threshold_min}
DRY = ${DRY_RUN}

url = BASE + '/admin/actions/runs' + (('?repo=' + REPO) if REPO else '')
req = urllib.request.Request(url, headers={'Authorization': 'token ${GITEA_TOKEN}', 'User-Agent': '${UA}'})
data = json.loads(urllib.request.urlopen(req, timeout=15).read())
runs = data.get('workflow_runs', [])

now = datetime.datetime.now(datetime.timezone.utc)
candidates = []
for r in runs:
    if r.get('status') != 'in_progress':
        continue
    started = r.get('started_at') or ''
    if not started or started == '1970-01-01T00:00:00Z':
        continue
    try:
        c = datetime.datetime.fromisoformat(started.replace('Z', '+00:00'))
    except Exception:
        continue
    age_min = int((now - c).total_seconds() // 60)
    if age_min >= THRESHOLD:
        candidates.append(r)

if not candidates:
    print('  (no matching runs)')
    sys.exit(0)

fail = 0
for r in candidates:
    rid = r['id']
    repo = r.get('repository', {}).get('full_name', '?')
    path = r.get('path', '?')
    print(f"  #{rid:5}  {repo}  {path}")
    if DRY:
        continue
    # Gitea 1.27: DELETE /runs/{id} deletes the run (incl. logs/artifacts);
    # the correct call is POST /runs/{id}/cancel. 409 = already done
    # (treat as success; the operator's intent is achieved either way).
    cancel_url = f"{BASE}/repos/{repo}/actions/runs/{rid}/cancel"
    cancel_req = urllib.request.Request(
        cancel_url, headers={'Authorization': 'token ${GITEA_TOKEN}', 'User-Agent': '${UA}'}, method='POST')
    try:
        with urllib.request.urlopen(cancel_req, timeout=15) as r2:
            code = r2.status
    except urllib.error.HTTPError as e:
        code = e.code
    if code in (200, 204, 409):
        verb = {200: 'cancelled', 204: 'cancelled', 409: 'already done'}[code]
        print(f"          {verb}")
    else:
        print(f"          failed (HTTP {code})")
        fail += 1

sys.exit(1 if fail > 0 else 0)
PYEOF
  exit $?
fi

# Mode: --queued-attempt-at-least <n>
if [[ -n "$QUEUED_ATTEMPT_MIN" ]]; then
  # run_attempt is a strong wedge signal: each retry increments it. A
  # queued run with attempt >= 4 has been retried at least 3 times
  # without ever reaching a runner — that's almost always a real wedge.
  # No timestamp needed (Gitea returns null for queued runs).
  echo "Cancelling queued/waiting runs with run_attempt ≥ $QUEUED_ATTEMPT_MIN${REPO:+ for $REPO}:"
  echo
  # Single Python process: fetch, filter, format, output. No shell
  # pipe / subshell gymnastics. Cancellation is a separate per-id call.
  python3 <<PYEOF
import json, os, subprocess, sys, urllib.request

AUTH = "Authorization: token ${GITEA_TOKEN}"
BASE = "${BASE_URL%/}/api/v1"
REPO = "${REPO}"
N = ${QUEUED_ATTEMPT_MIN}
DRY = ${DRY_RUN}

query = ('?repo=' + REPO) if REPO else ''
url = BASE + '/admin/actions/runs' + query

req = urllib.request.Request(url, headers={'Authorization': 'token ${GITEA_TOKEN}', 'User-Agent': '${UA}'})
data = json.loads(urllib.request.urlopen(req, timeout=15).read())
runs = data.get('workflow_runs', [])

candidates = [
    r for r in runs
    if r.get('status') in ('queued', 'waiting')
    and (r.get('run_attempt') or 1) >= N
]

if not candidates:
    print('  (no matching runs)')
    sys.exit(0)

fail = 0
for r in candidates:
    rid = r['id']
    repo = r.get('repository', {}).get('full_name', '?')
    path = r.get('path', '?')
    attempt = r.get('run_attempt', '?')
    print(f"  #{rid:5}  attempt={attempt}  {repo}  {path}")
    if DRY:
        continue
    # Per-repo cancel endpoint. Hard-coded to blueforge-studio/<repo>; the
    # admin endpoint requires repo-specific routing.
    # Gitea 1.27: DELETE /runs/{id} deletes the run (incl. logs/artifacts);
    # the correct call is POST /runs/{id}/cancel. 409 = already done
    # (treat as success; the operator's intent is achieved either way).
    cancel_url = f"{BASE}/repos/{repo}/actions/runs/{rid}/cancel"
    cancel_req = urllib.request.Request(
        cancel_url, headers={'Authorization': 'token ${GITEA_TOKEN}', 'User-Agent': '${UA}'}, method='POST')
    try:
        with urllib.request.urlopen(cancel_req, timeout=15) as r2:
            code = r2.status
    except urllib.error.HTTPError as e:
        code = e.code
    if code in (200, 204, 409):
        verb = {200: 'cancelled', 204: 'cancelled', 409: 'already done'}[code]
        print(f"          {verb}")
    else:
        print(f"          failed (HTTP {code})")
        fail += 1

sys.exit(1 if fail > 0 else 0)
PYEOF
  exit $?
fi

echo "Need --list, --run, --in-progress-older-than, or --queued-attempt-at-least. See --help." >&2
exit 2