# School Quest Content Structure Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix lesson ID collisions, reconcile manifests with actual files, and establish consistent content structure across all 6 School Quest subjects.

**Architecture:**
1. **Audit first**: Run scripts to find all duplicate lesson IDs and orphaned files
2. **Fix per subject**: Each subject gets its own task with validation
3. **Update manifests**: Reconcile chapters.json to match actual files
4. **Validate**: Ensure all lessons pass Zod validation

**Tech Stack:** Node.js scripts, Zod validation schemas, bash for file operations

---

## Pre-requisites

Before starting, read:
- `school-quest/docs/audit/README.md` - Overview
- `school-quest/docs/audit/CRITICAL_ISSUES.md` - Detailed issues
- `school-quest/docs/audit/SUBJECTS.md` - Per-subject analysis

---

## Task 0: Create Audit Script

**Goal**: Create a script to audit all lesson IDs across all subjects and report duplicates.

**Files:**
- Create: `school-quest/scripts/audit-lesson-ids.ts`

```typescript
#!/usr/bin/env npx tsx
/**
 * Audit script to find duplicate lesson IDs across all subjects
 * Outputs: list of duplicate IDs with their locations and chapterId values
 */

import { glob } from 'glob';
import * as fs from 'fs';
import * as path from 'path';

interface LessonInfo {
  subject: string;
  chapterDir: string;
  filePath: string;
  lessonId: string;
  chapterId: string;
}

async function auditLessonIds() {
  const subjects = ['lq-math', 'lq-science', 'lq-geography', 'lq-reading', 'lq-writing'];
  const allLessons: Map<string, LessonInfo[]> = new Map();

  for (const subject of subjects) {
    const pattern = `school-quest/${subject}/public/data/lessons/en/**/*.json`;
    const files = await glob(pattern, { ignore: '**/chapters.json' });

    for (const file of files) {
      try {
        const content = JSON.parse(fs.readFileSync(file, 'utf-8'));
        const lessons = content.lessons || [];
        const chapterDir = path.dirname(file).split('/').pop() || '';
        const subjectDir = subject;

        for (const lesson of lessons) {
          const key = `${subject}:${lesson.id}`;
          const info: LessonInfo = {
            subject,
            chapterDir,
            filePath: file,
            lessonId: lesson.id,
            chapterId: lesson.chapterId || 'unknown'
          };

          if (!allLessons.has(key)) {
            allLessons.set(key, []);
          }
          allLessons.get(key)!.push(info);
        }
      } catch (e) {
        // Skip invalid JSON
      }
    }
  }

  // Find duplicates
  const duplicates: Map<string, LessonInfo[]> = new Map();
  for (const [key, infos] of allLessons) {
    const uniqueIds = new Set(infos.map(i => i.filePath));
    if (uniqueIds.size > 1) {
      duplicates.set(key, infos);
    }
  }

  // Report
  console.log('# Duplicate Lesson IDs Report\n');
  console.log(`Total unique lesson IDs: ${allLessons.size}`);
  console.log(`Duplicate IDs (same ID, different files): ${duplicates.size}\n`);

  for (const [key, infos] of duplicates) {
    console.log(`## ${key}`);
    for (const info of infos) {
      console.log(`  - ${info.chapterDir}/${path.basename(info.filePath)}`);
      console.log(`    chapterId: ${info.chapterId}`);
    }
    console.log();
  }
}

auditLessonIds();
```

- [ ] **Step 1: Create the audit script**

```bash
mkdir -p school-quest/scripts
cat > school-quest/scripts/audit-lesson-ids.ts << 'EOF'
// (script content as shown above)
EOF
```

- [ ] **Step 2: Run the audit script**

```bash
cd school-quest && npx tsx scripts/audit-lesson-ids.ts
```

Expected output: List of all duplicate lesson IDs with file paths and chapterId values

- [ ] **Step 3: Save duplicate report**

```bash
cd school-quest && npx tsx scripts/audit-lesson-ids.ts > docs/audit/DUPLICATE_IDS.md
```

---

## Task 1: Fix Math Lesson IDs

**Subject**: lq-math  
**Issue**: Lesson IDs duplicated across chapters 2-5 (e.g., `subtraction-basics` in ch3 AND ch4 with different content)

**Files:**
- Modify: `school-quest/lq-math/public/data/lessons/en/**/*.json`
- Modify: `school-quest/lq-math/public/data/lessons/en/chapters.json`

- [ ] **Step 1: Run audit to see Math duplicates**

```bash
cd school-quest && npx tsx scripts/audit-lesson-ids.ts | grep -A 20 "lq-math"
```

Expected: List of all lq-math duplicate IDs

- [ ] **Step 2: Create fix script for Math**

```typescript
// scripts/fix-math-lesson-ids.ts
import { glob } from 'glob';
import * as fs from 'fs';
import * as path from 'path';

const SUBJECT = 'lq-math';
const BASE_PATH = `school-quest/${SUBJECT}/public/data/lessons/en`;

// Files that need renaming (lesson ID + chapter suffix)
const RENAME_MAP: Record<string, string> = {
  // subtraction-basics appears in ch3 and ch4 with different content
  // Keep chapter-3 as base, rename chapter-4 to -ch4
};

async function fixMathLessonIds() {
  // 1. For files in chapter-3, chapter-4, chapter-5 that have same ID as chapter-2
  //    Rename lesson ID to include chapter suffix
  // 2. Update chapterId in content
  // 3. Update chapters.json references
}
```

Actually, based on the audit findings, the approach should be:

**For Math**: The same topic appears in multiple chapters with different content (progressive difficulty). We should:
1. Keep the file in the chapter it currently lives in with the correct chapterId
2. Rename the lesson ID to include chapter: `topic-ch{n}`
3. Update chapters.json to reference the new IDs

Let me create a more targeted script:

```typescript
// scripts/fix-math-ids.ts
import * as fs from 'fs';
import * as path from 'path';

const BASE = 'school-quest/lq-math/public/data/lessons/en';

const chapterFiles: Record<string, string[]> = {
  'chapter-2': ['subtraction-basics.json', 'multiplication-intro.json', 'division-intro.json', 'basic-shapes.json', 'angles-intro.json', 'perimeter-basics.json', '3d-shapes.json', 'symmetry-intro.json', 'area-basics.json', 'volume-intro.json', 'coordinate-grid.json', 'tessellations.json', 'angles-measurement.json'],
  'chapter-3': ['subtraction-basics.json', 'multiplication-intro.json', 'division-intro.json', 'basic-shapes.json', 'angles-intro.json', 'perimeter-basics.json', '3d-shapes.json', 'symmetry-intro.json', 'area-basics.json', 'volume-intro.json', 'coordinate-grid.json', 'tessellations.json', 'angles-measurement.json'],
  'chapter-4': ['subtraction-basics.json', 'multiplication-intro.json', 'division-intro.json', 'basic-shapes.json', 'angles-intro.json', 'perimeter-basics.json', '3d-shapes.json', 'symmetry-intro.json', 'area-basics.json', 'volume-intro.json', 'coordinate-grid.json', 'tessellations.json', 'angles-measurement.json'],
  'chapter-5': ['subtraction-basics.json', 'multiplication-intro.json', 'division-intro.json', 'basic-shapes.json', 'angles-intro.json', 'perimeter-basics.json', '3d-shapes.json', 'symmetry-intro.json', 'area-basics.json', 'volume-intro.json', 'coordinate-grid.json', 'tessellations.json', 'angles-measurement.json'],
};

// For chapter-3, 4, 5: rename lesson ID inside file from "X" to "X-ch3", "X-ch4", "X-ch5"
// Keep chapter-2 as-is (base lessons)
async function fixMathIds() {
  for (const [chapter, files] of Object.entries(chapterFiles)) {
    if (chapter === 'chapter-2') continue; // Skip base

    const chapterNum = chapter.replace('chapter-', '');
    const chapterPath = `${BASE}/${chapter}`;

    for (const file of files) {
      const filePath = `${chapterPath}/${file}`;
      if (!fs.existsSync(filePath)) continue;

      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const oldId = content.lessons[0].id;
      const newId = `${oldId}-ch${chapterNum}`;

      // Update lesson ID
      content.lessons[0].id = newId;

      // Write back
      fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
      console.log(`Renamed: ${oldId} -> ${newId}`);
    }
  }
}

fixMathIds();
```

- [ ] **Step 3: Run fix script**

```bash
cd school-quest && npx tsx scripts/fix-math-ids.ts
```

- [ ] **Step 4: Update chapters.json for Math**

The chapters.json needs to reference the new IDs for chapters 3, 4, 5.

- [ ] **Step 5: Verify with audit script**

```bash
cd school-quest && npx tsx scripts/audit-lesson-ids.ts | grep -A 5 "lq-math"
```

Expected: No duplicates within Math (IDs now include chapter suffix)

- [ ] **Step 6: Validate Math with Zod**

```bash
cd school-quest/lq-math && npx tsx ../../lq-tools/packages/validation-schemas/scripts/validate-lessons.ts
```

---

## Task 2: Fix Science Lesson IDs

**Subject**: lq-science  
**Issue**: `plant-parts` appears in chapters 2 and 3 with different content; many topics duplicated

**Strategy**: Same as Math - add chapter suffix to duplicates in chapters 3, 4, 5

**Files:**
- Modify: `school-quest/lq-science/public/data/lessons/en/**/*.json`
- Modify: `school-quest/lq-science/public/data/lessons/en/chapters.json`

- [ ] **Step 1: Identify Science duplicates**

```bash
cd school-quest && npx tsx scripts/audit-lesson-ids.ts | grep -A 10 "lq-science" | head -50
```

- [ ] **Step 2: Create Science fix script**

```typescript
// scripts/fix-science-ids.ts
// Similar structure to Math fix, adjust for Science's duplicate pattern
```

- [ ] **Step 3: Run fix script**

```bash
cd school-quest && npx tsx scripts/fix-science-ids.ts
```

- [ ] **Step 4: Update Science chapters.json**

- [ ] **Step 5: Verify and validate**

```bash
cd school-quest && npx tsx scripts/audit-lesson-ids.ts | grep -A 5 "lq-science"
```

---

## Task 3: Fix Geography Lesson IDs

**Subject**: lq-geography  
**Issue**: Massive duplication - most topics appear in all chapters 2-5

**Strategy**: Add chapter suffix to all duplicates

**Files:**
- Modify: `school-quest/lq-geography/public/data/lessons/en/**/*.json`
- Modify: `school-quest/lq-geography/public/data/lessons/en/chapters.json`

- [ ] **Step 1: Identify Geography duplicates**

```bash
cd school-quest && npx tsx scripts/audit-lesson-ids.ts | grep -A 30 "lq-geography"
```

- [ ] **Step 2: Create and run Geography fix script**

- [ ] **Step 3: Update chapters.json**

- [ ] **Step 4: Verify and validate**

---

## Task 4: Reconcile Reading Manifest

**Subject**: lq-reading  
**Issue**: File names don't match chapters.json declarations

**Strategy**:
1. Generate new chapters.json from actual files
2. Verify all files are properly structured

**Files:**
- Modify: `school-quest/lq-reading/public/data/lessons/en/chapters.json`
- Verify: `school-quest/lq-reading/public/data/lessons/en/**/*.json`

- [ ] **Step 1: List all actual Reading lesson files**

```bash
find school-quest/lq-reading/public/data/lessons/en -name "*.json" -not -name "chapters.json" | sort
```

- [ ] **Step 2: Create manifest generation script**

```typescript
// scripts/regenerate-reading-manifest.ts
import { glob } from 'glob';
import * as fs from 'fs';
import * as path from 'path';

async function regenerateReadingManifest() {
  // 1. Find all lesson files
  // 2. Parse each to get lesson ID and type
  // 3. Group by chapter directory
  // 4. Generate new chapters.json
}
```

- [ ] **Step 3: Review generated manifest before applying**

- [ ] **Step 4: Apply manifest (backup first)**

```bash
cp school-quest/lq-reading/public/data/lessons/en/chapters.json school-quest/lq-reading/public/data/lessons/en/chapters.json.bak
```

- [ ] **Step 5: Validate Reading lessons**

---

## Task 5: Reconcile Writing Manifest

**Subject**: lq-writing  
**Issue**: Mixed naming conventions, duplicates

**Strategy**: Same as Reading - regenerate manifest from actual files

**Files:**
- Modify: `school-quest/lq-writing/public/data/lessons/en/chapters.json`

- [ ] **Step 1: List all actual Writing lesson files**

- [ ] **Step 2: Create and run manifest regeneration**

- [ ] **Step 3: Backup and apply**

- [ ] **Step 4: Validate Writing lessons**

---

## Task 6: Fix History Orphan Lessons

**Subject**: lq-history  
**Issue**: `ancient/_general/` has chapters 2-5 with unreferenced lessons

**Files:**
- Modify: `school-quest/lq-history/public/data/lessons/en/ancient/_general/chapters.json`
- OR: Remove orphan files

- [ ] **Step 1: List orphan files**

```bash
ls school-quest/lq-history/public/data/lessons/en/ancient/_general/chapter-2/
ls school-quest/lq-history/public/data/lessons/en/ancient/_general/chapter-3/
ls school-quest/lq-history/public/data/lessons/en/ancient/_general/chapter-4/
ls school-quest/lq-history/public/data/lessons/en/ancient/_general/chapter-5/
```

- [ ] **Step 2: Evaluate each orphan for quality**

- [ ] **Step 3: Either add to manifest OR remove**

- [ ] **Step 4: Validate History lessons**

---

## Task 7: Final Validation

**Goal**: Ensure all subjects pass validation and have no duplicate IDs

- [ ] **Step 1: Run full audit**

```bash
cd school-quest && npx tsx scripts/audit-lesson-ids.ts > docs/audit/FINAL_DUPLICATE_REPORT.md
```

- [ ] **Step 2: Run Zod validation on all subjects**

```bash
cd school-quest/lq-math && npx tsx ../../lq-tools/packages/validation-schemas/scripts/validate-all.ts
# Repeat for each subject
```

- [ ] **Step 3: Update PROGRESS.md**

```bash
# Mark completed tasks
```

- [ ] **Step 4: Commit changes**

```bash
git add school-quest/
git commit -m "fix(school-quest): resolve lesson ID collisions and manifest mismatches

- Add chapter suffix to duplicate lesson IDs in Math, Science, Geography
- Regenerate Reading and Writing manifests from actual files
- Add orphan lessons to History ancient/_general manifest
- Validate all subjects with Zod schemas

See docs/audit/ for detailed report"
```

---

## Verification Commands

After each task:

```bash
# Check for remaining duplicates in subject
npx tsx scripts/audit-lesson-ids.ts | grep "lq-<subject>"

# Validate subject lessons
npx tsx ../../lq-tools/packages/validation-schemas/scripts/validate-lessons.ts

# Check chapters.json consistency
node -e "const c=require('./public/data/lessons/en/chapters.json'); console.log('Chapters:', c.chapters.length); c.chapters.forEach(ch => console.log(ch.id + ':', ch.lessons.length, 'lessons'));"
```

---

## Rollback Plan

If issues arise:

```bash
# Restore chapters.json from backup
cp school-quest/lq-<subject>/public/data/lessons/en/chapters.json.bak school-quest/lq-<subject>/public/data/lessons/en/chapters.json

# Restore lesson files from git
git checkout -- school-quest/lq-<subject>/public/data/lessons/en/
```

---

## Completion Criteria

1. ✅ No duplicate lesson IDs across any subject
2. ✅ All chapters.json manifests match actual files
3. ✅ All lessons pass Zod validation
4. ✅ File naming consistent within each subject
5. ✅ Progress.md updated with completed tasks
