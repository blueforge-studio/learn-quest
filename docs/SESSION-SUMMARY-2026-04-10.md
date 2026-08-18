# LearnQuest Ecosystem — Session Summary

> Date: 2026-04-10
> Scope: Full ecosystem audit, restructuring, tooling, asset porting, image generation

---

## What Was Done

### 1. Ecosystem Audit & Documentation

- Audited all projects in `learn-quest/` against README files and actual structure
- Deleted legacy `docs/PORT_PLAN.md`, created `docs/ARCHITECTURE.md` with full ecosystem architecture
- Created `lq-core/README.md` with complete project documentation
- Reorganized `lq-core/docs/` — archived 48 transient docs (287 audit iteration files), kept 23 active docs
- Updated all README/CLAUDE.md files for school-quest, books-platform, lang-quest
- Created 8 analysis documents in `docs/analysis/`:
  - `Repo-Analysis-Recommendations.md` — sizing, grouping, priority matrix
  - `Scripts-Deduplication-Plan.md` — apps/web/scripts ↔ libs/tools mapping
  - `Screen-Domains-Extraction-Plan.md` — decoupling circular deps
  - `E2E-Test-Analysis.md` — coverage gaps, Firebase cleanup
  - `AI-Package-Consolidation-Plan.md` — blueforge ↔ learnquest AI overlap
  - `Remote-Repo-Mapping.md` — 25 repos on blueforge-studio
  - `Tools-Extraction-Proposal.md` — libs/tools → lq-tools monorepo
  - `Lang-App-Asset-Comparison.md` — Thai vs Danish asset parity
  - `LinguaQuest-Integration-Analysis.md` — cross-pollination audit
  - `App-Testing-and-Audit-Proposal.md` — 3-tier testing strategy

### 2. GitHub Repos (25 private repos on blueforge-studio)

Created, committed, and pushed all repos:

| Category | Repos | Org |
|----------|-------|-----|
| Core | lq-core, lq-site, lq-operations, lq-tools, books-platform | blueforge-studio |
| Language groups (14) | lq-nordic, lq-romance, lq-southeast-asian, lq-east-asian, lq-balkan, lq-slavic, lq-west-slavic, lq-south-asian, lq-african, lq-middle-eastern, lq-celtic, lq-germanic, lq-uralic, lq-english | blueforge-studio |
| School subjects (6) | lq-math, lq-science, lq-history, lq-geography, lq-reading, lq-writing | blueforge-studio |

### 3. Code Deduplication (lq-core)

- **Scripts dedup**: Removed 1,665 byte-identical files (~163K lines) from `apps/web/scripts/`. Canonical copies in `libs/tools/`. Rewired 88 package.json script entries.
- **Further extraction**: Moved validation/, testing/, deploy/, tools/, utils/, e2e/ into `libs/tools/` packages (6 more packages).

### 4. Firebase → Supabase E2E Cleanup

- Deleted 45 Firebase emulator spec files
- Removed all Firebase infrastructure (global-setup.ts, emulatorTestSetup.ts, AuthTestHelper, etc.)
- Rewrote `playwright.config.ts` — mock-only testing (no Firebase projects)
- Cleaned page objects, seeders, test helpers of all Firebase references
- Zero Firebase references remain in E2E directory
- Added 19 new mock specs to recover coverage (136 total)
- Added 7 page objects (10 total): LessonMap, Admin, Challenge, Shop, Social, Onboarding, Dashboard

### 5. Screen Domain Decoupling (lq-core)

Broke the circular dependency: **admin → lessons → profile → admin**

Extracted 7 services to `libs/app/app-services/`:
- PlayerService, LessonService, SRSService, LimitService
- AchievementImageGenerator, GDPRService, StripeCheckoutService

### 6. Zod Schema Migration

- Created `LocaleManifestSchema` and `TaxonomySchema` in `@learnquest/schemas`
- Deleted JSON Schema files from `data/`
- Updated `SchemaLoader` and `validate-subject-content.ts` to use Zod

### 7. AI Package Consolidation

- Added DeepSeek + Ollama adapters to `@blueforge-studio/ai-gateway` (10 providers total)
- Migrated 5 import sites from `@learnquest/ai-sdk` to `@blueforge-studio/ai-gateway`
- Slimmed `ai-sdk` from 3.2K → 2.3K lines (Vault7-only)
- Wired `@blueforge-studio/ai-budget` into content enrichment pipeline

### 8. lq-tools Monorepo (27 packages)

Extracted from `lq-core/libs/tools/` into standalone repo:

| Category | Packages |
|----------|----------|
| Asset tools (8) | image-tools, image-validation, audio-tools, tts-tools, video-tools, logo-tools, asset-scaffolding, asset-migration |
| Content tools (3) | content-enrichment, content-generators, content-audit |
| App building (2) | app-generators, app-audit |
| Validation (2) | validation-engine, validation-schemas |
| Testing (5) | testing, test-agent, test-reporter, test-utils, e2e-runner |
| Infrastructure (7) | ai-clients, tools-shared, i18n, deploy-tools, admin-tools, book-builder, dev-utils |

### 9. School Quest Content Porting

- Ported all 6 subjects from legacy (lesson JSON, screens, lesson-type components)
- Flattened directory structure (`public/apps/subjects/<name>/` → `public/data/`)
- Each subject has 5-6 chapters with lesson content

### 10. App Setup (all 20 apps)

Every lang-quest and school-quest app now has:
- React 19 + Vite app shell (`src/App.tsx`, `index.html`, `vite.config.ts`)
- Playwright config + 4 smoke tests + 3 visual tests (with baselines)
- Validation scripts (`validate-lessons.ts`, `audit-assets.ts`, `audit-logo.ts`)
- Generated SVG logo + favicon (unique gradient per app)
- Git LFS for binary assets
- `lq.config.json` for configurable paths
- `sync-core.yml` CI workflow
- Standalone deps (no workspace:* — works with `pnpm install`)

### 11. lq-operations Orchestration Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `smoke-test-apps.ts` | `pnpm smoke:all/school/lang` | Run smoke tests across apps |
| `validate-apps.ts` | `pnpm validate:all/school/lang` | Run lesson/asset/logo validation |
| `audit-apps.ts` | `pnpm audit:all/school/lang` | Full audit (validations + smoke) |
| `audit-ports.ts` | `pnpm audit:ports` | Port consistency check |
| `generate-logos.ts` | `pnpm logos:generate` | Generate SVG logos for apps |
| `scaffold-repo.ts` | `pnpm scaffold / --school` | Scaffold new lang or school repos |

### 12. Image Asset Porting (all 14 language groups)

Ported legacy image assets with flattened structure + Git LFS:

| Group | Total Images | Shared | Vocab | Status |
|-------|-------------|--------|-------|--------|
| nordic | 1,437 + 591 vocab | 231 | 465 shared + 126 generated ($0.38) | ✅ Complete |
| southeast-asian | 3,337 | 229 | 615 (Thai reference) | ✅ Complete |
| african | 808 | 274 | — | ✅ Ported |
| balkan | 1,356 | 278 | — | ✅ Ported |
| celtic | 802 | 262 | — | ✅ Ported |
| east-asian | 1,088 | 253 | — | ✅ Ported |
| english | 178 | 0 | — | ✅ Ported |
| germanic | 515 | 261 | — | ✅ Ported |
| middle-eastern | 865 | 261 | — | ✅ Ported |
| romance | 1,263 | 251 | — | ✅ Ported |
| slavic | 993 | 253 | — | ✅ Ported |
| south-asian | 882 | 261 | — | ✅ Ported |
| uralic | 185 | 68 | — | ✅ Ported |
| west-slavic | 1,335 | 160 | — | ✅ Ported |

**Shared vocab library**: `lang-quest/shared-vocab-images/` — 465 universal images (34 categories, 29MB) from Thai. Can be copied to any language group.

### 13. Vocab Image Generation

- Used Replicate Flux Schnell (`$0.003/image`)
- Generated 126 Nordic-specific images: nouns, verbs, adjectives, pronouns, entertainment, social-media, business, economy, abstract, idioms, slang, numbers, routines, family, feelings, home
- 100% success rate, $0.378 total
- Script: `lang-quest/lq-nordic/scripts/generate-vocab-images.ts`

### 14. LinguaQuest Integration Audit

- Identified 4 `@gamevault/ai-*` packages duplicating `@learnquest/ai-sdk`
- Mapped shared concepts: XP/leveling, achievements, vocabulary/SRS, streaks
- Documented integration plan (package consolidation, schema alignment, asset sharing)

### 15. CI/Infrastructure

- Deployed `sync-core.yml` to all 20 lang/school repos
- Fixed blueforge-org CI: packageManager field, pnpm lockfile, version conflicts, Verdaccio cleanup
- Standardized `.gitignore` across all repos (test-results, playwright-report, etc.)

---

## Remaining Work (for next session)

### High Priority

1. **Set up PACKR_TOKEN locally** — needed for `pnpm install` in projects consuming `@blueforge-studio/*` packages. Token created via packr dashboard or CLI.

2. **Remove lq-core/libs/tools/ duplicates** — the 15 packages still exist in lq-core alongside copies in lq-tools. Delete from lq-core and update imports to use lq-tools packages via packr.

3. **Publish lq-tools packages to packr** — needs CI setup (publish workflow) or manual `pnpm publish`.

4. **Generate vocab images for remaining 12 groups** — use `generate-vocab-images.ts` template. Cost: ~$0.40 per group. Only needed when vocab lessons are created.

5. **Fix tsconfig issues across all projects** — `baseUrl` deprecation fixed in lq-core, but remaining projects may need similar fixes. Run `tsc --noEmit` to check.

### Medium Priority

6. **Audit lingua-quest for integration** — analysis done, execution pending (consolidate `@gamevault/*` → `@learnquest/*`, share UI/hooks)

7. **Remove 32 workspace overrides from lq-core** — replace `../../blueforge-org/packages/*` workspace protocol with packr consumption

8. **Improve prompt for vocab image generation** — current prompt sometimes adds text to images ("No text" instruction not always respected by Flux Schnell)

9. **Set up `@blueforge-studio/screen-audit`** for comprehensive front-page audits (a11y, perf, visual diff)

10. **Use `@blueforge-studio/logo-processor`** to post-process AI-generated logos

### Low Priority

11. **Port content from legacy for remaining 12 language groups** — vocab lessons don't exist yet for most groups
12. **Set up Vercel deployment for lq-site**
13. **Remaining 31 app-specific scripts** in `apps/web/scripts/` (build/, dev/, screen-capture/, stripe/)

---

## Key Conventions

### Asset Structure (lang apps)

```
lq-<group>/
├── public/                        # Served by Vite
│   ├── app.json, boss-groups.json
│   ├── logo.svg, favicon.svg
│   ├── _shared/images/            # Shared avatars, rpg, ui
│   └── languages/<lang>/images/   # Per-language images
├── languages/<lang>/              # Source content
│   ├── audio/                     # TTS audio
│   └── data/                      # Lesson JSON
├── src/App.tsx                    # React app shell
├── tests/smoke.spec.ts            # 4 smoke tests
├── tests/visual.spec.ts           # 3 visual tests
├── scripts/                       # Validation + generation scripts
├── lq.config.json                 # Configurable paths
└── .gitattributes                 # LFS tracking
```

### Package Registries

- `@learnquest/*` → `https://api.packr.blueforge.studio` (packr)
- `@blueforge-studio/*` → `https://api.packr.blueforge.studio` (packr)
- PACKR_TOKEN required for authenticated access

### Port Allocation

| Range | Group |
|-------|-------|
| 3010–3140 | Lang Quest (14 apps) |
| 3200–3205 | School Quest (6 apps) |
| 3300–3305 | Books Platform (7 apps) |
