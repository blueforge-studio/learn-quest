# Tech Debt Audit — Scripts & Tooling

> Date: 2026-04-11
> Scope: All generation, audit, and publish scripts across the ecosystem

## Critical Issues

### 1. Massive Script Duplication (HIGHEST PRIORITY)

**Problem:** The same script is copied to 14+ repos with only the voice/language config changing.

| Script | Copies | Lines Each | Total Duplicated Lines |
|--------|--------|------------|----------------------|
| `generate-audio.ts` | 15 copies | ~170 | **2,550** |
| `audit-assets.ts` | 20 copies | 44 (old) / 144 (fixed) | **880** |
| `generate-lessons.ts` | 6 copies | ~185 | **1,110** |
| `publish-changed.ts` | 3 copies | ~290 | **870** |
| `validate-lessons.ts` | 14 copies | 64 | **896** |
| `audit-logo.ts` | 14 copies | 22 | **308** |
| `validate.ts` | 14 copies | 17 | **238** |
| **Total** | | | **~6,850 duplicated lines** |

**Impact:** When we fix a bug (like the audit-assets path resolution), we have to update 20 files. Only Nordic got the fix — 13 other groups still have the broken version.

**Fix:** Extract to shared packages in lq-tools. Per-app scripts become thin wrappers:
```typescript
// lq-nordic/scripts/generate-audio.ts (3 lines instead of 170)
import { generateAudio } from '@learnquest/audio-tools/cli';
generateAudio({ voices: { danish: 'da-DK-ChristelNeural', ... } });
```

### 2. God Functions (>100 lines)

| Function | File | Lines | Problem |
|----------|------|-------|---------|
| `main()` | enrich-lesson-images.ts | 228 | Does scanning, filtering, generation, injection, reporting |
| `generateImage()` | enrich-lesson-images.ts | 136 | Replicate API + polling + retry + buffer handling |
| `extractTasksFromLesson()` | enrich-lesson-images.ts | 125 | Handles 4 lesson types in one function |
| `generateAudio()` | generate-audio.ts | 74 | Edge-TTS CLI + error handling |
| `generateForCategory()` | generate-subject-lessons.ts | 60 | Qwen API + file writing |

**Fix:** Extract into focused modules:
- `replicate-client.ts` — Replicate API wrapper with retry/rate-limit
- `lesson-scanner.ts` — Extracts image/audio needs from lesson JSON
- `image-injector.ts` — Injects refs back into JSON
- `progress-reporter.ts` — Progress bars and stats

### 3. Inconsistent Audit Scripts

**Problem:** Nordic has a fixed 144-line `audit-assets.ts` with locale/chapter filters. The other 19 copies have the old broken 44-line version that:
- Resolves audio paths to `public/` (wrong)
- Doesn't support `--by-chapter`, `--summary`, `--by-type`
- Reports inflated numbers (29K instead of actual gaps)

**Fix:** Deploy the fixed version to all apps, or better — use a single shared script from lq-tools.

### 4. Hardcoded Paths

| Script | Hardcoded Path | Should Use |
|--------|---------------|------------|
| `generate-audio.ts` (per-app) | `languages/${LANG}/audio` | `loadConfig().resolvedPaths` |
| `generate-lessons.ts` (per-app) | `languages/${LANG}/data/en/lessons` | `loadConfig().resolvedPaths` |
| `audit-assets.ts` (old version) | `path.resolve('public', url)` | Both `public/` and `languages/` |
| `upload-assets.ts` | `languages/${lang}/data` | `loadConfig().resolvedPaths` |

### 5. Missing Error Handling

| Script | Issue |
|--------|-------|
| `generate-audio.ts` | No budget tracking, no cost reporting |
| `generate-lessons.ts` | No retry on Qwen API failures |
| `publish-changed.ts` | Swallows publish errors silently |
| `enrich-lesson-images.ts` | ✅ Has proper error handling (newest script) |

### 6. No Shared Utilities

Common patterns reimplemented in every script:
- Replicate API client (3 implementations)
- Qwen API client (2 implementations)  
- Edge-TTS CLI wrapper (15 implementations)
- Progress bar / reporting (5+ implementations)
- Budget tracking (2 implementations)
- JSON file scanning / walking (10+ implementations)
- slugify / filename sanitization (3+ implementations)

## Proposed Refactoring

### Phase 1: Extract Shared CLI Modules (to lq-tools/packages/tools-shared)

```
tools-shared/src/cli/
├── replicate-client.ts    — Replicate API with retry, rate limit, budget
├── qwen-client.ts         — Qwen API with retry, budget
├── edge-tts-client.ts     — Edge-TTS wrapper with voice config
├── progress-reporter.ts   — Progress bar, stats, summary
├── budget-tracker.ts      — Budget cap enforcement
├── lesson-scanner.ts      — Extract refs from lesson JSON (image, audio)
├── json-walker.ts         — Walk/modify nested JSON structures
├── slugify.ts             — Consistent filename sanitization
└── worker-pool.ts         — Parallel task execution with rate limiting
```

### Phase 2: Consolidate Per-App Scripts

**Before (14 copies of generate-audio.ts):**
```
lq-nordic/scripts/generate-audio.ts         — 168 lines
lq-southeast-asian/scripts/generate-audio.ts — 172 lines
lq-romance/scripts/generate-audio.ts        — 169 lines
... (12 more copies)
```

**After (1 shared + 14 thin wrappers):**
```
lq-tools/packages/audio-tools/src/cli/generate-audio-cli.ts — 200 lines (shared)

lq-nordic/scripts/generate-audio.ts — 10 lines:
  import { runAudioGeneration } from '@learnquest/audio-tools/cli';
  import voices from './voices.json';
  runAudioGeneration({ voices });

lq-nordic/scripts/voices.json — 10 lines:
  { "danish": { "female": "da-DK-ChristelNeural", "male": "da-DK-JeppeNeural" }, ... }
```

### Phase 3: Consolidate Audit Scripts

**Before (20 copies of audit-assets.ts):**
- 1 fixed version (Nordic, 144 lines)
- 19 broken versions (44 lines each)

**After:**
```
lq-tools/packages/content-audit/src/cli/audit-assets-cli.ts — 150 lines (shared)

lq-nordic/scripts/audit-assets.ts — 3 lines:
  import { runAssetAudit } from '@learnquest/content-audit/cli';
  runAssetAudit();  // reads lq.config.json from cwd
```

### Phase 4: Break Down enrich-lesson-images.ts (894 → ~400)

**Current:** 894 lines, one file, functions up to 228 lines

**After:**
```
lq-tools/scripts/enrich-lesson-images.ts    — 150 lines (CLI + orchestration)
tools-shared/src/cli/replicate-client.ts    — 80 lines (API wrapper)
tools-shared/src/cli/lesson-scanner.ts      — 120 lines (scan + extract)
tools-shared/src/cli/image-injector.ts      — 50 lines (inject refs into JSON)
tools-shared/src/cli/worker-pool.ts         — 60 lines (parallel execution)
tools-shared/src/cli/progress-reporter.ts   — 40 lines (progress + stats)
```

## Effort Estimate

| Phase | Effort | Impact |
|-------|--------|--------|
| Phase 1: Shared modules | 4 hours | Enables all other phases |
| Phase 2: Audio scripts | 2 hours | Eliminates 2,550 duplicate lines |
| Phase 3: Audit scripts | 1 hour | Fixes 19 broken audit scripts |
| Phase 4: Break down enrichment | 2 hours | Makes script maintainable |
| **Total** | **9 hours** | **~5,000 lines eliminated** |

## Priority Order

1. **Phase 3 first** — fix the 19 broken audit scripts (1 hour, highest bug impact)
2. **Phase 1** — extract shared modules (4 hours, enables everything)
3. **Phase 2** — consolidate audio scripts (2 hours, biggest duplication)
4. **Phase 4** — break down enrichment (2 hours, newest code, least urgent)
