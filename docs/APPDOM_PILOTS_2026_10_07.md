# App DOM in lq-core: investigation and three pilots (2026-10-07)

Question: can the blueforge-org `dom/` packages and `data-appdom-*` attributes carry lq-core's e2e tests,
user audits and screen audits? Short answer: yes for all three, but lq-core's `apps/web` had **zero**
instrumented elements (only app-shell's `TopBarContainer`/`AvatarDropdown`, 5 attributes, used by the lang apps).

## What exists
- `data-appdom-{id,type,role,scope,label,track}` family; `app-dom` (instrument/query/snapshot, `app-dom check` CLI),
  `dom-overlay-core` (parser/overlay), `dom-instrument` (fills screen-audit `AuditResult.domTree`).
- lq-core: 4,130 `data-testid`, 5 `data-appdom-*`. `apps/web` renders its own copy of the top bar
  (`components/shell/navigation/header/top-bar/components/TopBarContainer.tsx`), not app-shell's.
- `app-dom check` on `apps/web`: `0/14 pages instrumented`; the "pages" it finds are `*Routes.tsx` lazy wrappers, so the
  gate cannot see the real screens in `libs/screens/*`.

## Pilots (branch `feat/appdom-pilots` in lq-core, local, worktree `.lqc-e2e-wt`)
1. **e2e**: `apps/web/src/e2e/support/appdom.ts` (`appdomSnapshot`, `uiInventory`) + `navigation/appdom.mock.spec.ts`.
   Instruments the web top bar and avatar (`quest-topbar` Header, `quest-avatar-menu` IconButton, scope `header`, same ids as
   app-shell). Spec asserts id/type/scope and unique ids. Passes on chromium-mock.
2. **user audit**: `navigation/appdom-inventory.mock.spec.ts` writes `test-results/appdom-inventory.json`;
   `tools/user-audit-spike/appdom-observe.mjs` (+4 tests) scores an *observability* dimension (interactive coverage,
   main-scope presence, duplicate ids; null when nothing measured). Baseline for apps/web: **14/100**
   (2 instrumented nodes; 9-12 interactive elements per route, 2 inside one; no `main` scope).
3. **screen audit**: `navigation/appdom-domtree.mock.spec.ts` runs the `dom-instrument` collector screen-audit uses.
   Finding: the node id picks up `data-appdom-id`, but `data-appdom-type` (`IconButton` became `Button`) and
   `data-appdom-scope` were dropped, so scope filters could not be fed from a domTree.
   Fix (blueforge-org branch `feat/dom-instrument-appdom-attrs`, local, worktree `.bfo-domi-wt`): dom-instrument 0.1.3 adds
   optional `appdomType`, `scope`, `label`, `track`, `testId`; 3 new tests; README section on id-resolution order.

## Findings worth acting on
- **Coverage is the bottleneck, not tooling.** Next: put `data-appdom-scope="main"` + ids on the lesson card, answer
  options and Continue button (lesson-ui), then re-score. A cheap lint: fail when a screen has interactive elements outside any appdom node.
- **README was wrong** about app-dom's id order (fixed). dom-instrument's order differs (no `data-app-id`, legacy `data-appdom`, `data-test*`, `data-cy`).
- **`app-dom check` needs a page-glob option** for apps whose screens live in other packages (not done).
- Pilots use the lq-core mock backend; the lang apps (QuestShell) already carry the app-shell attributes and are where a
  golden-flow screen-audit flow (`[data-appdom-id=...]` selectors) can run; lq-nordic has a peer worktree
  (`appdom-wiring`, `app-dom check` CI gate) doing related wiring - coordinate before touching it.
- **e2e-agent 0.2.0 upgrade** (branch `chore/e2e-agent-0.2`): deps bumped, 28 broken `e2e*` scripts repointed to `e2e-runner`
  (they referenced a deleted `libs/tools/e2e-runner`); `e2e.config.js` accepted unchanged. Bug found: resume keys omit the
  Playwright project, so 3 projects collide on one key (reported to bevy).

## Follow-ups done (2026-10-07, later)

- **`app-dom check --pages/--exclude` (app-dom 0.4.6)** — commit `50794206` on blueforge-org `feat/dom-instrument-appdom-attrs` (local, not pushed to #251). Explicit globs replace the route heuristic; on lq-core `--pages 'libs/screens/*/src/**/*Screen.tsx' --pages 'apps/web/src/**/*Screen.tsx'` measures 128 real screens (0 instrumented today) instead of 21 `*Routes.tsx`/`index.html` files. 27 tests pass.
- **lesson-ui main scope** — lq-core branch `feat/lesson-ui-appdom` (worktree `.lqc-pr2-wt`, stacked on `refactor/split-tsx-lang` / PR #144, local): `lesson-shell` (Screen, main), `lesson-header`, `lesson-back`, `options-<q>` / `option-<q>-<n>`, `lesson-prev`, `lesson-next`. Package suite 66 pass incl. 4 contract tests. lesson-ui PR: lq-core #153 (stacked on #144).
- **lesson-framework main scope** (lang lessons) — lq-core branch `feat/lesson-framework-appdom` (worktree `.lqc-pr4-wt`, stacked on `refactor/split-tsx-lesson-ui` / PR #146, local): `lesson-layout` (Screen, main), `lesson-progress`, `lesson-close` (IconButton, header), `lesson-hint`, `answer-<prefix>-<n>` (AnswerOption), `lesson-navigation` (NavBar) with `lesson-prev` / `lesson-next` / `lesson-complete` (wrapper divs — `NextButton`/`PreviousButton` in common/ui don't forward props; a prop passthrough there would be the cleaner fix but touches #145's package), `lesson-intro-modal` (+`-close`, scope modal). Package suite 223 pass incl. 5 contract tests.
- **Next:** golden-flow screen-audit on a lang app using these anchors (coordinate with peer worktree `lq-nordic.worktrees/appdom-wiring`); then re-run `app-dom check --pages` as a ratchet.

## Golden-flow attempt (lq-core apps/web) — blocked, and why

Wrote a golden-flow spec (open a lesson, step with `lesson-next` / `lesson-complete` anchors, record an app-dom inventory per step). It cannot pass in lq-core `apps/web`:
- The map-click entry is broken on main: the existing `lesson-flow.mock.spec.ts` fails identically on a main-based checkout (no `level-node-*` on the map).
- Going straight to `/lessons/conversation/conversation-greetings` renders only a placeholder (`Lesson / Type: conversation | Lesson: …`): apps/web is a dev/test shell that does not mount the real lesson screens, which live in the per-language apps.

So the golden flow has to run on a real lang app (lq-nordic etc.). Those consume **published** `@learnquest/lesson-framework@^0.1.5` / `lesson-ui`, so the new anchors only appear after a publish of both (needs the user's approval; CI `publish-changed` handles it after #146/#154 and #144/#153 merge). The lq-nordic peer already landed W1 landing instrumentation (#54) and the `app-dom check` gate. Spec kept in the session scratchpad, not committed.

## Golden flow on lq-nordic (vocab-basic-phrases) — works, with three publish/coverage gaps

Probe: `tools/user-audit-spike/appdom-golden.mjs <lessonId>` (walks `/en/danish/chapters/chapter-1/<id>` driving ONLY `lesson-next` / `lesson-complete` anchors, records an inventory per step → `example-appdom-golden.vocab-basic-phrases.json`) and `probe-types.mjs` (per-lesson-type anchor counts). Run in the spike worktree `.lqn-useraudit-wt` (uncommitted lockfile/override changes there; lq-nordic itself untouched).

**Result:** with lesson-framework 0.1.6 forced, vocab lessons are driven to completion in 5 anchor-only steps; observability 86 (coverage 0.80 once `app-root` is excluded; with `app-root` counted as a container the same run reads 100 — **a wrapping root makes the coverage metric meaningless; exclude it**).

**Gaps found (in order of effort):**
1. **Publish cascade.** Bumping lesson-framework alone did not reach the app: `@learnquest/lang-lesson-types@0.2.3` pins `lesson-framework@0.1.5` *exactly* (packr resolves `workspace:*` to an exact version), so lq-nordic kept a 0.1.5 copy. Needed: republish `lang-lesson-types` (and any other exact-pinning dependent: unit-core, e2e-core, game-features) so they pin 0.1.6, then lq-nordic bumps. Local proof used a pnpm `overrides` entry.
2. **Concept lessons have no navigation anchors** (0/7 concept lessons): lq-nordic renders them from `@learnquest/web-app`'s bundled concept screen (`concept-intro`), which does not use `LessonNavigation`. Drills expose only 5 nodes. Fix at the web-app/lang-lesson-types screens.
3. **No `lesson-layout`/progress anchors on vocab:** those screens use `app-shell`'s `LessonLayout`, not lesson-framework's. Add the anchors to `app-shell/layouts/LessonLayout`.
