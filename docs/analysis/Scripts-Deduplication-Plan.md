# Scripts ↔ libs/tools Deduplication Analysis

> Analysis date: 2026-04-10

## Problem

`apps/web/scripts/` and `libs/tools/` contain **1,713 byte-identical files**. The two trees are fully independent copies with zero cross-references. This is ~70K lines of pure duplication.

## File Counts

| Location | Total Files | Unique Files | Duplicated Files |
|----------|-------------|--------------|-----------------|
| `apps/web/scripts/` | 1,895 | 182 | 1,713 |
| `libs/tools/` | 1,783 | 58 + infra | 1,713 |

## Directory-Level Mapping

### Fully Duplicated (1,666 files — byte-identical)

| `apps/web/scripts/` | `libs/tools/` package | Files | Status |
|---------------------|----------------------|-------|--------|
| `app-builder/` | `app-builder/src/` | 244 | 100% identical |
| `assets/` | `assets/src/` | 1,204 | 100% identical |
| `book-builder/` | `book-builder/src/` | 19 | 100% identical |
| `content/` | `content/src/` | 106 | 100% identical |
| `shared/` | `shared/src/` | 93 | 100% identical |

### Duplicated with rename (47 files — byte-identical)

| `apps/web/scripts/` | `libs/tools/` package | Files | Notes |
|---------------------|----------------------|-------|-------|
| `localization/` | `i18n/src/` | 47 | Directory renamed, content identical |

### Only in `apps/web/scripts/` (182 files — not yet extracted)

| Directory | Files | Description |
|-----------|-------|-------------|
| `validation/` | 47 | Schema validation for game entities (lessons, chapters, bosses) |
| `testing/` | 39 | Test coverage analysis, health checks, perf benchmarks |
| `tools/` | 20 | Admin tools, auditors, health scan, mobile icons, stripe, task monitor |
| `utils/` | 18 | Dependency analysis, image optimization, JSON utilities, mock helpers |
| `deploy/` | 14 | Deployment scripts, Lighthouse audits, pre-deploy checks, smoke tests |
| `e2e/` | 13 | E2E test runner, analyzers, emulator scripts |
| `build/` | 9 | Lint analysis, convention enforcement, barrel generation, import fixers |
| `screen-capture/` | 9 | Screenshot capture tooling |
| `dev/` | 8 | Emulator management, debug tools, seed data, dev log server |
| `stripe/` | 1 | Marketplace test script |
| Root files | 4 | README.md, DESIGN-PROPOSAL.md, catalog.ts, consolidate-lessons.cjs |

### Only in `libs/tools/` (58 source files — new packages)

| Package | Files | Description |
|---------|-------|-------------|
| `test-reporter/` | ~38 | Test reporter with FS/Redis transports |
| `test-agent/` | 12 | Test agent with batch runner, dashboard, progress tracking |
| `test-utils/` | 7 | Shared test setup and mock utilities |
| `assets/cli/asset-cli.ts` | 1 | CLI entry point for assets |

## Dedup Execution Plan

### Phase 1: Delete duplicated scripts (immediate)

For the 6 fully-duplicated directories, `libs/tools/` is the canonical copy (properly packaged with `package.json`, `tsconfig.json`, `src/` convention).

1. Delete `apps/web/scripts/app-builder/` — use `@learnquest/app-builder` from libs/tools
2. Delete `apps/web/scripts/assets/` — use `@learnquest/assets` from libs/tools
3. Delete `apps/web/scripts/book-builder/` — use `@learnquest/book-builder` from libs/tools
4. Delete `apps/web/scripts/content/` — use `@learnquest/content` from libs/tools
5. Delete `apps/web/scripts/shared/` — use `@learnquest/shared` from libs/tools
6. Delete `apps/web/scripts/localization/` — use `@learnquest/i18n` from libs/tools

If any script entry points in `apps/web/package.json` reference these paths, update them to import from the libs/tools packages instead.

### Phase 2: Extract remaining scripts to libs/tools (later)

The 182 files only in `apps/web/scripts/` are candidates for future extraction to `libs/tools/` packages:

| Priority | Directory | Rationale |
|----------|-----------|-----------|
| High | `validation/` (47 files) | Reusable across projects; schema validation is infrastructure |
| High | `testing/` (39 files) | Complements existing test-reporter/test-agent in libs/tools |
| Medium | `deploy/` (14 files) | Could be shared with lq-site and books-platform |
| Medium | `e2e/` (13 files) | Pairs with existing e2e-agent from blueforge |
| Low | `tools/`, `utils/`, `build/` | Mostly one-off admin scripts |
| Low | `dev/`, `screen-capture/`, `stripe/` | Dev-only, project-specific |

### Phase 3: Wire up CLI entry points

After Phase 1, `apps/web/package.json` scripts that currently run `tsx scripts/content/...` need to change to either:
- `tsx ../libs/tools/content/src/...` (direct path)
- Or add CLI bin entries to the libs/tools packages and run via package scripts

## Impact

- **Phase 1 removes ~1,713 files (~70K lines)** of byte-identical duplication
- No functionality lost — libs/tools is the packaged equivalent
- Eliminates drift risk between the two copies
