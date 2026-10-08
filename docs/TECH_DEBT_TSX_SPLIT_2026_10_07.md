# Tech debt: split TSX files over 200 lines (2026-10-07)

**Ask (operator):** first "src files > 400 LOC", then narrowed to "for tsx files let's break down any over 200 LOC".
**Where:** `lq-core` (75 files) and `learn-quest/books-platform` (8 files). Other repos checked: `lq-tools`, `lq-operations`,
`lq-nordic` have no TSX over 200 lines. `school-quest` and `lang-quest` are not separate git checkouts here.
**How:** isolated git worktree `/Volumes/SSD/Projects/Repos/.lqc-split-wt` (branch `chore/split-large-tsx`, from `origin/main`
`3da2b199`), **no commits, no push**. The checked-out `lq-core` branch (`chore/shadow-sweep`) was not touched.

## Method (decisions and why)

| Choice | Reason |
|---|---|
| Worktree, not the live checkout | lq-core is a shared library consumed by many apps; the checked-out branch is other work. A worktree is disposable and reversible. |
| **Pure extraction only**: same markup, exports, import paths, hook order | A refactor that also "improves" things cannot be verified mechanically; this one can. |
| **Characterization first** for files without tests | `routes.tsx` had no tests. I captured its route table (paths, parents, components, loaders, guards) before editing and required the dump to be byte-identical afterwards. |
| Per-package verification, and a **before/after count**, not "it passes" | The checkout has 266 pre-existing type errors and a failing DTS build on pristine `main`; "typecheck passes" is not achievable, "no new errors" is. |
| Mechanical splitter for declaration-level moves | `scratchpad/split-module.mjs` slices exact source text by top-level declaration (no retyping), adds `export` only where another new file needs it, copies only the imports each file uses, detects JSX for the file extension. It found and fixed three of its own bugs (type imports, JSX extension, property names miscounted as import uses). |
| Parallel agents, one per package group | Disjoint packages mean disjoint edits and test runs. Agents may not commit, stash, checkout, or run repo-wide commands. |

Setup cost to know about: a fresh lq-core worktree needs `pnpm install` (1m40s) and a build of the workspace libraries
(about 9 minutes) before any test or typecheck can resolve `@learnquest/*` packages, because their `main` points at `dist/`.

## Done: `libs/common/app-shell/src/router/routes.tsx`

1,457 lines, no tests, one file holding 42 TanStack routes. Now `router/routes/` with 12 files, the largest 195 lines:
`context.ts` (116) `root.tsx` (13) `locale.tsx` (185) `chapters.tsx` (135) `lessons.tsx` (195) `shell.tsx` (173)
`onboarding.tsx` (169) `household-guard.tsx` (52) `household-profile.tsx` (159) `household-goals.tsx` (146) `kid.tsx` (51)
`tree.ts` (85) and `index.ts` re-exporting the same four names (`RouteContext`, `rootRoute`, `baseRouteTree`, `routeTree`).
`factory.ts` still imports `./routes` unchanged.

| Check | Result |
|---|---|
| Route table before vs after | **identical**: 42 routes, same paths, parents, component names, loader and guard presence |
| Package tests | 29 files / 180 tests passing before; **30 files / 183 passing after** (3 new) |
| Type errors (`tsc --noEmit`) | **266 on pristine `main`, 266 with the change**; none under `src/router` |
| ESLint on the new files | 0 errors, 3 warnings, **the same 3 the original file had** (verified by linting the original from git) |
| JS build (CJS and ESM) | succeeds before and after; the DTS step fails on pristine `main` too (pre-existing) |

Left in place: `router/routes.test.ts`, a permanent test pinning the route table (the file had none). It documents one
oddity found on the way: `baseRouteTree` and `routeTree` have the same children, because `addChildren` mutates the shared
root route, so `baseRouteTree` is not really "the base" tree. Not changed; noted for whoever owns the router.

## Results: every TSX file over 200 lines in lq-core is now at or under 200

**75 files over 200 lines before, 0 after** (re-checked by me over the whole worktree, tests/stories/generated excluded).
Delivered by `routes.tsx` (done by hand, above) and nine parallel agents over disjoint packages, in two waves, plus a follow-up round
where I sent three agents back because a file was still over the limit (`CardPrintStudio` 412 -> 171, `HouseholdSettingsScreen`
203 -> 190, `BalanceAdjustmentScreen` 216 -> 198) and one extra agent for four stragglers earlier agents had skipped as "only a few
lines over". Nothing is committed or staged.

| Group (package) | Files split | Largest before -> after | Tests (agent-reported, before -> after) | Type errors | DOM equality |
|---|---:|---|---|---|---|
| app-shell `routes.tsx` (me) | 1 | 1,457 -> 12 files <= 195 | 180 -> 183 | 266 -> 266 | route table identical |
| print-cards | 4 | CardPrintStudio 1,081 -> 171 | 606/607 -> 609/609 | 0 -> 0 | 182 snapshots identical |
| common/ui | 6 | BookCard 380 -> 38, BookCatalog 435 -> 159 | 161 -> 168 | 0 -> 0 | 43 snapshots identical |
| household, household-goals | 7 | HouseholdSettings 438 -> 190 | 101 -> 101 / 68 -> 68 | 2 -> 2 | identical |
| lesson-types, lesson-framework | 3 | LessonMockProvider 539 -> 69 | 709 -> 709 / 215 -> 218 | 0 -> 0 | identical |
| apps/web | 8 | AudienceSelection 296 -> 110 | 1651 -> 1656 passing | 0 -> 0 | 8/8 identical |
| lesson-ui (school) | 6 | QuestionActivityRenderer 325 -> 71 | 48 -> 62 | 0 -> 0 | 134 snapshots identical |
| challenges, groups, social, dashboard, auth | 10 | MultiplayerLobby 259 -> 170 | unchanged (+5 new) | no baseline in 3 of 5 | 16 of 18 byte-identical, 2 identical after normalising a clock |
| admin, admin-analytics, admin-shared | 8 | BookModeration 319 -> 118 | 559 -> 563 / 261 / 16 | no usable baseline | 7/7 identical |
| interactive, app-shell, web-app | 7 | DragDropSortable 271 -> 167 | all passing | web-app 584 -> 586 (see below) | 5 identical; createApp and lesson-map by characterization tests |
| profile, onboarding, game-features, review | 12 | CityDecoration 264 -> 52 | profile 410 -> 418 etc. | game-features 181 -> 181 | identical |
| stragglers (2 decorators, VideoLesson, AnnotatedWord) | 4 | VideoLessonScreen 205 -> 188, decorators 210/208 -> 136/90 | unchanged | 0 -> 0 | 6 captures identical |

**What I verified myself**, not just read from reports: containment (every change is under the expected packages), the TSX-over-200 count
(0), the `routes.tsx` route table, and a combined lint-and-test pass at the end (results below).

**Combined verification pass (mine, after all agents finished):** ESLint over all **283** changed or new TS/TSX files: **0 errors**,
37 warnings (all pre-existing ones that moved line numbers, per the agents' before/after comparisons). A fresh `vitest run` in each of
the 22 touched packages matched the agent-reported counts exactly (app-shell 183, print-cards 609, common/ui 168, interactive 42,
lesson-types 709, lesson-framework 218, lesson-ui 62, household-goals 68, challenges 455, groups 258, social 276, dashboard 64, auth 31,
admin-analytics 261, admin-shared 16, onboarding 145, web-app 81, review 35); the packages with failures show the **same** failures the
agents recorded before editing (game-features 2, household 3, admin 3, profile 6). One count differed by one between two runs
(lesson-framework 218 passed in mine, 217 + 1 failing in the straggler agent's), consistent with a flaky test.

**Where the evidence is weaker, honestly:**
- **Type-checking.** The checkout has hundreds of pre-existing type errors (266 in app-shell alone, 584 in web-app) and several packages
  have no `tsconfig.json`, so `tsc` there prints nothing. "Not worse than before" is all that can be shown; for admin, admin-analytics,
  challenges, groups and social there is no clean before-count. web-app went 584 -> 586: the two new files hit the same
  "no declaration file for @learnquest/app-shell" error the original already had.
- **Flaky tests.** Several packages have tests that fail under load or fail identically before and after (profile 6, onboarding 1,
  game-features 2, admin 3, web 6, household 3 flaky). Agents compared before vs after and re-ran in isolation; I did not re-triage them.
- **DOM equality** is the strongest check used and holds everywhere it was applied, but two components (createApp, lesson-map) are
  composition code verified by characterization tests instead, and one test file was normalised for a wall-clock "N minutes ago".
- A few smoke tests were added where a component had none (about 25 `*.render.test.tsx`); these protect the split, not the behaviour.

## New files and structure

Convention used everywhere: the original file keeps its path and every export; extracted pieces sit beside it in a folder or as
`<Name>.<part>.tsx` (e.g. `useStudioState.ts`, `ShapeControls.tsx`, `*.mocks.ts`); anything that moved and was exported is re-exported
from the original. Duplicated storybook decorators (byte-identical in at least 7 packages) were each split the same way into a
`.mocks.ts`; de-duplicating them into one shared package is a separate, worthwhile change nobody was asked to make.

## Observations from the agents (not verified by me, not changed)

These are things the agents noticed while reading, and left alone per the pure-extraction rule: `BookCatalog`'s `useMemo` omits
`showFavoritesOnly` from its dependencies (the favourites filter may not recompute); `useMountEvent('SettingsScreen', loading! &&
!!player)` looks like a typo for `!loading && ...`; profile `Background` drops `testId`; `HouseholdSettingsScreen` shows a raw
`playerId` as a member name; `ToolWalkthrough.currentStep` is never advanced; `SyncStatusPanel` has hard-coded English; several
existing tests mock import paths that no longer match the code (so the mocks do nothing); `AudienceSelectionScreen` exists twice
(lib and app) as near-twins; the sound-pattern "pairs render blank" bug (lq-nordic #77) was deliberately left untouched.

## Not done

- **`learn-quest/books-platform`: 8 TSX files over 200 lines** (largest `BookEditorScreen` 390, `SceneEditorScreen` 350). Separate repo and
  currently under audit with live dev servers, so it needs its own worktree; not started.
- **Non-TSX files over 400 lines** (the first form of the request): lq-core `PostgresAdapter.ts` 718, `schema.ts` 710, `dice.ts` 966,
  `board.ts` 632, `providers.ts` 622 and others; lq-tools 9 files. Out of scope after the request narrowed to TSX.
- Deciding what to do with the worktree: it holds all changes uncommitted on branch `chore/split-large-tsx`. A reviewable PR would
  need splitting into per-package commits (about 20), and lq-core's merge path is forge-git (`fgit`), not GitHub.

## Update: local checkpoint and publish behaviour (operator-approved, 2026-10-07)

- **Local checkpoint commit** on `chore/split-large-tsx`: `6c41594d`, 284 files (16,515 insertions, 11,950 deletions), **not pushed**. Message
  states it is a checkpoint, not a unit for merge.
- **Publish dry run** (`scripts/publish-changed.ts --dry-run`) lists **28 packages** that the publish job would try to publish (the changed
  packages plus their dependents; e.g. `@learnquest/sql-content-source`, `unit-core` and `screen-admin-design` were not edited by me).
  **No version bump is needed**: `publishPackage` treats `already exists`, `Cannot publish over`, E409 and `409 Conflict` as success
  ("Already published, skipping"), so a refactor-only merge publishes nothing new and fails nothing. Consequence: the split code reaches
  the registry only with the next real version bump of each package, which is acceptable because the rendered output is identical.
  The dry run does not contact the registry, so this rests on reading the script, not on a live publish.
- CI (`.gitea/workflows/ci.yml`) runs a full install and test on every PR, which is why the plan is ~8 layered PRs, not 23.
