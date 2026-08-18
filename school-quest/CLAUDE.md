# CLAUDE.md — School Quest

## Overview

Container for 6 subject-specific learning apps. Each subject is a Vite + React 19 app consuming shared packages from lq-core via packr registry.

## Subjects

| App | Package | Port | Lesson Types |
|-----|---------|------|-------------|
| lq-math | `@learnquest/math` | 3200 | arithmetic, geometry, number-sense, word-problem |
| lq-science | `@learnquest/science` | 3201 | classification, experiment, science-concept |
| lq-history | `@learnquest/history` | 3202 | timeline, era-exploration, historical-figure |
| lq-geography | `@learnquest/geography` | 3203 | map-quiz, geo-challenge, region-profile |
| lq-reading | `@learnquest/reading` | 3204 | phonics, sight-words, fluency, comprehension, interactive-story |
| lq-writing | `@learnquest/writing` | 3205 | handwriting, spelling, dictation, grammar, composition, creative-writing |

## App Structure

```
lq-<subject>/
├── content/               # Source content (optional; some subjects use this)
│   └── <topic>/          # e.g. algebra, biology, _shared
│       ├── lessons/      # Raw lesson files organized by chapter
│       ├── chapters.json # Simple chapter manifest (id, title, order)
│       └── meta.json
├── public/               # Served by Vite; lesson files used at runtime
│   ├── app.json
│   ├── taxonomy.json
│   ├── data/lessons/en/
│   │   ├── index.json   # Subject-level manifest
│   │   ├── chapter-*/   # Math/science: flat 2-level hierarchy
│   │   └── <epoch>/     # History: 3-level hierarchy (epoch/region/chapter)
│   │       └── <region>/
│   │           └── chapters.json
│   ├── audio/
│   └── images/
├── scripts/             # Content generation scripts
│   └── generate-chapters.ts
└── src/
    ├── main.tsx
    ├── lesson-types/    # Subject-specific lesson components
    └── screens/         # Screen components per lesson type
```

## Content / Public Duality

- **Math, Science, Geography, Reading, Writing**: Use `content/<topic>/lessons/` as the authoring source. Lessons are processed into `public/data/lessons/en/`.
- **History**: Bypasses `content/` pipeline. All 979 lessons are authored directly in `public/data/lessons/en/<epoch>/<region>/`. The `content/_shared/` directory is empty (used only for shared game assets like bosses.json).

## Lesson JSON Format

All subjects use the wrapped `{ lessons: [...] }` format. Each lesson file contains an array with a single lesson object:

```json
{
  "lessons": [{
    "id": "lesson-id",
    "title": "Lesson Title",
    "type": "lesson-type",
    "content": { ... },
    "chapterId": "chapter-1",
    "status": "locked",
    "xpReward": 80,
    "estimatedTime": 10,
    "difficulty": "beginner"
  }]
}
```

## Lesson ID Naming Convention

**CRITICAL**: Lesson IDs must be unique across a subject. When the same topic appears in multiple chapters, use chapter suffixes:

| Chapter | Lesson ID Pattern | Example |
|---------|------------------|---------|
| chapter-2 | `{topic}` (base) | `subtraction-basics` |
| chapter-3 | `{topic}-ch3` | `subtraction-basics-ch3` |
| chapter-4 | `{topic}-ch4` | `subtraction-basics-ch4` |
| chapter-5 | `{topic}-ch5` | `subtraction-basics-ch5` |

**Why**: Prevents duplicate ID collisions where the same ID exists in multiple chapters with different content.

**Audit Script**: Run `npx tsx scripts/audit-lesson-ids.ts` to detect duplicate IDs.

Chapter ordering is defined in `chapters.json`:
```json
{
  "epoch": "medieval",
  "region": "european",
  "chapters": [{
    "id": "chapter-1",
    "order": 1,
    "title": "Chapter Title",
    "description": "...",
    "lessons": [
      { "type": "lesson", "enabled": true, "id": "lesson-id", "order": 1 }
    ]
  }]
}
```

Run `npm run generate:chapters` to regenerate `chapters.json` from lesson filenames.

## Content Hierarchy

| Subject | Hierarchy | Manifest |
|---------|-----------|----------|
| Math, Science, etc. | subject → chapter → lesson | `chapters.json` at root |
| History | epoch → region → chapter → lesson | `chapters.json` per epoch/region |

## Dependencies

- `@learnquest/web-core` — Bootstrap bridge for subject apps
- `@learnquest/lesson-ui` — Shared lesson UI components (SubjectApp, LessonViewer, etc.)
- `@learnquest/ui` — UI components (shadcn/ui)
- `@learnquest/hooks` — Shared React hooks
- `zustand` — State management (standalone epoch preferences in lq-history)

## Integration

Subject apps integrate with the **BrightPath** school platform and share the same lesson framework as language apps via `@learnquest/lesson-framework`.

## Package Registry

All `@learnquest/*` packages are published to:
`https://api.packr.blueforge.studio`

## Content Audit (2026-04-16)

See `docs/audit/` for full audit report. Key findings:

- **Fixed**: 330 lesson files had duplicate IDs across chapters
- **Fixed**: All `chapters.json` manifests regenerated to match actual content
- **Fixed**: 779 History lessons - quiz correctAnswer converted from option string to index
- **Fixed**: 406 disabled History lessons now enabled
- **Fixed**: All History schema issues resolved - eraName, period, sections, events now properly added to all 879 History lessons

**Validation**: Run `npx tsx scripts/validate-all-content.ts` to validate all lessons against Zod schemas.
