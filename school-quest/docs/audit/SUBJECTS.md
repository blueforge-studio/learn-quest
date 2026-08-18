# Subject-by-Subject Analysis

## Math (lq-math)

### Structure
- **Chapters**: 5
- **Declared Lessons**: 25 (5 per chapter)
- **Actual Files**: ~150+
- **Lesson Types**: arithmetic, geometry, number-sense, word-problem

### Chapter Themes
| Chapter | Theme | Declared Lessons |
|---------|-------|------------------|
| 1 | Number Sense & Basics | 5 |
| 2 | Arithmetic & Word Problems I | 5 |
| 3 | Arithmetic & Word Problems II | 5 |
| 4 | Geometry: Shapes & Symmetry | 5 |
| 5 | Place Value & Number Operations | 5 |

### Issues

**🔴 ID Collision**: The following appear in ALL of chapters 2, 3, 4, 5:
- `subtraction-basics`
- `multiplication-intro`
- `division-intro`
- `basic-shapes`
- `angles-intro`
- `perimeter-basics`
- `3d-shapes`
- `symmetry-intro`
- `area-basics`
- `volume-intro`
- `coordinate-grid`
- `tessellations`
- `angles-measurement`

**Problem**: Students would see the same topic multiple times with different chapterIds but same lesson ID. The content varies slightly (different problems in different chapters) but the ID doesn't reflect this.

### Content Quality
✅ **Good** - Lessons have proper stages, hints, step-by-step solutions, multiple difficulty levels

### Recommendations
1. Keep chapter 1 as foundational
2. Rename duplicates: `{topic}-ch{n}` (e.g., `subtraction-basics-ch3`, `subtraction-basics-ch4`)
3. Or implement lesson inheritance where chapters build on foundational lessons

---

## Science (lq-science)

### Structure
- **Chapters**: 5
- **Declared Lessons**: 25 (5 per chapter)
- **Actual Files**: ~100+
- **Lesson Types**: classification, experiment, science-concept

### Chapter Themes
| Chapter | Theme |
|---------|-------|
| 1 | Living Things & Nature |
| 2 | The Five Senses |
| 3 | Weather & Seasons |
| 4 | States of Matter |
| 5 | Forces & Motion |

### Issues

**🔴 ID Collision**: Topics duplicated across chapters:
- `plant-parts` (chapters 2 and 3 - with different content)
- `food-chains`, `ecosystems`, `photosynthesis`, `life-cycles` (chapters 2-5)
- `human-body-systems`, `animal-adaptations` (chapters 2-5)
- `matter-properties`, `atoms-intro`, `periodic-table-basics` (chapters 2-5)

**Problem**: Chapter theme progression doesn't match content. Students see `plant-parts` twice because it appears in both "Five Senses" and "Weather & Seasons" chapters.

### Content Quality
✅ **Excellent** - Rich sections with key terms, real-world examples, comprehension checks, fun facts

### Recommendations
1. Audit each chapter for unique content
2. Ensure topics are introduced once and built upon, not repeated
3. Either remove duplicates or rename with chapter suffix

---

## History (lq-history)

### Structure
- **Hierarchy**: epoch → region → chapter → lesson
- **Epochs**: 6 (ancient, medieval, renaissance, early-modern, industrial, modern)
- **Regions**: 19 total
- **Chapters**: 76 declared
- **Lessons**: 979 authored (730 unique IDs referenced)

### Epoch/Region Summary

| Epoch | Regions | Chapters | Enabled % |
|-------|---------|---------|-----------|
| ancient | 5 | 6 | 100% |
| medieval | 4 | 20 | ~20% |
| renaissance | 2 | 10 | ~20% |
| early-modern | 3 | 15 | ~20% |
| industrial | 2 | 10 | ~20% |
| modern | 3 | 15 | ~20% |

### Issues

**🟠 Orphan Lessons**: `ancient/_general/` has chapters 2-5 with ~54 lessons not in manifest

**🟡 Coverage Gap**: `ancient/american` declares 0 chapters - Americas not covered in ancient epoch

**🟡 Modern Era Cutoff**: Ends at 1945 (WWII)

### Content Quality
✅ **Excellent** - Rich historical content with events, figures, quizzes, quotes, legacy sections

### Recommendations
1. Audit `ancient/_general/` orphan files and add to manifest
2. Consider adding `ancient/american` for Mayan/Aztec/Inca civilizations
3. Document modern era cutoff rationale

---

## Geography (lq-geography)

### Structure
- **Chapters**: 5
- **Declared Lessons**: 25 (5 per chapter)
- **Actual Files**: ~80+
- **Lesson Types**: map-quiz, geo-challenge, region-profile

### Chapter Themes (Declared vs Actual Mismatch)
| Chapter | Declared Theme | Actual Content |
|---------|-----------------|-----------------|
| 1 | Maps & Continents | maps, continents, capitals |
| 2 | Hemispheres, Oceans & Africa | continents, flags, landmarks |
| 3 | Landforms & Natural Wonders | rivers, mountains, space, climate |
| 4 | Weather & Climate | SAME topics repeated |
| 5 | Exploring Europe | SAME topics repeated |

### Issues

**🔴 Massive Duplication**: The following appear in chapters 2, 3, 4, 5:
- `continents-oceans`
- `famous-landmarks`
- `countries-flags`
- `latitude-longitude`
- `time-zones`
- `hemispheres`
- `map-projections`
- `compass-directions`
- `map-symbols`
- `physical-vs-political`
- `rivers-lakes`
- `oceans-seas`
- `climate-zones`
- `stars-constellations`
- `space-exploration-timeline`

**Problem**: Chapter themes don't match content. "Exploring Europe" chapter 5 has same geography basics as other chapters.

### Content Quality
✅ **Good** - Varied content with quizzes and challenges

### Recommendations
1. Clarify chapter themes to match actual content
2. Make chapters progressive (different content per chapter)
3. Or properly implement shared lesson references

---

## Reading (lq-reading)

### Structure
- **Chapters**: 6
- **Declared Lessons**: 27
- **Actual Files**: ~80+
- **Lesson Types**: phonics, sight-words, fluency, comprehension, interactive-story

### Chapter Themes
| Chapter | Theme |
|---------|-------|
| 1 | Letters & Sounds |
| 2 | Short Vowel Words |
| 3 | Sight Words |
| 4 | Fluency Building |
| 5 | Comprehension: Main Idea |
| 6 | Capstone: Reading Mastery |

### Issues

**🔴 File Name Chaos**:
- Declared: `phonics-letter-sounds-a`, `phonics-letter-sounds-e`, etc.
- Actual: `lesson-001.json`, `ph-001.json`, `flu_001.json`, `sw_001.json`

**🔴 Missing Declared Files**: Many declared lessons don't exist as files

**🟠 Capstone Chapter**: Declares 5 lessons but multiple files exist

### Content Quality
⚠️ **Varies** - Some well-structured, others appear skeletal

### Recommendations
1. Choose canonical naming: either match declarations or use simple sequential
2. Regenerate chapters.json from actual files OR rename files to match
3. Audit capstone chapter content

---

## Writing (lq-writing)

### Structure
- **Chapters**: 6
- **Declared Lessons**: 29
- **Actual Files**: ~80+
- **Lesson Types**: handwriting, spelling, dictation, grammar, composition, creative-writing

### Chapter Themes
| Chapter | Theme |
|---------|-------|
| 1 | Letter Formation |
| 2 | CVC Spelling |
| 3 | Dictation Practice |
| 4 | Nouns & Verbs |
| 5 | Sentence Writing |
| 6 | Capstone: Writing Mastery |

### Issues

**🟠 Mixed Naming**:
- Legacy: `LF-SPL-04.json`, `LF-HW-01.json`
- New: `spelling-1.json`, `grammar-nouns.json`
- Simple: `adjectives.json`, `pronouns.json`

**🟠 Grammar Duplication**: Grammar topics appear in chapters 2, 3, 4, 5:
- `adjectives`, `sentence-structure` (chapters 2, 3, 4)
- `pronouns`, `adverbs`, `prepositions`, `conjunctions`, `punctuation-advanced`, `subject-verb-agreement`, `tenses` (chapters 2, 4, 5)

### Content Quality
✅ **Good** - Wide variety of writing skills

### Recommendations
1. Standardize naming convention
2. Resolve grammar topic duplication - progressive or shared reference
3. Audit chapters 3-5 content vs declarations
