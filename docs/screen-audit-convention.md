# Screen-audit convention

How the `@blueforge-studio/screen-audit` output is laid out per app across the
learn-quest monorepo. Read this once before adding a new audit to an app.

## Why two patterns exist

The monorepo uses **two** accepted output layouts, not one. This is intentional:

| Pattern | Path | Era | Apps using it |
|---|---|---|---|
| `screen-audit/` (canonical) | `<app>/screen-audit/{flows,results}/` | 2026-05+ | lq-site, lang-quest/lq-{14 apps}, school-quest/lq-{6 apps}, life-quest/lq-{9 apps}, lingua-quest/apps/{web,site,quest-editor} |
| `audit-results/` (legacy) | `<app>/audit-results/` | pre-2026-04 | lang-quest/lq-english, books-platform/apps/lq-{adventure-book,book-marketplace,interactive-book}, life-quest/lq-economics (also has `screen-audit/`) |

The legacy pattern predates the canonical one and is kept because those dirs
contain years of audit history that would be expensive to migrate.

**Default for new apps:** use `screen-audit/{flows,results}/`. Only use
`audit-results/` when porting an existing app that already has populated data
in that path.

## What goes where

In both patterns, the same three artifacts exist with the same role:

- **flows** (committed) — the flow definitions (steps, selectors, route map)
- **README.md** (committed) — how to run audits for *this specific app*
- **results/** or `audit-results/` (gitignored) — generated screenshots, reports,
  diffs. Never commit.

`screen-audit/` apps also commonly have:
- `run.mjs` (committed) — entrypoint that the `pnpm audit:screens` script calls
- `flows/<flow-id>.flow.ts` (committed) — per-flow definition file
- inner `.gitignore` ignoring `results/` (defense in depth)

## Per-app setup checklist

When adding a screen-audit to a new app, do these four things in order:

```bash
# 1. Create the directory structure
mkdir -p <app>/screen-audit/flows

# 2. Add a flows/<flow-id>.flow.ts (see lq-site/screen-audit/flows/site-landing.flow.ts
#    or lq-tools/packages/admin-tools/src/screen-audit.ts for the AuditFlow type)

# 3. Add the gitignore entry — pick one of:
echo "screen-audit/results/" >> <app>/.gitignore          # canonical pattern
# OR
echo "audit-results/" >> <app>/.gitignore                  # legacy pattern

# 4. Add pnpm scripts to <app>/package.json
#    "audit:screens":       "node screen-audit/run.mjs"
#    "audit:screens:mobile":"node screen-audit/run.mjs --devices mobile"
```

Then copy `screen-audit/run.mjs` and `screen-audit/README.md` from
[lq-site/screen-audit/](../lq-site/screen-audit/) as a starting point — the
README is the canonical example of "what an app-local audit doc looks like".

## Don't put audit artifacts at the repo root

Audit/screenshot output **never** belongs at the learn-quest root. Past
incidents (2026-06-11) dumped 43 PNG/YAML files at the root, polluting the
project layout. The root `.gitignore` now has defensive entries (`*.png`,
`*-snapshot.yml`, `Dockerfile.*.bak`) and `lq-site/.gitignore` ignores
`audit-screenshots/`. If you find root-level screenshots, move them to
`<owning-app>/audit-screenshots/<YYYY-MM-DD-batch>/` immediately.

## Linter recommendation (future work)

Add a CI check in `lq-tools` to fail builds if:

1. A new `<app>/screen-audit/` dir exists without a matching `.gitignore` entry
   in `<app>/.gitignore` that ignores `screen-audit/results/`
2. A `<app>/audit-results/` dir exists with tracked files (defensive against
   future forget-the-gitignore incidents)
3. Any new `*.png` or `*-snapshot.yml` file lands at the learn-quest root

This catches the original "43 files at root" bug class before it ships.

## Reference implementations

- **Canonical app:** [lq-site/screen-audit/](../lq-site/screen-audit/) — has
  `flows/`, `results/`, README, run.mjs, inner `.gitignore`
- **Canonical script:** [lq-tools/packages/admin-tools/src/screen-audit.ts](../lq-tools/packages/admin-tools/src/screen-audit.ts)
  — the `@blueforge-studio/screen-audit` package wrapper, with full
  `AuditFlow` and `AuditConfig` types
- **App-level runner example:** [lq-site/scripts/screen-audit.ts](../lq-site/scripts/screen-audit.ts)
  — minimal script using `runAudit()` from the package

## Version drift note

The `@blueforge-studio/screen-audit` package is currently split across
versions: lang-quest/lq-nordic, lq-core, and lq-tools are on 0.7.0; most
school-quest and life-quest apps are on 0.3.3; some books-platform and
lingua-quest apps are on 0.4.1. Bump everything to 0.7.x in a separate pass
(out of scope for this convention doc — tracked as a future task).
