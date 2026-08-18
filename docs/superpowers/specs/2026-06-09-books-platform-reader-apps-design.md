# Books Platform Reader Apps — Design Specification

**Date:** 2026-06-09
**Status:** Approved
**Approach:** Strangler Fig (extract from story-book, then upgrade interactive-book)

## Overview

Design specification for modernizing the two reader apps (`lq-story-book` and `lq-interactive-book`) and extracting shared infrastructure into a new `@learnquest/books-reader` package and `books-api` Express server.

### Design Decisions

| Decision | Choice |
|----------|--------|
| Auth | forge-auth via better-auth (LinguaQuest `useForgeAuth` pattern) |
| Database | PostgreSQL 16 via Drizzle ORM + `postgres` driver |
| API layer | Express REST API with JWT middleware (LinguaQuest `apps/api` pattern) |
| Infrastructure | forge-control (Docker local, Hetzner prod) — zero Supabase, zero SaaS |
| Shared UI | `@learnquest/books-reader` package for common primitives |
| App-specific | Reading UX stays per-app (page-turner vs. state machine branching) |
| Monetization | Freemium: free ch1, $10/book or $50/month subscription |
| Content | Pipeline-first, i18n later |
| Quality | WCAG 2.1 AA, axe-core CI, Lighthouse CI, visual regression CI, contract tests |

---

## Architecture

### Service Map

All external services go through `@blueforge-studio/service-factory` adapters, env-var-switched:

| Concern | Local (Docker) | Production | Adapter |
|---------|---------------|------------|---------|
| Database | PostgreSQL 16 | PostgreSQL 16 (forge-control) | `DB_ADAPTER=pg` |
| Auth | forge-auth (localhost:3580) | auth.blueforge.studio | `AUTH_PROVIDER=better_auth` |
| Storage | MinIO (localhost:9000) | Backblaze B2 | `STORAGE_PROVIDER=backblaze_b2` |
| Cache | In-memory | Valkey/Redis | `CACHE_PROVIDER=upstash` / `memory` |
| Queue | In-memory | BullMQ on Valkey | `QUEUE_PROVIDER=bullmq` / `memory` |
| Email | Console | Mailstack | `EMAIL_PROVIDER=mailstack` |
| Error Tracking | Console | Self-hosted endpoint | `ERROR_TRACKER_PROVIDER=self-hosted` |
| Analytics | Console | Self-hosted endpoint | `ANALYTICS_PROVIDER=self-hosted` |

### Data Flow

```
Vite + React App (lq-story-book / lq-interactive-book)
  │
  ├── booksApi (typed fetch client)
  │     └── HTTP ──→ apps/books-api (Express, port 3009)
  │                    ├── authMiddleware (forge-auth JWT via jose)
  │                    ├── Repository (Drizzle ORM)
  │                    └── PostgreSQL 16
  │
  ├── ContentService (static JSON via books-shared)
  │     └── public/data/books/en/ (local) or R2 (prod)
  │
  └── @learnquest/books-reader (shared UI primitives)
        ├── AuthProvider, AuthModal
        ├── BookCatalogue, BookCard
        ├── VocabularyHotspot, QuizRunner
        ├── BookHUD, EndingScreen
        ├── XPTracker, ReadingProgress
        ├── ThemeProvider, ErrorBoundary
        ├── EntitlementGate, useEntitlements
        └── useAnalytics, useErrorTracker
```

---

## New Infrastructure

### `apps/books-api` — Express API Server (port 3009)

```
apps/books-api/
  package.json
  tsconfig.json
  drizzle.config.ts
  drizzle/
    0000_initial.sql
    0001_triggers_and_seed.sql
  src/
    index.ts                    # Express app entry
    db/
      schema.ts                 # Drizzle pgTable definitions
      index.ts                  # drizzle(postgres(url), { schema })
      withJwtSession.ts         # Transaction + SET LOCAL ROLE + JWT claims
    auth/
      authMiddleware.ts         # JWT verification via jose (forge-auth tokens)
    routes/
      books.ts                  # GET /api/books, GET /api/books/:id
      progress.ts               # GET/PUT /api/progress/:userId
      entitlements.ts           # GET /api/entitlements/:userId
      content.ts                # GET /api/content/:bookId/:sceneId
    services/
      BookRepository.ts
      ProgressRepository.ts
      EntitlementRepository.ts
```

### Database Schema (Drizzle ORM)

```sql
CREATE TABLE user_books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  book_id TEXT NOT NULL,
  purchased_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, book_id)
);

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  plan TEXT NOT NULL DEFAULT 'monthly',
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE reading_progress (
  user_id TEXT NOT NULL,
  book_id TEXT NOT NULL,
  scene_id TEXT NOT NULL,
  xp_earned INT DEFAULT 0,
  completed_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, book_id, scene_id)
);
```

### Repository Pattern

Constructor-injected `db` for transaction support, following LinguaQuest's `PlayerDataRepository`:

```typescript
export class EntitlementRepository {
  constructor(private readonly db: BookDB) {}

  async userOwnsBook(userId: string, bookId: string): Promise<boolean> {
    const row = await this.db.query.userBooks.findFirst({
      where: and(eq(userBooks.userId, userId), eq(userBooks.bookId, bookId)),
    });
    return !!row;
  }

  async hasActiveSubscription(userId: string): Promise<boolean> {
    const row = await this.db.query.subscriptions.findFirst({
      where: and(
        eq(subscriptions.userId, userId),
        eq(subscriptions.status, 'active'),
        gt(subscriptions.currentPeriodEnd, new Date()),
      ),
    });
    return !!row;
  }
}
```

### JWT Middleware Pattern

Ported from LinguaQuest `apps/api/src/auth/authMiddleware.ts`:
- Extract `Bearer` token from `Authorization` header
- Verify HS256 signature via `jose` library
- Attach decoded claims to `req.user`
- Return 401 on invalid/missing token

### withJwtSession Pattern

Ported from LinguaQuest `apps/api/src/db/withJwtSession.ts`:
- Start Postgres transaction
- `SET LOCAL ROLE authenticated`
- `SET LOCAL "request.jwt.claims" = '<json>'`
- Run callback within transaction scope
- Auto-revert on transaction end

### Frontend API Client

Typed fetch wrappers, following LinguaQuest's `content-api.ts`:

```typescript
const API_BASE = import.meta.env.VITE_BOOKS_API_URL ?? 'http://localhost:3009';

export const booksApi = {
  getEntitlements: (userId: string, bookId: string) =>
    apiFetch<EntitlementsResponse>(`/api/entitlements/${userId}?bookId=${bookId}`),
  getProgress: (userId: string) =>
    apiFetch<ProgressResponse>(`/api/progress/${userId}`),
  saveProgress: (userId: string, data: ProgressUpdate) =>
    apiFetch<ProgressResponse>(`/api/progress/${userId}`, {
      method: 'PUT', body: JSON.stringify(data),
    }),
};
```

---

## `@learnquest/books-reader` — Shared Package

**Location:** `books-platform/packages/books-reader/`
**Depends on:** `@learnquest/books-shared`, `@blueforge-studio/service-factory`, `better-auth/react`

### Exports

| Export | Type | Description |
|--------|------|-------------|
| `AuthProvider` | Context + Hook | forge-auth via `better-auth/react` `createAuthClient` |
| `AuthModal` | Component | Google OAuth + email/password login/signup (ported from LinguaQuest) |
| `ThemeProvider` | Context + Hook | Dark/light/system toggle, localStorage persisted |
| `BookCatalogue` | Component | Grid of book cards with cover, metadata, difficulty, genre, free/premium badge |
| `BookCard` | Component | Individual book card |
| `BookContentLoader` | Hook | Loads manifest + meta + scenes via ContentService with loading/error states |
| `BookHUD` | Component | Top bar: chapter title, progress bar, XP, pause button, settings |
| `VocabularyHotspot` | Component | Clickable word → definition popover + Web Speech API pronunciation |
| `QuizRunner` | Component | Multiple-choice with correct/incorrect feedback + explanation |
| `EndingScreen` | Component | Stats: XP, comprehension %, choices made, words learned, achievements |
| `XPTracker` | Context + Hook | XP accumulation, localStorage-first, cloud-sync via booksApi |
| `ReadingProgress` | Context + Hook | Scene/chapter tracking, localStorage + cloud sync |
| `EntitlementGate` | Component | Queries booksApi, renders children or paywall |
| `useEntitlements` | Hook | Book ownership + subscription status |
| `useAnalytics` | Hook | Typed reading telemetry events via service-factory analytics adapter |
| `useErrorTracker` | Hook | Exception capture + user context via service-factory error-tracking adapter |
| `ErrorBoundary` | Component | React error boundary with retry |
| `booksApi` | Client | Typed fetch wrappers for books-api |

### Package Structure

```
packages/books-reader/
  src/
    index.ts
    api/
      client.ts
    auth/
      AuthProvider.tsx
      AuthModal.tsx
      useAuth.ts
    entitlements/
      EntitlementGate.tsx
      useEntitlements.ts
    catalogue/
      BookCatalogue.tsx
      BookCard.tsx
    reading/
      VocabularyHotspot.tsx
      QuizRunner.tsx
      BookHUD.tsx
      EndingScreen.tsx
      XPTracker.tsx
      ReadingProgress.tsx
      BookContentLoader.ts
    analytics/
      useAnalytics.ts
      events.ts
    error-tracking/
      useErrorTracker.ts
      ErrorBoundary.tsx
    theme/
      ThemeProvider.tsx
```

---

## `lq-story-book` Redesign

### Component Changes

| Current | Replaced By | Source |
|---------|-------------|--------|
| Stub `useAuth` | `AuthProvider` | books-reader |
| `SignInModal` | `AuthModal` | books-reader |
| `BookCatalogue` + `BookCard` | Shared components | books-reader |
| `StoryTopbar` | `BookHUD` | books-reader |
| `ComprehensionCheck` | `QuizRunner` | books-reader |
| Inline vocab in `StoryPage` | `VocabularyHotspot` | books-reader |
| `EndingScene` | `EndingScreen` | books-reader |
| Ad-hoc XP | `XPTracker` context | books-reader |
| `ThemeToggle` + `useTheme` | `ThemeProvider` | books-reader |
| Manual content loading | `BookContentLoader` | books-reader |
| No paywall | `EntitlementGate` | books-reader |
| No analytics | `useAnalytics` | books-reader |
| No error boundary | `ErrorBoundary` | books-reader |

### App-Specific Components (page-turning UX)

| Component | Role |
|-----------|------|
| `HeroBanner` | Landing page gradient hero with tagline + CTAs |
| `BookIntro` | Cover + title + description + "Begin Reading" CTA |
| `SceneRenderer` | Dispatches scene type → correct sub-component |
| `StorySceneLayout` | Page-turner: Back/Next, page dots, Framer Motion transitions |
| `StoryPage` | Single page: text, image, read-aloud button (SpeechSynthesis) |
| `ChoiceScene` | Branching choice cards with XP previews |
| `VocabularyScene` | Card-flip word review (must reveal all to continue) |

### Component Tree

```
App
├── ThemeProvider, AuthProvider, ErrorBoundary      # books-reader
├── Header
│   ├── ThemeToggle                                 # books-reader
│   └── UserMenu → AuthModal                        # books-reader
├── Routes
│   ├── / (HomeScreen)
│   │   ├── HeroBanner                              # app-specific
│   │   └── BookCatalogue                           # books-reader
│   │       └── BookCard[] (with EntitlementGate badge)
│   └── /book/:id (StoryBookScreen)
│       ├── EntitlementGate                         # books-reader
│       │   ├── BookIntro                           # app-specific
│       │   └── PaywallModal                        # books-reader
│       ├── BookHUD                                 # books-reader
│       └── SceneRenderer                           # app-specific
│           ├── StorySceneLayout + StoryPage[]
│           │   └── VocabularyHotspot[]             # books-reader
│           ├── ChoiceScene + ChoiceCard[]
│           ├── QuizRunner                          # books-reader
│           ├── VocabularyScene + WordRevealCard[]
│           └── EndingScreen                        # books-reader
```

### State Management

| Concern | Mechanism |
|---------|-----------|
| Auth | `AuthProvider` (books-reader) |
| Theme | `ThemeProvider` (books-reader) |
| XP | `XPTracker` (books-reader) |
| Progress | `ReadingProgress` (books-reader) |
| Content | `BookContentLoader` (books-reader) |
| Scene nav | Local `useState` in `StoryBookScreen` (app-specific) |
| Page nav | Local `useState` in `StorySceneLayout` (app-specific) |
| Read-aloud | Local `useState` in `StoryPage` (app-specific) |

### UX Improvements

1. **Read-aloud word-level sync** — highlight spoken word via SpeechSynthesis `onboundary` event. Play/pause button, speed control (0.5x–2x).
2. **Page transitions** — Framer Motion `AnimatePresence` for page turns.
3. **Vocabulary journal** — "My Words" list in pause menu, shows word/definition/source.
4. **Resume reading** — "Continue Reading" card at top of catalogue if progress exists.
5. **Achievement toasts** — Animated XP threshold and milestone notifications.
6. **Offline support** — Service worker caches static JSON content.

---

## `lq-interactive-book` Redesign

### Component Changes

| Current | Replaced By | Source |
|---------|-------------|--------|
| No auth | `AuthProvider` + `AuthModal` | books-reader |
| `BookSelect` | `BookCatalogue` + `BookCard` | books-reader |
| Inline vocab | `VocabularyHotspot` | books-reader |
| `ComprehensionScene` | `QuizRunner` | books-reader |
| `BookHUD` | `BookHUD` (shared) | books-reader |
| `EndingScene` | `EndingScreen` | books-reader |
| Ad-hoc XP | `XPTracker` (synced with machine) | books-reader |
| No theme | `ThemeProvider` | books-reader |
| Manual loading | `BookContentLoader` | books-reader |
| No paywall | `EntitlementGate` | books-reader |
| No analytics | `useAnalytics` (machine-driven events) | books-reader |
| No error boundary | `ErrorBoundary` | books-reader |
| No persistence | Machine state → localStorage + cloud sync | New |
| Single-chapter only | Multi-chapter content + guard | New |

### App-Specific Components (XState branching engine)

| Component | Role |
|-----------|------|
| `InteractiveBookScreen` | Orchestrator — wires XState machine to view components |
| `machine.ts` | 12-state XState v5 machine (extended for persistence + analytics) |
| `StoryScene` | Narrative text (uses shared `VocabularyHotspot` internally) |
| `ChoiceScene` | Branching decision cards |
| `CharacterReadyView` | Book intro (machine state: `characterReady`) |
| `PausedView` | Pause overlay (machine state: `paused`) |
| `ChapterCompleteView` | Chapter celebration (machine state: `chapterComplete`) |
| `NextChapterView` | Next chapter transition (machine state: `nextChapter`) |
| `BookCompleteView` | Story complete (machine state: `bookComplete`) |
| `DecisionMap` | Visual path tree showing reader's journey (new feature) |

### Machine States (Enhanced)

```
loadingManifest → error (retry) / bookSelect
bookSelect → characterReady (on book chosen)
characterReady → reading (on "Start Reading")
reading → choiceMade / questionAnswered / paused / chapterComplete / bookComplete
choiceMade → reading (transient, always)
questionAnswered → reading (transient, always)
paused → reading (resume) / bookSelect (back to books)
chapterComplete → nextChapter / bookComplete
nextChapter → reading
bookComplete → ending
ending → bookSelect (read again / back to books)
```

Machine enhancements:
- **Persistence:** Serialize snapshot to localStorage on every transition. Rehydrate on mount. Cloud-sync via `booksApi.saveProgress()` when authed.
- **Analytics:** Every transition fires `useAnalytics.track('machine.transition', { from, to, bookId, sceneId })`.
- **Multi-chapter:** `hasNextChapter` guard reads `chapters.json`. Machine already wired for `chapterComplete → nextChapter → reading`.
- **Error recovery:** `error` state captures via `useErrorTracker`, offers retry.

### Component Tree

```
App
├── ThemeProvider, AuthProvider, ErrorBoundary      # books-reader
├── Header
│   ├── ThemeToggle                                 # books-reader
│   └── UserMenu → AuthModal                        # books-reader
└── InteractiveBookScreen (XState machine)
    ├── [loadingManifest] → LoadingView
    ├── [error] → ErrorView
    ├── [bookSelect]
    │   ├── BookCatalogue                           # books-reader
    │   └── ResumeReading card (new)
    ├── [characterReady]
    │   └── CharacterReadyView + EntitlementGate    # books-reader
    ├── [reading]
    │   ├── BookHUD                                 # books-reader
    │   └── SceneRenderer
    │       ├── StoryScene + VocabularyHotspot[]    # app + books-reader
    │       ├── ChoiceScene + ChoiceCard[]
    │       └── QuizRunner                          # books-reader
    ├── [paused] → PausedView + DecisionMap (new)
    ├── [chapterComplete] → ChapterCompleteView
    ├── [nextChapter] → NextChapterView
    ├── [bookComplete] → BookCompleteView
    └── [ending] → EndingScreen                     # books-reader
```

### State Management (Dual)

| Concern | Mechanism |
|---------|-----------|
| Reading flow | XState v5 machine (app-specific) |
| Auth | `AuthProvider` (books-reader) |
| Theme | `ThemeProvider` (books-reader) |
| XP | `XPTracker` (books-reader) — machine `assign` actions call `addXP()` |
| Progress | `ReadingProgress` (books-reader) — machine persistence writes to it |
| Content | `BookContentLoader` (books-reader) |
| Machine persistence | `localStorage` keyed by `bookId+userId`, hydrated on mount |

### New Feature: Decision Map

Accessible from pause menu. Shows a visual tree of the reader's path through the book:

```
          Scene 1 (Story)
               │
          Scene 2 (Choice)
          ┌──────┼────────┐
     Scene 3a    Scene 3b    Scene 3c
     (Explore    (Climb the  (Follow
      beach)      cliff)      tracks)
          │          │          │
       Scene 4    Scene 5    Scene 6
```

Completed paths = solid lines. Unchosen branches = dotted. Current position pulses. Encourages replay to explore all branches.

---

## Implementation Phases

### Phase 1: Foundation (Weeks 1-2)

- **`apps/books-api`**: Drizzle ORM setup, schema, migrations, auth middleware, book + content routes
- **`packages/books-reader`**: `AuthProvider`, `AuthModal`, `ThemeProvider`, `BookContentLoader`, `useAnalytics`, `useErrorTracker`, `ErrorBoundary`
- **`lq-story-book`**: Swap auth, theme, content loading, add error boundary + analytics

### Phase 2: Shared Reading Primitives (Weeks 3-4)

- **`packages/books-reader`**: `VocabularyHotspot`, `QuizRunner`, `BookHUD`, `EndingScreen`, `XPTracker`, `ReadingProgress`, `BookCatalogue`, `BookCard`, `EntitlementGate`, `booksApi` client
- **`lq-story-book`**: Full migration — all own components replaced by shared equivalents. App is now thin shell over books-reader + page-turner UX

### Phase 3: Interactive-Book Upgrade (Weeks 5-6)

- **`lq-interactive-book`**: All books-reader components integrated. Machine persistence. Multi-chapter content (3 books, 2-3 chapters each). Decision map feature. Analytics on every machine transition. Error boundary.

### Phase 4: Content Pipeline (Weeks 7-8)

- **`lq-books-author`**: Drizzle-backed content CRUD. Preview mode. Zod validation.
- **Content expansion**: 3 → 10 books per app. Multi-chapter for all interactive-book titles. Deploy pipeline: author → validate → commit JSON → CI → R2.

### Phase 5: Monetization + Quality (Weeks 9-10)

- **Monetization**: Stripe Checkout in marketplace. Subscription management. EntitlementGate active in both readers.
- **Quality**: axe-core CI, Lighthouse CI, visual regression CI, contract tests, Vitest + Testing Library for shared components, Playwright E2E for full flows.

### Phase 6: i18n + Offline (Future)

- service-factory i18n module, content localization pipeline, RTL support, service worker offline support, CRDT-based cloud-sync conflict resolution.

---

## Testing Strategy

### Per-Layer Tests

| Layer | Tool | What It Tests |
|-------|------|---------------|
| Drizzle schema | Vitest + Docker Postgres | Migrations, constraints, RLS policies |
| Repository | Vitest + Docker Postgres | Query correctness |
| API routes | Vitest + supertest | Handlers, auth middleware, error responses |
| API contract | Vitest + supertest | Response shape snapshots |
| Shared components | Vitest + Testing Library | Render, interaction, state changes |
| App screens | Playwright E2E | Full user flows |
| Visual regression | screen-audit (Playwright) | Screenshot diffs in CI |
| Accessibility | axe-core + Playwright | WCAG 2.1 AA violations = CI failure |
| Performance | Lighthouse CI | LCP < 2.5s, TBT < 200ms, CLS < 0.1 |

### Critical E2E Flows

```
StoryBook:
  Anonymous → browse → open book → read ch1 (free) → ch2 blocked
  Sign up → browse → read ch1 → ch2 allowed (subscription)
  Resume reading (progress restored)
  Complete book → ending screen with correct XP + achievements
  Vocabulary: click word → definition → saved to journal
  Read-aloud: play → pause → resume
  Dark mode: toggle → all screens render correctly

InteractiveBook:
  Anonymous → browse → select → read ch1 → choice → branch → ch2 blocked
  Sign up → read → make choices → complete → ending with decision map
  Machine persistence: close mid-scene → reopen → resume at exact scene
  Decision map: pause → view map → path taken vs. branches not taken
  Quiz: correct → XP earned / incorrect → explanation shown
  Keyboard nav: Tab through choices, Enter to select, Escape to pause
```

### CI Pipeline (per PR)

```
Lint & Typecheck → Unit tests (Vitest) → Build → API contract tests →
Playwright E2E (Chrome + Mobile) → axe-core a11y scan → Lighthouse CI →
screen-audit visual regression → Report
```

Any axe-core violation, Lighthouse budget exceed, or visual regression diff = PR blocked.

---

## Analytics Events

All via `useAnalytics` (service-factory analytics adapter, self-hosted endpoint in production):

| Event | Properties | When |
|-------|-----------|------|
| `app.launched` | `{ app, theme, isAuthenticated }` | App mount |
| `auth.signed_in` | `{ provider }` | Google or email/password sign-in |
| `auth.signed_up` | `{ provider }` | New account |
| `catalogue.browsed` | `{ bookCount }` | Landing page loaded |
| `book.opened` | `{ bookId, title, genre, isAuthenticated }` | Book selected |
| `book.started` | `{ bookId, chapterIndex }` | First scene of chapter |
| `scene.viewed` | `{ bookId, sceneId, sceneType, chapterIndex }` | Scene rendered |
| `scene.completed` | `{ bookId, sceneId, sceneType, timeSpentMs }` | Scene finished |
| `choice.selected` | `{ bookId, sceneId, choiceIndex, xpAwarded }` | Branching choice made |
| `quiz.answered` | `{ bookId, sceneId, correct, timeToAnswerMs }` | Quiz submitted |
| `vocab.looked_up` | `{ bookId, sceneId, word }` | Word clicked for definition |
| `vocab.pronounced` | `{ bookId, sceneId, word }` | Pronunciation played |
| `readaloud.started` | `{ bookId, sceneId, pageIndex }` | SpeechSynthesis started |
| `readaloud.paused` | `{ bookId, sceneId, pageIndex, positionMs }` | SpeechSynthesis paused |
| `page.turned` | `{ bookId, sceneId, fromPage, toPage }` | Page navigation (story-book) |
| `book.completed` | `{ bookId, totalXp, comprehensionPct, scenesRead, timeSpentMs }` | Ending screen |
| `paywall.hit` | `{ bookId, chapterIndex }` | EntitlementGate blocked |
| `purchase.started` | `{ bookId, type }` | Checkout initiated |
| `purchase.completed` | `{ bookId, type }` | Purchase confirmed |
| `machine.transition` | `{ from, to, bookId }` | XState transition (interactive-book) |
| `decision_map.viewed` | `{ bookId, nodesVisited, nodesAvailable }` | Decision map opened |

---

## Books Available

### lq-story-book (3 → 10 target)

| Book | Genre | Grade | Scenes |
|------|-------|-------|--------|
| Ancient Egypt Explorer | History | 4-6 | 7 |
| The Solar System Journey | Science | 3-5 | 4 |
| The Enchanted Library | Fantasy | 2-4 | 12 |

### lq-interactive-book (3 → 10 target)

| Book | Genre | Difficulty | Scenes |
|------|-------|------------|--------|
| Mystery on the Island | Mystery | Intermediate | 6 (→ 18) |
| Space Station Alpha | Sci-Fi | Advanced | 8 (→ 20) |
| The Jungle Expedition | Adventure | Beginner | 7 (→ 15) |

---

## Dev Ports

| Service | Port |
|---------|------|
| lq-adventure-book | 3300 |
| lq-book-marketplace | 3301 |
| lq-story-book | 3302 |
| lq-activity-book | 3303 |
| lq-interactive-book | 3304 |
| lq-books-author | 3305 |
| stripe-api | 3001 |
| books-api (new) | 3009 |
| forge-auth (local) | 3580 |
| PostgreSQL (Docker) | 5432 |
| MinIO (Docker) | 9000 |
| Redis/Valkey (Docker) | 6379 |
