# Screen Domains — Decoupling Plan

> Analysis date: 2026-04-10

## Overview

`libs/screens/` contains 10 screen domains totaling **1,913 files / 128K lines**. Each domain is already an independent workspace package (`@learnquest/screen-*`) registered in `pnpm-workspace.yaml`. They stay in `libs/screens/` — no directory move needed.

The goal is to **break cross-domain dependencies** so each screen package depends only on shared infrastructure (`libs/common/`, `libs/app/`, `libs/lang/`) and not on other screen packages.

## Current State

### Domain Inventory

| Domain | Package | Files | Lines | Cross-domain deps |
|--------|---------|-------|-------|--------------------|
| auth | `@learnquest/screen-auth` | 27 | 1,028 | None |
| shop | `@learnquest/screen-shop` | 91 | 4,638 | None |
| challenges | `@learnquest/screen-challenges` | 337 | 23,650 | None |
| onboarding | `@learnquest/screen-onboarding` | 62 | 4,061 | auth (LoginModal) |
| dashboard | `@learnquest/screen-dashboard` | 66 | 2,980 | lessons (SRSService) |
| lessons | `@learnquest/screen-lessons` | 28 | 3,826 | profile (PlayerService) |
| social | `@learnquest/screen-social` | 213 | 13,474 | profile (PlayerService, ProfileStats) |
| groups | `@learnquest/screen-groups` | 171 | 10,442 | admin (services) |
| profile | `@learnquest/screen-profile` | 250 | 15,761 | admin (services), shop (useStripeCheckout) |
| admin | `@learnquest/screen-admin` | 668 | 48,543 | lessons (BossAvatarDisplay, LessonService) |

### The Circular Dependency

```
admin ──→ lessons ──→ profile ──→ admin
  ↑                     │
groups                 shop
```

**admin** imports from `lessons` (BossAvatarDisplay, LessonService, LessonMockProvider)
**lessons** imports from `profile` (PlayerService)
**profile** imports from `admin` (services) and `shop` (useStripeCheckout)

This cycle prevents clean package boundaries and makes testing harder.

## Root Causes

The cross-domain imports are shared **services** that ended up in the wrong package:

| Import | Currently in | Used by | Should be in |
|--------|-------------|---------|-------------|
| `PlayerService` | `screen-profile/shared/services/` | lessons, social | `@learnquest/app-services` |
| `ProfileStats` | `screen-profile/` | social | `@learnquest/app-services` or `@learnquest/app-types` |
| `LessonService` | `screen-lessons/services/` | admin | `@learnquest/app-services` |
| `BossAvatarDisplay` | `screen-lessons/` | admin | `@learnquest/ui` or `libs/lang/` |
| `LessonMockProvider` | `screen-lessons/` | admin | `@learnquest/app-services` (test utils) |
| `LoginModal` | `screen-auth/` | onboarding | `@learnquest/ui` or `@learnquest/screen-auth` (explicit dep) |
| Admin services | `screen-admin/services/` | groups, profile | `@learnquest/app-services` |
| `useStripeCheckout` | `screen-shop/` | profile | `@learnquest/app-hooks` |
| `SRSService` | `screen-lessons/services/` | dashboard | `@learnquest/app-services` |

## Decoupling Plan

### Phase 1: Extract shared services to libs/app/ (breaks the cycle)

Move the shared services out of screen packages into `libs/app/app-services/`:

1. **PlayerService** → `libs/app/app-services/src/player/`
   - Used by: lessons, social, profile (internal)
   - Breaking: lessons → profile dependency

2. **LessonService + SRSService** → `libs/app/app-services/src/lessons/`
   - Used by: admin, dashboard
   - Breaking: admin → lessons, dashboard → lessons dependencies

3. **Admin API services** → `libs/app/app-services/src/admin/`
   - Used by: groups, profile
   - Breaking: groups → admin, profile → admin dependencies

4. **useStripeCheckout** → `libs/app/app-hooks/src/`
   - Used by: profile
   - Breaking: profile → shop dependency

After Phase 1, the circular dependency is **fully broken**. All screen packages depend downward on `libs/app/` and `libs/common/`, never on each other.

### Phase 2: Extract shared UI components

5. **BossAvatarDisplay** → `libs/lang/game-features/` or `@learnquest/ui`
   - A game UI component, not a screen concern

6. **LoginModal** → `@learnquest/ui` (if reusable) or keep as explicit `screen-auth` → `screen-onboarding` dependency
   - This is a UI component, arguably fine in `@learnquest/ui`

7. **ProfileStats** → `@learnquest/app-types` (if it's just a type) or `libs/app/app-services/`

### Phase 3: Validate independence

8. For each screen package, verify that its `package.json` dependencies only reference:
   - `@learnquest/ui`, `@learnquest/hooks`, `@learnquest/schemas`, `@learnquest/types`
   - `@learnquest/app-services`, `@learnquest/app-hooks`, `@learnquest/app-types`, `@learnquest/app-config`
   - `@learnquest/game-state`, `@learnquest/game-features`, `@learnquest/lesson-framework`
   - External packages (react, zustand, xstate, stripe, etc.)
   - **Not** any other `@learnquest/screen-*` package

## Target Dependency Graph (after decoupling)

```
                    ┌──────────────┐
                    │  External    │
                    │  (react,     │
                    │   zustand,   │
                    │   stripe)    │
                    └──────┬───────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
   ┌──────────┐    ┌──────────────┐   ┌──────────┐
   │ screen-  │    │   screen-    │   │ screen-  │
   │ auth     │    │   admin      │   │ shop     │
   │ shop     │    │   challenges │   │ social   │
   │ etc.     │    │   etc.       │   │ etc.     │
   └────┬─────┘    └──────┬───────┘   └────┬─────┘
        │                 │                 │
        └─────────────────┼─────────────────┘
                          │
              ┌───────────┼───────────┐
              ▼           ▼           ▼
        ┌──────────┐ ┌────────┐ ┌────────┐
        │ libs/app │ │libs/   │ │libs/   │
        │(services,│ │lang    │ │common  │
        │ hooks,   │ │(game,  │ │(ui,    │
        │ types)   │ │lessons)│ │schemas)│
        └──────────┘ └────────┘ └────────┘
```

No screen package imports from any other screen package.

## Test Infrastructure Impact

`unit.config.js` continues to work as-is — paths and package names don't change. The only update needed is if any test mocks reference cross-domain imports that moved to `libs/app/`.

## Execution Priority

| Step | What | Effort | Impact |
|------|------|--------|--------|
| 1 | Extract PlayerService to libs/app | Low | Breaks lessons→profile and social→profile |
| 2 | Extract LessonService + SRSService | Low | Breaks admin→lessons and dashboard→lessons |
| 3 | Extract admin services | Medium | Breaks groups→admin and profile→admin |
| 4 | Move useStripeCheckout to app-hooks | Low | Breaks profile→shop |
| 5 | Move BossAvatarDisplay to libs/lang | Low | Breaks admin→lessons (last ref) |
| 6 | Validate all screen packages | Low | Confirm no cross-deps remain |

Steps 1-2 break the circular dependency. Steps 3-5 clean up remaining cross-deps. Step 6 enforces the rule going forward.
