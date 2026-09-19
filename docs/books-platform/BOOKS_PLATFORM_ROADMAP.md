# Books Platform - Design Proposal & Roadmap

**Date:** 2026-04-22
**Author:** Claude Code
**Status:** Draft

---

## Context

Based on the comprehensive audit, the Books Platform has solid foundations but gaps in testing, content, and integration. This proposal outlines a phased approach to stabilize and complete the platform.

---

## Design Principles

1. **Test-first for critical paths** — Database, XState machines, Stripe webhooks
2. **Content is king** — Books are the product; editor and reader must work flawlessly
3. **Integrate progressively** — Wire components together once they're stable
4. **Decouple from lq-core where needed** — Books platform should work standalone

---

## Phase 1: Test Infrastructure & Stabilization

### 1.1 Add Vitest to packages

```typescript
// packages/books-shared/package.json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "coverage": "vitest run --coverage"
  },
  "devDependencies": {
    "vitest": "^3.0.0",
    "@vitest/coverage-v8": "^3.0.0"
  }
}
```

### 1.2 Critical Tests to Add

| Package | Tests | Priority |
|---------|-------|----------|
| `database` | DatabaseService CRUD tests with mock Supabase | P0 |
| `books-shared` | Zod schema validation tests | P0 |
| `books-shared` | dice-roller utility tests | P1 |
| `books-shared` | scene-graph traversal tests | P1 |
| `adventure-book` | XState machine unit tests | P1 |
| `interactive-book` | XState machine unit tests | P1 |
| `stripe-api` | Webhook handler tests | P0 |

### 1.3 Mock Data Strategy

Create a `mock-data/` folder with realistic test fixtures:
```
packages/books-shared/src/__tests__/fixtures/
├── adventure-book.json
├── story-book.json
├── activity-book.json
└── interactive-book.json
```

---

## Phase 2: Content Pipeline

### 2.1 Data Directory Structure

Standardize data path across all book types:

```
apps/{book-type}/public/data/books/{lang}/{book-id}/
├── meta.json           # Book metadata
├── chapters.json       # Chapter definitions
├── scenes/             # Scene JSON files
│   ├── ch1/
│   │   ├── scene-1.json
│   │   └── scene-2.json
│   └── ch2/
├── characters.json     # Character definitions
└── items.json         # Items/equipment
```

### 2.2 Content Validation

Add a validation script that:
1. Validates all book JSON against Zod schemas
2. Checks scene graph integrity (all choices point to valid scenes)
3. Verifies all referenced assets exist

```typescript
// scripts/validate-books.ts
import { validateAdventureBook, validateStoryBook } from '@learnquest/books-shared';

for (const bookType of ['adventure', 'story', 'activity', 'interactive']) {
  const booksDir = `apps/lq-${bookType}-book/public/data/books`;
  // validate each book...
}
```

### 2.3 Story & Activity Book Content

**Priority**: Create 1 complete story book and 1 complete activity book

Story book structure:
```json
{
  "id": "enchanted-library",
  "title": "The Enchanted Library",
  "genre": "fantasy",
  "pages": 20,
  "vocabulary": [
    { "word": "ancient", "definition": "very old" },
    { "word": "magnificent", "definition": "extremely beautiful" }
  ],
  "chapters": [{ "id": "ch1", "pages": [...] }]
}
```

Activity book structure:
```json
{
  "id": "math-adventures-1",
  "title": "Math Adventures 1",
  "activities": [
    {
      "type": "multiple-choice",
      "question": "What is 2 + 2?",
      "options": ["3", "4", "5"],
      "correctIndex": 1,
      "hint": "Count on your fingers"
    }
  ]
}
```

---

## Phase 3: Integration & Polish

### 3.1 Marketplace → Books-Author Integration

Current: Marketplace shows placeholder for author routes
Target: Deep link into author editor or embed editor

**Option A**: Open in new tab (simpler)
```tsx
// In MarketplaceScreen
<a href="http://localhost:3305/author" target="_blank">
  Open Author Studio
</a>
```

**Option B**: Embed via iframe (more complex but unified experience)

Recommendation: Start with Option A, migrate to B if demand exists.

### 3.2 BookBrowse Component

The adventure book's `BookBrowse` is a stub. Create real implementation:

```tsx
// src/screens/components/BookBrowse.tsx
export const BookBrowse: React.FC<{ books: BookManifest[] }> = ({ books }) => {
  const [filter, setFilter] = useState<'all' | 'in-progress' | 'completed'>('all');

  const filteredBooks = useMemo(() => {
    // Filter by reading progress from localStorage
  }, [filter]);

  return (
    <div className="grid grid-cols-3 gap-4">
      {filteredBooks.map(book => (
        <BookCard key={book.id} book={book} />
      ))}
    </div>
  );
};
```

### 3.3 Admin Dashboard Enhancements

1. Real-time stats using Supabase realtime
2. Charts for revenue over time
3. Export functionality for payout reports

---

## Phase 4: CI/CD & Deployment

### 4.1 GitHub Actions Workflow

```yaml
# .github/workflows/books-platform.yml
name: Books Platform CI

on: [push, pull_request]

jobs:
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm test

  build:
    needs: [typecheck, test]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: pnpm validate-books  # Content validation

  e2e:
    needs: [build]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: pnpm exec playwright install
      - run: pnpm test:e2e
```

### 4.2 Deployment Strategy

| App | Current | Target |
|-----|---------|--------|
| stripe-api | Manual | Vercel/serverless |
| All book apps | Manual | Vercel (preview per PR) |
| books-author | Manual | Vercel (preview per PR) |
| Database | Supabase | Self-hosted option |

---

## Phase 5: Lq-Core Integration

### 5.1 Unified Shell Integration

The adventure book and interactive book currently run standalone. Consider integrating with lq-core app shell for:
- Shared authentication
- Unified navigation
- Consistent UI components

### 5.2 Package Dependencies

Currently books-platform consumes from packr registry:
```
@learnquest/web-app
@learnquest/ui
@learnquest/hooks
@learnquest/email
```

These should be updated when lq-core publishes new versions.

---

## Open Questions

1. **Content ownership**: Who creates book content? Internal team or user-generated?
2. **Monetization**: Stripe Connect is wired. What's the revenue share model?
3. **Multi-language**: Content structure supports `{lang}/` but only English exists. Priority?
4. **Offline support**: Should books work offline? (Would require IndexedDB caching)
5. **Analytics**: What events should be tracked? (Currently minimal)

---

## Roadmap Summary

| Phase | Duration | Key Deliverables |
|-------|----------|-----------------|
| Phase 1: Test & Stabilize | 1-2 weeks | Vitest setup, critical tests, data path fixes |
| Phase 2: Content Pipeline | 2-3 weeks | Content validation, 1 story + 1 activity book |
| Phase 3: Integration | 2 weeks | Marketplace→Author wiring, BookBrowse, admin polish |
| Phase 4: CI/CD | 1 week | GitHub Actions, deployment configs |
| Phase 5: Lq-Core | TBD | Shell integration decisions |

**Total Estimate**: 6-8 weeks to stable production

---

## Files to Create/Modify

### High Priority
1. `packages/books-shared/src/__tests__/` — Test infrastructure
2. `packages/database/src/__tests__/` — DatabaseService tests
3. `apps/lq-story-book/public/data/books/en/` — Story book content
4. `apps/lq-activity-book/public/data/books/en/` — Activity book content
5. `.github/workflows/` — CI/CD pipeline

### Medium Priority
6. `scripts/validate-books.ts` — Content validation script
7. `apps/lq-adventure-book/src/screens/components/BookBrowse.tsx` — Real implementation
8. `apps/lq-book-marketplace/src/screens/` — Author route integration

---

## References

- [Audit Report](./BOOKS_PLATFORM_AUDIT.md)
- [books-shared types](file://packages/books-shared/src/)
- [DatabaseService](file://packages/database/src/DatabaseService.ts)
- [Adventure Book Machine](file://apps/lq-adventure-book/src/screens/machines/adventureBookMachine/)
- [Stripe API](file://apps/stripe-api/src/)
