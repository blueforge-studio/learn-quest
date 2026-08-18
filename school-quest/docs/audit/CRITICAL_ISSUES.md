# Critical Issues Detail

## Issue 1: Lesson ID Collision Across Chapters (CRITICAL)

### Problem

The same lesson ID exists in multiple chapter directories with **different content and different chapterIds**. This breaks:
- Lesson tracking/completion (which instance did the student complete?)
- Validation logic assuming unique IDs
- Analytics and progress tracking

### Evidence

**Math - `subtraction-basics`**:
- `chapter-3/subtraction-basics.json` → `chapterId: "chapter-3"`, problems: 7-3, 9-2, 5-0, 8-5, 6-6, 10-4, 12-8...
- `chapter-4/subtraction-basics.json` → `chapterId: "chapter-4"`, problems: 8-3, 9-4, 7-2, 10-6, 5-0...

**Science - `plant-parts`**:
- `chapter-2/plant-parts.json` → `chapterId: "chapter-2"`, 4 sections (Roots, Stem, Leaves, Flowers)
- `chapter-3/plant-parts.json` → `chapterId: "chapter-3"`, 5 sections (adds "Putting It All Together")

**Geography - `continents-oceans`**: Exists in chapters 2, 3, 4, 5

**Writing - `adjectives`**: Exists in chapters 2, 4, 5

### Affected Lessons (Pattern)

All topics that appear in multiple chapters:
- Math: subtraction-basics, multiplication-intro, division-intro, basic-shapes, angles-intro, perimeter-basics, 3d-shapes, symmetry-intro, area-basics, volume-intro, coordinate-grid, tessellations, angles-measurement
- Science: plant-parts, food-chains, ecosystems, photosynthesis, life-cycles, human-body-systems, animal-adaptations, matter-properties, atoms-intro, periodic-table-basics
- Geography: continents-oceans, famous-landmarks, countries-flags, latitude-longitude, time-zones, hemispheres, map-projections, compass-directions, map-symbols, physical-vs-political, rivers-lakes, oceans-seas, freshwater-resources, dams-reservoirs, stars-constellations, space-exploration-timeline, climate-zones
- Writing: adjectives, pronouns, adverbs, prepositions, conjunctions, punctuation-advanced, subject-verb-agreement, tenses, sentence-structure

### Solution Required

Two options:
1. **Unique IDs per chapter**: `{topic}-{chapter}` (e.g., `subtraction-basics-ch3`, `subtraction-basics-ch4`)
2. **Global unique IDs with chapter reference**: `{topic}-{sequence}` (e.g., `subtraction-basics-001`, `subtraction-basics-002`)

---

## Issue 2: Massive Content Duplication (CRITICAL)

### Problem

Actual file count far exceeds what chapters.json declares.

### Data

| Subject | Declared | Actual (est.) | Multiplier |
|---------|----------|---------------|------------|
| Math | 25 | ~150+ | 6x |
| Science | 25 | ~100+ | 4x |
| Geography | 25 | ~80+ | 3x |
| Reading | 27 | ~80+ | 3x |
| Writing | 29 | ~80+ | 3x |

### Root Cause

Same topic copied to multiple chapter directories instead of creating progressive variants.

### Solution Required

1. Audit each duplicated topic
2. Determine if content should be:
   - **Progressive**: Same topic, increasing difficulty per chapter → unique IDs per chapter
   - **Shared reference**: Same content used by multiple chapters → single file, referenced by multiple chapters
3. Implement chosen approach consistently

---

## Issue 3: Orphan Lessons in History (HIGH)

### Problem

`ancient/_general/` has 5 chapter directories but `chapters.json` only declares 1 chapter.

### Evidence

```
ancient/_general/
├── chapters.json (declares: 1 chapter, 4 lessons)
├── chapter-1/ (4 lessons - referenced)
├── chapter-2/ (~10 lessons - ORPHAN)
├── chapter-3/ (~10 lessons - ORPHAN)
├── chapter-4/ (~10 lessons - ORPHAN)
├── chapter-5/ (~10 lessons - ORPHAN)
```

### Orphaned Lesson Examples
- ancient-inventions, ancient-laws, ancient-religions, ancient-trade, ancient-warfare
- bronze-age, fall-of-empires, first-civilizations, invention-of-writing, iron-age

### Solution Required

1. Audit orphan files for quality
2. Either add to chapters.json manifest
3. Or remove unreferenced files

---

## Issue 4: File Naming Chaos (HIGH)

### Reading Subject

**Declared in chapters.json**: `phonics-letter-sounds-a`, `phonics-letter-sounds-e`, etc.
**Actual files**: `lesson-001.json`, `ph-001.json`, `flu_001.json`, `sw_001.json`

### Writing Subject

**Mixed conventions**:
- Legacy: `LF-SPL-04.json`, `LF-HW-01.json`
- New: `spelling-1.json`, `grammar-nouns.json`
- Simple: `adjectives.json`, `pronouns.json`

### Solution Required

1. Choose canonical naming convention
2. Either rename files to match manifest
3. Or regenerate manifest from actual files

---

## Issue 5: Content Coverage Gaps (MEDIUM)

### ancient/american - No Content

- Declares 0 chapters
- Americas (Mayan, Aztec, Inca) only covered in `renaissance/global` and `early-modern/american`
- These civilizations are Ancient-era but placed in later epochs

### History Modern Era Ends at 1945

- No post-WWII content
- Cold War, decolonization, Vietnam not covered

### Solution Required

1. Add ancient/american content if appropriate for target grade
2. Extend modern era or document cutoff rationale
