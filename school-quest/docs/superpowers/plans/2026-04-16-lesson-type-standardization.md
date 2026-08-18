# Lesson Type Standardization Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardize 60+ content question-level activity types to ~15 lq-core interactive components and update school-quest lesson screens to render all activity types.

**Architecture:** School-quest content uses two-level type system: (1) Lesson-level type → registered screen component, (2) Question-level activity type → interactive UI within lesson. This plan focuses on question-level activities which are currently broken (match/fill/sort render as static text).

**Tech Stack:** React 19, TypeScript, lq-core interactive components (DragDropSortable, ConnectPairs), @learnquest/lesson-ui

---

## Key Insight: Two-Level Type System

Content files have:
```json
{
  "lessons": [{
    "id": "short-vowels-ch5",
    "type": "phonics",           // ← Lesson-level type → PhonicsLessonScreen
    "content": {
      "practice": [
        { "type": "match", ... },      // ← Question-level activity
        { "type": "fill", ... },        // ← Question-level activity
        { "type": "sort", ... }         // ← Question-level activity
      ]
    }
  }]
}
```

**Lesson-level types** (43 types): Already mapped to screens in `LessonScreenRegistry`. These work.

**Question-level activity types** (60+ types): Rendered as static text - no interactive UI. These are broken.

---

## Activity Type Mapping

| Content Activity Type | lq-core Component | Priority | Status |
|------------------------|-------------------|----------|--------|
| `multiple-choice` | OptionGrid | P0 | ✅ Works |
| `match` | ConnectPairs | P0 | ❌ Missing |
| `fill` / `fill-in` / `fill-blank` / `fill-in-blank` | TextInput | P0 | ❌ Missing |
| `sort` / `sorting` | DragDropSortable | P0 | ❌ Missing |
| `true-false` | OptionGrid (2 options) | P1 | ⚠️ Partial |
| `multiple` | OptionGrid | P1 | ✅ Works |
| `matching` | ConnectPairs | P1 | ❌ Missing |
| `drag-drop` / `drag-and-drop` | DragDropSortable | P1 | ❌ Missing |
| `complete` | TextInput variant | P2 | ❌ Missing |
| `patterns` / `pattern-identification` | DragDropSortable | P2 | ❌ Missing |
| `identify` | OptionGrid | P2 | ⚠️ Partial |
| `unscramble` | DragDropSortable (letters) | P2 | ❌ Missing |

**Priority P0**: Activities with 80+ occurrences - must fix immediately
**Priority P1**: Activities with 20-79 occurrences - important
**Priority P2**: Activities with <20 occurrences - nice to have

---

## Files to Modify

### Question Activity Components

**Create**: `lq-reading/src/components/question-types/`
- `MatchActivity.tsx` — Wraps ConnectPairs for word→image or word→word matching
- `FillActivity.tsx` — Text input with validation for fill-in-blank
- `SortActivity.tsx` — Wraps DragDropSortable for categorizing items
- `TrueFalseActivity.tsx` — OptionGrid variant with True/False options
- `DragDropActivity.tsx` — Wraps DragDropSortable for item placement
- `UnscrambleActivity.tsx` — DragDropSortable variant for letter ordering
- `QuestionActivityRenderer.tsx` — Dispatches to correct component by type

**Create**: `lq-writing/src/components/question-types/` (same pattern)
**Create**: `lq-math/src/components/question-types/` (same pattern)
**Create**: `lq-science/src/components/question-types/` (same pattern)
**Create**: `lq-geography/src/components/question-types/` (same pattern)
**Create**: `lq-history/src/components/question-types/` (same pattern)

### Lesson Screen Updates

**Modify**: `lq-reading/src/screens/phonics/PhonicsLessonScreen.tsx`
- Replace static `OptionGrid` with `QuestionActivityRenderer`

**Modify**: `lq-reading/src/screens/sight-words/SightWordsLessonScreen.tsx`
- Add `QuestionActivityRenderer` for match/fill/sort activities

**Modify**: `lq-reading/src/screens/comprehension/ComprehensionLessonScreen.tsx`
- Add `QuestionActivityRenderer`

**Modify**: `lq-reading/src/screens/fluency/FluencyLessonScreen.tsx`
- Add `QuestionActivityRenderer`

### lq-core Interactive Components (verify/enhance)

**Check**: `lq-core/libs/common/interactive/src/connect-pairs/ConnectPairs.tsx`
- Ensure it handles {left: string, right: string}[] format

**Check**: `lq-core/libs/common/interactive/src/drag-drop-sortable/DragDropSortable.tsx`
- Ensure it handles categories and multiple items per category

---

## Validation

- [ ] Run `npx tsx scripts/validate-all-content.ts` — should show same 1501/1506 pass rate
- [ ] Visual test: Open phonics lesson in browser, verify match/fill/sort render as interactive components
- [ ] No regressions: existing multiple-choice questions still work

---

## Type Canonicalization

Standardize 60+ activity type strings to 15 canonical types:

| Canonical Type | Maps From |
|----------------|-----------|
| `multiple-choice` | `multiple-choice`, `multiple`, `identify`, `choose` |
| `match` | `match`, `matching`, `country-match`, `capital-match`, `location-match` |
| `fill` | `fill`, `fill-in`, `fill-blank`, `fill-in-blank`, `complete` |
| `sort` | `sort`, `sorting`, `classify`, `categorize` |
| `true-false` | `true-false` |
| `drag-drop` | `drag-drop`, `drag-and-drop`, `map-placement` |
| `unscramble` | `unscramble`, `syllable-split` |
| `sequence` | `sequence`, `order` |

**Script to create**: `scripts/canonicalize-activity-types.ts`

---

## Task Decomposition

### Task 1: Create QuestionActivityRenderer component

**Files:**
- Create: `lq-reading/src/components/question-types/QuestionActivityRenderer.tsx`
- Create: `lq-reading/src/components/question-types/MatchActivity.tsx`
- Create: `lq-reading/src/components/question-types/FillActivity.tsx`
- Create: `lq-reading/src/components/question-types/SortActivity.tsx`

- [ ] **Step 1: Create MatchActivity.tsx**

```tsx
import { ConnectPairs, useConnectPairs } from '@learnquest/interactive';

interface MatchActivityProps {
  questionId: string;
  prompt: string;
  leftItems: string[];
  rightItems: string[];
  correctPairs: [number, number][];
  onComplete?: (correct: boolean) => void;
}

export const MatchActivity = ({ questionId, prompt, leftItems, rightItems, correctPairs, onComplete }: MatchActivityProps) => {
  const { selected, matched, handleSelect, isMatched } = useConnectPairs(
    leftItems.map((text, i) => ({ id: `left-${i}`, text })),
    rightItems.map((text, i) => ({ id: `right-${i}`, text })),
    correctPairs
  );

  return (
    <div className="space-y-4">
      <p className="font-medium text-gray-800">{prompt}</p>
      <ConnectPairs
        leftItems={leftItems.map((text, i) => ({ id: `left-${i}`, text }))}
        rightItems={rightItems.map((text, i) => ({ id: `right-${i}`, text }))}
        selected={selected}
        matched={matched}
        onSelect={handleSelect}
      />
    </div>
  );
};
```

- [ ] **Step 2: Create FillActivity.tsx**

```tsx
import { useState } from 'react';
import { TextInput } from '@learnquest/ui';

interface FillActivityProps {
  questionId: string;
  prompt: string;
  answer: string;
  hint?: string;
  onComplete?: (correct: boolean) => void;
}

export const FillActivity = ({ questionId, prompt, answer, hint, onComplete }: FillActivityProps) => {
  const [value, setValue] = useState('');
  const [revealed, setRevealed] = useState(false);

  const isCorrect = value.toLowerCase().trim() === answer.toLowerCase().trim();

  return (
    <div className="space-y-4">
      <p className="font-medium text-gray-800">{prompt}</p>
      <TextInput
        value={value}
        onChange={setValue}
        placeholder="Type the missing word..."
        onSubmit={() => {
          if (value.trim()) {
            setRevealed(true);
            onComplete?.(isCorrect);
          }
        }}
      />
      {hint && !revealed && <p className="text-sm text-gray-500">Hint: {hint}</p>}
      {revealed && (
        <p className={`text-sm ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
          {isCorrect ? '✓ Correct!' : `✗ The answer was: ${answer}`}
        </p>
      )}
    </div>
  );
};
```

- [ ] **Step 3: Create SortActivity.tsx**

```tsx
import { DragDropSortable, useDragDropSortable } from '@learnquest/interactive';

interface SortActivityProps {
  questionId: string;
  prompt: string;
  items: { id: string; text: string }[];
  categories: string[];
  correctPlacement: Record<string, number>; // itemId → categoryIndex
  onComplete?: (correct: boolean) => void;
}

export const SortActivity = ({ questionId, prompt, items, categories, correctPlacement, onComplete }: SortActivityProps) => {
  const { placedItems, handleDrop, reset } = useDragDropSortable(items, categories);

  return (
    <div className="space-y-4">
      <p className="font-medium text-gray-800">{prompt}</p>
      <DragDropSortable
        items={items}
        categories={categories}
        placedItems={placedItems}
        onDrop={handleDrop}
      />
    </div>
  );
};
```

- [ ] **Step 4: Create QuestionActivityRenderer.tsx**

```tsx
import { MatchActivity } from './MatchActivity';
import { FillActivity } from './FillActivity';
import { SortActivity } from './SortActivity';
import { OptionGrid } from '@learnquest/lesson-ui/components';

interface Question {
  type: string;
  prompt: string;
  options?: string[];
  correct?: string | number;
  answer?: string;
  items?: { id: string; text: string }[];
  categories?: string[];
  correctPlacement?: Record<string, number>;
  leftItems?: string[];
  rightItems?: string[];
  correctPairs?: [number, number][];
  hint?: string;
}

interface QuestionActivityRendererProps {
  questionId: string;
  question: Question;
  onAnswer?: (correct: boolean) => void;
}

// Type canonicalization
const CANONICAL_TYPES: Record<string, string> = {
  'match': 'match',
  'matching': 'match',
  'country-match': 'match',
  'capital-match': 'match',
  'fill': 'fill',
  'fill-in': 'fill',
  'fill-blank': 'fill',
  'fill-in-blank': 'fill',
  'complete': 'fill',
  'sort': 'sort',
  'sorting': 'sort',
  'multiple-choice': 'multiple-choice',
  'multiple': 'multiple-choice',
  'identify': 'multiple-choice',
  'choose': 'multiple-choice',
  'true-false': 'true-false',
};

export const QuestionActivityRenderer = ({ questionId, question, onAnswer }: QuestionActivityRendererProps) => {
  const type = CANONICAL_TYPES[question.type] ?? question.type;

  switch (type) {
    case 'match':
      return (
        <MatchActivity
          questionId={questionId}
          prompt={question.prompt}
          leftItems={question.leftItems ?? []}
          rightItems={question.rightItems ?? []}
          correctPairs={question.correctPairs ?? []}
          onComplete={onAnswer}
        />
      );

    case 'fill':
      return (
        <FillActivity
          questionId={questionId}
          prompt={question.prompt}
          answer={question.answer ?? ''}
          hint={question.hint}
          onComplete={onAnswer}
        />
      );

    case 'sort':
      return (
        <SortActivity
          questionId={questionId}
          prompt={question.prompt}
          items={question.items ?? []}
          categories={question.categories ?? []}
          correctPlacement={question.correctPlacement ?? {}}
          onComplete={onAnswer}
        />
      );

    case 'multiple-choice':
    case 'true-false':
      return (
        <OptionGrid
          questionId={questionId}
          options={question.options ?? []}
          correctAnswer={question.correct}
          onSelect={(selected) => onAnswer?.(selected === question.correct)}
        />
      );

    default:
      // Fallback: render as static text with prompt
      return (
        <div className="text-gray-500">
          <p>{question.prompt}</p>
          <p className="text-sm">Activity type "{question.type}" not yet supported</p>
        </div>
      );
  }
};
```

- [ ] **Step 5: Update PhonicsLessonScreen to use QuestionActivityRenderer**

```tsx
// In PhonicsLessonScreen.tsx, replace:
{content?.practice?.map((item, i) => (
  <ContentCard key={i}>
    <p className="font-medium text-gray-800 mb-3">{item.prompt}</p>
    {item.options && (
      <OptionGrid
        questionId={`phonics-${i}`}
        options={item.options}
        correctAnswer={item.correct}
        selected={getSelected(`phonics-${i}`)}
        revealed={isRevealed(`phonics-${i}`)}
        onSelect={select}
      />
    )}
  </ContentCard>
))}

// With:
{content?.practice?.map((item, i) => (
  <ContentCard key={i}>
    <QuestionActivityRenderer
      questionId={`phonics-${i}`}
      question={item}
      onAnswer={(correct) => {
        // Handle answer for progress tracking
      }}
    />
  </ContentCard>
))}
```

### Task 2: Create canonicalize-activity-types.ts script

**Files:**
- Create: `scripts/canonicalize-activity-types.ts`

- [ ] **Step 1: Write script**

```ts
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const CANONICAL_MAP: Record<string, string> = {
  // match variants
  'match': 'match',
  'matching': 'match',
  'country-match': 'match',
  'capital-match': 'match',
  'location-match': 'match',
  // fill variants
  'fill': 'fill',
  'fill-in': 'fill',
  'fill-blank': 'fill',
  'fill-in-blank': 'fill',
  'complete': 'fill',
  // sort variants
  'sort': 'sort',
  'sorting': 'sort',
  'classify': 'sort',
  'categorize': 'sort',
  // multiple-choice variants
  'multiple-choice': 'multiple-choice',
  'multiple': 'multiple-choice',
  'identify': 'multiple-choice',
  'choose': 'multiple-choice',
};

function findJsonFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      files.push(...findJsonFiles(fullPath));
    } else if (extname(entry) === '.json') {
      files.push(fullPath);
    }
  }
  return files;
}

function canonicalizeFile(filePath: string): number {
  const content = readFileSync(filePath, 'utf-8');
  let changed = 0;
  
  for (const [variant, canonical] of Object.entries(CANONICAL_MAP)) {
    if (variant === canonical) continue;
    const regex = new RegExp(`"type"\\s*:\\s*"${variant}"`, 'g');
    const matches = content.match(regex);
    if (matches) {
      changed += matches.length;
    }
  }
  
  return changed;
}

const rootDir = join(__dirname, '../lq-reading/public/data/lessons/en');
const files = findJsonFiles(rootDir);
let totalChanged = 0;

for (const file of files) {
  totalChanged += canonicalizeFile(file);
}

console.log(`Canonicalized ${totalChanged} activity type references`);
```

### Task 3: Test the implementation

- [ ] **Step 1: Run validation**

```bash
cd /Users/kmandrup/Projects/Repos/learn-quest/school-quest
npx tsx scripts/validate-all-content.ts
```

Expected: 1501/1506 pass (same as before - manifests correctly skipped)

- [ ] **Step 2: Check if dev server starts**

```bash
cd /Users/kmandrup/Projects/Repos/learn-quest/school-quest
pnpm dev --filter=@learnquest/reading
```

Expected: Dev server starts without errors

---

## Self-Review Checklist

- [ ] All P0 activities (match, fill, sort) have interactive components
- [ ] P1 activities (true-false, matching, drag-drop) use existing components
- [ ] Fallback for unknown types doesn't crash
- [ ] Type canonicalization script handles all 60+ variants
- [ ] No changes to lesson-level types (those already work)
