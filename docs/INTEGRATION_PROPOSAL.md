# Proposal: Unified App Integration via Packr Registry

## Context

School-quest apps now use a clean registry-based integration with lq-core:
- `@learnquest/web-core` for bootstrap + screen registry
- `@learnquest/lesson-ui` for shared UI components + hooks
- All installed from packr, no path references

Lang-quest apps (e.g., lq-nordic) do NOT yet use this pattern. They have `packr.sync.json` metadata but no actual package dependencies or imports. This creates inconsistency and makes it harder to share improvements across the ecosystem.

## Current State Comparison

| Aspect | lang-quest (lq-nordic) | school-quest (lq-math) |
|--------|------------------------|------------------------|
| Package deps | None from lq-core | @learnquest/web-core, @learnquest/lesson-ui |
| .npmrc | Not present | Configured for packr |
| Registry imports | Zero | Active (hooks, components, registry) |
| App shell | Hardcoded standalone stub | SubjectApp + LessonScreenRegistry |
| Vite config | Bare (react only) | React + Tailwind |
| Lesson screens | None | Type-specific with shared components |
| Tests | Playwright smoke only | Unit (vitest) + E2E (playwright) |

## Proposed Changes for lang-quest

### Phase 1: Add `.npmrc` + Install Shared Packages

Every lang-quest app gets:
```
@learnquest:registry=https://api.packr.blueforge.studio
```

And installs:
```bash
npm install @learnquest/web-core @learnquest/lesson-ui react-router-dom
```

### Phase 2: Create `@learnquest/lang-ui` Package

Mirror `@learnquest/lesson-ui` but for language-specific components:

```
lq-core/libs/lang/lang-ui/
├── src/
│   ├── components/
│   │   ├── VocabCard.tsx
│   │   ├── ConversationBubble.tsx
│   │   ├── DrillStage.tsx
│   │   ├── AlphabetGrid.tsx
│   │   └── index.ts
│   ├── hooks/
│   │   ├── useVocabLoader.ts
│   │   ├── useDrillState.ts
│   │   └── index.ts
│   └── index.ts
```

Publish to packr as `@learnquest/lang-ui`.

### Phase 3: Register Language Lesson Screens

Same pattern as school-quest — each lang app registers its lesson type screens:

```tsx
// lq-nordic/src/main.tsx
import { LessonScreenRegistry } from '@learnquest/web-core/registry';
import { VocabLessonScreen } from './screens/vocab';
import { ConversationScreen } from './screens/conversation';
import { DrillScreen } from './screens/drill';

LessonScreenRegistry.register('vocab', VocabLessonScreen);
LessonScreenRegistry.register('conversation', ConversationScreen);
LessonScreenRegistry.register('drill', DrillScreen);
// ... etc for all lang lesson types
```

### Phase 4: Remove Direct Path Dependencies

Replace any remaining `file:` or workspace path references with packr imports. The vite.config `@/` alias pointing at `../../web/src` becomes unnecessary once lesson screens use `@learnquest/lesson-ui` and `@learnquest/lang-ui` components instead of importing from the web-app source.

## Package Hierarchy (Target State)

```
@learnquest/web-core        ← Bootstrap, config types, LessonScreenRegistry
@learnquest/lesson-ui       ← Shared lesson components (LessonShell, QuizCard, etc.)
@learnquest/lang-ui         ← Language-specific UI (VocabCard, ConversationBubble, etc.)
@learnquest/ui              ← Low-level UI primitives (Button, Card, Dialog)
@learnquest/hooks           ← Generic React hooks
@learnquest/web-app         ← Full app shell (for bootstrapSubjectApp/bootstrapApp)
```

Consumer apps only install what they need:
- school-quest: `web-core` + `lesson-ui`
- lang-quest: `web-core` + `lesson-ui` + `lang-ui`
- life-quest: `web-core` + `lesson-ui` (+ new `life-ui` if needed)

## Benefits

1. **Single source of truth** — shared components live in lq-core, published to packr
2. **No file copying** — all shared code is installed via npm from the registry
3. **Independent deployment** — each app can pin package versions
4. **Consistent patterns** — all app families use the same bootstrap + registry pattern
5. **Easy new app creation** — follow ARCHITECTURE.md steps, install packages, register screens

## Modularity Improvements

### Current Problem
The `@/` alias in vite.config points at `lq-core/apps/web/src/`, creating tight coupling. Any file in the web-app source tree is importable, making it hard to know which parts are stable API vs internal.

### Solution
Extract stable APIs into focused packages:
- Move `useLesson` hook → `@learnquest/lesson-ui/hooks`
- Move `LessonLayout` → `@learnquest/lesson-ui/components`
- Move `ContentPipeline` → `@learnquest/database` (already exists)

Remove the `@/` alias from subject/lang apps entirely. If they need something from web-app, it should be exported through a package.

### Migration Path
1. Identify all `@/` imports used by lang-quest screens
2. Ensure each import is available in a published package
3. Replace `@/` imports with package imports
4. Remove the `@/` alias from vite.config
5. Test that builds pass without path resolution to web-app source

## life-quest Integration

life-quest should follow the school-quest pattern exactly:

1. Create `lq-core/libs/life/life-ui/` with life-quest-specific components
2. Each life-quest app: install `@learnquest/web-core` + `@learnquest/lesson-ui` + `@learnquest/life-ui`
3. Register life lesson screens in `main.tsx` via `LessonScreenRegistry`
4. Use `SubjectApp` or create `LifeApp` component for the home screen
5. Deploy to Vercel with same vercel.json + .env.example pattern

The ARCHITECTURE.md in school-quest serves as the step-by-step blueprint.

## Implementation Effort

| Phase | Scope | Estimate |
|-------|-------|----------|
| 1 | Add .npmrc + packr deps to all 14 lang-quest apps | 1 hour |
| 2 | Create @learnquest/lang-ui package | 1 day |
| 3 | Register lesson screens in all lang apps | 1 day |
| 4 | Remove @/ alias, replace with package imports | 2 days |
| **Total** | | **~4 days** |

Phase 1 alone is a quick win that enables incremental adoption.
