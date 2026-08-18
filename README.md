# LearnQuest

**Container directory for BlueForge language learning sub-projects.**

> The container itself is a git repo (init 2026-08-18) tracking only container-level docs/configs. Every sub-project below is its own git repo — each is gitignored at the container level (see `.gitignore`) and lives on its own remote.

## Portfolio Status

_Last audited: 2026-07-13 · Part of the [BlueForge](https://blueforge.studio) portfolio._

### Recent changes (2026-07-13)

- **lq-core household-goals Phase 9 — kid wishlist + parent grants** — new `libs/app/household-goals` package, new `libs/screens/household-goals` (kid/parent/dashboard/goal-editor/grants/wishlist-review), Drizzle migration `0008_household_goals.sql`, 15-locale i18n, QuestShell `householdRoutes` flag gated by `VITE_HOUSEHOLD_FEATURE_ENABLED`, Playwright smoke template, behavioral repo tests. 67 commits ahead of `origin/main`, working tree dirty.
- **LinguaQuest narrative engine (Phases 0–3) shipped** — `packages/quest-constraint` solver; server-side validation pipeline (`apps/collab-server` in-process validator); Yjs two-way binding in `apps/quest-editor`; GPU shader rendering (PixiJS); graph-aware dialogue advance; Mediterranean Odyssey (Italian Roman quest) as exemplar.
- **LinguaQuest 15 locales shipped** — added `ar` `da` `de` `nl` `pt` `ru` `sw` `yo` to the original `th`/`zh`/`en`/`es`/`ja`/`fr`/`it` set. `ru`/`pt`/`de`/`nl`/`yo`/`sw` quests split from 1 chapter into 4–5 chapters each with 87+ DeepSeek-generated scenes.
- **LinguaQuest consolidation (2026-06-10)** — `collab-validator` merged into `collab-server` as in-process module; `apps/backend` consolidated into `apps/api` (game routes mounted at `/api/game` with JWT middleware). In-progress commit on `screen-audit/iterate-2026-05-05T14-12-14` branch.
- **Books Platform E2E refactor** — replaced bash E2E script with Vitest + supertest suite (`apps/books-api`); unified config — `blueforge.config.ts` is single source of truth with config-driven Dockerfile generation; per-app `Dockerfile` + `blueforge.json` are derived artifacts.

### Recent changes (2026-04-24)

- **LinguaQuest on-prem foundation shipped** — `main` on the new canonical remote `blueforge-studio/linguaquest` now has full Drizzle schema for 16 tables, portable RLS helper (`public.current_user_id()`), `apps/api` REST layer with JWT middleware + `withJwtSession` per-request session helper, and 56 integration tests. Non-destructive; Supabase prod unchanged until `VITE_DB_ADAPTER=postgres` is flipped. See `lingua-quest/docs/superpowers/plans/` for the plans and `lingua-quest/docs/runbooks/` for provisioning + dress-rehearsal reports.
- **LinguaQuest repo remote moved** — canonical origin is now `blueforge-studio/linguaquest` (was `kristianmandrup/linguaquest`). The personal fork is kept as the `backup` remote.
- **lq-history content restructure committed** — 299 orphan images removed from pre-hierarchy layout, 853 new chapter-organized images added (`{epoch}/{region}/chapter-N/`). All 1,012 lesson JSONs verified to resolve.
- **12 cross-portfolio worktrees swept** — `.worktrees/` under `/Users/kmandrup/Projects/Repos/` now empty; feature branches on 12 `*-os` repos merged and deleted.

**Status:** `Beta`

### Apps & Sites in this Repo

**This is a container directory tracked by a git repo (init 2026-08-18).** The container repo tracks only container-level docs/configs — every deployable app below is its **own git repo** (each gitignored at the container level, see `.gitignore`) and its **own BlueForge deployable** with its own `blueforge.config.json` (or `.ts`). The three product folders — `lang-quest/`, `school-quest/`, `life-quest/` — are filesystem groupings only: each child is an independent repo. Each product folder is a candidate for a **workspace-mode deploy** (`containerStrategy: "workspace"`: one container runs the product's apps under pm2, one Caddy vhost per app).

#### Platform repos

| Repo | Kind | blueforge config | Deployable |
|------|------|------------------|-----------|
| `lq-site` | Next.js 16 + MDX marketing site | — | Live (Vercel) → `learnquest.blueforge.studio` |
| `lq-core` | pnpm workspaces monorepo (57 packages) | `blueforge.config.json` | no (`deployable: false`) — publishes `@learnquest/*` to packr |
| `lq-tools` | pnpm workspaces monorepo (28 packages) | — | no (tooling) |
| `lq-operations` | single package | — | no (ops/scaffolding) |
| `books-platform` | Turborepo monorepo (7 apps) | `blueforge.config.ts` | per-app: lq-adventure-book (3300), lq-book-marketplace (3301), lq-story-book (3302), lq-activity-book (3303), lq-interactive-book (3304), lq-books-author (3305), stripe-api (3001) |

#### lingua-quest — Turborepo monorepo (`blueforge.config.json` + `.ts`)

| App | Path | Port | Domain |
|-----|------|------|--------|
| LinguaQuest App | `lingua-quest/apps/web` | 8081 | `app.linguaquest.blueforge.studio` |
| LinguaQuest Site | `lingua-quest/apps/site` | 3500 | `linguaquest.blueforge.studio` |
| LinguaQuest API | `lingua-quest/apps/api` | 3002 | `api.linguaquest.blueforge.studio` |
| Collab server | `lingua-quest/apps/collab-server` | 3040 | `collab.linguaquest.blueforge.studio` |
| Quest editor | `lingua-quest/apps/quest-editor` | 8082 | — |

#### lang-quest — product folder (not a repo)

`lang-quest/blueforge.config.json` is a **project-level config** (`project: "lang-quest"`) declaring asset sync (`assets.primary` MinIO + `cloudflare_r2` mirror, per-app push/pull) plus the 14 apps. Each language group is its **own git repo** with its own `blueforge.config.json`:

| Language group | Repo path | Port | Domain |
|----------------|-----------|------|--------|
| Nordic | `lang-quest/lq-nordic` | 3010 | `nordic-quest.blueforge.studio` |
| Romance | `lang-quest/lq-romance` | 3020 | `romance-quest.blueforge.studio` |
| Southeast Asian | `lang-quest/lq-southeast-asian` | 3030 | `southeast-asian-quest.blueforge.studio` |
| East Asian | `lang-quest/lq-east-asian` | 3040 | `east-asian-quest.blueforge.studio` |
| Balkan | `lang-quest/lq-balkan` | 3050 | `balkan-quest.blueforge.studio` |
| Slavic | `lang-quest/lq-slavic` | 3060 | `slavic-quest.blueforge.studio` |
| West Slavic | `lang-quest/lq-west-slavic` | 3070 | `west-slavic-quest.blueforge.studio` |
| South Asian | `lang-quest/lq-south-asian` | 3080 | `south-asian-quest.blueforge.studio` |
| African | `lang-quest/lq-african` | 3090 | `african-quest.blueforge.studio` |
| Middle Eastern | `lang-quest/lq-middle-eastern` | 3100 | `middle-eastern-quest.blueforge.studio` |
| Celtic | `lang-quest/lq-celtic` | 3110 | `celtic-quest.blueforge.studio` |
| Germanic | `lang-quest/lq-germanic` | 3120 | `germanic-quest.blueforge.studio` |
| Uralic | `lang-quest/lq-uralic` | 3130 | `uralic-quest.blueforge.studio` |
| English | `lang-quest/lq-english` | 3140 | `english-quest.blueforge.studio` |

#### school-quest — product folder (not a repo)

Each subject is its **own git repo** with its own `blueforge.config.json`:

| Subject | Repo path | Port | Domain |
|---------|-----------|------|--------|
| Math | `school-quest/lq-math` | 3200 | `math.blueforge.studio` |
| Science | `school-quest/lq-science` | 3201 | `science.blueforge.studio` |
| History | `school-quest/lq-history` | 3202 | `history.blueforge.studio` |
| Geography | `school-quest/lq-geography` | 3203 | `geography.blueforge.studio` |
| Reading | `school-quest/lq-reading` | 3204 | `reading.blueforge.studio` |
| Writing | `school-quest/lq-writing` | 3205 | `writing.blueforge.studio` |

#### life-quest — product folder (itself a git repo containing 17 nested child repos)

Each subject is its **own git repo** with its own `blueforge.config.json`:

| Subject | Repo path | Port | Domain |
|---------|-----------|------|--------|
| Economics | `life-quest/lq-economics` | 3210 | `economics.blueforge.studio` |
| Anatomy | `life-quest/lq-anatomy` | — | `anatomy.blueforge.studio` |
| Construction | `life-quest/lq-construction` | — | `construction.blueforge.studio` |
| Cooking | `life-quest/lq-cooking` | — | `cooking.blueforge.studio` |
| Electronics | `life-quest/lq-electronics` | — | `electronics.blueforge.studio` |
| Engineering | `life-quest/lq-engineering` | — | `engineering.blueforge.studio` |
| Finance | `life-quest/lq-finance` | — | `finance.blueforge.studio` |
| Game Design | `life-quest/lq-game-design` | — | `game-design.blueforge.studio` |
| Game Dev | `life-quest/lq-game-dev` | — | `game-dev.blueforge.studio` |
| Health | `life-quest/lq-health` | — | `health.blueforge.studio` |
| Law | `life-quest/lq-law` | — | `law.blueforge.studio` |
| Maker | `life-quest/lq-maker` | — | `maker.blueforge.studio` |
| Media | `life-quest/lq-media` | — | `media.blueforge.studio` |
| Philosophy | `life-quest/lq-philosophy` | — | `philosophy.blueforge.studio` |
| Plumbing | `life-quest/lq-plumbing` | — | `plumbing.blueforge.studio` |
| Psychology | `life-quest/lq-psychology` | — | `psychology.blueforge.studio` |
| Tech | `life-quest/lq-tech` | — | `tech.blueforge.studio` |

#### Deployment reality (probed 2026-08-13)

- `nordic-quest.blueforge.studio` → **200 (Live)** — lq-nordic is the forge-pipeline pilot (flipped off Vercel, Cloudflare DNS, asset sync).
- `learnquest.blueforge.studio` / `app.linguaquest.blueforge.studio` → A-record → `178.104.233.155` (forge-platform public Caddy) but **no route / no response (000)** — stale DNS.
- `math.blueforge.studio` / `economics.blueforge.studio` → **no A-record** — canonical domains never wired; the subject apps only ever had Vercel project URLs.
- School-quest and life-quest subjects have no canonical `*.blueforge.studio` route yet; the old `schoolquest-app` Vercel project is errored.
- The root `blueforge.config.json` (legacy `hetzner` schema) and `blueforge.config.ts` (meta config listing 36 sub-repos) are superseded by the per-repo / project-level configs above.

### Features — Implemented
- Monorepo containers: `lq-core` (shared libs + app shell + AI services + Supabase infra), `lq-operations`, `lq-tools`, `lq-site`, `books-platform`, `lang-quest`, `school-quest`, `life-quest` (evidence: README, sub-READMEs)
- LQ-Site: Next.js 16 + MDX + Tailwind 4 marketing site with book marketplace, author profiles, blog, legal pages (evidence: `lq-site/README.md`)
- LinguaQuest: language-learning RPG PWA with React 19 + Vite 6 + Capacitor mobile support (evidence: `lingua-quest/README.md`, `lingua-quest/.claude/CLAUDE.md`)
- LinguaQuest language packs: 15 locales shipped — Thai (`tourist`, `ayutthaya_kingdom`), Chinese (`tang_court`, `silk_road`), English (`royal_navy`, `pirate_life`), Arabic, Danish, German, Spanish, French, Italian, Japanese, Dutch, Portuguese, Russian, Swahili, Yoruba (`lingua-quest/README.md`)
- School-Quest content: 253 lessons across 6 subjects, 100% validated against Zod schemas (evidence: `school-quest/PRODUCTION_READINESS.md`)
- School-Quest subject apps deployed on Vercel (`lq-math`, `lq-science`, `lq-history`, `lq-geography`, `lq-reading`, `lq-writing` — all Live 200 in `vercel-health.tsv`)
- School-Quest lesson ID audit script + content validation via Zod (evidence: `school-quest/CLAUDE.md`)
- Life-Quest content: 458+ lessons across 8 subjects (economics, law, health, finance, philosophy, media, tech, psychology) with 10 chapters each (evidence: `life-quest/Readme.md`, `life-quest/CLAUDE.md`)
- Life-Quest content generation pipeline (DeepSeek/Qwen 60/40 split, `~$0.004/lesson`), image generation (Replicate Flux, `~$0.003/image`), TTS audio (edge-tts, free) (`life-quest/CLAUDE.md`)
- Shared `@learnquest/*` packages published to `https://api.packr.blueforge.studio` (README, sub-CLAUDE.md)
- History lesson content audit (2026-04-16) — 330 duplicate IDs fixed, 779 quiz correctAnswer conversions, 406 disabled lessons enabled, full schema repair for 879 lessons (`school-quest/CLAUDE.md § Content Audit`)
- LinguaQuest on-prem foundation (2026-04-24) — portable Drizzle schema, JWT-claims RLS helper, adapter pattern (`SupabaseAdapter` + `PostgresAdapter` behind one facade), `apps/api` REST layer. Verified via 56 integration tests + full dress rehearsal against Docker Postgres 15. Flip `VITE_DB_ADAPTER=postgres` to activate. See `lingua-quest/docs/superpowers/plans/2026-04-24-onprem-postgres-migration.md` and `lingua-quest/docs/runbooks/dress-rehearsal-2026-04-24.md`.
- History content restructure (2026-04-24) — 1,012 lessons wired to chapter-organised image hierarchy (`{epoch}/{region}/chapter-N/{topic}-{variant}.webp`); 299 pre-hierarchy orphans removed.

### Features — Planned
- **Provision LinguaQuest on forge-control's Hetzner Postgres** as a platform tenant (`@blueforge/platform` Provisioner) — the on-prem code is ready; actual cloud provisioning is the next step. See the cutover plan stub at `lingua-quest/docs/superpowers/plans/2026-04-24-onprem-cutover.md`.
- **Port the Stripe webhook from Supabase Edge Function to `apps/api`** (cutover phase C for LinguaQuest; similar work needed before any Life-Quest app can go on-prem).
- **lq-core: land household-goals Phase 9** — 67 commits unpushed on `main`; WIP dirty tree. Decide: push as-is, or commit the 15 modified + 17 untracked files first. (`lq-core/docs/design/family-profile-rollout.md`)
- **lingua-quest: finish `apps/backend → apps/api` consolidation on a fresh branch** — current WIP is uncommitted on a stale `screen-audit/iterate-2026-05-05T14-12-14` branch.
- Deploy Life-Quest subject apps to Vercel (not yet linked in `repo-vercel-map.tsv`)
- Deploy Books-Platform apps (`lq-adventure-book`, `lq-book-marketplace`, `lq-story-book`, `lq-activity-book`, `lq-interactive-book`, `lq-books-author`, `stripe-api`) (README)
- Wire the 6 School-Quest subject apps onto canonical `*.schoolquest.blueforge.studio` subdomains (not yet captured in `domains.yml` which has a single `schoolquest` entry)
- Fix the `schoolquest-app` canonical Vercel project (currently 404/errored)
- Complete image generation pipeline for School-Quest Reading/Writing (categories exist but not in scaffolding subjects) (`school-quest/PRODUCTION_READINESS.md`)
- Chapter-gating monetization (free: ch1–2, paid: ch3+) + $50/mo subscription (`school-quest/PRODUCTION_READINESS.md`)
- RLS policies for student data (`school-quest/PRODUCTION_READINESS.md`)
- Register School-Quest apps in forge-auth (`school-quest/PRODUCTION_READINESS.md`)

### Run Locally
Each sub-project has its own setup. Examples:

```bash
# Site
pnpm --dir lq-site install && pnpm --dir lq-site dev

# LinguaQuest
pnpm --dir lingua-quest install && pnpm --dir lingua-quest dev

# A school-quest subject
pnpm --dir school-quest/lq-math install && pnpm --dir school-quest/lq-math dev

# A life-quest subject
pnpm --dir life-quest/lq-economics install && pnpm --dir life-quest/lq-economics dev
```

Required env vars (per sub-app): `VITE_AUTH_URL` (forge-auth), `VITE_API_URL`, `VITE_DB_PROVIDER=postgres`, `VITE_CONTENT_API_URL` (REST content source). Packr auth token required for `@learnquest/*` packages. Supabase env vars removed (2026-07-19) — the on-prem Postgres + R2 stack is the active replacement.

### Deployment
- **Site:** `lq-site` → https://lq-site-three.vercel.app (Live) → learnquest.blueforge.studio (Live)
- **LinguaQuest App:** `linguaquest-app` → https://linguaquest-app.vercel.app (Live) → app.linguaquest.blueforge.studio (Live)
- **LinguaQuest Site:** served via `questlang-site` → linguaquest.blueforge.studio (Live)
- **SchoolQuest subjects:** each deployed as its own Vercel project (`lq-math`, `lq-science`, `lq-history`, `lq-geography`, `lq-reading`, `lq-writing`) — all Live (200) but not yet on BlueForge subdomains
- **SchoolQuest canonical:** `schoolquest-app` → 404 (errored), canonical `app.schoolquest.blueforge.studio` broken

### Known Issues
- `schoolquest-app` canonical Vercel project is errored (cf. `vercel-health.tsv`) while the 6 subject-specific projects are Live — routing/ownership mismatch
- `app.schoolquest.blueforge.studio` DNS is set but no response — Vercel custom-domain attachment missing (`domain-check.tsv`)
- Life-Quest subject apps are not yet linked to Vercel projects (`repo-vercel-map.tsv` has no rows for `life-quest/*`)
- Books-Platform and Lang-Quest group apps are not yet deployed
- `brightpath-site` Vercel project is Live but `brightpath.blueforge.studio` returns no response — domain attachment missing
- `questbooks` has no Vercel project mapping in `domains.yml`

## Sub-Projects

> **`learn-quest/` is a container repo (init 2026-08-18).** The container repo tracks only container-level docs/configs; every sub-project is its own git repo (gitignored at the container level, see `.gitignore`) and lives on its own remote (or is a workspace container of further sub-repos). See [Repository Types](#repository-types) below for the full breakdown.

| Project | Path | Type | Description |
|---------|------|------|-------------|
| **lq-core** | `lq-core/` | pnpm workspaces monorepo (real repo, `.git`) | Core learning engine — 57 packages: shared libs, `apps/web`, `apps/core`, AI services, Supabase infra |
| **lq-tools** | `lq-tools/` | pnpm workspaces monorepo (real repo, `.git`) | Shared dev tooling — 28 packages: i18n, testing, e2e-runner, image/audio/video tools |
| **books-platform** | `books-platform/` | **Turborepo monorepo** (real repo, `.git`) | Book apps — 7 apps + Stripe API (adventure-book, story-book, marketplace, etc.) |
| **lingua-quest** | `lingua-quest/` | **Turborepo monorepo** (real repo, `.git`) | Language-learning RPG — `apps/web` + `apps/api` + `apps/collab-server` + `apps/site` + `apps/quest-editor` |
| **lq-site** | `lq-site/` | Single-package (real repo, `.git`) | Marketing site (Next.js 16 + MDX) — Live on Vercel → `learnquest.blueforge.studio` |
| **lq-operations** | `lq-operations/` | Single-package (real repo, `.git`) | Cross-repo ops: scaffolding scripts, CI templates, regional asset sync |
| **life-quest** | `life-quest/` | **Workspace container** (`.git` only, no root `package.json`) | 17 life-skills subject apps (economics, law, health, finance, cooking, etc.) — each is a self-contained Vite SPA |
| **school-quest** | `school-quest/` | **Workspace container** (no `.git`, no root `package.json`) | 6 school subject apps (math, science, history, geography, reading, writing) — each Live on Vercel |
| **lang-quest** | `lang-quest/` | **Workspace container** (no `.git`, no root `package.json`) | 14 language group apps (nordic, romance, east-asian, etc.) — each is a self-contained Vite SPA |
| **data** | `lq-core/data/` | (inside lq-core) | Shared data schemas, language indexes, and asset manifests |

### Repository Types

**Turborepo monorepos** — `books-platform`, `lingua-quest`. Have `turbo.json` + `blueforge.config.ts`. Per-app Dockerfiles generated from config. Each app is a deployable service on its own port. Blueprint used by the rest of the BlueForge portfolio.

**pnpm workspaces monorepos (no Turbo)** — `lq-core`, `lq-tools`. Library/tooling workspaces. Many internal `@learnquest/*` packages published to `api.packr.blueforge.studio` (packr registry). Not directly deployable.

**Single-package repos** — `lq-site`, `lq-operations`. One Next.js app or one ops package at the root.

**Workspace containers (product folders)** — `lang-quest`, `school-quest`, `life-quest`. The folder has no root `package.json` or orchestrator, and **every immediate child is its own git repo**: 14 language groups, 6 school subjects, 17 life-skill apps — each a self-contained Vite SPA with its own `blueforge.config.json`, consuming `@learnquest/*` from the packr registry. `life-quest/` additionally has its own `.git` wrapping the child repos. These product folders are the natural unit for a **workspace-mode deploy** (`containerStrategy: "workspace"`: one container per product running all member apps under pm2).

### Why this matters

- The BlueForge banned-patterns audit script (`blueforge-org/scripts/audit-banned-patterns.py`) walks repos by checking for top-level `package.json` OR `.git`. Workspace containers (`lang-quest/`, `school-quest/`) have neither at the container root, so the script needs to recurse to discover their sub-packages — see [MIGRATION_PLAN.md](MIGRATION_PLAN.md) for the open migration scope.
- All `@learnquest/*` packages are published to `https://api.packr.blueforge.studio` (packr registry). Each child workspace container and each library monorepo must publish its packages before sibling apps can `pnpm install` against them.
- SaaS dependency footprint per sub-project (as of 2026-06-28):
  - Supabase: `lang-quest` 14, `life-quest` 17, `school-quest` 6, `lq-core` 7, `lq-tools` 2, `books-platform` 2, `lingua-quest` 3, `lq-site` 1, `lq-operations` 1 = **53 packages** total
  - Firebase: `lq-core` 2 (`libs/common/assets`, `libs/infra/error-tracker`)
  - Vercel deployments: 18 `vercel.json` files across `lq-site`, `school-quest`, `life-quest`, `books-platform`, `lingua-quest`

---

### lq-core — Core Engine

Monorepo containing all shared libraries, the main app shell, AI services, and Supabase infrastructure.

| Area | Packages |
|------|----------|
| Apps | `@learnquest/web-app`, `@learnquest/web-core` |
| Common libs | ui, hooks, animations, constants, schemas, types, utils, validators, email |
| Domain libs | game-features, game-state, lesson-framework, lang-lesson-types |
| Infra | database (Supabase + IndexedDB), error-tracker |
| Services | ai, ai-sdk, ai-server, logger |

---

### books-platform — Book Apps Monorepo

pnpm + Turborepo monorepo for book and publishing apps.

| App | Description | Port |
|-----|-------------|------|
| lq-adventure-book | XState v5 adventure game | 3300 |
| lq-book-marketplace | Marketplace + author tools | 3301 |
| lq-story-book | Page-turning story reader | 3302 |
| lq-activity-book | Worksheet/exercise activities | 3303 |
| lq-interactive-book | Choose-your-own-adventure | 3304 |
| lq-books-author | Author PWA | 3305 |
| stripe-api | Stripe backend (Express) | 3001 |

**Packages**: `@learnquest/books-shared`, `@learnquest/books-author`

**Dependencies**: Consumes `@learnquest/web-app`, `@learnquest/ui`, `@learnquest/hooks`, `@learnquest/books-shared` from packr registry. Also includes `@blueforge/*` packages from `../../blueforge-org/packages/*` via workspace protocol.

---

### Language-Specific Repos (lang-quest)

`lang-quest/` is a **container** holding one git repo per language family.

Each language group can contain many assets (chapters, lessons, audio, images per language), so they are kept in separate repos.

| Language Group | Path | Port |
|----------------|------|------|
| Nordic | `lang-quest/lq-nordic/` | 3010 |
| Romance | `lang-quest/lq-romance/` | 3020 |
| Southeast Asian | `lang-quest/lq-southeast-asian/` | 3030 |
| East Asian | `lang-quest/lq-east-asian/` | 3040 |
| Balkan | `lang-quest/lq-balkan/` | 3050 |
| Slavic | `lang-quest/lq-slavic/` | 3060 |
| West Slavic | `lang-quest/lq-west-slavic/` | 3070 |
| South Asian | `lang-quest/lq-south-asian/` | 3080 |
| African | `lang-quest/lq-african/` | 3090 |
| Middle Eastern | `lang-quest/lq-middle-eastern/` | 3100 |
| Celtic | `lang-quest/lq-celtic/` | 3110 |
| Germanic | `lang-quest/lq-germanic/` | 3120 |
| Uralic | `lang-quest/lq-uralic/` | 3130 |
| English | `lang-quest/lq-english/` | 3140 |

---

### Subject-Specific Repos (school-quest)

`school-quest/` is a **container** holding one git repo per subject, similar to language groups.

Each subject can contain many assets depending on chapters and lessons. Subject groups may be added in the future.

| Subject | Path | Port |
|---------|------|------|
| Math | `school-quest/lq-math/` | 3200 |
| Science | `school-quest/lq-science/` | 3201 |
| History | `school-quest/lq-history/` | 3202 |
| Geography | `school-quest/lq-geography/` | 3203 |
| Reading | `school-quest/lq-reading/` | 3204 |
| Writing | `school-quest/lq-writing/` | 3205 |

---

### Shared Data (`lq-core/data/`)

Shared configuration and asset manifests used by `lq-core` tools and consumed by language/subject apps. Lives inside `lq-core` since all references are from that repo's tools and validation scripts.

Validation schemas (locale manifest, taxonomy) have been migrated to Zod in `@learnquest/schemas`. See `lq-core/data/README.md` for details.

---

## Tech Stack (shared)

- **Package Manager**: pnpm (workspaces monorepo)
- **Build**: Turborepo, Vite 6, tsup
- **Frontend**: React 19, Tailwind CSS 4, shadcn/ui
- **State**: Zustand + Immer, XState 5
- **Database**: Supabase + Drizzle ORM
- **AI**: BlueForge AI Gateway for adaptive learning
- **Testing**: Vitest, Playwright
- **Package Registry**: https://api.packr.blueforge.studio (@learnquest/*)

## Conventions

- [docs/screen-audit-convention.md](docs/screen-audit-convention.md) — where
  `@blueforge-studio/screen-audit` output lives per app, why two patterns
  exist, per-app setup checklist.

## Setup (per-project)

Each sub-project has its own setup. Example for lq-operations:

```bash
# Install dependencies
pnpm install

# Set up environment
cp .env.example .env.local

# Run operations dashboard
pnpm --cwd lq-operations dev
```
