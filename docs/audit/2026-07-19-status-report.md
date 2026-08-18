# learn-quest / lq-core / nordic / romance — Status Report

**Date:** 2026-07-19
**Author:** Claude Code
**Scope:** Read-only investigation. Side effect: ran `pnpm test:libs` in `lq-core/` per user direction.
**Question anchored on:** *Did the LanguageSelector → QuestTopBar migration complete?*

---

## TL;DR

| Track | Status | Top Issue |
|---|---|---|
| **lq-core migration** (apps/web → libs/common) | **Incomplete, fragmented** | apps/web still uses legacy TopBar/GameTopBar/OnboardingTopBar/StylizedTopBar from `apps/web/src/components/...`. New `@learnquest/app-shell` v0.8.1 (QuestTopBar, LanguageSelector) is published and consumed by **lang-quest apps** but **not by apps/web**. 5 byte-identical TopBar copies in libs/screens/* plus 2 StylizedTopBar copies keep the legacy code load-bearing. |
| **lq-nordic content** (da/is/no/sv) | **Mature** (vs romance) | 30 chapters each, ~187–232 lessons. Danish (Viking saga) is the heaviest. Last screen-audit ran today (2026-07-19) — **FAILED** on site-landing with `ContentNetworkError: /data/lessons/en/index.json` returning HTML. |
| **lq-romance content** (fr/it/pt/ro/es) | **Mostly at parity, Romanian lagging** | 20 chapters each (fr/it/es/pt ~144–153 lessons); **Romanian only 10 chapters / 112 lessons**. Last smoke-test pass **FAILED** 2026-07-13; last screen-audit ran 2026-05-05 (2.5 months stale). |
| **lq-core unit tests** (libs layer) | **330 pass / 27 fail** (harness), **~396 pass** (corrected) | The `test-packages.ts` harness **underreports** by ~66 passing tests because `@learnquest/app-shell` (45 tests) and `@learnquest/quest-types` (21 tests) are missing `test` scripts in package.json. When run directly with vitest, they pass. `@learnquest/http-content-source` has a **real broken test** (vite can't resolve `@learnquest/lesson-ui`). |

### Answer to the anchor question

**Did the LanguageSelector → QuestTopBar migration complete?**
- **For lang-quest apps:** ✅ Yes. lq-nordic, lq-romance, lq-uralic, lq-southeast-asian, lq-slavic all consume `@learnquest/app-shell` and use the new `QuestTopBar` + `LanguageSelector` (with `topBar={{ showLanguageSelector: true }}` in their main.tsx).
- **For apps/web (lq-core's own app):** ❌ No. apps/web has zero `import` of `@learnquest/app-shell` in `src/` or `package.json`. It still uses legacy `apps/web/src/components/shell/navigation/header/top-bar/{TopBar,GameTopBar,OnboardingTopBar,StylizedTopBar}.tsx` and legacy `apps/web/src/components/common/localization/LanguageSelector.tsx`.
- **For per-screen packages (libs/screens/*):** ⚠️ Each screen package has its own TopBar.tsx, BackButton.tsx, and (in some) StylizedTopBar.tsx — most are **byte-identical copies** of legacy TopBar (verified via sha256). libs/screens/profile uses a documented "shim" StylizedTopBar. libs/screens/onboarding has a different OnboardingTopBar. This duplication is what's keeping the apps/web migration blocker from blocking the screens.

**Bottom line:** Migration is **fragmented, not consolidated**. The new code is published and consumed by the satellite apps, but the main app (apps/web) still uses legacy. There is no single `TopBar` anyone can point to as canonical; there are three live copies of the legacy TopBar and one new version in app-shell, plus per-screen copies.

### Top 3 things to fix this week

1. **P0:** Fix `/data/lessons/en/index.json` returning HTML in nordic + romance. Same `ContentNetworkError` in nordic today (2026-07-19) and romance 2.5 months ago (2026-05-05, **never fixed**). Likely a vite middleware misconfig or missing file. Romance uses `resolveContentSource()` returning `undefined` (file-based via vite), so vite needs to serve `/data/lessons/en/index.json` from `public/`. Nordic uses `CdnContentSource` against an R2 bucket — same `<!DOCTYPE` HTML response means R2 isn't returning the JSON either (auth? wrong key? wrong path?). Trace `HttpContentSource` (new) vs `FileContentSource` (new).
2. **P0:** Add `test` scripts to `@learnquest/app-shell` and `@learnquest/quest-types` package.json. The `test-packages.ts` harness can't run them, so 66 passing tests are silently invisible to CI. Single-line fix per package.
3. **P0:** Decide on the TopBar migration strategy for apps/web. Either migrate apps/web to `@learnquest/app-shell` (preferred, 2-4 days) or accept legacy is the source of truth and delete the 5 byte-identical TopBar copies in libs/screens/*.

---

## Track 1 — lq-core migration (anchor question)

### The TopBar/Localization split today

```
packages (libs/common/app-shell)            apps/web/src/components           libs/screens/*
───────────────────────────────              ─────────────────────────         ──────────────────
components/TopBar.tsx             ←NEW→      shell/navigation/header/top-bar/ shared/components/shell/navigation/header/top-bar/
topbar/QuestTopBar.tsx            ←NEW→        ├─ TopBar.tsx          [LEGACY]   ├─ TopBar.tsx          [IDENTICAL COPY × 5]
topbar/LanguageSelector.tsx       ←NEW→        ├─ GameTopBar.tsx      [LEGACY]   └─ BackButton.tsx      [COPY × 5]
topbar/subcomponents.tsx          ←NEW→        ├─ OnboardingTopBar.tsx [LEGACY]
layouts/{App,Lesson,Onboarding}.  ←NEW→        ├─ StylizedTopBar.tsx  [LEGACY]
QuestShell.tsx                    ←NEW→        └─ components/{TopBarContainer,
registry/topbar-slots.ts          ←NEW→           BrandSection, PlayerStats}.tsx
                                                common/localization/
                                                  ├─ LanguageSelector.tsx [LEGACY]
                                                  ├─ LanguageFlag.tsx     [LEGACY]
                                                  ├─ LanguageChevron.tsx  [LEGACY]
                                                  ├─ LanguageList.tsx     [LEGACY]
                                                  └─ LanguageSearchInput.tsx [LEGACY]
```

**Two completely independent TopBar code paths exist:**

| Property | Legacy `apps/web/.../TopBar.tsx` | New `app-shell/components/TopBar.tsx` |
|---|---|---|
| Lines | 155 | 62 |
| Animation | framer-motion | none |
| aria-label | `t('common.aria_top_navigation')` via useTranslation | none |
| Subcomponent pattern | `TopBar.Actions = TopBarActions` | `TopBar.Actions = TopBarActions` (same!) |
| Variant API | `'default' \| 'glass' \| 'solid' \| 'minimal'` | identical |
| Position API | `'sticky' \| 'fixed' \| 'relative'` | identical |
| Used at runtime in apps/web | ✅ yes (DevToolsScreen + legacy routes) | ❌ no |

**Legacy LanguageSelector vs new LanguageSelector — different APIs:**

| Property | Legacy `apps/web/.../LanguageSelector.tsx` | New `app-shell/topbar/LanguageSelector.tsx` |
|---|---|---|
| State source | `useLanguage()` hook → filters from global state | `LANGUAGES` constant from `@learnquest/app-config` |
| Selection handler | `useLanguage().changeLanguage` (custom hook) | `i18n.changeLanguage(code)` directly |
| Props | `<LanguageSelector />` (no props) | `{ current?, onChange?, buttonClassName? }` |
| Click-outside | yes (mousedown) | yes (mousedown, same shape) |
| Search input | yes | yes |

### Identical-copy duplications (verified via sha256)

```
6d1ee3a55882e3d7df15ca9476e6d791c2ef4fa5  apps/web/.../top-bar/TopBar.tsx
6d1ee3a55882e3d7df15ca9476e6d791c2ef4fa5  libs/screens/dashboard/.../top-bar/TopBar.tsx
                                                (social, challenges, admin-shared, groups likely identical)
```

5 screen packages duplicate the legacy TopBar byte-for-byte. `libs/screens/profile/src/shared/components/StylizedTopBar.tsx` is a documented shim ("Full version lives in apps/web/src/.../StylizedTopBar.tsx"). `libs/screens/onboarding/src/components/OnboardingTopBar.tsx` is a *different* implementation (just brand, no selectors).

### Active runtime imports

`grep -rn "from.*'@learnquest/app-shell'" apps/web/src` returns **zero results**. apps/web does not consume the new package.

`grep -rn "from.*'@/components/shell/navigation/header/top-bar'\|from.*'@/components/common/localization'" apps/web/src` shows these consumers:
- `screens/onboarding/layout/OnboardingLayout.tsx` → legacy `OnboardingTopBar`
- `screens/dev/DevToolsScreen.tsx` → legacy `TopBar`
- `components/shell/main/MainHeader.tsx` → legacy `GameTopBar`
- `components/shell/navigation/header/top-bar/OnboardingTopBar.tsx` → legacy `LanguageSelector`
- `components/shell/navigation/header/top-bar/StylizedTopBar.tsx` → legacy `LanguageSelector`
- `components/shell/navigation/header/header-actions/HeaderActions.tsx` → legacy `LanguageSelector`

**The legacy TopBar is the runtime source of truth in apps/web today.**

### libs/common/ subpackages (CLAUDE.md is stale)

CLAUDE.md lists 9 packages. Actual count: **19 packages**.

| Package | Listed in CLAUDE.md? | Notes |
|---|---|---|
| animations | ✅ | |
| **app-shell** | ❌ | New — v0.8.1 published to packr; consumed by lang-quest apps |
| assets | ❌ | |
| constants | ✅ | |
| **core-state** | ❌ | |
| email | ✅ | |
| **event-bus** | ❌ | |
| **firebase-shim** | ❌ | Should be deleted post-Supabase-removal (already done per memory) — investigate |
| hooks | ✅ | |
| **http-content-source** | ❌ | Replaces content loading |
| **interactive** | ❌ | |
| **quest-prefs** | ❌ | |
| **quest-types** | ❌ | Shared with lang-quest |
| schemas | ✅ | |
| **sql-content-source** | ❌ | |
| types | ✅ | |
| ui | ✅ | |
| utils | ✅ | |
| validators | ✅ | |

### Broader migration sweep (numbers)

| Area | .tsx file count | State |
|---|---|---|
| `apps/web/src/components/` | **569** | Legacy, untouched |
| `libs/common/ui/` | 90 | New, used everywhere |
| `libs/common/app-shell/` | 37 | New, v0.8.1 published |
| `libs/screens/` | 1532 | Migrated, but each screen has own TopBar copy |
| `libs/lang/` | 570 | Migrated, includes StylizedTopBar copy |

### Key migrations DONE

- ✅ `@learnquest/ui` (shadcn primitives) — widely consumed
- ✅ `@learnquest/database` (Postgres + Drizzle) — production
- ✅ `@learnquest/app-shell` (QuestShell, QuestTopBar, LanguageSelector) — consumed by lang-quest apps
- ✅ `@learnquest/screen-*` packages — extracted from apps/web
- ✅ `@learnquest/lesson-ui` — shared lesson rendering
- ✅ Supabase removal (per memory `project_supabase_removal_state.md` 2026-07-19)
- ✅ firebase-shim package present but should be audit-target for deletion

### Key migrations NOT DONE

- ❌ **apps/web still consumes legacy TopBar/GameTopBar/OnboardingTopBar/StylizedTopBar/LanguageSelector**
- ❌ **5 byte-identical TopBar copies in libs/screens/{dashboard,social,challenges,admin-shared,groups}**
- ❌ **2 StylizedTopBar copies in libs/{lang/lesson-framework, screens/profile}**
- ❌ **2 OnboardingTopBar implementations** (one in libs/screens/onboarding, one in legacy apps/web)
- ❌ **`apps/web/src/components/` is not on the deletion path** — appears to be load-bearing for legacy routes (DevTools, OnboardingLayout, MainHeader)

---

## Track 2 — lq-nordic + lq-romance content

### Content parity table (lessons per language)

| Language | Chapter dirs | Lesson files | Last dist build | Last smoke | Last screen-audit |
|---|---:|---:|---|---|---|
| **Nordic** | | | | | |
| Danish 🇩🇰 | 30 | 232 | 2026-07-19 | (empty) | 2026-07-19 — site-landing **FAILED** |
| Icelandic 🇮🇸 | 30 | 188 | 2026-07-19 | (empty) | 2026-07-19 — site-landing **FAILED** |
| Norwegian 🇳🇴 | 30 | 188 | 2026-07-19 | (empty) | 2026-07-19 — site-landing **FAILED** |
| Swedish 🇸🇪 | 30 | 187 | 2026-07-19 | (empty) | 2026-07-19 — site-landing **FAILED** |
| **Romance** | | | | | |
| French 🇫🇷 | 20 | 144 | 2026-07-13 | 2026-07-13 — **4 FAILED** | 2026-05-05 |
| Italian 🇮🇹 | 20 | 144 | 2026-07-13 | 2026-07-13 — **4 FAILED** | 2026-05-05 |
| Portuguese 🇵🇹 | 20 | 153 | 2026-07-13 | 2026-07-13 — **4 FAILED** | 2026-05-05 |
| Romanian 🇷🇴 | **10** | **112** | 2026-07-13 | 2026-07-13 — **4 FAILED** | 2026-05-05 |
| Spanish 🇪🇸 | 20 | 152 | 2026-07-13 | 2026-07-13 — **4 FAILED** | 2026-05-05 |

### Observations

**Nordic is structurally richer than romance:**
- 30 chapters vs 20 (50% more)
- ~187–232 lessons vs ~144–153 (Danish alone has 232, ~50% more than romance max)
- Nordic Danish has the Viking saga content per memory (`project_viking_saga_state.md`)
- Icelandic/Norwegian/Swedish are at parity with each other (~188 lessons each)

**Romanian is the laggard** at 10 chapters / 112 lessons (~half the others). Likely no narrative-engine / scene-generator pass for Romanian yet (the Mediterranean Odyssey engine shipped for Italian per memory `project_narrative_engine.md`).

**Both apps have a deployed bug:** `ContentNetworkError: Network error fetching /data/lessons/en/index.json: Unexpected token '<', "<!DOCTYPE "` — the endpoint returns HTML (probably the SPA fallback) instead of JSON. Confirmed:
- nordic 2026-07-19 (TODAY): site-landing flow **FAILED** with this error
- romance 2026-05-05: same error (2.5 months ago, **not fixed**)

**Audit-test coverage gap:**
- nordic has 6 audit flows (`full-app-journey`, `language-chapters`, `lesson-list`, `lesson-screen`, `site-landing`, `user-profile`) — but only `site-landing` ran today
- romance has **1** audit flow (`site-landing`) only
- nordic test-results/ is empty; romance test-results/ has 4 smoke results from 2026-07-13

### What the latest audit said (verbatim, nordic 2026-07-19)

```json
{
  "repo": "@learnquest/nordic",
  "startedAt": "2026-07-19T13:18:09.481Z",
  "totalFlows": 1, "passed": 0, "failed": 1,
  "flows": [{"flow": "site-landing", "status": "fail", "durationMs": 180716, "steps": 1}]
}
```

And romance 2026-05-05:

```json
{
  "category": "interaction", "severity": "high",
  "selector": "console",
  "problem": "console error on /: [app-shell ContentErrorBoundary] ContentNetworkError: Network error fetching /data/lessons/en/index.json: Unexpected token '<', \"<!DOCTYPE \"."
}
```

### Docs / content audit

- `lang-quest/lq-nordic/docs/` exists; `lang-quest/lq-romance/docs/` exists — should inventory before recommending
- `data/images/` and `data/sounds/` are shared (in `lq-core/data/`)
- `shared-vocab-images/` exists in `lang-quest/` root — shared image pool
- `data/languages-shared/` exists in `lq-core/data/`
- `regional-vocab` pipeline is in place per memory (`project_regional_assets.md`, 3-tier architecture, 1,116 images, 34,937 refs wired)

### What I did NOT audit (out of scope)

- `lingua-quest/` (separate monorepo, narrative engine)
- `lq-psychology/`, `school-quest/`, `life-quest/` (per memory these exist; user did not ask)
- `books-platform/`
- `lq-tools/`, `lq-operations/`, `lq-site/`
- Books, image-pipeline, deploy scripts

---

## Track 3 — lq-core unit tests

### Test inventory

`pnpm test:packages:list` enumerates **43 packages, ~1,145 test files**:

| Layer | Packages | Test files |
|---|---:|---:|
| services | 11 | 32 |
| **libs** | **14** | **432** |
| app | 4 | 136 |
| screens | 15 | 545 |

### The libs layer — actual `pnpm test:libs` run (2026-07-19)

```
TOTAL: 330 passed, 27 failed
```

| Package | Pass / Fail | Test files | Notes |
|---|---:|---:|---|
| `@learnquest/app-shell` | **0/0 reported** | 9 | **Missing `test` script** in package.json. When run with `npx vitest run` directly: **45/45 passed**. |
| `@learnquest/assets` | 13/19 | 27 | 6 failures |
| `@learnquest/core-state` | 6/0 ✅ | 6 | |
| `@learnquest/http-content-source` | 0/1 ❌ | 1 | **Real failure:** test fails to resolve `@learnquest/lesson-ui` (vite import error). Test is broken, not the code. |
| `@learnquest/interactive` | 6/0 ✅ | 6 | |
| `@learnquest/quest-prefs` | 2/0 ✅ | 2 | |
| `@learnquest/quest-types` | **0/0 reported** | 1 | **Missing `test` script.** When run with `npx vitest run` directly: **21/21 passed**. |
| `@learnquest/ui` | 23/0 ✅ | 23 | |
| `@learnquest/game-features` | 83/88 | 120 | 5 failures |
| `@learnquest/game-state` | 9/11 | 15 | 2 failures |
| `@learnquest/lesson-framework` | 26/27 | 29 | 1 failure |
| `@learnquest/lang-lesson-types` | 99/110 | 110 | **11 failures (most failures)** |
| `@learnquest/database` | 60/61 | 80 | 1 failure |
| `@learnquest/error-tracker` | 3/0 ✅ | 3 | |

### Two important findings

**1. The `test-packages.ts` harness underreports.** Two packages — `@learnquest/app-shell` (45 tests) and `@learnquest/quest-types` (21 tests) — have NO `"test"` script in their `package.json`, only `build`/`typecheck`/`lint`. The harness falls back to a 0-test default. When run directly with `npx vitest run`, both packages pass all their tests.

This means the actual libs test count is approximately:
- **396 passed** (not 330) — **66 additional passing tests unreported by harness**
- **27 failed** — same as reported

**2. `@learnquest/http-content-source` has a real broken test.** When run directly, the test fails to resolve `@learnquest/lesson-ui` during vite import. Likely a missing peer dep or a missing `devDependencies` entry. Either add `lesson-ui` as devDep, or stub the import. This is a **P0** because http-content-source is the runtime data path for the lang-quest apps (or FileContentSource fallback) — a broken test means regressions can sneak in.

### Failure hotspots (where to look next session)

1. **`@learnquest/lang-lesson-types` (11 failures)** — biggest absolute count. Lesson type definitions shared across the app.
2. **`@learnquest/assets` (6 failures)** — image/asset utilities.
3. **`@learnquest/game-features` (5 failures)** — RPG game mechanics.
4. **`@learnquest/game-state` (2 failures)** — Zustand/XState state machines.
5. **`@learnquest/lesson-framework` (1)** + **`@learnquest/database` (1)** — 1 each.

**Top-of-funnel**: investigate `lang-lesson-types` first — 11 failures across 110 test files is ~10% failure rate, highest among packages with significant test count.

### What I did NOT run (per user direction)

- ❌ `pnpm test:screens` (E2E)
- ❌ `pnpm test:admin:*` (E2E)
- ❌ `pnpm test:challenges:*` (E2E)
- ❌ Screen audits
- ❌ apps/web unit tests (the legacy monster — would likely OOM per memory)

---

## Recommendations

### P0 — Blockers / active bugs

1. **Fix `/data/lessons/en/index.json` 404 (HTML returned) in nordic + romance.** Same root cause likely. The endpoint that serves lesson index data is returning the SPA fallback HTML instead of JSON. This is a **deployed bug** blocking the user-facing screen-audit on both apps. Likely a vite middleware / static-files misconfig or a missing api route. Action: trace `HttpContentSource` (new) vs `FileContentSource` (new) — romance uses file-based (`resolveContentSource()` returns `undefined`) so vite needs to serve `/data/lessons/en/index.json` from `public/`. Check whether that file exists and whether vite is configured to serve it.

2. **Resolve the apps/web TopBar split.** Three options:
   - **(a) Migrate apps/web to `@learnquest/app-shell`** — replace legacy TopBar/GameTopBar/OnboardingTopBar/StylizedTopBar imports with QuestTopBar. This is the path that aligns with CLAUDE.md's stated architecture.
   - **(b) Keep apps/web on legacy, mark legacy as deprecated.** Then update CLAUDE.md to reflect that apps/web is a legacy-only consumer, and delete the 5 byte-identical TopBar copies in libs/screens/* (since they're only there because apps/web can't be migrated). This would actually consolidate by inversion.
   - **(c) Extract legacy TopBar into its own `@learnquest/legacy-topbar` package.** Then both apps/web and libs/screens/* depend on it explicitly. Honest about the state, doesn't pretend migration is more complete than it is.

   **Recommended: (a).** The new package exists; the migration of lang-quest apps proves it works. The blocker is figuring out the dependency graph (apps/web → app-shell → lesson-ui, screen-household, screen-household-goals, ui — lots of peer deps). Estimated effort: 2–4 days including regression testing.

### P1 — Next session

3. **Romanian content parity.** Either commit to a content pass to bring Romanian to 20 chapters / ~144 lessons, or document why Romanian is intentionally lighter (smaller market? no narrative engine integration?). Recommendation: open a planning question rather than silently underinvesting.

4. **Add missing audit flows to romance.** Romance has 1 flow (site-landing). Nordic has 6. Either copy the flows from nordic or write language-quest-shared flows. This is what will catch the `/data/lessons/en/index.json` bug before deploy, not after.

5. **Delete `firebase-shim` from `libs/common/`.** Per memory `project_supabase_removal_state.md` (2026-07-19), Firebase was removed. The shim package is presumably now empty or near-empty. Quick audit + delete.

6. **Update lq-core `CLAUDE.md`.** It lists 9 of 19 libs/common subpackages and 3 of 4 libs/lang subpackages. Wrong package count + missing app-shell entry. ~30 min fix.

7. **Fix `@learnquest/http-content-source` test.** Vite can't resolve `@learnquest/lesson-ui` during import. Either add `lesson-ui` as devDependency or stub the lesson-ui import in the test. This is the data path for lang-quest apps — broken test = no regression detection.

### P2 — Backlog

8. **Consolidate TopBar duplication.** Once decision is made on P0 #2, delete the 5 byte-identical TopBar copies in libs/screens/* and the 2 StylizedTopBar copies in libs/{lang/lesson-framework, screens/profile}. Single point of change.

9. **Add a regression E2E for `QuestTopBar` + `LanguageSelector`.** Migration of lang-quest apps happened without a smoke spec for the new topbar components. Add a smoke spec to nordic + romance that exercises `topBar={{ showLanguageSelector: true }}` rendering and locale change. Currently neither romance nor nordic smoke covers the topbar's `showLanguageSelector` prop.

10. **Migrate the 2 remaining screen packages that have their own TopBar.** `libs/screens/onboarding/src/components/OnboardingTopBar.tsx` has its own (different) implementation. Either align with app-shell's QuestTopBar variant='onboarding' or delete.

11. **Consider re-running the failed romance smoke (2026-07-13).** The 4 failed tests may be related to the same `/data/lessons/en/index.json` bug. Fix the bug first, then re-run.

---

## Appendix A — Files inspected

**apps/web (legacy):**
- `apps/web/src/components/shell/navigation/header/top-bar/{TopBar,GameTopBar,OnboardingTopBar,StylizedTopBar,BackButton,components/{TopBarContainer,BrandSection,PlayerStats}}.tsx` + tests + stories
- `apps/web/src/components/common/localization/{LanguageSelector,LanguageList,LanguageFlag,LanguageChevron,LanguageSearchInput}.tsx` + tests + stories
- `apps/web/src/components/shell/main/MainHeader.tsx`
- `apps/web/src/components/shell/navigation/header/header-actions/HeaderActions.tsx`

**libs/common/app-shell (new):**
- `src/{index,QuestShell,types}.ts`
- `src/components/{TopBar,BackButton,FeatureFlagGuard,PremiumTierGuard}.tsx`
- `src/topbar/{QuestTopBar,LanguageSelector,subcomponents}.tsx`
- `src/layouts/{AppLayout,LessonLayout,OnboardingLayout}.tsx`
- `src/registry/topbar-slots.ts`

**libs/screens/* (migrated):**
- 15 packages audited for TopBar presence
- Confirmed 5 identical TopBar copies + 1 shim StylizedTopBar + 1 different OnboardingTopBar

**lang-quest/lq-nordic + lq-romance:**
- main.tsx, lq.config.json, package.json, content/, languages/{lang}/data/

## Appendix B — Open questions for the user

1. Should we keep Romanian as a "light" locale or invest in parity? (P1 #3)
2. The 5 identical TopBar copies — did they exist before the apps/web migration was attempted, or were they created as a stepping stone? (helps decide P0 #2 strategy)
3. Is the `/data/lessons/en/index.json` bug known in some channel I haven't checked (Sentry, Linear, recent commits)? Could be a 5-min fix if someone has already root-caused it.
