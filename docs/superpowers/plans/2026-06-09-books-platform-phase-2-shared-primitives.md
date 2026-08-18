# Books Platform Phase 2 — Shared Reading Primitives

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract 10 shared reader components + a typed API client + 2 hooks into `@learnquest/books-reader`, then migrate `lq-story-book` to a thin shell over the shared package.

**Architecture:** 4 workstreams — (A) extract UI primitives from story-book into books-reader/ui, (B) build typed API client + data hooks, (C) build shared reader components on top of primitives, (D) swap story-book's local components for books-reader equivalents. Components are generic (no coupling to a specific book type's data model), use Tailwind CSS v4 (amber-500 primary, `dark:` mode), consume auth/theme/analytics from books-reader's existing hooks.

**Tech Stack:** React 19, TypeScript 5.7, Tailwind CSS 4, framer-motion, class-variance-authority, @radix-ui/react-slot, clsx, tailwind-merge, lucide-react

---

## File Structure (New + Modified)

```
packages/books-reader/
├── package.json                          # MODIFY — add deps + exports
├── src/
│   ├── index.ts                          # MODIFY — add all new exports
│   ├── lib/
│   │   └── cn.ts                         # NEW — clsx + tailwind-merge utility
│   ├── ui/
│   │   ├── Button.tsx                    # NEW — CVA button primitive
│   │   ├── ChoiceCard.tsx                # NEW — animated choice option
│   │   ├── QuizOption.tsx                # NEW — quiz option with feedback
│   │   ├── WordRevealCard.tsx            # NEW — expandable vocab card
│   │   └── index.ts                      # NEW
│   ├── api/
│   │   ├── booksApi.ts                   # NEW — typed fetch client
│   │   └── index.ts                      # NEW
│   ├── hooks/
│   │   ├── useEntitlements.ts            # NEW — check book access
│   │   ├── useReadingProgress.ts         # NEW — track reading progress
│   │   └── index.ts                      # NEW
│   └── components/
│       ├── XPTracker.tsx                 # NEW — XP counter badge
│       ├── ReadingProgress.tsx           # NEW — progress bar
│       ├── VocabularyHotspot.tsx         # NEW — clickable word popup
│       ├── QuizRunner.tsx                # NEW — question + options
│       ├── BookCard.tsx                  # NEW — single book card
│       ├── BookCatalogue.tsx             # NEW — book grid
│       ├── BookHUD.tsx                   # NEW — reading HUD overlay
│       ├── EndingScreen.tsx              # NEW — results screen
│       ├── EntitlementGate.tsx           # NEW — paywall gate
│       ├── LoadingView.tsx               # NEW — loading spinner
│       ├── ErrorView.tsx                 # NEW — error with retry
│       └── index.ts                      # NEW

apps/lq-story-book/src/
├── components/
│   ├── BookCatalogue.tsx                 # REPLACE — import from books-reader
│   ├── BookIntro.tsx                     # REPLACE — import from books-reader
│   ├── ChoiceScene.tsx                   # REPLACE — use shared ChoiceCard
│   ├── ComprehensionCheck.tsx            # REPLACE — import from books-reader
│   ├── EndingScene.tsx                   # REPLACE — import from books-reader
│   ├── VocabularyScene.tsx               # REPLACE — import from books-reader
│   ├── SceneRenderer.tsx                 # MODIFY — use shared components
│   ├── StoryPage.tsx                     # MODIFY — use shared VocabularyHotspot
│   ├── StoryTopbar.tsx                   # REPLACE — import BookHUD from books-reader
│   └── ui/                               # DELETE (moved to books-reader)
└── screens/
    ├── HomeScreen.tsx                    # MODIFY — use shared BookCatalogue
    └── StoryBookScreen.tsx               # MODIFY — use shared components
```

---

## Dependency Additions

Add to `packages/books-reader/package.json`:

```json
"dependencies": {
  "clsx": "^2.1.0",
  "tailwind-merge": "^2.6.0",
  "class-variance-authority": "^0.7.0",
  "@radix-ui/react-slot": "^1.1.0",
  "framer-motion": "^11.0.0",
  "lucide-react": "^0.460.0"
}
```

---

### Task 1: Add dependencies and cn utility

**Files:**
- Create: `packages/books-reader/src/lib/cn.ts`
- Modify: `packages/books-reader/package.json`

- [ ] **Step 1: Write cn.ts**

```typescript
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 2: Add dependencies to package.json**

Add to the `dependencies` block:
```json
"clsx": "^2.1.0",
"tailwind-merge": "^2.6.0",
"class-variance-authority": "^0.7.0",
"@radix-ui/react-slot": "^1.1.0",
"framer-motion": "^11.0.0",
"lucide-react": "^0.460.0"
```

- [ ] **Step 3: Install**

Run: `cd /Users/kmandrup/Projects/Repos/learn-quest/books-platform && pnpm install`
Expected: deps installed, lockfile updated

- [ ] **Step 4: Commit**

```bash
git add packages/books-reader/src/lib/ packages/books-reader/package.json pnpm-lock.yaml
git commit -m "feat(books-reader): add UI dependencies and cn utility"
```

---

### Task 2: Extract Button and ChoiceCard UI primitives

**Files:**
- Create: `packages/books-reader/src/ui/Button.tsx`
- Create: `packages/books-reader/src/ui/ChoiceCard.tsx`
- Create: `packages/books-reader/src/ui/index.ts`

- [ ] **Step 1: Write Button.tsx**

Copy from story-book `ui/button.tsx`, generalize the import paths:

```typescript
import React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/cn.js';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer',
  {
    variants: {
      variant: {
        primary: 'bg-amber-500 text-white hover:bg-amber-600',
        primaryLg: 'bg-amber-500 text-white hover:bg-amber-600 text-lg px-8 py-4',
        outline: 'border-2 border-amber-500 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950',
        ghost: 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800',
        card: 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-amber-300 dark:hover:border-amber-600 shadow-sm hover:shadow-md',
      },
      size: {
        sm: 'text-sm px-3 py-1.5',
        md: 'text-sm px-5 py-2.5',
        lg: 'text-base px-6 py-3',
        icon: 'w-9 h-9 p-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

type ButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    testId?: string;
  };

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, testId, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        data-testid={testId}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
export type { ButtonProps };
```

- [ ] **Step 2: Write ChoiceCard.tsx**

Copy from story-book `ui/choice-card.tsx`, generalize:

```typescript
import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../lib/cn.js';

export interface ChoiceData {
  id: string;
  text: string;
  xpPreview?: number | null;
}

interface ChoiceCardProps<T extends ChoiceData = ChoiceData> {
  choice: T;
  onChoose: (choice: T) => void;
  testId?: string;
}

export function ChoiceCard<T extends ChoiceData = ChoiceData>({
  choice,
  onChoose,
  testId,
}: ChoiceCardProps<T>) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onChoose(choice)}
      data-testid={testId}
      className="w-full text-left p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-amber-400 dark:hover:border-amber-500 transition-colors shadow-sm hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-gray-900 dark:text-gray-100 font-medium">{choice.text}</span>
        {choice.xpPreview != null && (
          <span className="shrink-0 text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded-full">
            +{choice.xpPreview} XP
          </span>
        )}
      </div>
    </motion.button>
  );
}
```

- [ ] **Step 3: Write ui/index.ts**

```typescript
export { Button, buttonVariants } from './Button.js';
export type { ButtonProps } from './Button.js';
export { ChoiceCard } from './ChoiceCard.js';
export type { ChoiceData } from './ChoiceCard.js';
```

- [ ] **Step 4: Typecheck**

Run: `cd /Users/kmandrup/Projects/Repos/learn-quest/books-platform && pnpm --filter @learnquest/books-reader typecheck`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add packages/books-reader/src/ui/
git commit -m "feat(books-reader): add Button and ChoiceCard UI primitives"
```

---

### Task 3: Extract QuizOption and WordRevealCard UI primitives

**Files:**
- Create: `packages/books-reader/src/ui/QuizOption.tsx`
- Create: `packages/books-reader/src/ui/WordRevealCard.tsx`
- Modify: `packages/books-reader/src/ui/index.ts`

- [ ] **Step 1: Write QuizOption.tsx**

Copy from story-book `ui/quiz-option.tsx`:

```typescript
import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle } from 'lucide-react';
import { cn } from '../lib/cn.js';

interface QuizOptionProps {
  option: string;
  index: number;
  isSelected: boolean;
  isCorrect: boolean;
  answered: boolean;
  disabled: boolean;
  onSelect: (index: number) => void;
  testId?: string;
}

export function QuizOption({
  option,
  index,
  isSelected,
  isCorrect,
  answered,
  disabled,
  onSelect,
  testId,
}: QuizOptionProps) {
  const showFeedback = answered && isSelected;

  return (
    <motion.button
      whileHover={!disabled ? { scale: 1.01 } : undefined}
      whileTap={!disabled ? { scale: 0.99 } : undefined}
      onClick={() => onSelect(index)}
      disabled={disabled}
      data-testid={testId}
      className={cn(
        'w-full text-left p-4 rounded-xl border-2 transition-colors',
        showFeedback && isCorrect && 'border-green-500 bg-green-50 dark:bg-green-950',
        showFeedback && !isCorrect && 'border-red-500 bg-red-50 dark:bg-red-950',
        !showFeedback && 'border-gray-200 dark:border-gray-700 hover:border-amber-400 dark:hover:border-amber-500',
        disabled && !showFeedback && 'opacity-50',
      )}
    >
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400 w-6">
          {String.fromCharCode(65 + index)}.
        </span>
        <span className="text-gray-900 dark:text-gray-100 flex-1">{option}</span>
        {showFeedback && isCorrect && <CheckCircle size={20} className="text-green-500 shrink-0" />}
        {showFeedback && !isCorrect && <XCircle size={20} className="text-red-500 shrink-0" />}
      </div>
    </motion.button>
  );
}
```

- [ ] **Step 2: Write WordRevealCard.tsx**

Copy from story-book `ui/word-reveal-card.tsx`:

```typescript
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, Check } from 'lucide-react';

interface WordRevealCardProps {
  word: string;
  definition: string;
  audio?: string;
  image?: string;
  isOpen: boolean;
  checked: boolean;
  onToggle: () => void;
  onSpeak?: (word: string) => void;
  testId?: string;
}

export function WordRevealCard({
  word,
  definition,
  audio,
  image,
  isOpen,
  checked,
  onToggle,
  onSpeak,
  testId,
}: WordRevealCardProps) {
  return (
    <motion.div
      data-testid={testId}
      className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800"
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
      >
        <div className="flex items-center gap-3">
          {checked && <Check size={16} className="text-green-500" />}
          <span className="font-semibold text-gray-900 dark:text-gray-100">{word}</span>
        </div>
        <div className="flex items-center gap-2">
          {audio && onSpeak && (
            <span
              onClick={(e) => { e.stopPropagation(); onSpeak(word); }}
              className="p-1.5 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900 text-amber-600 dark:text-amber-400 cursor-pointer"
              aria-label={`Pronounce ${word}`}
            >
              <Volume2 size={16} />
            </span>
          )}
          <motion.span
            animate={{ rotate: isOpen ? 180 : 0 }}
            className="text-gray-400 text-lg"
          >
            ▾
          </motion.span>
        </div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 pb-4"
          >
            {image && (
              <img src={image} alt={word} className="w-full h-32 object-cover rounded-lg mb-3" />
            )}
            <p className="text-gray-600 dark:text-gray-400 text-sm">{definition}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
```

- [ ] **Step 3: Update ui/index.ts**

Replace with:
```typescript
export { Button, buttonVariants } from './Button.js';
export type { ButtonProps } from './Button.js';
export { ChoiceCard } from './ChoiceCard.js';
export type { ChoiceData } from './ChoiceCard.js';
export { QuizOption } from './QuizOption.js';
export { WordRevealCard } from './WordRevealCard.js';
```

- [ ] **Step 4: Typecheck**

Run: `cd /Users/kmandrup/Projects/Repos/learn-quest/books-platform && pnpm --filter @learnquest/books-reader typecheck`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add packages/books-reader/src/ui/
git commit -m "feat(books-reader): add QuizOption and WordRevealCard UI primitives"
```

---

### Task 4: Implement booksApi typed fetch client

**Files:**
- Create: `packages/books-reader/src/api/booksApi.ts`
- Create: `packages/books-reader/src/api/index.ts`

- [ ] **Step 1: Write booksApi.ts**

```typescript
interface BooksApiConfig {
  baseUrl: string;
  getToken: () => string | null;
}

interface BookListItem {
  bookId: string;
}

interface BookDetail {
  bookId: string;
  available: boolean;
}

interface ReadingProgressEntry {
  userId: string;
  bookId: string;
  sceneId: string;
  xpEarned: number;
  completedAt: string;
}

interface EntitlementsResponse {
  canAccess: boolean;
  hasSubscription: boolean;
  ownsBook: boolean;
}

class BooksApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'BooksApiError';
  }
}

export function createBooksApi(config: BooksApiConfig) {
  const { baseUrl, getToken } = config;

  async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(`${baseUrl}${path}`, { ...options, headers });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new BooksApiError(body.error || res.statusText, res.status);
    }
    return res.json() as Promise<T>;
  }

  return {
    getBooks() {
      return request<{ data: BookListItem[] }>('/api/books');
    },

    getBook(bookId: string) {
      return request<{ data: BookDetail }>(`/api/books/${bookId}`);
    },

    getProgress() {
      return request<{ data: ReadingProgressEntry[] }>('/api/progress');
    },

    saveProgress(bookId: string, sceneId: string, xpEarned?: number) {
      return request<{ data: { saved: boolean } }>('/api/progress', {
        method: 'PUT',
        body: JSON.stringify({ bookId, sceneId, xpEarned: xpEarned ?? 0 }),
      });
    },

    getEntitlements(bookId?: string) {
      const qs = bookId ? `?bookId=${encodeURIComponent(bookId)}` : '';
      return request<{ data: EntitlementsResponse }>(`/api/entitlements${qs}`);
    },
  };
}

export type BooksApi = ReturnType<typeof createBooksApi>;
export { BooksApiError };
export type { BookListItem, BookDetail, ReadingProgressEntry, EntitlementsResponse, BooksApiConfig };
```

- [ ] **Step 2: Write api/index.ts**

```typescript
export { createBooksApi, BooksApiError } from './booksApi.js';
export type {
  BooksApi,
  BookListItem,
  BookDetail,
  ReadingProgressEntry,
  EntitlementsResponse,
  BooksApiConfig,
} from './booksApi.js';
```

- [ ] **Step 3: Typecheck**

Run: `cd /Users/kmandrup/Projects/Repos/learn-quest/books-platform && pnpm --filter @learnquest/books-reader typecheck`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add packages/books-reader/src/api/
git commit -m "feat(books-reader): add typed booksApi fetch client"
```

---

### Task 5: Implement useEntitlements and useReadingProgress hooks

**Files:**
- Create: `packages/books-reader/src/hooks/useEntitlements.ts`
- Create: `packages/books-reader/src/hooks/useReadingProgress.ts`
- Create: `packages/books-reader/src/hooks/index.ts`

- [ ] **Step 1: Write useEntitlements.ts**

```typescript
import { useState, useCallback } from 'react';
import { useAuth } from '../auth/useAuth.js';
import type { BooksApi, EntitlementsResponse } from '../api/booksApi.js';

interface UseEntitlementsOptions {
  booksApi: BooksApi | null;
}

export function useEntitlements({ booksApi }: UseEntitlementsOptions) {
  const { user, isConfigured } = useAuth();
  const [entitlements, setEntitlements] = useState<EntitlementsResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const checkAccess = useCallback(async (bookId?: string) => {
    if (!booksApi || !isConfigured || !user) {
      setEntitlements(null);
      return;
    }
    setLoading(true);
    try {
      const { data } = await booksApi.getEntitlements(bookId);
      setEntitlements(data);
    } catch {
      setEntitlements(null);
    } finally {
      setLoading(false);
    }
  }, [booksApi, isConfigured, user]);

  return {
    canAccess: entitlements?.canAccess ?? true, // when unauthenticated, allow free content
    hasSubscription: entitlements?.hasSubscription ?? false,
    ownsBook: entitlements?.ownsBook ?? false,
    loading,
    checkAccess,
  };
}
```

- [ ] **Step 2: Write useReadingProgress.ts**

```typescript
import { useState, useCallback } from 'react';
import { useAuth } from '../auth/useAuth.js';
import type { BooksApi, ReadingProgressEntry } from '../api/booksApi.js';

interface UseReadingProgressOptions {
  booksApi: BooksApi | null;
}

export function useReadingProgress({ booksApi }: UseReadingProgressOptions) {
  const { user, isConfigured } = useAuth();
  const [progress, setProgress] = useState<ReadingProgressEntry[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchProgress = useCallback(async () => {
    if (!booksApi || !isConfigured || !user) return;
    try {
      const { data } = await booksApi.getProgress();
      setProgress(data);
    } catch {
      // silent fail — progress is best-effort in Phase 2
    }
  }, [booksApi, isConfigured, user]);

  const saveProgress = useCallback(async (bookId: string, sceneId: string, xpEarned?: number) => {
    if (!booksApi || !isConfigured || !user) return;
    setSaving(true);
    try {
      await booksApi.saveProgress(bookId, sceneId, xpEarned);
    } catch {
      // silent fail
    } finally {
      setSaving(false);
    }
  }, [booksApi, isConfigured, user]);

  return { progress, saving, fetchProgress, saveProgress };
}
```

- [ ] **Step 3: Write hooks/index.ts**

```typescript
export { useEntitlements } from './useEntitlements.js';
export { useReadingProgress } from './useReadingProgress.js';
```

- [ ] **Step 4: Typecheck**

Run: `cd /Users/kmandrup/Projects/Repos/learn-quest/books-platform && pnpm --filter @learnquest/books-reader typecheck`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add packages/books-reader/src/hooks/
git commit -m "feat(books-reader): add useEntitlements and useReadingProgress hooks"
```

---

### Task 6: Implement XPTracker and ReadingProgress components

**Files:**
- Create: `packages/books-reader/src/components/XPTracker.tsx`
- Create: `packages/books-reader/src/components/ReadingProgress.tsx`
- Create: `packages/books-reader/src/components/LoadingView.tsx`
- Create: `packages/books-reader/src/components/ErrorView.tsx`
- Create: `packages/books-reader/src/components/index.ts`

- [ ] **Step 1: Write XPTracker.tsx**

```typescript
import React from 'react';
import { Sparkles } from 'lucide-react';

interface XPTrackerProps {
  xp: number;
  className?: string;
}

export function XPTracker({ xp, className = '' }: XPTrackerProps) {
  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-sm font-semibold ${className}`}>
      <Sparkles size={14} />
      <span>{xp} XP</span>
    </div>
  );
}
```

- [ ] **Step 2: Write ReadingProgress.tsx**

```typescript
import React from 'react';

interface ReadingProgressProps {
  current: number;
  total: number;
  label?: string;
  className?: string;
}

export function ReadingProgress({ current, total, label, className = '' }: ReadingProgressProps) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className={`w-full ${className}`}>
      {(label || true) && (
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
          <span>{label ?? 'Progress'}</span>
          <span>{pct}%</span>
        </div>
      )}
      <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-amber-500 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write LoadingView.tsx**

```typescript
import React from 'react';
import { BookOpen } from 'lucide-react';

interface LoadingViewProps {
  message?: string;
}

export function LoadingView({ message = 'Loading...' }: LoadingViewProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3 text-gray-400">
      <BookOpen size={32} className="animate-pulse" />
      <span className="text-sm">{message}</span>
    </div>
  );
}
```

- [ ] **Step 4: Write ErrorView.tsx**

```typescript
import React from 'react';
import { Button } from '../ui/Button.js';

interface ErrorViewProps {
  error?: string | null;
  onRetry: () => void;
}

export function ErrorView({ error, onRetry }: ErrorViewProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-gray-400">
      <p className="text-sm">{error || 'Something went wrong'}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Try Again
      </Button>
    </div>
  );
}
```

- [ ] **Step 5: Write components/index.ts**

```typescript
export { XPTracker } from './XPTracker.js';
export { ReadingProgress } from './ReadingProgress.js';
export { LoadingView } from './LoadingView.js';
export { ErrorView } from './ErrorView.js';
```

- [ ] **Step 6: Typecheck**

Run: `cd /Users/kmandrup/Projects/Repos/learn-quest/books-platform && pnpm --filter @learnquest/books-reader typecheck`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add packages/books-reader/src/components/
git commit -m "feat(books-reader): add XPTracker, ReadingProgress, LoadingView, ErrorView"
```

---

### Task 7: Implement VocabularyHotspot component

**Files:**
- Create: `packages/books-reader/src/components/VocabularyHotspot.tsx`
- Modify: `packages/books-reader/src/components/index.ts`

- [ ] **Step 1: Write VocabularyHotspot.tsx**

```typescript
import React, { useState, useRef, useEffect } from 'react';

interface VocabularyHotspotProps {
  word: string;
  definition: string;
  pronunciation?: string;
  onReveal?: (word: string) => void;
  className?: string;
}

export function VocabularyHotspot({
  word,
  definition,
  pronunciation,
  onReveal,
  className = '',
}: VocabularyHotspotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popupRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const handleClick = () => {
    setIsOpen(!isOpen);
    if (!isOpen && onReveal) {
      onReveal(word);
    }
  };

  const handleSpeak = () => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(pronunciation || word);
      utterance.lang = 'en-US';
      utterance.rate = 0.85;
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <span className="relative inline" ref={popupRef}>
      <button
        onClick={handleClick}
        className={`inline cursor-pointer border-b-2 border-dotted border-amber-400 dark:border-amber-500 text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-200 hover:border-amber-600 transition-colors ${className}`}
        aria-expanded={isOpen}
      >
        {word}
      </button>
      {isOpen && (
        <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl">
          <span className="flex items-center justify-between mb-1">
            <span className="font-bold text-gray-900 dark:text-gray-100">{word}</span>
            <button
              onClick={handleSpeak}
              className="text-amber-600 dark:text-amber-400 hover:text-amber-700 text-xs underline cursor-pointer"
            >
              Listen
            </button>
          </span>
          <span className="text-sm text-gray-600 dark:text-gray-400">{definition}</span>
          <span className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-white dark:border-t-gray-800" />
        </span>
      )}
    </span>
  );
}
```

- [ ] **Step 2: Update components/index.ts**

Append to existing content:
```typescript
export { VocabularyHotspot } from './VocabularyHotspot.js';
```

- [ ] **Step 3: Typecheck**

Run: `cd /Users/kmandrup/Projects/Repos/learn-quest/books-platform && pnpm --filter @learnquest/books-reader typecheck`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add packages/books-reader/src/components/VocabularyHotspot.tsx packages/books-reader/src/components/index.ts
git commit -m "feat(books-reader): add VocabularyHotspot component"
```

---

### Task 8: Implement QuizRunner component

**Files:**
- Create: `packages/books-reader/src/components/QuizRunner.tsx`
- Modify: `packages/books-reader/src/components/index.ts`

- [ ] **Step 1: Write QuizRunner.tsx**

```typescript
import React, { useState, useEffect } from 'react';
import { QuizOption } from '../ui/QuizOption.js';

interface QuizRunnerProps {
  question: string;
  options: string[];
  correctAnswer: number;
  onComplete: (correct: boolean) => void;
}

export function QuizRunner({ question, options, correctAnswer, onComplete }: QuizRunnerProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!submitted || selected === null) return;
    const timer = setTimeout(() => onComplete(selected === correctAnswer), 1500);
    return () => clearTimeout(timer);
  }, [submitted, selected, correctAnswer, onComplete]);

  const handleSelect = (index: number) => {
    if (submitted) return;
    setSelected(index);
    setSubmitted(true);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{question}</h3>
      <div className="space-y-2">
        {options.map((opt, i) => (
          <QuizOption
            key={i}
            option={opt}
            index={i}
            isSelected={selected === i}
            isCorrect={i === correctAnswer}
            answered={submitted}
            disabled={submitted}
            onSelect={handleSelect}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update components/index.ts**

Append:
```typescript
export { QuizRunner } from './QuizRunner.js';
```

- [ ] **Step 3: Typecheck**

Run: `cd /Users/kmandrup/Projects/Repos/learn-quest/books-platform && pnpm --filter @learnquest/books-reader typecheck`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add packages/books-reader/src/components/QuizRunner.tsx packages/books-reader/src/components/index.ts
git commit -m "feat(books-reader): add QuizRunner component"
```

---

### Task 9: Implement BookCard and BookCatalogue components

**Files:**
- Create: `packages/books-reader/src/components/BookCard.tsx`
- Create: `packages/books-reader/src/components/BookCatalogue.tsx`
- Modify: `packages/books-reader/src/components/index.ts`

- [ ] **Step 1: Write BookCard.tsx**

```typescript
import React from 'react';
import { Clock, GraduationCap, Star } from 'lucide-react';
import type { ManifestBook } from '@learnquest/books-shared/types';

interface BookCardProps {
  book: ManifestBook;
  onClick: (book: ManifestBook) => void;
}

export function BookCard({ book, onClick }: BookCardProps) {
  const coverSrc = book.coverImage || '/data/books/en/book-covers/placeholder.svg';
  const genre = book.genre ?? book.tags?.[0];

  return (
    <button
      onClick={() => onClick(book)}
      className="group text-left bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:border-amber-400 dark:hover:border-amber-500 hover:shadow-lg transition-all duration-200 w-full cursor-pointer"
    >
      <div className="aspect-[16/10] overflow-hidden bg-gray-100 dark:bg-gray-700">
        <img
          src={coverSrc}
          alt={book.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/data/books/en/book-covers/placeholder.svg';
          }}
        />
      </div>
      <div className="p-4 space-y-2">
        {genre && (
          <span className="text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded-full">
            {typeof genre === 'string' ? genre : String(genre)}
          </span>
        )}
        <h3 className="font-bold text-gray-900 dark:text-gray-100 text-base leading-snug">{book.title}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{book.description}</p>
        <div className="flex items-center gap-4 text-xs text-gray-400 pt-1">
          {book.difficulty && (
            <span className="flex items-center gap-1">
              <Star size={12} /> {book.difficulty}
            </span>
          )}
          {book.estimatedHours != null && (
            <span className="flex items-center gap-1">
              <Clock size={12} /> {book.estimatedHours}h
            </span>
          )}
          {book.gradeLevel && (
            <span className="flex items-center gap-1">
              <GraduationCap size={12} /> {book.gradeLevel}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
```

- [ ] **Step 2: Write BookCatalogue.tsx**

```typescript
import React from 'react';
import type { ManifestBook } from '@learnquest/books-shared/types';
import { BookCard } from './BookCard.js';
import { BookOpen } from 'lucide-react';

interface BookCatalogueProps {
  books: ManifestBook[];
  onSelectBook: (book: ManifestBook) => void;
  emptyMessage?: string;
}

export function BookCatalogue({ books, onSelectBook, emptyMessage = 'No books available yet.' }: BookCatalogueProps) {
  if (books.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
        <BookOpen size={40} />
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {books.map((book) => (
        <BookCard key={book.id} book={book} onClick={onSelectBook} />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Update components/index.ts**

Append:
```typescript
export { BookCard } from './BookCard.js';
export { BookCatalogue } from './BookCatalogue.js';
```

- [ ] **Step 4: Typecheck**

Run: `cd /Users/kmandrup/Projects/Repos/learn-quest/books-platform && pnpm --filter @learnquest/books-reader typecheck`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add packages/books-reader/src/components/BookCard.tsx packages/books-reader/src/components/BookCatalogue.tsx packages/books-reader/src/components/index.ts
git commit -m "feat(books-reader): add BookCard and BookCatalogue components"
```

---

### Task 10: Implement BookHUD component

**Files:**
- Create: `packages/books-reader/src/components/BookHUD.tsx`
- Modify: `packages/books-reader/src/components/index.ts`

- [ ] **Step 1: Write BookHUD.tsx**

```typescript
import React from 'react';
import { Pause, Sparkles } from 'lucide-react';
import { ReadingProgress } from './ReadingProgress.js';

interface BookHUDProps {
  title: string;
  chapterLabel: string;
  progressCurrent: number;
  progressTotal: number;
  xp: number;
  onPause?: () => void;
  className?: string;
}

export function BookHUD({
  title,
  chapterLabel,
  progressCurrent,
  progressTotal,
  xp,
  onPause,
  className = '',
}: BookHUDProps) {
  return (
    <div className={`sticky top-0 z-40 bg-white/90 dark:bg-gray-950/90 backdrop-blur border-b border-gray-200 dark:border-gray-800 px-4 py-3 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{chapterLabel}</span>
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate max-w-[200px]">{title}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 text-sm font-semibold">
            <Sparkles size={14} />
            <span>{xp} XP</span>
          </div>
          {onPause && (
            <button
              onClick={onPause}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors cursor-pointer"
              aria-label="Pause reading"
            >
              <Pause size={18} />
            </button>
          )}
        </div>
      </div>
      <ReadingProgress current={progressCurrent} total={progressTotal} />
    </div>
  );
}
```

- [ ] **Step 2: Update components/index.ts**

Append:
```typescript
export { BookHUD } from './BookHUD.js';
```

- [ ] **Step 3: Typecheck**

Run: `cd /Users/kmandrup/Projects/Repos/learn-quest/books-platform && pnpm --filter @learnquest/books-reader typecheck`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add packages/books-reader/src/components/BookHUD.tsx packages/books-reader/src/components/index.ts
git commit -m "feat(books-reader): add BookHUD component"
```

---

### Task 11: Implement EndingScreen component

**Files:**
- Create: `packages/books-reader/src/components/EndingScreen.tsx`
- Modify: `packages/books-reader/src/components/index.ts`

- [ ] **Step 1: Write EndingScreen.tsx**

```typescript
import React from 'react';
import { motion } from 'framer-motion';
import { Award, Star } from 'lucide-react';
import { Button } from '../ui/Button.js';

interface EndingScreenProps {
  title: string;
  narrativeText: string;
  xpTotal: number;
  unlockedAchievements?: string[];
  onFinish: () => void;
}

export function EndingScreen({
  title,
  narrativeText,
  xpTotal,
  unlockedAchievements = [],
  onFinish,
}: EndingScreenProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center min-h-[80vh] px-4 text-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
        className="mb-6"
      >
        <div className="w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
          <Award size={40} className="text-amber-500" />
        </div>
      </motion.div>

      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{title}</h1>
      <p className="text-gray-600 dark:text-gray-400 max-w-md mb-6">{narrativeText}</p>

      <div className="flex items-center gap-2 mb-6 px-4 py-2 rounded-full bg-amber-100 dark:bg-amber-900/40">
        <Star size={18} className="text-amber-500" />
        <span className="text-amber-700 dark:text-amber-300 font-bold text-lg">{xpTotal} XP Earned</span>
      </div>

      {unlockedAchievements.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {unlockedAchievements.map((a) => (
            <span
              key={a}
              className="px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-sm font-medium"
            >
              {a}
            </span>
          ))}
        </div>
      )}

      <Button variant="primaryLg" onClick={onFinish}>
        Finish
      </Button>
    </motion.div>
  );
}
```

- [ ] **Step 2: Update components/index.ts**

Append:
```typescript
export { EndingScreen } from './EndingScreen.js';
```

- [ ] **Step 3: Typecheck**

Run: `cd /Users/kmandrup/Projects/Repos/learn-quest/books-platform && pnpm --filter @learnquest/books-reader typecheck`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add packages/books-reader/src/components/EndingScreen.tsx packages/books-reader/src/components/index.ts
git commit -m "feat(books-reader): add EndingScreen component"
```

---

### Task 12: Implement EntitlementGate component

**Files:**
- Create: `packages/books-reader/src/components/EntitlementGate.tsx`
- Modify: `packages/books-reader/src/components/index.ts`

- [ ] **Step 1: Write EntitlementGate.tsx**

```typescript
import React from 'react';
import { Lock } from 'lucide-react';
import { useEntitlements } from '../hooks/useEntitlements.js';
import { Button } from '../ui/Button.js';
import type { BooksApi } from '../api/booksApi.js';

interface EntitlementGateProps {
  children: React.ReactNode;
  bookId?: string;
  booksApi: BooksApi | null;
  fallback?: React.ReactNode;
}

export function EntitlementGate({ children, bookId, booksApi, fallback }: EntitlementGateProps) {
  const { canAccess, loading } = useEntitlements({ booksApi });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <span className="text-sm">Checking access...</span>
      </div>
    );
  }

  if (!canAccess) {
    if (fallback) return <>{fallback}</>;

    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center gap-4">
        <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
          <Lock size={28} className="text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Premium Content</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
          Unlock this book to continue reading. Purchase it individually or subscribe for full access.
        </p>
        <div className="flex gap-3">
          <Button variant="primary" size="sm" onClick={() => {}}>
            Buy Book — $10
          </Button>
          <Button variant="outline" size="sm" onClick={() => {}}>
            Subscribe — $50/mo
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
```

- [ ] **Step 2: Update components/index.ts**

Append:
```typescript
export { EntitlementGate } from './EntitlementGate.js';
```

- [ ] **Step 3: Typecheck**

Run: `cd /Users/kmandrup/Projects/Repos/learn-quest/books-platform && pnpm --filter @learnquest/books-reader typecheck`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add packages/books-reader/src/components/EntitlementGate.tsx packages/books-reader/src/components/index.ts
git commit -m "feat(books-reader): add EntitlementGate component"
```

---

### Task 13: Update books-reader package.json exports and barrel index

**Files:**
- Modify: `packages/books-reader/package.json`
- Modify: `packages/books-reader/src/index.ts`

- [ ] **Step 1: Update package.json exports field**

Read the current package.json, replace the `exports` block with:

```json
"exports": {
  ".": "./src/index.ts",
  "./auth": "./src/auth/index.ts",
  "./theme": "./src/theme/index.ts",
  "./content": "./src/content/index.ts",
  "./analytics": "./src/analytics/index.ts",
  "./error-tracking": "./src/error-tracking/index.ts",
  "./ui": "./src/ui/index.ts",
  "./api": "./src/api/index.ts",
  "./hooks": "./src/hooks/index.ts",
  "./components": "./src/components/index.ts"
}
```

- [ ] **Step 2: Update src/index.ts barrel**

Replace the current content with:

```typescript
export { AuthProvider, useAuth, AuthModal } from './auth/index.js';
export { ThemeProvider, useTheme } from './theme/index.js';
export { useBookContentLoader } from './content/index.js';
export { useAnalytics } from './analytics/index.js';
export type { AnalyticsEventName, AnalyticsEvent } from './analytics/index.js';
export { useErrorTracker, ErrorBoundary } from './error-tracking/index.js';
export { Button, buttonVariants, ChoiceCard } from './ui/index.js';
export type { ButtonProps, ChoiceData } from './ui/index.js';
export { QuizOption, WordRevealCard } from './ui/index.js';
export { createBooksApi, BooksApiError } from './api/index.js';
export type { BooksApi, BookListItem, BookDetail, EntitlementsResponse, BooksApiConfig } from './api/index.js';
export { useEntitlements, useReadingProgress } from './hooks/index.js';
export {
  XPTracker,
  ReadingProgress,
  LoadingView,
  ErrorView,
  VocabularyHotspot,
  QuizRunner,
  BookCard,
  BookCatalogue,
  BookHUD,
  EndingScreen,
  EntitlementGate,
} from './components/index.js';
```

- [ ] **Step 3: Typecheck + verify all exports resolve**

Run: `cd /Users/kmandrup/Projects/Repos/learn-quest/books-platform && pnpm --filter @learnquest/books-reader typecheck`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add packages/books-reader/package.json packages/books-reader/src/index.ts
git commit -m "feat(books-reader): wire up all exports — UI, API, hooks, components"
```

---

### Task 14: Migrate story-book — swap BookCatalogue and UI primitives

**Files:**
- Modify: `apps/lq-story-book/src/screens/HomeScreen.tsx`
- Delete: `apps/lq-story-book/src/components/BookCatalogue.tsx`
- Delete: `apps/lq-story-book/src/components/ui/button.tsx`
- Delete: `apps/lq-story-book/src/components/ui/choice-card.tsx`
- Delete: `apps/lq-story-book/src/components/ui/quiz-option.tsx`
- Delete: `apps/lq-story-book/src/components/ui/word-reveal-card.tsx`

- [ ] **Step 1: Update HomeScreen.tsx to use shared BookCatalogue**

Read the current `HomeScreen.tsx`, change the import and usage:

Replace:
```typescript
import { BookCatalogue } from '../components/BookCatalogue';
```

With:
```typescript
import { BookCatalogue } from '@learnquest/books-reader';
```

And update the JSX — the shared `BookCatalogue` uses `onSelectBook` instead of rendering links internally. The old `BookCatalogue` rendered `<Link to={/book/${book.id}}>`. The shared version receives `onSelectBook` callback. Update `HomeScreen.tsx` to use `useNavigate`:

Add import:
```typescript
import { useNavigate } from 'react-router-dom';
```

Add navigate hook inside the component:
```typescript
const navigate = useNavigate();
```

Update the BookCatalogue usage:
```typescript
<BookCatalogue books={books} onSelectBook={(book) => navigate(`/book/${book.id}`)} />
```

- [ ] **Step 2: Replace CTAButton import in remaining files**

Check which files still import `CTAButton`:
```bash
grep -r "CTAButton" apps/lq-story-book/src/
```

Replace `import { CTAButton } from './CTAButton'` with `import { Button } from '@learnquest/books-reader'`.
Replace `<CTAButton variant="primary" ...>` with `<Button variant="primary" ...>`.

The `Button` component has identical variant/size props to `CTAButton`, except `Button` doesn't have `to`/`href` props. Check if any usage uses `to` or `href` — if so, wrap in a `<Link>` instead.

Files to check and update:
- `apps/lq-story-book/src/components/BookIntro.tsx`
- `apps/lq-story-book/src/components/EndingScene.tsx`
- `apps/lq-story-book/src/components/VocabularyScene.tsx`
- `apps/lq-story-book/src/components/SceneRenderer.tsx`
- `apps/lq-story-book/src/components/StorySceneLayout.tsx`
- `apps/lq-story-book/src/components/Header.tsx`
- `apps/lq-story-book/src/components/HeroBanner.tsx`

For each file, replace `CTAButton` import with `Button` from `@learnquest/books-reader` and adjust props:
- `variant="primaryLg"` stays (Button supports it)
- `fullWidth` → add `className="w-full"`
- `to="/book/..."` → wrap Button in `<Link to="...">`
- `href="..."` → wrap Button in `<a href="...">`

- [ ] **Step 3: Delete old files**

```bash
rm apps/lq-story-book/src/components/BookCatalogue.tsx
rm apps/lq-story-book/src/components/CTAButton.tsx
rm apps/lq-story-book/src/components/ui/button.tsx
rm apps/lq-story-book/src/components/ui/choice-card.tsx
rm apps/lq-story-book/src/components/ui/quiz-option.tsx
rm apps/lq-story-book/src/components/ui/word-reveal-card.tsx
```

- [ ] **Step 4: Typecheck story-book**

Run: `cd /Users/kmandrup/Projects/Repos/learn-quest/books-platform && pnpm --filter @learnquest/story-book typecheck`
Expected: no errors (fix any import errors from the CTAButton → Button migration)

- [ ] **Step 5: Commit**

```bash
git add apps/lq-story-book/
git commit -m "refactor(story-book): swap BookCatalogue and UI primitives for books-reader"
```

---

### Task 15: Migrate story-book — swap Quiz, Vocab, and Ending components

**Files:**
- Modify: `apps/lq-story-book/src/components/SceneRenderer.tsx`
- Modify: `apps/lq-story-book/src/components/StoryPage.tsx`
- Delete: `apps/lq-story-book/src/components/ComprehensionCheck.tsx`
- Delete: `apps/lq-story-book/src/components/ChoiceScene.tsx`
- Delete: `apps/lq-story-book/src/components/EndingScene.tsx`
- Delete: `apps/lq-story-book/src/components/VocabularyScene.tsx`

- [ ] **Step 1: Update SceneRenderer.tsx**

Replace local component imports with books-reader:

```typescript
import { QuizRunner, EndingScreen } from '@learnquest/books-reader';
```

Replace `<ComprehensionCheck ... />` with `<QuizRunner ... />`:
- `question`, `options`, `correctAnswer`, `onComplete` props match exactly

Replace `<EndingScene ... />` with `<EndingScreen ... />`:
- `title`, `narrativeText`, `xpTotal`, `unlockedAchievements`, `onFinish` match

For `<ChoiceScene ... />`, keep using the local `ChoiceScene` (it composes `ChoiceCard` from UI primitives but has scene-specific data mapping). Update its import of `ChoiceCard` to use `@learnquest/books-reader`:
- In `ChoiceScene.tsx`: change `import { ChoiceCard } from './ui/choice-card'` → `import { ChoiceCard } from '@learnquest/books-reader'`

For `<VocabularyScene ... />`, keep the local `VocabularyScene` (it composes `WordRevealCard`). Update its imports to use books-reader primitives:
- In `VocabularyScene.tsx`: change WordRevealCard import to `@learnquest/books-reader`

- [ ] **Step 2: Update StoryPage.tsx to use VocabularyHotspot**

Replace the inline vocabulary hotspot rendering with the shared `VocabularyHotspot` component:

Add import:
```typescript
import { VocabularyHotspot } from '@learnquest/books-reader';
```

Replace the inline hotspot button logic. The current `StoryPage` renders hotspots as:
```typescript
{hotSpots.map((spot) => (
  <button key={spot.start} onClick={...} className="...">
    {spot.word}
  </button>
))}
```

Replace with:
```typescript
{hotSpots.map((spot) => (
  <VocabularyHotspot
    key={spot.start}
    word={spot.word}
    definition={spot.definition}
    pronunciation={spot.pronunciation}
    onReveal={(word) => track?.('vocab.looked_up', { word, bookId })}
  />
))}
```

- [ ] **Step 3: Delete old files**

```bash
rm apps/lq-story-book/src/components/ComprehensionCheck.tsx
rm apps/lq-story-book/src/components/EndingScene.tsx
```

Keep `ChoiceScene.tsx` and `VocabularyScene.tsx` — they are thin wrappers that now use shared primitives.

- [ ] **Step 4: Typecheck**

Run: `cd /Users/kmandrup/Projects/Repos/learn-quest/books-platform && pnpm --filter @learnquest/story-book typecheck`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add apps/lq-story-book/src/
git commit -m "refactor(story-book): swap Quiz, Vocab, and Ending components for books-reader"
```

---

### Task 16: Migrate story-book — swap StoryTopbar for BookHUD

**Files:**
- Modify: `apps/lq-story-book/src/screens/StoryBookScreen.tsx`
- Delete: `apps/lq-story-book/src/components/StoryTopbar.tsx`

- [ ] **Step 1: Update StoryBookScreen.tsx**

Replace `StoryTopbar` with `BookHUD` from books-reader:

```typescript
import { BookHUD } from '@learnquest/books-reader';
```

Replace:
```typescript
<StoryTopbar scene={scene} xp={xp} />
```

With:
```typescript
<BookHUD
  title={scene.title ?? bookMeta?.title ?? ''}
  chapterLabel={`Scene ${scene.id.replace('scene-', '')}`}
  progressCurrent={currentPage + 1}
  progressTotal={scene.content?.pages?.length ?? 1}
  xp={xp}
/>
```

- [ ] **Step 2: Delete old file**

```bash
rm apps/lq-story-book/src/components/StoryTopbar.tsx
```

- [ ] **Step 3: Typecheck**

Run: `cd /Users/kmandrup/Projects/Repos/learn-quest/books-platform && pnpm --filter @learnquest/story-book typecheck`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add apps/lq-story-book/src/
git commit -m "refactor(story-book): swap StoryTopbar for BookHUD"
```

---

### Task 17: Final cleanup — story-book is now a thin shell

**Files:**
- Cleanup any remaining dead imports across story-book

- [ ] **Step 1: Run typecheck to find dead imports**

Run: `cd /Users/kmandrup/Projects/Repos/learn-quest/books-platform && pnpm --filter @learnquest/story-book typecheck`
Expected: should report any remaining issues. Fix them.

- [ ] **Step 2: Verify story-book build**

Run: `cd /Users/kmandrup/Projects/Repos/learn-quest/books-platform && pnpm --filter @learnquest/story-book build`
Expected: successful build

- [ ] **Step 3: Verify story-book dev server starts**

Run:
```bash
cd /Users/kmandrup/Projects/Repos/learn-quest/books-platform
pnpm --filter @learnquest/story-book dev &
sleep 3
curl -s -o /dev/null -w "%{http_code}" http://localhost:3302
kill %1
```
Expected: HTTP 200

- [ ] **Step 4: Full typecheck across workspace**

Run: `cd /Users/kmandrup/Projects/Repos/learn-quest/books-platform && pnpm --filter @learnquest/books-reader typecheck && pnpm --filter @learnquest/story-book typecheck`
Expected: no errors in either package

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(story-book): final cleanup — thin shell over books-reader"
```

---

## Self-Review

### Spec Coverage

| Spec Requirement | Task |
|---|---|
| VocabularyHotspot in books-reader | Task 7 |
| QuizRunner in books-reader | Task 8 |
| BookHUD in books-reader | Task 10 |
| EndingScreen in books-reader | Task 11 |
| XPTracker in books-reader | Task 6 |
| ReadingProgress in books-reader | Task 6 |
| BookCatalogue in books-reader | Task 9 |
| BookCard in books-reader | Task 9 |
| EntitlementGate in books-reader | Task 12 |
| booksApi client in books-reader | Task 4 |
| story-book full migration | Tasks 14-17 |

### Placeholder Check
No TBD, TODO, or vague instructions. Every step has exact code or commands.

### Type Consistency
- All components import from sibling modules using `.js` extensions (ESM convention)
- `ButtonProps`, `ChoiceData` re-exported from `ui/index.ts`
- `BooksApi`, `BooksApiConfig`, etc. re-exported from `api/index.ts`
- Component props use consistent naming (e.g., `onFinish` not `onComplete` in EndingScreen)
- `BookHUD` props match what `StoryBookScreen` can provide from `scene` and `bookMeta`
