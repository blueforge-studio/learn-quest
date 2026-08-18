# Subject App Integration Architecture

Blueprint for how subject apps (school-quest, life-quest, etc.) integrate with `lq-core` via the packr registry. This document serves as the handover reference for replicating the pattern.

## Overview

```
┌─────────────────────────────────────────────────────┐
│                    lq-core (monorepo)                │
│                                                      │
│  @learnquest/web-core     ← bootstrap + registry     │
│  @learnquest/lesson-ui    ← shared lesson components  │
│  @learnquest/web-app      ← full app shell (future)   │
│  @learnquest/ui           ← UI primitives              │
│  @learnquest/hooks        ← shared React hooks         │
│                                                      │
│  Published to: https://api.packr.blueforge.studio    │
└──────────────────────┬──────────────────────────────┘
                       │ npm install from packr
        ┌──────────────┼──────────────────┐
        │              │                  │
   school-quest   lang-quest         life-quest
   (6 subject     (14 language       (future)
    apps)          groups)
```

## Package Architecture

### Published Packages (packr registry)

| Package | Version | Purpose |
|---------|---------|---------|
| `@learnquest/web-core` | 0.2.0 | App bootstrap, `LessonScreenRegistry`, `SubjectAppConfig` type, shared Vite config |
| `@learnquest/lesson-ui` | 0.1.0 | Shared lesson components (`LessonShell`, `QuizCard`, `OptionGrid`, etc.) and hooks (`useLessonLoader`, `useQuizState`) |

### Package Locations in lq-core

```
lq-core/
├── apps/
│   ├── lang-core/          → @learnquest/web-core
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── types.ts           (AppConfig, SubjectAppConfig)
│   │   │   ├── bootstrap.ts       (bootstrapApp — for lang apps)
│   │   │   ├── bootstrap-subject.ts (bootstrapSubjectApp — for subject apps)
│   │   │   └── LessonScreenRegistry.ts (singleton Map<type, Component>)
│   │   └── vite.shared.ts        (createLangAppConfig, createSubjectAppConfig)
│   └── web/                → @learnquest/web-app (full shell)
│       └── src/
│           └── screens/lessons/shared/components/
│               └── LessonContainer.tsx (registry-driven dispatcher)
├── libs/
│   └── school/
│       └── lesson-ui/      → @learnquest/lesson-ui
│           └── src/
│               ├── components/    (LessonShell, LessonHeader, OptionGrid, QuizCard, ContentCard, StageNavigation)
│               └── hooks/         (useLessonLoader, useQuizState)
```

## Subject App Structure (The Pattern)

Every subject app follows this exact structure:

```
lq-<subject>/
├── .npmrc                  ← packr registry config
├── package.json            ← deps: @learnquest/web-core, @learnquest/lesson-ui, react-router-dom
├── vite.config.ts          ← Vite + React + Tailwind
├── tsconfig.json
├── vercel.json             ← SPA routing
├── .env.example            ← Auth env vars
├── lq.config.json          ← subject config (categories, difficulty)
├── public/
│   ├── app.json            ← subject metadata
│   ├── data/lessons/en/
│   │   ├── chapters.json   ← chapter manifest
│   │   └── chapter-*/      ← lesson JSON files
│   ├── images/lessons/     ← AI-generated images
│   └── audio/lessons/      ← Edge TTS audio
└── src/
    ├── main.tsx            ← registers screens + renders app
    ├── App.tsx             ← Routes + SubjectApp fallback
    ├── index.css           ← Tailwind import
    ├── components/
    │   └── SubjectApp.tsx  ← standalone chapter/lesson UI
    └── screens/
        ├── index.ts        ← barrel export
        └── <type>/
            ├── index.ts
            └── <Type>LessonScreen.tsx
```

## Integration Steps (How to Create a New Subject App)

### Step 1: Scaffold

```bash
mkdir lq-newsubject && cd lq-newsubject
npm init -y
```

### Step 2: Configure Registry

Create `.npmrc`:
```
@learnquest:registry=https://api.packr.blueforge.studio
@blueforge-studio:registry=https://api.packr.blueforge.studio
```

### Step 3: Install Dependencies

```bash
npm install react react-dom react-router-dom @learnquest/web-core @learnquest/lesson-ui
npm install -D vite @vitejs/plugin-react tailwindcss @tailwindcss/vite typescript
```

### Step 4: Create Entry Point (`src/main.tsx`)

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { LessonScreenRegistry } from '@learnquest/web-core/registry';
import './index.css';
import App from './App';

// Import and register your lesson screens
import { MyLessonScreen } from './screens/my-type';
LessonScreenRegistry.register('my-type', MyLessonScreen);

// Set app config
(window as any).__APP_CONFIG__ = {
  appType: 'school',
  subject: 'newsubject',
  appName: 'NewSubject Quest',
  icon: '🎯',
  gradient: 'bg-gradient-to-r from-blue-600 to-indigo-600',
};
(window as any).__APP_TYPE__ = 'school';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
```

### Step 5: Create App with Routing (`src/App.tsx`)

```tsx
import { Routes, Route } from 'react-router-dom';
import { SubjectApp } from './components/SubjectApp';
import { LessonScreenRegistry } from '@learnquest/web-core/registry';

function LessonContainer() {
  const match = window.location.pathname.match(/\/lessons\/([^/]+)\/(.+)/);
  if (!match) return <div className="p-6 text-gray-500">No lesson selected</div>;
  const [, type, lessonId] = match;
  const Screen = LessonScreenRegistry.get(type);
  if (!Screen) return <div className="p-6 text-gray-500">Unknown type: {type}</div>;
  return <Screen lessonId={lessonId} />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/lessons/:type/:lessonId" element={<LessonContainer />} />
      <Route path="*" element={<SubjectApp config={{...}} />} />
    </Routes>
  );
}
```

### Step 6: Create Lesson Screens

Each screen takes `{ lessonId: string }` and uses shared components:

```tsx
import { useLessonLoader } from '@learnquest/lesson-ui/hooks';
import { useQuizState } from '@learnquest/lesson-ui/hooks';
import { LessonShell, QuizCard, ContentCard } from '@learnquest/lesson-ui/components';

interface MyContent { intro: string; questions: {...}[]; difficulty: string; }

export const MyLessonScreen = ({ lessonId }: { lessonId: string }) => {
  const { lesson, loading, error } = useLessonLoader<MyContent>(lessonId);
  const { select, isRevealed, getSelected } = useQuizState();

  return (
    <LessonShell title={lesson?.title ?? ''} loading={loading} error={error}>
      {/* Render type-specific content using shared components */}
    </LessonShell>
  );
};
```

### Step 7: Add Content

Place lesson JSON in `public/data/lessons/en/chapter-*/` and create `chapters.json`.

### Step 8: Deploy

```bash
vercel link --scope kmandrups-projects
vercel deploy --prod
```

## Key Concepts

### LessonScreenRegistry

A singleton `Map<string, Component>` that enables pluggable lesson screens. Screens are registered before the app shell mounts, so there's no race condition.

```
main.tsx → LessonScreenRegistry.register('arithmetic', ArithmeticScreen)
         → LessonScreenRegistry.register('geometry', GeometryScreen)
         → Shell renders → LessonContainer reads registry → dispatches
```

### SubjectAppConfig

```typescript
interface SubjectAppConfig {
  appType: 'school';
  subject: string;     // 'math', 'science', etc.
  appName: string;     // 'Math Quest'
  icon: string;        // emoji
  color: string;
  gradient: string;    // Tailwind gradient classes
}
```

### Shared Components (`@learnquest/lesson-ui`)

| Component | Purpose |
|-----------|---------|
| `LessonShell` | Loading/error/layout wrapper with header |
| `LessonHeader` | Gradient header with back nav + badges |
| `OptionGrid` | Answer selection grid with correct/incorrect feedback |
| `QuizCard` | Question + options + explanation reveal |
| `ContentCard` | Styled card (default/highlight/success/warning variants) |
| `StageNavigation` | Previous/Next stage controls |

| Hook | Purpose |
|------|---------|
| `useLessonLoader<T>` | Fetches lesson JSON from chapter dirs, returns typed content |
| `useQuizState` | Manages answer selection, reveal state, reset |

### Content Pipeline

Lessons are served as static JSON from `public/data/lessons/en/chapter-*/`. The `useLessonLoader` hook scans all chapters to find the lesson by ID.

## Future: Full Shell Integration

When ready to use the full `@learnquest/web-app` shell (routing, auth, theme, DB, PWA), replace `main.tsx` with:

```tsx
import { bootstrapSubjectApp } from '@learnquest/web-core/bootstrap-subject';
import { ArithmeticLessonScreen } from './screens/arithmetic';

bootstrapSubjectApp({
  config: { appType: 'school', subject: 'math', ... },
  screens: { 'arithmetic': ArithmeticLessonScreen },
});
```

This lazy-loads the full web-app shell via `import('@learnquest/app/src/main')`, which provides routing, auth, theme, PWA, and all providers.

## Publishing Workflow

### Creating a packr token

```bash
packr-cli token create --name <name> --role ci-publish --scope @learnquest
```

### Publishing a package

```bash
cd lq-core/libs/school/lesson-ui
# Set .npmrc with token
npm publish
```

### GitHub Actions CI

```yaml
env:
  PACKR_TOKEN: ${{ secrets.PACKR_TOKEN_LEARNQUEST }}
steps:
  - run: npm install  # reads from packr via .npmrc
  - run: npm publish  # publishes to packr (release workflow only)
```

## Current State (2026-04-14)

| App | Screens | Packr Deps | Deployed |
|-----|---------|------------|----------|
| lq-math | 4 (arithmetic, geometry, number-sense, word-problem) | lesson-ui, web-core | lq-math.vercel.app |
| lq-science | 3 (experiment, classification, science-concept) | lesson-ui, web-core | lq-science.vercel.app |
| lq-history | 3 (timeline, era-exploration, historical-figure) | lesson-ui, web-core | lq-history.vercel.app |
| lq-geography | 3 (map-quiz, region-profile, geo-challenge) | lesson-ui, web-core | lq-geography.vercel.app |
| lq-reading | 5 (phonics, sight-words, fluency, comprehension, interactive-story) | lesson-ui, web-core | lq-reading.vercel.app |
| lq-writing | 6 (handwriting, spelling, dictation, grammar, composition, creative-writing) | lesson-ui, web-core | lq-writing.vercel.app |

**Content**: 253 lessons, 252 images, 225 audio clips, 100% Zod validation.
