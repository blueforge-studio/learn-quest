# School Quest Content Fix Progress

**Last Updated**: 2026-04-16

---

## Completed Tasks ✅

### Phase 1: Critical Issues (P0) - COMPLETED

- [x] **1.1** Audit all lesson IDs for uniqueness across all subjects
- [x] **1.2** Create duplicate ID report
- [x] **1.3** Fix Math lesson IDs (renamed 51 files with chapter suffix)
- [x] **1.4** Fix Science lesson IDs (renamed 99+6 files with chapter suffix)
- [x] **1.5** Fix Geography lesson IDs (renamed 51 files with chapter suffix)
- [x] **1.6** Fix Reading lesson IDs (renamed 53 files with chapter suffix)
- [x] **1.7** Fix Writing lesson IDs (renamed 30 files with chapter suffix)
- [x] **1.8** Regenerate Math chapters.json from actual files
- [x] **1.9** Regenerate Science chapters.json from actual files
- [x] **1.10** Regenerate Geography chapters.json from actual files
- [x] **1.11** Regenerate Reading chapters.json from actual files
- [x] **1.12** Regenerate Writing chapters.json from actual files

---

## Summary of Changes

### Duplicate ID Fix Strategy

**Chosen Approach**: `{topic}-{chapter}` format (e.g., `subtraction-basics-ch3`)

**Files Renamed**:
| Subject | Files Renamed |
|---------|---------------|
| Math | 51 |
| Science | 105 |
| Geography | 51 |
| Reading | 53 |
| Writing | 30 |
| **Total** | **290** |

### Manifest Regeneration

All chapters.json files regenerated from actual lesson files:

| Subject | Chapter 1 | Chapter 2 | Chapter 3 | Chapter 4 | Chapter 5 | Chapter 6 |
|---------|-----------|-----------|-----------|-----------|----------|----------|
| Math | 5 | 21 | 22 | 22 | 22 | - |
| Science | 5 | 40 | 40 | 40 | 40 | - |
| Geography | 5 | 22 | 22 | 22 | 22 | - |
| Reading | 5 | 18 | 21 | 23 | 24 | 5 |
| Writing | 5 | 16 | 16 | 19 | 16 | 5 |

**Note**: The original manifests were sparse (5 lessons per chapter) but actual content was much richer. Manifests now accurately reflect the actual content.

---

## Files Created/Modified

### Scripts Created
- `scripts/audit-lesson-ids.ts` - Audit script to find duplicate IDs
- `scripts/fix-math-ids.ts` - Fix Math duplicate IDs
- `scripts/fix-science-ids.ts` - Fix Science duplicate IDs
- `scripts/fix-science-prefix-ids.ts` - Fix Science `science-concept-*` prefixed IDs
- `scripts/fix-geography-ids.ts` - Fix Geography duplicate IDs
- `scripts/fix-reading-ids.ts` - Fix Reading duplicate IDs
- `scripts/fix-writing-ids.ts` - Fix Writing duplicate IDs
- `scripts/regenerate-math-manifest.ts` - Regenerate Math chapters.json
- `scripts/regenerate-science-manifest.ts` - Regenerate Science chapters.json
- `scripts/regenerate-geography-manifest.ts` - Regenerate Geography chapters.json
- `scripts/regenerate-reading-manifest.ts` - Regenerate Reading chapters.json
- `scripts/regenerate-writing-manifest.ts` - Regenerate Writing chapters.json

### Backup Files
- `lq-*/public/data/lessons/en/chapters.json.bak` - Backup of original manifests

---

## Phase 1: History Orphan Lessons - COMPLETED

- [x] **1.13** Fix History ancient/_general/ orphan lesson IDs (40 lessons renamed with chapter suffix)
- [x] **1.14** Regenerate History ancient/_general/ chapters.json manifest
- [x] **1.15** Fix timeline schema (stages→events conversion, timeline→events conversion)
- [x] **1.16** Fix era-exploration schema (stages→sections conversion)
- [x] **1.17** Fix quiz correctAnswer format (string option→index) across all chapters
- [x] **1.18** Enable all History ancient/_general/ lessons in manifest (54 lessons now enabled)

---

## Remaining Tasks

### Phase 2: High Priority (P1)

- [ ] **2.1** Audit History orphan lessons (ancient/_general/) - **COMPLETED**
- [ ] **2.2** Add orphan lessons to History manifest OR remove files - **COMPLETED**
- [ ] **2.3** Verify all manifests pass Zod validation
- [ ] **2.4** Update CLAUDE.md with new lesson ID strategy - **COMPLETED**
- [ ] **2.5** Update ARCHITECTURE.md with findings

### Phase 3: History Content Fixes - COMPLETED

- [x] **3.1** Fix History ancient/_general/ orphan lesson IDs (40 lessons renamed)
- [x] **3.2** Regenerate History ancient/_general/ chapters.json manifest
- [x] **3.3** Fix timeline schema (stages→events, timeline→events conversion)
- [x] **3.4** Fix era-exploration schema (stages→sections conversion)
- [x] **3.5** Fix quiz correctAnswer format across ALL History lessons (779 lessons)
- [x] **3.6** Enable all disabled History lessons (406 lessons enabled)

---

## Phase 4: Remaining Issues - ALL COMPLETED ✅

### Critical
- [x] **4.1** Create `ancient/american` chapters.json - no content exists for Mayan/Aztec/Inca (History has no american epoch content)

### High Priority
- [x] **4.2** Run Zod validation on all History lessons ✅ 879/879 pass
- [x] **4.3** Fix remaining quiz validation errors (9 files fixed)
- [x] **4.4** Fix reading sequencing lessons (3 files fixed)

---

## Final Audit Status

### Zod Validation (2026-04-16)
```
Total: 1468/1473 passed, 0 failed

| Subject | Lessons | Pass Rate |
|---------|---------|-----------|
| lq-math | 107 | 100% |
| lq-science | 177 | 100% |
| lq-geography | 108 | 100% |
| lq-reading | 108 | 100% |
| lq-writing | 89 | 100% |
| lq-history | 879 | 100% |
```

Note: The remaining 5 files are `chapters.json` manifests (1 per subject) which are correctly skipped by validation.

### Duplicate Lesson IDs Report
```
Total duplicate lesson IDs across all subjects: 0

| Subject | Duplicate Lesson IDs |
|---------|----------------------|
| lq-math | 0 |
| lq-science | 0 |
| lq-geography | 0 |
| lq-reading | 0 |
| lq-writing | 0 |
| lq-history | 0 |
```

---

## Lesson ID Naming Convention

**Current Convention**: `{topic}-{chapter}` (e.g., `subtraction-basics-ch3`)

**Rationale**:
- Makes it clear which chapter the lesson belongs to
- Maintains readability
- Chapter 2 lessons keep original names (base versions)
- Chapters 3, 4, 5 get chapter suffix

**Example**:
- `chapter-2/subtraction-basics.json` → ID: `subtraction-basics`
- `chapter-3/subtraction-basics.json` → ID: `subtraction-basics-ch3`
- `chapter-4/subtraction-basics.json` → ID: `subtraction-basics-ch4`
- `chapter-5/subtraction-basics.json` → ID: `subtraction-basics-ch5`
