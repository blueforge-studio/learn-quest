# libs/tools Extraction Proposal — Separate Monorepo

> Date: 2026-04-10

## Problem

`lq-core/libs/tools/` has grown to **15 packages / 1,800+ files / 78K+ lines**. It mixes:
- Generic reusable tooling (i18n, testing, image processing)
- LQ-specific build pipelines (app-builder, content, deploy)
- Already-extracted code that duplicates blueforge-org packages (image processing)

This makes lq-core harder to maintain and prevents reuse of the generic tools in other projects.

## Current Inventory

| # | Package | Lines | Class | Notes |
|---|---------|-------|-------|-------|
| 1 | assets | 29.4K | Hybrid | Elephant. `src/lib/` already extracted to `@blueforge-studio/image-processor` |
| 2 | shared | 12.1K | Hybrid | Hub — 11 packages depend on it. AI clients are portable, paths are LQ-specific |
| 3 | content | 11.2K | LQ-specific | Lesson enrichment, subject generation, gap audits |
| 4 | app-builder | 9.1K | LQ-specific | Language app scaffolding and generation |
| 5 | i18n | 4.6K | Generic | Translation tooling — no LQ references |
| 6 | validation | 3.0K | Hybrid | Zod schemas generic, path resolution LQ-specific |
| 7 | admin-tools | 2.5K | LQ-specific | Uses `@/` path aliases into web app |
| 8 | book-builder | 2.1K | Hybrid | Generic pipeline, LQ book schemas |
| 9 | testing | 1.8K | Generic | Code health, coverage analysis |
| 10 | utils | 1.8K | Generic | Dev utilities (JSON, images, structure) |
| 11 | e2e-runner | 1.1K | Hybrid | Generic orchestration, LQ domain config |
| 12 | deploy | 873 | LQ-specific | Hardcoded to apps/web |
| 13 | test-agent | — | Generic | Already uses blueforge packages |
| 14 | test-reporter | — | Generic | Transport layer for test results |
| 15 | test-utils | — | Generic | Test setup/mocks |

### Classification Summary

| Class | Packages | Lines | Action |
|-------|----------|-------|--------|
| **Generic (A)** | i18n, test-agent, test-reporter, test-utils, testing, utils | ~8K | Extract to `lq-tools` monorepo |
| **LQ-specific (B)** | admin-tools, app-builder, content, deploy | ~24K | Stay in lq-core |
| **Hybrid (C)** | assets, book-builder, e2e-runner, shared, validation | ~46K | Split: generic core → lq-tools, LQ-specific → lq-core |

## Proposed Structure

### New repo: `lq-tools` (monorepo on blueforge-studio)

```
lq-tools/                              # NEW REPO — shared dev tooling
├── packages/
│   ├── i18n/                          # @learnquest/i18n-tools (4.6K lines)
│   ├── testing/                       # @learnquest/testing (1.8K lines)
│   ├── dev-utils/                     # @learnquest/dev-utils (1.8K lines)
│   ├── test-agent/                    # @learnquest/test-agent
│   ├── test-reporter/                 # @learnquest/test-reporter
│   ├── test-utils/                    # @learnquest/test-utils
│   ├── e2e-runner/                    # @learnquest/e2e-runner (generic core)
│   ├── validation-engine/             # @learnquest/validation-engine (Zod engine, no LQ schemas)
│   └── tools-shared/                  # @learnquest/tools-shared (split: generic AI clients, CLI helpers)
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

### Stays in lq-core: `libs/tools/` (slimmed)

```
lq-core/libs/tools/
├── admin-tools/           # @learnquest/admin-tools (LQ-specific)
├── app-builder/           # @learnquest/app-builder (LQ-specific)
├── assets/                # @learnquest/asset-tools (LQ-specific scripts only)
│   └── src/
│       ├── lib/           # REMOVED — use @blueforge-studio/image-processor
│       ├── image-gen/     # LQ AI image generation (Vault7 adapters)
│       ├── audio/         # LQ audio generation
│       ├── tts/           # LQ TTS generation
│       ├── video/         # LQ video generation
│       ├── logos/         # LQ logo generation
│       └── tools/         # LQ image fix scripts
├── book-builder/          # @learnquest/book-builder (LQ-specific)
├── content/               # @learnquest/content-tools (LQ-specific)
├── deploy/                # @learnquest/deploy (LQ-specific)
└── validation/            # @learnquest/validation (LQ schemas, imports engine from lq-tools)
```

## Blueforge Overlap Resolution

### Image Processing (assets/src/lib/)

| lq-core file | Blueforge equivalent | Action |
|-------------|---------------------|--------|
| `lib/ImageProcessor.ts` | `@blueforge-studio/image-processor` | **Delete** — use blueforge |
| `lib/CroppingService.ts` | `@blueforge-studio/image-processor` | **Delete** — use blueforge |
| `lib/BorderProcessor.ts` | `@blueforge-studio/image-processor` | **Delete** — use blueforge |
| `lib/BackgroundAnalyzer.ts` | `@blueforge-studio/image-processor` | **Delete** — use blueforge |
| `lib/CheckerboardFixer.ts` | `@blueforge-studio/image-processor` | **Delete** — use blueforge |
| `lib/TransparencyService.ts` | `@blueforge-studio/image-processor` | **Delete** — use blueforge |
| `lib/VariantService.ts` | `@blueforge-studio/image-processor` | **Delete** — use blueforge |
| `tools/batch-fix-images.ts` | No equivalent | **Keep** — LQ-specific batch pipeline |
| `tools/fix-transparency.ts` | `TransparencyService` | **Refactor** — call blueforge |
| `tools/fix-checkerboard.ts` | `CheckerboardFixer` | **Refactor** — call blueforge |
| `tools/crop-edges.js` | `CroppingService` | **Refactor** — call blueforge |
| `tools/analyze-bg.ts` | `BackgroundAnalyzer` | **Refactor** — call blueforge |

### Logo Processing

| Need | Blueforge package | Action |
|------|-------------------|--------|
| Process logos (resize, optimize) | `@blueforge-studio/logo-processor` | **Use for generic processing** |
| Generate group logos/symbols | `lq-core/libs/tools/assets/src/logos/` | **Keep** — LQ-specific AI generation |
| Verify logos exist per app | None | **New script** in lq-operations |

### shared/ Split

The `shared` package needs splitting:

| Layer | Destination | Contents |
|-------|-------------|----------|
| AI clients | `lq-tools/packages/tools-shared/` | GeminiTextClient, AnthropicTextClient, GLMTextClient, ReplicateTextClient, GameVaultTextClient |
| CLI helpers | `lq-tools/packages/tools-shared/` | logger, formatDuration, progress tracking, batch worker |
| LQ paths | `lq-core/libs/tools/shared/` | paths.ts (APPS_DIR, PUBLIC_PATH), app-registry.ts, env loading |
| Notifications | `lq-core/libs/tools/shared/` | LQ email notifications |

## Implementation Plan

### Phase 1: Create lq-tools repo with portable packages (medium effort)

1. Create `lq-tools` repo on blueforge-studio (private)
2. Set up pnpm monorepo + Turborepo
3. Move 6 generic packages: i18n, testing, dev-utils, test-agent, test-reporter, test-utils
4. Publish to packr
5. Update lq-core to consume from packr instead of local

### Phase 2: Replace image processing with blueforge (medium effort)

6. Add `@blueforge-studio/image-processor` as dependency in assets
7. Delete `assets/src/lib/` (7 files — all duplicated in blueforge)
8. Update `assets/src/tools/` scripts to import from `@blueforge-studio/image-processor`
9. This removes ~3K lines from assets (29K → 26K)

### Phase 3: Split shared package (medium effort)

10. Extract generic AI clients and CLI helpers to `lq-tools/packages/tools-shared/`
11. Keep LQ-specific paths/registry/notifications in `lq-core/libs/tools/shared/`
12. Update all 11 consumer packages to import from the correct source

### Phase 4: Logo verification and generation (low effort)

13. Create `lq-operations/scripts/audit-logos.ts` — checks every app has a logo in expected path
14. Use `@blueforge-studio/logo-processor` for processing
15. Use LQ assets/logos scripts for AI generation of missing logos

## Expected Result

| Metric | Before | After |
|--------|--------|-------|
| lq-core/libs/tools/ packages | 15 | 7 (LQ-specific only) |
| lq-core/libs/tools/ lines | 78K+ | ~50K |
| lq-tools packages | 0 | 8 (generic, published to packr) |
| Image processing duplication | 7 files duplicated with blueforge | 0 — uses @blueforge-studio/image-processor |
| Cross-project reuse | None | i18n, testing, e2e-runner available to all projects |
