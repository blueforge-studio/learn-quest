# Household Goals + Real-Life Rewards Design

**Status:** Approved (brainstorming complete)
**Date:** 2026-07-12
**Builds on:** [Family Profile + Multi-Member Household](./2026-07-09-family-profile-design.md) (2026-07-09)
**Scope:** lq-core (data + service + UI) → flows automatically into all 14 lang-quest apps via `@learnquest/*` packages
**Pattern:** Parent-defined daily/weekly goals that grant kid-visible rewards; manual enforcement of real-life rewards (no native screen-time APIs)

## Problem

The Family Profile feature (designed 2026-07-09, in implementation) makes it possible for multiple family members to share a household subscription and play on the same device. But it stops at billing + identity — it does not give parents a tool to *motivate* their kids to use the app consistently, nor a mechanism to tie app activity to real-life rewards (Roblox screen time, ice cream, accumulating pocket money).

**User need (verbatim):** "Consider how parents can set up goals that kids must achieve, such as 30 mins or 5 lessons daily to get some sort of real-life reward. In my family we use it as precondition to get 30 min play time for Roblox. Could also be for an ice cream desert or some credits/pocket money that can be accumulated and used later."

The existing Family Profile spec explicitly deferred parental controls / content gating as out-of-scope. This design fills that gap for the goals + rewards subset.

## Goals

1. **Parent-defined daily/weekly/custom-cadence goals** per kid covering time, lessons, XP, or streak metrics
2. **Three reward types**: screen-time unlock (precondition for Roblox etc.), one-off treats (ice cream), and accumulating in-app credits
3. **Auto-grant on goal hit** — no parent gatekeeping per grant; parent controls frequency via goal design
4. **Wishlist spending mechanism** — kids spend accumulated credits on parent-defined items, parent approves each spend (anti-spam)
5. **Real-time updates** — kid sees progress and granted rewards instantly; parent sees kid activity in realtime dashboard
6. **COPAA-friendly by default** — works for ghost kids (no email) via parent's session; no kid-side email/PII required
7. **Builds on the existing Family Profile** — assumes `Household`, `HouseholdMember`, `HouseholdInvite` tables exist; pure additive migration

## Non-Goals

- Cross-household rewards (kid plays at friend's house, those goals count too)
- Group/household-wide goals (whole family hits combined target)
- Native integration with Apple Screen Time / Google Family Link (status-flag model only — manual enforcement)
- Real-money allowance tracking (virtual credits only)
- Sibling leaderboards
- AI-suggested goals
- Goal templates / preset bundles
- Wishlist gift economy (kid A gifts credits to kid B)

## Decisions Made

| Question | Decision |
|---|---|
| Goal metric vocabulary | Time + lessons + XP + streak |
| Goal cadence | Daily + weekly + custom period |
| Reward types | Screen-time unlock, one-off treats, accumulating in-app credits (no real money) |
| Reward approval | Auto-grant on goal completion (no per-grant gatekeeping) |
| Kid view | Goal progress + earned rewards visible (gamified, motivating) |
| Eligible members | All household members; defaults to on for ghost kids |
| Partial completion | All-or-nothing per goal (no partial credit) |
| Credit spending | Wishlist (parent-defined catalog) → parent approves each spend |
| External integration | Status flag only — manual enforcement by parent |
| Goal composition | Standalone goals only (no AND/OR) |

## Architecture

```
lq-core/
├── libs/
│   ├── app/
│   │   └── household-goals/          # NEW — goal engine, services
│   │       ├── src/
│   │       │   ├── services/
│   │       │   │   ├── goalService.ts
│   │       │   │   ├── rewardGrantService.ts
│   │       │   │   ├── wishlistService.ts
│   │       │   │   └── goalEvaluator.ts      # subscribes to activity events
│   │       │   ├── events/
│   │       │   │   └── activityHandlers.ts   # lesson/xp/time/streak handlers
│   │       │   └── index.ts
│   │       └── tests/
│   └── screens/
│       └── household-goals/          # NEW — UI
│           ├── src/
│           │   ├── GoalsDashboardScreen.tsx        # parent view
│           │   ├── GoalSetupScreen.tsx             # parent: configure goal
│           │   ├── KidGoalsScreen.tsx              # kid view
│           │   ├── WishlistScreen.tsx              # kid view
│           │   ├── WishlistAdminScreen.tsx         # parent: catalog + approvals
│           │   ├── TreatsCatalogScreen.tsx         # parent: treat definitions
│           │   ├── GoalCompleteToast.tsx           # ephemeral celebration
│           │   └── stories/                        # *.stories.tsx
│           └── tests/
├── libs/infra/database/src/postgres/
│   └── schema.ts                    # EXTEND — add 6 new tables
└── apps/web/
    └── routes.tsx                   # EXTEND — add new routes
```

### Three independent units, each testable in isolation

1. **`goalEvaluator`** — pure function: `(memberId, activityEvent) → GoalEvaluationDelta[]`. Given an activity event and a member's active goals, returns which goals' progress changed and any newly-completed goals. No I/O, fully unit-testable.
2. **`rewardGrantService`** — given a completed goal, creates the appropriate grant (credits add to balance, screen-time creates unlock record, treat marks 'available'). Atomic per-goal transaction.
3. **`wishlistService`** — manages the parent-defined catalog and kid-initiated redemptions.

### Production stack (not Supabase)

The production deployment is **self-hosted on `forge-control` infrastructure at `blueforge.studio`** — **not Supabase**. The `@learnquest/database` abstraction supports multiple backends; the production wiring is:

- **DB**: `VITE_DB_PROVIDER=postgres` → Drizzle ORM with `pg` against the on-prem Postgres connection string. Schema lives in `libs/infra/database/src/postgres/schema.ts`. Supabase adapter is a dev/legacy path not used in production.
- **Auth**: `AuthService` configured with `provider: 'forge'` → calls `platform-api` for auth flows.
- **Realtime**: existing WebSocket channel (used for cross-device progress sync).
- **Notifications**: existing `@learnquest/notifications` package.

The migration SQL in this spec targets **standard PostgreSQL** (uses `gen_random_uuid()`, `TIMESTAMPTZ`, partial unique indexes — all vanilla Postgres features). It will run on the on-prem database without Supabase-specific extensions.

### Where things live

- **Data model + migrations + service layer** → `lq-core/libs/infra/database` and `lq-core/libs/app/household-goals`
- **New screens + components** → `lq-core/libs/screens/household-goals` (new package) + reuse from `libs/screens/profile`, `libs/screens/onboarding`
- **i18n strings** → added to `lq-core/apps/web/public/locales/*.json`; all 14 lang-quest apps inherit on next packr publish

### Migration approach

The on-prem Postgres adapter uses Drizzle ORM but does not yet have a `drizzle/` migration directory. The existing convention (from sibling forge projects like `hosting-database`) is to use **`drizzle-kit generate` + manual SQL review** for schema changes. This migration follows that pattern: a numbered migration file `0008_household_goals.sql` with the SQL up/down, applied via `drizzle-kit migrate` or platform-api's migration runner.

### Unit test harness

```bash
VITEST_MAX_THREADS=1 VITEST_MIN_THREADS=1 \
  tsx lq-core/scripts/test-packages.ts app
VITEST_MAX_THREADS=1 VITEST_MIN_THREADS=1 \
  tsx lq-core/scripts/test-packages.ts libs
bash lq-core/scripts/run-domain-memory-check.sh household-goals  # new domain
```

### E2E tests

The 14 lang-quest repos under `lang-quest/lq-*/` each get a `tests/household-goals.spec.ts` running shared scenarios. A shared runner `lq-tools/scripts/e2e/household-goals-suite.ts` runs the spec across all 14 repos in sequence.

## Data Model

### New entities

```ts
interface Goal {
  id: string                         // UUID
  householdId: string                 // FK
  name: string                       // parent-set, kid-friendly default
  memberId: string                   // FK to HouseholdMember — the kid
  metric: 'time' | 'lessons' | 'xp' | 'streak'
  operator: '>='                     // v1 = ">=" only (all-or-nothing)
  threshold: number                  // 30 (minutes), 5 (lessons), 100 (XP), 7 (days)
  cadence: 'daily' | 'weekly' | 'custom'
  customPeriodDays?: number          // only when cadence='custom'
  activeFrom?: string                // ISO date — optional start
  expiresAt?: string                 // ISO date — optional end (vacation)
  rewardType: 'credits' | 'screen_time' | 'treat'
  rewardAmount: number               // credits: 3; screen_time: minutes; treat: ignored
  rewardTreatId?: string             // FK to WishlistItem (when rewardType='treat')
  status: 'active' | 'paused' | 'archived'
  createdAt: string
  updatedAt: string
}

interface GoalEvaluation {
  id: string                         // UUID
  goalId: string                     // FK
  memberId: string                   // FK to HouseholdMember (denormalized for fast queries)
  periodStart: string                // ISO timestamp
  periodEnd: string                  // ISO timestamp
  currentValue: number               // aggregate so far
  isCompleted: boolean               // flips true when currentValue >= threshold
  completedAt?: string               // timestamp when threshold first crossed
  lastEvaluatedAt: string            // for staleness detection
}

type RewardGrantReason = 'goal_completed' | 'manual_adjustment';

interface RewardGrant {
  id: string                         // UUID
  memberId: string                   // FK to HouseholdMember
  householdId: string                // FK
  goalId?: string                    // FK to Goal (null when reason='manual_adjustment')
  reason: RewardGrantReason
  rewardType: 'credits' | 'screen_time' | 'treat'
  amount: number                     // credits added, minutes unlocked, 1 for treats
  treatId?: string                   // FK to WishlistItem
  status: 'available' | 'redeemed' | 'expired' | 'cancelled'
  grantedAt: string
  redeemedAt?: string
  redeemedBy?: string                // FK to Player (parent who marked redeemed)
  expiresAt?: string                 // optional — screen-time may expire end-of-day
  parentNote?: string                // optional note (e.g., "ok after dinner")
}

interface WishlistItem {
  id: string                         // UUID
  householdId: string                // FK
  name: string                       // "Ice cream", "Movie pick", "New book"
  description?: string
  creditCost: number                 // 5
  iconKey?: string                   // mapped to lq-core icon library
  status: 'available' | 'archived'
  createdAt: string
}

interface WishlistRedemption {
  id: string                         // UUID
  wishlistItemId: string             // FK (null when is_open_request=true)
  memberId: string                   // FK to HouseholdMember
  householdId: string                // FK
  isOpenRequest: boolean             // true = kid requested something not in catalog
  openRequestText?: string           // the kid's free-text description
  creditsRequested: number           // snapshot at request time
  status: 'pending' | 'approved' | 'denied' | 'cancelled'
  requestedAt: string
  decidedAt?: string
  decidedBy?: string                 // FK to Player (parent)
  parentNote?: string                // shown to kid verbatim
}

interface HouseholdGoalsConfig {
  householdId: string                // PK + FK
  maxPendingRequests: number         // 1-5, default 1
  cooldownAfterDenialHours: number   // default 24
  cooldownAfterApprovalHours: number // default 12
  maxApprovedPerDay: number          // 1-5, default 2
  openRequestCooldownDays: number    // default 3
  notificationMode: 'instant' | 'batched'  // default 'batched'
  updatedAt: string
}
```

### Computed values (not stored)

- **`member.creditBalance`** = `SUM(reward_grants.amount WHERE rewardType='credits' AND member_id=X AND status='available') - SUM(wishlist_redemptions.creditsRequested WHERE member_id=X AND status='approved')`
  - Credit grants are immutable historical records and stay in `available` status forever (never `redeemed` — that's for screen-time and treats). Cancellation of an approved redemption leaves the grant untouched; the redemption status moves to `cancelled` and the balance formula subtracts only `approved`.
- **Available screen-time today** = `SUM(reward_grants.amount WHERE rewardType='screen_time' AND member_id=X AND status='available' AND (expires_at IS NULL OR expires_at > now()))`
- **Pending request count** = `COUNT(wishlist_redemptions WHERE member_id=X AND status='pending')`

### Indexes

- `goals(household_id, member_id, status)` — fast lookup of active goals per kid
- `goal_evaluations(goal_id, period_start)` UNIQUE — one evaluation per goal per period
- `goal_evaluations(member_id, is_completed=false)` — kid dashboard "today's active goals"
- `reward_grants(member_id, status, granted_at DESC)` — credit balance, recent unlocks
- `wishlist_redemptions(household_id, status, requested_at DESC)` — parent's pending-approval inbox
- `wishlist_redemptions(member_id, status)` — kid's own history

### Relationship to existing schema

- `Goal.memberId` → `HouseholdMember.id`
- `RewardGrant.memberId` → `HouseholdMember.id`
- `WishlistItem.householdId` → `Household.id` (catalog is shared)
- All goals/rewards cascade-delete with the household

## Goal Engine Mechanics

### Activity events that drive goals

`goalEvaluator` subscribes to events already published by lq-core's player-activity pipeline:

| Activity event | Triggered when | Affects goals with metric |
|---|---|---|
| `lesson.completed` | Kid finishes a lesson (any outcome) | `lessons`, `xp` (carries XP delta) |
| `session.ended` | Player quits app or session times out | `time` (carries durationSec) |
| `xp.gained` | XP-earning event outside lessons | `xp` |
| `streak.maintained` | Daily streak check fires at first activity past midnight local | `streak` (carries new streak length) |
| `streak.broken` | Streak check fires and previous streak was > 0 | `streak` (no completion possible) |

### Evaluation flow

```
[Activity event]
   ↓
eventBus.publish(event)
   ↓
goalEvaluator.handle(event)
   ↓
1. Find active Goal rows for event.memberId where metric matches event.type
   ↓
2. For each goal, find/create GoalEvaluation for current period
   - Daily:    periodStart = today midnight (household tz), periodEnd = tomorrow midnight
   - Weekly:   periodStart = Monday 00:00 (household tz), periodEnd = next Monday 00:00
   - Custom:   periodStart = last periodStart + customPeriodDays, rolling
   ↓
3. Apply event delta:
   - time:    evaluation.currentValue += event.durationSec / 60  (minutes)
   - lessons: evaluation.currentValue += 1
   - xp:      evaluation.currentValue += event.xpDelta
   - streak:  evaluation.currentValue = event.newStreakLength  (set, not add)
   ↓
4. If !evaluation.isCompleted AND evaluation.currentValue >= goal.threshold:
   - evaluation.isCompleted = true, completedAt = now
   - INSERT RewardGrant (status='available')
   - emit GoalCompletedEvent (for notifications + kid UI refresh)
   ↓
5. Persist GoalEvaluation update atomically with grant insert (single tx)
```

### Critical correctness properties

**Idempotency.** If the same activity event is delivered twice (network retry, race), we must not grant the reward twice. The check `if !evaluation.isCompleted && currentValue >= threshold` makes the grant an atomic state transition — re-running the evaluator on the same event is a no-op.

**Period rollover.** When `now > evaluation.periodEnd`, a new event creates a *new* `GoalEvaluation` row for the new period (the old one stays as historical record). The kid dashboard query filters to `period_start <= now < period_end`.

**Cross-device activity.** The activity event's `memberId` must be the *active* HouseholdMember (set via the picker from the family-profile spec), not the parent Player.id. The activity pipeline reads `active_member_id` from session storage.

**Streak metric semantics.** `streak` is special: the same `currentValue` applies to every active streak goal. Setting `currentValue = event.newStreakLength` (not add) handles this. If a kid's first activity of a new day fires a streak event with value=7, all 7-day streak goals complete same-day — that's expected behavior.

### Failure modes

- **Event bus unavailable** → events queued in DB-backed outbox, retried on restart
- **Evaluator crashes mid-batch** → outbox replay resumes from last successful offset
- **Goal deleted while events in-flight** → evaluator skips goals that don't exist (LEFT JOIN with `deleted_at IS NULL`)

## Reward Grant Lifecycle

### `credits` — accumulating in-app credits

| Stage | Behavior |
|---|---|
| Grant | `RewardGrant{rewardType:'credits', amount:N, status:'available'}` inserted. Credit balance increases by N. |
| Kid spends | Kid submits `WishlistRedemption{status:'pending'}` for some `WishlistItem` costing X credits. |
| Parent reviews | Parent approves → status='approved' → credits deducted from balance. |
| Parent denies | status='denied'. No balance change. |
| Cancellation window | Parent can revoke approval within 1 hour of `decidedAt` (kid changed mind, picked different treat). After 1h, status is final. |

### `screen_time` — unlock record

| Stage | Behavior |
|---|---|
| Grant | `RewardGrant{rewardType:'screen_time', amount:30, status:'available', expiresAt: end-of-day (household tz)}`. |
| Kid sees | Dashboard shows "🎮 30 min Roblox unlocked — ask mom/dad". |
| Parent gives device | Parent taps "Mark redeemed" → status='redeemed', redeemedAt=now, redeemedBy=parent.id. No further integration — parent physically hands over device. |
| Day passes | Cron sweep at midnight (household tz) expires any un-redeemed unlocks: status='expired'. |
| Multiple unlocks same day | Each grant is independent. Kid view aggregates total available minutes. |

### `treat` — one-off, parent-pays-out

| Stage | Behavior |
|---|---|
| Grant | `RewardGrant{rewardType:'treat', amount:1, treatId:X, status:'available'}`. |
| Kid sees | "🎉 You earned ice cream! Ask mom/dad." |
| Parent pays out | Parent taps "Mark given" → status='redeemed'. |
| No expiry | Treats don't expire. They sit in `available` until redeemed. |
| Treat substitution | Parent can edit `RewardGrant.treatId` between grant and redemption if kid picks something else. Logged via `parent_note`. |

### Why `treat` is its own type instead of a special wishlist item

Because the reward is *granted by goal completion* (e.g., "finish 5 lessons = ice cream" — kid doesn't need to request it, the grant appears). Wishlist items are *requested by kid* and cost credits. Different flows, different audit trails.

## Wishlist Approval + Anti-Spam Rules

**Two flows, two different control surfaces:**

| Flow | Trigger | Parent control |
|---|---|---|
| Goal-completed rewards (auto-grant) | Kid hits a goal → credits/treat/screen-time appears immediately | Parent controls *frequency* via goal design |
| Wishlist redemption (kid-initiated) | Kid taps an item → requests parent's approval to spend credits | Parent approves/denies each request. Anti-spam layer below. |

### Anti-spam defaults (parent-configurable per household)

| Rule | Default | Range |
|---|---|---|
| Max pending requests at once | 1 | 1-5 |
| Cooldown after a denied request (same item) | 24 hours | configurable |
| Cooldown after an approved request (any item) | 12 hours | configurable |
| Max approved redemptions per day | 2 | 1-5 |
| "Request something not listed" rate limit | 1 per 3 days | configurable |

### What happens when limits are hit

- **Pending cap hit** → kid sees "You already have a request waiting. Ask mom/dad about that one first."
- **Per-item cooldown after denial** → item card shows "Try again in 23h" countdown
- **Approved-redemption cooldown** → "You just got something! Wait until after dinner to ask again."
- **Free-text request cooldown** → "Save your request — try again in 3 days"

### Kid-visible "waiting" state

When kid submits a request, the wishlist screen immediately shows the request as pending. If parent denies, kid sees the parent's note verbatim. Without this feedback loop, the kid just keeps re-requesting.

### Audit trail

Every approval/denial writes a `WishlistRedemption` row with status transitions preserved (`pending → approved|denied|cancelled`). Minimum fields: who decided, when, what, parent note. COPPA-defensible.

## UX Surfaces

### New screens

| Screen | Audience | Purpose |
|---|---|---|
| `GoalsDashboardScreen` | Parent | Household-wide view: today's goals per kid, this-week rollups |
| `GoalSetupScreen` | Parent | Configure a single goal: metric, threshold, cadence, reward |
| `KidGoalsScreen` | Kid | Today's active goals with progress bars + earned rewards + weekly rollup |
| `WishlistScreen` | Kid | Catalog browsing, balance display, request submission, history |
| `WishlistAdminScreen` | Parent | Catalog management + pending requests inbox + rate-limit config |
| `TreatsCatalogScreen` | Parent | Define available treats (used as goal rewards) |
| `GoalCompleteToast` | Kid | Ephemeral 3-second overlay on goal completion |

### Modified screens

| Screen | Modification |
|---|---|
| `HouseholdSettingsScreen` | Add "Goals & Rewards" entry → `GoalsDashboardScreen` |
| `HouseholdMemberScreen` | Show today's progress inline above existing member details |
| `PlayerDashboard` | Add "Goals today" pill in top bar → `KidGoalsScreen` |
| `WhoIsPlayingScreen` | Below each kid's avatar, show today's credit balance |
| `TopBar` | Bell icon shows unread notifications (goal completed, treat available, etc.) |
| `SubscriptionPage` | No change (goals are free, included with household plan) |

## Realtime, Cross-Device, Notifications

### Realtime channels (existing infra)

lq-core already has a WebSocket-based realtime channel powering multi-device sync. Goals ride the same channel.

| Event on wire | Kid view | Parent view |
|---|---|---|
| `goal.progress_updated` (member_id, goal_id, new_value) | Progress bar animates | Today's card updates |
| `goal.completed` (member_id, goal_id, grant_id) | Celebratory toast + "Earned today" card | Toast on dashboard + push notification |
| `reward_grant.redeemed` (grant_id, by_player_id) | Card transitions to "used" | Audit log entry |
| `wishlist_redemption.requested` (request_id) | Card shows "waiting for mom/dad" | Push notification + pending inbox updates |
| `wishlist_redemption.decided` (request_id, decision, parent_note) | Card shows approved/denied with note | Audit log entry |
| `streak.broken` (member_id, lost_streak) | Tomorrow's progress bar resets, no red text | (no notification — silent) |

### Cross-device invariants

1. **Goals are household-shared state.** If mom sets a new goal on her phone, dad's tablet sees it within ~1s via realtime. Both can manage; UI shows "(edited by Maria 2 min ago)" hint to prevent stomping.
2. **Credit balance is household-shared.** All parents see the same balance. All redemptions are visible to all parents in the household.
3. **Goal progress is per-member, not per-device.** If Emma logs 30 min on iPad then 10 min on phone, both contribute to the same `GoalEvaluation.currentValue`. Activity events carry `memberId`, not `deviceId`.
4. **Ghost-kid identity flows from session.** When parent picks "Lucas is playing" on the picker, `active_member_id` is written to session storage. All subsequent activity events from that session are tagged with `member_id=Lucas`. Logout / picker change clears it.

### Notification delivery rules

| Recipient | Channel |
|---|---|
| Parent (any device, any parent in household) | Push notification + email digest if push disabled |
| Kid | In-app realtime update ONLY (no push, no email — kid's email may not exist for ghost accounts) |
| Co-parent | Same as parent — both get push notifications independently |

**Notification batching:** Goal-completion notifications are batched per 5-minute window by default. If Emma hits 3 goals in 5 minutes, parent gets one push: "Emma hit 3 goals — earned 9 credits, 30 min Roblox, ice cream". Configurable per-household ("instant" vs "batched").

### Offline behavior

- **Kid's app offline** → activity events queue in local outbox, sync when online. Evaluator catches up when events flush. Kid sees stale progress until sync.
- **Parent offline** → dashboard shows "Last updated 12 min ago" badge until reconnect.
- **Network drop mid-evaluation** → grant insert is atomic with `evaluation.isCompleted=true` flip; either both happened or neither did.

### Time zones

- "Daily" / "Weekly" period boundaries use the household's configured timezone (default: parent's account timezone at household creation).
- If household moves time zones, periods don't retroactively shift — they continue from creation-time timezone until parent explicitly updates household TZ, at which point the *next* period uses the new TZ.

## Migration

### Single migration file: `0008_household_goals.sql`

```sql
-- 1. Goals
CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES household_members(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  metric TEXT NOT NULL CHECK (metric IN ('time', 'lessons', 'xp', 'streak')),
  operator TEXT NOT NULL DEFAULT '>=' CHECK (operator IN ('>=')),
  threshold NUMERIC NOT NULL CHECK (threshold > 0),
  cadence TEXT NOT NULL CHECK (cadence IN ('daily', 'weekly', 'custom')),
  custom_period_days INT CHECK (custom_period_days > 0),
  active_from DATE,
  expires_at DATE,
  reward_type TEXT NOT NULL CHECK (reward_type IN ('credits', 'screen_time', 'treat')),
  reward_amount NUMERIC NOT NULL CHECK (reward_amount > 0),
  reward_treat_id UUID,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((cadence = 'custom' AND custom_period_days IS NOT NULL)
      OR (cadence != 'custom' AND custom_period_days IS NULL))
);
CREATE INDEX idx_goals_household_member ON goals(household_id, member_id, status);
CREATE INDEX idx_goals_member_active ON goals(member_id) WHERE status = 'active';

-- 2. Goal evaluations (current-period progress, one row per goal per period)
CREATE TABLE goal_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES household_members(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  current_value NUMERIC NOT NULL DEFAULT 0,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  last_evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (goal_id, period_start)
);
CREATE INDEX idx_goal_evaluations_member_active
  ON goal_evaluations(member_id, is_completed)
  WHERE is_completed = FALSE;
CREATE INDEX idx_goal_evaluations_period
  ON goal_evaluations(period_end);

-- 3. Reward grants (immutable ledger)
CREATE TABLE reward_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES household_members(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
  reason TEXT NOT NULL CHECK (reason IN ('goal_completed', 'manual_adjustment')),
  reward_type TEXT NOT NULL CHECK (reward_type IN ('credits', 'screen_time', 'treat')),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  treat_id UUID,
  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'redeemed', 'expired', 'cancelled')),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  redeemed_at TIMESTAMPTZ,
  redeemed_by TEXT REFERENCES players(id),
  expires_at TIMESTAMPTZ,
  parent_note TEXT
);
CREATE INDEX idx_reward_grants_member
  ON reward_grants(member_id, status, granted_at DESC);
CREATE INDEX idx_reward_grants_household_pending
  ON reward_grants(household_id, status) WHERE status = 'available';

-- 4. Wishlist catalog (per-household)
CREATE TABLE wishlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  credit_cost NUMERIC NOT NULL CHECK (credit_cost > 0),
  icon_key TEXT,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_wishlist_items_household ON wishlist_items(household_id, status);

-- 5. Wishlist redemptions (kid requests, parent approves)
CREATE TABLE wishlist_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wishlist_item_id UUID REFERENCES wishlist_items(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES household_members(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  is_open_request BOOLEAN NOT NULL DEFAULT FALSE,
  open_request_text TEXT,
  credits_requested NUMERIC NOT NULL CHECK (credits_requested > 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'denied', 'cancelled')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ,
  decided_by TEXT REFERENCES players(id),
  parent_note TEXT,
  CHECK ((is_open_request = TRUE AND open_request_text IS NOT NULL)
      OR (is_open_request = FALSE AND wishlist_item_id IS NOT NULL))
);
CREATE INDEX idx_wishlist_redemptions_household_status
  ON wishlist_redemptions(household_id, status, requested_at DESC);
CREATE INDEX idx_wishlist_redemptions_member
  ON wishlist_redemptions(member_id, status);

-- 6. Household goals configuration (rate-limit rules — one row per household)
CREATE TABLE household_goals_config (
  household_id UUID PRIMARY KEY REFERENCES households(id) ON DELETE CASCADE,
  max_pending_requests INT NOT NULL DEFAULT 1 CHECK (max_pending_requests BETWEEN 1 AND 5),
  cooldown_after_denial_hours INT NOT NULL DEFAULT 24,
  cooldown_after_approval_hours INT NOT NULL DEFAULT 12,
  max_approved_per_day INT NOT NULL DEFAULT 2 CHECK (max_approved_per_day BETWEEN 1 AND 5),
  open_request_cooldown_days INT NOT NULL DEFAULT 3,
  notification_mode TEXT NOT NULL DEFAULT 'batched' CHECK (notification_mode IN ('instant', 'batched')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### What this migration does NOT do

- **No changes to existing `Player`, `Player.subscription`, `households`, `household_members`, `household_invites`** tables — pure additive migration
- **No backfill** — all tables start empty; existing households see no goals until owner opts in
- **No data dependencies on existing activity tables** — the goal evaluator reads from the existing player-activity event stream, not from any new tracking table

## Error Handling

| Failure | UX behavior |
|---|---|
| Goal evaluator crashes mid-batch | Activity events re-queue via existing outbox. Goal progress may lag up to 30s. No data loss. |
| Concurrent grant attempt (same goal, two events) | Atomic check-then-set on `is_completed`. Second event finds `is_completed=true` and no-ops. Idempotent. |
| Reward grant fails after `is_completed=true` flipped | Transaction rolls back both. Goal stays incomplete. Kid does NOT see a phantom reward. |
| Wishlist redemption for an item the kid can no longer afford (price changed after request) | On approval, re-check balance. If insufficient, parent sees "Emma's balance dropped below 20 credits since she requested. Approve anyway (negative balance) or deny?" |
| Goal deleted while kid is mid-period | Existing `GoalEvaluation` rows are cascade-deleted with the goal. No orphaned state. |
| Household dissolved mid-period | All goals/rewards/wishlist cascade-delete with household. Members revert to no-goal state. No recovery. |
| Streak event lost (rare — only if event bus down at midnight) | Streak goal simply doesn't progress that day. Tomorrow's check will catch up if the event was queued. Worst case: 1-day streak loss, kid/parent can manually re-fire streak check via parent UI. |
| Parent timezone change mid-period | In-progress period keeps old TZ boundary. New periods use new TZ. No retroactive period re-splitting. |
| Manual balance correction | Parent issues via admin UI → inserts `RewardGrant{reason: 'manual_adjustment', amount: ±N}`. Kid sees updated balance next realtime tick. Audit trail preserved. |

## Testing Strategy

### Unit tests (`libs/app/household-goals/tests`)

```
goalEvaluator.spec.ts
  - time goal: 30min target, receives session.ended(18min), progress = 18, not complete
  - time goal: receives second session.ended(15min), progress = 33, completes
  - lessons goal: 5 lessons, receives 5 lesson.completed events, completes on 5th
  - xp goal: 100 XP, lesson carries +20 XP each, completes on 5th
  - streak goal: receives streak.maintained(7), completes
  - daily period rollover: now > period_end, new event creates new evaluation
  - custom period: 3-day cycle, verifies period boundaries
  - idempotency: same event delivered twice, no double-grant
  - reward already granted: event arrives post-completion, no second grant
  - cascade: goal deleted, subsequent event for that goal_id is no-op

rewardGrantService.spec.ts
  - credits grant: inserts RewardGrant, balance increases by amount
  - screen_time grant: respects expiresAt
  - treat grant: linked to wishlist item
  - concurrent grant attempts on same goal: only one succeeds

wishlistService.spec.ts
  - request: respects pending cap
  - request: respects per-item denial cooldown
  - approve: deducts from balance
  - deny: no balance change
  - cancel within 1h: reverts balance
  - balance computation: matches SUM(grants WHERE status='available') - SUM(approved redemptions.creditsRequested)

householdGoalsConfig.spec.ts
  - default values applied
  - validation on out-of-range values
```

### Integration tests (postgres-backed)

```
goal_lifecycle.spec.ts
  - household created → member added → goal created → activity events fired → goal completes → grant inserted → balance reflects grant

wishlist_redemption_flow.spec.ts
  - parent sets up catalog → kid earns credits → kid requests → parent approves → balance decremented → audit row inserted

cooldown_enforcement.spec.ts
  - kid denied → tries same item immediately → blocked
  - kid denied → time-travels past cooldown → request succeeds
```

### E2E tests (Playwright, per lang-quest repo)

```
tests/household-goals.spec.ts
  - parent creates daily "5 lessons" goal with screen-time reward
  - kid logs in, completes 4 lessons → goal shows 4/5
  - kid completes 5th lesson → celebratory toast appears, parent push fires
  - parent marks screen-time redeemed → kid view shows "used"
  - parent creates wishlist item, kid requests, parent approves, balance drops
  - kid denied, tries same item again immediately → "try again in 24h" shown
```

### Manual QA scenarios

- COPPA ghost kid: parent adds 6yo ghost Lucas, sets 30min reading goal, verifies realtime works through parent's session
- Multi-parent: mom and dad both see same kid's goals and grants, both can approve redemptions
- Time-zone edge: household in PST, kid plays at 11:55 PM, completes goal at 12:05 AM (next day in PST), verify period transitions correctly
- Streak recovery: kid missed yesterday, parent wants to manually restore streak (admin override)

## Out of Scope (Future Features)

- Native screen-time APIs (Apple Family Controls, Google Family Link) — already deferred in family-profile spec; this design supports the status-flag model only
- Cross-household rewards (kid plays at friend's house, those goals count too)
- Group goals (whole household hits combined 100 lessons for a family trip)
- Goal templates (Duolingo-style "language learner" preset bundles)
- Real-money allowance — explicitly excluded per decisions table
- Leaderboards between siblings — could be motivating or toxic; defer until we have usage data
- AI-suggested goals (system proposes goals based on kid's pace)
- Goal streaks on goal-completion itself (kid has maintained 7-day goal-completion streak)
- Wishlist gift economy (kid A gifts credits to kid B in same household)
- Negative credits (kid goes into "debt" if wishlist balance overdraws) — partially supported via `manual_adjustment` grants; defer formalization

## Open Questions Deferred to Implementation

1. Should `goal.threshold` for `streak` metric count current streak length or *consecutive days hit*? (Current design: current streak length. Could revisit.)
2. Should `expires_at` on screen-time grants be configurable per-goal or per-household? (Current design: per-goal toggle in setup screen.)
3. Should treat `WishlistItem` and reward `WishlistItem` be the same table or separate? (Current design: same table — treats can be both granted as goal rewards and requested via wishlist.)

## Implementation Phases (high-level)

This design is intended to be implemented in a single multi-week effort. A future plan (writing-plans skill output) will break it into tasks with test cases per task. The rough phases:

1. **Data layer (week 1):** SQL migration, drizzle schema, household-goals repositories, `household_goals_config` defaults
2. **Goal engine (week 1-2):** `goalEvaluator`, `rewardGrantService`, activity event handlers, idempotency, period rollover, unit tests
3. **Service layer (week 2):** `goalService`, `wishlistService`, anti-spam rules, balance computation, integration tests
4. **API layer (week 2):** REST endpoints for goals CRUD, wishlist CRUD, redemption requests/decisions, manual balance adjustments
5. **Parent UI (week 3):** `GoalsDashboardScreen`, `GoalSetupScreen`, `WishlistAdminScreen`, `TreatsCatalogScreen`; modify `HouseholdSettingsScreen` + `HouseholdMemberScreen`
6. **Kid UI + realtime (week 3):** `KidGoalsScreen`, `WishlistScreen`, `GoalCompleteToast`; realtime channel wiring for all 6 event types; modify `PlayerDashboard`, `WhoIsPlayingScreen`, `TopBar`
7. **Notifications + polish (week 4):** Push notification batching, audit trail review, anti-spam enforcement, timezone edge cases, E2E suite
8. **Cross-repo rollout (week 4):** i18n strings to all 59 language JSONs, per-lang-quest repo smoke tests, shared `lq-tools/scripts/e2e/household-goals-suite.ts` runner

### Cross-repo impact

This feature, like the family-profile feature, lives once in `lq-core` and ships to all 14 `lang-quest` apps via `@learnquest/*` packages. The 14 lang-quest apps get:
- New screens via `libs/screens/household-goals` exports
- New DB tables via shared Drizzle schema migration
- New services via `libs/app/household-goals` exports
- New i18n strings (~30 keys) to all 59 language JSONs

Per-app smoke tests get a `tests/household-goals.spec.ts` with a shared scenario runner.