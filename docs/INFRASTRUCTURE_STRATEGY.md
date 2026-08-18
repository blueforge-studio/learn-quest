# LearnQuest Infrastructure Strategy

> Authoritative architecture decision document for the LearnQuest ecosystem.
> Supersedes: SUPABASE_PROJECT_DESIGN.md

> **SUPERSEDED (2026-07-19):** This document describes the pre-2026-07 Supabase-based stack. Supabase (and Firebase) have been removed from the entire LearnQuest ecosystem — the production stack is now on-prem Postgres + Drizzle ORM, with `forge-auth` for SSO and CloudFlare R2 for object storage (see `learn-quest/CLAUDE.md` and `lq-core/CLAUDE.md`). The Supabase-era content remains below for chain-of-evidence; do NOT use the env vars, project URLs, or per-app Supabase tables listed in this document. The active env vars per sub-app are documented in the top-level `README.md` and per-sub-project CLAUDE.md files.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Authentication Architecture](#authentication-architecture)
3. [Database Strategy](#database-strategy)
4. [Storage Strategy](#storage-strategy)
5. [Site Architecture](#site-architecture)
6. [Supabase Projects Inventory](#supabase-projects-inventory)
7. [Data-Driven Marketing Site](#data-driven-marketing-site)
8. [Environment Variables](#environment-variables)
9. [Forge Auth Integration](#forge-auth-integration)
10. [Architecture Decision Records](#architecture-decision-records)

---

## System Overview

LearnQuest is an educational platform ecosystem consisting of language learning apps (LinguaQuest), subject learning apps (SchoolQuest), and a central marketing site. All apps authenticate through a central OAuth proxy (Forge Auth) and use per-domain Supabase projects for data isolation.

```
                         +-------------------------------+
                         |     forge-auth.blueforge.studio     |
                         |   (better-auth + pg-boss)     |
                         |   Central OAuth Proxy          |
                         +-------+-------+-------+-------+
                                 |       |       |
                    signed       |       |       |       signed
                   webhooks      |       |       |      webhooks
                                 |       |       |
              +------------------+       |       +------------------+
              |                          |                          |
              v                          v                          v
  +-----------+----------+   +-----------+----------+   +-----------+----------+
  |     lang-quest       |   |    school-quest      |   |    learn-quest       |
  |  Supabase Project    |   |  Supabase Project    |   |  Supabase Project    |
  |                      |   |                      |   |                      |
  |  14 language groups  |   |  6 subject apps      |   |  lq-site marketing   |
  |  67 languages        |   |  shared lesson_      |   |  YAML -> DB seeded   |
  |  shared lesson_      |   |  progress pattern    |   |  data-driven pages   |
  |  progress pattern    |   |                      |   |                      |
  +----------+-----------+   +----------+-----------+   +----------+-----------+
             |                          |                          |
             v                          v                          v
  +----------+-----------+   +----------+-----------+   +----------+-----------+
  |   lq-assets bucket   |   |   sq-assets bucket   |   |   DB tables (seeded) |
  |  {group}/{lang}/     |   |  {subject}/          |   |   languages, features |
  |  data|audio|images/  |   |  data|images/        |   |   pricing, blog      |
  +----------------------+   +----------------------+   +----------------------+
```

---

## Authentication Architecture

### Forge Auth (forge-auth.blueforge.studio)

Forge Auth is the central authentication service for the entire BlueForge ecosystem.

**Stack:**
- **better-auth** -- OAuth/credentials provider
- **pg-boss** -- PostgreSQL-based webhook job queue
- **BetterAuthAdapter** from `@blueforge-studio/service-factory`

**User sync flow:**

```
  User signs up/logs in at any app
            |
            v
  +-------------------+
  |    Forge Auth      |
  |  (better-auth)     |
  +--------+----------+
           |
           | pg-boss enqueues webhook jobs
           v
  +-------------------+
  |  Webhook Queue    |
  |  (pg-boss)        |
  +--------+----------+
           |
           | Signed POST to each registered app
           |
     +-----+-----+-----+-----+
     |           |           |
     v           v           v
  lang-quest  school-quest  learn-quest
  /api/webhooks/forge-auth
```

**Webhook events:**
- `user.signup` -- new user registered
- `user.login` -- user authenticated
- `user.update` -- profile changed
- `user.delete` -- account removed

**Key principle:** Users are recognized by email across all domains. A user who signs up for a language app and later visits a subject app is the same user, synced via webhooks.

---

## Database Strategy

### Decision: Per-Domain Supabase Projects

Each product domain gets its own Supabase project. This is neither one mega-project nor per-language-group splitting.

```
  +------------------+     +------------------+     +------------------+
  |   forge-auth     |     |   lang-quest     |     |  school-quest    |
  |   (auth DB)      |     |   (learning DB)  |     |  (learning DB)  |
  |                  |     |                  |     |                  |
  |  users           |     |  lesson_progress |     |  lesson_progress |
  |  sessions        |     |  player_profiles |     |  player_profiles |
  |  app_registry    |     |  achievements    |     |  achievements    |
  |  webhook_config  |     |  game_state      |     |  game_state      |
  +------------------+     +------------------+     +------------------+

  +------------------+
  |   learn-quest    |
  |   (marketing DB) |
  |                  |
  |  languages       |
  |  features        |
  |  pricing_tiers   |
  |  blog_posts      |
  +------------------+
```

### How lang-quest handles 14 language groups in one DB

All 14 language group apps (Nordic, Romance, Slavic, etc.) connect to the same `lang-quest` Supabase project. Language-specific data is differentiated by `lesson_id`, not by separate schemas or projects.

```
  lesson_progress table:
  +----+---------+-----------+--------+-------+
  | id | user_id | lesson_id | score  | lang  |
  +----+---------+-----------+--------+-------+
  |  1 | usr_42  | nordic-01 |   85   | sv    |
  |  2 | usr_42  | romance-3 |   92   | fr    |
  |  3 | usr_77  | slavic-12 |   78   | pl    |
  +----+---------+-----------+--------+-------+
```

Language content (vocabulary, grammar rules, audio files, images) lives in static files (JSON, audio, images in Supabase Storage), not in DB records. The DB only tracks user progress, profiles, and game state.

### Why per-domain (not one mega-project)

| Concern                | Per-Domain                              | Mega-Project                        |
|------------------------|-----------------------------------------|-------------------------------------|
| Scaling                | Independent per domain                  | Shared limits, contention           |
| Billing                | Clear cost attribution                  | Opaque cost allocation              |
| Schema migrations      | Isolated, no cross-domain risk          | One migration can break everything  |
| Auto-pause             | Inactive projects pause (cost savings)  | Cannot pause a shared project       |
| User sync              | Handled by Forge Auth webhooks          | Not needed (but coupling increases) |

### Why NOT per-language-group

| Factor                          | Reality                                            |
|---------------------------------|----------------------------------------------------|
| Language content                | Static files (JSON, audio, images), not DB records |
| DB rows per language            | Only lesson_progress (different lesson_ids)        |
| Game mechanics                  | Identical across all language groups               |
| Player profiles                 | Shared schema, same tables                         |
| Operational benefit of split    | None -- adds 14 Supabase projects for no gain      |

---

## Storage Strategy

Each domain has its own Supabase Storage bucket attached to its Supabase project.

### lang-quest: `lq-assets` bucket

```
  lq-assets/
  +-- nordic/
  |   +-- swedish/
  |   |   +-- data/        (vocabulary JSON, lesson definitions)
  |   |   +-- audio/       (pronunciation MP3s)
  |   |   +-- images/      (vocab illustrations, flags)
  |   +-- norwegian/
  |   |   +-- data/
  |   |   +-- audio/
  |   |   +-- images/
  |   +-- ...
  +-- romance/
  |   +-- french/
  |   +-- spanish/
  |   +-- ...
  +-- slavic/
  +-- ...
```

### school-quest: `sq-assets` bucket

```
  sq-assets/
  +-- math/
  |   +-- data/
  |   +-- images/
  +-- science/
  |   +-- data/
  |   +-- images/
  +-- history/
  +-- geography/
  +-- english/
  +-- coding/
```

### learn-quest: No storage bucket

The marketing site stores its content in DB tables, seeded from YAML files (same pattern as forge-platform). No separate storage bucket is needed.

### Storage Provider Abstraction

Asset storage uses `@blueforge-studio/service-factory` for provider switching via `STORAGE_PROVIDER` env var:

| Provider | Env Value | Use Case |
|----------|-----------|----------|
| Supabase Storage | `supabase` | Default — integrated with Supabase project |
| Backblaze B2 | `backblaze_b2` | Cost-optimized for large asset volumes |
| In-Memory | `memory` | Development/testing |

### Cost Comparison: Supabase Storage vs Backblaze B2

| Metric | Supabase Storage | Backblaze B2 |
|--------|-----------------|--------------|
| **Storage** | $0.021/GB/mo (Pro plan included 100GB) | $0.006/GB/mo |
| **Download bandwidth** | 250GB/mo free, then $0.09/GB | 3× storage free, then $0.01/GB |
| **Upload** | Free | Free |
| **API calls** | Unlimited (within rate limits) | $0.004/10K Class B, $0.004/1K Class C |
| **CDN** | Supabase CDN included | Cloudflare partnership (free egress via CF) |

**Cost at scale (per language group, ~4GB assets):**

| Users/mo | Supabase | B2 + Cloudflare |
|----------|----------|-----------------|
| 1K | ~$0 (within free tier) | ~$0.02 |
| 10K | ~$2/mo | ~$0.05 |
| 100K | ~$20/mo | ~$0.50 |
| 1M | ~$200/mo | ~$5/mo |

**Recommendation:** Start with Supabase Storage (zero config, integrated auth). Switch to B2 when monthly egress exceeds 250GB (~50K MAU). The service-factory abstraction makes this a one-line env var change.

### Future Migration Path

```bash
# Current (default)
STORAGE_PROVIDER=supabase

# Future (when egress costs matter)
STORAGE_PROVIDER=backblaze_b2
B2_APPLICATION_KEY_ID=xxx
B2_APPLICATION_KEY=xxx
B2_BUCKET_NAME=lq-assets
B2_BUCKET_ID=xxx
```

---

## Site Architecture

### Domain Map

```
  blueforge.studio                    LearnQuest Ecosystem
  +-- forge-auth.blueforge.studio     Central auth (OAuth proxy)
  +-- learnquest.blueforge.studio     Umbrella marketing site (lq-site)
  |   +-- /languages                  LinguaQuest section
  |   +-- /subjects                   SchoolQuest section
  |   +-- /books                      QuestBooks section
  |   +-- /blog                       Blog
  |   +-- /pricing                    Pricing tiers
  +-- {group}.learnquest....          Individual language game apps
  +-- {subject}.learnquest....        Individual subject game apps
```

**Key decisions:**
- **learnquest.blueforge.studio** (lq-site) is the umbrella marketing site covering languages, subjects, and books
- **blueforge.studio** (forge-platform) is the BlueForge ecosystem hub (40+ products)
- There are NO separate marketing sites for LinguaQuest, SchoolQuest, or QuestBooks -- they are sections within the learnquest site
- Each language/subject app is deployed separately for the actual game/learning experience

---

## Supabase Projects Inventory

| Project         | Ref ID                   | Region    | Purpose                              |
|-----------------|--------------------------|-----------|---------------------------------------|
| lang-quest      | zoqcfyjjnnepbfexujeg     | Frankfurt | Language learning (14 groups, 67 langs)|
| school-quest    | tzjctypvgwhlticscyzv     | Frankfurt | Subject learning (6 subjects)         |
| learn-quest     | zvctlbrmnctjujdarwgo     | Frankfurt | Marketing site data                   |
| forge-auth      | (separate project)       | (existing)| Central authentication                |
| error-tracker   | nmraxczlpjkwkexckqgp    | Ireland   | Error monitoring                      |
| adventure-craft | dnpjfbealjqrrsdhgxfr    | Ireland   | Separate game product                 |

**Region rationale:** Core learning projects in Frankfurt (EU central, GDPR-compliant). Error tracker and adventure-craft in Ireland (pre-existing, no migration needed).

---

## Data-Driven Marketing Site

The learn-quest Supabase project powers the lq-site marketing site using a YAML-to-DB pattern, identical to forge-platform.

### Data Pipeline

```
  Source (repo)                  Seed Script              Supabase DB
  +------------------+         +---------------+        +------------------+
  | data/             |  --->  | scripts/       |  ---> | learn-quest      |
  |  languages.yml    |        |  db-seed.ts    |       |  Supabase tables |
  |  features.yml     |        |                |       |                  |
  |  pricing.yml      |        +---------------+        +------------------+
  |  blog/            |                                         |
  |   post-1.yml      |                                         |
  |   post-2.yml      |                                         v
  +------------------+                                  Server Components
                                                        fetch from Supabase
                                                        with YAML fallback
```

### YAML Data Files

| File                  | Purpose                                      |
|-----------------------|----------------------------------------------|
| `data/languages.yml`  | Language groups, individual languages, status |
| `data/features.yml`   | Product feature descriptions                 |
| `data/pricing.yml`    | Subscription tiers and pricing               |
| `data/blog/`          | Blog posts (one YAML per post)               |

### Seed Script

`scripts/db-seed.ts` reads YAML files and upserts into Supabase tables. Run manually or as part of CI/CD.

### Runtime Behavior

Server components fetch data from Supabase. If Supabase is unavailable, they fall back to reading YAML files directly. This provides resilience during development and outages.

---

## Environment Variables

Every app in the ecosystem follows this pattern:

```env
# Supabase connection (domain-specific project)
VITE_SUPABASE_URL=https://{project-ref}.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# Auth configuration
AUTH_PROVIDER=better-auth
FORGE_AUTH_URL=https://forge-auth.blueforge.studio

# Webhook verification (server-side only)
FORGE_AUTH_WEBHOOK_SECRET=whsec_...
```

### Per-App Supabase URLs

| App Domain     | VITE_SUPABASE_URL                                        |
|----------------|----------------------------------------------------------|
| lang-quest apps| `https://zoqcfyjjnnepbfexujeg.supabase.co`              |
| school-quest   | `https://{school-quest-ref}.supabase.co`                |
| lq-site        | `https://{learn-quest-ref}.supabase.co`                 |

All apps point `FORGE_AUTH_URL` to the same `https://forge-auth.blueforge.studio`.

---

## Forge Auth Integration

### Integration Steps for Any New App

1. **Register the app** in the forge-auth `app` table with its domain and callback URLs.

2. **Configure webhook URL** for the app in forge-auth (e.g., `https://app.domain/api/webhooks/forge-auth`).

3. **Implement the webhook endpoint** at `POST /api/webhooks/forge-auth`:
   - Verify the request signature using `FORGE_AUTH_WEBHOOK_SECRET`
   - Parse the event type (`user.signup`, `user.login`, `user.update`, `user.delete`)
   - Sync the user record in the app's local database

4. **Use BetterAuthAdapter** on the client for login/signup flows:

```
  Client App                     Forge Auth                    App Backend
  +----------+                   +-----------+                 +----------+
  |          |  1. Login request  |           |                 |          |
  |  Better  +------------------>+  better-  |                 |          |
  |  Auth    |                   |  auth     |                 |          |
  |  Adapter |  2. OAuth flow    |  server   |                 |          |
  |          |<----------------->+           |                 |          |
  |          |                   |           |  3. Webhook     |          |
  |          |  4. Session token |           +---------------->+ Webhook  |
  |          |<------------------+           |  (signed POST)  | handler  |
  |          |                   |           |                 |          |
  +----------+                   +-----------+                 +----------+
```

### Webhook Payload Structure

```
POST /api/webhooks/forge-auth
Headers:
  X-Webhook-Signature: sha256=...
  Content-Type: application/json

Body:
{
  "event": "user.signup",
  "data": {
    "id": "usr_...",
    "email": "user@example.com",
    "name": "User Name",
    "avatar": "https://..."
  },
  "timestamp": "2026-04-10T12:00:00Z",
  "app_id": "app_..."
}
```

---

## Architecture Decision Records

### ADR-001: Per-Domain Supabase Projects

**Status:** Accepted

**Context:** Need to decide between a single shared Supabase project, per-domain projects, or per-language-group projects.

**Decision:** Per-domain Supabase projects (lang-quest, school-quest, learn-quest, forge-auth).

**Rationale:** Independent scaling and billing, schema isolation, auto-pause for cost efficiency, manageable number of projects (4 core). Forge Auth webhooks solve the cross-domain user sync problem cleanly.

---

### ADR-002: Shared DB for Language Groups

**Status:** Accepted

**Context:** 14 language groups could each have their own Supabase project.

**Decision:** All language groups share the `lang-quest` project.

**Rationale:** Language content is static files, not DB records. Only lesson_progress varies by language (via lesson_id). All groups share identical game mechanics and player profile schemas. Splitting would create 14 projects with identical schemas and no operational benefit.

---

### ADR-003: Forge Auth as Central OAuth Proxy

**Status:** Accepted

**Context:** Multiple apps across multiple domains need authentication with shared user identity.

**Decision:** Forge Auth (better-auth + pg-boss) serves as the single authentication authority. All apps integrate via BetterAuthAdapter and receive user sync via signed webhooks.

**Rationale:** Centralized user identity recognized by email. Decoupled via async webhooks (pg-boss ensures delivery). Apps remain independently deployable. No shared session store needed.

---

### ADR-004: Data-Driven Marketing Site

**Status:** Accepted

**Context:** lq-site needs to display language lists, features, pricing, and blog content.

**Decision:** Follow the forge-platform pattern: YAML source files seeded into Supabase DB tables, server components fetch from DB with YAML fallback.

**Rationale:** Proven pattern from forge-platform. Content editable via YAML in version control. DB provides fast reads and query flexibility. YAML fallback ensures resilience.

---

### ADR-005: No Separate Sub-Brand Sites

**Status:** Accepted

**Context:** LinguaQuest, SchoolQuest, and QuestBooks could each have their own marketing site.

**Decision:** Single umbrella site at learnquest.blueforge.studio with sections for each sub-brand.

**Rationale:** Reduces deployment complexity, avoids content duplication, presents a unified brand, simplifies SEO strategy. Individual game/learning apps are still deployed separately.
