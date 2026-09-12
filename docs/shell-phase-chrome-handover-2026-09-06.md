# Shell phase chrome + journey restore — handover (2026-09-06)

Scope: `lq-nordic`, `lq-english`, `lq-romance` and the `lq-core` packages they
wrap through `createApp()` → `QuestShell`. Live screenshots of
nordic.lang-quest.blueforge.studio at desktop/tablet/mobile were the audit
input; local captures of the rebuilt apps at the same viewports were the
verification.

## What the audit found (0.14.1, live)

| Area | Finding |
| --- | --- |
| Top bar on phones | Hidden entirely behind the "Closed alpha" banner (`#lq-release-banner`, static in `index.html`); the bar is `fixed; top:0` and never measured the banner. On desktop the pill's top edge was clipped by it. |
| Game state before a game | `Lv 1` badge + empty XP track on every screen, including the language picker and profile, for visitors with no player. |
| Welcome slides | Every illustration was a broken `<img>`: the onboarding package resolved art to `/assets/…`, a folder no wrapper app serves. The card collapsed, the alt text spilled out, and the gender switch floated over the title. |
| Gender selector | A Radix on/off toggle with "Male … Female" labels outside it: "on = female" is a guess. |
| Onboarding order | Shell ran welcome → **audience** (age tier / theme / history epochs, a school-quest step) → character; state (gender, proficiency) from the slides was dropped; the audience step then sent lang learners through theme selection. |
| Front door | `/` for an onboarded visitor was a modal over a "Welcome back, Learner! Level 1 • 0 XP" dashboard, then the section grid. No "continue where you left off". |
| Lesson map | Chapter header overlapped the top bar (it positions from game-state's `layoutStore.topBarHeight`, which nothing set); `v0.0.0` badge (`__APP_VERSION__` undefined in wrapper builds); the map always showed chapter 1 regardless of route. |
| Player persistence | Character creation set the player in memory only; one reload and level, avatar and progress were gone. |
| Copy | Profile guest message rendered the placeholder "Create Account Message"; Settings showed a developer note ("Subject apps override this via shellScreens.profileSettings…"). |
| Source | `libs/app/web-app/src` had been deleted from lq-core in `9c7bc8fa`; 0.3.4 on packr was the only copy. |

## What changed

### `@learnquest/app-shell` 0.15.0 (`.worktrees/lqc-shell-ux`, branch `feat/shell-phase-chrome-ux`)

- **Entry resolution** (`router/entry.ts`, pure + tested): first run → onboarding
  (language step first when the app teaches several languages); onboarded
  without a language → full-page `LanguagePicker` with pre-game chrome;
  returning → `/$locale/$lang/chapters/$chapter`, the chapter map last opened
  (`router/lastVisited.ts`). School/life apps keep the section grid.
- **Onboarding steps** per app type: lang `welcome → character`; school/life
  `welcome → audience → character`. Override with `QuestShell onboardingSteps`.
  Gender/proficiency travel on router history state to character creation.
- **Chrome phases** (`GameTopBar phase`): `pregame` (brand + account only),
  `game` (stats only when a player exists), `lesson` (title centred, compact
  stats). Onboarding has its own bar with step dots.
- **Banner-aware bar**: `TopBarContainer` measures `#lq-release-banner`,
  publishes `--lq-banner-h`, and reports its bottom edge into
  `useLayoutStore` so the lesson-map chapter header stacks below it.
- **Bottom nav**: Home (map you left) · Chapters · Profile · Settings; hidden
  in onboarding, lessons and the pre-game picker.
- **Start screen**: branded `LoadingFallback` as the router pending component.
- `useShellNavigate` translates the screen packages' legacy paths (`/home`,
  `/login`, `/character-creation`) — the Default* wrappers were 404ing.
- Removed: `QuestTopBar` + subcomponents, `LanguageSelectModal`.

### `@learnquest/screen-onboarding` 0.3.0

- Illustrations resolve through `assetUrl` with a candidate chain per slide
  (target language → other art style → shared pool; the apps were illustrated
  under three naming schemes). `ResponsiveImage` walks the chain on error and
  renders a placeholder when all fail — never a broken image.
- `SlideImage` keeps its box height; `GenderSwitch` is a two-pill segmented
  control; welcome dots moved into flow (they overlapped the proficiency
  picker); card height capped to the viewport.

### `@learnquest/web-app` 0.3.5

- Source restored from `9c7bc8fa^`.
- `LessonMapAdapter` follows the route's chapter and mirrors in-map chapter
  switches into the URL.
- `PlayerSession` persists the player to the app database and rehydrates by
  `userId` on boot.

### Apps (`.worktrees/lqn-shell-ux`, `lqe-shell-ux`, `lqr-shell-ux`, branch `feat/shell-phase-chrome-ux`)

- Dependency bumps; nordic's duplicate screen adapters removed (`main.tsx`
  is config only); `__APP_VERSION__`/`__BUILD_TIME__` defined in vite.
- Screen-audit flows regenerated with personas (see below).

### Audit flows

- `lq-operations` generator (`.worktrees/lqo-shell-ux`,
  `feat/screen-audit-flows-shell-015`): every flow declares a persona
  (`first-run` / `pregame` / `returning`) that seeds localStorage, and asserts
  the chrome that phase must and must not show (`player-level-badge` count 0
  before a game, `bottom-nav` hidden in lessons…). New flows
  `onboarding-journey`, `pregame-language-picker`; `lesson-list` → `lesson-map`.
  `--apps` filter; symlinked app dirs supported.
- lq-core `screen-audit/flows/{nordic,romance,english}-app.flow.ts` rewritten;
  english no longer points at pre-shell routes; mobile added for all three.

## Verified locally (rebuilt packages overlaid into the app worktrees)

nordic at desktop/tablet/mobile: first run → language step → slides with art
→ character → lands on the chapter-1 map with avatar + stats; reload returns
to the same map; onboarded-without-language shows the picker with no stats
and no nav; chapter grid, lesson, profile, settings and switch-language all
carry the right chrome; the map header sits under the bar on phones.

## Shipped (same day)

- lq-core PR #38 merged; app-shell 0.15.0, screen-onboarding 0.3.0, web-app
  0.3.5 published by CI run 12168.
- lq-nordic #11 and lq-english #6 merged with green gates; lq-operations #1
  merged. lq-romance #9 rebased onto the 0.14 rollout that landed on its main
  meanwhile (AlphaGate + seeded e2e state kept; 0.15 deps kept).
- Nordic deployed via `forge app-deploy web --server` (f6fd39be) and verified
  live at desktop/tablet/mobile. Note `forge app-deploy --app nordic-quest`
  prints "deploy complete" without creating a deployment.
- Each app's pnpm-workspace.yaml now overrides `@learnquest/app-shell` to
  `^0.15.0`; english/romance had six app-shell copies in their lockfiles.

## Not done / next

1. Roll the same bumps to the other 11 group apps once their in-flight
   0.14 rollout (`feat/app-shell-0-14`, another session) has merged:
   scratchpad `rollout-015.py <worktree> <group> <default-lang> <langs>`
   applies deps + vite ENV_DEFAULTS; then add the app-shell override,
   `pnpm install`, `codegen-flows --apps …`.
2. English and romance are merged but have no live host yet.
4. Pre-existing, out of scope: `apps/thai/data/asset-map.json` fetched from
   the CDN on every page (`VITE_APP_LOCALE` default + the known lq-assets CORS
   gap); dozens of placeholder strings in `web-app` `en.json`
   ("Blocked Player Message" …); dashboard's "Postgres connection string is
   required" in the browser; lesson-map `ForceSyncButton` + version badge
   remain in the corner.
5. Framer-motion entrance animations (`TopBarContainer`, `GlassmorphismCard`)
   start at opacity 0; a throttled tab can paint blank for a beat.

## Found while verifying english/romance

`lq-english` and `lq-romance` only declare `VITE_APP_GROUP`,
`VITE_DEFAULT_TARGET_LANGUAGE` and `VITE_AVAILABLE_TARGET_LANGUAGES` in
`.env.example`; nothing sets them for a dev server or a worker build, so the
app runs in single-language mode under the `thai` storage prefix
(`thai_last_visited`, `thai_lessonmap_v2` appear in localStorage) and skips
the language step. Their `vite.config.ts` now carries the same `ENV_DEFAULTS`
block lq-nordic got on 2026-08-30. Check the other 11 group apps for the same
gap before rolling 0.15 out.
