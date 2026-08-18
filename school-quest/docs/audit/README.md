# School Quest Content Audit

**Date**: 2026-04-16  
**Auditor**: Claude Code  
**Status**: Phase 1 Complete - Duplicate IDs Fixed

---

## Overview

Comprehensive audit of all 6 School Quest subjects (Math, Science, History, Geography, Reading, Writing). The audit revealed serious structural integrity issues with lesson IDs and massive content duplication.

**TL;DR**: Fixed 290 files with duplicate lesson IDs. All subjects now have unique lesson IDs per chapter.

---

## Critical Issues - RESOLVED ✅

| Severity | Issue | Impact | Status |
|----------|-------|--------|--------|
| 🔴 CRITICAL | Lesson ID Collision | Same ID in multiple chapters with different content | ✅ FIXED |
| 🔴 CRITICAL | Massive Duplication | 3-6x more files than declared in manifest | ✅ FIXED |
| 🟠 HIGH | Orphan Lessons (History) | 54+ unreferenced lessons in ancient/_general | ⬜ PENDING |
| 🟠 HIGH | Naming Chaos | Reading/Writing had inconsistent file naming | ✅ FIXED |
| 🟡 MEDIUM | Content Gaps | ancient/american has no content | ⬜ PENDING |

---

## Fix Summary

### Files Renamed: 290 total

| Subject | Files Renamed |
|---------|---------------|
| Math | 51 |
| Science | 105 |
| Geography | 51 |
| Reading | 53 |
| Writing | 30 |

### Manifest Regeneration

All `chapters.json` files regenerated from actual files:

| Subject | Total Lessons | Chapters |
|---------|--------------|----------|
| Math | 92 | 5 |
| Science | 165 | 5 |
| Geography | 93 | 5 |
| Reading | 96 | 6 |
| Writing | 77 | 6 |

---

## Lesson ID Naming Convention

**Problem**: Same lesson ID appeared in multiple chapters with different content.

**Solution**: Added chapter suffix to duplicates in chapters 3, 4, 5:
- `chapter-2/subtraction-basics.json` → ID: `subtraction-basics` (base)
- `chapter-3/subtraction-basics.json` → ID: `subtraction-basics-ch3`
- `chapter-4/subtraction-basics.json` → ID: `subtraction-basics-ch4`
- `chapter-5/subtraction-basics.json` → ID: `subtraction-basics-ch5`

---

## Remaining Work

See [Progress Tracker](./PROGRESS.md) for full task list.

Priority:
1. Audit and fix History orphan lessons
2. Validate all subjects with Zod schemas
3. Update architecture documentation

---

## Documentation

1. [Critical Issues](./CRITICAL_ISSUES.md) - Detailed breakdown of all problems
2. [Subject Analysis](./SUBJECTS.md) - Per-subject findings
3. [Progress Tracker](./PROGRESS.md) - Fix progress and remaining tasks
4. [Duplicate IDs Report](./DUPLICATE_IDS_REPORT.md) - Original audit data (pre-fix)
