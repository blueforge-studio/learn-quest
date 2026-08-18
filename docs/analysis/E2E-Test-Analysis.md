# E2E Test Analysis

> Analysis date: 2026-04-10

## Location

Tests live at `lq-core/apps/web/src/e2e/` — correct, since E2E tests exercise the web app in `apps/web/`. Playwright config at `apps/web/playwright.config.ts`.

## Structure

```
apps/web/src/e2e/
├── fixtures.ts               # Test fixtures
├── global-setup.ts           # Seed data setup
├── README.md
├── support/                  # Shared infrastructure
│   ├── mock-setup.ts
│   ├── supabase-emulators.ts # (legacy name — was Firebase)
│   ├── test-utils.ts
│   ├── constants.ts
│   └── ...
├── tests/
│   ├── _fixtures/users.ts    # Test user data
│   ├── _helpers/             # Mock setup, layout expectations
│   ├── _pages/               # Page objects (only 3: Login, Profile, Groups)
│   ├── auth.setup.ts         # Auth setup project
│   └── [26 domain dirs]      # Tests by feature
└── utils/
```

## Inventory: 162 Spec Files

| Domain | Specs | Mock | Emulator | Other | Assessment |
|--------|-------|------|----------|-------|------------|
| lessons | 38 | 22 | 8 | 8 | Excellent — boss, map, progression, types, practice, editor, cache, errors |
| admin | 26 | 14 | 5 | 7 | Good — auth, CRUD, analytics, dashboard, experiments, users |
| challenges | 19 | 9 | 8 | 2 | Good — flows, loadout, multiplayer, spectator, team, tournaments |
| social | 13 | 9 | 3 | 1 | Good — friends, chat, leaderboard, activity, reports |
| groups | 11 | 6 | 3 | 2 | Good — management, invitations, permissions |
| profile | 11 | 6 | 3 | 2 | Good — achievements, rewards, settings, subscriptions |
| auth | 5 | 2 | 3 | 0 | Good — login, signup |
| shop | 5 | 3 | 1 | 1 | Adequate — checkout, bundles, purchase, premium |
| chat | 3 | 2 | 1 | 0 | Adequate |
| navigation | 2 | 1 | 1 | 0 | Adequate |
| onboarding | 2 | 1 | 1 | 0 | Adequate |
| theme | 2 | 1 | 1 | 0 | Adequate |
| journey | 2 | 2 | 0 | 0 | Good — full journey, game victory |
| offline | 2 | 2 | 0 | 0 | Adequate |
| combat | 2 | 2 | 0 | 0 | Adequate |
| smoke | 1 | 0 | 0 | 1 | Adequate |
| performance | 1 | 0 | 0 | 1 | Adequate |
| errors | 1 | 1 | 0 | 0 | Minimal |
| settings | 1 | 1 | 0 | 0 | Minimal — accessibility only |
| search | 1 | 1 | 0 | 0 | Minimal |
| features/map | 1 | 1 | 0 | 0 | Minimal |
| components | 1 | 0 | 0 | 1 | Minimal — bottom nav only |
| simple | 2 | 2 | 0 | 0 | Sanity |
| dev | 1 | 1 | 0 | 0 | Dev tools |
| issues | 1 | 0 | 0 | 1 | Regression repro |

## Test Modes

- `*.mock.spec.ts` — Mock/localStorage DB (fast, no backend)
- `*.emulator.spec.ts` — Legacy Firebase emulator tests (to be migrated to Supabase local or converted to mock)
- `*.smoke.spec.ts` — Production build verification
- `*.perf.spec.ts` — Performance benchmarks
- `*.indexeddb.spec.ts` — IndexedDB-specific

## Issues

### 1. Firebase references still present (CRITICAL)

Playwright config has Firebase emulator projects, env vars (`VITE_USE_FIREBASE`), and `start-emulators.sh`. Migration to Supabase is complete but E2E config hasn't caught up.

**Files to clean:**
- `playwright.config.ts` — Remove Firebase projects and env vars
- `support/emulator-spec-setup.ts` — Review/remove Firebase setup
- `support/emulatorTestSetup.ts` — Review/remove Firebase setup  
- `global-setup.ts` — Review for Firebase seed logic
- All `*.emulator.spec.ts` files — Convert to mock or Supabase local

### 2. Missing Page Objects

Only 3 page objects for 162 specs. Needed:
- `LessonPage` / `LessonMapPage` (38 specs)
- `AdminPage` / `AdminContentPage` (26 specs)
- `ChallengePage` (19 specs)
- `ShopPage` / `CheckoutPage` (5 specs)
- `SocialPage` / `ChatPage` (13 specs)
- `OnboardingPage` (2 specs)
- `DashboardPage` (indirect coverage)

### 3. Coverage Gaps

| Essential Flow | Current | Gap |
|---------------|---------|-----|
| Dashboard overview | 0 dedicated specs | No standalone dashboard E2E |
| Search & discovery | 1 spec | Core UX barely covered |
| Settings & preferences | 1 spec (accessibility) | Missing: language, notifications, account |
| Error recovery | 1 spec | Missing: network failure, session expiry |
| Onboarding → first lesson | 2 + journey | Could use focused transition test |

### 4. No E2E for other projects

books-platform (7 apps) and lq-site have no E2E tests — expected at current maturity but should be planned.

## Recommendations

1. **Remove all Firebase/emulator references** from playwright config and support files
2. **Convert `*.emulator.spec.ts`** to `*.mock.spec.ts` (most test the same flows, just against different DB)
3. **Add page objects** for lessons, admin, challenges, social, shop
4. **Add dashboard and settings specs** to cover the gaps
5. **Simplify playwright projects** to: mock (primary), smoke, perf, indexeddb
