# Family Profile + Multi-Member Household Design

**Status:** Approved (brainstorming complete)
**Date:** 2026-07-09
**Scope:** lq-core (data + service + UI) → flows automatically into all 14 lang-quest apps via `@learnquest/*` packages
**Pattern:** Duolingo Family Plan — household-account model with cross-device sync

## Build Target

This feature must be built **once in `lq-core`** and ship to all 14 language-group apps automatically via the existing `@learnquest/*` package consumption.

### Production stack (not Supabase)

The production deployment is **self-hosted on `forge-control` infrastructure at `blueforge.studio`** — **not Supabase**. The `@learnquest/database` abstraction supports multiple backends; the production wiring is:

- **DB**: `VITE_DB_PROVIDER=postgres` → Drizzle ORM with `pg` (node-postgres) against the on-prem Postgres connection string. Adapter at `libs/infra/database/src/postgres/PostgresAdapter.ts`; schema at `libs/infra/database/src/postgres/schema.ts`. The Supabase adapter (`VITE_DB_PROVIDER=supabase`) is a dev/legacy path that **is not used in production**.
- **Auth**: `AuthService` configured with `provider: 'forge'` → calls `platform-api` at `${apiUrl}/auth/{signin,signout,refresh,validate,signup}` for all auth flows. The Supabase auth path is a dev fallback.
- **Email**: Resend (existing `libs/common/email` package). No change.
- **Billing**: Stripe. No change.

The migration SQL in this spec targets **standard PostgreSQL** (uses `gen_random_uuid()`, `TIMESTAMPTZ`, partial unique indexes — all vanilla Postgres features). It will run on the on-prem database without Supabase-specific extensions.

The data layer abstraction (`@learnquest/database`) means the new `Household` / `HouseholdMember` / `HouseholdInvite` tables are defined once in the Drizzle schema and become available through the same `IDatabase` interface that all collections already implement. No Supabase-specific RLS, edge functions, or auth hooks are involved.

### Where things live in `lq-core`

- **Data model + migrations + service layer** → `lq-core/libs/infra/database` and `lq-core/libs/app/app-services`
- **New screens + components** → `lq-core/libs/screens/household` (new package) + reuse existing components from `libs/screens/profile`, `libs/screens/onboarding`, `libs/screens/auth`
- **i18n strings** → added to `lq-core/apps/web/public/locales/*.json`; all 14 lang-quest apps inherit on next packr publish
- **Stripe products** → created once in the platform-api/lq-billing service; all apps share the same Stripe customer

### Migration approach

The on-prem Postgres adapter uses Drizzle ORM but does not yet have a `drizzle/` migration directory. The existing convention (from sibling forge projects like `hosting-database`) is to use **`drizzle-kit generate` + manual SQL review** for schema changes. The migration in this spec follows that pattern: a numbered migration file (e.g., `0007_households.sql`) with the SQL up/down, applied to the on-prem DB via the `drizzle-kit migrate` command or the platform-api's migration runner.

**Unit tests in lq-core** (per-domain harness):

```bash
VITEST_MAX_THREADS=1 VITEST_MIN_THREADS=1 \
  tsx lq-core/scripts/test-packages.ts app
VITEST_MAX_THREADS=1 VITEST_MIN_THREADS=1 \
  tsx lq-core/scripts/test-packages.ts libs
bash lq-core/scripts/run-domain-memory-check.sh household  # new domain
```

**E2E tests added to existing Playwright harnesses** — the 14 lang-quest repos under `lang-quest/lq-*/` each have a `playwright.smoke.config.ts` and `tests/smoke.spec.ts`. The new household flow gets a `tests/household.spec.ts` per repo, all running the same scenarios (owner upgrades, invites member, ghost add, member removal). Each repo's `pnpm test:smoke` continues to work; `BASE_URL` override lets the same tests run against `localhost:3010` (dev) or `https://nordic-quest.blueforge.studio` (deployed).

A shared `lq-tools/scripts/e2e/household-suite.ts` will run the household spec across all 14 repos in sequence, reusing the memory-check pattern.

## Problem

The current lq-core player model is single-player-per-install:

- `Player` is the canonical identity (Supabase auth user + profile)
- `Player.subscription` is per-player; the only paid tier is **individual** at $50/yr
- There's no concept of "household" or "family"
- A family sharing a tablet must log in/out to switch players — clunky, and each member needs their own Supabase email

**User need (verbatim):** "I would like the lq-core to allow for having multiple players created on a single installation if installed on a phone or tablet - instead of being locked to one player. Then I'd like to have a family package, where multiple family members can each have a profile playing on the same tablet at a reduced price per family member."

**Concrete example:** A father, mother, and son all want to learn Danish on the same iPad. Today, this requires three Supabase accounts, three logins, three subscriptions, and a lot of friction.

## Goals

1. **Multiple players per device** without re-authentication for the parent
2. **Cross-device sync** — a kid's progress on dad's tablet is available on dad's phone
3. **Family pricing** that reduces per-member cost when grouped under a household
4. **Backward-compatible** — existing premium ($50/yr) players keep their subscription
5. **COPAA-friendly** by default — the path of least resistance for parents is also the safest path for kids

## Non-Goals

- Cross-household sharing (e.g., "my friend can borrow my family plan")
- Parental controls / content gating (separate future feature)
- Streak inheritance between members
- Group lessons across household members
- B2B / team plan (separate future feature)

## Decisions Made

| Question | Decision |
|---|---|
| Family model | B: Household account with cross-device sync (Duolingo model) |
| Member join flow | Both — email invite for adults, code for kids |
| Kid accounts | Both — parent picks per kid: ghost (no auth) or full account (own email) |
| Subscription tier model | Tiered — free / individual / family household (mutually exclusive) |
| Family pricing structure | Per-seat: $30/yr per additional member, max 6 members |
| Ghost kid pricing | Free (with 4-cap per household to prevent abuse) |
| Owner exit | Owner must transfer ownership first before leaving |

## Data Model

### New entities

```ts
interface Household {
  id: string                  // UUID
  name: string                // "The Smiths" — owner-set
  ownerId: string             // FK to Player
  subscriptionId?: string     // FK to Subscription (the family plan; null until upgraded)
  maxMembers: number = 6
  status: 'active' | 'dissolved'  // soft-delete for analytics
  createdAt: string
  updatedAt: string
  dissolvedAt?: string
}

interface HouseholdMember {
  id: string                  // UUID
  householdId: string         // FK
  playerId: string            // FK to Player
  role: 'owner' | 'member'    // owner = billing + invite rights; only one per household
  profileType: 'full' | 'ghost'  // 'full' = own Supabase auth; 'ghost' = parent-managed
  invitedBy: string           // FK to Player
  joinedAt: string
  removedAt?: string
  inviteStatus: 'pending' | 'active' | 'removed'
}

interface HouseholdInvite {
  id: string                  // UUID
  householdId: string         // FK
  type: 'email' | 'code'      // how the invite is delivered
  email?: string              // populated when type='email'
  code?: string               // 6-char alphanum, populated when type='code'
  profileType: 'full' | 'ghost'  // what kind of profile this invite creates
  status: 'pending' | 'accepted' | 'expired' | 'revoked'
  expiresAt: string           // 7 days from creation
  createdBy: string           // FK to Player
  acceptedBy?: string         // FK to Player
  acceptedAt?: string
}
```

### New field on `Player`

```ts
type PlayerTier = 'free' | 'individual' | 'household';

interface Player {
  // ... existing fields ...
  tier: PlayerTier  // NEW
}
```

**State machine:**

- `tier='free'` — no subscription, not in a household. Default for new signups.
- `tier='individual'` — has `Player.subscription` set (the existing $50/yr path). No migration needed for existing premium users; they auto-classify.
- `tier='household'` — is in a `HouseholdMember` row, and that household has a subscription.

**Data invariant:** `tier='household'` ↔ `HouseholdMember` row exists with `inviteStatus='active'`. The Player belongs to **at most one** household.

### Relationships

```
Player ──┬── 1:1 ──── Player.subscription   (existing, only for tier='individual')
         └── 1:0..1 ── HouseholdMember ── 1:N ── Household
                                                │
                                                └── 1:0..1 ── Subscription  (the family plan)
```

A `Household` has **1 to 6** members (configurable via `Household.maxMembers`, default 6).

## Subscription & Billing

### Stripe topology

- **Product A** (existing): `lq-individual` — $50/yr. Used for the owner's seat in a family household.
- **Product B** (new): `lq-family-seat` — $30/yr. One per additional member.
- **Family household = 1 Stripe Subscription, multiple line items:**
  - Line item 1: `lq-individual` ($50, always present, assigned to owner)
  - Line items 2-6: `lq-family-seat` ($30 each, one per added member)

### Pricing

| Household composition | Yearly cost |
|---|---|
| Solo free | $0 |
| Solo individual (no household) | $50 |
| 1 owner only (just created household) | $50 |
| Owner + 1 full member | $80 |
| Owner + 2 full members | $110 |
| Owner + 5 full members | $200 (max full) |
| Owner + 1 full + 1 ghost kid | $80 |
| Owner + 5 full + 4 ghost | $200 (max possible) |

Ghost kids are free (no Stripe line item). Cap: 4 ghost kids per household.

### Why multiple line items, not tiered pricing

- Adding a member = add a `lq-family-seat` line item. Stripe auto-prorates.
- Removing a member = remove the line item. Stripe auto-credits.
- Webhooks (`invoice.paid`, `customer.subscription.updated`, `customer.subscription.deleted`) are the source of truth for `Household.subscription.status`.
- No tiered-pricing hack — Stripe quantity adjustments are first-class.

### Billing events

| Event | Server action |
|---|---|
| Owner upgrades solo → family | Create Household, set tier='household', add `lq-individual` line item, status='active' |
| Member accepts invite | Add `lq-family-seat` line item; prorate charge |
| Owner removes a member | Remove `lq-family-seat` line item; prorate credit |
| Member leaves voluntarily | Remove line item; member's tier reverts to 'free' |
| Owner cancels family plan | Cancel entire Stripe subscription; all members revert to 'free'; household.status='dissolved' |
| Owner transfers ownership | No Stripe change; just update HouseholdMember.role |
| Ghost kid added | Insert `HouseholdMember` row + Player record; no Stripe change |

## Join Flows

### Email invite (for full-account members)

```
[Owner] → HouseholdSettings → "Invite member" → "Email"
        → Enter email, pick profileType='full'
        → Submit
            ↓
[Server] POST /api/households/{id}/invites { email, profileType: 'full' }
            ↓
        - Create HouseholdInvite { type: 'email', code: <random>, expiresAt: now+7d }
        - Send via Resend: link https://lq-site/invite/{inviteId}?token={code}
            ↓
[Recipient] clicks link
            ↓
        - If not logged in: redirect to signup, then back to invite accept
        - If logged in: "Join {householdName} as a full-account member?" → confirm
            ↓
[Server] POST /api/households/invites/{inviteId}/accept
            ↓
        - Validate: invite.status='pending', not expired, household.memberCount < 6
        - Update Player.tier = 'household'
        - Create HouseholdMember { role: 'member', profileType: 'full' }
        - Mark invite.status = 'accepted'
        - Add lq-family-seat line item
        - Email owner: "{email} joined your household"
```

### Code invite (for full-account kids, since they may not check email)

```
[Owner] → HouseholdSettings → "Invite member" → "Code"
        → Pick profileType='full'
        → System generates 6-char code (e.g., "K7M2PX")
        → Owner shares verbally
            ↓
[Recipient] Settings → "Join family with code"
        → Enters code
            ↓
[Server] POST /api/households/join { code }
            ↓
        - Find HouseholdInvite { type: 'code', code, status: 'pending' }
        - Same validation as email accept
        - Create HouseholdMember, mark invite accepted, add Stripe seat
```

### Direct add for ghost kids (parent-only)

```
[Owner] → HouseholdSettings → "Add kid" → "Ghost profile"
        → Enter kid's name, pick avatar
        → Submit
            ↓
[Server] POST /api/households/{id}/members { profileType: 'ghost', displayName, avatar }
            ↓
        - Validate: ghostCount < 4
        - Create Player record (no Supabase auth)
        - Create HouseholdMember { role: 'member', profileType: 'ghost' }
        - No Stripe line item
```

### "Who's playing?" picker

Whenever a parent in a multi-member household authenticates, the app routes to a profile picker:

- **1 member** (parent alone): skip picker, go to dashboard
- **2+ members**: show `WhoIsPlayingScreen`
- Active profile is **session-scoped** (sessionStorage), not persisted to Supabase
- Next app launch shows the picker again — avoids "I forgot which kid was last on"
- For full-account members, the active profile is always their own (picker is for ghost kids)
- Parent can switch profiles mid-session via Profile menu → "Switch profile"

## UX Surfaces

### New screens

| Screen | Audience | Purpose |
|---|---|---|
| `HouseholdSettingsScreen` | Owner | Manage household: name, members, invites, billing |
| `HouseholdMemberScreen` | Owner | View member's progress, remove, change role |
| `LeaveHouseholdScreen` | Member (not owner) | Confirm leaving, warn about losing premium |
| `WhoIsPlayingScreen` | Parent in multi-member household | Pick active profile (session-scoped) |
| `InviteAcceptScreen` | Invited recipient | Review household, confirm join |
| `AddGhostKidScreen` | Owner | Name + avatar for new ghost profile |

### Modified screens

| Screen | Modification |
|---|---|
| `SubscriptionPage` | Add "Family" tier card. Slider: 1-6 members. Live price preview. |
| `ProfileMenu` | "Switch profile" entry if multi-member household |
| `OnboardingWelcomeScreen` | "Add family members later" link (non-blocking) |
| `AppRoot` (router) | Post-auth: if household has >1 member, route to `WhoIsPlayingScreen` |

### HouseholdSettingsScreen layout

```
← Household                              ⋮
─────────────────────────────────────────────
The Smiths
Family plan · 3 of 6 members
Renews Jan 15, 2027 · $110/yr
─────────────────────────────────────────────
MEMBERS                          [+ Invite]
  ◯ 👩  Maria (you, owner)
  ◯ 👨  Anders            [Member] [⋯]
  ◯ 🧒  Lucas  (ghost)   [Member] [⋯]
─────────────────────────────────────────────
BILLING
  Stripe customer · visa ****4242
  [Update payment method]  [View invoices]
─────────────────────────────────────────────
HOUSEHOLD ACTIONS
  [Rename household]
  [Cancel family plan]
  [Transfer ownership]  (if not solo owner)
```

### WhoIsPlayingScreen layout

```
        Who's playing today?
─────────────────────────────────────────────
  ┌─────┐  ┌─────┐  ┌─────┐
  │ 👩  │  │ 👨  │  │ 🧒  │
  │Maria│  │Anders│ │Lucas│
  │  L12│  │  L 8│  │  L 3│
  └─────┘  └─────┘  └─────┘

  [Add new profile]
```

### Subscription page — Family tier

```
┌──────────────┐  ┌──────────────────┐  ┌──────────────┐
│  Free        │  │  Individual      │  │  Family      │
│  $0          │  │  $50/yr          │  │  $50 + seats │
│              │  │                  │  │              │
│  • 1 player  │  │  • 1 player      │  │  • 1-6       │
│  • Basic     │  │  • All premium   │  │    players   │
│    content   │  │    content       │  │  • All       │
│              │  │                  │  │    premium   │
│              │  │                  │  │  • Shared    │
│              │  │                  │  │    progress  │
│ [Current]    │  │  [Upgrade]       │  │  [Add family]│
└──────────────┘  └──────────────────┘  └──────────────┘
```

### Localized strings (i18n)

New strings to add to all 59 language JSONs in `apps/web/public/locales/`:

- `household.title` = "Household"
- `household.whos_playing` = "Who's playing today?"
- `household.add_member` = "Add a member"
- `household.add_ghost_kid` = "Add a kid profile"
- `household.invite_email` = "Invite by email"
- `household.invite_code` = "Share a code"
- `household.member_count` = "{count} of {max} members"
- `household.cancel_plan` = "Cancel family plan"
- `household.cancel_warning` = "All members will lose premium access and revert to free."

## Migration

### Schema migration (one-time, runs at deploy)

```sql
-- 1. Add tier column (nullable, backfill, then NOT NULL)
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

-- 2. New tables
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
CREATE INDEX idx_household_members_player ON household_members(player_id)
  WHERE invite_status = 'active';
CREATE UNIQUE INDEX idx_household_members_one_active_per_player
  ON household_members(player_id) WHERE invite_status = 'active';

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
```

### What this migration does NOT do

- **Doesn't touch `Player.subscription`** — the existing individual subscription path is unchanged
- **Doesn't auto-create households** for premium players
- **Doesn't grandfather** — there's nothing to grandfather since existing pricing is preserved at $50/yr
- **Doesn't require re-auth** — existing sessions keep working

### Rollout

- **Phase 1 (week 1)**: Schema migration + `Player.tier` backfill. No UI changes. Verify no regressions.
- **Phase 2 (week 2)**: Add "Family" tier card on subscription page. New tier is opt-in only.
- **Phase 3 (week 3)**: Add household settings screen, invite flows, profile picker.
- **Phase 4 (week 4)**: Email existing premium cohort: "Family plan now available."

## Error Handling

| Failure | UX behavior |
|---|---|
| Stripe webhook dropped | Cron sweep reconciles `Household.subscription.status` against Stripe API daily |
| Invite link expired | Show "This invite has expired. Ask the household owner for a new one." |
| Recipient already in a household | "You're already in a household. Leave it first to join a new one." |
| Household at member cap | "Your household is full (6/6). Remove a member to add someone new." |
| Ghost kid cap reached | "You've reached the ghost profile limit (4/4)." |
| Owner tries to leave without transfer | "Transfer ownership to another member before leaving." |
| Cross-household conflict (e.g., owner in 2 households) | Defensive: reject. Single-owner invariant enforced by partial unique index |

## Testing Strategy

### Unit tests
- `householdService.create(ownerId, name)` — happy path, duplicate name allowed, owner tier validation
- `householdService.addMember(householdId, profileType, ...)` — ghost cap, full cap, role validation
- `householdService.removeMember(householdId, memberId)` — owner can't be removed without transfer
- `householdService.transferOwnership(householdId, fromOwnerId, toMemberId)` — recipient must be 'member' role, both in same household
- `inviteService.create(householdId, type, ...)` — code uniqueness, email format
- `inviteService.accept(inviteId, playerId)` — expired, revoked, already-accepted, household full
- `tierService.upgrade(householdId, memberCount)` — Stripe proration math, line item creation
- `tierService.cancel(householdId)` — all members revert, household dissolved, Stripe sub canceled
- `Player.tier` invariant — cannot be 'household' without active `HouseholdMember` row (defensive)

### Integration tests
- Email invite round-trip: owner creates invite → recipient accepts → tier='household' for both → Stripe seat added
- Ghost kid direct add: owner adds Lucas → Player record created without auth → WhoIsPlayingScreen shows Lucas → parent selects Lucas → progress loads
- Member removal: owner removes Anders → Stripe seat removed → Anders tier='free' → HouseholdMember.removedAt set
- Transfer ownership: owner transfers to Anders → Anders.role='owner', previous owner.role='member' → previous owner can now leave
- Cross-household conflict: player accepts invite to household B while in household A → reject with clear error

### E2E (Playwright, BASE_URL override)
- `BASE_URL=https://nordic-quest.blueforge.studio pnpm test:smoke -- --household-flow` — runs smoke tests covering post-deploy household flow
- Visual regression on `WhoIsPlayingScreen` and `HouseholdSettingsScreen`

### Manual QA
- COPPA scenario: parent with 8-year-old son, no email for son → ghost profile → confirm progress syncs via parent session
- iPad shared use: dad + mom + son all play Danish on same iPad → profile picker works correctly
- Owner leaves: ownership transfer → leave → billing continues for new owner

## Out of Scope (Future Features)

- **Parental controls** — content gating, screen time limits, daily XP caps per kid
- **Streak sharing** — household-wide streak leaderboard
- **Cross-household gifts** — "gift a family plan" to a friend
- **B2B / classroom** — teachers adding students, multi-household dashboard
- **Bilingual household** — household-wide language preference (different from per-player `groups: string[]`)
- **Family achievements** — household-level milestones (e.g., "5,000 total XP this month")
- **Activity feed for owner** — "Lucas completed Chapter 3 today"

## Implementation Phases (high-level)

This design is intended to be implemented in a single multi-week effort. A future plan (writing-plans skill output) will break it into tasks with test cases per task. The rough phases:

1. **Data layer**: SQL migration, drizzle schema, household/member/invite repositories
2. **Stripe integration**: multi-line-item subscription, webhooks, proration
3. **Service layer**: householdService, inviteService, tierService with unit tests
4. **API layer**: REST endpoints for invites, members, household CRUD
5. **UI — subscription page**: family tier card, member slider, live price preview
6. **UI — household settings**: name, members, billing, actions
7. **UI — invite flows**: email, code, direct add
8. **UI — profile picker**: WhoIsPlayingScreen, switch profile in menu
9. **UI — i18n**: 59 language JSONs
10. **E2E + rollout**: phased migration per the rollout section above
