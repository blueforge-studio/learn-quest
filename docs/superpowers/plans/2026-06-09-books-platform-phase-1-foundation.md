# Books Platform Reader Apps — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the foundation: `apps/books-api` Express server with Drizzle ORM, `packages/books-reader` core primitives, and integrate both into `lq-story-book`.

**Architecture:** Three parallel workstreams — a new Express API server (port 3009) following LinguaQuest's `apps/api` patterns (Drizzle ORM, jose JWT middleware, withJwtSession transactions, constructor-injected repositories), a new shared React package `@learnquest/books-reader` with forge-auth auth, theme, content loading, analytics, and error-tracking primitives, then integration into `lq-story-book` swapping stubs for real implementations.

**Tech Stack:** Express 5, Drizzle ORM + postgres driver, jose (JWT), Zod, better-auth/client + better-auth/react, React 19, TypeScript 5.7, Vite 6, Tailwind CSS 4, Vitest, Turborepo

---

## File Structure (New + Modified)

```
books-platform/
├── apps/
│   ├── books-api/                          # NEW — Express API server
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── drizzle.config.ts
│   │   ├── .env.example
│   │   ├── drizzle/
│   │   │   ├── 0000_initial.sql            # generated + hand-edited
│   │   │   └── 0001_triggers_and_seed.sql  # hand-authored
│   │   └── src/
│   │       ├── index.ts                    # Express entry point
│   │       ├── db/
│   │       │   ├── schema.ts               # All pgTable definitions
│   │       │   ├── index.ts                # drizzle(postgres(url), { schema })
│   │       │   └── withJwtSession.ts       # Transaction + RLS wrapper
│   │       ├── auth/
│   │       │   ├── authMiddleware.ts        # JWT verification via jose
│   │       │   └── verifyJwt.ts            # HS256 verification
│   │       ├── routes/
│   │       │   ├── books.ts                # GET /api/books, GET /api/books/:id
│   │       │   ├── content.ts              # GET /api/content/:bookId/:sceneId
│   │       │   ├── progress.ts             # GET/PUT /api/progress/:userId
│   │       │   └── entitlements.ts         # GET /api/entitlements/:userId
│   │       └── services/
│   │           ├── BookRepository.ts
│   │           ├── ContentRepository.ts
│   │           ├── ProgressRepository.ts
│   │           └── EntitlementRepository.ts
│   │
│   └── lq-story-book/                      # MODIFIED
│       └── src/
│           ├── main.tsx                    # Add providers
│           ├── App.tsx                     # Add ErrorBoundary, analytics
│           ├── hooks/
│           │   ├── useAuth.tsx             # REPLACE — use books-reader instead
│           │   └── useTheme.tsx            # REPLACE — use books-reader instead
│           ├── components/
│           │   ├── SignInModal.tsx         # REMOVE — use books-reader AuthModal
│           │   └── Header.tsx             # Update to use new auth/theme hooks
│           └── screens/
│               ├── HomeScreen.tsx          # Minor: wire analytics
│               └── StoryBookScreen.tsx     # Swap content loading, wire analytics
│
├── packages/
│   └── books-reader/                       # NEW — shared React package
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts                    # Barrel export
│           ├── auth/
│           │   ├── AuthProvider.tsx        # forge-auth context
│           │   ├── AuthModal.tsx           # Login/signup UI
│           │   └── useAuth.ts             # Hook from context
│           ├── theme/
│           │   └── ThemeProvider.tsx       # Dark/light/system
│           ├── content/
│           │   └── BookContentLoader.ts    # Manifest → meta → scenes loading
│           ├── analytics/
│           │   ├── useAnalytics.ts         # Typed analytics hook
│           │   └── events.ts              # Event type definitions
│           └── error-tracking/
│               ├── useErrorTracker.ts      # Error capture hook
│               └── ErrorBoundary.tsx       # React error boundary
│
├── package.json                            # MODIFIED — add books-api dev script
└── turbo.json                              # MODIFIED — add books-api tasks
```

---

### Task 1: Scaffold books-api package

**Files:**
- Create: `apps/books-api/package.json`
- Create: `apps/books-api/tsconfig.json`
- Create: `apps/books-api/drizzle.config.ts`
- Create: `apps/books-api/.env.example`

- [ ] **Step 1: Write package.json**

```json
{
  "name": "@learnquest/books-api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio"
  },
  "dependencies": {
    "@learnquest/books-shared": "workspace:*",
    "cors": "^2.8.5",
    "drizzle-orm": "^0.42.0",
    "express": "^5.1.0",
    "jose": "^6.0.0",
    "postgres": "^3.4.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.0",
    "@types/node": "^22.0.0",
    "drizzle-kit": "^0.31.0",
    "supertest": "^7.0.0",
    "@types/supertest": "^6.0.2",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `cd /Users/kmandrup/Projects/Repos/learn-quest/books-platform && pnpm install`
Expected: dependencies installed, lockfile updated

- [ ] **Step 3: Write tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 4: Write drizzle.config.ts**

```typescript
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
```

- [ ] **Step 5: Write .env.example**

```
DATABASE_URL=postgresql://postgres:forgehosting@localhost:5432/books_platform
AUTH_JWT_SECRET=your-jwt-secret-from-forge-auth
PORT=3009
```

- [ ] **Step 6: Add turborepo dev script alias to root package.json**

Read `/Users/kmandrup/Projects/Repos/learn-quest/books-platform/package.json`, add to the `scripts` section:

```json
"dev:books-api": "turbo dev --filter=@learnquest/books-api"
```

- [ ] **Step 7: Commit**

```bash
git add apps/books-api/package.json apps/books-api/tsconfig.json apps/books-api/drizzle.config.ts apps/books-api/.env.example package.json pnpm-lock.yaml
git commit -m "feat: scaffold books-api Express server package"
```

---

### Task 2: Define Drizzle schema

**Files:**
- Create: `apps/books-api/src/db/schema.ts`

- [ ] **Step 1: Write the full schema**

```typescript
import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  unique,
  primaryKey,
} from 'drizzle-orm/pg-core';

// ── Entitlements ──────────────────────────────────────────

export const userBooks = pgTable('user_books', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  bookId: text('book_id').notNull(),
  purchasedAt: timestamp('purchased_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  uniq: unique('user_book_unique').on(t.userId, t.bookId),
}));

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  status: text('status').notNull().default('active'),
  plan: text('plan').notNull().default('monthly'),
  currentPeriodStart: timestamp('current_period_start', { withTimezone: true }).notNull(),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }).notNull(),
  stripeSubscriptionId: text('stripe_subscription_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ── Reading Progress ──────────────────────────────────────

export const readingProgress = pgTable('reading_progress', {
  userId: text('user_id').notNull(),
  bookId: text('book_id').notNull(),
  sceneId: text('scene_id').notNull(),
  xpEarned: integer('xp_earned').default(0),
  completedAt: timestamp('completed_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.userId, t.bookId, t.sceneId] }),
}));

// ── Type Exports ──────────────────────────────────────────

export type UserBook = typeof userBooks.$inferSelect;
export type NewUserBook = typeof userBooks.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type ReadingProgress = typeof readingProgress.$inferSelect;
export type NewReadingProgress = typeof readingProgress.$inferInsert;
```

- [ ] **Step 2: Typecheck**

Run: `cd /Users/kmandrup/Projects/Repos/learn-quest/books-platform && pnpm --filter @learnquest/books-api typecheck`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/books-api/src/db/schema.ts
git commit -m "feat: define books-api Drizzle schema"
```

---

### Task 3: Initialize DB and generate migration

**Files:**
- Create: `apps/books-api/src/db/index.ts`
- Create: `apps/books-api/drizzle/0000_initial.sql` (generated)

- [ ] **Step 1: Write db/index.ts**

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

const client = postgres(connectionString);
export const db = drizzle(client, { schema });

export type BookDB = typeof db;
```

- [ ] **Step 2: Ensure PostgreSQL is running via forge-control Docker**

Run: `cd /Users/kmandrup/Projects/Repos/forge-control && docker compose -f infrastructure/docker/compose.dev.yml ps`
Expected: postgres service showing "healthy" or "Up"

If not running: `docker compose -f infrastructure/docker/compose.dev.yml up -d postgres`

- [ ] **Step 3: Create the database**

Run:
```bash
cd /Users/kmandrup/Projects/Repos/forge-control
docker compose -f infrastructure/docker/compose.dev.yml exec -T postgres psql -U postgres -c "CREATE DATABASE books_platform;"
```
Expected: `CREATE DATABASE`

- [ ] **Step 4: Create .env with DATABASE_URL**

```bash
echo 'DATABASE_URL=postgresql://postgres:forgehosting@localhost:5432/books_platform' > /Users/kmandrup/Projects/Repos/learn-quest/books-platform/apps/books-api/.env
echo 'AUTH_JWT_SECRET=dev-secret-do-not-use-in-production' >> /Users/kmandrup/Projects/Repos/learn-quest/books-platform/apps/books-api/.env
echo 'PORT=3009' >> /Users/kmandrup/Projects/Repos/learn-quest/books-platform/apps/books-api/.env
```

- [ ] **Step 5: Generate initial migration**

Run: `cd /Users/kmandrup/Projects/Repos/learn-quest/books-platform/apps/books-api && npx drizzle-kit generate`
Expected: creates `drizzle/0000_initial.sql`

- [ ] **Step 6: Push migration to database**

Run: `cd /Users/kmandrup/Projects/Repos/learn-quest/books-platform/apps/books-api && npx drizzle-kit push`
Expected: tables created in books_platform database

- [ ] **Step 7: Verify tables exist**

Run:
```bash
docker compose -f /Users/kmandrup/Projects/Repos/forge-control/infrastructure/docker/compose.dev.yml exec -T postgres psql -U postgres -d books_platform -c "\dt"
```
Expected: lists `user_books`, `subscriptions`, `reading_progress`

- [ ] **Step 8: Commit**

```bash
git add apps/books-api/src/db/index.ts apps/books-api/drizzle/0000_initial.sql apps/books-api/.env
git commit -m "feat: initialize books-api database with Drizzle ORM"
```

---

### Task 4: Implement JWT auth middleware

**Files:**
- Create: `apps/books-api/src/auth/verifyJwt.ts`
- Create: `apps/books-api/src/auth/authMiddleware.ts`

- [ ] **Step 1: Write verifyJwt.ts**

```typescript
import { jwtVerify, type JWTPayload } from 'jose';

export interface JwtClaims extends JWTPayload {
  sub?: string;
  role?: string;
  email?: string;
}

export async function verifyJwt(token: string, secret: string): Promise<JwtClaims> {
  const secretBytes = new TextEncoder().encode(secret);
  const { payload } = await jwtVerify(token, secretBytes, {
    algorithms: ['HS256'],
  });
  return payload as JwtClaims;
}
```

- [ ] **Step 2: Write authMiddleware.ts**

```typescript
import type { RequestHandler } from 'express';
import { verifyJwt, type JwtClaims } from './verifyJwt.js';

declare global {
  namespace Express {
    interface Request {
      user?: JwtClaims;
      rawJwt?: string;
    }
  }
}

interface AuthMiddlewareOptions {
  secret: string;
}

export function authMiddleware(options: AuthMiddlewareOptions): RequestHandler {
  const { secret } = options;

  return async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid Authorization header' });
      return;
    }

    const token = authHeader.slice(7);

    try {
      const claims = await verifyJwt(token, secret);
      req.user = claims;
      req.rawJwt = token;
      next();
    } catch (err) {
      res.status(401).json({
        error: 'Invalid or expired token',
        detail: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  };
}
```

- [ ] **Step 3: Typecheck**

Run: `cd /Users/kmandrup/Projects/Repos/learn-quest/books-platform && pnpm --filter @learnquest/books-api typecheck`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add apps/books-api/src/auth/
git commit -m "feat: implement JWT auth middleware with jose"
```

---

### Task 5: Implement withJwtSession transaction wrapper

**Files:**
- Create: `apps/books-api/src/db/withJwtSession.ts`

- [ ] **Step 1: Write withJwtSession.ts**

```typescript
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { JwtClaims } from '../auth/verifyJwt.js';

type AnyDb = PostgresJsDatabase<any>;

function escapeJsonForSql(json: string): string {
  return json.replace(/'/g, "''");
}

function safeRole(role: string | undefined): string {
  const sanitized = (role || 'authenticated').replace(/[^a-z_][a-z0-9_]*/g, '');
  return sanitized || 'authenticated';
}

export async function withJwtSession<T>(
  db: AnyDb,
  claims: JwtClaims,
  fn: (db: AnyDb) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      `SET LOCAL ROLE ${safeRole(claims.role)}`,
    );
    await tx.execute(
      `SET LOCAL "request.jwt.claims" = '${escapeJsonForSql(JSON.stringify(claims))}'`,
    );
    return fn(tx as AnyDb);
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `cd /Users/kmandrup/Projects/Repos/learn-quest/books-platform && pnpm --filter @learnquest/books-api typecheck`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/books-api/src/db/withJwtSession.ts
git commit -m "feat: implement withJwtSession transaction + RLS wrapper"
```

---

### Task 6: Implement repositories

**Files:**
- Create: `apps/books-api/src/services/BookRepository.ts`
- Create: `apps/books-api/src/services/ContentRepository.ts`
- Create: `apps/books-api/src/services/ProgressRepository.ts`
- Create: `apps/books-api/src/services/EntitlementRepository.ts`

- [ ] **Step 1: Write BookRepository.ts**

```typescript
import type { BookDB } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { userBooks } from '../db/schema.js';

export class BookRepository {
  constructor(private readonly db: BookDB) {}

  async getAvailableBooks(): Promise<{ bookId: string }[]> {
    const rows = await this.db
      .selectDistinct({ bookId: userBooks.bookId })
      .from(userBooks);
    return rows;
  }

  async isBookAvailable(bookId: string): Promise<boolean> {
    const rows = await this.db
      .selectDistinct({ bookId: userBooks.bookId })
      .from(userBooks)
      .where(eq(userBooks.bookId, bookId));
    return rows.length > 0;
  }
}
```

- [ ] **Step 2: Write ContentRepository.ts**

```typescript
import type { BookDB } from '../db/index.js';

export class ContentRepository {
  constructor(private readonly db: BookDB) {}

  async getScene(bookId: string, sceneId: string): Promise<unknown | null> {
    // Phase 1: content is served statically via books-shared ContentService.
    // This repository exists as a forward placeholder for Phase 4 (content pipeline)
    // when content will be stored in PostgreSQL.
    return null;
  }
}
```

- [ ] **Step 3: Write ProgressRepository.ts**

```typescript
import type { BookDB } from '../db/index.js';
import { eq, and } from 'drizzle-orm';
import { readingProgress, type NewReadingProgress } from '../db/schema.js';

export class ProgressRepository {
  constructor(private readonly db: BookDB) {}

  async getProgress(userId: string): Promise<typeof readingProgress.$inferSelect[]> {
    return this.db
      .select()
      .from(readingProgress)
      .where(eq(readingProgress.userId, userId));
  }

  async getBookProgress(userId: string, bookId: string) {
    return this.db
      .select()
      .from(readingProgress)
      .where(
        and(
          eq(readingProgress.userId, userId),
          eq(readingProgress.bookId, bookId),
        ),
      );
  }

  async saveProgress(data: NewReadingProgress) {
    return this.db
      .insert(readingProgress)
      .values(data)
      .onConflictDoUpdate({
        target: [readingProgress.userId, readingProgress.bookId, readingProgress.sceneId],
        set: {
          xpEarned: data.xpEarned ?? 0,
          completedAt: new Date(),
        },
      })
      .returning();
  }
}
```

- [ ] **Step 4: Write EntitlementRepository.ts**

```typescript
import type { BookDB } from '../db/index.js';
import { eq, and, gt } from 'drizzle-orm';
import { userBooks, subscriptions } from '../db/schema.js';

export class EntitlementRepository {
  constructor(private readonly db: BookDB) {}

  async userOwnsBook(userId: string, bookId: string): Promise<boolean> {
    const row = await this.db.query.userBooks.findFirst({
      where: and(
        eq(userBooks.userId, userId),
        eq(userBooks.bookId, bookId),
      ),
    });
    return !!row;
  }

  async hasActiveSubscription(userId: string): Promise<boolean> {
    const now = new Date();
    const row = await this.db.query.subscriptions.findFirst({
      where: and(
        eq(subscriptions.userId, userId),
        eq(subscriptions.status, 'active'),
        gt(subscriptions.currentPeriodEnd, now),
      ),
    });
    return !!row;
  }
}
```

- [ ] **Step 5: Typecheck**

Run: `cd /Users/kmandrup/Projects/Repos/learn-quest/books-platform && pnpm --filter @learnquest/books-api typecheck`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add apps/books-api/src/services/
git commit -m "feat: implement Book, Content, Progress, and Entitlement repositories"
```

---

### Task 7: Implement API route handlers

**Files:**
- Create: `apps/books-api/src/routes/books.ts`
- Create: `apps/books-api/src/routes/content.ts`
- Create: `apps/books-api/src/routes/progress.ts`
- Create: `apps/books-api/src/routes/entitlements.ts`

- [ ] **Step 1: Write books route**

```typescript
import { Router } from 'express';
import type { BookDB } from '../db/index.js';
import { BookRepository } from '../services/BookRepository.js';

export function createBooksRouter(db: BookDB): Router {
  const router = Router();
  const repo = new BookRepository(db);

  router.get('/', async (_req, res) => {
    const books = await repo.getAvailableBooks();
    res.json({ data: books });
  });

  router.get('/:id', async (req, res) => {
    const available = await repo.isBookAvailable(req.params.id);
    if (!available) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }
    res.json({ data: { bookId: req.params.id, available: true } });
  });

  return router;
}
```

- [ ] **Step 2: Write content route**

```typescript
import { Router } from 'express';
import type { BookDB } from '../db/index.js';
import { ContentRepository } from '../services/ContentRepository.js';

export function createContentRouter(db: BookDB): Router {
  const router = Router();
  const repo = new ContentRepository(db);

  router.get('/:bookId/:sceneId', async (req, res) => {
    const scene = await repo.getScene(req.params.bookId, req.params.sceneId);
    if (!scene) {
      res.status(404).json({ error: 'Scene not found' });
      return;
    }
    res.json({ data: scene });
  });

  return router;
}
```

- [ ] **Step 3: Write progress route**

```typescript
import { Router } from 'express';
import type { BookDB } from '../db/index.js';
import { ProgressRepository } from '../services/ProgressRepository.js';
import { authMiddleware } from '../auth/authMiddleware.js';
import { withJwtSession } from '../db/withJwtSession.js';
import { z } from 'zod';

const saveProgressSchema = z.object({
  bookId: z.string(),
  sceneId: z.string(),
  xpEarned: z.number().int().min(0).optional(),
});

export function createProgressRouter(db: BookDB, jwtSecret: string): Router {
  const router = Router();
  router.use(authMiddleware({ secret: jwtSecret }));

  router.get('/', async (req, res) => {
    try {
      const userId = req.user!.sub!;
      const progress = await new ProgressRepository(db).getProgress(userId);
      res.json({ data: progress });
    } catch (err) {
      console.error('[progress.GET]', err);
      res.status(500).json({ error: 'Failed to fetch progress' });
    }
  });

  router.put('/', async (req, res) => {
    try {
      const parsed = saveProgressSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid request body', details: parsed.error.issues });
        return;
      }

      const userId = req.user!.sub!;
      const { bookId, sceneId, xpEarned } = parsed.data;

      await withJwtSession(db, req.user!, async (tx) => {
        const repo = new ProgressRepository(tx as BookDB);
        await repo.saveProgress({ userId, bookId, sceneId, xpEarned: xpEarned ?? 0 });
      });

      res.json({ data: { saved: true } });
    } catch (err) {
      console.error('[progress.PUT]', err);
      res.status(500).json({ error: 'Failed to save progress' });
    }
  });

  return router;
}
```

- [ ] **Step 4: Write entitlements route**

```typescript
import { Router } from 'express';
import type { BookDB } from '../db/index.js';
import { EntitlementRepository } from '../services/EntitlementRepository.js';
import { authMiddleware } from '../auth/authMiddleware.js';

export function createEntitlementsRouter(db: BookDB, jwtSecret: string): Router {
  const router = Router();
  router.use(authMiddleware({ secret: jwtSecret }));

  router.get('/', async (req, res) => {
    try {
      const userId = req.user!.sub!;
      const bookId = req.query.bookId as string | undefined;

      const repo = new EntitlementRepository(db);
      const [hasSub, ownsBook] = await Promise.all([
        repo.hasActiveSubscription(userId),
        bookId ? repo.userOwnsBook(userId, bookId) : Promise.resolve(false),
      ]);

      res.json({
        data: {
          canAccess: hasSub || ownsBook,
          hasSubscription: hasSub,
          ownsBook,
        },
      });
    } catch (err) {
      console.error('[entitlements.GET]', err);
      res.status(500).json({ error: 'Failed to check entitlements' });
    }
  });

  return router;
}
```

- [ ] **Step 5: Typecheck**

Run: `cd /Users/kmandrup/Projects/Repos/learn-quest/books-platform && pnpm --filter @learnquest/books-api typecheck`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add apps/books-api/src/routes/
git commit -m "feat: implement books, content, progress, and entitlements API routes"
```

---

### Task 8: Wire up Express entry point

**Files:**
- Create: `apps/books-api/src/index.ts`

- [ ] **Step 1: Write index.ts**

```typescript
import express from 'express';
import cors from 'cors';
import { db } from './db/index.js';
import { createBooksRouter } from './routes/books.js';
import { createContentRouter } from './routes/content.js';
import { createProgressRouter } from './routes/progress.js';
import { createEntitlementsRouter } from './routes/entitlements.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3009', 10);
const JWT_SECRET = process.env.AUTH_JWT_SECRET;

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Public routes (no auth required)
app.use('/api/books', createBooksRouter(db));
app.use('/api/content', createContentRouter(db));

// Protected routes (auth required)
if (JWT_SECRET) {
  app.use('/api/progress', createProgressRouter(db, JWT_SECRET));
  app.use('/api/entitlements', createEntitlementsRouter(db, JWT_SECRET));
} else {
  console.warn('AUTH_JWT_SECRET not set — protected routes will return 401');
  app.use('/api/progress', (_req, res) => {
    res.status(401).json({ error: 'AUTH_JWT_SECRET not configured' });
  });
  app.use('/api/entitlements', (_req, res) => {
    res.status(401).json({ error: 'AUTH_JWT_SECRET not configured' });
  });
}

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[unhandled]', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`books-api running on http://localhost:${PORT}`);
});

export default app;
```

- [ ] **Step 2: Typecheck**

Run: `cd /Users/kmandrup/Projects/Repos/learn-quest/books-platform && pnpm --filter @learnquest/books-api typecheck`
Expected: no errors

- [ ] **Step 3: Start dev server and verify health check**

Run (in background):
```bash
cd /Users/kmandrup/Projects/Repos/learn-quest/books-platform
DATABASE_URL=postgresql://postgres:forgehosting@localhost:5432/books_platform \
AUTH_JWT_SECRET=dev-secret \
PORT=3009 \
pnpm --filter @learnquest/books-api dev
```

Then: `curl http://localhost:3009/health`
Expected: `{"status":"ok","timestamp":"..."}`

Then: `curl http://localhost:3009/api/books`
Expected: `{"data":[]}`

- [ ] **Step 4: Commit**

```bash
git add apps/books-api/src/index.ts
git commit -m "feat: wire up books-api Express entry point"
```

---

### Task 9: Write API integration tests

**Files:**
- Create: `apps/books-api/src/__tests__/health.test.ts`
- Create: `apps/books-api/src/__tests__/books.test.ts`
- Create: `apps/books-api/src/__tests__/auth.test.ts`
- Create: `apps/books-api/vitest.config.ts`

- [ ] **Step 1: Write vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
});
```

- [ ] **Step 2: Write health.test.ts**

```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../index.js';

describe('GET /health', () => {
  it('returns ok status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });
});
```

- [ ] **Step 3: Write books.test.ts**

```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../index.js';

describe('GET /api/books', () => {
  it('returns empty book list in Phase 1', async () => {
    const res = await request(app).get('/api/books');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: [] });
  });
});

describe('GET /api/books/:id', () => {
  it('returns 404 for unknown book', async () => {
    const res = await request(app).get('/api/books/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Book not found');
  });
});
```

- [ ] **Step 4: Write auth.test.ts**

```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../index.js';

describe('Protected routes without auth', () => {
  it('returns 401 for /api/progress without token', async () => {
    const res = await request(app).get('/api/progress');
    expect(res.status).toBe(401);
  });

  it('returns 401 for /api/entitlements without token', async () => {
    const res = await request(app).get('/api/entitlements');
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 5: Run tests**

Run: `cd /Users/kmandrup/Projects/Repos/learn-quest/books-platform && pnpm --filter @learnquest/books-api test`
Expected: 4 tests pass (health, books list, books 404, auth 401×2)

- [ ] **Step 6: Commit**

```bash
git add apps/books-api/vitest.config.ts apps/books-api/src/__tests__/
git commit -m "test: add books-api integration tests"
```

---

### Task 10: Scaffold books-reader package

**Files:**
- Create: `packages/books-reader/package.json`
- Create: `packages/books-reader/tsconfig.json`
- Create: `packages/books-reader/src/index.ts`

- [ ] **Step 1: Write package.json**

```json
{
  "name": "@learnquest/books-reader",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./auth": "./src/auth/index.ts",
    "./theme": "./src/theme/index.ts",
    "./content": "./src/content/index.ts",
    "./analytics": "./src/analytics/index.ts",
    "./error-tracking": "./src/error-tracking/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "dependencies": {
    "@learnquest/books-shared": "workspace:*",
    "better-auth": "^1.6.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Write tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Write barrel index.ts (placeholder — grows with each task)**

```typescript
// Auth — added in Task 12
// Theme — added in Task 13
// Content — added in Task 14
// Analytics — added in Task 15
// Error tracking — added in Task 16
```

- [ ] **Step 4: Install dependencies**

Run: `cd /Users/kmandrup/Projects/Repos/learn-quest/books-platform && pnpm install`
Expected: dependencies installed

- [ ] **Step 5: Commit**

```bash
git add packages/books-reader/package.json packages/books-reader/tsconfig.json packages/books-reader/src/index.ts pnpm-lock.yaml
git commit -m "feat: scaffold @learnquest/books-reader package"
```

---

### Task 11: Implement AuthProvider and useAuth

**Files:**
- Create: `packages/books-reader/src/auth/AuthProvider.tsx`
- Create: `packages/books-reader/src/auth/useAuth.ts`
- Create: `packages/books-reader/src/auth/index.ts`
- Modify: `packages/books-reader/src/index.ts`

- [ ] **Step 1: Write AuthProvider.tsx**

Port from LinguaQuest's `useForgeAuth.ts` into a React context provider pattern:

```typescript
import React, { createContext, useEffect, useState, useCallback } from 'react';
import { createAuthClient } from 'better-auth/client';
import type { AuthClient } from 'better-auth/client';

interface ForgeAuthUser {
  id: string;
  email?: string;
  name?: string;
  image?: string;
}

interface ForgeAuthSession {
  token: string;
  expiresAt?: string;
}

interface AuthContextValue {
  user: ForgeAuthUser | null;
  session: ForgeAuthSession | null;
  isLoading: boolean;
  isConfigured: boolean;
  signIn: (provider?: string, credentials?: { email: string; password: string }) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const AUTH_URL = import.meta.env.VITE_AUTH_URL;
const IS_CONFIGURED = !!AUTH_URL;

let authClient: ReturnType<typeof createAuthClient> | null = null;

async function getAuthClient(): Promise<ReturnType<typeof createAuthClient>> {
  if (!authClient && IS_CONFIGURED) {
    authClient = createAuthClient({
      baseURL: AUTH_URL,
    });
  }
  return authClient!;
}

async function getClientSession() {
  if (!IS_CONFIGURED) return null;
  const client = await getAuthClient();
  try {
    const { data } = await client.getSession();
    return data ?? null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ForgeAuthUser | null>(null);
  const [session, setSession] = useState<ForgeAuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getClientSession().then((s) => {
      if (s) {
        setSession(s as unknown as ForgeAuthSession);
        setUser((s as unknown as { user: ForgeAuthUser }).user ?? null);
      }
      setIsLoading(false);
    });
  }, []);

  const signIn = useCallback(async (provider?: string, credentials?: { email: string; password: string }) => {
    if (!IS_CONFIGURED) return;
    const client = await getAuthClient();

    if (provider === 'google') {
      await client.signIn.social({ provider: 'google' });
    } else if (credentials) {
      await client.signIn.email({
        email: credentials.email,
        password: credentials.password,
      });
    }

    const s = await getClientSession();
    if (s) {
      setSession(s as unknown as ForgeAuthSession);
      setUser((s as unknown as { user: ForgeAuthUser }).user ?? null);
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, name?: string) => {
    if (!IS_CONFIGURED) return;
    const client = await getAuthClient();
    await client.signUp.email({ email, password, name: name ?? email.split('@')[0] });

    const s = await getClientSession();
    if (s) {
      setSession(s as unknown as ForgeAuthSession);
      setUser((s as unknown as { user: ForgeAuthUser }).user ?? null);
    }
  }, []);

  const signOut = useCallback(async () => {
    if (!IS_CONFIGURED) {
      setUser(null);
      setSession(null);
      return;
    }
    const client = await getAuthClient();
    await client.signOut();
    setUser(null);
    setSession(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, isLoading, isConfigured: IS_CONFIGURED, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
```

- [ ] **Step 2: Write useAuth.ts**

```typescript
import { useContext } from 'react';
import { AuthContext } from './AuthProvider.js';

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
```

- [ ] **Step 3: Write auth/index.ts**

```typescript
export { AuthProvider } from './AuthProvider.js';
export { useAuth } from './useAuth.js';
```

- [ ] **Step 4: Update barrel index.ts**

```typescript
export { AuthProvider, useAuth } from './auth/index.js';
```

- [ ] **Step 5: Typecheck**

Run: `cd /Users/kmandrup/Projects/Repos/learn-quest/books-platform && pnpm --filter @learnquest/books-reader typecheck`
Expected: no errors (may require installing better-auth types — if so, `pnpm install` again)

- [ ] **Step 6: Commit**

```bash
git add packages/books-reader/src/auth/ packages/books-reader/src/index.ts
git commit -m "feat: implement AuthProvider with forge-auth (better-auth/client)"
```

---

### Task 12: Implement AuthModal

**Files:**
- Create: `packages/books-reader/src/auth/AuthModal.tsx`
- Modify: `packages/books-reader/src/auth/index.ts`

- [ ] **Step 1: Write AuthModal.tsx**

Port from LinguaQuest's `AuthModal.tsx`, adapted for Tailwind CSS (the original uses CSS custom properties):

```typescript
import React, { useState } from 'react';
import { createAuthClient } from 'better-auth/client';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuth: () => void;
}

type Mode = 'login' | 'signup';

export function AuthModal({ isOpen, onClose, onAuth }: AuthModalProps) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const authUrl = import.meta.env.VITE_AUTH_URL;
  const authClient = authUrl ? createAuthClient({ baseURL: authUrl }) : null;

  const handleGoogleSignIn = async () => {
    if (!authClient) return;
    setError(null);
    try {
      await authClient.signIn.social({ provider: 'google' });
      onAuth();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Google sign-in failed');
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authClient) return;
    setError(null);
    setIsSubmitting(true);
    try {
      if (mode === 'signup') {
        await authClient.signUp.email({ email, password, name: name || email.split('@')[0] });
      } else {
        await authClient.signIn.email({ email, password });
      }
      onAuth();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Authentication failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8 w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          {mode === 'login' ? 'Sign In' : 'Create Account'}
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Google OAuth */}
        <button
          onClick={handleGoogleSignIn}
          className="w-full mb-4 py-3 px-4 border border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-200 font-medium"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        <div className="relative mb-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300 dark:border-gray-600" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white dark:bg-gray-800 text-gray-500">or</span>
          </div>
        </div>

        {/* Email/Password Form */}
        <form onSubmit={handleEmailAuth} className="space-y-4">
          {mode === 'signup' && (
            <input
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
            />
          )}
          <input
            type="email"
            placeholder="Email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
          />
          <input
            type="password"
            placeholder="Password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors"
          >
            {isSubmitting ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
          {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); }}
            className="text-amber-600 dark:text-amber-400 hover:underline font-medium"
          >
            {mode === 'login' ? 'Sign Up' : 'Sign In'}
          </button>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update auth/index.ts**

```typescript
export { AuthProvider } from './AuthProvider.js';
export { useAuth } from './useAuth.js';
export { AuthModal } from './AuthModal.js';
```

- [ ] **Step 3: Update barrel index.ts**

```typescript
export { AuthProvider, useAuth, AuthModal } from './auth/index.js';
```

- [ ] **Step 4: Typecheck**

Run: `cd /Users/kmandrup/Projects/Repos/learn-quest/books-platform && pnpm --filter @learnquest/books-reader typecheck`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add packages/books-reader/src/auth/AuthModal.tsx packages/books-reader/src/auth/index.ts packages/books-reader/src/index.ts
git commit -m "feat: implement AuthModal with Google OAuth and email/password"
```

---

### Task 13: Implement ThemeProvider

**Files:**
- Create: `packages/books-reader/src/theme/ThemeProvider.tsx`
- Create: `packages/books-reader/src/theme/index.ts`
- Modify: `packages/books-reader/src/index.ts`

- [ ] **Step 1: Write ThemeProvider.tsx**

Port from story-book's existing `useTheme.tsx` (already production-quality):

```typescript
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

type Theme = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  resolved: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'lq-books-theme';

function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {}
  return 'system';
}

function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme;
}

function applyTheme(resolved: ResolvedTheme) {
  document.documentElement.classList.toggle('dark', resolved === 'dark');
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme);
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolveTheme(theme));

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try { localStorage.setItem(STORAGE_KEY, t); } catch {}
  }, []);

  const toggle = useCallback(() => {
    setThemeState((prev) => {
      const resolvedPrev = resolveTheme(prev);
      const next: Theme = resolvedPrev === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(STORAGE_KEY, next); } catch {}
      return next;
    });
  }, []);

  useEffect(() => {
    const resolvedTheme = resolveTheme(theme);
    setResolved(resolvedTheme);
    applyTheme(resolvedTheme);
  }, [theme]);

  // Listen for system theme changes when in 'system' mode
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const r = resolveTheme('system');
      setResolved(r);
      applyTheme(r);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
```

- [ ] **Step 2: Write theme/index.ts**

```typescript
export { ThemeProvider, useTheme } from './ThemeProvider.js';
```

- [ ] **Step 3: Update barrel index.ts**

```typescript
export { AuthProvider, useAuth, AuthModal } from './auth/index.js';
export { ThemeProvider, useTheme } from './theme/index.js';
```

- [ ] **Step 4: Typecheck**

Run: `cd /Users/kmandrup/Projects/Repos/learn-quest/books-platform && pnpm --filter @learnquest/books-reader typecheck`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add packages/books-reader/src/theme/ packages/books-reader/src/index.ts
git commit -m "feat: implement ThemeProvider with dark/light/system toggle"
```

---

### Task 14: Implement BookContentLoader hook

**Files:**
- Create: `packages/books-reader/src/content/BookContentLoader.ts`
- Create: `packages/books-reader/src/content/index.ts`
- Modify: `packages/books-reader/src/index.ts`

- [ ] **Step 1: Write BookContentLoader.ts**

Extract the loading pattern from story-book's `StoryBookScreen.tsx`:

```typescript
import { useState, useEffect, useRef } from 'react';
import { ContentService } from '@learnquest/books-shared/utils';
import type { ManifestBook, BookMeta, StoryScene } from '@learnquest/books-shared/types';

interface BookContentState {
  manifest: ManifestBook[] | null;
  bookMeta: BookMeta | null;
  scenes: Map<string, StoryScene>;
  loading: boolean;
  error: string | null;
}

export function useBookContentLoader(bookType: string = 'story') {
  const [state, setState] = useState<BookContentState>({
    manifest: null,
    bookMeta: null,
    scenes: new Map(),
    loading: true,
    error: null,
  });
  const contentService = useRef(new ContentService());

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const manifest = await contentService.current.loadManifest(bookType);
        if (cancelled) return;
        setState((prev) => ({ ...prev, manifest, loading: false }));
      } catch (err) {
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to load books',
          }));
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [bookType]);

  const loadBookMeta = async (bookId: string): Promise<BookMeta | null> => {
    try {
      const bookMeta = await contentService.current.loadBookMeta(bookType, bookId);
      setState((prev) => ({ ...prev, bookMeta }));
      return bookMeta;
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to load book',
      }));
      return null;
    }
  };

  const loadScene = async (bookId: string, sceneId: string): Promise<StoryScene | null> => {
    try {
      const scene = await contentService.current.loadScene(bookType, bookId, sceneId);
      setState((prev) => {
        const next = new Map(prev.scenes);
        next.set(sceneId, scene);
        return { ...prev, scenes: next };
      });
      return scene;
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to load scene',
      }));
      return null;
    }
  };

  return {
    ...state,
    loadBookMeta,
    loadScene,
  };
}
```

- [ ] **Step 2: Write content/index.ts**

```typescript
export { useBookContentLoader } from './BookContentLoader.js';
```

- [ ] **Step 3: Update barrel index.ts**

```typescript
export { AuthProvider, useAuth, AuthModal } from './auth/index.js';
export { ThemeProvider, useTheme } from './theme/index.js';
export { useBookContentLoader } from './content/index.js';
```

- [ ] **Step 4: Typecheck**

Run: `cd /Users/kmandrup/Projects/Repos/learn-quest/books-platform && pnpm --filter @learnquest/books-reader typecheck`
Expected: no errors (may need to verify ContentService exports from books-shared match — check `@learnquest/books-shared/utils` and `@learnquest/books-shared/types` paths exist)

- [ ] **Step 5: Commit**

```bash
git add packages/books-reader/src/content/ packages/books-reader/src/index.ts
git commit -m "feat: implement BookContentLoader hook"
```

---

### Task 15: Implement analytics and error-tracking hooks

**Files:**
- Create: `packages/books-reader/src/analytics/events.ts`
- Create: `packages/books-reader/src/analytics/useAnalytics.ts`
- Create: `packages/books-reader/src/analytics/index.ts`
- Create: `packages/books-reader/src/error-tracking/useErrorTracker.ts`
- Create: `packages/books-reader/src/error-tracking/ErrorBoundary.tsx`
- Create: `packages/books-reader/src/error-tracking/index.ts`
- Modify: `packages/books-reader/src/index.ts`

- [ ] **Step 1: Write events.ts**

```typescript
export type AnalyticsEventName =
  | 'app.launched'
  | 'auth.signed_in'
  | 'auth.signed_up'
  | 'catalogue.browsed'
  | 'book.opened'
  | 'book.started'
  | 'scene.viewed'
  | 'scene.completed'
  | 'choice.selected'
  | 'quiz.answered'
  | 'vocab.looked_up'
  | 'vocab.pronounced'
  | 'readaloud.started'
  | 'readaloud.paused'
  | 'page.turned'
  | 'book.completed'
  | 'paywall.hit'
  | 'purchase.started'
  | 'purchase.completed'
  | 'machine.transition'
  | 'decision_map.viewed';

export interface AnalyticsEvent {
  name: AnalyticsEventName;
  properties?: Record<string, unknown>;
}

export interface AnalyticsService {
  track(event: AnalyticsEvent): void;
  trackBatch(events: AnalyticsEvent[]): void;
  identify(distinctId: string, properties?: Record<string, unknown>): void;
}
```

- [ ] **Step 2: Write useAnalytics.ts**

```typescript
import { useCallback } from 'react';
import type { AnalyticsEventName } from './events.js';

export function useAnalytics() {
  const track = useCallback((name: AnalyticsEventName, properties?: Record<string, unknown>) => {
    if (import.meta.env.DEV) {
      console.log('[analytics]', name, properties);
      return;
    }
    // Phase 1: console adapter. Phase 5: service-factory self-hosted endpoint.
    // TODO: wire to service-factory createAnalyticsService() when endpoint is available
  }, []);

  const identify = useCallback((distinctId: string, properties?: Record<string, unknown>) => {
    if (import.meta.env.DEV) {
      console.log('[analytics] identify', distinctId, properties);
    }
  }, []);

  return { track, identify };
}
```

- [ ] **Step 3: Write analytics/index.ts**

```typescript
export { useAnalytics } from './useAnalytics.js';
export type { AnalyticsEventName, AnalyticsEvent, AnalyticsService } from './events.js';
```

- [ ] **Step 4: Write useErrorTracker.ts**

```typescript
import { useCallback } from 'react';
import { useAuth } from '../auth/useAuth.js';

export function useErrorTracker() {
  const { user } = useAuth();

  const captureException = useCallback((error: Error, context?: Record<string, unknown>) => {
    console.error('[error-tracker]', error.message, {
      userId: user?.id,
      ...context,
      stack: error.stack,
    });
    // Phase 1: console adapter. Phase 5: service-factory createErrorTracker() with self-hosted endpoint.
  }, [user?.id]);

  const captureMessage = useCallback((message: string, level: 'info' | 'warning' | 'error' = 'error') => {
    const method = level === 'error' ? console.error : level === 'warning' ? console.warn : console.log;
    method('[error-tracker]', message, { userId: user?.id });
  }, [user?.id]);

  return { captureException, captureMessage };
}
```

- [ ] **Step 5: Write ErrorBoundary.tsx**

```typescript
import React, { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-8">
          <div className="text-center max-w-md">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Something went wrong</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
              className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
```

- [ ] **Step 6: Write error-tracking/index.ts**

```typescript
export { useErrorTracker } from './useErrorTracker.js';
export { ErrorBoundary } from './ErrorBoundary.js';
```

- [ ] **Step 7: Update barrel index.ts**

```typescript
export { AuthProvider, useAuth, AuthModal } from './auth/index.js';
export { ThemeProvider, useTheme } from './theme/index.js';
export { useBookContentLoader } from './content/index.js';
export { useAnalytics } from './analytics/index.js';
export type { AnalyticsEventName, AnalyticsEvent } from './analytics/index.js';
export { useErrorTracker, ErrorBoundary } from './error-tracking/index.js';
```

- [ ] **Step 8: Typecheck**

Run: `cd /Users/kmandrup/Projects/Repos/learn-quest/books-platform && pnpm --filter @learnquest/books-reader typecheck`
Expected: no errors

- [ ] **Step 9: Commit**

```bash
git add packages/books-reader/src/analytics/ packages/books-reader/src/error-tracking/ packages/books-reader/src/index.ts
git commit -m "feat: implement analytics and error-tracking hooks + ErrorBoundary"
```

---

### Task 16: Wire books-reader into lq-story-book — Auth

**Files:**
- Modify: `apps/lq-story-book/src/main.tsx`
- Modify: `apps/lq-story-book/src/App.tsx`
- Delete: `apps/lq-story-book/src/hooks/useAuth.tsx`
- Delete: `apps/lq-story-book/src/components/SignInModal.tsx`

- [ ] **Step 1: Read current main.tsx**

Read `/Users/kmandrup/Projects/Repos/learn-quest/books-platform/apps/lq-story-book/src/main.tsx` to understand current provider structure.

- [ ] **Step 2: Update main.tsx to add AuthProvider and ThemeProvider from books-reader**

Wrap the app with `AuthProvider` and `ThemeProvider` from `@learnquest/books-reader`:

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@learnquest/books-reader';
import { ThemeProvider } from '@learnquest/books-reader';
import App from './App.js';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
```

- [ ] **Step 3: Update App.tsx to use books-reader auth and theme hooks**

Replace imports from `./hooks/useAuth` → `@learnquest/books-reader` and `./hooks/useTheme` → `@learnquest/books-reader`:

```typescript
import { useAuth, AuthModal } from '@learnquest/books-reader';
import { useTheme } from '@learnquest/books-reader';
import { ErrorBoundary, useErrorTracker } from '@learnquest/books-reader';
```

Update the `Header` component to use `useAuth()` from books-reader (same interface: `user`, `signIn`, `signOut`, `isLoading`).

Wire `AuthModal` in place of the old `SignInModal`:

```typescript
<AuthModal
  isOpen={showAuthModal}
  onClose={() => setShowAuthModal(false)}
  onAuth={() => {
    setShowAuthModal(false);
  }}
/>
```

- [ ] **Step 4: Delete stub auth files**

```bash
rm apps/lq-story-book/src/hooks/useAuth.tsx
rm apps/lq-story-book/src/components/SignInModal.tsx
```

- [ ] **Step 5: Typecheck**

Run: `cd /Users/kmandrup/Projects/Repos/learn-quest/books-platform && pnpm --filter @learnquest/story-book typecheck`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add apps/lq-story-book/src/main.tsx apps/lq-story-book/src/App.tsx apps/lq-story-book/src/components/Header.tsx
git rm apps/lq-story-book/src/hooks/useAuth.tsx apps/lq-story-book/src/components/SignInModal.tsx
git commit -m "refactor(story-book): swap stub auth for books-reader AuthProvider + AuthModal"
```

---

### Task 17: Wire books-reader into lq-story-book — Content, Analytics, Error Tracking

**Files:**
- Modify: `apps/lq-story-book/src/screens/HomeScreen.tsx`
- Modify: `apps/lq-story-book/src/screens/StoryBookScreen.tsx`

- [ ] **Step 1: Update HomeScreen.tsx to wire analytics**

Add `useAnalytics` call on mount to track `catalogue.browsed`:

```typescript
import { useAnalytics } from '@learnquest/books-reader';

// Inside the component:
const { track } = useAnalytics();

useEffect(() => {
  track('catalogue.browsed', { bookCount: manifest?.length ?? 0 });
}, [manifest, track]);
```

- [ ] **Step 2: Update StoryBookScreen.tsx to use BookContentLoader and wire analytics**

Replace the manual `ContentService` instantiation with `useBookContentLoader`:

```typescript
import { useBookContentLoader } from '@learnquest/books-reader';
import { useAnalytics } from '@learnquest/books-reader';

// Inside the component:
const { manifest, bookMeta, loading, error, loadBookMeta, loadScene } = useBookContentLoader('story');
const { track } = useAnalytics();

// Track scene viewed:
useEffect(() => {
  if (scene) {
    track('scene.viewed', { bookId, sceneId: scene.id, sceneType: scene.type });
  }
}, [scene, bookId, track]);

// Track book.opened when BookIntro is shown:
const handleBeginReading = () => {
  track('book.opened', { bookId, title: bookMeta?.title });
  setShowIntro(false);
  loadFirstScene();
};
```

- [ ] **Step 3: Typecheck**

Run: `cd /Users/kmandrup/Projects/Repos/learn-quest/books-platform && pnpm --filter @learnquest/story-book typecheck`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add apps/lq-story-book/src/screens/HomeScreen.tsx apps/lq-story-book/src/screens/StoryBookScreen.tsx
git commit -m "refactor(story-book): wire BookContentLoader and analytics hooks"
```

---

### Task 18: Final integration — ErrorBoundary and theme swap

**Files:**
- Modify: `apps/lq-story-book/src/App.tsx`
- Delete: `apps/lq-story-book/src/hooks/useTheme.tsx`
- Delete: `apps/lq-story-book/src/components/ThemeToggle.tsx` (if it only wraps useTheme)

- [ ] **Step 1: Wrap App content with ErrorBoundary in App.tsx**

```typescript
import { ErrorBoundary, useErrorTracker } from '@learnquest/books-reader';

function AppContent() {
  // existing app content (routes, header, etc.)
}

export default function App() {
  const { captureException } = useErrorTracker();

  return (
    <ErrorBoundary onError={(error) => captureException(error, { source: 'App' })}>
      <AppContent />
    </ErrorBoundary>
  );
}
```

- [ ] **Step 2: Remove old theme files**

Only if `ThemeToggle.tsx` is a standalone component that only wraps `useTheme` — check the file first.

Read `apps/lq-story-book/src/components/ThemeToggle.tsx` to verify. If it only re-exports the hook from `useTheme`, remove it and update `Header.tsx` to use `useTheme` directly from `@learnquest/books-reader`.

```bash
rm apps/lq-story-book/src/hooks/useTheme.tsx
```

- [ ] **Step 3: Verify Header.tsx uses useTheme from books-reader**

Ensure `Header.tsx` imports: `import { useTheme } from '@learnquest/books-reader';`

- [ ] **Step 4: Full typecheck + build**

Run: `cd /Users/kmandrup/Projects/Repos/learn-quest/books-platform && pnpm --filter @learnquest/story-book typecheck`
Expected: no errors

Run: `cd /Users/kmandrup/Projects/Repos/learn-quest/books-platform && pnpm --filter @learnquest/story-book build`
Expected: successful build

- [ ] **Step 5: Commit**

```bash
git add apps/lq-story-book/
git rm apps/lq-story-book/src/hooks/useTheme.tsx
git commit -m "refactor(story-book): add ErrorBoundary, replace useTheme with books-reader"
```

---

### Task 19: End-to-end verification

- [ ] **Step 1: Start all services**

Terminal 1 — forge-control PostgreSQL:
```bash
cd /Users/kmandrup/Projects/Repos/forge-control
docker compose -f infrastructure/docker/compose.dev.yml up -d postgres
```

Terminal 2 — books-api:
```bash
cd /Users/kmandrup/Projects/Repos/learn-quest/books-platform/apps/books-api
pnpm dev
```
Expected: `books-api running on http://localhost:3009`

Terminal 3 — story-book:
```bash
cd /Users/kmandrup/Projects/Repos/learn-quest/books-platform
pnpm --filter @learnquest/story-book dev
```
Expected: Vite dev server on http://localhost:3302

- [ ] **Step 2: Smoke test — books-api health**

Run: `curl http://localhost:3009/health`
Expected: `{"status":"ok","timestamp":"..."}`

- [ ] **Step 3: Smoke test — books-api books endpoint**

Run: `curl http://localhost:3009/api/books`
Expected: `{"data":[]}`

- [ ] **Step 4: Smoke test — story-book loads in browser**

Open `http://localhost:3302` in a browser.
Expected:
- Landing page shows HeroBanner + BookCatalogue with 3 books
- Dark/light theme toggle works
- Auth modal opens (click sign-in button)
- Auth modal shows Google + email/password options

- [ ] **Step 5: Read a book flow**

Click a book → BookIntro shows → Click "Begin Reading" → StorySceneLayout with page-turner shows → vocabulary hotspots work → quiz works → ending screen shows

- [ ] **Step 6: Run existing tests**

Run: `cd /Users/kmandrup/Projects/Repos/learn-quest/books-platform && pnpm --filter @learnquest/books-api test`
Expected: all tests pass

Run: `cd /Users/kmandrup/Projects/Repos/learn-quest/books-platform && pnpm --filter @learnquest/story-book test`
Expected: existing tests pass (no regressions)

- [ ] **Step 7: Commit final verification**

```bash
git add -A
git commit -m "chore: Phase 1 verification — all services running, smoke tests pass"
```
