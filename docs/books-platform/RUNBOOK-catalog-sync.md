# Operator runbook — Catalog sync after content changes

When on-disk manifests change, the storefront doesn't see the new
data until both the manifest upload AND the catalog projection have
run against `books-api`. This runbook covers the second half.

## When to run this

Anytime `manifest.json` is edited for a book — `estimatedHours`
revisions, a new book added, cover retitled, etc. The most common
case in 2026-09 has been the content-length audit
(`books-platform/scripts/content/fix-estimated-hours.ts --write`)
which re-derives `estimatedHours` from real prose. The current
state: **2 books were fixed locally** (`the-dragons-ally`,
`the-enchanted-library` per
`books-platform/scripts/content/_full-length-audit.ts`) but **the
storefront still shows the old `estimatedHours`** for those two.

## What this runbook does

Calls `POST /api/admin/catalog` for each book type with the live
manifest table contents. The endpoint projects every entry onto a
`publishing.books` row — it is idempotent and will not re-price or
un-publish an existing row.

The other half (`POST /api/admin/manifest` for the manifest upload)
runs upstream of this and is a different script
(`scripts/ops/sync-manifests-and-catalog.py`). For content-length-only
fixes where the on-disk manifest is already in place, just the
catalog sync is needed.

## Where it must run

`forge-app-2` (Hetzner box 178.104.130.80). The script reads
`INTERNAL_API_KEY` from `/opt/books-platform/books-api.env` which is
not visible from a developer machine (the key is intentionally not
in the `forge env list books-platform` vault project — see
`books-platform/CLAUDE.md` "Catalog sync" section).

SSH credentials for forge-app-2 are operator-only; this runbook
assumes the operator has them.

## Steps

```bash
# 1. SSH in
ssh forge-app-2  # or use the operator's preferred method

# 2. Run DRY-RUN first (no writes)
cd /opt/books-platform
bash scripts/ops/sync-catalog.sh

# Expected output: a per-type estimate of what would change.
# If a book shows "would update: estimatedHours X → Y", the
# content-length fix for that book is correct and ready to ship.

# 3. If dry-run output looks right, APPLY
bash scripts/ops/sync-catalog.sh --apply

# Expected output: same per-type estimates, plus a commit line per
# row. Re-running this script with no manifest changes should be a
# no-op (idempotent — existing rows refresh without re-pricing).

# 4. Verify on the storefront
# Browse to https://questbooks.blueforge.studio/books/<bookId>
# and confirm the displayed estimatedHours matches the manifest.
```

## Specific verification for the 2026-09-15 content-length fix

```bash
# After the --apply step, the storefront for these two books should
# reflect the corrected estimatedHours:

# - the-dragons-ally: was over-claiming (~5 min above measured)
# - the-enchanted-library: was over-claiming (~30 min above measured)

# (Confirm the exact corrected values by re-running
# books-platform/scripts/content/_full-length-audit.ts after sync.)
```

## Why the two-endpoint dance exists

The catalog is a **derived projection** from the manifest, not a
primary store (full reasoning in `books-platform/CLAUDE.md`).
A naive "manifest changed → catalog row changes" pipeline would
either:
- regress pricing decisions made during launch,
- or require tracking which manifest field belongs to which
  pricing decision (unmaintainable).

The split (`POST /api/admin/manifest` for the raw store,
`POST /api/admin/catalog` for the projection) lets editorial changes
land on the storefront without a code deploy, and lets pricing
decisions stay pinned in `publishing.books` once made. Idempotency
on the catalog endpoint means operators can re-run as many times as
they need without unintended side effects.

## If something goes wrong

- **`401 Unauthorized`** — `INTERNAL_API_KEY` from `books-api.env`
  doesn't match what books-api loaded. Check the books-api container
  logs for the configured key (any healthcheck endpoint will leak the
  presence of the key but not the value).
- **`502 Bad Gateway`** — books-api container is down. Diagnose via
  `cd /opt/books-platform && docker compose -f books-api.docker-compose.yml -f books-api.override.yml ps`. The override-compose trap
  from the books-platform CLAUDE.md "Deploying" section applies.
- **A book shows the wrong price after sync** — the catalog endpoint
  doesn't touch pricing; if pricing moved, something else wrote that
  row. Check `apps/books-api/src/routes/admin/catalog.ts` for the
  projection logic.
- **"Missing book X" in the dry-run** — the manifest endpoint hasn't
  been called for that book yet. Run
  `scripts/ops/sync-manifests-and-catalog.py` (or the equivalent
  manifest upload) first.

## Related runbooks

- `RUNBOOK-stripe-activation.md` — for checkout/entitlement setup,
  independent of catalog.
- `RUNBOOK-image-regen.md` — for re-generating any missing book
  imagery after a content change.
