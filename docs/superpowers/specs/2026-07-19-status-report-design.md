# Status Report — learn-quest / lq-core / nordic / romance

**Date:** 2026-07-19
**Author:** Claude Code
**Status:** Draft
**Scope:** Read-only investigation; one side-effect permitted (lq-core unit tests only)

## Context

The user wants a comprehensive status of four parallel tracks that have been moving simultaneously in the learn-quest monorepo, plus recommendations for next steps:

1. **lq-core migration** — what has been moved from `apps/web/src` (legacy) into `libs/common/{ui,app-shell}` (new package-based structure), and what is still hanging in legacy.
2. **lq-nordic content** — chapters/scenes/assets for Danish (Viking saga exists), Icelandic, Norwegian, Swedish.
3. **lq-romance content** — chapters/scenes/assets for French, Italian, Spanish (Ch3 shipped per Phase 5), Portuguese, Romanian.
4. **lq-core tests** — pass/fail of unit tests, identified flakes, untested modules.

The user explicitly anchored on the **LanguageSelector → QuestTopBar** question: did we finish moving legacy `apps/web/src/components/{shell/navigation/header/top-bar, common/localization}` into `libs/common/app-shell/src/topbar`, or is the migration still mid-flight? That anchor grounds the broader migration question.

The user explicitly forbade code modifications; this is an audit + recommendation report.

## Approach: Migration-first

Start with the LanguageSelector→QuestTopBar migration question because it is the user's most concrete concern. Tracing that story pulls in the broader apps/web/src → libs/common migration state — once we know which TopBar file is "the" TopBar, we know which localization components migrated and which didn't. Then expand outward to:

1. **lq-core migration audit** (anchor + sweep)
2. **lq-nordic + lq-romance content status** (per-language inventory)
3. **lq-core unit tests** (run `pnpm test` on lq-core; report)
4. **Recommendations** (synthesize from the three investigations)

## Report Output

**Path:** `learn-quest/docs/audit/2026-07-19-status-report.md`

**Structure:**
- **Executive summary** — TL;DR per track, prioritized recommendations, what to do this week
- **Track 1: lq-core migration** — anchor on TopBar/LanguageSelector/QuestTopBar story, expand to full inventory of apps/web/src → libs/common state. Tables for: migrated components (with new path), still-legacy components (with path), orphaned/duplicated components.
- **Track 2: lq-nordic + lq-romance content** — per-language table (chapters, scenes, assets, test status, last deploy). Identify which languages are at parity and which need work.
- **Track 3: lq-core tests** — what was run, pass rate, top failures (if any), known flaky tests, coverage gaps.
- **Recommendations** — prioritized list (P0/P1/P2) with problem, impact, effort, risk for each.

**Depth:** ~30-50 pages — executive summary per track (1-2 paragraphs) + deep-dive bullets/tables. Not file-by-file inventory; not one-liner-per-track.

## Side Effect Permitted

- `pnpm test` from `lq-core/` root → unit tests only
- DO NOT run E2E (`pnpm test:screens`, `pnpm test:e2e`)
- DO NOT run screen audits
- DO NOT modify any code

If unit tests fail with OOM or other environmental issues, fall back to reading last test reports from `lq-core/test-reports/` or `lq-core/test-results/`.

## Investigation Plan

### Phase A — Migration anchor (concrete user question)
1. Read all files under `lq-core/libs/common/app-shell/src/topbar/` (NEW)
2. Read all files under `lq-core/apps/web/src/components/shell/navigation/header/top-bar/` (LEGACY)
3. Read all files under `lq-core/apps/web/src/components/common/localization/` (LEGACY LanguageSelector etc)
4. Search for all importers of each to determine which path "the" TopBar resolves to at runtime
5. Cross-check package.json deps in lang-quest apps to see which they consume

### Phase B — Migration sweep (broader)
1. Inventory `lq-core/libs/common/{ui,app-shell}` for components
2. Inventory `lq-core/apps/web/src/components/` for components not yet migrated
3. Identify which screen packages (`lq-core/libs/screens/`) consume migrated vs legacy components
4. Note orphaned files (legacy files with no importers)

### Phase C — Content audit (nordic + romance)
1. For each language in `lang-quest/lq-nordic/languages/{da,is,no,sv}` and `lang-quest/lq-romance/languages/{fr,it,es,pt,ro}`:
   - Count chapters and scenes
   - Check `content/` for assets, briefs, scripts
   - Check `screen-audit/` for last run
   - Check `tests/` for test files
   - Check `package.json` scripts (deploy, audit, test)
2. Cross-reference with Phase 5 memory: which had Ch3 shipped (da, fr, it, es)
3. Cross-reference with Viking saga memory: da_viking is 3ch/24 scenes

### Phase D — Test run
1. Run `cd lq-core && pnpm test` (unit tests only per memory's test harness conventions)
2. If OOM or full-suite too slow, fall back to `pnpm test:libs` or `pnpm test:packages:list` for inventory
3. Capture pass/fail counts, top failures, timing

### Phase E — Synthesis
1. Write recommendations section based on findings
2. Prioritize: P0 (blockers), P1 (next session), P2 (backlog)
3. Identify which of the user's original asks (continue nordic/romance, finish migration, etc.) is highest-leverage given current state

## Out of Scope (explicitly)

- Building new content for nordic/romance
- Running E2E tests or screen audits
- Modifying any code
- Books-platform audit (different repo, not in user's brief)
- lingua-quest narrative engine review (different repo, mentioned in memory but not in user's brief)
- lq-tools, lq-operations, lq-site, school-quest, life-quest audit (not in user's brief)

## Success Criteria

The report enables the user to:
- Know exactly what the LanguageSelector → QuestTopBar migration state is (yes/no/partial, and why)
- Know which nordic/romance languages are at parity and which need work, with concrete file counts
- Know lq-core unit test pass rate and top issues without re-running anything
- Pick what to work on next from prioritized recommendations
