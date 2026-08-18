# LearnQuest — Architecture & Project Structure

> Last updated: 2026-04-10

## Overview

LearnQuest is an RPG-themed learning platform supporting 59 languages across 14 regional groups, 6 school subjects, and interactive books. The codebase is organized as a collection of independent projects under `learn-quest/`, each with its own git repository (or planned repo). This is **not** a single monorepo — it's a multi-repo ecosystem connected through a shared package registry.

---

## Project Map

```
learn-quest/                        # Container directory (NOT a git repo)
├── lq-core/                        # [git] Core engine monorepo
├── lq-site/                        # [git] Marketing site (Next.js 16)
├── lq-operations/                  # [git] Cross-repo ops & scaffolding
├── lq-tools/                       # [git] Shared dev tooling monorepo
├── books-platform/                 # [git] Book apps monorepo
├── lang-quest/                     # Container for 14 language group apps
│   ├── lq-african/                 #   Vite app (planned git repo)
│   ├── lq-balkan/
│   ├── lq-celtic/
│   ├── lq-east-asian/
│   ├── lq-english/
│   ├── lq-germanic/
│   ├── lq-middle-eastern/
│   ├── lq-nordic/
│   ├── lq-romance/
│   ├── lq-slavic/
│   ├── lq-south-asian/
│   ├── lq-southeast-asian/
│   ├── lq-uralic/
│   └── lq-west-slavic/
├── school-quest/                   # Container for 6 subject apps
│   ├── lq-geography/               #   Vite app (planned git repo)
│   ├── lq-history/
│   ├── lq-math/
│   ├── lq-reading/
│   ├── lq-science/
│   └── lq-writing/
│   # Note: shared data schemas live in lq-core/data/ (not a separate top-level dir)
```

---

## Projects in Detail

### lq-core — Core Engine

**Role**: Central monorepo containing all shared libraries, the main app shell, AI services, and database infrastructure. Every other project depends on packages published from here.

**Status**: Active, most mature project.

```
lq-core/
├── apps/
│   ├── web/           # @learnquest/web-app — Main React app shell (Vite + React 19)
│   └── lang-core/     # @learnquest/web-core — Bootstrap bridge for language apps
├── libs/
│   ├── common/        # ui, hooks, animations, constants, schemas, types, utils, validators, email
│   ├── lang/          # game-features, game-state, lesson-framework, lang-lesson-types
│   ├── infra/         # database (Supabase + IndexedDB), error-tracker
│   ├── tools/         # Content & build tools
│   ├── screens/       # Screen components
│   └── app/           # App-level utilities
├── services/
│   ├── ai/            # AI orchestration
│   ├── ai-sdk/        # AI provider SDK (Vault7, Qwen, DeepSeek)
│   ├── ai-server/     # AI server
│   └── logger/        # Logging
├── scripts/           # Test runners, build utilities
├── data/              # App-level data
└── supabase/          # Database migrations & config
```

**Tech**: React 19, Vite 6, Turborepo, Tailwind CSS 4, shadcn/ui, Zustand + Immer, XState 5, Supabase, Vitest, Playwright.

**External dependency**: References `blueforge-org/packages/*` via workspace protocol for ~32 `@blueforge-studio/*` packages (AI agents, auth, analytics, etc.).

---

### books-platform — Book Apps Monorepo

**Role**: All book-related applications — reading, authoring, marketplace, and payments.

**Status**: Scaffolded and partially ported. Turborepo monorepo.

```
books-platform/
├── apps/
│   ├── lq-adventure-book/     # XState v5 adventure game        (port 3300)
│   ├── lq-story-book/         # Page-turning reader              (port 3302)
│   ├── lq-activity-book/      # Worksheet/exercise activities    (port 3303)
│   ├── lq-interactive-book/   # Choose-your-own-adventure        (port 3304)
│   ├── lq-book-marketplace/   # Marketplace + author tools       (port 3301)
│   ├── lq-books-author/       # Author PWA                       (port 3305)
│   └── stripe-api/            # Stripe backend (Express)         (port 3001)
├── packages/
│   ├── books-shared/          # Shared types, Zod schemas, constants
│   └── books-author/          # Authoring library (stores, hooks, services)
├── scripts/content/           # Content validation
├── data/books/                # Local book content (dev)
└── supabase/                  # Book-specific DB config
```

**Tech**: React 19, Vite, XState v5, Framer Motion, Zod, Stripe Connect.

**External dependency**: Consumes `@learnquest/*` packages from packr registry + `@blueforge/*` packages from blueforge-org workspace.

---

### lq-site — Marketing Site

**Role**: Public-facing marketing site with book marketplace, author profiles, blog, and legal pages.

**Status**: Actively ported with real content.

**Routes**: `/`, `/about`, `/blog`, `/books`, `/books/[bookId]`, `/author/[id]`, `/reading-list`, `/contact`, `/press`, `/privacy`, `/terms`

**Tech**: Next.js 16 (App Router), Tailwind CSS 4, MDX, Vercel deployment.

**Dependencies**: `@learnquest/ui`, `@learnquest/email` via packr registry.

---

### lang-quest — Language Group Apps (14)

**Role**: Container holding one Vite app per language family. Each app is a thin wrapper over `lq-core`, providing language-specific lessons, assets, and content.

**Status**: All 14 folders scaffolded with basic structure (`package.json`, `vite.config.ts`, `src/`, `languages/`). Source porting pending. Git repos not yet initialized.

**Language groups**: African, Balkan, Celtic, East Asian, English, Germanic, Middle Eastern, Nordic, Romance, Slavic, South Asian, Southeast Asian, Uralic, West Slavic.

**Dependencies**: `@learnquest/web-app`, `@learnquest/web-core`, `@learnquest/ui`, `@learnquest/hooks` via packr registry.

**Integration**: Language apps can be integrated with the school app "BrightPath".

---

### school-quest — Subject Apps (6)

**Role**: Container holding one Vite app per school subject. Same architecture as lang-quest — thin wrappers over `lq-core`.

**Status**: All 6 apps ported from legacy with lesson content, screens, and lesson-type components. React app shells + smoke tests added.

**Subjects**: Geography (3203), History (3202), Math (3200), Reading (3204), Science (3201), Writing (3205).

**Dependencies**: `@learnquest/web-app`, `@learnquest/ui`, `@learnquest/hooks` via packr registry.

**Integration**: Subject apps can be integrated with the school app "BrightPath".

---

### lq-tools — Shared Dev Tooling

**Role**: Monorepo containing generic, reusable developer tooling extracted from `lq-core/libs/tools/`.

**Status**: Active. 7 packages, published to packr.

| Package | Name | Description |
|---------|------|-------------|
| i18n | `@learnquest/i18n-tools` | Translation coverage, missing keys, hardcoded text detection |
| testing | `@learnquest/testing` | Code health, coverage reports, missing/orphaned test detection |
| dev-utils | `@learnquest/dev-utils` | Dependency analysis, image optimization, JSON/structure tools |
| test-agent | `@learnquest/test-agent` | Vitest runner with resource monitoring, batch execution |
| test-reporter | `@learnquest/test-reporter` | Test result transport (filesystem + Redis) |
| test-utils | `@learnquest/test-utils` | Shared test setup and mock factories |
| e2e-runner | `@learnquest/e2e-runner` | Domain-based Playwright E2E orchestration |

---

### lq-operations — Cross-Repo Ops

**Role**: Scaffolding tools, repo templates, cross-repo CI workflows, and audit scripts.

**Status**: Active.

**Contents**:
- `scripts/scaffold-repo.ts` — Scaffold new language or school repos (`--school` flag)
- `scripts/smoke-test-apps.ts` — Run smoke tests across all 20 apps
- `scripts/audit-ports.ts` — Verify port consistency across ecosystem
- `templates/lang-quest/` — Template for language apps
- `templates/school-quest/` — Template for school subject apps
- `templates/github-workflows/sync-core.yml` — CI workflow for dependency sync

---

### lq-core/data/ — Shared Data

**Role**: Shared configuration, schemas, and asset manifests used by `lq-core` tools and validation scripts. Not a separate project — lives inside `lq-core`.

**Contents**:
- `apps.json` — App domain registry (languages, subjects, shared asset paths)
- `languages-index.json` — Language group index (13 groups with enabled flags)
- `release-targets.json` — Beta/production release criteria per language group
- Validation schemas migrated to Zod in `@learnquest/schemas` (see migration section below)
- `languages-shared/` — Shared language assets (flag SVGs, asset maps)
- `_shared/` — Global shared assets (pronunciation systems for 9 locales)

---

## Dependency Graph

```
                    ┌─────────────────┐
                    │  blueforge-org   │
                    │  (sibling repo)  │
                    └────────┬────────┘
                             │ workspace protocol
                             ▼
                    ┌─────────────────┐
         ┌────────>│    lq-core       │<────────┐
         │         │  (core engine)   │         │
         │         └────────┬────────┘         │
         │                  │                   │
         │          publishes @learnquest/*     │
         │          to packr registry           │
         │                  │                   │
         │    ┌─────────────┼─────────────┐     │
         │    ▼             ▼             ▼     │
    ┌────┴──────┐   ┌────────────┐  ┌─────┴────┐
    │ lang-quest │   │books-platf.│  │school-q.  │
    │ (14 apps)  │   │ (7 apps)   │  │ (6 apps)  │
    └────────────┘   └────────────┘  └───────────┘
                             │
                    consumes @blueforge/*
                    from blueforge-org
         ┌──────────────────┐
         ▼                  ▼
    ┌──────────┐    ┌──────────────┐
    │ lq-site  │    │lq-operations │
    │(Next.js) │    │  (tooling)   │
    └──────────┘    └──────────────┘

    lq-site consumes: @learnquest/ui, @learnquest/email
    lq-operations: scaffolds lang-quest + school-quest repos, syncs deps
    Shared data schemas live inside lq-core/data/
```

---

## Package Distribution

All `@learnquest/*` packages are published to and consumed from the BlueForge packr registry:

```
https://api.packr.blueforge.studio
```

Key published packages:

| Package | Source | Consumers |
|---------|--------|-----------|
| `@learnquest/web-app` | lq-core/apps/web | lang-quest, school-quest, books-platform |
| `@learnquest/web-core` | lq-core/apps/lang-core | lang-quest |
| `@learnquest/ui` | lq-core/libs/common/ui | All projects |
| `@learnquest/hooks` | lq-core/libs/common/hooks | lang-quest, school-quest, books-platform |
| `@learnquest/email` | lq-core/libs/common/email | lq-site, books-platform |
| `@learnquest/schemas` | lq-core/libs/common/schemas | Various |
| `@learnquest/types` | lq-core/libs/common/types | Various |
| `@learnquest/game-state` | lq-core/libs/lang/game-state | lang-quest, books-platform |
| `@learnquest/lesson-framework` | lq-core/libs/lang/lesson-framework | lang-quest, school-quest |
| `@learnquest/books-shared` | books-platform/packages/books-shared | books-platform apps |

---

## Package Registry & PACKR_TOKEN

All `@learnquest/*` packages are published to the BlueForge packr registry at `https://api.packr.blueforge.studio`. The `.npmrc` files across the ecosystem reference `${PACKR_TOKEN}`, but pnpm only emits a harmless warning when it is unset.

**When the token is NOT needed:**

- Local development within a single monorepo (lq-core, lq-tools, etc.) where packages resolve via pnpm workspace protocol.

**When the token IS needed:**

1. **Publishing** packages to the packr registry (CI or manual).
2. **Consuming** published `@learnquest/*` packages from a different repo (e.g., lang-quest installing `@learnquest/ui` from packr).

**Migration dependency chain:**

1. Publish lq-tools packages to packr first.
2. Remove workspace duplicates from lq-core (switch from workspace to packr consumption).
3. Downstream consumers (lang-quest, school-quest, books-platform, lq-site) then need the token to install from packr.

In CI, `PACKR_TOKEN` is stored as a GitHub organization secret. For local cross-repo consumption, export it in `~/.zshrc` or add it to `~/.npmrc`.

---

## Tech Stack Summary

| Concern | Technology |
|---------|-----------|
| Package Manager | pnpm (workspaces) |
| Build Orchestration | Turborepo |
| Frontend | React 19, Vite 6 (apps), Next.js 16 (site) |
| Styling | Tailwind CSS 4, shadcn/ui |
| State Management | Zustand + Immer, XState 5 |
| Database | Supabase (Postgres, Auth, Storage) |
| AI | BlueForge AI Gateway, multi-provider SDK |
| Testing | Vitest, Playwright |
| Payments | Stripe Connect + Checkout |
| Registry | packr (BlueForge hosted) |
| Deployment | Vercel (lq-site) |

---

## Git Repository Status

| Project | Has Git Repo | Remote |
|---------|-------------|--------|
| lq-core | Yes | `blueforge-studio/lq-core` |
| lq-site | Yes | `blueforge-studio/lq-site` |
| lq-operations | Yes | `blueforge-studio/lq-operations` |
| lq-tools | Yes | `blueforge-studio/lq-tools` |
| books-platform | Yes | `blueforge-studio/books-platform` |
| lang-quest/lq-* (14) | Yes | `blueforge-studio/lq-{group}` |
| school-quest/lq-* (6) | Yes | `blueforge-studio/lq-{subject}` |
| lq-core/data/ | Part of lq-core | N/A (not a separate repo) |

**Total: 25 private repos on `blueforge-studio` GitHub org.**

---

## JSON Schema → Zod Migration (Completed)

The two JSON Schema files that previously lived in `lq-core/data/` have been migrated to Zod schemas in `@learnquest/schemas`:

| Old file | New location | Schema export |
|----------|-------------|---------------|
| `locale-manifest.schema.json` | `libs/common/schemas/src/locale-manifest.ts` | `LocaleManifestSchema` |
| `taxonomy.schema.json` | `libs/common/schemas/src/taxonomy.ts` | `TaxonomySchema` |

### Why Zod over JSON Schema

1. **Consistency** — the rest of the codebase uses Zod; JSON Schema was the odd one out
2. **Type inference** — Zod schemas generate TypeScript types automatically (`z.infer<typeof schema>`)
3. **Colocation** — schemas live alongside validation code in `@learnquest/schemas`
4. **Composability** — compose with existing Zod schemas in `libs/common/schemas/`

### Remaining Steps

- Update `validate-locale-manifest.ts` and `validate-subject-content.ts` to import from `@learnquest/schemas` instead of loading JSON Schema files
- Optionally remove `"$schema"` references from `lang-quest/*/languages/*/data/locale-manifest.json` files (currently points to removed file)
