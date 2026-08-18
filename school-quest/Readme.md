# School Quest

Subject-specific learning apps for the LearnQuest ecosystem. Each app is a Vite + React 19 app that consumes shared packages from `lq-core` via [packr](https://api.packr.blueforge.studio).

School subject apps can be integrated with the school platform **BrightPath**.

## Subject Apps

| Subject | Package | Path | Port | Chapters | Lesson Types |
|---------|---------|------|------|----------|-------------|
| Math | `@learnquest/math` | `lq-math/` | 3200 | 5 | arithmetic, geometry, number-sense, word-problem |
| Science | `@learnquest/science` | `lq-science/` | 3201 | 5 | classification, experiment, science-concept |
| History | `@learnquest/history` | `lq-history/` | 3202 | 5 | timeline, era-exploration, historical-figure |
| Geography | `@learnquest/geography` | `lq-geography/` | 3203 | 5 | map-quiz, geo-challenge, region-profile |
| Reading | `@learnquest/reading` | `lq-reading/` | 3204 | 6 | phonics, sight-words, fluency, comprehension, interactive-story |
| Writing | `@learnquest/writing` | `lq-writing/` | 3205 | 6 | handwriting, spelling, dictation, grammar, composition, creative-writing |

## App Structure

Each subject app follows the same layout:

```
lq-<subject>/
├── public/
│   ├── app.json              # App metadata
│   ├── taxonomy.json         # Subject taxonomy (epochs, themes, regions)
│   └── data/lessons/en/      # Lesson content by chapter
│       ├── chapter-1/*.json
│       ├── chapter-2/*.json
│       └── ...
├── src/
│   ├── main.tsx              # App entry point
│   ├── lesson-types/         # Subject-specific lesson type components
│   └── screens/              # Screen components per lesson type
├── package.json
├── packr.sync.json
├── .gitignore
└── .github/workflows/sync-core.yml
```

## Dependencies

All subject apps consume shared packages from lq-core (published to packr registry):
- `@learnquest/web-app` — React app shell
- `@learnquest/ui` — UI components
- `@learnquest/hooks` — React hooks

## Tech Stack

- Vite + React 19 + TypeScript
- Zustand for state management

## Development

```bash
cd lq-<subject>
pnpm install
pnpm dev          # Start dev server on assigned port
pnpm build        # Production build
pnpm preview      # Preview production build
```

## Scaffolding

New subject repos are scaffolded using `lq-operations`:
```bash
cd ../lq-operations
tsx scripts/scaffold-repo.ts --school <subject>
```
