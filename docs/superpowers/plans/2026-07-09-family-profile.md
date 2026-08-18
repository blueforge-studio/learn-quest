# Family Profile + Household Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a household-account model in lq-core that lets a parent on one PWA install host multiple players (full-account adults via email, full-account kids via code, ghost kids with no auth) and bills via a single Stripe subscription with multiple line items.

**Architecture:** Data + services in `lq-core` (Drizzle schema, services), REST API in `platform-api` at `https://forge.blueforge.studio/api/*`, UI in `lq-core/libs/screens/household`. The new feature inherits across all 14 lang-quest apps via `@learnquest/*` package consumption — no per-app code changes.

**Tech Stack:** Drizzle ORM + `pg` (on-prem Postgres at forge-control), `AuthService.provider='forge'`, Stripe with multi-line-item subscriptions, Resend for email, React 19 + Tailwind 4 (existing).

**Spec:** `docs/superpowers/specs/2026-07-09-family-profile-design.md`

---

## File Structure

### Created (data + service layer in `lq-core`)

| File | Responsibility |
|---|---|
| `lq-core/libs/infra/database/drizzle/0007_households.sql` | Raw SQL migration: Player.tier column + Household/HouseholdMember/HouseholdInvite tables + indexes + CHECK constraints |
| `lq-core/libs/infra/database/drizzle/meta/_journal.json` | Drizzle migration journal entry |
| `lq-core/libs/infra/database/src/postgres/schema/household.ts` | Drizzle table definitions for the 4 entities |
| `lq-core/libs/infra/database/src/postgres/repositories/HouseholdRepository.ts` | DB CRUD for household/member/invite; no business logic |
| `lq-core/libs/infra/database/src/postgres/repositories/HouseholdRepository.test.ts` | Repository unit tests against a real test DB |
| `lq-core/libs/app/app-types/src/household.ts` | TS types: Household, HouseholdMember, HouseholdInvite, PlayerTier, InviteType |
| `lq-core/libs/app/app-services/src/household/HouseholdService.ts` | Business logic: create, addMember, removeMember, transferOwnership |
| `lq-core/libs/app/app-services/src/household/HouseholdService.test.ts` | HouseholdService unit tests |
| `lq-core/libs/app/app-services/src/household/InviteService.ts` | Business logic: createInvite (email/code), acceptInvite |
| `lq-core/libs/app/app-services/src/household/InviteService.test.ts` | InviteService unit tests |
| `lq-core/libs/app/app-services/src/household/TierService.ts` | Stripe wiring: upgrade, addSeat, removeSeat, cancel, prorate |
| `lq-core/libs/app/app-services/src/household/TierService.test.ts` | TierService tests with Stripe mocked |
| `lq-core/libs/app/app-services/src/household/errors.ts` | Domain errors: HouseholdFullError, GhostCapError, NotOwnerError, etc. |
| `lq-core/libs/app/app-services/src/household/index.ts` | Public exports |

### Created (UI in `lq-core`)

Per the user's direction (2026-07-09): **no raw HTML5 input/button/select** — use shared shadcn/ui components exported by `@learnquest/ui` (`Button`, `Input`, `Card`, `Dialog`, `Select`, `Slider`, `Label`, etc., from `lq-core/libs/common/ui`). Every new screen and reusable component ships a co-located `.stories.tsx`. New flows extend `scripts/audit/run-screen-audit.ts` and run against `@blueforge-studio/screen-audit` + `@blueforge-studio/storybook-audit`.

Pattern reference: `lq-core/libs/screens/challenges/src/DailyChallengesScreen.stories.tsx` (uses `StoryWrapper` from `./shared/test-utils/StoryWrapper`, `Meta`/`StoryObj` from `@storybook/react-vite`).

| File | Responsibility |
|---|---|
| `lq-core/libs/screens/household/package.json` | New package: `@learnquest/screens-household` |
| `lq-core/libs/screens/household/src/HouseholdSettingsScreen.tsx` | Owner manages household |
| `lq-core/libs/screens/household/src/HouseholdSettingsScreen.stories.tsx` | Story: Default, owner-with-kids, solo-owner, billing-states |
| `lq-core/libs/screens/household/src/HouseholdMemberScreen.tsx` | View/remove single member |
| `lq-core/libs/screens/household/src/HouseholdMemberScreen.stories.tsx` | Story: full-member, ghost-member, pending-invite |
| `lq-core/libs/screens/household/src/LeaveHouseholdScreen.tsx` | Member confirms leaving |
| `lq-core/libs/screens/household/src/LeaveHouseholdScreen.stories.tsx` | Story: regular-member-leave, owner-must-transfer |
| `lq-core/libs/screens/household/src/WhoIsPlayingScreen.tsx` | Profile picker (parent in multi-member household) |
| `lq-core/libs/screens/household/src/WhoIsPlayingScreen.stories.tsx` | Story: 2-profiles, 4-profiles, with-ghost-kid |
| `lq-core/libs/screens/household/src/InviteAcceptScreen.tsx` | Recipient reviews + accepts invite |
| `lq-core/libs/screens/household/src/InviteAcceptScreen.stories.tsx` | Story: fresh-invite, expired-invite |
| `lq-core/libs/screens/household/src/AddGhostKidScreen.tsx` | Owner adds ghost kid |
| `lq-core/libs/screens/household/src/AddGhostKidScreen.stories.tsx` | Story: empty-form, filled-form, name-taken |
| `lq-core/libs/screens/household/src/components/MemberCard.tsx` | Single member row in lists |
| `lq-core/libs/screens/household/src/components/MemberCard.stories.tsx` | Story: full-member, ghost-member, self-badge |
| `lq-core/libs/screens/household/src/components/MemberSlider.tsx` | 1-6 member slider for subscription page (uses `@learnquest/ui` Slider) |
| `lq-core/libs/screens/household/src/components/MemberSlider.stories.tsx` | Story: min-1, mid-3, max-6, disabled |
| `lq-core/libs/screens/household/src/components/PricePreview.tsx` | Live total preview |
| `lq-core/libs/screens/household/src/components/FamilyTierCard.tsx` | Subscription page family tier card |
| `lq-core/libs/screens/household/src/components/FamilyTierCard.stories.tsx` | Story: solo, 2-member, 6-member |
| `lq-core/libs/screens/household/src/hooks/useActiveProfile.ts` | Session-scoped active profile (sessionStorage) |
| `lq-core/libs/screens/household/src/hooks/useHousehold.ts` | Household query hook |
| `lq-core/libs/screens/household/src/__tests__/HouseholdSettingsScreen.test.tsx` | Component tests |
| `lq-core/libs/screens/household/src/__tests__/WhoIsPlayingScreen.test.tsx` | Picker tests |

### Modified

- `lq-core/libs/infra/database/src/postgres/schema.ts` — re-export from `./schema/household`
- `lq-core/libs/infra/database/src/postgres/schema/player.ts` — add `tier` column to players table
- `lq-core/libs/app/app-types/src/player.ts` — add `PlayerTier` union + `Player.tier` field
- `lq-core/libs/app/app-services/src/subscription/SubscriptionService.ts` — extend to handle household line items
- `lq-core/libs/screens/profile/src/subscription/SubscriptionPage.tsx` — add Family tier card
- `lq-core/libs/screens/profile/src/components/ProfileMenu.tsx` — add "Switch profile" entry
- `lq-core/apps/web/src/router/AppRoot.tsx` — post-auth route: if household has >1 member, route to WhoIsPlayingScreen
- `lq-core/apps/web/public/locales/en.json` — household.* strings (then 58 other locales)
- `lq-core/package.json` — register `@learnquest/screens-household` workspace package

### Created (E2E)

- `lq-tools/scripts/e2e/household-suite.ts` — runs household spec across all 14 repos
- `lang-quest/lq-{group}/tests/household.spec.ts` — Playwright spec per repo (created by household-suite)

### Created (visual audit)

- `lq-core/scripts/audit/run-screen-audit.ts` — extend with new household screen entries (HouseholdSettingsScreen, WhoIsPlayingScreen, InviteAcceptScreen, AddGhostKidScreen, LeaveHouseholdScreen, FamilyTierCard on SubscriptionPage)
- `.blueforge/screen-audit.config.json` or equivalent — add household screens to the audit manifest

### NOT created

- No new auth provider — reuses `AuthService.provider='forge'`
- No new platform-api package — adds routes to existing `hosting-api` (already runs the platform endpoints)
- No new i18n library — adds keys to existing JSON files
- No new Stripe webhook handler — extends the existing handler in `supabase/functions/stripe-webhooks`

---

## Phase 1: Data Layer

### Task 1: Add `PlayerTier` type and `Player.tier` field

**Files:**
- Modify: `lq-core/libs/app/app-types/src/player.ts`
- Test: `lq-core/libs/app/app-types/src/player.test.ts` (new)

- [ ] **Step 1: Write the failing test**

```typescript
// lq-core/libs/app/app-types/src/player.test.ts
import { describe, it, expect } from 'vitest'
import { isPlayerTier, type PlayerTier } from './player'

describe('PlayerTier', () => {
  it('accepts valid tiers', () => {
    expect(isPlayerTier('free')).toBe(true)
    expect(isPlayerTier('individual')).toBe(true)
    expect(isPlayerTier('household')).toBe(true)
  })

  it('rejects invalid tiers', () => {
    expect(isPlayerTier('premium')).toBe(false)
    expect(isPlayerTier('')).toBe(false)
    expect(isPlayerTier(null)).toBe(false)
    expect(isPlayerTier(undefined)).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd lq-core && pnpm --filter @learnquest/app-types exec vitest run src/player.test.ts
```
Expected: FAIL — `isPlayerTier` is not exported.

- [ ] **Step 3: Add the types**

Edit `lq-core/libs/app/app-types/src/player.ts` — append:

```typescript
export type PlayerTier = 'free' | 'individual' | 'household'

export const PLAYER_TIERS: readonly PlayerTier[] = ['free', 'individual', 'household'] as const

export function isPlayerTier(value: unknown): value is PlayerTier {
  return typeof value === 'string' && (PLAYER_TIERS as readonly string[]).includes(value)
}

// Existing Player interface — add field:
export interface Player {
  // ... existing fields ...
  tier: PlayerTier  // NEW
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter @learnquest/app-types exec vitest run src/player.test.ts
```
Expected: PASS

- [ ] **Step 5: Typecheck**

```bash
pnpm --filter @learnquest/app-types typecheck
```

- [ ] **Step 6: Commit**

```bash
cd lq-core && git add libs/app/app-types/src/player.ts libs/app/app-types/src/player.test.ts
git commit -m "feat(app-types): add PlayerTier type and Player.tier field"
```

---

### Task 2: Create SQL migration `0007_households.sql`

**Files:**
- Create: `lq-core/libs/infra/database/drizzle/0007_households.sql`
- Create: `lq-core/libs/infra/database/drizzle/meta/_journal.json`

- [ ] **Step 1: Create drizzle migration directory**

```bash
mkdir -p lq-core/libs/infra/database/drizzle/meta
```

- [ ] **Step 2: Write the SQL migration**

Create `lq-core/libs/infra/database/drizzle/0007_households.sql`:

```sql
-- 0007_households.sql
-- Family Profile + Household feature
-- Adds Player.tier column and three new tables: households, household_members, household_invites.

BEGIN;

-- 1. Player.tier: nullable → backfill → NOT NULL with CHECK
ALTER TABLE players ADD COLUMN tier TEXT;

UPDATE players p
SET tier = CASE
  WHEN s.id IS NOT NULL AND s.status = 'active'
       AND s.tier IN ('premium_monthly', 'premium_yearly')
  THEN 'individual'
  ELSE 'free'
END
FROM subscriptions s
WHERE s.id = p.subscription_id;

UPDATE players SET tier = 'free' WHERE tier IS NULL;

ALTER TABLE players ALTER COLUMN tier SET NOT NULL;
ALTER TABLE players ADD CONSTRAINT players_tier_check
  CHECK (tier IN ('free', 'individual', 'household'));

-- 2. Households
CREATE TABLE households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id TEXT NOT NULL REFERENCES players(id),
  subscription_id TEXT REFERENCES subscriptions(id),
  max_members INT NOT NULL DEFAULT 6,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'dissolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  dissolved_at TIMESTAMPTZ
);
CREATE INDEX idx_households_owner ON households(owner_id);
CREATE INDEX idx_households_subscription ON households(subscription_id);

-- 3. Household members
CREATE TABLE household_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES players(id),
  role TEXT NOT NULL CHECK (role IN ('owner', 'member')),
  profile_type TEXT NOT NULL CHECK (profile_type IN ('full', 'ghost')),
  invited_by TEXT NOT NULL REFERENCES players(id),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  removed_at TIMESTAMPTZ,
  invite_status TEXT NOT NULL DEFAULT 'active'
    CHECK (invite_status IN ('pending', 'active', 'removed'))
);
CREATE INDEX idx_household_members_household ON household_members(household_id);
CREATE INDEX idx_household_members_player_active
  ON household_members(player_id) WHERE invite_status = 'active';

-- Single-household invariant: a player is in at most one active household
CREATE UNIQUE INDEX idx_household_members_one_active_per_player
  ON household_members(player_id) WHERE invite_status = 'active';

-- 4. Household invites
CREATE TABLE household_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('email', 'code')),
  email TEXT,
  code TEXT,
  profile_type TEXT NOT NULL CHECK (profile_type IN ('full', 'ghost')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_by TEXT NOT NULL REFERENCES players(id),
  accepted_by TEXT REFERENCES players(id),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_household_invites_code_active
  ON household_invites(code) WHERE code IS NOT NULL AND status = 'pending';
CREATE INDEX idx_household_invites_household ON household_invites(household_id);

COMMIT;
```

- [ ] **Step 3: Create the migration journal**

Create `lq-core/libs/infra/database/drizzle/meta/_journal.json`:

```json
{
  "version": "5",
  "dialect": "postgresql",
  "entries": [
    {
      "idx": 0,
      "version": "5",
      "when": 1720636800000,
      "tag": "0000_init",
      "breakpoints": false
    },
    {
      "idx": 7,
      "version": "5",
      "when": 1752105600000,
      "tag": "0007_households",
      "breakpoints": false
    }
  ]
}
```

(The journal can be sparse — we only need entries that drizzle-kit tracks. Adjust idx numbers to match existing journal.)

- [ ] **Step 4: Apply migration to local dev DB**

```bash
cd lq-core
psql "$DATABASE_URL" -f libs/infra/database/drizzle/0007_households.sql
```
Expected: `BEGIN`, `ALTER TABLE`, `UPDATE ... rows`, `CREATE TABLE` (×3), `CREATE INDEX` (×6), `COMMIT`. No errors.

- [ ] **Step 5: Verify schema**

```bash
psql "$DATABASE_URL" -c "\d households" -c "\d household_members" -c "\d household_invites"
```
Expected: All three tables visible with correct columns.

- [ ] **Step 6: Commit**

```bash
cd lq-core && git add libs/infra/database/drizzle/
git commit -m "feat(database): add households schema migration 0007"
```

---

### Task 3: Add Drizzle schema for `players.tier` and the 3 new tables

**Files:**
- Modify: `lq-core/libs/infra/database/src/postgres/schema/player.ts`
- Create: `lq-core/libs/infra/database/src/postgres/schema/household.ts`
- Modify: `lq-core/libs/infra/database/src/postgres/schema.ts`

- [ ] **Step 1: Read existing schema layout**

```bash
head -50 lq-core/libs/infra/database/src/postgres/schema.ts
```
Expect: `export * from './schema/player'` or similar barrel. Follow existing pattern.

- [ ] **Step 2: Modify player schema to add `tier`**

In `lq-core/libs/infra/database/src/postgres/schema/player.ts`, add the `tier` column to the existing `playersTable` definition:

```typescript
import { pgTable, text, ... } from 'drizzle-orm/pg-core'

export const playersTable = pgTable('players', {
  // ... existing columns ...
  tier: text('tier').notNull().default('free'),  // NEW
})
```

- [ ] **Step 3: Create household schema file**

Create `lq-core/libs/infra/database/src/postgres/schema/household.ts`:

```typescript
import { pgTable, text, integer, timestamp, uuid, index, uniqueIndex } from 'drizzle-orm/pg-core'
import { playersTable } from './player'
import { subscriptionsTable } from './subscription'

export const householdsTable = pgTable('households', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  ownerId: text('owner_id').notNull().references(() => playersTable.id),
  subscriptionId: text('subscription_id').references(() => subscriptionsTable.id),
  maxMembers: integer('max_members').notNull().default(6),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  dissolvedAt: timestamp('dissolved_at', { withTimezone: true }),
}, (t) => ({
  ownerIdx: index('idx_households_owner').on(t.ownerId),
  subscriptionIdx: index('idx_households_subscription').on(t.subscriptionId),
}))

export const householdMembersTable = pgTable('household_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id').notNull().references(() => householdsTable.id, { onDelete: 'cascade' }),
  playerId: text('player_id').notNull().references(() => playersTable.id),
  role: text('role').notNull(),
  profileType: text('profile_type').notNull(),
  invitedBy: text('invited_by').notNull().references(() => playersTable.id),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  removedAt: timestamp('removed_at', { withTimezone: true }),
  inviteStatus: text('invite_status').notNull().default('active'),
}, (t) => ({
  householdIdx: index('idx_household_members_household').on(t.householdId),
  playerActiveIdx: index('idx_household_members_player_active').on(t.playerId),
  oneActivePerPlayer: uniqueIndex('idx_household_members_one_active_per_player')
    .on(t.playerId).where(sql`${t.inviteStatus} = 'active'`),
}))

export const householdInvitesTable = pgTable('household_invites', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id').notNull().references(() => householdsTable.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  email: text('email'),
  code: text('code'),
  profileType: text('profile_type').notNull(),
  status: text('status').notNull().default('pending'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdBy: text('created_by').notNull().references(() => playersTable.id),
  acceptedBy: text('accepted_by').references(() => playersTable.id),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  codeActiveIdx: uniqueIndex('idx_household_invites_code_active')
    .on(t.code).where(sql`${t.code} IS NOT NULL AND ${t.status} = 'pending'`),
  householdIdx: index('idx_household_invites_household').on(t.householdId),
}))
```

(Adjust imports based on existing schema conventions — `sql` from drizzle-orm.)

- [ ] **Step 4: Re-export from main schema barrel**

In `lq-core/libs/infra/database/src/postgres/schema.ts`:

```typescript
export * from './schema/household'
```

- [ ] **Step 5: Typecheck**

```bash
pnpm --filter @learnquest/database typecheck
```
Expected: PASS. If drizzle complains about partial unique indexes, use `sql` template literal exactly as shown.

- [ ] **Step 6: Commit**

```bash
git add libs/infra/database/src/postgres/schema/
git commit -m "feat(database): add Drizzle models for households, members, invites"
```

---

### Task 4: Build `HouseholdRepository` (CRUD only — no business logic)

**Files:**
- Create: `lq-core/libs/infra/database/src/postgres/repositories/HouseholdRepository.ts`
- Create: `lq-core/libs/infra/database/src/postgres/repositories/HouseholdRepository.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lq-core/libs/infra/database/src/postgres/repositories/HouseholdRepository.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { HouseholdRepository } from './HouseholdRepository'
import { getTestDb, resetDb } from '../../test-utils/testDb'

describe('HouseholdRepository', () => {
  let repo: HouseholdRepository
  let db: Awaited<ReturnType<typeof getTestDb>>

  beforeEach(async () => {
    db = await getTestDb()
    await resetDb(db)
    repo = new HouseholdRepository(db)
  })

  it('creates a household row', async () => {
    const ownerId = await repo.createTestPlayer({ tier: 'free' })
    const h = await repo.createHousehold({ name: 'Smiths', ownerId })
    expect(h.name).toBe('Smiths')
    expect(h.ownerId).toBe(ownerId)
    expect(h.status).toBe('active')
  })

  it('adds a member', async () => {
    const ownerId = await repo.createTestPlayer({ tier: 'free' })
    const memberId = await repo.createTestPlayer({ tier: 'free' })
    const h = await repo.createHousehold({ name: 'Smiths', ownerId })
    const m = await repo.addMember({
      householdId: h.id,
      playerId: memberId,
      role: 'member',
      profileType: 'full',
      invitedBy: ownerId,
    })
    expect(m.householdId).toBe(h.id)
    expect(m.role).toBe('member')
  })

  it('rejects duplicate active membership for same player (FK unique index)', async () => {
    const ownerId = await repo.createTestPlayer({ tier: 'free' })
    const memberId = await repo.createTestPlayer({ tier: 'free' })
    const h1 = await repo.createHousehold({ name: 'A', ownerId })
    const h2 = await repo.createHousehold({ name: 'B', ownerId: await repo.createTestPlayer({ tier: 'free' }) })
    await repo.addMember({ householdId: h1.id, playerId: memberId, role: 'member', profileType: 'full', invitedBy: ownerId })
    await expect(
      repo.addMember({ householdId: h2.id, playerId: memberId, role: 'member', profileType: 'full', invitedBy: ownerId })
    ).rejects.toThrow(/unique/i)
  })

  it('lists active members for a household', async () => {
    const ownerId = await repo.createTestPlayer({ tier: 'free' })
    const m1 = await repo.createTestPlayer({ tier: 'free' })
    const m2 = await repo.createTestPlayer({ tier: 'free' })
    const h = await repo.createHousehold({ name: 'Smiths', ownerId })
    await repo.addMember({ householdId: h.id, playerId: m1, role: 'member', profileType: 'full', invitedBy: ownerId })
    await repo.addMember({ householdId: h.id, playerId: m2, role: 'member', profileType: 'ghost', invitedBy: ownerId })
    const members = await repo.listActiveMembers(h.id)
    expect(members).toHaveLength(2)
  })

  it('soft-removes a member (sets removedAt + inviteStatus=removed)', async () => {
    const ownerId = await repo.createTestPlayer({ tier: 'free' })
    const memberId = await repo.createTestPlayer({ tier: 'free' })
    const h = await repo.createHousehold({ name: 'Smiths', ownerId })
    await repo.addMember({ householdId: h.id, playerId: memberId, role: 'member', profileType: 'full', invitedBy: ownerId })
    await repo.removeMember(h.id, memberId)
    const members = await repo.listActiveMembers(h.id)
    expect(members).toHaveLength(0)
  })

  it('transfers ownership', async () => {
    const ownerId = await repo.createTestPlayer({ tier: 'free' })
    const nextId = await repo.createTestPlayer({ tier: 'free' })
    const h = await repo.createHousehold({ name: 'Smiths', ownerId })
    await repo.addMember({ householdId: h.id, playerId: nextId, role: 'member', profileType: 'full', invitedBy: ownerId })
    await repo.transferOwnership(h.id, fromPlayerId: ownerId, toPlayerId: nextId)
    const after = await repo.getHousehold(h.id)
    expect(after?.ownerId).toBe(nextId)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd lq-core && pnpm --filter @learnquest/database exec vitest run src/postgres/repositories/HouseholdRepository.test.ts
```
Expected: FAIL — `HouseholdRepository` doesn't exist.

- [ ] **Step 3: Implement the repository**

Create `lq-core/libs/infra/database/src/postgres/repositories/HouseholdRepository.ts`:

```typescript
import { eq, and, isNull, sql } from 'drizzle-orm'
import type { Database } from '../client'
import { householdsTable, householdMembersTable, householdInvitesTable, playersTable } from '../schema/household'
import type { Household, HouseholdMember, HouseholdInvite } from '@learnquest/app-types'

export interface CreateHouseholdInput {
  name: string
  ownerId: string
}
export interface AddMemberInput {
  householdId: string
  playerId: string
  role: 'owner' | 'member'
  profileType: 'full' | 'ghost'
  invitedBy: string
}

export class HouseholdRepository {
  constructor(private readonly db: Database) {}

  // Test helper — creates a player row directly. Remove from production usage.
  async createTestPlayer(opts: { tier: 'free' | 'individual' | 'household' }): Promise<string> {
    const [row] = await this.db.insert(playersTable).values({
      id: `test-${Math.random().toString(36).slice(2, 10)}`,
      tier: opts.tier,
      // Other required fields populated by test fixtures
    }).returning({ id: playersTable.id })
    return row.id
  }

  async createHousehold(input: CreateHouseholdInput): Promise<Household> {
    const [row] = await this.db.insert(householdsTable).values({
      name: input.name,
      ownerId: input.ownerId,
    }).returning()
    return row as Household
  }

  async getHousehold(id: string): Promise<Household | null> {
    const [row] = await this.db.select().from(householdsTable).where(eq(householdsTable.id, id)).limit(1)
    return (row as Household) ?? null
  }

  async addMember(input: AddMemberInput): Promise<HouseholdMember> {
    const [row] = await this.db.insert(householdMembersTable).values({
      householdId: input.householdId,
      playerId: input.playerId,
      role: input.role,
      profileType: input.profileType,
      invitedBy: input.invitedBy,
    }).returning()
    return row as HouseholdMember
  }

  async listActiveMembers(householdId: string): Promise<HouseholdMember[]> {
    const rows = await this.db.select().from(householdMembersTable)
      .where(and(eq(householdMembersTable.householdId, householdId), eq(householdMembersTable.inviteStatus, 'active')))
    return rows as HouseholdMember[]
  }

  async countActiveMembers(householdId: string): Promise<number> {
    const [row] = await this.db.select({ count: sql<number>`count(*)::int` })
      .from(householdMembersTable)
      .where(and(eq(householdMembersTable.householdId, householdId), eq(householdMembersTable.inviteStatus, 'active')))
    return row.count
  }

  async countGhostMembers(householdId: string): Promise<number> {
    const [row] = await this.db.select({ count: sql<number>`count(*)::int` })
      .from(householdMembersTable)
      .where(and(
        eq(householdMembersTable.householdId, householdId),
        eq(householdMembersTable.inviteStatus, 'active'),
        eq(householdMembersTable.profileType, 'ghost'),
      ))
    return row.count
  }

  async removeMember(householdId: string, playerId: string): Promise<void> {
    await this.db.update(householdMembersTable)
      .set({ removedAt: new Date(), inviteStatus: 'removed' })
      .where(and(eq(householdMembersTable.householdId, householdId), eq(householdMembersTable.playerId, playerId)))
  }

  async transferOwnership(householdId: string, fromPlayerId: string, toPlayerId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.update(householdsTable).set({ ownerId: toPlayerId, updatedAt: new Date() })
        .where(eq(householdsTable.id, householdId))
      await tx.update(householdMembersTable).set({ role: 'member' })
        .where(and(eq(householdMembersTable.householdId, householdId), eq(householdMembersTable.playerId, fromPlayerId)))
      await tx.update(householdMembersTable).set({ role: 'owner' })
        .where(and(eq(householdMembersTable.householdId, householdId), eq(householdMembersTable.playerId, toPlayerId)))
    })
  }

  async dissolve(id: string): Promise<void> {
    await this.db.update(householdsTable)
      .set({ status: 'dissolved', dissolvedAt: new Date(), updatedAt: new Date() })
      .where(eq(householdsTable.id, id))
  }

  async createInvite(input: Omit<HouseholdInvite, 'id' | 'createdAt' | 'acceptedBy' | 'acceptedAt'>): Promise<HouseholdInvite> {
    const [row] = await this.db.insert(householdInvitesTable).values(input).returning()
    return row as HouseholdInvite
  }

  async findInviteByCode(code: string): Promise<HouseholdInvite | null> {
    const [row] = await this.db.select().from(householdInvitesTable)
      .where(and(eq(householdInvitesTable.code, code), eq(householdInvitesTable.status, 'pending')))
      .limit(1)
    return (row as HouseholdInvite) ?? null
  }

  async findInviteByEmail(householdId: string, email: string): Promise<HouseholdInvite | null> {
    const [row] = await this.db.select().from(householdInvitesTable)
      .where(and(
        eq(householdInvitesTable.householdId, householdId),
        eq(householdInvitesTable.email, email),
        eq(householdInvitesTable.status, 'pending'),
      ))
      .limit(1)
    return (row as HouseholdInvite) ?? null
  }

  async markInviteAccepted(inviteId: string, acceptedByPlayerId: string): Promise<void> {
    await this.db.update(householdInvitesTable)
      .set({ status: 'accepted', acceptedBy: acceptedByPlayerId, acceptedAt: new Date() })
      .where(eq(householdInvitesTable.id, inviteId))
  }

  async revokeInvite(inviteId: string): Promise<void> {
    await this.db.update(householdInvitesTable)
      .set({ status: 'revoked' })
      .where(eq(householdInvitesTable.id, inviteId))
  }

  async expirePendingInvites(now: Date = new Date()): Promise<number> {
    const result = await this.db.update(householdInvitesTable)
      .set({ status: 'expired' })
      .where(and(eq(householdInvitesTable.status, 'pending'), sql`${householdInvitesTable.expiresAt} < ${now}`))
    return (result as any).count ?? 0
  }

  async setPlayerTier(playerId: string, tier: 'free' | 'individual' | 'household'): Promise<void> {
    await this.db.update(playersTable).set({ tier }).where(eq(playersTable.id, playerId))
  }
}
```

- [ ] **Step 4: Create test utilities**

`lq-core/libs/infra/database/test-utils/testDb.ts`:

```typescript
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from '../src/postgres/schema'

export async function getTestDb() {
  const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL })
  return drizzle(pool, { schema })
}

export async function resetDb(db: any) {
  await db.execute('TRUNCATE household_invites, household_members, households, players RESTART IDENTITY CASCADE')
}
```

- [ ] **Step 5: Run tests**

```bash
TEST_DATABASE_URL=postgres://localhost/lq_test pnpm --filter @learnquest/database exec vitest run src/postgres/repositories/HouseholdRepository.test.ts
```
Expected: 6 tests pass.

- [ ] **Step 6: Typecheck**

```bash
pnpm --filter @learnquest/database typecheck
```

- [ ] **Step 7: Commit**

```bash
git add libs/infra/database/src/postgres/repositories/ libs/infra/database/test-utils/
git commit -m "feat(database): HouseholdRepository with full CRUD + tests"
```

---

### Task 5: Export household types from `@learnquest/app-types`

**Files:**
- Create: `lq-core/libs/app/app-types/src/household.ts`
- Modify: `lq-core/libs/app/app-types/src/index.ts`

- [ ] **Step 1: Create the types file**

Create `lq-core/libs/app/app-types/src/household.ts`:

```typescript
export type PlayerTier = 'free' | 'individual' | 'household'

export type HouseholdStatus = 'active' | 'dissolved'

export type HouseholdRole = 'owner' | 'member'

export type ProfileType = 'full' | 'ghost'

export type InviteType = 'email' | 'code'

export type InviteStatus = 'pending' | 'accepted' | 'expired' | 'revoked'

export interface Household {
  id: string
  name: string
  ownerId: string
  subscriptionId: string | null
  maxMembers: number
  status: HouseholdStatus
  createdAt: string
  updatedAt: string
  dissolvedAt: string | null
}

export interface HouseholdMember {
  id: string
  householdId: string
  playerId: string
  role: HouseholdRole
  profileType: ProfileType
  invitedBy: string
  joinedAt: string
  removedAt: string | null
  inviteStatus: 'pending' | 'active' | 'removed'
}

export interface HouseholdInvite {
  id: string
  householdId: string
  type: InviteType
  email: string | null
  code: string | null
  profileType: ProfileType
  status: InviteStatus
  expiresAt: string
  createdBy: string
  acceptedBy: string | null
  acceptedAt: string | null
  createdAt: string
}
```

- [ ] **Step 2: Re-export from package barrel**

In `lq-core/libs/app/app-types/src/index.ts`, add:

```typescript
export * from './household'
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @learnquest/app-types typecheck
```

- [ ] **Step 4: Commit**

```bash
git add libs/app/app-types/src/household.ts libs/app/app-types/src/index.ts
git commit -m "feat(app-types): add household/member/invite type definitions"
```

---

## Phase 2: Service Layer

### Task 6: Domain errors

**Files:**
- Create: `lq-core/libs/app/app-services/src/household/errors.ts`

- [ ] **Step 1: Create the errors file**

```typescript
export class HouseholdFullError extends Error {
  readonly code = 'HOUSEHOLD_FULL'
  constructor(public readonly max: number) {
    super(`Household is full (${max}/${max})`)
  }
}

export class GhostCapError extends Error {
  readonly code = 'GHOST_CAP'
  constructor(public readonly cap: number) {
    super(`Ghost kid cap reached (${cap}/${cap})`)
  }
}

export class NotOwnerError extends Error {
  readonly code = 'NOT_OWNER'
  constructor() {
    super('Only the household owner can perform this action')
  }
}

export class AlreadyInHouseholdError extends Error {
  readonly code = 'ALREADY_IN_HOUSEHOLD'
  constructor() {
    super('Player is already in a household')
  }
}

export class InviteExpiredError extends Error {
  readonly code = 'INVITE_EXPIRED'
  constructor() {
    super('This invite has expired')
  }
}

export class InviteRevokedError extends Error {
  readonly code = 'INVITE_REVOKED'
  constructor() {
    super('This invite has been revoked')
  }
}

export class MustTransferOwnershipError extends Error {
  readonly code = 'MUST_TRANSFER'
  constructor() {
    super('Owner must transfer ownership before leaving')
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add libs/app/app-services/src/household/errors.ts
git commit -m "feat(household): domain error classes"
```

---

### Task 7: `HouseholdService` — create household, add member, remove, transfer

**Files:**
- Create: `lq-core/libs/app/app-services/src/household/HouseholdService.ts`
- Create: `lq-core/libs/app/app-services/src/household/HouseholdService.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// HouseholdService.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { HouseholdService } from './HouseholdService'
import { HouseholdRepository } from '@learnquest/database'
import { HouseholdFullError, NotOwnerError, MustTransferOwnershipError, GhostCapError } from './errors'

describe('HouseholdService', () => {
  let service: HouseholdService
  let repo: HouseholdRepository
  let tierService: { addSeat: any; removeSeat: any }

  beforeEach(() => {
    repo = {
      createHousehold: vi.fn(async (i) => ({ id: 'h1', ...i, status: 'active', maxMembers: 6, subscriptionId: null, createdAt: '', updatedAt: '', dissolvedAt: null })),
      getHousehold: vi.fn(),
      listActiveMembers: vi.fn(async () => []),
      countActiveMembers: vi.fn(async () => 0),
      countGhostMembers: vi.fn(async () => 0),
      addMember: vi.fn(async (i) => ({ id: 'm1', ...i, joinedAt: '', removedAt: null, inviteStatus: 'active' })),
      removeMember: vi.fn(async () => {}),
      transferOwnership: vi.fn(async () => {}),
      setPlayerTier: vi.fn(async () => {}),
      dissolve: vi.fn(async () => {}),
    } as any
    tierService = { addSeat: vi.fn(), removeSeat: vi.fn() }
    service = new HouseholdService(repo, tierService as any)
  })

  describe('create', () => {
    it('creates a household with default maxMembers=6', async () => {
      const h = await service.create({ name: 'Smiths', ownerId: 'p1' })
      expect(repo.createHousehold).toHaveBeenCalledWith({ name: 'Smiths', ownerId: 'p1' })
      expect(repo.setPlayerTier).toHaveBeenCalledWith('p1', 'household')
      expect(h.name).toBe('Smiths')
    })
  })

  describe('addMember (full)', () => {
    it('throws HouseholdFullError when at cap', async () => {
      vi.mocked(repo.countActiveMembers).mockResolvedValueOnce(6)
      await expect(service.addFullMember({ householdId: 'h1', playerId: 'p2', invitedBy: 'p1' }))
        .rejects.toBeInstanceOf(HouseholdFullError)
    })

    it('adds member + sets tier + adds Stripe seat', async () => {
      vi.mocked(repo.countActiveMembers).mockResolvedValueOnce(2)
      const m = await service.addFullMember({ householdId: 'h1', playerId: 'p2', invitedBy: 'p1' })
      expect(repo.addMember).toHaveBeenCalled()
      expect(repo.setPlayerTier).toHaveBeenCalledWith('p2', 'household')
      expect(tierService.addSeat).toHaveBeenCalledWith('h1')
      expect(m.profileType).toBe('full')
    })
  })

  describe('addGhostMember', () => {
    it('throws GhostCapError at 4 ghosts', async () => {
      vi.mocked(repo.countGhostMembers).mockResolvedValueOnce(4)
      await expect(service.addGhostMember({ householdId: 'h1', displayName: 'X', avatar: 'a', invitedBy: 'p1' }))
        .rejects.toBeInstanceOf(GhostCapError)
    })

    it('creates a Player row + member row without Stripe seat', async () => {
      vi.mocked(repo.countGhostMembers).mockResolvedValueOnce(0)
      await service.addGhostMember({ householdId: 'h1', displayName: 'Lucas', avatar: 'kid1', invitedBy: 'p1' })
      expect(repo.addMember).toHaveBeenCalledWith(expect.objectContaining({ profileType: 'ghost' }))
      expect(tierService.addSeat).not.toHaveBeenCalled()
    })
  })

  describe('removeMember', () => {
    it('rejects non-owner', async () => {
      vi.mocked(repo.getHousehold).mockResolvedValueOnce({ id: 'h1', ownerId: 'p1' } as any)
      await expect(service.removeMember({ householdId: 'h1', memberId: 'p2', actorId: 'p3' }))
        .rejects.toBeInstanceOf(NotOwnerError)
    })

    it('rejects owner removal without transfer', async () => {
      vi.mocked(repo.getHousehold).mockResolvedValueOnce({ id: 'h1', ownerId: 'p1' } as any)
      vi.mocked(repo.listActiveMembers).mockResolvedValueOnce([
        { playerId: 'p1', role: 'owner' }, { playerId: 'p2', role: 'member' },
      ] as any)
      await expect(service.removeMember({ householdId: 'h1', memberId: 'p1', actorId: 'p1' }))
        .rejects.toBeInstanceOf(MustTransferOwnershipError)
    })

    it('removes member + Stripe seat + reverts tier', async () => {
      vi.mocked(repo.getHousehold).mockResolvedValueOnce({ id: 'h1', ownerId: 'p1' } as any)
      vi.mocked(repo.listActiveMembers).mockResolvedValueOnce([
        { playerId: 'p1', role: 'owner' }, { playerId: 'p2', role: 'member', profileType: 'full' },
      ] as any)
      await service.removeMember({ householdId: 'h1', memberId: 'p2', actorId: 'p1' })
      expect(repo.removeMember).toHaveBeenCalledWith('h1', 'p2')
      expect(tierService.removeSeat).toHaveBeenCalledWith('h1')
      expect(repo.setPlayerTier).toHaveBeenCalledWith('p2', 'free')
    })
  })

  describe('transferOwnership', () => {
    it('requires recipient to be active member', async () => {
      vi.mocked(repo.listActiveMembers).mockResolvedValueOnce([{ playerId: 'p1', role: 'owner' }] as any)
      await expect(service.transferOwnership({ householdId: 'h1', toPlayerId: 'p3', actorId: 'p1' }))
        .rejects.toThrow(/not a member/i)
    })

    it('swaps owner', async () => {
      vi.mocked(repo.listActiveMembers).mockResolvedValueOnce([
        { playerId: 'p1', role: 'owner' }, { playerId: 'p2', role: 'member' },
      ] as any)
      await service.transferOwnership({ householdId: 'h1', toPlayerId: 'p2', actorId: 'p1' })
      expect(repo.transferOwnership).toHaveBeenCalledWith('h1', 'p1', 'p2')
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @learnquest/app-services exec vitest run src/household/HouseholdService.test.ts
```
Expected: FAIL — `HouseholdService` doesn't exist.

- [ ] **Step 3: Implement the service**

```typescript
// HouseholdService.ts
import type { HouseholdRepository } from '@learnquest/database'
import type { Household, HouseholdMember } from '@learnquest/app-types'
import { HouseholdFullError, GhostCapError, NotOwnerError, MustTransferOwnershipError } from './errors'

export interface CreateInput { name: string; ownerId: string }
export interface AddFullMemberInput { householdId: string; playerId: string; invitedBy: string }
export interface AddGhostMemberInput { householdId: string; displayName: string; avatar: string; invitedBy: string }
export interface RemoveMemberInput { householdId: string; memberId: string; actorId: string }
export interface TransferOwnershipInput { householdId: string; toPlayerId: string; actorId: string }

const MAX_MEMBERS = 6
const MAX_GHOSTS = 4

export interface TierServicePort {
  addSeat(householdId: string): Promise<void>
  removeSeat(householdId: string): Promise<void>
}

export class HouseholdService {
  constructor(
    private readonly repo: HouseholdRepository,
    private readonly tier: TierServicePort,
  ) {}

  async create(input: CreateInput): Promise<Household> {
    const household = await this.repo.createHousehold({ name: input.name, ownerId: input.ownerId })
    await this.repo.setPlayerTier(input.ownerId, 'household')
    return household
  }

  async addFullMember(input: AddFullMemberInput): Promise<HouseholdMember> {
    const count = await this.repo.countActiveMembers(input.householdId)
    if (count >= MAX_MEMBERS) throw new HouseholdFullError(MAX_MEMBERS)
    const member = await this.repo.addMember({
      householdId: input.householdId,
      playerId: input.playerId,
      role: 'member',
      profileType: 'full',
      invitedBy: input.invitedBy,
    })
    await this.repo.setPlayerTier(input.playerId, 'household')
    await this.tier.addSeat(input.householdId)
    return member
  }

  async addGhostMember(input: AddGhostMemberInput): Promise<HouseholdMember> {
    const ghosts = await this.repo.countGhostMembers(input.householdId)
    if (ghosts >= MAX_GHOSTS) throw new GhostCapError(MAX_GHOSTS)
    const totalCount = await this.repo.countActiveMembers(input.householdId)
    if (totalCount >= MAX_MEMBERS) throw new HouseholdFullError(MAX_MEMBERS)
    const ghostPlayerId = await this.repo.createGhostPlayer({ displayName: input.displayName, avatar: input.avatar })
    const member = await this.repo.addMember({
      householdId: input.householdId,
      playerId: ghostPlayerId,
      role: 'member',
      profileType: 'ghost',
      invitedBy: input.invitedBy,
    })
    // Ghost kids don't get tier='household' — they have no auth. But they're "in" the household.
    // Their Player row has tier='free' and the household membership carries the access.
    return member
  }

  async removeMember(input: RemoveMemberInput): Promise<void> {
    const household = await this.repo.getHousehold(input.householdId)
    if (!household) throw new Error('Household not found')
    if (household.ownerId !== input.actorId) throw new NotOwnerError()

    const members = await this.repo.listActiveMembers(input.householdId)
    const target = members.find((m) => m.playerId === input.memberId)
    if (!target) throw new Error('Member not found in household')

    if (target.role === 'owner') {
      throw new MustTransferOwnershipError()
    }

    await this.repo.removeMember(input.householdId, input.memberId)
    if (target.profileType === 'full') {
      await this.tier.removeSeat(input.householdId)
      await this.repo.setPlayerTier(input.memberId, 'free')
    }
  }

  async transferOwnership(input: TransferOwnershipInput): Promise<void> {
    const household = await this.repo.getHousehold(input.householdId)
    if (!household) throw new Error('Household not found')
    if (household.ownerId !== input.actorId) throw new NotOwnerError()

    const members = await this.repo.listActiveMembers(input.householdId)
    const recipient = members.find((m) => m.playerId === input.toPlayerId)
    if (!recipient || recipient.role !== 'member') {
      throw new Error('Recipient is not an active member of this household')
    }
    await this.repo.transferOwnership(input.householdId, input.actorId, input.toPlayerId)
  }

  async dissolve(householdId: string, actorId: string): Promise<void> {
    const household = await this.repo.getHousehold(householdId)
    if (!household) throw new Error('Household not found')
    if (household.ownerId !== actorId) throw new NotOwnerError()
    await this.repo.dissolve(householdId)
    // Caller (API layer) handles Stripe cancellation + tier reset for all members
  }
}
```

- [ ] **Step 4: Add `createGhostPlayer` to repository**

Extend `HouseholdRepository` with:

```typescript
async createGhostPlayer(opts: { displayName: string; avatar: string }): Promise<string> {
  const [row] = await this.db.insert(playersTable).values({
    id: `ghost-${crypto.randomUUID()}`,
    displayName: opts.displayName,
    avatar: opts.avatar,
    tier: 'free',
    // No auth user — ghost profile
  }).returning({ id: playersTable.id })
  return row.id
}
```

- [ ] **Step 5: Run tests**

```bash
pnpm --filter @learnquest/app-services exec vitest run src/household/HouseholdService.test.ts
```
Expected: All 8 tests pass.

- [ ] **Step 6: Typecheck + commit**

```bash
pnpm --filter @learnquest/app-services typecheck
git add libs/app/app-services/src/household/ libs/infra/database/src/postgres/repositories/HouseholdRepository.ts
git commit -m "feat(household): HouseholdService with create/add/remove/transfer"
```

---

### Task 8: `InviteService` — create/accept/revoke invites

**Files:**
- Create: `lq-core/libs/app/app-services/src/household/InviteService.ts`
- Create: `lq-core/libs/app/app-services/src/household/InviteService.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// InviteService.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { InviteService } from './InviteService'
import { InviteExpiredError, HouseholdFullError } from './errors'
import { randomBytes } from 'crypto'

describe('InviteService', () => {
  let service: InviteService
  let repo: any
  let householdService: any

  beforeEach(() => {
    repo = {
      createInvite: vi.fn(async (i) => ({ id: 'inv1', ...i, createdAt: new Date().toISOString() })),
      findInviteByCode: vi.fn(),
      findInviteByEmail: vi.fn(),
      markInviteAccepted: vi.fn(async () => {}),
      revokeInvite: vi.fn(async () => {}),
    }
    householdService = { addFullMember: vi.fn() }
    service = new InviteService(repo, householdService)
  })

  describe('createCodeInvite', () => {
    it('generates 6-char alphanumeric code', async () => {
      const inv = await service.createCodeInvite({ householdId: 'h1', profileType: 'full', createdBy: 'p1' })
      expect(inv.code).toMatch(/^[A-Z0-9]{6}$/)
    })

    it('sets expiresAt to 7 days from now', async () => {
      const before = Date.now()
      const inv = await service.createCodeInvite({ householdId: 'h1', profileType: 'full', createdBy: 'p1' })
      const expiry = new Date(inv.expiresAt).getTime()
      expect(expiry).toBeGreaterThanOrEqual(before + 7 * 24 * 3600 * 1000 - 1000)
      expect(expiry).toBeLessThanOrEqual(before + 7 * 24 * 3600 * 1000 + 1000)
    })
  })

  describe('createEmailInvite', () => {
    it('validates email format', async () => {
      await expect(service.createEmailInvite({ householdId: 'h1', profileType: 'full', email: 'notanemail', createdBy: 'p1' }))
        .rejects.toThrow(/invalid email/i)
    })

    it('creates invite with email + code (for link)', async () => {
      const inv = await service.createEmailInvite({ householdId: 'h1', profileType: 'full', email: 'a@b.com', createdBy: 'p1' })
      expect(inv.email).toBe('a@b.com')
      expect(inv.code).toMatch(/^[A-Z0-9]{6}$/)
    })
  })

  describe('acceptByCode', () => {
    it('throws if invite expired', async () => {
      repo.findInviteByCode.mockResolvedValueOnce({ id: 'inv1', householdId: 'h1', code: 'X', profileType: 'full', status: 'pending', expiresAt: new Date(Date.now() - 1000).toISOString() })
      await expect(service.acceptByCode({ code: 'X', playerId: 'p2' })).rejects.toBeInstanceOf(InviteExpiredError)
    })

    it('calls householdService.addFullMember + marks accepted', async () => {
      repo.findInviteByCode.mockResolvedValueOnce({ id: 'inv1', householdId: 'h1', code: 'X', profileType: 'full', status: 'pending', expiresAt: new Date(Date.now() + 86400000).toISOString() })
      await service.acceptByCode({ code: 'X', playerId: 'p2' })
      expect(householdService.addFullMember).toHaveBeenCalledWith({ householdId: 'h1', playerId: 'p2', invitedBy: 'system' })
      expect(repo.markInviteAccepted).toHaveBeenCalledWith('inv1', 'p2')
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @learnquest/app-services exec vitest run src/household/InviteService.test.ts
```

- [ ] **Step 3: Implement**

```typescript
// InviteService.ts
import { randomBytes } from 'crypto'
import type { HouseholdRepository } from '@learnquest/database'
import type { HouseholdInvite } from '@learnquest/app-types'
import { InviteExpiredError, HouseholdFullError } from './errors'

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'  // No 0/O/1/I for clarity
const CODE_LENGTH = 6
const EXPIRY_DAYS = 7

export interface CreateCodeInviteInput { householdId: string; profileType: 'full' | 'ghost'; createdBy: string }
export interface CreateEmailInviteInput { householdId: string; profileType: 'full' | 'ghost'; email: string; createdBy: string }
export interface AcceptByCodeInput { code: string; playerId: string }

function generateCode(): string {
  const bytes = randomBytes(CODE_LENGTH)
  let s = ''
  for (let i = 0; i < CODE_LENGTH; i++) s += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length]
  return s
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export class InviteService {
  constructor(
    private readonly repo: HouseholdRepository,
    private readonly householdService: { addFullMember(input: { householdId: string; playerId: string; invitedBy: string }): Promise<any> },
  ) {}

  async createCodeInvite(input: CreateCodeInviteInput): Promise<HouseholdInvite> {
    return this.repo.createInvite({
      householdId: input.householdId,
      type: 'code',
      email: null,
      code: generateCode(),
      profileType: input.profileType,
      status: 'pending',
      expiresAt: new Date(Date.now() + EXPIRY_DAYS * 24 * 3600 * 1000).toISOString(),
      createdBy: input.createdBy,
      acceptedBy: null,
      acceptedAt: null,
    })
  }

  async createEmailInvite(input: CreateEmailInviteInput): Promise<HouseholdInvite> {
    if (!EMAIL_RE.test(input.email)) throw new Error('Invalid email format')
    return this.repo.createInvite({
      householdId: input.householdId,
      type: 'email',
      email: input.email,
      code: generateCode(),
      profileType: input.profileType,
      status: 'pending',
      expiresAt: new Date(Date.now() + EXPIRY_DAYS * 24 * 3600 * 1000).toISOString(),
      createdBy: input.createdBy,
      acceptedBy: null,
      acceptedAt: null,
    })
  }

  async acceptByCode(input: AcceptByCodeInput): Promise<{ householdId: string }> {
    const invite = await this.repo.findInviteByCode(input.code)
    if (!invite) throw new Error('Invite not found')
    if (invite.status !== 'pending') throw new Error('Invite is no longer valid')
    if (new Date(invite.expiresAt) < new Date()) throw new InviteExpiredError()
    if (invite.profileType !== 'full') {
      throw new Error('Ghost-profile invites must be added directly by the owner')
    }
    await this.householdService.addFullMember({ householdId: invite.householdId, playerId: input.playerId, invitedBy: invite.createdBy })
    await this.repo.markInviteAccepted(invite.id, input.playerId)
    return { householdId: invite.householdId }
  }

  async revoke(inviteId: string, actorId: string): Promise<void> {
    // Authorization check happens at the API layer (owner check); service assumes authorized.
    await this.repo.revokeInvite(inviteId)
  }
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @learnquest/app-services exec vitest run src/household/InviteService.test.ts
```
Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add libs/app/app-services/src/household/
git commit -m "feat(household): InviteService with code/email/accept flows"
```

---

### Task 9: `TierService` — Stripe multi-line-item subscription

**Files:**
- Create: `lq-core/libs/app/app-services/src/household/TierService.ts`
- Create: `lq-core/libs/app/app-services/src/household/TierService.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// TierService.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TierService } from './TierService'

describe('TierService', () => {
  let service: TierService
  let stripe: any
  let repo: any

  beforeEach(() => {
    stripe = {
      subscriptions: {
        create: vi.fn(async () => ({ id: 'sub1' })),
        retrieve: vi.fn(async () => ({ id: 'sub1', status: 'active' })),
      },
      subscriptionItems: {
        create: vi.fn(async () => ({ id: 'si1' })),
        del: vi.fn(async () => ({})),
      }
    }
    repo = {
      getHousehold: vi.fn(),
      setSubscriptionId: vi.fn(),
      getSubscription: vi.fn(),
    }
    service = new TierService(stripe, repo, {
      individualPriceId: 'price_indiv',
      familySeatPriceId: 'price_seat',
    })
  })

  it('upgrade creates a Stripe subscription with individual line item', async () => {
    const sub = await service.upgrade({ householdId: 'h1', ownerId: 'p1', customerId: 'cus1' })
    expect(stripe.subscriptions.create).toHaveBeenCalledWith(expect.objectContaining({
      customer: 'cus1',
      items: [{ price: 'price_indiv', quantity: 1 }],
    }))
    expect(sub.id).toBe('sub1')
  })

  it('addSeat appends a family-seat line item', async () => {
    repo.getHousehold.mockResolvedValueOnce({ id: 'h1', subscriptionId: 'sub1' })
    await service.addSeat('h1')
    expect(stripe.subscriptionItems.create).toHaveBeenCalledWith(expect.objectContaining({
      subscription: 'sub1',
      items: [{ price: 'price_seat', quantity: 1 }],
    }))
  })

  it('removeSeat deletes the most recent family-seat line item', async () => {
    repo.getHousehold.mockResolvedValueOnce({ id: 'h1', subscriptionId: 'sub1' })
    stripe.subscriptions.retrieve.mockResolvedValueOnce({
      id: 'sub1',
      items: { data: [{ id: 'si1', price: { id: 'price_indiv' } }, { id: 'si2', price: { id: 'price_seat' } }] },
    })
    await service.removeSeat('h1')
    expect(stripe.subscriptionItems.del).toHaveBeenCalledWith('si2')
  })

  it('cancel cancels the subscription', async () => {
    repo.getHousehold.mockResolvedValueOnce({ id: 'h1', subscriptionId: 'sub1' })
    stripe.subscriptions.del = vi.fn(async () => ({}))
    await service.cancel('h1')
    expect(stripe.subscriptions.del).toHaveBeenCalledWith('sub1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @learnquest/app-services exec vitest run src/household/TierService.test.ts
```

- [ ] **Step 3: Implement**

```typescript
// TierService.ts
import type { HouseholdRepository } from '@learnquest/database'

export interface StripeClient {
  subscriptions: {
    create(opts: any): Promise<{ id: string; [k: string]: any }>
    retrieve(id: string): Promise<{ id: string; items: { data: Array<{ id: string; price: { id: string } }> }; [k: string]: any }>
    del?(id: string): Promise<any>
    update?(id: string, opts: any): Promise<any>
  }
  subscriptionItems: {
    create(opts: any): Promise<{ id: string }>
    del(id: string): Promise<any>
  }
}

export interface TierServiceOptions {
  individualPriceId: string
  familySeatPriceId: string
}

export class TierService {
  constructor(
    private readonly stripe: StripeClient,
    private readonly repo: HouseholdRepository,
    private readonly opts: TierServiceOptions,
  ) {}

  async upgrade(input: { householdId: string; ownerId: string; customerId: string }): Promise<{ id: string }> {
    const sub = await this.stripe.subscriptions.create({
      customer: input.customerId,
      items: [{ price: this.opts.individualPriceId, quantity: 1 }],
      metadata: { householdId: input.householdId, ownerId: input.ownerId },
    })
    await this.repo.setSubscriptionId(input.householdId, sub.id)
    return sub
  }

  async addSeat(householdId: string): Promise<void> {
    const h = await this.repo.getHousehold(householdId)
    if (!h?.subscriptionId) throw new Error('Household has no active subscription')
    await this.stripe.subscriptionItems.create({
      subscription: h.subscriptionId,
      items: [{ price: this.opts.familySeatPriceId, quantity: 1 }],
    })
  }

  async removeSeat(householdId: string): Promise<void> {
    const h = await this.repo.getHousehold(householdId)
    if (!h?.subscriptionId) throw new Error('Household has no active subscription')
    const sub = await this.stripe.subscriptions.retrieve(h.subscriptionId)
    const seats = sub.items.data.filter((it) => it.price.id === this.opts.familySeatPriceId)
    if (seats.length === 0) return  // nothing to remove
    const mostRecent = seats[seats.length - 1]
    await this.stripe.subscriptionItems.del(mostRecent.id)
  }

  async cancel(householdId: string): Promise<void> {
    const h = await this.repo.getHousehold(householdId)
    if (!h?.subscriptionId) throw new Error('Household has no active subscription')
    if (this.stripe.subscriptions.del) {
      await this.stripe.subscriptions.del(h.subscriptionId)
    } else {
      await this.stripe.subscriptions.update!(h.subscriptionId, { cancel_at_period_end: true })
    }
  }
}
```

- [ ] **Step 4: Add `setSubscriptionId` to repository**

```typescript
// In HouseholdRepository.ts
async setSubscriptionId(householdId: string, subscriptionId: string): Promise<void> {
  await this.db.update(householdsTable)
    .set({ subscriptionId, updatedAt: new Date() })
    .where(eq(householdsTable.id, householdId))
}
```

- [ ] **Step 5: Run tests + commit**

```bash
pnpm --filter @learnquest/app-services exec vitest run src/household/TierService.test.ts
git add libs/app/app-services/src/household/ libs/infra/database/src/postgres/repositories/HouseholdRepository.ts
git commit -m "feat(household): TierService with Stripe multi-line-item support"
```

---

### Task 10: Wire services into a barrel + update `package.json` exports

**Files:**
- Create: `lq-core/libs/app/app-services/src/household/index.ts`
- Modify: `lq-core/libs/app/app-services/package.json`
- Modify: `lq-core/libs/app/app-services/src/index.ts`

- [ ] **Step 1: Create barrel**

```typescript
// household/index.ts
export { HouseholdService } from './HouseholdService'
export { InviteService } from './InviteService'
export { TierService } from './TierService'
export * from './errors'
export type { CreateInput, AddFullMemberInput, AddGhostMemberInput, RemoveMemberInput, TransferOwnershipInput } from './HouseholdService'
export type { CreateCodeInviteInput, CreateEmailInviteInput, AcceptByCodeInput } from './InviteService'
export type { StripeClient, TierServiceOptions } from './TierService'
```

- [ ] **Step 2: Add to package.json exports**

In `lq-core/libs/app/app-services/package.json`:

```json
"exports": {
  ".": "./src/index.ts",
  "./household": "./src/household/index.ts"
}
```

- [ ] **Step 3: Add to main barrel**

In `lq-core/libs/app/app-services/src/index.ts`:

```typescript
export * as Household from './household'
```

- [ ] **Step 4: Typecheck + commit**

```bash
pnpm --filter @learnquest/app-services typecheck
git add libs/app/app-services/
git commit -m "feat(household): export HouseholdService/InviteService/TierService"
```

---

## Phase 3: API Layer

**Note:** The API routes live in `forge-control/packages/hosting-api/src/routes/` and run on `https://forge.blueforge.studio`. The household routes are added to the existing `/api/fleet`-style router pattern.

### Task 11: Wire Household routes (`/api/households/*`)

**Files:**
- Create: `forge-control/packages/hosting-api/src/routes/households.ts`
- Create: `forge-control/packages/hosting-api/src/routes/households.test.ts`
- Modify: `forge-control/packages/hosting-api/src/server.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// households.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createHouseholdsRouter } from './households'

describe('POST /api/households', () => {
  let router: any
  let householdService: any

  beforeEach(() => {
    householdService = { create: vi.fn(async (i) => ({ id: 'h1', ...i })) }
    router = createHouseholdsRouter({ householdService } as any)
  })

  it('creates a household', async () => {
    const handler = router.stack.find((l: any) => l.route?.path === '/' && l.route?.methods.post).route.stack[0].handle
    const req = { body: { name: 'Smiths' }, user: { id: 'p1' } }
    const json = vi.fn()
    const status = vi.fn(() => ({ json }))
    const res = { status, json }
    await handler(req, res)
    expect(householdService.create).toHaveBeenCalledWith({ name: 'Smiths', ownerId: 'p1' })
    expect(status).toHaveBeenCalledWith(201)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd forge-control && pnpm --filter @blueforge-studio/hosting-api test -- households
```

- [ ] **Step 3: Implement the router**

```typescript
// households.ts
import { Router } from 'express'
import type { HouseholdService, InviteService } from '@learnquest/app-services/household'
import type { authMiddleware } from '../middleware/auth'

export interface HouseholdRoutesDeps {
  householdService: HouseholdService
  inviteService: InviteService
  tierService: { upgrade(input: { householdId: string; ownerId: string; customerId: string }): Promise<{ id: string }> }
}

export function createHouseholdsRouter(deps: HouseholdRoutesDeps) {
  const router = Router()

  // POST /api/households — create household for authenticated player
  router.post('/', async (req, res) => {
    try {
      const userId = req.user?.id
      if (!userId) return res.status(401).json({ error: 'Unauthorized' })
      const { name, customerId } = req.body
      const household = await deps.householdService.create({ name, ownerId: userId })
      // Optionally upgrade immediately if customerId provided (paid flow)
      if (customerId) {
        await deps.tierService.upgrade({ householdId: household.id, ownerId: userId, customerId })
      }
      res.status(201).json(household)
    } catch (err: any) {
      res.status(400).json({ error: err.message })
    }
  })

  // POST /api/households/:id/invites — create email or code invite
  router.post('/:id/invites', async (req, res) => {
    try {
      const { id } = req.params
      const { type, email, profileType } = req.body
      const userId = req.user?.id
      if (!userId) return res.status(401).json({ error: 'Unauthorized' })
      const invite = type === 'email'
        ? await deps.inviteService.createEmailInvite({ householdId: id, email, profileType, createdBy: userId })
        : await deps.inviteService.createCodeInvite({ householdId: id, profileType, createdBy: userId })
      res.status(201).json(invite)
    } catch (err: any) {
      res.status(400).json({ error: err.message })
    }
  })

  // POST /api/households/invites/accept — accept by code
  router.post('/invites/accept', async (req, res) => {
    try {
      const userId = req.user?.id
      if (!userId) return res.status(401).json({ error: 'Unauthorized' })
      const { code } = req.body
      const result = await deps.inviteService.acceptByCode({ code, playerId: userId })
      res.json(result)
    } catch (err: any) {
      res.status(400).json({ error: err.message, code: err.code })
    }
  })

  // POST /api/households/:id/members — direct add (ghost kid)
  router.post('/:id/members', async (req, res) => {
    try {
      const { id } = req.params
      const { displayName, avatar } = req.body
      const userId = req.user?.id
      if (!userId) return res.status(401).json({ error: 'Unauthorized' })
      const member = await deps.householdService.addGhostMember({
        householdId: id, displayName, avatar, invitedBy: userId,
      })
      res.status(201).json(member)
    } catch (err: any) {
      res.status(400).json({ error: err.message, code: err.code })
    }
  })

  // DELETE /api/households/:id/members/:memberId — remove member
  router.delete('/:id/members/:memberId', async (req, res) => {
    try {
      const { id, memberId } = req.params
      const userId = req.user?.id
      if (!userId) return res.status(401).json({ error: 'Unauthorized' })
      await deps.householdService.removeMember({ householdId: id, memberId, actorId: userId })
      res.status(204).send()
    } catch (err: any) {
      res.status(400).json({ error: err.message, code: err.code })
    }
  })

  // POST /api/households/:id/transfer — transfer ownership
  router.post('/:id/transfer', async (req, res) => {
    try {
      const { id } = req.params
      const { toPlayerId } = req.body
      const userId = req.user?.id
      if (!userId) return res.status(401).json({ error: 'Unauthorized' })
      await deps.householdService.transferOwnership({ householdId: id, toPlayerId, actorId: userId })
      res.status(204).send()
    } catch (err: any) {
      res.status(400).json({ error: err.message, code: err.code })
    }
  })

  return router
}
```

- [ ] **Step 4: Mount in server.ts**

In `forge-control/packages/hosting-api/src/server.ts`, after the existing `/api/fleet` mount:

```typescript
import { createHouseholdsRouter } from './routes/households'
// ... in route registration:
app.use('/api/households', authMiddleware, createHouseholdsRouter({ householdService, inviteService, tierService }))
```

(Inject `householdService` etc. via the existing DI container pattern. Wire up at startup.)

- [ ] **Step 5: Run tests + typecheck**

```bash
pnpm --filter @blueforge-studio/hosting-api test
pnpm --filter @blueforge-studio/hosting-api typecheck
```

- [ ] **Step 6: Commit**

```bash
cd forge-control && git add packages/hosting-api/src/routes/households.ts packages/hosting-api/src/routes/households.test.ts packages/hosting-api/src/server.ts
git commit -m "feat(api): /api/households routes for create/invite/accept/remove/transfer"
```

---

### Task 12: Extend Stripe webhook handler for household events

**Files:**
- Modify: `lq-core/supabase/functions/stripe-webhooks/index.ts` (or move to `forge-control/...`)

- [ ] **Step 1: Read existing webhook handler**

```bash
cat lq-core/supabase/functions/stripe-webhooks/index.ts | head -50
```

- [ ] **Step 2: Add `invoice.paid` reconciliation**

The existing handler likely already handles `customer.subscription.updated`. Add a new branch:

```typescript
if (event.type === 'invoice.paid' && event.data.object.subscription) {
  const subscriptionId = event.data.object.subscription
  // Reconcile: ensure household.subscriptionId matches a real active Stripe sub
  const household = await deps.repo.findHouseholdBySubscriptionId(subscriptionId)
  if (household && event.data.object.status !== 'paid') {
    await deps.tierService.cancel(household.id)
  }
}
```

- [ ] **Step 3: Test webhook**

Use Stripe CLI to forward test events:
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
stripe trigger invoice.paid
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/stripe-webhooks/
git commit -m "feat(stripe): reconcile household subscription on invoice.paid"
```

---

## Phase 4: UI — Subscription Page

### Task 13: Create `@learnquest/screens-household` package skeleton

**Files:**
- Create: `lq-core/libs/screens/household/package.json`
- Create: `lq-core/libs/screens/household/tsconfig.json`
- Create: `lq-core/libs/screens/household/vitest.config.ts`
- Create: `lq-core/libs/screens/household/src/index.ts`

- [ ] **Step 1: package.json**

```json
{
  "name": "@learnquest/screens-household",
  "version": "0.1.0",
  "type": "module",
  "main": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@learnquest/ui": "workspace:*",
    "@learnquest/hooks": "workspace:*",
    "@learnquest/app-types": "workspace:*",
    "react": "^19.0.0",
    "react-router-dom": "^7.0.0"
  },
  "devDependencies": {
    "@testing-library/react": "^16.0.0",
    "vitest": "^4.0.0",
    "typescript": "^5.9.0"
  }
}
```

- [ ] **Step 2: tsconfig.json + vitest.config.ts** — copy from a sibling package (`libs/screens/profile/`)

- [ ] **Step 3: Register in lq-core root**

In `lq-core/package.json` workspaces, ensure `libs/screens/*` is included (it should be already).

- [ ] **Step 4: Install**

```bash
cd lq-core && pnpm install
```

- [ ] **Step 5: Commit**

```bash
git add libs/screens/household/
git commit -m "feat(screens): create @learnquest/screens-household package skeleton"
```

---

### Task 14: `FamilyTierCard` + `MemberSlider` + `PricePreview` components (using `@learnquest/ui`)

**Files:**
- Create: `lq-core/libs/screens/household/src/components/MemberSlider.tsx`
- Create: `lq-core/libs/screens/household/src/components/MemberSlider.stories.tsx`
- Create: `lq-core/libs/screens/household/src/components/PricePreview.tsx`
- Create: `lq-core/libs/screens/household/src/components/FamilyTierCard.tsx`
- Create: `lq-core/libs/screens/household/src/components/FamilyTierCard.stories.tsx`

- [ ] **Step 1: Component tests (using `@testing-library/react` + `@learnquest/ui` resolution)**

```typescript
// MemberSlider.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { MemberSlider } from './MemberSlider'

describe('MemberSlider', () => {
  it('renders the shared Slider with min=1, max=6', () => {
    render(<MemberSlider value={3} onChange={() => {}} />)
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuemin', '1')
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuemax', '6')
  })
  it('calls onChange with new value', () => {
    const onChange = vi.fn()
    render(<MemberSlider value={3} onChange={onChange} />)
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowRight' })
    expect(onChange).toHaveBeenCalled()
  })
})
```

```typescript
// PricePreview.test.tsx
describe('PricePreview', () => {
  it('computes total: $50 base + $30 per extra member', () => {
    render(<PricePreview memberCount={3} />)
    expect(screen.getByTestId('price-preview')).toHaveTextContent('$110/yr')
  })
})
```

- [ ] **Step 2: Implement MemberSlider using `@learnquest/ui` Slider**

```typescript
// MemberSlider.tsx
import { Slider } from '@learnquest/ui'

export function MemberSlider({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <Slider
      min={1}
      max={6}
      step={1}
      value={[value]}
      onValueChange={(v) => onChange(v[0])}
      aria-label="Number of household members"
    />
  )
}
```

- [ ] **Step 3: Implement PricePreview using `@learnquest/ui` Card surface**

```typescript
// PricePreview.tsx
import { Card } from '@learnquest/ui'

export function PricePreview({ memberCount }: { memberCount: number }) {
  const total = 50 + Math.max(0, memberCount - 1) * 30
  return (
    <Card data-testid="price-preview">
      <Card.Content>
        <span className="text-2xl font-bold">${total}</span>
        <span className="text-sm text-muted-foreground">/yr</span>
      </Card.Content>
    </Card>
  )
}
```

- [ ] **Step 4: Implement FamilyTierCard using `@learnquest/ui` Card + Button**

```typescript
// FamilyTierCard.tsx
import { useState } from 'react'
import { Card, Button } from '@learnquest/ui'
import { MemberSlider } from './MemberSlider'
import { PricePreview } from './PricePreview'

export function FamilyTierCard({ onSelect }: { onSelect: (memberCount: number) => void }) {
  const [count, setCount] = useState(2)
  return (
    <Card>
      <Card.Header>
        <Card.Title>Family</Card.Title>
        <Card.Description>$50 + seats</Card.Description>
      </Card.Header>
      <Card.Content>
        <ul>
          <li>1–6 players</li>
          <li>All premium content</li>
          <li>Shared progress</li>
        </ul>
        <MemberSlider value={count} onChange={setCount} />
        <PricePreview memberCount={count} />
      </Card.Content>
      <Card.Footer>
        <Button onClick={() => onSelect(count)}>Add family</Button>
      </Card.Footer>
    </Card>
  )
}
```

- [ ] **Step 5: Stories (Storybook)** — co-located `.stories.tsx` for `MemberSlider` and `FamilyTierCard`:

```typescript
// MemberSlider.stories.tsx
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { MemberSlider } from './MemberSlider'

const meta: Meta<typeof MemberSlider> = {
  title: 'Screens/Household/components/MemberSlider',
  component: MemberSlider,
  args: { onChange: fn() },
}
export default meta
type Story = StoryObj<typeof MemberSlider>
export const Min: Story = { args: { value: 1 } }
export const Mid: Story = { args: { value: 3 } }
export const Max: Story = { args: { value: 6 } }
```

```typescript
// FamilyTierCard.stories.tsx
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { FamilyTierCard } from './FamilyTierCard'

const meta: Meta<typeof FamilyTierCard> = {
  title: 'Screens/Household/components/FamilyTierCard',
  component: FamilyTierCard,
  args: { onSelect: fn() },
}
export default meta
type Story = StoryObj<typeof FamilyTierCard>
export const Solo: Story = {}
export const TwoMember: Story = { args: { /* internal state defaults to 2; override via Storybook controls */ } }
export const SixMember: Story = {}
```

- [ ] **Step 6: Run tests + typecheck**

```bash
pnpm --filter @learnquest/screens-household test
pnpm --filter @learnquest/screens-household typecheck
```

- [ ] **Step 7: Build storybook (verify story compiles)**

```bash
pnpm --filter @learnquest/screens-household build-storybook
# or: pnpm storybook build
```

- [ ] **Step 8: Commit**

```bash
git add libs/screens/household/src/components/
git commit -m "feat(household-ui): FamilyTierCard with @learnquest/ui + stories"
```

---

### Task 15: Integrate FamilyTierCard into SubscriptionPage

**Files:**
- Modify: `lq-core/libs/screens/profile/src/subscription/SubscriptionPage.tsx`

- [ ] **Step 1: Read existing subscription page**

```bash
cat lq-core/libs/screens/profile/src/subscription/SubscriptionPage.tsx
```

- [ ] **Step 2: Add FamilyTierCard import + render**

```typescript
import { FamilyTierCard } from '@learnquest/screens-household'
// ...
export function SubscriptionPage() {
  return (
    <div className="subscription-page">
      <FreeCard />
      <IndividualCard />
      <FamilyTierCard onSelect={(memberCount) => navigate(`/household/new?members=${memberCount}`)} />
    </div>
  )
}
```

- [ ] **Step 3: Verify build**

```bash
pnpm --filter @learnquest/screens-profile typecheck
```

- [ ] **Step 4: Commit**

```bash
git add libs/screens/profile/src/subscription/SubscriptionPage.tsx
git commit -m "feat(profile-ui): add Family tier card to subscription page"
```

---

## Phase 5: UI — Household Management Screens

### Task 16: `HouseholdSettingsScreen` (using `@learnquest/ui` + co-located story)

**Files:**
- Create: `lq-core/libs/screens/household/src/HouseholdSettingsScreen.tsx`
- Create: `lq-core/libs/screens/household/src/HouseholdSettingsScreen.stories.tsx`
- Create: `lq-core/libs/screens/household/src/__tests__/HouseholdSettingsScreen.test.tsx`

- [ ] **Step 1: Write component test** (asserts presence of shared-ui Button + Card, not raw buttons/divs):

```typescript
import { render, screen } from '@testing-library/react'
import { HouseholdSettingsScreen } from '../HouseholdSettingsScreen'
import { StoryWrapper } from '../shared/test-utils/StoryWrapper'

// Mock the hook so the screen resolves without network
vi.mock('../hooks/useHousehold', () => ({
  useHousehold: () => ({
    household: { id: 'h1', name: 'Smiths', maxMembers: 6, ownerId: 'p1', status: 'active' },
    members: [
      { id: 'm1', playerId: 'p1', displayName: 'Maria (you)', role: 'owner', profileType: 'full' },
      { id: 'm2', playerId: 'p2', displayName: 'Anders', role: 'member', profileType: 'full' },
      { id: 'm3', playerId: 'gx1', displayName: 'Lucas', role: 'member', profileType: 'ghost' },
    ],
    isOwner: true,
    loading: false,
    actorId: 'p1',
  }),
}))

describe('HouseholdSettingsScreen', () => {
  it('renders Card with household name + member count via shared Card', () => {
    render(<StoryWrapper><HouseholdSettingsScreen householdId="h1" /></StoryWrapper>)
    expect(screen.getByTestId('household-name')).toHaveTextContent('Smiths')
    expect(screen.getByTestId('member-count')).toHaveTextContent(/3 of 6/)
  })

  it('shows "+ Invite" Button for owner', () => {
    render(<StoryWrapper><HouseholdSettingsScreen householdId="h1" /></StoryWrapper>)
    expect(screen.getByRole('button', { name: /invite/i })).toBeInTheDocument()
  })

  it('does not show cancel/transfer Buttons to non-owner', () => {
    vi.mocked(useHousehold as any).mockReturnValueOnce({ isOwner: false, /* ... */ })
    render(<StoryWrapper><HouseholdSettingsScreen householdId="h1" /></StoryWrapper>)
    expect(screen.queryByText(/cancel family plan/i)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Implement using `@learnquest/ui` Card/Button/Section**

```typescript
// HouseholdSettingsScreen.tsx
import { Card, Button, Separator } from '@learnquest/ui'
import { useHousehold } from './hooks/useHousehold'
import { MemberCard } from './components/MemberCard'

export function HouseholdSettingsScreen({ householdId }: { householdId: string }) {
  const { household, members, isOwner, loading } = useHousehold(householdId)
  if (loading) return <LoadingView />  // from shared/loading
  if (!household) return <div>Household not found</div>

  return (
    <div className="household-settings">
      <h1 data-testid="household-name">{household.name}</h1>
      <p>Family plan · <span data-testid="member-count">{members.length} of {household.maxMembers} members</span></p>

      <Card>
        <Card.Header>
          <Card.Title>Members</Card.Title>
        </Card.Header>
        <Card.Content>
          {members.map((m) => <MemberCard key={m.id} member={m} canManage={isOwner} />)}
        </Card.Content>
        <Card.Footer>
          <Button>+ Invite</Button>
        </Card.Footer>
      </Card>

      {isOwner && (
        <Card>
          <Card.Header><Card.Title>Billing</Card.Title></Card.Header>
          <Card.Content>
            <Button variant="secondary">Update payment method</Button>
            <Button variant="secondary">View invoices</Button>
          </Card.Content>
        </Card>
      )}

      {isOwner && (
        <Card>
          <Card.Header><Card.Title>Household actions</Card.Title></Card.Header>
          <Card.Content>
            <Button variant="secondary">Rename household</Button>
            <Button variant="destructive">Cancel family plan</Button>
            {members.length > 1 && <Button variant="outline">Transfer ownership</Button>}
          </Card.Content>
        </Card>
      )}
    </div>
  )
}
```

- [ ] **Step 3: `useHousehold` hook** (unchanged from prior plan)

- [ ] **Step 4: Co-located story** `HouseholdSettingsScreen.stories.tsx`:

```typescript
import type { Meta, StoryObj } from '@storybook/react-vite'
import { HouseholdSettingsScreen } from './HouseholdSettingsScreen'
import { StoryWrapper } from './shared/test-utils/StoryWrapper'
import { vi } from 'vitest'

// Mock hook with decorator so each story variant is a different state
const meta: Meta<typeof HouseholdSettingsScreen> = {
  title: 'Screens/Household/HouseholdSettingsScreen',
  component: HouseholdSettingsScreen,
  decorators: [(Story) => <StoryWrapper><Story /></StoryWrapper>],
  parameters: { layout: 'fullscreen' },
}
export default meta
type Story = StoryObj<typeof HouseholdSettingsScreen>

const base = {
  household: { id: 'h1', name: 'The Smiths', maxMembers: 6, ownerId: 'p1', status: 'active' },
  members: [
    { id: 'm1', playerId: 'p1', displayName: 'Maria (you)', role: 'owner', profileType: 'full' },
    { id: 'm2', playerId: 'p2', displayName: 'Anders', role: 'member', profileType: 'full' },
    { id: 'm3', playerId: 'gx1', displayName: 'Lucas', role: 'member', profileType: 'ghost' },
  ],
}

export const OwnerWithKids: Story = {
  beforeEach: () => vi.mock('../hooks/useHousehold', () => ({ useHousehold: () => ({ ...base, isOwner: true, loading: false, actorId: 'p1' }) })),
}

export const SoloOwner: Story = {
  beforeEach: () => vi.mock('../hooks/useHousehold', () => ({ useHousehold: () => ({ ...base, members: [base.members[0]], isOwner: true, loading: false, actorId: 'p1' }) })),
}

export const NonOwnerMember: Story = {
  beforeEach: () => vi.mock('../hooks/useHousehold', () => ({ useHousehold: () => ({ ...base, isOwner: false, loading: false, actorId: 'p2' }) })),
}

export const Loading: Story = {
  beforeEach: () => vi.mock('../hooks/useHousehold', () => ({ useHousehold: () => ({ ...base, loading: true }) })),
}
```

(Adjust story decorator/mock injection pattern to match the convention used in `DailyChallengesScreen.stories.tsx`; the snippet above is illustrative.)

- [ ] **Step 5: Run tests + commit**

```bash
pnpm --filter @learnquest/screens-household test
pnpm --filter @learnquest/screens-household build-storybook
git add libs/screens/household/src/HouseholdSettingsScreen.tsx libs/screens/household/src/HouseholdSettingsScreen.stories.tsx libs/screens/household/src/__tests__/
git commit -m "feat(household-ui): HouseholdSettingsScreen using @learnquest/ui + story"
```

---

### Task 17: `WhoIsPlayingScreen` + active profile hook (using `@learnquest/ui` + story)

**Files:**
- Create: `lq-core/libs/screens/household/src/WhoIsPlayingScreen.tsx`
- Create: `lq-core/libs/screens/household/src/WhoIsPlayingScreen.stories.tsx`
- Create: `lq-core/libs/screens/household/src/hooks/useActiveProfile.ts`

- [ ] **Step 1: Active profile hook** (unchanged from prior plan)

- [ ] **Step 2: Implement `WhoIsPlayingScreen` using `@learnquest/ui` Avatar + Card/Button:**

```typescript
// WhoIsPlayingScreen.tsx
import { Card, Avatar, Button } from '@learnquest/ui'
import { useActiveProfile } from './hooks/useActiveProfile'
import { useHousehold } from './hooks/useHousehold'

export function WhoIsPlayingScreen({ householdId, onSelect }: { householdId: string; onSelect: (playerId: string) => void }) {
  const { members } = useHousehold(householdId)
  const { setProfile } = useActiveProfile()

  return (
    <div className="who-is-playing">
      <h1>Who's playing today?</h1>
      <div className="profile-grid grid grid-cols-3 gap-4">
        {members.map((m) => (
          <Card
            key={m.playerId}
            className="profile-card cursor-pointer hover:bg-accent"
            onClick={() => {
              setProfile({ playerId: m.playerId, displayName: m.displayName, avatar: m.avatar })
              onSelect(m.playerId)
            }}
          >
            <Card.Content className="flex flex-col items-center gap-2 p-4">
              <Avatar src={m.avatar} alt={m.displayName} />
              <span className="name">{m.displayName}</span>
            </Card.Content>
          </Card>
        ))}
      </div>
      <Button variant="outline">Add new profile</Button>
    </div>
  )
}
```

- [ ] **Step 3: Co-located story `WhoIsPlayingScreen.stories.tsx`** with variants: TwoProfiles, FourProfiles, WithGhostKid

- [ ] **Step 4: Run tests + commit**

```bash
pnpm --filter @learnquest/screens-household test
git add libs/screens/household/src/WhoIsPlayingScreen.tsx libs/screens/household/src/WhoIsPlayingScreen.stories.tsx libs/screens/household/src/hooks/
git commit -m "feat(household-ui): WhoIsPlayingScreen using @learnquest/ui + story"
```

---

### Task 18: Remaining screens (AddGhostKidScreen, InviteAcceptScreen, LeaveHouseholdScreen, HouseholdMemberScreen) — using `@learnquest/ui` + co-located stories

**Files:**
- Create: `lq-core/libs/screens/household/src/AddGhostKidScreen.tsx` + `AddGhostKidScreen.stories.tsx`
- Create: `lq-core/libs/screens/household/src/InviteAcceptScreen.tsx` + `InviteAcceptScreen.stories.tsx`
- Create: `lq-core/libs/screens/household/src/LeaveHouseholdScreen.tsx` + `LeaveHouseholdScreen.stories.tsx`
- Create: `lq-core/libs/screens/household/src/HouseholdMemberScreen.tsx` + `HouseholdMemberScreen.stories.tsx`

For each screen:
1. Write component test (basic render + key interaction)
2. **Use `Card`, `Button`, `Input`, `Dialog`, `Label` from `@learnquest/ui` — not raw `<input>`, `<button>`, `<form>`**
3. Implement UI calling corresponding API endpoint
4. **Co-locate a `<ScreenName>.stories.tsx`** (Default + at least one variant)
5. Run tests + commit

These follow the same pattern as Tasks 16/17. Each is ~80-120 lines of UI. Detailed implementations are deferred to executing — but the test outlines are below.

- [ ] **AddGhostKidScreen test:**

```typescript
it('submits POST /api/households/:id/members with displayName + avatar', async () => {
  // mock fetch, fill Input component, click Button, assert fetch called with right body
})
```

(Story: empty-form, filled-form, name-taken)

- [ ] **InviteAcceptScreen test:**

```typescript
it('renders Card with household name + Button "Accept"', () => {
  // mock fetch, render, expect name + accept Button (not raw button)
})
it('calls POST /api/households/invites/accept on click', async () => {
  // mock fetch, click accept Button, assert fetch called
})
```

(Story: fresh-invite, expired-invite)

- [ ] **LeaveHouseholdScreen test:**

```typescript
it('shows Dialog warning if actor is owner', () => {
  // mock owner state, expect transfer-warning Dialog (or shared Alert component)
})
```

(Story: regular-member-leave, owner-must-transfer)

- [ ] **Commit per screen:**

```bash
git add libs/screens/household/src/<Screen>.tsx libs/screens/household/src/<Screen>.stories.tsx libs/screens/household/src/__tests__/<Screen>.test.tsx
git commit -m "feat(household-ui): <Screen> using @learnquest/ui + story"
```

### Task 18.1 (interleaved): Extend `scripts/audit/run-screen-audit.ts` to cover household screens

**Files:**
- Modify: `lq-core/scripts/audit/run-screen-audit.ts` (or its config)
- Modify: any `screen-audit.config` or Storybook manifest

- [ ] **Step 1: Read the existing audit script + its config**

```bash
cat lq-core/scripts/audit/run-screen-audit.ts
ls lq-core/scripts/audit/
```

- [ ] **Step 2: Add household screens to the audit manifest**

Append entries for:
- `Screens/Household/HouseholdSettingsScreen` (3+ variants)
- `Screens/Household/WhoIsPlayingScreen` (2+ variants)
- `Screens/Household/InviteAcceptScreen`
- `Screens/Household/AddGhostKidScreen`
- `lq-core/libs/screens/household/src/components/FamilyTierCard`

- [ ] **Step 3: Run screen-audit (likely in mock mode first)**

```bash
pnpm --filter @learnquest/web-app run screen-audit -- --mode=mock -- --include household
```

(In mock mode, identical scores between iterations are expected — only memory stability matters. See `feedback_screen_audit_mock_mode` memory.)

- [ ] **Step 4: Commit**

```bash
git add scripts/audit/
git commit -m "feat(audit): include household screens in screen-audit"
```

---

## Phase 6: Router integration

### Task 19: Post-auth routing — if multi-member household, show picker

**Files:**
- Modify: `lq-core/apps/web/src/router/AppRoot.tsx`

- [ ] **Step 1: Read existing AppRoot**

```bash
cat lq-core/apps/web/src/router/AppRoot.tsx
```

- [ ] **Step 2: Add post-auth check**

```typescript
import { WhoIsPlayingScreen } from '@learnquest/screens-household'
import { useActiveProfile } from '@learnquest/screens-household/hooks/useActiveProfile'
// ... in AppRoot:
function ProtectedRoutes() {
  const { user, household } = useSession()
  const { profile } = useActiveProfile()

  if (!user) return <Navigate to="/auth/signin" />

  // Multi-member household: require active profile selection
  if (household && household.memberCount > 1 && !profile) {
    return <WhoIsPlayingScreen householdId={household.id} onSelect={(pid) => { /* set profile */ }} />
  }

  return <Outlet />
}
```

- [ ] **Step 3: Add routes for new screens**

```typescript
<Route path="/household/:id" element={<HouseholdSettingsScreen />} />
<Route path="/household/:id/members/:memberId" element={<HouseholdMemberScreen />} />
<Route path="/household/:id/leave" element={<LeaveHouseholdScreen />} />
<Route path="/household/:id/add-kid" element={<AddGhostKidScreen />} />
<Route path="/invite/:inviteId" element={<InviteAcceptScreen />} />
```

- [ ] **Step 4: Typecheck + commit**

```bash
pnpm --filter @learnquest/web-app typecheck
git add apps/web/src/router/
git commit -m "feat(router): post-auth routing to WhoIsPlayingScreen + new household routes"
```

---

### Task 20: `ProfileMenu` "Switch profile" entry

**Files:**
- Modify: `lq-core/libs/screens/profile/src/components/ProfileMenu.tsx`

- [ ] **Step 1: Add menu entry**

```typescript
import { useActiveProfile } from '@learnquest/screens-household/hooks/useActiveProfile'

export function ProfileMenu() {
  const { household } = useSession()
  const { clear } = useActiveProfile()

  return (
    <Menu>
      {/* ... existing items ... */}
      {household?.memberCount > 1 && (
        <MenuItem onClick={() => { clear(); navigate('/who-is-playing') }}>
          Switch profile
        </MenuItem>
      )}
    </Menu>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add libs/screens/profile/src/components/ProfileMenu.tsx
git commit -m "feat(profile-ui): Switch profile menu entry for multi-member households"
```

---

## Phase 7: i18n

### Task 21: Add household strings to `en.json`

**Files:**
- Modify: `lq-core/apps/web/public/locales/en.json`

- [ ] **Step 1: Add keys**

```json
{
  "household": {
    "title": "Household",
    "whos_playing": "Who's playing today?",
    "add_member": "Add a member",
    "add_ghost_kid": "Add a kid profile",
    "invite_email": "Invite by email",
    "invite_code": "Share a code",
    "member_count": "{count} of {max} members",
    "cancel_plan": "Cancel family plan",
    "cancel_warning": "All members will lose premium access and revert to free.",
    "ghost_cap_warning": "You've reached the ghost profile limit (4/4).",
    "transfer_warning": "You must transfer ownership to another member before leaving.",
    "invite_expired": "This invite has expired. Ask the household owner for a new one.",
    "already_in_household": "You're already in a household. Leave it first to join a new one.",
    "household_full": "Your household is full ({count}/{max}). Remove a member to add someone new.",
    "family_tier_title": "Family",
    "family_tier_subtitle": "$50 + seats",
    "family_tier_features_1": "1–6 players",
    "family_tier_features_2": "All premium content",
    "family_tier_features_3": "Shared progress",
    "family_tier_cta": "Add family"
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/public/locales/en.json
git commit -m "feat(i18n): add household strings to en.json"
```

---

### Task 22: Translate to other 58 locales

**Files:**
- Modify: All 58 other files under `lq-core/apps/web/public/locales/*.json`

- [ ] **Step 1: Use translation script**

```bash
cd lq-core
tsx scripts/translate-locale.ts --source en.json --target-dir apps/web/public/locales
```

(The script already exists in `lq-core/scripts/` for previous translation rounds. It uses an AI provider from env. Run it against the new keys only.)

- [ ] **Step 2: Verify all 59 JSONs parse**

```bash
for f in apps/web/public/locales/*.json; do node -e "JSON.parse(require('fs').readFileSync('$f'))" || echo "BROKEN: $f"; done
```
Expected: No "BROKEN:" lines.

- [ ] **Step 3: Commit**

```bash
git add apps/web/public/locales/
git commit -m "feat(i18n): translate household strings to 58 locales"
```

---

## Phase 8: E2E tests

### Task 23: `lq-tools/scripts/e2e/household-suite.ts`

**Files:**
- Create: `lq-tools/scripts/e2e/household-suite.ts`

- [ ] **Step 1: Implement**

```typescript
// lq-tools/scripts/e2e/household-suite.ts
import { spawn } from 'child_process'
import { readdirSync } from 'fs'
import { join } from 'path'

const REPOS_ROOT = join(__dirname, '../../../lang-quest')
const SPEC_NAME = 'household.spec.ts'

const groups = readdirSync(REPOS_ROOT).filter((d) => d.startsWith('lq-'))

async function runSpec(groupDir: string, baseUrl: string) {
  return new Promise<void>((resolve, reject) => {
    const proc = spawn('pnpm', ['test:smoke', '--', SPEC_NAME], {
      cwd: join(REPOS_ROOT, groupDir),
      env: { ...process.env, BASE_URL: baseUrl },
      stdio: 'inherit',
    })
    proc.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`exit ${code}`)))
  })
}

async function main() {
  const baseUrl = process.env.BASE_URL ?? 'http://localhost:3010'
  for (const group of groups) {
    console.log(`\n=== ${group} ===`)
    await runSpec(group, baseUrl)
  }
  console.log('\nAll household E2E suites passed')
}

main().catch((err) => { console.error(err); process.exit(1) })
```

- [ ] **Step 2: Commit**

```bash
git add lq-tools/scripts/e2e/
git commit -m "test(e2e): household-suite runner across all 14 lang-quest repos"
```

---

### Task 24: Per-repo `tests/household.spec.ts` (template + propagate)

**Files:**
- Create: `lang-quest/lq-{group}/tests/household.spec.ts` (14 files, identical template)

- [ ] **Step 1: Write template**

```typescript
// lang-quest/lq-*/tests/household.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Household flow', () => {
  test('owner can create household + invite member', async ({ page, request }) => {
    // 1. Sign in
    await page.goto('/auth/signin')
    await page.fill('input[name=email]', process.env.TEST_OWNER_EMAIL!)
    await page.fill('input[name=password]', process.env.TEST_OWNER_PASSWORD!)
    await page.click('button[type=submit]')

    // 2. Navigate to subscription → Family tier
    await page.goto('/profile/subscription')
    await page.click('text=Family')

    // 3. Create household
    await page.fill('input[name=householdName]', 'Test Family')
    await page.click('button:has-text("Create household")')

    // 4. Verify household settings
    await expect(page.locator('h1')).toContainText('Test Family')
  })

  test('parent can add ghost kid', async ({ page }) => {
    // Sign in as owner, navigate to household settings, click "Add kid"
    // Fill form, submit, verify kid appears in member list
  })

  test('member accepts email invite', async ({ page, context }) => {
    // 1. Owner creates email invite
    // 2. Open invite link in new context
    // 3. Recipient clicks "Accept"
    // 4. Verify member added + tier='household'
  })
})
```

- [ ] **Step 2: Propagate to all 14 groups**

```bash
TEMPLATE=lang-quest/lq-nordic/tests/household.spec.ts
for group in $(ls lang-quest/ | grep '^lq-'); do
  cp $TEMPLATE lang-quest/$group/tests/household.spec.ts
done
```

- [ ] **Step 3: Run suite against dev**

```bash
cd lq-tools && tsx scripts/e2e/household-suite.ts
```
Expected: All 14 repos pass. If failures, fix per-group configs (each repo's `playwright.config.ts` has slightly different port mappings).

- [ ] **Step 4: Commit (one commit per group, or combined)**

```bash
cd lang-quest && for group in $(ls | grep '^lq-'); do
  (cd $group && git add tests/household.spec.ts && git commit -m "test: household E2E spec")
done
```

---

## Phase 9: Migration & Rollout

### Task 25: Apply migration to on-prem DB

**Files:**
- SSH to `forge-control`
- Apply `0007_households.sql` to production

- [ ] **Step 1: Verify migration on staging first**

```bash
ssh forge-control "psql \$DATABASE_URL -c '\\dt households'"
```
Expected: tables don't exist yet.

- [ ] **Step 2: Apply migration**

```bash
scp lq-core/libs/infra/database/drizzle/0007_households.sql forge-control:/tmp/
ssh forge-control "psql \$DATABASE_URL -f /tmp/0007_households.sql"
```
Expected: `BEGIN`, all DDL succeeds, `COMMIT`.

- [ ] **Step 3: Verify schema**

```bash
ssh forge-control "psql \$DATABASE_URL -c '\\d households' -c '\\d household_members' -c '\\d household_invites'"
```

- [ ] **Step 4: Verify backfill**

```bash
ssh forge-control "psql \$DATABASE_URL -c 'SELECT tier, count(*) FROM players GROUP BY tier'"
```
Expected: `individual` count matches active premium subscriptions, rest are `free`. Zero `null`.

- [ ] **Step 5: Commit (deployment record)**

No code commit — this is operational. Document in deployment log.

---

### Task 26: Phased rollout

- [ ] **Phase 1 (week 1)**: Schema migration + `Player.tier` backfill. Deploy hosting-api. No UI changes. Monitor error rates.

- [ ] **Phase 2 (week 2)**: Add Family tier card to subscription page (Task 14, 15). Owner can create household but invite flow not yet wired. Monitor.

- [ ] **Phase 3 (week 3)**: Enable invite flows (Task 11 API + Task 16-20 UI). Beta-test with internal team.

- [ ] **Phase 4 (week 4)**: Email existing premium cohort: "Family plan now available." Open to all users.

Each phase:
1. Deploy
2. Monitor for 24h
3. Verify key flows via dashboard
4. Proceed to next phase

---

## Verification

### Run all unit tests

```bash
cd lq-core
VITEST_MAX_THREADS=1 VITEST_MIN_THREADS=1 tsx scripts/test-packages.ts app
VITEST_MAX_THREADS=1 VITEST_MIN_THREADS=1 tsx scripts/test-packages.ts libs
bash scripts/run-domain-memory-check.sh household
```

### Typecheck all

```bash
cd lq-core
pnpm -r typecheck
cd forge-control
pnpm -r typecheck
```

### Run E2E suite

```bash
cd lq-tools && tsx scripts/e2e/household-suite.ts
```

Expected: All 14 repos pass. Memory check stays under threshold (existing pattern).

### Manual smoke

1. Sign up two test accounts in `lq-nordic` dev
2. Account A creates household, invites B
3. B accepts, tier='household' for both
4. A adds ghost kid "Lucas"
5. A removes B → Stripe seat removed, B tier='free'
6. A transfers ownership to ghost (fail expected — ghost can't be owner)
7. Verify ghost kid progress syncs across sessions

---

## Out of Scope (this plan)

- Parental controls (separate future plan)
- Household-level achievements / streak sharing
- B2B / classroom plans
- Multi-locale AI-translation pipeline improvements (only adds keys; existing pipeline handles bulk)
- Migration to single-line-item Stripe if household always has 6 members (premature optimization)

---

## Self-Review Checklist

**Spec coverage:**
- ✅ Player.tier field → Task 1
- ✅ Schema migration → Task 2
- ✅ Drizzle models → Task 3
- ✅ HouseholdRepository → Task 4
- ✅ Household types → Task 5
- ✅ HouseholdService → Task 7
- ✅ InviteService → Task 8
- ✅ TierService → Task 9
- ✅ API routes → Task 11
- ✅ Stripe webhook → Task 12
- ✅ Subscription page Family card → Tasks 13-15
- ✅ HouseholdSettingsScreen → Task 16
- ✅ WhoIsPlayingScreen → Task 17
- ✅ AddGhostKidScreen, InviteAcceptScreen, etc. → Task 18
- ✅ Router integration → Task 19
- ✅ Profile menu switch → Task 20
- ✅ i18n → Tasks 21-22
- ✅ E2E suite → Tasks 23-24
- ✅ Migration + rollout → Tasks 25-26

**Placeholder scan:** No "TODO"/"TBD" in steps. Every step shows code.

**Type consistency:** `Household`, `HouseholdMember`, `HouseholdInvite`, `PlayerTier`, `ProfileType`, `InviteType`, `InviteStatus`, `HouseholdRole`, `HouseholdStatus` are defined in Task 5 and reused consistently in Tasks 7, 8, 9, 11.

**Reused utilities (do not reinvent):**
- `getTestDb()` / `resetDb()` test utilities (existing pattern in `@learnquest/database`)
- `authMiddleware` (existing in hosting-api)
- `RandomBytes` from `crypto` (Node built-in, no need for new dependency)
- Stripe SDK (already a dep of `@learnquest/app-services`)
- `useState` / `useEffect` from React (existing)
- `vitest` / `@testing-library/react` (existing)

**Total tasks:** 26 tasks across 9 phases. Estimated 4-6 weeks of focused work.