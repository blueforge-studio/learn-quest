#!/usr/bin/env bash
# LFS smoke — verifies a Gitea repo's LFS subsystem end-to-end.
#
# Three checks, each gated by env var so a single script can do any subset:
#
#   LFS_SMOKE_ENDPOINT   — bare repo endpoint (https://host/owner/repo.git)
#                          Triggers the endpoint-404 guard.
#   LFS_SMOKE_CLONE      — full clone URL with .git suffix
#                          Triggers the count-match guard.
#   LFS_SMOKE_SMUDGE     — path to one LFS file inside the clone
#                          (defaults to <clone>/languages/<first audio dir>/...mp3)
#                          Triggers the smudge guard.
#
# Exit codes:
#   0  — all checks passed
#   1  — endpoint returned 404 (LFS subsystem not loaded)
#   2  — LFS-tracked count != binary-file count on disk
#   3  — smudge filter failed for a known LFS object
#
# Provenance: filed 2026-09-20 against forge-git#118 (fleet-wide LFS 404).
# Forge-git peer requested this smoke; they will mirror it into
# `.gitea/workflows/ci-pr.yml` once LFS is restored.
#
# Usage:
#   ./lfs-smoke.sh endpoint https://forge-git.blueforge.studio/blueforge-studio/lq-west-slavic.git
#   ./lfs-smoke.sh clone   https://forge-git.blueforge.studio/blueforge-studio/lq-west-slavic.git /tmp/lfs-clone
#   ./lfs-smoke.sh smudge  /tmp/lfs-clone languages/czech/audio/chapter-1/concept-sentence-structure/examples/0-the-dog-sleeps-lit-dog-sleeps.mp3
#   ./lfs-smoke.sh all     https://forge-git.blueforge.studio/blueforge-studio/lq-west-slavic.git
#
# The 'all' mode runs endpoint → clone → smudge in sequence. Failures stop the run.

set -uo pipefail

# ── Subcommand dispatch ───────────────────────────────────────────

cmd="${1:-usage}"

if [[ "$cmd" == "usage" || "$cmd" == "-h" || "$cmd" == "--help" ]]; then
  sed -n '2,/^$/p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
fi

# ── Endpoint guard (the bug shape on CX33 since the migration) ───

check_endpoint() {
  local endpoint="$1"
  # Probe the batch API, not bare /info/lfs: Gitea has no route there and
  # 404s even with LFS healthy. An unauthenticated batch POST answers
  # 401 (private repo) or 200 when LFS is loaded, and 404 when it is not.
  local probe="${endpoint%.git}.git/info/lfs/objects/batch"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    -H 'Accept: application/vnd.git-lfs+json' \
    -H 'Content-Type: application/vnd.git-lfs+json' \
    -d '{"operation":"download","objects":[]}' "$probe")
  if [[ "$code" == "404" ]]; then
    echo "FAIL: $probe → HTTP $code (LFS subsystem not loaded at route level)" >&2
    echo "      This is the CX33 regression: Gitea returns 404 on /info/lfs/objects/batch" >&2
    echo "      Recovery: re-add the three env vars to /opt/forge-git/docker-compose.yml" >&2
    echo "        GITEA__server__LFS_START_SERVER=true" >&2
    echo "        GITEA__lfs__STORAGE_TYPE=local" >&2
    echo "        GITEA__lfs__PATH=/data/git/lfs" >&2
    echo "      then: docker compose up -d --no-deps gitea" >&2
    return 1
  fi
  echo "PASS: $probe → HTTP $code"
  return 0
}

# ── Count-match guard (the working-tree noise symptom) ────────────

# What extensions does .gitattributes declare as LFS-tracked? Read from the
# clone's own .gitattributes so the smoke works for any LFS-touching repo.
lfs_extensions() {
  local clone="$1"
  if [[ ! -f "$clone/.gitattributes" ]]; then
    echo "mp3 wav ogg mp4 png jpg jpeg"   # sensible default
    return 0
  fi
  grep -oE '\*\.[[:alnum:]]+ filter=lfs' "$clone/.gitattributes" \
    | sed -E 's/^\*\.([a-z0-9]+).*/\1/' \
    | sort -u
}

check_clone() {
  local clone_url="$1"
  local target="${2:-/tmp/lfs-smoke-clone}"
  rm -rf "$target"
  if ! git clone "$clone_url" "$target" 2>&1 | tail -3; then
    echo "FAIL: git clone $clone_url" >&2
    return 2
  fi

  local lfs_count disk_count
  lfs_count=$(cd "$target" && git lfs ls-files 2>/dev/null | wc -l | tr -d ' ')

  # Build a single -name clause from .gitattributes
  local exts name_args
  exts=$(lfs_extensions "$target")
  name_args=$(printf -- ' -o -name *.%s' $exts | sed 's/^ -o //')
  # shellcheck disable=SC2086  # word-splitting is intentional for find
  disk_count=$(cd "$target" && find . -type f \( $name_args \) -size +1k 2>/dev/null | wc -l | tr -d ' ')

  if [[ "$lfs_count" -ne "$disk_count" ]]; then
    echo "FAIL: LFS-tracked files ($lfs_count) != binary files on disk ($disk_count)" >&2
    echo "      Extensions tracked: $exts" >&2
    echo "      This is the '820 files modified' symptom — LFS pointer in index, binary in working dir" >&2
    return 2
  fi
  echo "PASS: $clone_url — lfs_count=$lfs_count disk_count=$disk_count match"
  return 0
}

# ── Smudge guard (the 404 on object-fetch symptom) ───────────────

check_smudge() {
  local clone="$1"
  local relpath="$2"
  local abs="$clone/$relpath"
  local size_before size_after
  size_before=$(stat -f '%z' "$abs" 2>/dev/null || stat -c '%s' "$abs" 2>/dev/null)

  # Force re-smudge by removing the file and asking git to re-checkout
  rm -f "$abs"
  if ! ( cd "$clone" && git checkout -- "$relpath" 2>&1 | tail -3 ); then
    echo "FAIL: git checkout -- $relpath (smudge filter failed)" >&2
    echo "      This is the [404] Not Found symptom: object not in LFS storage" >&2
    echo "      Recovery: check /data/git/lfs on the host (or re-push from a clone with objects)" >&2
    return 3
  fi

  size_after=$(stat -f '%z' "$abs" 2>/dev/null || stat -c '%s' "$abs" 2>/dev/null)

  # A successful smudge turns a 130-byte pointer into the real binary (>>130).
  # If size_after is around 130 bytes, smudge didn't actually materialize.
  if [[ "$size_after" -lt 200 ]]; then
    echo "FAIL: smudge produced $size_after bytes (expected >>130 for a binary)" >&2
    echo "      Pointer was not expanded — LFS object likely missing in storage" >&2
    return 3
  fi

  if [[ "$size_before" -gt 200 ]]; then
    # Working dir already had a binary from a prior skip-smudge clone — pass through
    echo "PASS: $relpath — size=$size_after (was $size_before before, smudge verified)"
  else
    echo "PASS: $relpath — size=$size_after (smudge verified, materialized from pointer)"
  fi
  return 0
}

# ── Dispatcher ────────────────────────────────────────────────────

case "$cmd" in
  endpoint)
    check_endpoint "${2:?usage: endpoint <repo.git endpoint url>}"
    ;;
  clone)
    check_clone "${2:?usage: clone <clone url> [target dir]}" "${3:-/tmp/lfs-smoke-clone}"
    ;;
  smudge)
    check_smudge "${2:?usage: smudge <clone dir> <path inside clone>}" "${3:?usage: smudge <clone dir> <path>}"
    ;;
  all)
    endpoint="${2:?usage: all <clone url>}"
    target="${3:-/tmp/lfs-smoke-clone}"
    check_endpoint "${endpoint%.git}" || exit 1
    check_clone "$endpoint" "$target" || exit 2
    # Find one LFS file for the smudge check
    relpath=$(cd "$target" && git lfs ls-files 2>/dev/null | head -1 | awk '{print $NF}')
    if [[ -z "$relpath" ]]; then
      echo "SKIP: smudge check (no LFS files found in clone)"
      exit 0
    fi
    check_smudge "$target" "$relpath" || exit 3
    echo "ALL PASS: $endpoint"
    ;;
  *)
    echo "Unknown command: $cmd" >&2
    exit 64
    ;;
esac