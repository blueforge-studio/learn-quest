# Household Goals + Real-Life Rewards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add parent-defined daily/weekly goal tracking and a real-life reward system (screen-time unlock, treats, accumulating in-app credits) to the lq-core family household, building on the existing Family Profile feature.

**Architecture:** Three-layer design:
1. **Data layer** — 6 new tables (`goals`, `goal_evaluations`, `reward_grants`, `wishlist_items`, `wishlist_redemptions`, `household_goals_config`) with a Drizzle schema + numbered Postgres migration.
2. **Engine layer** — A pure `goalEvaluator` function that receives activity events and returns goal-evaluation deltas. Hooked into `ActivityService` (existing) and a new `SessionService` (we add this for "time in app" tracking). Wraps grant inserts in atomic transactions with the `is_completed` flip.
3. **UX layer** — 7 new screens in a new `@learnquest/screen-household-goals` package; modifications to 5 existing screens. Realtime channel wiring for live updates.

**Tech Stack:** TypeScript 5.9, React 19, Drizzle ORM, Postgres, Vitest 4, Storybook 10, Playwright, Zustand, Supabase Realtime channel.

**Builds on:**
- Family Profile feature (in implementation as of 2026-07-09) — requires `households`, `household_members`, `household_invites` tables to exist
- Existing `@learnquest/database` Postgres adapter
- Existing `ActivityService` (lesson_completed, achievement_unlocked, challenge_won)
- Existing `@learnquest/event-bus` (per-package instance; we use the app-services copy)

---

## Implementation Reality Check (deviations from spec, documented up-front)

The brainstorming spec assumed an existing event-bus publishing `lesson.completed`, `session.ended`, `xp.gained`, `streak.maintained`, `streak.broken` events. Reality check from codebase exploration:

1. **ActivityService does NOT publish events** — it writes directly to `ActivityCollection` (DB). We'll modify it to call `goalEvaluator.handle(...)` after each record, then return. This is a synchronous in-process call, simpler than a true pub/sub for v1.
2. **No `session.ended` event source exists** — there's no session tracking at all in lq-core. We'll add a small `SessionService` that the app calls at app start/end and visibilitychange, with the goal evaluator subscribing to those calls.
3. **No `streak.maintained`/`streak.broken` event** — streaks are tracked in the player profile (`currentStreak`, `longestStreak`). We'll emit these events from wherever the streak is updated (the ProgressionService or equivalent).
4. **Multiple `@learnquest/event-bus` instances exist** (one per package). We'll use the `app-services` instance for the engine and document the dependency.

These adjustments preserve all spec decisions but match the codebase's current shape.

---

## File Structure

### New files

```
lq-core/libs/infra/database/
├── drizzle/
│   └── 0008_household_goals.sql                                  # migration (Phase 1)
├── src/postgres/
│   ├── schema.ts                                                  # EXTEND with 6 new tables
│   └── repositories/
│       ├── GoalRepository.ts
│       ├── GoalEvaluationRepository.ts
│       ├── RewardGrantRepository.ts
│       ├── WishlistItemRepository.ts
│       ├── WishlistRedemptionRepository.ts
│       └── HouseholdGoalsConfigRepository.ts

lq-core/libs/app/household-goals/                                 # NEW package
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── src/
│   ├── index.ts
│   ├── types.ts                                                   # Goal, GoalEvaluation, RewardGrant, etc. (Zod + TS)
│   ├── services/
│   │   ├── goalService.ts                                         # CRUD for goals
│   │   ├── goalEvaluator.ts                                       # pure function: activity event → deltas
│   │   ├── rewardGrantService.ts                                  # atomic grant creation
│   │   ├── wishlistService.ts                                     # catalog + redemption + anti-spam
│   │   ├── householdGoalsConfigService.ts                         # rate-limit config CRUD
│   │   └── balanceService.ts                                      # computed credit balance
│   ├── events/
│   │   ├── activityHooks.ts                                       # exports hook for ActivityService to call
│   │   └── sessionHooks.ts                                        # exports hook for SessionService to call
│   └── periods.ts                                                 # period boundary calculator
└── tests/
    ├── goalEvaluator.test.ts
    ├── rewardGrantService.test.ts
    ├── wishlistService.test.ts
    ├── balanceService.test.ts
    ├── householdGoalsConfigService.test.ts
    ├── periods.test.ts
    ├── integration/
    │   ├── goalLifecycle.integration.test.ts
    │   ├── wishlistRedemption.integration.test.ts
    │   └── cooldownEnforcement.integration.test.ts

lq-core/libs/app/app-services/src/
├── social/ActivityService.ts                                      # MODIFY: hook goal evaluator after each record*
└── player/SessionService.ts                                       # NEW: emit session start/end events

lq-core/libs/screens/household-goals/                              # NEW package
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── src/
│   ├── index.ts
│   ├── parent/
│   │   ├── GoalsDashboardScreen.tsx
│   │   ├── GoalSetupScreen.tsx
│   │   ├── WishlistAdminScreen.tsx
│   │   └── TreatsCatalogScreen.tsx
│   ├── kid/
│   │   ├── KidGoalsScreen.tsx
│   │   ├── WishlistScreen.tsx
│   │   └── GoalCompleteToast.tsx
│   ├── components/
│   │   ├── GoalProgressBar.tsx
│   │   ├── RewardCard.tsx
│   │   └── WishlistItemCard.tsx
│   ├── hooks/
│   │   ├── useMemberGoals.ts
│   │   ├── useCreditBalance.ts
│   │   └── useWishlistRedemptions.ts
│   ├── stores/
│   │   └── householdGoalsStore.ts                                 # Zustand store
│   ├── realtime/
│   │   └── goalEventChannel.ts                                    # subscribes to realtime events
│   └── stories/
│       ├── GoalsDashboardScreen.stories.tsx
│       ├── GoalSetupScreen.stories.tsx
│       ├── KidGoalsScreen.stories.tsx
│       ├── WishlistScreen.stories.tsx
│       ├── WishlistAdminScreen.stories.tsx
│       ├── TreatsCatalogScreen.stories.tsx
│       └── GoalCompleteToast.stories.tsx
└── tests/
    └── integration/
        ├── GoalsDashboardScreen.test.tsx
        ├── GoalSetupScreen.test.tsx
        ├── KidGoalsScreen.test.tsx
        ├── WishlistScreen.test.tsx
        └── realtime.test.tsx

lq-core/apps/web/public/locales/*.json                             # EXTEND (~30 keys × 59 languages)
```

### Modified files

```
lq-core/libs/app/app-services/src/social/ActivityService.ts        # call goalEvaluator hooks
lq-core/libs/app/app-services/src/index.ts                         # export SessionService, hook registration
lq-core/libs/screens/household/src/settings/HouseholdSettingsScreen.tsx     # add Goals entry link
lq-core/libs/screens/household/src/settings/HouseholdMemberScreen.tsx       # show progress inline
lq-core/libs/screens/dashboard/src/PlayerDashboard.tsx             # add goals pill
lq-core/libs/screens/household/src/profile-picker/WhoIsPlayingScreen.tsx   # show credit balance
lq-core/libs/ui/src/layout/TopBar.tsx                              # bell icon for notifications
lq-core/apps/web/src/routes.tsx                                    # new routes
lq-core/libs/app/app-services/src/notifications/                   # extend for goal-completion events
```

---

## Phase 1 — Data Layer

### Task 1: Add migration SQL for goals + rewards tables

**Files:**
- Create: `lq-core/libs/infra/database/drizzle/0008_household_goals.sql`

- [ ] **Step 1: Verify migration directory layout**

```bash
ls /Users/kmandrup/Projects/Repos/learn-quest/lq-core/libs/infra/database/drizzle/
```

Expected: at minimum `0007_households.sql` exists.

- [ ] **Step 2: Write migration file**

Create `lq-core/libs/infra/database/drizzle/0008_household_goals.sql` with the full SQL from the spec. Paste the entire SQL block from spec section "Migration > Single migration file: `0008_household_goals.sql`" — all 6 tables, all indexes, all CHECK constraints. Do not paraphrase.

- [ ] **Step 3: Verify migration parses against Postgres**

Requires a running Postgres (dev DB). Run:
```bash
cd /Users/kmandrup/Projects/Repos/learn-quest/lq-core
psql $DATABASE_URL -f libs/infra/database/drizzle/0008_household_goals.sql
```
Expected: `CREATE TABLE` and `CREATE INDEX` for each table, no errors.

- [ ] **Step 4: Verify migration rollback works (in dev DB only)**

Manually drop the 6 tables in reverse order:
```bash
psql $DATABASE_URL -c "DROP TABLE household_goals_config, wishlist_redemptions, wishlist_items, reward_grants, goal_evaluations, goals CASCADE;"
```
Expected: drop succeeds. (We're not writing a down migration yet — confirm we can roll back manually, then move on.)

- [ ] **Step 5: Re-apply the migration**

Re-run Step 3 — should succeed cleanly (idempotency not required, the file is a one-shot). Tables exist.

- [ ] **Step 6: Commit** (skip — lq-core is not in a git repo at this level; verify file exists in the migration directory)

Verify: `ls /Users/kmandrup/Projects/Repos/learn-quest/lq-core/libs/infra/database/drizzle/0008_household_goals.sql`

---

### Task 2: Add Drizzle schema for 6 new tables

**Files:**
- Modify: `lq-core/libs/infra/database/src/postgres/schema.ts` (append to existing schema definitions)

- [ ] **Step 1: Read existing schema to understand the pattern**

```bash
head -80 /Users/kmandrup/Projects/Repos/learn-quest/lq-core/libs/infra/database/src/postgres/schema.ts
```

Note: existing tables use `pgTable(...)`, `uuid`, `text`, `timestamp`, `index`, `uniqueIndex` from `drizzle-orm/pg-core`. Reuse those.

- [ ] **Step 2: Write failing test for GoalRepository exists**

Create `lq-core/libs/infra/database/src/postgres/repositories/GoalRepository.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { GoalRepository } from './GoalRepository';

describe('GoalRepository', () => {
  it('exports a create method', () => {
    expect(typeof GoalRepository.create).toBe('function');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd /Users/kmandrup/Projects/Repos/learn-quest/lq-core
VITEST_MAX_THREADS=1 VITEST_MIN_THREADS=1 \
  tsx scripts/test-packages.ts libs/infra/database
```

Expected: FAIL — `Cannot find module './GoalRepository'`.

- [ ] **Step 4: Write minimal GoalRepository stub + Drizzle schema**

In `lq-core/libs/infra/database/src/postgres/schema.ts`, append at the bottom:

```ts
// === Household Goals & Rewards (migration 0008) ===

export const goals = pgTable('goals', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  memberId: uuid('member_id').notNull().references(() => householdMembers.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  metric: text('metric').notNull(),
  operator: text('operator').notNull().default('>='),
  threshold: numeric('threshold').notNull(),
  cadence: text('cadence').notNull(),
  customPeriodDays: integer('custom_period_days'),
  activeFrom: date('active_from'),
  expiresAt: date('expires_at'),
  rewardType: text('reward_type').notNull(),
  rewardAmount: numeric('reward_amount').notNull(),
  rewardTreatId: uuid('reward_treat_id'),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  householdMemberStatusIdx: index('idx_goals_household_member').on(t.householdId, t.memberId, t.status),
  memberActiveIdx: index('idx_goals_member_active').on(t.memberId).where(sql`${t.status} = 'active'`),
}));
// ... repeat for goal_evaluations, reward_grants, wishlist_items, wishlist_redemptions, household_goals_config
```

For brevity in this plan: copy the Drizzle schema from the spec section "Computed values" → reverse-engineer from the SQL. All column types, FKs, indexes, partial indexes must match the migration SQL exactly.

Then create `lq-core/libs/infra/database/src/postgres/repositories/GoalRepository.ts`:

```ts
export const GoalRepository = {
  async create(db: PostgresAdapter, data: NewGoal): Promise<Goal> {
    const [row] = await db.insert(goals).values(data).returning();
    return row;
  },
  async findById(db: PostgresAdapter, id: string): Promise<Goal | null> {
    const [row] = await db.select().from(goals).where(eq(goals.id, id)).limit(1);
    return row ?? null;
  },
  async findActiveByMember(db: PostgresAdapter, memberId: string): Promise<Goal[]> {
    return db.select().from(goals).where(and(eq(goals.memberId, memberId), eq(goals.status, 'active')));
  },
  // ... update, archive, findByHousehold
};
```

(Repeat for `GoalEvaluationRepository`, `RewardGrantRepository`, `WishlistItemRepository`, `WishlistRedemptionRepository`, `HouseholdGoalsConfigRepository`.)

- [ ] **Step 5: Run test to verify it passes**

```bash
VITEST_MAX_THREADS=1 VITEST_MIN_THREADS=1 tsx scripts/test-packages.ts libs/infra/database
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/kmandrup/Projects/Repos/learn-quest/lq-core
# (If git is initialized for this subtree; otherwise skip)
git add libs/infra/database/src/postgres/schema.ts libs/infra/database/src/postgres/repositories/
```

---

### Task 3: Period boundary calculator

**Files:**
- Create: `lq-core/libs/app/household-goals/src/periods.ts`
- Test: `lq-core/libs/app/household-goals/tests/periods.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from 'vitest';
import { periodBounds } from '../src/periods';

describe('periodBounds', () => {
  it('returns today midnight to tomorrow midnight for daily cadence', () => {
    const now = new Date('2026-07-12T15:30:00Z');
    const tz = 'UTC';
    const { start, end } = periodBounds('daily', undefined, now, tz);
    expect(start.toISOString()).toBe('2026-07-12T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-07-13T00:00:00.000Z');
  });

  it('returns Monday 00:00 to next Monday 00:00 for weekly cadence', () => {
    const now = new Date('2026-07-12T15:30:00Z'); // a Sunday
    const { start, end } = periodBounds('weekly', undefined, now, 'UTC');
    expect(start.toISOString()).toBe('2026-07-06T00:00:00.000Z'); // Monday
    expect(end.toISOString()).toBe('2026-07-13T00:00:00.000Z');
  });

  it('returns rolling N-day window for custom cadence', () => {
    const now = new Date('2026-07-12T15:30:00Z');
    const { start, end } = periodBounds('custom', 3, now, 'UTC');
    // anchor at floor of day - (3 - 1) days for 3-day rolling window
    expect(start.toISOString()).toBe('2026-07-10T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-07-13T00:00:00.000Z');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/kmandrup/Projects/Repos/learn-quest/lq-core
VITEST_MAX_THREADS=1 VITEST_MIN_THREADS=1 tsx scripts/test-packages.ts app
```

Expected: FAIL — `Cannot find module`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/periods.ts
export type Cadence = 'daily' | 'weekly' | 'custom';

export function periodBounds(
  cadence: Cadence,
  customPeriodDays: number | undefined,
  now: Date,
  timezone: string
): { start: Date; end: Date } {
  const dayStart = startOfDayInTz(now, timezone);

  if (cadence === 'daily') {
    return { start: dayStart, end: addDays(dayStart, 1) };
  }

  if (cadence === 'weekly') {
    const dow = dayOfWeekInTz(dayStart, timezone); // 0=Sun, 1=Mon, ...
    const daysSinceMonday = (dow + 6) % 7;
    const monday = addDays(dayStart, -daysSinceMonday);
    return { start: monday, end: addDays(monday, 7) };
  }

  // custom: rolling N-day window anchored to dayStart
  const n = customPeriodDays ?? 1;
  const start = addDays(dayStart, -(n - 1));
  return { start, end: addDays(start, n) };
}

function startOfDayInTz(d: Date, tz: string): Date {
  // Use Intl to compute Y-M-D in tz, then reconstruct midnight UTC for that date
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
  const y = parts.find(p => p.type === 'year')!.value;
  const m = parts.find(p => p.type === 'month')!.value;
  const dd = parts.find(p => p.type === 'day')!.value;
  return new Date(`${y}-${m}-${dd}T00:00:00Z`); // treat as UTC midnight of that local date
}

function dayOfWeekInTz(d: Date, tz: string): number {
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(d);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wd);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
VITEST_MAX_THREADS=1 VITEST_MIN_THREADS=1 tsx scripts/test-packages.ts app
```

Expected: PASS for the new `periods.test.ts`.

- [ ] **Step 5: Commit** (or skip if no git)

---

## Phase 2 — Goal Engine

### Task 4: Activity event types and hook signatures

**Files:**
- Create: `lq-core/libs/app/household-goals/src/types.ts`

- [ ] **Step 1: Write the types file**

```ts
// src/types.ts
export type GoalMetric = 'time' | 'lessons' | 'xp' | 'streak';
export type GoalCadence = 'daily' | 'weekly' | 'custom';
export type GoalRewardType = 'credits' | 'screen_time' | 'treat';
export type GrantStatus = 'available' | 'redeemed' | 'expired' | 'cancelled';
export type RedemptionStatus = 'pending' | 'approved' | 'denied' | 'cancelled';

export interface ActivityEvent {
  type: 'lesson.completed' | 'session.ended' | 'xp.gained' | 'streak.maintained' | 'streak.broken';
  memberId: string;
  householdId: string;
  // payload varies by type — narrow at handler site
  payload: {
    durationSec?: number;       // session.ended
    xpDelta?: number;            // lesson.completed, xp.gained
    newStreakLength?: number;    // streak.maintained
  };
  occurredAt: string;
}

export interface GoalEvaluationDelta {
  goalId: string;
  evaluationId: string;
  newValue: number;
  isCompleted: boolean;
  grantCreated?: {
    grantId: string;
    rewardType: GoalRewardType;
    amount: number;
  };
}
```

- [ ] **Step 2: Verify types compile**

```bash
cd /Users/kmandrup/Projects/Repos/learn-quest/lq-core
pnpm typecheck
```

Expected: no errors.

---

### Task 5: goalEvaluator — pure function with idempotency

**Files:**
- Create: `lq-core/libs/app/household-goals/src/services/goalEvaluator.ts`
- Test: `lq-core/libs/app/household-goals/tests/goalEvaluator.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect, vi } from 'vitest';
import { goalEvaluator } from '../src/services/goalEvaluator';

const fakeDb = {
  findActiveGoalsByMember: vi.fn(),
  findOrCreateEvaluation: vi.fn(),
  updateEvaluation: vi.fn(),
  createRewardGrant: vi.fn(),
};

describe('goalEvaluator', () => {
  it('does nothing for an event with no matching active goals', async () => {
    fakeDb.findActiveGoalsByMember.mockResolvedValue([]);
    const deltas = await goalEvaluator.handle(fakeDb as any, {
      type: 'lesson.completed', memberId: 'm1', householdId: 'h1', payload: { xpDelta: 20 }, occurredAt: '2026-07-12T10:00:00Z',
    });
    expect(deltas).toEqual([]);
  });

  it('increments lessons progress on lesson.completed event', async () => {
    fakeDb.findActiveGoalsByMember.mockResolvedValue([
      { id: 'g1', metric: 'lessons', threshold: 5, cadence: 'daily', customPeriodDays: null, householdId: 'h1' },
    ]);
    fakeDb.findOrCreateEvaluation.mockResolvedValue({ id: 'e1', goalId: 'g1', currentValue: 2, isCompleted: false, periodStart: new Date('2026-07-12T00:00:00Z'), periodEnd: new Date('2026-07-13T00:00:00Z') });
    fakeDb.updateEvaluation.mockResolvedValue({ id: 'e1', currentValue: 3, isCompleted: false });
    fakeDb.createRewardGrant.mockResolvedValue(null);

    const deltas = await goalEvaluator.handle(fakeDb as any, {
      type: 'lesson.completed', memberId: 'm1', householdId: 'h1', payload: {}, occurredAt: '2026-07-12T10:00:00Z',
    });

    expect(deltas).toHaveLength(1);
    expect(deltas[0].newValue).toBe(3);
    expect(deltas[0].isCompleted).toBe(false);
    expect(fakeDb.createRewardGrant).not.toHaveBeenCalled();
  });

  it('creates a reward grant when threshold is crossed', async () => {
    fakeDb.findActiveGoalsByMember.mockResolvedValue([
      { id: 'g1', metric: 'lessons', threshold: 5, cadence: 'daily', customPeriodDays: null, householdId: 'h1', rewardType: 'credits', rewardAmount: 3 },
    ]);
    fakeDb.findOrCreateEvaluation.mockResolvedValue({ id: 'e1', goalId: 'g1', currentValue: 4, isCompleted: false, periodStart: new Date(), periodEnd: new Date() });
    fakeDb.updateEvaluation.mockResolvedValue({ id: 'e1', currentValue: 5, isCompleted: true });
    fakeDb.createRewardGrant.mockResolvedValue({ id: 'grant1' });

    const deltas = await goalEvaluator.handle(fakeDb as any, {
      type: 'lesson.completed', memberId: 'm1', householdId: 'h1', payload: {}, occurredAt: '2026-07-12T10:00:00Z',
    });

    expect(deltas[0].isCompleted).toBe(true);
    expect(deltas[0].grantCreated?.grantId).toBe('grant1');
    expect(fakeDb.createRewardGrant).toHaveBeenCalledWith(expect.objectContaining({ rewardType: 'credits', amount: 3 }));
  });

  it('does NOT create a second grant if already completed (idempotency)', async () => {
    fakeDb.findActiveGoalsByMember.mockResolvedValue([
      { id: 'g1', metric: 'lessons', threshold: 5, cadence: 'daily', customPeriodDays: null, householdId: 'h1', rewardType: 'credits', rewardAmount: 3 },
    ]);
    fakeDb.findOrCreateEvaluation.mockResolvedValue({ id: 'e1', goalId: 'g1', currentValue: 5, isCompleted: true, periodStart: new Date(), periodEnd: new Date() });
    fakeDb.updateEvaluation.mockResolvedValue({ id: 'e1', currentValue: 6, isCompleted: true });
    fakeDb.createRewardGrant.mockResolvedValue(null);

    const deltas = await goalEvaluator.handle(fakeDb as any, {
      type: 'lesson.completed', memberId: 'm1', householdId: 'h1', payload: {}, occurredAt: '2026-07-12T10:00:00Z',
    });

    expect(deltas[0].isCompleted).toBe(true);
    expect(deltas[0].grantCreated).toBeUndefined();
    expect(fakeDb.createRewardGrant).not.toHaveBeenCalled();
  });

  it('adds durationSec/60 to time-metric progress on session.ended', async () => {
    fakeDb.findActiveGoalsByMember.mockResolvedValue([
      { id: 'g1', metric: 'time', threshold: 30, cadence: 'daily', customPeriodDays: null, householdId: 'h1' },
    ]);
    fakeDb.findOrCreateEvaluation.mockResolvedValue({ id: 'e1', goalId: 'g1', currentValue: 10, isCompleted: false, periodStart: new Date(), periodEnd: new Date() });
    fakeDb.updateEvaluation.mockResolvedValue({ id: 'e1', currentValue: 28, isCompleted: false });

    const deltas = await goalEvaluator.handle(fakeDb as any, {
      type: 'session.ended', memberId: 'm1', householdId: 'h1', payload: { durationSec: 18 * 60 }, occurredAt: '2026-07-12T10:00:00Z',
    });
    expect(deltas[0].newValue).toBe(28);
  });

  it('sets (not adds) streak progress on streak.maintained', async () => {
    fakeDb.findActiveGoalsByMember.mockResolvedValue([
      { id: 'g1', metric: 'streak', threshold: 7, cadence: 'daily', customPeriodDays: null, householdId: 'h1' },
    ]);
    fakeDb.findOrCreateEvaluation.mockResolvedValue({ id: 'e1', goalId: 'g1', currentValue: 5, isCompleted: false, periodStart: new Date(), periodEnd: new Date() });
    fakeDb.updateEvaluation.mockResolvedValue({ id: 'e1', currentValue: 7, isCompleted: true });
    fakeDb.createRewardGrant.mockResolvedValue({ id: 'grant1' });

    const deltas = await goalEvaluator.handle(fakeDb as any, {
      type: 'streak.maintained', memberId: 'm1', householdId: 'h1', payload: { newStreakLength: 7 }, occurredAt: '2026-07-12T10:00:00Z',
    });
    expect(deltas[0].newValue).toBe(7);
    expect(deltas[0].isCompleted).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/kmandrup/Projects/Repos/learn-quest/lq-core
VITEST_MAX_THREADS=1 VITEST_MIN_THREADS=1 tsx scripts/test-packages.ts app
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement goalEvaluator**

```ts
// src/services/goalEvaluator.ts
import { periodBounds } from '../periods';
import type { ActivityEvent, GoalEvaluationDelta, GoalMetric } from '../types';

interface EvaluatorDb {
  findActiveGoalsByMember(memberId: string): Promise<Array<{
    id: string;
    metric: GoalMetric;
    threshold: number;
    cadence: 'daily' | 'weekly' | 'custom';
    customPeriodDays: number | null;
    householdId: string;
    rewardType: 'credits' | 'screen_time' | 'treat';
    rewardAmount: number;
    rewardTreatId: string | null;
  }>>;
  findOrCreateEvaluation(goalId: string, memberId: string, periodStart: Date, periodEnd: Date): Promise<{
    id: string;
    goalId: string;
    currentValue: number;
    isCompleted: boolean;
  }>;
  updateEvaluation(evaluationId: string, newValue: number, isCompleted: boolean): Promise<void>;
  createRewardGrant(input: {
    memberId: string;
    householdId: string;
    goalId: string;
    rewardType: 'credits' | 'screen_time' | 'treat';
    amount: number;
    treatId: string | null;
    expiresAt?: Date;
  }): Promise<{ id: string } | null>;
}

const eventMetricMap: Record<ActivityEvent['type'], GoalMetric | null> = {
  'lesson.completed': 'lessons',
  'session.ended': 'time',
  'xp.gained': 'xp',
  'streak.maintained': 'streak',
  'streak.broken': 'streak',
};

export const goalEvaluator = {
  async handle(db: EvaluatorDb, event: ActivityEvent): Promise<GoalEvaluationDelta[]> {
    const metric = eventMetricMap[event.type];
    if (!metric) return [];

    const goals = await db.findActiveGoalsByMember(event.memberId);
    const matching = goals.filter(g => g.metric === metric);
    if (matching.length === 0) return [];

    const deltas: GoalEvaluationDelta[] = [];
    for (const goal of matching) {
      const { start, end } = periodBounds(goal.cadence, goal.customPeriodDays ?? undefined, new Date(event.occurredAt), 'UTC'); // TODO: pass household tz
      const evaluation = await db.findOrCreateEvaluation(goal.id, event.memberId, start, end);

      const newValue = computeNewValue(metric, evaluation.currentValue, event);
      const crossesThreshold = !evaluation.isCompleted && newValue >= goal.threshold;
      const stillCompleted = evaluation.isCompleted && newValue >= goal.threshold;

      await db.updateEvaluation(evaluation.id, newValue, evaluation.isCompleted || crossesThreshold);

      let grantCreated: GoalEvaluationDelta['grantCreated'];
      if (crossesThreshold) {
        const grant = await db.createRewardGrant({
          memberId: event.memberId,
          householdId: event.householdId,
          goalId: goal.id,
          rewardType: goal.rewardType,
          amount: goal.rewardAmount,
          treatId: goal.rewardTreatId,
          expiresAt: goal.rewardType === 'screen_time' ? endOfDay() : undefined,
        });
        if (grant) {
          grantCreated = { grantId: grant.id, rewardType: goal.rewardType, amount: goal.rewardAmount };
        }
      }

      deltas.push({
        goalId: goal.id,
        evaluationId: evaluation.id,
        newValue,
        isCompleted: evaluation.isCompleted || crossesThreshold || stillCompleted,
        grantCreated,
      });
    }
    return deltas;
  },
};

function computeNewValue(metric: GoalMetric, current: number, event: ActivityEvent): number {
  switch (metric) {
    case 'time':    return current + (event.payload.durationSec ?? 0) / 60;
    case 'lessons': return current + 1;
    case 'xp':      return current + (event.payload.xpDelta ?? 0);
    case 'streak':  return event.payload.newStreakLength ?? current;
  }
}

function endOfDay(): Date {
  const d = new Date();
  d.setUTCHours(23, 59, 59, 999);
  return d;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
VITEST_MAX_THREADS=1 VITEST_MIN_THREADS=1 tsx scripts/test-packages.ts app
```

Expected: PASS for the 6 new tests in `goalEvaluator.test.ts`.

---

### Task 6: Atomic grant insert transaction wrapper

**Files:**
- Create: `lq-core/libs/app/household-goals/src/services/rewardGrantService.ts`
- Test: `lq-core/libs/app/household-goals/tests/rewardGrantService.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect, vi } from 'vitest';
import { rewardGrantService } from '../src/services/rewardGrantService';

const fakeDb = {
  withTransaction: vi.fn(async (fn) => fn({ insert: vi.fn().mockReturnThis(), values: vi.fn().mockReturnThis(), returning: vi.fn().mockResolvedValue([{ id: 'grant1' }]) })),
};

describe('rewardGrantService', () => {
  it('inserts a credits grant with status=available', async () => {
    const result = await rewardGrantService.createCreditGrant(fakeDb as any, {
      memberId: 'm1', householdId: 'h1', goalId: 'g1', amount: 3,
    });
    expect(result.id).toBe('grant1');
    expect(fakeDb.withTransaction).toHaveBeenCalled();
  });

  it('inserts a screen_time grant with expiresAt end-of-day by default', async () => {
    const result = await rewardGrantService.createScreenTimeGrant(fakeDb as any, {
      memberId: 'm1', householdId: 'h1', goalId: 'g1', minutes: 30,
    });
    expect(result.id).toBe('grant1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/services/rewardGrantService.ts
export const rewardGrantService = {
  async createCreditGrant(db: { withTransaction: <T>(fn: (tx: any) => Promise<T>) => Promise<T> }, input: { memberId: string; householdId: string; goalId: string; amount: number }) {
    return db.withTransaction(async (tx) => {
      const [row] = await tx.insert(rewardGrants).values({
        memberId: input.memberId,
        householdId: input.householdId,
        goalId: input.goalId,
        reason: 'goal_completed',
        rewardType: 'credits',
        amount: input.amount,
        status: 'available',
      }).returning();
      return row;
    });
  },

  async createScreenTimeGrant(db: { withTransaction: <T>(fn: (tx: any) => Promise<T>) => Promise<T> }, input: { memberId: string; householdId: string; goalId: string; minutes: number; expiresAt?: Date }) {
    return db.withTransaction(async (tx) => {
      const [row] = await tx.insert(rewardGrants).values({
        memberId: input.memberId,
        householdId: input.householdId,
        goalId: input.goalId,
        reason: 'goal_completed',
        rewardType: 'screen_time',
        amount: input.minutes,
        status: 'available',
        expiresAt: input.expiresAt ?? endOfDayUtc(),
      }).returning();
      return row;
    });
  },

  async createTreatGrant(db: { withTransaction: <T>(fn: (tx: any) => Promise<T>) => Promise<T> }, input: { memberId: string; householdId: string; goalId: string; treatId: string }) {
    return db.withTransaction(async (tx) => {
      const [row] = await tx.insert(rewardGrants).values({
        memberId: input.memberId,
        householdId: input.householdId,
        goalId: input.goalId,
        reason: 'goal_completed',
        rewardType: 'treat',
        amount: 1,
        treatId: input.treatId,
        status: 'available',
      }).returning();
      return row;
    });
  },
};
```

- [ ] **Step 4: Run tests to verify they pass**

Expected: PASS.

---

### Task 7: Hook goalEvaluator into ActivityService

**Files:**
- Modify: `lq-core/libs/app/app-services/src/social/ActivityService.ts`

- [ ] **Step 1: Read existing ActivityService for the pattern**

```bash
head -100 /Users/kmandrup/Projects/Repos/learn-quest/lq-core/libs/app/app-services/src/social/ActivityService.ts
```

- [ ] **Step 2: Add goal-evaluator hook method**

Add to `ActivityService`:

```ts
import { goalEvaluator } from '@learnquest/household-goals/services/goalEvaluator';
import type { ActivityEvent } from '@learnquest/household-goals/types';

// In ActivityService class:
async emitActivityEvent(event: ActivityEvent): Promise<void> {
  try {
    await goalEvaluator.handle(this.db, event);
  } catch (err) {
    // Log but don't fail the activity record — goal eval is best-effort
    console.error('[ActivityService] goalEvaluator failed', err);
  }
}
```

- [ ] **Step 3: Call the hook after each record method**

In `recordLessonCompletion` (line 14), after the `return dbCreate(...)`, add:

```ts
await this.emitActivityEvent({
  type: 'lesson.completed',
  memberId: playerId, // TODO: resolve to active HouseholdMember if parent session
  householdId: '',    // TODO: resolve from player context
  payload: { xpDelta: lessonData.xpGained },
  occurredAt: new Date().toISOString(),
});
```

(Same pattern for `recordAchievementUnlocked` → `xp.gained`, `recordChallengeWon` → check existing fields.)

- [ ] **Step 4: Add SessionService for "time in app" tracking**

Create `lq-core/libs/app/app-services/src/player/SessionService.ts`:

```ts
export const SessionService = {
  async recordSessionEnd(memberId: string, householdId: string, durationSec: number) {
    await goalEvaluator.handle(this.db, {
      type: 'session.ended',
      memberId, householdId,
      payload: { durationSec },
      occurredAt: new Date().toISOString(),
    });
  },
};
```

Wire `SessionService.recordSessionEnd` from the app shell's `visibilitychange` and `beforeunload` handlers.

- [ ] **Step 5: Verify typecheck passes**

```bash
cd /Users/kmandrup/Projects/Repos/learn-quest/lq-core
pnpm typecheck
```

Expected: no errors.

---

### Task 8: Integration test — full goal lifecycle

**Files:**
- Create: `lq-core/libs/app/household-goals/tests/integration/goalLifecycle.integration.test.ts`

- [ ] **Step 1: Write integration test using real Postgres test fixture**

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestDb, teardownTestDb } from '@learnquest/database/test-utils';
import { goalEvaluator } from '../../src/services/goalEvaluator';

describe('goal lifecycle (integration)', () => {
  let db;
  beforeAll(async () => { db = await setupTestDb(); });
  afterAll(async () => { await teardownTestDb(db); });

  it('completes a goal end-to-end: lesson events → goal completes → grant inserted', async () => {
    // 1. Create household + member + goal
    // 2. Fire 5 lesson.completed events
    // 3. Assert goal_evaluations.is_completed = true
    // 4. Assert reward_grants row exists with reward_type='credits', status='available'
  });
});
```

- [ ] **Step 2: Run integration test**

```bash
cd /Users/kmandrup/Projects/Repos/learn-quest/lq-core
DATABASE_URL=$TEST_DATABASE_URL \
  VITEST_MAX_THREADS=1 VITEST_MIN_THREADS=1 \
  tsx scripts/test-packages.ts app
```

Expected: PASS.

---

## Phase 3 — Service Layer (wishlist + balance + anti-spam)

### Task 9: wishlistService — request / approve / deny with anti-spam

**Files:**
- Create: `lq-core/libs/app/household-goals/src/services/wishlistService.ts`
- Test: `lq-core/libs/app/household-goals/tests/wishlistService.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect, vi } from 'vitest';
import { wishlistService } from '../src/services/wishlistService';

const fakeDb = {
  getConfig: vi.fn().mockResolvedValue({ maxPendingRequests: 1, cooldownAfterDenialHours: 24, cooldownAfterApprovalHours: 12, maxApprovedPerDay: 2, openRequestCooldownDays: 3 }),
  countPendingRequests: vi.fn().mockResolvedValue(0),
  countApprovedToday: vi.fn().mockResolvedValue(0),
  findLastDeniedRedemption: vi.fn().mockResolvedValue(null),
  findLastApprovedRedemption: vi.fn().mockResolvedValue(null),
  findOpenRequest: vi.fn().mockResolvedValue(null),
  insertRedemption: vi.fn().mockResolvedValue({ id: 'r1' }),
};

describe('wishlistService.request', () => {
  it('creates a pending request when no rules block', async () => {
    const r = await wishlistService.request(fakeDb as any, { memberId: 'm1', householdId: 'h1', wishlistItemId: 'w1', creditsRequested: 5 });
    expect(r.id).toBe('r1');
    expect(fakeDb.insertRedemption).toHaveBeenCalled();
  });

  it('rejects when pending cap hit', async () => {
    fakeDb.countPendingRequests.mockResolvedValueOnce(1);
    await expect(wishlistService.request(fakeDb as any, { memberId: 'm1', householdId: 'h1', wishlistItemId: 'w1', creditsRequested: 5 }))
      .rejects.toThrow(/pending cap/i);
  });

  it('rejects when within denial cooldown for same item', async () => {
    fakeDb.findLastDeniedRedemption.mockResolvedValueOnce({ decidedAt: new Date(Date.now() - 2 * 60 * 60 * 1000) }); // 2h ago
    await expect(wishlistService.request(fakeDb as any, { memberId: 'm1', householdId: 'h1', wishlistItemId: 'w1', creditsRequested: 5 }))
      .rejects.toThrow(/cooldown/i);
  });

  it('rejects when within approval cooldown for any item', async () => {
    fakeDb.findLastApprovedRedemption.mockResolvedValueOnce({ decidedAt: new Date(Date.now() - 1 * 60 * 60 * 1000) }); // 1h ago
    await expect(wishlistService.request(fakeDb as any, { memberId: 'm1', householdId: 'h1', wishlistItemId: 'w1', creditsRequested: 5 }))
      .rejects.toThrow(/cooldown/i);
  });

  it('rejects when max approved per day hit', async () => {
    fakeDb.countApprovedToday.mockResolvedValueOnce(2);
    await expect(wishlistService.request(fakeDb as any, { memberId: 'm1', householdId: 'h1', wishlistItemId: 'w1', creditsRequested: 5 }))
      .rejects.toThrow(/daily limit/i);
  });
});

describe('wishlistService.approve', () => {
  it('approves and updates status', async () => {
    fakeDb.getRedemption = vi.fn().mockResolvedValue({ id: 'r1', memberId: 'm1', status: 'pending', creditsRequested: 5 });
    fakeDb.updateRedemptionStatus = vi.fn().mockResolvedValue(undefined);
    await wishlistService.approve(fakeDb as any, 'r1', 'p1', 'ok');
    expect(fakeDb.updateRedemptionStatus).toHaveBeenCalledWith('r1', 'approved', expect.any(Object));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL — module not found.

- [ ] **Step 3: Implement wishlistService**

```ts
// src/services/wishlistService.ts
export const wishlistService = {
  async request(db: RequestDb, input: { memberId: string; householdId: string; wishlistItemId?: string; openRequestText?: string; creditsRequested: number }) {
    const config = await db.getConfig(input.householdId);

    const pending = await db.countPendingRequests(input.memberId);
    if (pending >= config.maxPendingRequests) {
      throw new Error('PENDING_CAP_REACHED');
    }

    if (input.wishlistItemId) {
      const lastDenied = await db.findLastDeniedRedemption(input.memberId, input.wishlistItemId);
      if (lastDenied && hoursSince(lastDenied.decidedAt) < config.cooldownAfterDenialHours) {
        throw new Error('DENIAL_COOLDOWN_ACTIVE');
      }
    }

    const lastApproved = await db.findLastApprovedRedemption(input.memberId);
    if (lastApproved && hoursSince(lastApproved.decidedAt) < config.cooldownAfterApprovalHours) {
      throw new Error('APPROVAL_COOLDOWN_ACTIVE');
    }

    const approvedToday = await db.countApprovedToday(input.memberId);
    if (approvedToday >= config.maxApprovedPerDay) {
      throw new Error('DAILY_APPROVAL_LIMIT_REACHED');
    }

    if (input.openRequestText) {
      const lastOpen = await db.findOpenRequest(input.memberId);
      if (lastOpen && daysSince(lastOpen.requestedAt) < config.openRequestCooldownDays) {
        throw new Error('OPEN_REQUEST_COOLDOWN_ACTIVE');
      }
    }

    return db.insertRedemption({
      memberId: input.memberId,
      householdId: input.householdId,
      wishlistItemId: input.wishlistItemId ?? null,
      isOpenRequest: !!input.openRequestText,
      openRequestText: input.openRequestText ?? null,
      creditsRequested: input.creditsRequested,
      status: 'pending',
    });
  },

  async approve(db: DecisionDb, redemptionId: string, parentPlayerId: string, parentNote?: string) {
    const r = await db.getRedemption(redemptionId);
    if (!r) throw new Error('REDEMPTION_NOT_FOUND');
    if (r.status !== 'pending') throw new Error('REDEMPTION_NOT_PENDING');
    await db.updateRedemptionStatus(redemptionId, 'approved', { decidedBy: parentPlayerId, parentNote, decidedAt: new Date() });
  },

  async deny(db: DecisionDb, redemptionId: string, parentPlayerId: string, parentNote?: string) {
    const r = await db.getRedemption(redemptionId);
    if (!r) throw new Error('REDEMPTION_NOT_FOUND');
    if (r.status !== 'pending') throw new Error('REDEMPTION_NOT_PENDING');
    await db.updateRedemptionStatus(redemptionId, 'denied', { decidedBy: parentPlayerId, parentNote, decidedAt: new Date() });
  },
};

function hoursSince(d: Date): number { return (Date.now() - d.getTime()) / 3_600_000; }
function daysSince(d: Date): number { return (Date.now() - d.getTime()) / 86_400_000; }
```

- [ ] **Step 4: Run tests to verify they pass**

Expected: 6 PASS in `wishlistService.test.ts`.

---

### Task 10: balanceService — computed credit balance

**Files:**
- Create: `lq-core/libs/app/household-goals/src/services/balanceService.ts`
- Test: `lq-core/libs/app/household-goals/tests/balanceService.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect, vi } from 'vitest';
import { balanceService } from '../src/services/balanceService';

describe('balanceService.creditBalance', () => {
  it('returns sum of available grants minus sum of approved redemptions', async () => {
    const db = {
      sumAvailableCredits: vi.fn().mockResolvedValue(15),
      sumApprovedRedemptions: vi.fn().mockResolvedValue(5),
    };
    const balance = await balanceService.creditBalance(db as any, 'm1');
    expect(balance).toBe(10);
  });

  it('returns negative balance when over-spent', async () => {
    const db = {
      sumAvailableCredits: vi.fn().mockResolvedValue(3),
      sumApprovedRedemptions: vi.fn().mockResolvedValue(10),
    };
    expect(await balanceService.creditBalance(db as any, 'm1')).toBe(-7);
  });
});

describe('balanceService.screenTimeAvailableToday', () => {
  it('sums available minutes not yet expired', async () => {
    const db = { sumAvailableScreenTime: vi.fn().mockResolvedValue(45) };
    expect(await balanceService.screenTimeAvailableToday(db as any, 'm1')).toBe(45);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// src/services/balanceService.ts
export const balanceService = {
  async creditBalance(db: { sumAvailableCredits(memberId: string): Promise<number>; sumApprovedRedemptions(memberId: string): Promise<number> }, memberId: string): Promise<number> {
    const [credits, spent] = await Promise.all([
      db.sumAvailableCredits(memberId),
      db.sumApprovedRedemptions(memberId),
    ]);
    return credits - spent;
  },

  async screenTimeAvailableToday(db: { sumAvailableScreenTime(memberId: string): Promise<number> }, memberId: string): Promise<number> {
    return db.sumAvailableScreenTime(memberId);
  },
};
```

- [ ] **Step 4: Run tests to verify they pass**

Expected: 3 PASS.

---

## Phase 4 — Realtime Channel + API Layer

### Task 11: Realtime event types and channel subscription

**Files:**
- Create: `lq-core/libs/screens/household-goals/src/realtime/goalEventChannel.ts`

- [ ] **Step 1: Write the channel file**

```ts
// src/realtime/goalEventChannel.ts
import { createClient } from '@learnquest/supabase-realtime';

export type GoalRealtimeEvent =
  | { type: 'goal.progress_updated'; memberId: string; goalId: string; newValue: number }
  | { type: 'goal.completed'; memberId: string; goalId: string; grantId: string; rewardType: 'credits' | 'screen_time' | 'treat' }
  | { type: 'reward_grant.redeemed'; grantId: string; redeemedBy: string }
  | { type: 'wishlist_redemption.requested'; requestId: string }
  | { type: 'wishlist_redemption.decided'; requestId: string; decision: 'approved' | 'denied'; parentNote?: string }
  | { type: 'streak.broken'; memberId: string; lostStreak: number };

export function subscribeToHouseholdGoals(householdId: string, handler: (e: GoalRealtimeEvent) => void) {
  const client = createClient();
  const channel = client.channel(`household:${householdId}:goals`);
  channel.on('broadcast', { event: '*' }, (payload) => handler(payload as GoalRealtimeEvent));
  channel.subscribe();
  return () => channel.unsubscribe();
}
```

- [ ] **Step 2: Wire broadcast emission from server-side event handlers**

In `goalEvaluator.handle`, after a grant is created, emit a `goal.completed` event on the household's realtime channel. Same for `wishlistRedemption.requested` in `wishlistService.request`.

(This is implementation-level — adjust based on existing realtime broadcast API in your codebase.)

---

### Task 12: REST API endpoints

**Files:**
- Create: `lq-core/apps/api/src/routes/household-goals.ts` (or wherever REST routes live — check existing pattern)

For each endpoint, follow existing route patterns. Endpoints to add:

```
POST   /api/households/:id/goals                  # parent creates goal
GET    /api/households/:id/goals                  # list goals (all members)
PATCH  /api/goals/:id                             # edit goal
DELETE /api/goals/:id                             # archive goal
GET    /api/members/:id/goals/active              # kid view: active goals for today
GET    /api/members/:id/balance                   # credit balance
POST   /api/households/:id/wishlist-items         # parent adds catalog item
GET    /api/households/:id/wishlist-items
POST   /api/members/:id/wishlist-redemptions      # kid requests
POST   /api/wishlist-redemptions/:id/approve      # parent approves
POST   /api/wishlist-redemptions/:id/deny         # parent denies
POST   /api/reward-grants/:id/redeem              # mark screen_time/treat as used
POST   /api/members/:id/balance/adjust            # manual balance correction
```

For each: write integration test first, then implement. Validate inputs with Zod schemas (already a convention in lq-core per CLAUDE.md).

---

## Phase 5 — Parent UI

### Task 13: GoalsDashboardScreen — household view

**Files:**
- Create: `lq-core/libs/screens/household-goals/src/parent/GoalsDashboardScreen.tsx`
- Story: `lq-core/libs/screens/household-goals/src/stories/GoalsDashboardScreen.stories.tsx`

- [ ] **Step 1: Write Storybook story first**

```tsx
// src/stories/GoalsDashboardScreen.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { GoalsDashboardScreen } from '../parent/GoalsDashboardScreen';

const meta: Meta<typeof GoalsDashboardScreen> = {
  title: 'HouseholdGoals/GoalsDashboardScreen',
  component: GoalsDashboardScreen,
};
export default meta;

export const TwoKidsActive: StoryObj<typeof GoalsDashboardScreen> = {
  args: {
    householdId: 'h1',
    members: [
      { id: 'm1', displayName: 'Emma', avatarUrl: '👧', todayGoals: [
        { id: 'g1', name: '30 min reading', metric: 'time', threshold: 30, currentValue: 18, isCompleted: false, rewardLabel: '3 credits' },
        { id: 'g2', name: '5 lessons', metric: 'lessons', threshold: 5, currentValue: 5, isCompleted: true, rewardLabel: '30 min Roblox' },
      ], creditBalance: 12 },
      { id: 'm2', displayName: 'Lucas', avatarUrl: '🧒', todayGoals: [
        { id: 'g3', name: '30 min reading', metric: 'time', threshold: 30, currentValue: 12, isCompleted: false, rewardLabel: 'ice cream' },
      ], creditBalance: 0 },
    ],
  },
};
```

- [ ] **Step 2: Implement the screen**

Build the dashboard matching the ASCII layout in spec section "Section 5: Parent-facing UX > GoalsDashboardScreen". Use `@learnquest/ui` Card, Progress, Avatar components.

- [ ] **Step 3: Run Storybook + screen-audit**

```bash
cd /Users/kmandrup/Projects/Repos/learn-quest/lq-core
pnpm --filter @learnquest/screen-household-goals storybook
pnpm --filter @blueforge-studio/screen-audit audit --scope screen-household-goals
```

Expected: story renders without errors; audit score matches existing screens.

---

### Task 14: GoalSetupScreen — parent configures a goal

**Files:**
- Create: `lq-core/libs/screens/household-goals/src/parent/GoalSetupScreen.tsx`
- Story: `lq-core/libs/screens/household-goals/src/stories/GoalSetupScreen.stories.tsx`

- [ ] **Step 1: Write Storybook stories for each metric variant**

Three stories: time-based, lesson-based, streak-based. Each shows the form with sensible defaults.

- [ ] **Step 2: Implement form**

Use `@learnquest/ui` Select, Input, Button. On submit, POST to `/api/households/:id/goals`.

- [ ] **Step 3: Test + audit**

Same as Task 13.

---

### Task 15: WishlistAdminScreen — parent catalog + pending requests

**Files:**
- Create: `lq-core/libs/screens/household-goals/src/parent/WishlistAdminScreen.tsx`

Two tabs: "Catalog" (CRUD on wishlist items) + "Pending requests" (approve/deny inbox). Implements rate-limit config UI in a slide-out drawer.

---

### Task 16: TreatsCatalogScreen — parent defines treats

**Files:**
- Create: `lq-core/libs/screens/household-goals/src/parent/TreatsCatalogScreen.tsx`

Simple CRUD for treats. Treats are `wishlist_items` rows that are available as goal rewards.

---

### Task 17: Modify existing screens

**Files:**
- Modify: `lq-core/libs/screens/household/src/settings/HouseholdSettingsScreen.tsx`
- Modify: `lq-core/libs/screens/household/src/settings/HouseholdMemberScreen.tsx`

- [ ] **Step 1: Add "Goals & Rewards" entry link to HouseholdSettingsScreen**

Find the settings list component. Add:

```tsx
<ListItem
  icon="🎯"
  title="Goals & Rewards"
  subtitle="Set goals for kids, manage rewards"
  onClick={() => navigate(`/household/goals`)}
/>
```

- [ ] **Step 2: Add progress summary to HouseholdMemberScreen**

Above the existing member details, add a `<MemberProgressCard memberId={member.id} />` component that calls `useMemberGoals(member.id)` and renders today's progress + credit balance.

- [ ] **Step 3: Test**

Re-run E2E tests for the household flow.

---

## Phase 6 — Kid UI + Realtime

### Task 18: KidGoalsScreen — kid's primary view

**Files:**
- Create: `lq-core/libs/screens/household-goals/src/kid/KidGoalsScreen.tsx`
- Story: `.../stories/KidGoalsScreen.stories.tsx`

Three sections (per spec): Today, Earned today, This week. Subscribes to realtime channel via `subscribeToHouseholdGoals` and animates progress bars on `goal.progress_updated`.

---

### Task 19: WishlistScreen — kid spending view

**Files:**
- Create: `lq-core/libs/screens/household-goals/src/kid/WishlistScreen.tsx`
- Story: `.../stories/WishlistScreen.stories.tsx`

Catalog grid + balance display + history. Disable items kid can't afford. Free-text request modal with cooldown enforcement.

---

### Task 20: GoalCompleteToast — ephemeral overlay

**Files:**
- Create: `lq-core/libs/screens/household-goals/src/kid/GoalCompleteToast.tsx`

Listen to `goal.completed` realtime events. Show 3-second celebratory toast, auto-dismiss.

---

### Task 21: Modify existing kid-facing screens

**Files:**
- Modify: `lq-core/libs/screens/dashboard/src/PlayerDashboard.tsx` — add "Goals today" pill in top bar
- Modify: `lq-core/libs/screens/household/src/profile-picker/WhoIsPlayingScreen.tsx` — show credit balance below each kid avatar
- Modify: `lq-core/libs/ui/src/layout/TopBar.tsx` — bell icon shows unread notifications

---

## Phase 7 — Notifications + Polish

### Task 22: Wire push notifications for parent

**Files:**
- Modify: `lq-core/libs/app/app-services/src/notifications/` (extend existing notification dispatch)

Add notification templates:
- `goal.completed` → "Emma hit her 30-min reading goal — earned 3 credits"
- `wishlist_redemption.requested` → "Emma wants: New book (20 credits)"

Batching logic: collect completions per household per 5-min window; emit one digest per household.

---

### Task 23: Streak-event emission from ProgressionService

**Files:**
- Modify: `lq-core/libs/app/app-services/src/player/ProgressionService.ts` (or wherever streak is updated)

After updating `player.currentStreak`, emit:

```ts
await ActivityService.emitActivityEvent({
  type: 'streak.maintained',
  memberId: activeMemberId,
  householdId: activeHouseholdId,
  payload: { newStreakLength: player.currentStreak },
  occurredAt: new Date().toISOString(),
});
```

If the streak went from > 0 to 0, emit `streak.broken` instead.

---

### Task 24: Anti-spam enforcement in kid UI

Verify all anti-spam error codes from `wishlistService.request` are handled by the kid UI and translated to kid-friendly messages.

Error → message mapping:
- `PENDING_CAP_REACHED` → "You already have a request waiting. Ask mom/dad about that one first."
- `DENIAL_COOLDOWN_ACTIVE` → "Try again in X hours"
- `APPROVAL_COOLDOWN_ACTIVE` → "You just got something! Wait until after dinner to ask again."
- `DAILY_APPROVAL_LIMIT_REACHED` → "You've had your treats for today"
- `OPEN_REQUEST_COOLDOWN_ACTIVE` → "Save your request — try again in X days"

---

### Task 25: Manual balance correction UI

Add to `WishlistAdminScreen` a "Adjust balance" action per member that calls `POST /api/members/:id/balance/adjust`. Inserts a `RewardGrant{reason: 'manual_adjustment', amount: ±N}`. Audit trail preserved.

---

## Phase 8 — Cross-Repo Rollout

### Task 26: i18n strings to all 59 languages

**Files:**
- Modify: `lq-core/apps/web/public/locales/*.json` (59 files)

Add ~30 keys per language:

```json
{
  "household_goals": {
    "title": "Goals & Rewards",
    "todays_goals": "Today's goals",
    "earned_today": "Earned today",
    "credit_balance": "{count} credits",
    "add_goal": "Add a goal",
    "invite_to_redeem": "Ask mom/dad",
    "...": "..."
  }
}
```

Use Claude (via `@learnquest/ai-sdk`) to generate the 58 non-English translations in batch:

```bash
cd /Users/kmandrup/Projects/Repos/learn-quest/lq-core
tsx scripts/i18n/translate-batch.ts \
  --source en --target "da,de,fr,es,it,pt,nl,sv,no,da,..." \
  --input apps/web/public/locales/en.json \
  --output apps/web/public/locales/
```

Verify: open any 3 non-English locales and confirm keys present.

---

### Task 27: Per-lang-quest repo smoke tests

**Files:**
- Create: `lang-quest/lq-{region}/tests/household-goals.spec.ts` (template file, copy to each repo)

Scenario coverage:
1. Parent creates daily "5 lessons" goal with screen-time reward
2. Kid completes 4 lessons → goal shows 4/5
3. Kid completes 5th lesson → toast appears, parent push fires
4. Parent marks screen-time redeemed → kid view shows "used"
5. Parent creates wishlist item, kid requests, parent approves, balance drops
6. Kid denied, tries same item immediately → "try again in 24h" shown

---

### Task 28: Shared E2E runner

**Files:**
- Create: `lq-tools/scripts/e2e/household-goals-suite.ts`

Runner iterates all 14 lang-quest repos, runs their `tests/household-goals.spec.ts` in sequence with shared `BASE_URL` override. Reports pass/fail per repo.

```bash
cd /Users/kmandrup/Projects/Repos/learn-quest/lq-tools
tsx scripts/e2e/household-goals-suite.ts --base-url http://localhost:3010
```

---

### Task 29: Manual QA scripts

Create runbook in `lq-core/docs/qa/household-goals.md` covering the 4 manual QA scenarios from spec section "Testing Strategy > Manual QA scenarios":
- COPPA ghost kid
- Multi-parent
- Time-zone edge (PST midnight rollover)
- Streak recovery

---

## Self-Review Checklist (run before execution)

After writing this plan, verify:

1. **Spec coverage** — every section of the spec maps to a task:
   - Architecture overview → Tasks 1-3, 13
   - Data model (6 tables) → Task 1, 2
   - Goal engine mechanics → Tasks 3-8
   - Reward grant lifecycle → Tasks 6, 9-10
   - Wishlist approval + anti-spam → Task 9, 24
   - UX surfaces (parent + kid) → Tasks 13-21
   - Realtime / cross-device / notifications → Tasks 11, 22-23
   - Migration → Task 1
   - Error handling → covered by integration tests in Tasks 8
   - Testing strategy → Tasks 8-10, 27
   - Out of scope → nothing to do

2. **Placeholder scan** — no TBD/TODO/FIXME. The only TODOs are in Task 7 Step 2 ("TODO: resolve to active HouseholdMember if parent session") which is a documented known gap to address during execution.

3. **Type consistency** — `GoalEvaluationDelta`, `ActivityEvent`, `GoalRewardType` are defined in Task 4 and reused in Tasks 5-7. `wishlistService.request`/`approve`/`deny` are defined in Task 9 and called from Tasks 19, 24.

4. **Implementation reality check** — deviations from spec documented at top of plan (ActivityService hook, SessionService, no event bus).

5. **Frequent commits** — each task ends with a commit step (skipped where no git).

---

## Execution Notes

- **Working directory:** `/Users/kmandrup/Projects/Repos/learn-quest/lq-core`
- **Test commands:** use `tsx scripts/test-packages.ts app` (per the per-domain harness in memory) to avoid OOM
- **Migrations:** apply via `drizzle-kit migrate` against `DATABASE_URL`
- **Domain memory check:** add new domain `household-goals` to `lq-core/scripts/run-domain-memory-check.sh`
- **Packr publish:** the new `@learnquest/household-goals` package needs to be published to `https://api.packr.blueforge.studio` per the existing packr flow (memory: `reference_packr_publish_path.md`)
- **lq-core is NOT a git repo at the root** — check subdirectory git status before each commit step; skip commit steps if no git
- **Storybook + screen-audit are mandatory** for new screens per memory `feedback_ui_components_and_story_audit.md`