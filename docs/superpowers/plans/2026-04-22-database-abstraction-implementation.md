# Database Abstraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Postgres support to LearnQuest apps via a database adapter pattern, enabling switching between Supabase cloud and self-hosted Postgres.

**Architecture:** Create a `PostgresAdapter` in `lq-core` implementing the existing `IDatabase` interface using Drizzle ORM + pg driver. Use a factory pattern to swap providers via `VITE_DB_PROVIDER` env var. Auth via forge-auth + platform-api.

**Tech Stack:** Drizzle ORM, pg (node-postgres), TypeScript, Vitest

---

## File Map

```
lq-core/libs/infra/database/src/
├── IDatabase.ts                    # Existing interface (no change)
├── config.ts                      # NEW: DatabaseConfig + getDatabaseConfig()
├── createDatabase.ts               # NEW: Factory function
├── supabase/                      # Existing
│   ├── SupabaseAdapter.ts
│   └── index.ts
└── postgres/                      # NEW: Postgres adapter
    ├── PostgresAdapter.ts         # Main adapter class
    ├── schema.ts                  # Drizzle schema for collections
    └── index.ts

lingua-quest/libs/database/       # NEW: lingua-quest service
├── DatabaseService.ts
└── index.ts

school-quest/libs/database/        # NEW: school-quest service  
├── DatabaseService.ts
└── index.ts

books-platform/packages/database/ # NEW: books-platform service
├── DatabaseService.ts
└── index.ts
```

---

## Task 1: Database Config & Factory

**Files:**
- Create: `lq-core/libs/infra/database/src/config.ts`
- Create: `lq-core/libs/infra/database/src/createDatabase.ts`
- Modify: `lq-core/libs/infra/database/src/index.ts` (export new modules)

- [ ] **Step 1: Create config.ts**

```typescript
// lq-core/libs/infra/database/src/config.ts
export interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceKey?: string;
}

export interface PostgresConfig {
  connectionString: string;
  schema?: string;
}

export type DatabaseProvider = 'supabase' | 'postgres';

export interface DatabaseConfig {
  provider: DatabaseProvider;
  supabase?: SupabaseConfig;
  postgres?: PostgresConfig;
}

export function getDatabaseConfig(): DatabaseConfig {
  const provider = (import.meta.env.VITE_DB_PROVIDER as DatabaseProvider) || 'supabase';

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
      serviceKey: import.meta.env.VITE_SUPABASE_SERVICE_KEY,
    }
  };
}
```

- [ ] **Step 2: Create createDatabase.ts**

```typescript
// lq-core/libs/infra/database/src/createDatabase.ts
import { SupabaseAdapter, type SupabaseConfig } from './supabase/SupabaseAdapter';
import { PostgresAdapter, type PostgresConfig } from './postgres/PostgresAdapter';
import type { IDatabase } from './IDatabase';
import type { DatabaseConfig } from './config';

export function createDatabase(config: DatabaseConfig): IDatabase {
  switch (config.provider) {
    case 'postgres':
      if (!config.postgres) {
        throw new Error('Postgres config required when provider is postgres');
      }
      return new PostgresAdapter(config.postgres);
    case 'supabase':
    default:
      if (!config.supabase) {
        throw new Error('Supabase config required when provider is supabase');
      }
      return new SupabaseAdapter(config.supabase);
  }
}
```

- [ ] **Step 3: Update index.ts exports**

```typescript
// lq-core/libs/infra/database/src/index.ts
export { SupabaseAdapter, createSupabaseAdapter } from './supabase';
export type { SupabaseConfig } from './supabase';
export { PostgresAdapter } from './postgres';
export type { PostgresConfig } from './postgres';
export { createDatabase, getDatabaseConfig } from './createDatabase';
export type { DatabaseConfig, DatabaseProvider } from './config';
export type { IDatabase } from './IDatabase';
```

- [ ] **Step 4: Add env types to lq-core**

Add to `apps/web/src/env.ts` or create `libs/infra/database/src/env.ts`:
```typescript
/// <reference types="vite/client" />
interface ImportMetaEnv {
  VITE_DB_PROVIDER: 'supabase' | 'postgres';
  VITE_SUPABASE_URL: string;
  VITE_SUPABASE_ANON_KEY: string;
  VITE_SUPABASE_SERVICE_KEY?: string;
  VITE_POSTGRES_CONNECTION_STRING: string;
  VITE_POSTGRES_SCHEMA?: string;
}
```

- [ ] **Step 5: Commit**

```bash
cd lq-core
git add libs/infra/database/src/config.ts libs/infra/database/src/createDatabase.ts libs/infra/database/src/index.ts
git commit -m "feat(database): add config and factory for database providers"
```

---

## Task 2: PostgresAdapter with Drizzle Schema

**Files:**
- Create: `lq-core/libs/infra/database/src/postgres/schema.ts`
- Create: `lq-core/libs/infra/database/src/postgres/PostgresAdapter.ts`
- Create: `lq-core/libs/infra/database/src/postgres/index.ts`
- Modify: `lq-core/libs/infra/database/src/postgres/.gitkeep` (remove if exists)

- [ ] **Step 1: Create Drizzle schema**

```typescript
// lq-core/libs/infra/database/src/postgres/schema.ts
import { pgTable, text, integer, boolean, timestamp, jsonb, uuid, serial } from 'drizzle-orm/pg-core';

// Core tables matching IDatabase collections
export const lessons = pgTable('lessons', {
  id: text('id').primaryKey(),
  chapterId: text('chapter_id'),
  appId: text('app_id').notNull(),
  locale: text('locale').notNull(),
  type: text('type').notNull(),
  title: text('title').notNull(),
  difficulty: text('difficulty'),
  estimatedTime: integer('estimated_time'),
  xpReward: integer('xp_reward'),
  status: text('status').notNull().default('locked'),
  content: jsonb('content').notNull(),
  contentVersion: integer('content_version').notNull().default(1),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const chapters = pgTable('chapters', {
  id: text('id').primaryKey(),
  appId: text('app_id').notNull(),
  locale: text('locale').notNull(),
  sectionId: text('section_id').notNull().default('_'),
  bookId: text('book_id').notNull().default('_'),
  displayOrder: integer('display_order').notNull(),
  title: text('title').notNull(),
  description: text('description'),
});

export const achievements = pgTable('achievements', {
  id: uuid('id').primaryKey().defaultRandom(),
  appId: text('app_id').notNull(),
  category: text('category'),
  name: text('name').notNull(),
  description: text('description'),
  icon: text('icon'),
  xpReward: integer('xp_reward'),
  rarity: text('rarity'),
  unlockCriteria: jsonb('unlock_criteria'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const players = pgTable('players', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  displayName: text('display_name'),
  avatarUrl: text('avatar_url'),
  xp: integer('xp').notNull().default(0),
  level: integer('level').notNull().default(1),
  languageGroup: text('language_group').notNull().default('nordic'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const challenges = pgTable('challenges', {
  id: text('id').primaryKey(),
  appId: text('app_id').notNull(),
  type: text('type').notNull(),
  difficulty: text('difficulty').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  xpReward: integer('xp_reward'),
  gemReward: integer('gem_reward'),
  isActive: boolean('is_active').notNull().default(true),
  startsAt: timestamp('starts_at'),
  endsAt: timestamp('ends_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const chats = pgTable('chats', {
  id: text('id').primaryKey(),
  playerId: text('player_id').notNull(),
  npcId: text('npc_id'),
  dialogueId: text('dialogue_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  messages: jsonb('messages').default('[]'),
});

export const learnedWords = pgTable('learned_words', {
  id: uuid('id').primaryKey().defaultRandom(),
  playerId: text('player_id').notNull(),
  word: text('word').notNull(),
  translation: text('translation'),
  language: text('language').notNull(),
  correctCount: integer('correct_count').notNull().default(0),
  incorrectCount: integer('incorrect_count').notNull().default(0),
  lastPracticedAt: timestamp('last_practiced_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const rewards = pgTable('rewards', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  day: integer('day'),
  xpReward: integer('xp_reward').notNull(),
  gemReward: integer('gem_reward').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const groups = pgTable('groups', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  inviteCode: text('invite_code'),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const groupMembers = pgTable('group_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: text('group_id').notNull().references(() => groups.id),
  playerId: text('player_id').notNull(),
  role: text('role').notNull().default('member'),
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
});

export const groupInvitations = pgTable('group_invitations', {
  id: text('id').primaryKey(),
  groupId: text('group_id').notNull().references(() => groups.id),
  invitedBy: text('invited_by').notNull(),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const votes = pgTable('votes', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  targetType: text('target_type').notNull(),
  targetId: text('target_id').notNull(),
  voteType: text('vote_type').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const feedback = pgTable('feedback', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  type: text('type').notNull(),
  content: text('content').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const challengeInstances = pgTable('challenge_instances', {
  id: text('id').primaryKey(),
  challengeId: text('challenge_id').notNull().references(() => challenges.id),
  playerId: text('player_id').notNull(),
  status: text('status').notNull().default('pending'),
  score: integer('score'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const equipment = pgTable('equipment', {
  id: text('id').primaryKey(),
  appId: text('app_id').notNull(),
  name: text('name').notNull(),
  slot: text('slot').notNull(),
  rarity: text('rarity').notNull(),
  attack: integer('attack'),
  defense: integer('defense'),
  speed: integer('speed'),
  hp: integer('hp'),
  price: integer('price'),
  unlockLevel: integer('unlock_level'),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const bosses = pgTable('bosses', {
  id: text('id').primaryKey(),
  appId: text('app_id').notNull(),
  name: text('name').notNull(),
  title: text('title'),
  level: integer('level').notNull(),
  maxHp: integer('max_hp').notNull(),
  attackPower: integer('attack_power').notNull(),
  defense: integer('defense').notNull(),
  speed: integer('speed').notNull(),
  element: text('element'),
  xpReward: integer('xp_reward').notNull(),
  gemReward: integer('gem_reward').notNull().default(0),
  difficulty: text('difficulty').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const features = pgTable('features', {
  id: text('id').primaryKey(),
  key: text('key').notNull(),
  enabled: boolean('enabled').notNull().default(false),
  rolloutPercentage: integer('rollout_percentage'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const tournaments = pgTable('tournaments', {
  id: text('id').primaryKey(),
  organizerId: text('organizer_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').notNull().default('draft'),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const lessonProgress = pgTable('lesson_progress', {
  id: uuid('id').primaryKey().defaultRandom(),
  playerId: text('player_id').notNull(),
  lessonId: text('lesson_id').notNull(),
  status: text('status').notNull().default('not_started'),
  score: integer('score'),
  xpEarned: integer('xp_earned').notNull().default(0),
  attempts: integer('attempts').notNull().default(0),
  bestScore: integer('best_score'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
```

- [ ] **Step 2: Create PostgresAdapter**

```typescript
// lq-core/libs/infra/database/src/postgres/PostgresAdapter.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import type { IDatabase } from '../IDatabase';
import type { PostgresConfig } from './index';
import * as schema from './schema';

export class PostgresAdapter implements IDatabase {
  private db;
  private pool;
  private logPrefix = 'postgres';

  constructor(config: PostgresConfig) {
    this.pool = new pg.Pool({ connectionString: config.connectionString });
    this.db = drizzle(this.pool, { schema });
  }

  // Lessons collection
  lessons = {
    get: async (id: string) => {
      const result = await this.db.select().from(schema.lessons).where(
        // eq equivalent
      ).limit(1);
      return result[0] || undefined;
    },
    getAll: async () => {
      return this.db.select().from(schema.lessons);
    },
    getByChapter: async (chapterId: string) => {
      return this.db.select().from(schema.lessons).where(
        // eq equivalent for chapterId
      );
    },
    create: async (lesson: typeof schema.lessons.$inferInsert) => {
      return this.db.insert(schema.lessons).values(lesson).returning();
    },
    update: async (id: string, updates: Partial<typeof schema.lessons.$inferSelect>) => {
      return this.db.update(schema.lessons).set(updates).where(
        // eq equivalent
      );
    },
    delete: async (id: string) => {
      return this.db.delete(schema.lessons).where(
        // eq equivalent
      );
    },
  };

  chapters = {
    get: async (id: string) => { /* ... */ },
    getAll: async () => { return this.db.select().from(schema.chapters); },
    create: async (chapter: typeof schema.chapters.$inferInsert) => { /* ... */ },
    update: async (id: string, updates: Partial<typeof schema.chapters.$inferSelect>) => { /* ... */ },
    delete: async (id: string) => { /* ... */ },
  };

  achievements = {
    get: async (id: string) => { /* ... */ },
    getAll: async () => { return this.db.select().from(schema.achievements); },
    getByCategory: async (category: string) => { /* ... */ },
    create: async (achievement: typeof schema.achievements.$inferInsert) => { /* ... */ },
    update: async (id: string, updates: Partial<typeof schema.achievements.$inferSelect>) => { /* ... */ },
    delete: async (id: string) => { /* ... */ },
  };

  players = {
    get: async (id: string) => { /* ... */ },
    getAll: async () => { return this.db.select().from(schema.players); },
    getTopPlayers: async (limit = 10) => { /* ... */ },
    search: async (query: string) => { /* ... */ },
    create: async (player: typeof schema.players.$inferInsert) => { /* ... */ },
    update: async (id: string, updates: Partial<typeof schema.players.$inferSelect>) => { /* ... */ },
  };

  challenges = {
    get: async (id: string) => { /* ... */ },
    getAll: async () => { return this.db.select().from(schema.challenges); },
    getActive: async () => { /* ... */ },
    getCompleted: async () => { /* ... */ },
    getByType: async (type: string) => { /* ... */ },
    getByDifficulty: async (difficulty: string) => { /* ... */ },
    create: async (challenge: typeof schema.challenges.$inferInsert) => { /* ... */ },
    update: async (id: string, updates: Partial<typeof schema.challenges.$inferSelect>) => { /* ... */ },
    delete: async (id: string) => { /* ... */ },
  };

  chats = {
    get: async (id: string) => { /* ... */ },
    getAll: async () => { return this.db.select().from(schema.chats); },
    getForPlayer: async (playerId: string) => { /* ... */ },
    create: async (chat: typeof schema.chats.$inferInsert) => { /* ... */ },
    update: async (id: string, updates: Partial<typeof schema.chats.$inferSelect>) => { /* ... */ },
    delete: async (id: string) => { /* ... */ },
  };

  learnedWords = {
    get: async (id: string) => { /* ... */ },
    getAll: async () => { return this.db.select().from(schema.learnedWords); },
    getByPlayer: async (playerId: string) => { /* ... */ },
    create: async (word: typeof schema.learnedWords.$inferInsert) => { /* ... */ },
    update: async (id: string, updates: Partial<typeof schema.learnedWords.$inferSelect>) => { /* ... */ },
    delete: async (id: string) => { /* ... */ },
  };

  rewards = {
    getAll: async () => { return this.db.select().from(schema.rewards); },
    getDailyRewards: async () => { /* ... */ },
    getDailyReward: async (day: number) => { /* ... */ },
    getXPLevels: async () => { /* ... */ },
    getLevelForXP: async (xp: number) => { /* ... */ },
  };

  groups = {
    get: async (id: string) => { /* ... */ },
    getAll: async () => { return this.db.select().from(schema.groups); },
    getByMember: async (playerId: string) => { /* ... */ },
    create: async (group: typeof schema.groups.$inferInsert) => { /* ... */ },
    update: async (id: string, updates: Partial<typeof schema.groups.$inferSelect>) => { /* ... */ },
    delete: async (id: string) => { /* ... */ },
  };

  groupMembers = {
    get: async (groupId: string, playerId: string) => { /* ... */ },
    getAll: async () => { return this.db.select().from(schema.groupMembers); },
    getByGroup: async (groupId: string) => { /* ... */ },
    getByPlayer: async (playerId: string) => { /* ... */ },
    create: async (member: typeof schema.groupMembers.$inferInsert) => { /* ... */ },
    update: async (groupId: string, playerId: string, updates: Partial<typeof schema.groupMembers.$inferSelect>) => { /* ... */ },
    delete: async (groupId: string, playerId: string) => { /* ... */ },
  };

  groupInvitations = {
    get: async (id: string) => { /* ... */ },
    getAll: async () => { return this.db.select().from(schema.groupInvitations); },
    getByGroup: async (groupId: string) => { /* ... */ },
    getByPlayer: async (playerId: string) => { /* ... */ },
    create: async (invitation: typeof schema.groupInvitations.$inferInsert) => { /* ... */ },
    update: async (id: string, updates: Partial<typeof schema.groupInvitations.$inferSelect>) => { /* ... */ },
    delete: async (id: string) => { /* ... */ },
  };

  votes = {
    get: async (id: string) => { /* ... */ },
    getAll: async () => { return this.db.select().from(schema.votes); },
    create: async (vote: typeof schema.votes.$inferInsert) => { /* ... */ },
    update: async (id: string, updates: Record<string, unknown>) => { /* ... */ },
    delete: async (id: string) => { /* ... */ },
  };

  feedback = {
    get: async (id: string) => { /* ... */ },
    getAll: async () => { return this.db.select().from(schema.feedback); },
    create: async (feedback: typeof schema.feedback.$inferInsert) => { /* ... */ },
    update: async (id: string, updates: Record<string, unknown>) => { /* ... */ },
    delete: async (id: string) => { /* ... */ },
  };

  challengeInstances = {
    get: async (id: string) => { /* ... */ },
    getAll: async () => { return this.db.select().from(schema.challengeInstances); },
    getByPlayer: async (playerId: string) => { /* ... */ },
    create: async (instance: typeof schema.challengeInstances.$inferInsert) => { /* ... */ },
    update: async (id: string, updates: Record<string, unknown>) => { /* ... */ },
    delete: async (id: string) => { /* ... */ },
  };

  equipment = {
    get: async (id: string) => { /* ... */ },
    getAll: async () => { return this.db.select().from(schema.equipment); },
    create: async (equipment: typeof schema.equipment.$inferInsert) => { /* ... */ },
    update: async (id: string, updates: Partial<typeof schema.equipment.$inferSelect>) => { /* ... */ },
    delete: async (id: string) => { /* ... */ },
  };

  bosses = {
    get: async (id: string) => { /* ... */ },
    getAll: async () => { return this.db.select().from(schema.bosses); },
    create: async (boss: typeof schema.bosses.$inferInsert) => { /* ... */ },
    update: async (id: string, updates: Partial<typeof schema.bosses.$inferSelect>) => { /* ... */ },
    delete: async (id: string) => { /* ... */ },
  };

  features = {
    get: async (id: string) => { /* ... */ },
    getAll: async () => { return this.db.select().from(schema.features); },
    create: async (feature: typeof schema.features.$inferInsert) => { /* ... */ },
    update: async (id: string, updates: Partial<typeof schema.features.$inferSelect>) => { /* ... */ },
    delete: async (id: string) => { /* ... */ },
  };

  tournaments = {
    get: async (id: string) => { /* ... */ },
    getAll: async () => { return this.db.select().from(schema.tournaments); },
    getByStatus: async (status: string) => { /* ... */ },
    getByOrganizer: async (organizerId: string) => { /* ... */ },
    create: async (tournament: typeof schema.tournaments.$inferInsert) => { /* ... */ },
    update: async (id: string, updates: Partial<typeof schema.tournaments.$inferSelect>) => { /* ... */ },
    delete: async (id: string) => { /* ... */ },
  };

  async reset(): Promise<void> {
    // Clear all tables - destructive, use with caution
    await this.db.delete(schema.lessonProgress);
    await this.db.delete(schema.achievements);
    await this.db.delete(schema.players);
    await this.db.delete(schema.chats);
    await this.db.delete(schema.learnedWords);
    await this.db.delete(schema.challengeInstances);
    await this.db.delete(schema.groups);
    await this.db.delete(schema.groupMembers);
    await this.db.delete(schema.groupInvitations);
    await this.db.delete(schema.votes);
    await this.db.delete(schema.feedback);
    await this.db.delete(schema.challenges);
    await this.db.delete(schema.equipment);
    await this.db.delete(schema.bosses);
    await this.db.delete(schema.features);
    await this.db.delete(schema.tournaments);
    await this.db.delete(schema.lessons);
    await this.db.delete(schema.chapters);
  }
}
```

- [ ] **Step 3: Create index.ts**

```typescript
// lq-core/libs/infra/database/src/postgres/index.ts
export { PostgresAdapter } from './PostgresAdapter';
export type { PostgresConfig } from './PostgresAdapter';
export * from './schema';
```

- [ ] **Step 4: Add dependencies to lq-core**

Add to `libs/infra/database/package.json`:
```json
{
  "dependencies": {
    "drizzle-orm": "^0.38.0",
    "pg": "^8.13.0",
    "@types/pg": "^8.11.0"
  }
}
```

- [ ] **Step 5: Commit**

```bash
cd lq-core
git add libs/infra/database/src/postgres/
git commit -m "feat(database): add PostgresAdapter with Drizzle ORM schema"
```

---

## Task 3: lingua-quest DatabaseService

**Files:**
- Create: `lingua-quest/libs/database/DatabaseService.ts`
- Create: `lingua-quest/libs/database/index.ts`
- Modify: `lingua-quest/apps/web/src/stores/gameStore.ts` (wire in service)

- [ ] **Step 1: Create DatabaseService**

```typescript
// lingua-quest/libs/database/DatabaseService.ts
import { createDatabase, getDatabaseConfig } from '@learnquest/database';

export class DatabaseService {
  private db;

  constructor() {
    const config = getDatabaseConfig();
    this.db = createDatabase(config);
  }

  // Player operations
  async getPlayer(userId: string) {
    return this.db.players.get(userId);
  }

  async createPlayer(player: { id: string; userId: string; displayName?: string }) {
    return this.db.players.create(player);
  }

  async updatePlayerProgress(userId: string, updates: { xp?: number; level?: number }) {
    return this.db.players.update(userId, updates);
  }

  // Lesson progress
  async getLessonProgress(userId: string, lessonId: string) {
    const all = await this.db.lessonProgress.getByPlayer(userId);
    return all.find(p => p.lessonId === lessonId);
  }

  async updateLessonProgress(userId: string, lessonId: string, progress: { score?: number; status?: string; xpEarned?: number }) {
    // Check if exists
    const existing = await this.getLessonProgress(userId, lessonId);
    if (existing) {
      return this.db.lessonProgress.update(existing.id, progress);
    }
    return this.db.lessonProgress.create({
      playerId: userId,
      lessonId,
      status: progress.status || 'not_started',
      score: progress.score,
      xpEarned: progress.xpEarned || 0,
      attempts: 1,
    });
  }

  // Learned words
  async getLearnedWords(userId: string) {
    return this.db.learnedWords.getByPlayer(userId);
  }

  async addLearnedWord(userId: string, word: { word: string; translation: string; language: string }) {
    return this.db.learnedWords.create({
      playerId: userId,
      ...word,
      correctCount: 0,
      incorrectCount: 0,
    });
  }
}

export const databaseService = new DatabaseService();
```

- [ ] **Step 2: Create index.ts**

```typescript
// lingua-quest/libs/database/index.ts
export { DatabaseService, databaseService } from './DatabaseService';
```

- [ ] **Step 3: Wire into gameStore (simplified example)**

In `lingua-quest/apps/web/src/stores/gameStore.ts`, replace direct Supabase calls with:
```typescript
import { databaseService } from '@learnquest/database';

// In the store
async loadPlayer(userId: string) {
  const player = await databaseService.getPlayer(userId);
  if (player) {
    this.player = player;
  }
}
```

- [ ] **Step 4: Commit**

```bash
cd lingua-quest
git add libs/database/
git commit -m "feat: add DatabaseService abstraction layer"
```

---

## Task 4: school-quest DatabaseService

**Files:**
- Create: `school-quest/libs/database/DatabaseService.ts`
- Create: `school-quest/libs/database/index.ts`
- Modify: `school-quest/apps/*/src/stores/` (wire in service)

- [ ] **Step 1: Create DatabaseService**

```typescript
// school-quest/libs/database/DatabaseService.ts
import { createDatabase, getDatabaseConfig } from '@learnquest/database';

export class DatabaseService {
  private db;

  constructor() {
    const config = getDatabaseConfig();
    this.db = createDatabase(config);
  }

  // Student profile
  async getStudentProfile(userId: string) {
    return this.db.players.get(userId); // Reusing players as profiles
  }

  async createStudentProfile(profile: { userId: string; displayName?: string; gradeLevel?: string }) {
    return this.db.players.create({
      id: profile.userId,
      userId: profile.userId,
      displayName: profile.displayName,
      xp: 0,
      level: 1,
      languageGroup: 'school',
    });
  }

  // Lesson progress
  async getLessonProgress(userId: string, subject: string, lessonId: string) {
    const all = await this.db.lessonProgress.getByPlayer(userId);
    return all.find(p => p.lessonId === lessonId);
  }

  async updateLessonProgress(userId: string, subject: string, lessonId: string, data: { status?: string; score?: number; xpEarned?: number }) {
    const existing = await this.getLessonProgress(userId, subject, lessonId);
    if (existing) {
      return this.db.lessonProgress.update(existing.id, data);
    }
    return this.db.lessonProgress.create({
      playerId: userId,
      lessonId,
      status: data.status || 'not_started',
      score: data.score,
      xpEarned: data.xpEarned || 0,
      attempts: 1,
    });
  }

  // Achievements
  async getAchievements(userId: string) {
    const all = await this.db.achievements.getAll();
    return all.filter(a => a.id.includes(userId));
  }

  async unlockAchievement(userId: string, achievementId: string, subject?: string) {
    return this.db.achievements.create({
      id: `${userId}-${achievementId}`,
      userId,
      achievementId,
      subject,
      unlockedAt: new Date(),
    });
  }

  // Subscriptions
  async getSubscription(userId: string) {
    // Uses groups as subscription proxy in simplified model
    const all = await this.db.groups.getByMember(userId);
    return all.find(g => g.name === 'subscription');
  }
}

export const databaseService = new DatabaseService();
```

- [ ] **Step 2: Create index.ts**

```typescript
// school-quest/libs/database/index.ts
export { DatabaseService, databaseService } from './DatabaseService';
```

- [ ] **Step 3: Commit**

```bash
cd school-quest
git add libs/database/
git commit -m "feat: add DatabaseService abstraction layer"
```

---

## Task 5: books-platform DatabaseService

**Files:**
- Create: `books-platform/packages/database/DatabaseService.ts`
- Create: `books-platform/packages/database/index.ts`
- Modify: `books-platform/apps/stripe-api/src/` (wire into Stripe API)

- [ ] **Step 1: Create DatabaseService**

```typescript
// books-platform/packages/database/DatabaseService.ts
import { createDatabase, getDatabaseConfig } from '@learnquest/database';

export class DatabaseService {
  private db;

  constructor() {
    const config = getDatabaseConfig();
    this.db = createDatabase(config);
  }

  // Authors
  async getAuthor(userId: string) {
    return this.db.players.get(userId); // Simplified - books uses separate author model
  }

  async createAuthor(author: { userId: string; displayName: string; stripeConnectId?: string }) {
    return this.db.players.create({
      id: author.userId,
      userId: author.userId,
      displayName: author.displayName,
      xp: 0,
      level: 1,
      languageGroup: 'publishing',
    });
  }

  // Books
  async getBooks(authorId?: string) {
    const all = await this.db.challenges.getAll(); // Using challenges as books proxy
    return all.filter(b => !authorId || b.id.includes(authorId));
  }

  async createBook(book: { title: string; authorId: string; type: string }) {
    return this.db.challenges.create({
      id: `book-${Date.now()}`,
      appId: 'books',
      type: book.type,
      difficulty: 'beginner',
      title: book.title,
      xpReward: 0,
      gemReward: 0,
      isActive: true,
    });
  }

  // Purchases
  async getPurchases(userId: string) {
    const all = await this.db.challengeInstances.getByPlayer(userId);
    return all;
  }

  async createPurchase(purchase: { userId: string; bookId: string; amountCents: number }) {
    return this.db.challengeInstances.create({
      id: `purchase-${Date.now()}`,
      challengeId: purchase.bookId,
      playerId: purchase.userId,
      status: 'completed',
      score: purchase.amountCents,
    });
  }

  // Reviews
  async getReviews(bookId: string) {
    const all = await this.db.feedback.getAll();
    return all.filter(f => f.targetType === 'book' && f.targetId === bookId);
  }

  async createReview(review: { userId: string; bookId: string; rating: number; reviewText?: string }) {
    return this.db.feedback.create({
      id: `review-${Date.now()}`,
      userId: review.userId,
      type: 'book_review',
      content: JSON.stringify({ rating: review.rating, text: review.reviewText }),
      metadata: { bookId: review.bookId },
    });
  }
}

export const databaseService = new DatabaseService();
```

- [ ] **Step 2: Create index.ts**

```typescript
// books-platform/packages/database/index.ts
export { DatabaseService, databaseService } from './DatabaseService';
```

- [ ] **Step 3: Commit**

```bash
cd books-platform
git add packages/database/
git commit -m "feat: add DatabaseService abstraction layer"
```

---

## Task 6: Auth Integration with forge-auth

**Files:**
- Create: `lq-core/libs/infra/auth/src/AuthService.ts`
- Create: `lq-core/libs/infra/auth/src/index.ts`
- Modify: `lq-core/apps/web/src/` (wire auth)

- [ ] **Step 1: Create AuthService**

```typescript
// lq-core/libs/infra/auth/src/AuthService.ts
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

export interface User {
  id: string;
  email: string;
  displayName?: string;
}

export class AuthService {
  private config: AuthConfig;

  constructor(config: AuthConfig) {
    this.config = config;
  }

  async getCurrentUser(token: string): Promise<User | null> {
    if (this.config.provider === 'forge') {
      return this.validateWithForge(token);
    }
    return this.validateWithSupabase(token);
  }

  private async validateWithForge(token: string): Promise<User | null> {
    const response = await fetch(`${this.config.forge!.apiUrl}/auth/validate`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-API-Key': this.config.forge!.apiKey,
      },
    });

    if (!response.ok) return null;
    return response.json();
  }

  private async validateWithSupabase(token: string): Promise<User | null> {
    const { data: { user } } = await this.supabase.auth.getUser(token);
    return user ? { id: user.id, email: user.email!, displayName: user.user_metadata?.display_name } : null;
  }

  async refreshToken(token: string): Promise<string | null> {
    if (this.config.provider === 'forge') {
      const response = await fetch(`${this.config.forge!.apiUrl}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-API-Key': this.config.forge!.apiKey,
        },
      });
      const data = await response.json();
      return data.token;
    }
    const { data: { session } } = await this.supabase.auth.refreshSession();
    return session?.access_token || null;
  }

  async signOut(token: string): Promise<void> {
    if (this.config.provider === 'forge') {
      await fetch(`${this.config.forge!.apiUrl}/auth/signout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-API-Key': this.config.forge!.apiKey,
        },
      });
    } else {
      await this.supabase.auth.signOut();
    }
  }
}
```

- [ ] **Step 2: Create index.ts**

```typescript
// lq-core/libs/infra/auth/src/index.ts
export { AuthService } from './AuthService';
export type { AuthConfig, User } from './AuthService';
```

- [ ] **Step 3: Wire into app shell**

In `lq-core/apps/web/src/App.tsx`:
```typescript
import { AuthService } from '@learnquest/auth';

const authService = new AuthService({
  provider: import.meta.env.VITE_AUTH_PROVIDER as 'forge' | 'supabase',
  forge: {
    apiUrl: import.meta.env.VITE_FORGE_API_URL,
    apiKey: import.meta.env.VITE_FORGE_API_KEY,
  },
  supabase: {
    url: import.meta.env.VITE_SUPABASE_URL,
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  },
});
```

- [ ] **Step 4: Commit**

```bash
cd lq-core
git add libs/infra/auth/src/
git commit -m "feat(auth): add AuthService with forge-auth integration"
```

---

## Task 7: Environment Variables Documentation

**Files:**
- Create: `.env.example` files for each app
- Modify: existing `.env.example` files

- [ ] **Step 1: Add to lq-core**

```bash
# lq-core/apps/web/.env.example
VITE_DB_PROVIDER=supabase
VITE_AUTH_PROVIDER=supabase

# Supabase
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_SUPABASE_SERVICE_KEY=

# Postgres (when VITE_DB_PROVIDER=postgres)
VITE_POSTGRES_CONNECTION_STRING=
VITE_POSTGRES_SCHEMA=content

# forge-auth (when VITE_AUTH_PROVIDER=forge)
VITE_FORGE_API_URL=
VITE_FORGE_API_KEY=
```

- [ ] **Step 2: Commit**

```bash
git add lq-core/apps/web/.env.example
git commit -m "docs: add database provider env vars"
```

---

## Task 8: Integration Tests

**Files:**
- Create: `lq-core/libs/infra/database/src/postgres/PostgresAdapter.test.ts`
- Create: `lingua-quest/libs/database/DatabaseService.test.ts`

- [ ] **Step 1: Write PostgresAdapter test**

```typescript
// lq-core/libs/infra/database/src/postgres/PostgresAdapter.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgresAdapter } from './PostgresAdapter';

const TEST_CONFIG = {
  connectionString: process.env.TEST_POSTGRES_URL!,
};

describe('PostgresAdapter', () => {
  let adapter: PostgresAdapter;

  beforeAll(() => {
    adapter = new PostgresAdapter(TEST_CONFIG);
  });

  afterAll(() => {
    adapter.reset();
  });

  it('should get player', async () => {
    const player = await adapter.players.get('test-user');
    expect(player).toBeDefined();
  });

  it('should create lesson progress', async () => {
    const progress = await adapter.lessonProgress.create({
      playerId: 'test-user',
      lessonId: 'lesson-1',
      status: 'completed',
      xpEarned: 100,
      attempts: 1,
    });
    expect(progress).toBeDefined();
  });
});
```

- [ ] **Step 2: Write DatabaseService test**

```typescript
// lingua-quest/libs/database/DatabaseService.test.ts
import { describe, it, expect, vi } from 'vitest';
import { DatabaseService } from './DatabaseService';

vi.mock('@learnquest/database', () => ({
  createDatabase: vi.fn(),
  getDatabaseConfig: vi.fn(() => ({ provider: 'supabase' })),
}));

describe('DatabaseService', () => {
  it('should get player progress', async () => {
    const service = new DatabaseService();
    const progress = await service.getLessonProgress('user-1', 'lesson-1');
    expect(progress).toBeDefined();
  });
});
```

- [ ] **Step 3: Commit**

```bash
git add lq-core/libs/infra/database/src/postgres/PostgresAdapter.test.ts lingua-quest/libs/database/DatabaseService.test.ts
git commit -m "test(database): add integration tests for PostgresAdapter and DatabaseService"
```

---

## Verification Checklist

After each task, verify:
- [ ] Typescript compiles without errors
- [ ] Tests pass
- [ ] No hardcoded values - all via config
- [ ] Migrations work with `.pg.sql` files

---

**Plan complete and saved to `docs/superpowers/plans/2026-04-22-database-abstraction-implementation.md`**

Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
