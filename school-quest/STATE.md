# School-Quest State of Affairs

Full audit of the school-quest container (6 subject apps).

## Content Completeness

| Subject | Chapters | Lessons | Lesson Types | Validated | Status |
|---------|----------|---------|--------------|-----------|--------|
| Math | 5 | 40 | arithmetic, geometry, number-sense, word-problem | 40/40 (100%) | Complete |
| Science | 5 | 37 | classification, experiment, science-concept | 37/37 (100%) | Complete |
| History | 5 | 52 | timeline, era-exploration, historical-figure | 52/52 (100%) | Complete |
| Geography | 5 | 40 | map-quiz, region-profile, geo-challenge | 40/40 (100%) | Complete |
| Reading | 6 | 42 | phonics, sight-words, fluency, comprehension, interactive-story | 42/42 (100%) | Complete |
| Writing | 6 | 42 | handwriting, spelling, dictation, grammar, composition, creative-writing | 42/42 (100%) | Complete |

**Total**: 253 lessons across 6 apps. All validated against Zod schemas at 100%.

## Assets

Very minimal — each app has only `logo.svg` + `favicon.svg`. No audio, video, or instructional images yet. The directory structure (`_shared/images/`, `content/_shared/game/`) is scaffolded and ready but empty.

## Tech Stack (shared)

- Vite 6 + React 19 + TypeScript + Tailwind CSS 4 + Zustand
- Consumes `@learnquest/web-app`, `@learnquest/ui`, `@learnquest/hooks`, `@learnquest/lesson-framework` from lq-core via packr
- Ports 3200-3205, Playwright for E2E

## Asset Pipeline Status

The tooling for generating image assets exists in `lq-tools/packages/asset-scaffolding` but has **not been run** for school-quest subjects.

### Category definitions (ready)

7 subject category definitions in `lq-tools/packages/image-tools/src/categories/subjects/`:

| Category | File | Target Subject |
|----------|------|----------------|
| historical-figures | `historical-figures.ts` | History |
| landmarks | `landmarks.ts` | Geography |
| maps | `maps.ts` | Geography |
| geometry-shapes | `geometry-shapes.ts` | Math |
| diagrams | `diagrams.ts` | Science |
| reading | `reading.ts` | Reading |
| writing | `writing.ts` | Writing |

### Config generation (not yet run)

The `scaffold-subject-configs.ts` script generates JSON image configs per subject. Output directory `config/subjects/` is currently empty.

```bash
# Generate image configs for each subject:
npx tsx scripts/assets/scaffold-subject-configs.ts --subject=history
npx tsx scripts/assets/scaffold-subject-configs.ts --subject=geography
npx tsx scripts/assets/scaffold-subject-configs.ts --subject=math
npx tsx scripts/assets/scaffold-subject-configs.ts --subject=science
```

Options: `--dry-run`, `--force`, `--categories=<cat1,cat2>`, `--list`

### Image generation (blocked on configs)

Once configs exist, `generate-assets.ts` can produce actual images via Gemini or GameVault AI. This step requires API keys (`GEMINI_API_KEY` or `GAMEVAULT_API_KEY` + `VAULT7_API_URL`).

## Key Gaps

1. **Media assets** — infrastructure exists, image configs scaffolded, but no actual images/audio generated (needs API keys)
2. **Production deployment** — vercel.json + .env.example created, but no apps deployed yet (needs Postgres schema, Forge Auth registration, Stripe products)
3. **History** has the most complex hierarchy (3-level with era -> region -> topic), all others are 2-level
