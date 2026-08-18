# LearnQuest Database Abstraction Design

**Date:** 2026-04-22
**Author:** Claude Code
**Status:** Draft

## Context

LearnQuest currently runs on Supabase cloud. The goal is to support switching between Supabase and self-hosted Postgres (on-prem Supabase) by:

1. Adding a PostgresAdapter to `lq-core` that implements the existing `IDatabase` interface
2. Routing auth through `forge-auth` + `platform-api` (from forge-control)
3. Ensuring all database access goes through a service layer for easy swapping/mocking
4. Creating `.pg.sql` migration variants (many already exist)

## Existing Foundation

### IDatabase Interface
Location: `lq-core/libs/infra/database/src/IDatabase.ts`

Already defines the contract for all database operations:
- `lessons`, `chapters`, `achievements`, `players`, `challenges`, `chats`, `learnedWords`, `rewards`, `groups`, `groupMembers`, `groupInvitations`, `votes`, `feedback`, `challengeInstances`, `equipment`, `bosses`, `features`, `tournaments`
- Each collection has: `get`, `getAll`, `create`, `update`, `delete` (varies by collection)

### SupabaseAdapter
Location: `lq-core/libs/infra/database/src/supabase/SupabaseAdapter.ts`

Implements `IDatabase` using `@supabase/supabase-js`.

### Migration Files
Many `.pg.sql` files already exist as Postgres-compatible variants (no RLS, no `auth.uid()` calls):
- `lq-core/supabase/migrations/*.pg.sql`
- `lingua-quest/supabase/migrations/*.pg.sql`
- `school-quest/supabase/migrations/*.pg.sql`
- `books-platform/supabase/migrations/*.pg.sql`

### forge-control Integration Points
- **forge-auth**: Session management, token validation
- **platform-api**: Auth middleware, user context injection

---

## Design: Db Adapter Architecture

### Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        App Layer                            │
│  (lingua-quest, school-quest, books-platform, etc.)        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Database Service                         │
│         (IDatabase interface - single abstraction)         │
└─────────────────────────────────────────────────────────────┘
                    │                    │
          ┌─────────┴─────────┐  ┌──────┴───────┐
          ▼                     ▼  ▼              ▼
   ┌──────────────┐    ┌──────────────┐  ┌──────────────┐
   │SupabaseAdapter│    │PostgresAdapter│  │ MockAdapter  │
   └──────────────┘    └──────────────┘  └──────────────┘
          │                     │              │
          ▼                     ▼              ▼
   ┌──────────────┐    ┌──────────────┐  ┌──────────────┐
   │Supabase Cloud│    │Self-hosted PG│  │In-memory/TEST│
   └──────────────┘    └──────────────┘  └──────────────┘
```

### Apps Using Database

| App | Package | Database Usage | Migration Location |
|-----|---------|----------------|-------------------|
| lingua-quest | `@supabase/supabase-js` | Player state, scenarios, NPCs, dialogues | `lingua-quest/supabase/migrations/` |
| school-quest | Direct Postgres | Student profiles, lesson progress, achievements, subscriptions | `school-quest/supabase/migrations/` |
| books-platform | Direct Postgres | Authors, books, purchases, reviews | `books-platform/supabase/migrations/` |
| lq-core | `SupabaseAdapter` | All collections via IDatabase | `lq-core/supabase/migrations/` |

---

## Component Design

### 1. Database Config

```typescript
// lq-core/libs/infra/database/src/config.ts
export interface DatabaseConfig {
  provider: 'supabase' | 'postgres';
  supabase?: {
    url: string;
    anonKey: string;
    serviceKey?: string;
  };
  postgres?: {
    connectionString: string;
    schema?: string;
  };
}

export function getDatabaseConfig(): DatabaseConfig {
  const provider = import.meta.env.VITE_DB_PROVIDER || 'supabase';
  
  if (provider === 'postgres') {
    return {
      provider: 'postgres',
      postgres: {
        connectionString: import.meta.env.VITE_POSTGRES_CONNECTION_STRING,
        schema: import.meta.env.VITE_POSTGRES_SCHEMA,
      }
    };
  }
  
  return {
    provider: 'supabase',
    supabase: {
      url: import.meta.env.VITE_SUPABASE_URL,
      anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    }
  };
}
```

### 2. PostgresAdapter

Location: `lq-core/libs/infra/database/src/postgres/PostgresAdapter.ts`

```typescript
import type { IDatabase } from '../IDatabase';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';

export class PostgresAdapter implements IDatabase {
  private db;
  private pool;
  
  constructor(connectionString: string, schemaName?: string) {
    this.pool = new pg.Pool({ connectionString });
    this.db = drizzle(this.pool, { schema });
  }
  
  // Implement all IDatabase methods using Drizzle ORM
  // Each collection maps to a Postgres table with app_id isolation
  
  lessons = createLessonsCollection(this.db);
  chapters = createChaptersCollection(this.db);
  // ... etc for all collections
}
```

### 3. Database Factory

```typescript
// lq-core/libs/infra/database/src/createDatabase.ts
import { SupabaseAdapter } from './supabase/SupabaseAdapter';
import { PostgresAdapter } from './postgres/PostgresAdapter';
import type { IDatabase } from './IDatabase';
import type { DatabaseConfig } from './config';

export function createDatabase(config: DatabaseConfig): IDatabase {
  switch (config.provider) {
    case 'postgres':
      return new PostgresAdapter(
        config.postgres.connectionString,
        config.postgres.schema
      );
    case 'supabase':
    default:
      return new SupabaseAdapter({
        url: config.supabase.url,
        anonKey: config.supabase.anonKey,
        serviceKey: config.supabase.serviceKey,
      });
  }
}
```

### 4. Auth Integration (forge-auth + platform-api)

Location: `lq-core/libs/infra/auth/src/`

```typescript
// Auth service that wraps forge-auth / platform-api
export interface AuthConfig {
  provider: 'forge' | 'supabase';
  forge?: {
    apiUrl: string;
    apiKey: string;
  };
  supabase?: {
    url: string;
    anonKey: string;
  };
}

export class AuthService {
  async getCurrentUser(token: string): Promise<User | null>;
  async validateSession(token: string): Promise<boolean>;
  async refreshToken(token: string): Promise<string>;
}
```

### 5. Realtime Support

Postgres uses LISTEN/NOTIFY for realtime. Wrap in a `RealtimeService`:

```typescript
// lq-core/libs/infra/realtime/src/
export interface RealtimeConfig {
  provider: 'supabase' | 'postgres';
}

export class RealtimeService {
  subscribe(channel: string, callback: (payload: any) => void): void;
  unsubscribe(channel: string): void;
}
```

---

## Per-App Migration Strategy

### lingua-quest

**Current schema:** 5 tables (scenarios, scenes, npcs, dialogues, content_submissions)
**Postgres variant:** `lingua-quest/supabase/migrations/*.pg.sql` (already exist)

**Integration:**
1. Add `PostgresAdapter` to `lingua-quest/libs/database/`
2. Use existing `.pg.sql` migrations
3. Wire into `lingua-quest/apps/web/src/stores/gameStore.ts` via database service

### school-quest

**Current schema:** 4 tables (student_profiles, lesson_progress, achievements, subscriptions)
**Postgres variant:** `school-quest/supabase/migrations/*.pg.sql` (already exist)

**Integration:**
1. Add `PostgresAdapter` to `school-quest/`
2. Use existing `.pg.sql` migrations
3. Add database service layer similar to other apps

### books-platform

**Current schema:** `publishing` schema (authors, books, book_content, purchases, author_payouts, book_reviews)
**Postgres variant:** `books-platform/supabase/migrations/*.pg.sql` (already exist)

**Integration:**
1. Add `PostgresAdapter` to `books-platform/packages/database/`
2. Use existing `.pg.sql` migrations
3. Stripe API (`apps/stripe-api/`) uses the same Postgres instance

### lq-core

**Current:** `SupabaseAdapter` + collections
**Postgres variant:** `lq-core/supabase/migrations/*.pg.sql` (already exist)

**Integration:**
1. Add `PostgresAdapter` to `lq-core/libs/infra/database/src/postgres/`
2. Drizzle ORM schema matching existing collection structure
3. All language apps (14 lang groups) inherit via `@learnquest/database`

---

## Service Layer Pattern

Each app gets a `DatabaseService` that wraps the adapter:

```typescript
// Example: lingua-quest/libs/database/src/DatabaseService.ts
export class DatabaseService {
  private db: IDatabase;
  
  constructor(config: DatabaseConfig) {
    this.db = createDatabase(config);
  }
  
  // Typed methods that map to IDatabase operations
  async getLesson(id: string) {
    return this.db.lessons.get(id);
  }
  
  async getPlayerProgress(playerId: string) {
    return this.db.players.get(playerId);
  }
}
```

This allows:
- **Swapping providers** by changing config
- **Mocking in tests** via mock adapter
- **Logging/analytics** middleware around operations
- **Caching layer** (optional Redis decorator)

---

## Migration Files

### Naming Convention

| Original | Postgres Variant |
|----------|-----------------|
| `YYYYMMDD_name.sql` | `YYYYMMDD_name.pg.sql` |

### Key Differences in .pg.sql

1. **No RLS**: Remove `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
2. **No auth.uid()**: Replace with explicit `user_id` parameters
3. **UUID generation**: Use `gen_random_uuid()` (built-in pgcrypto)
4. **Schema prefix**: Use `app schema` (e.g., `content.apps`)
5. **No supabase_realtime**: Remove realtime subscriptions

---

## Environment Variables

```bash
# Database provider selection
VITE_DB_PROVIDER=supabase|postgres

# Supabase (existing)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_SUPABASE_SERVICE_KEY=

# Postgres (new)
VITE_POSTGRES_CONNECTION_STRING=
VITE_POSTGRES_SCHEMA=content

# Auth
VITE_AUTH_PROVIDER=forge|supabase
VITE_FORGE_API_URL=
VITE_FORGE_API_KEY=
```

---

## Implementation Order

### Phase 1: Core Infrastructure
1. Create `PostgresAdapter` in `lq-core/libs/infra/database/src/postgres/`
2. Add Drizzle ORM schema for lq-core collections
3. Create `createDatabase()` factory
4. Update `DatabaseConfig` interface

### Phase 2: lingua-quest
1. Create `DatabaseService` for lingua-quest
2. Wire into game store
3. Test with existing `.pg.sql` migrations

### Phase 3: school-quest
1. Create `DatabaseService` for school-quest
2. Wire into lesson progress tracking
3. Test with existing `.pg.sql` migrations

### Phase 4: books-platform
1. Create `DatabaseService` for books-platform
2. Wire into Stripe API
3. Test with existing `.pg.sql` migrations

### Phase 5: Auth Integration
1. Create `AuthService` wrapping forge-auth
2. Integrate with platform-api for token validation
3. Replace Supabase Auth calls

### Phase 6: Realtime
1. Create `RealtimeService` using LISTEN/NOTIFY
2. Migrate Supabase realtime subscriptions

---

## Testing Strategy

### Unit Tests
- Mock adapter for all IDatabase operations
- Test PostgresAdapter SQL generation

### Integration Tests
- Run against local Postgres instance
- Test migrations with `pg-migrator`

### E2E Tests
- Use Playwright against both providers
- Verify feature parity

---

## Open Questions

1. **Multi-tenancy**: How to handle app isolation? (Per-app Postgres schemas vs. `app_id` column)
2. **Stripe**: books-platform Stripe API currently uses Supabase. Move to Postgres-backed service?
3. **Migrations**: Need a migration runner that handles both `.sql` (Supabase) and `.pg.sql` (Postgres)

---

## References

- [IDatabase Interface](file://lq-core/libs/infra/database/src/IDatabase.ts)
- [SupabaseAdapter](file://lq-core/libs/infra/database/src/supabase/SupabaseAdapter.ts)
- [PostgresAdapter reference](file://forge-control/.worktrees/hosting-migration/packages/database-hosting/src/)
- [forge-auth events](file://forge-control/.worktrees/hosting-migration/apps/mission-control/src/lib/db/migrations/001_forge_auth_events.sql)
- [Existing .pg.sql migrations](file://lq-core/supabase/migrations/)
