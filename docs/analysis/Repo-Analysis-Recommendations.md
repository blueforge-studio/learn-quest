# LearnQuest — Repo Analysis & Recommendations

> Analysis date: 2026-04-10

---

## 1. Repo Inventory

### Top-Level Overview

| Project | Type | Git | Disk Size | TS/JS Lines | Source Files | Nature |
|---------|------|-----|-----------|-------------|--------------|--------|
| **lq-core** | Monorepo | Yes | 179 MB | 400K | 9,936 | Core engine — app shell, libs, AI, DB |
| **lang-quest** | Container (14 repos) | Yes (each) | 386 MB | 280 | 23,461 | Data/assets — JSON, audio, images |
| **books-platform** | Monorepo | Yes | 6.7 MB | 15K | 428 | Book apps — 7 apps, 2 packages |
| **lq-site** | Standalone | Yes | 25.9 MB | 5.7K | 104 | Next.js 16 marketing site |
| **school-quest** | Container (6 repos) | Yes (each) | 6.6 KB | 18 | 20 | Stubs only (content pending) |
| **lq-operations** | Standalone | Yes | 21 KB | 130 | 3 | Scaffolding, CI templates |
| **TOTAL** | 24 git repos | — | ~598 MB | ~421K | ~33,952 | — |

### lq-core Internal Breakdown

| Area | Path | Lines | % | Role |
|------|------|-------|---|------|
| apps/web | `apps/web/` | 150K | 38% | Main React app shell + all scripts |
| libs/screens | `libs/screens/` | 81K | 20% | Screen components |
| libs/tools | `libs/tools/` | 70K | 18% | Build, validation, content tools |
| libs/lang | `libs/lang/` | 34K | 8% | Game state, lesson framework |
| libs/app | `libs/app/` | 31K | 8% | App-level services |
| services/ai* | `services/` | 13K | 3% | AI SDK, server, orchestration |
| libs/infra | `libs/infra/` | 11K | 3% | Database, error tracking |
| libs/common | `libs/common/` | 6.5K | 2% | UI, hooks, schemas, types, utils |
| apps/lang-core | `apps/lang-core/` | 55 | <1% | Bootstrap bridge |

### books-platform Internal Breakdown

| Area | Path | Lines | Role |
|------|------|-------|------|
| packages/books-shared | `packages/books-shared/` | 4,051 | Types, schemas, constants |
| packages/books-author | `packages/books-author/` | 3,158 | Authoring stores, hooks |
| apps/lq-book-marketplace | `apps/lq-book-marketplace/` | 2,128 | Marketplace + author tools |
| apps/lq-interactive-book | `apps/lq-interactive-book/` | 1,772 | Choose-your-own-adventure |
| apps/lq-adventure-book | `apps/lq-adventure-book/` | 1,645 | XState adventure game |
| apps/stripe-api | `apps/stripe-api/` | 727 | Stripe backend |
| apps/lq-activity-book | `apps/lq-activity-book/` | 366 | Worksheet activities |
| apps/lq-story-book | `apps/lq-story-book/` | 346 | Story reader |
| apps/lq-books-author | `apps/lq-books-author/` | 53 | Author PWA wrapper |

### lang-quest Breakdown (by disk — code is ~20 lines each)

| Language Group | Disk Size | Files | Notes |
|---------------|-----------|-------|-------|
| lq-nordic | 76 MB | 4,811 | Largest — most languages ported |
| lq-southeast-asian | 70 MB | 5,671 | Most files — many locales |
| lq-balkan | 34 MB | 2,371 | |
| lq-african | 31 MB | 1,698 | |
| lq-east-asian | 28 MB | 1,477 | |
| lq-south-asian | 27 MB | 878 | |
| lq-romance | 23 MB | 1,836 | |
| lq-middle-eastern | 20 MB | 922 | |
| lq-uralic | 17 MB | 669 | |
| lq-slavic | 14 MB | 829 | |
| lq-west-slavic | 14 MB | 680 | |
| lq-germanic | 12 MB | 824 | |
| lq-celtic | 12 MB | 379 | |
| lq-english | 9 MB | 414 | Smallest — single language |

---

## 2. Dependency Map

```
blueforge-org (~32 @blueforge-studio/* packages)
    │ workspace protocol
    ▼
lq-core ──publishes @learnquest/* to packr──┐
    │                                         │
    ├── @learnquest/web-app                   │
    ├── @learnquest/web-core                  │
    ├── @learnquest/ui                        │
    ├── @learnquest/hooks                     │
    ├── @learnquest/schemas                   │
    ├── @learnquest/email                     │
    ├── @learnquest/game-state                │
    ├── @learnquest/lesson-framework          │
    └── @learnquest/database                  │
                                              │
    ┌─────────────────────────────────────────┘
    │ consumed via packr registry
    ▼
┌──────────────┐  ┌─────────────────┐  ┌───────────────┐
│  lang-quest   │  │ books-platform   │  │ school-quest   │
│  14 apps      │  │ 7 apps + stripe  │  │ 6 apps         │
│  web-app ✓    │  │ web-app ✓        │  │ web-app ✓      │
│  web-core ✓   │  │ ui, hooks ✓      │  │ ui, hooks ✓    │
│  ui, hooks ✓  │  │ email ✓          │  │                │
└──────────────┘  │ + @blueforge/*   │  └───────────────┘
                   └─────────────────┘

┌──────────┐  ┌──────────────┐
│ lq-site   │  │lq-operations  │
│ ui ✓      │  │ (no deps)     │
│ email ✓   │  │ templates     │
└──────────┘  └──────────────┘
```

---

## 3. Structural Health Assessment

### What's Working

| Aspect | Assessment |
|--------|-----------|
| **lang-quest as separate repos** | Correct. 10-76 MB of data per group. Merging into one repo would be ~400 MB and growing. Each can be cloned independently. |
| **books-platform as monorepo** | Correct. 7 tightly-coupled apps sharing types, schemas, and Stripe backend. 15K lines — right size. |
| **lq-site standalone** | Correct. Independent deploy pipeline (Vercel), no code flows back to other projects. |
| **packr registry for distribution** | Decouples consumers from lq-core's internal structure. Version pinning possible. |
| **Turborepo in monorepos** | Correct tool for lq-core and books-platform build orchestration. |

### Issues Found

| Issue | Severity | Location | Impact |
|-------|----------|----------|--------|
| **lq-core is 400K lines** | Medium | `lq-core/` | Slow CI, broad blast radius on changes, hard to reason about |
| **Code duplication: apps/web/scripts ↔ libs/tools** | High | `lq-core/` | 70K+ lines duplicated — validation, asset generation, content tools exist in both locations |
| **32 blueforge-org overrides** | Medium | `lq-core/package.json` | Tight coupling to sibling repo; overrides mask version mismatches |
| **lq-operations has no school-quest scaffold script** | Low | `lq-operations/` | Template exists now but `scaffold-repo.ts` only handles lang-quest groups |
| **apps/lang-core is 55 lines** | Low | `lq-core/apps/lang-core/` | Might be a candidate to merge into web-core or web-app |
| **books-platform/lq-adventure-book is 6 MB** | Low | `books-platform/` | Disk size from data/assets, not code (1.6K lines) — acceptable |

---

## 4. Grouping Evaluation

### Should anything merge?

| Candidate merge | Lines combined | Pro | Con | Verdict |
|----------------|---------------|-----|-----|---------|
| **lq-operations → lq-core** | 400K + 130 | One less repo; ops scripts are lq-core-adjacent | Muddies core vs meta-tooling; ops serves all repos not just core | **Keep separate** |
| **school-quest → single monorepo** | 18 total | Less repo overhead for stubs | Inconsistent with lang-quest pattern; will need to split when content grows | **Keep separate** |
| **books-platform → lq-core** | 400K + 15K | Fewer repos | Different domain, different deploy, already works well standalone | **Keep separate** |
| **lq-site → lq-core** | 400K + 5.7K | Could share UI at source level | Totally different stack (Next.js vs Vite), independent deploy | **Keep separate** |

### Should anything split?

| Candidate split | Lines | Pro | Con | Verdict |
|----------------|-------|-----|-----|---------|
| **lq-core/services/ai*** | 13K | Clear domain boundary, distinct API surface | Would need its own publish pipeline; only 13K lines | **Consider — medium value** |
| **lq-core/libs/tools** | 70K | Largest lib, mostly CLI scripts not runtime code | Tightly references apps/web/public paths; would need significant refactoring | **Not yet — high cost** |
| **lq-core/libs/screens** | 81K | Largest lib by lines | Deeply coupled to libs/lang, libs/app — would create circular deps | **No — too coupled** |
| **lq-core/libs/infra** | 11K | Database + error tracking — clear infrastructure layer | Small; extraction overhead not justified | **No — too small** |
| **lq-core/libs/common** | 6.5K | Already published as separate @learnquest/* packages | Already distributed via packr — splitting the source repo adds overhead without benefit | **No** |

---

## 5. Recommendations

### R1: Deduplicate apps/web/scripts ↔ libs/tools (HIGH VALUE)

**Problem**: `apps/web/scripts/` and `libs/tools/` contain near-identical copies of validation, asset generation, and content tools. This is ~70K lines of duplication.

**Current state**: Scripts were originally in `apps/web/scripts/`, then partially extracted to `libs/tools/` for reuse, but both copies were kept.

**Recommendation**: Choose one canonical location. Since `libs/tools/` is the library extraction, make it the source of truth:
1. Have `apps/web/scripts/` import from `@learnquest/tools` instead of keeping local copies
2. Delete the duplicated files from `apps/web/scripts/`
3. This cuts ~70K lines and eliminates drift between the two copies

**Effort**: Medium (mostly deleting + updating imports)
**Impact**: Eliminates largest source of maintenance burden in the codebase

---

### R2: Reduce blueforge-org coupling (HIGH VALUE)

**Problem**: `lq-core/package.json` has 32 `@blueforge-studio/*` workspace overrides pointing to `../../blueforge-org/packages/*`. This means:
- lq-core can't build without blueforge-org cloned alongside it
- Version mismatches are hidden by overrides
- CI needs both repos checked out

**Recommendation**: Publish `@blueforge-studio/*` packages to the packr registry (same as `@learnquest/*`), then consume them as normal dependencies instead of workspace overrides:
1. Set up packr publishing for blueforge-org packages
2. Replace workspace overrides with pinned versions in lq-core
3. Remove the `../../blueforge-org/packages/*` entry from `pnpm-workspace.yaml`

**Effort**: Medium (publish pipeline setup + dependency updates)
**Impact**: lq-core becomes self-contained; CI simplifies; version control improves

---

### R3: Extend scaffold script for school-quest (MEDIUM VALUE)

**Problem**: `lq-operations/scripts/scaffold-repo.ts` only handles lang-quest groups. Templates for school-quest now exist but there's no scaffold command.

**Recommendation**: Add a `scaffold-school` command (or extend existing script with a `--domain school` flag) that:
1. Reads from the school-quest templates
2. Accepts subject name and port number
3. Generates the same structure as lang-quest but without `web-core` dependency

**Effort**: Low (script already exists as a pattern)
**Impact**: Consistent scaffolding across both domains

---

### R4: Finish Zod schema migration in validation scripts (MEDIUM VALUE)

**Problem**: Zod schemas for locale-manifest and taxonomy are created in `@learnquest/schemas`, but the validation scripts still load the (now deleted) JSON Schema files.

**Recommendation**:
1. Update `validate-locale-manifest.ts` to import `LocaleManifestSchema` from `@learnquest/schemas`
2. Update `validate-subject-content.ts` to import `TaxonomySchema` from `@learnquest/schemas`
3. Remove the JSON Schema loading/parsing code from both scripts
4. Optionally strip `"$schema"` references from 59 `locale-manifest.json` files across lang-quest

**Effort**: Low
**Impact**: Completes the JSON Schema → Zod migration; removes dead references

---

### R5: Clean up apps/web size (MEDIUM VALUE, LONG-TERM)

**Problem**: `apps/web` is 150K lines — the single largest package. It contains the app shell, all game screens, and extensive script tooling.

**Recommendation** (phased):
1. **Phase 1**: After R1 (dedup), `apps/web/scripts/` shrinks dramatically as it delegates to `libs/tools`
2. **Phase 2**: Evaluate whether screen components in `apps/web/src/screens/` should move to `libs/screens/` (they may already be duplicated there too)
3. **Phase 3**: Consider splitting `apps/web` into `apps/web` (shell + routing) and `apps/game` (game UI + screens)

**Effort**: High (phased over multiple sessions)
**Impact**: Makes lq-core more maintainable; clearer ownership boundaries

---

### R6: Establish CI for leaf repos (LOW VALUE NOW, HIGH LATER)

**Problem**: All 24 git repos have local git but no GitHub remotes or CI. The `sync-core.yml` workflow template exists but isn't deployed.

**Recommendation**: When GitHub repos are created:
1. Push all repos with initial scaffolds
2. Deploy `sync-core.yml` to each lang-quest and school-quest repo
3. Set up a `core-published` dispatch event from lq-core CI to trigger downstream syncs
4. Add basic CI (typecheck + lint) to books-platform and lq-site

**Effort**: Medium (but blocked on GitHub setup)
**Impact**: Enables automated dependency management across 24 repos

---

## 6. Priority Matrix

| # | Recommendation | Value | Effort | Priority |
|---|---------------|-------|--------|----------|
| R1 | Deduplicate apps/web/scripts ↔ libs/tools | High | Medium | **Do first** |
| R2 | Reduce blueforge-org coupling | High | Medium | **Do second** |
| R4 | Finish Zod migration in validation scripts | Medium | Low | **Quick win** |
| R3 | Extend scaffold script for school-quest | Medium | Low | **Quick win** |
| R5 | Clean up apps/web size | Medium | High | **Plan for later** |
| R6 | Establish CI for leaf repos | High (later) | Medium | **When GitHub is ready** |
