# Language App Asset Comparison — Thai vs Danish

> Date: 2026-04-10
> Purpose: Establish asset parity targets for all language apps

## Asset Comparison

| Asset Category | Thai (reference) | Danish (needs work) |
|---------------|-----------------|-------------------|
| **Vocab images** | **615** (45 categories) | **0** (all missing) |
| Backgrounds | 88 | 37 |
| RPG assets | 291 | 108 |
| UI assets | 258 | 65 |
| Avatars | 170 | 40 |
| Lesson images | 1,016 | 146 |
| Illustrations | 28 | 33 |
| Logos | 9 | 8 |
| Textures | 6 | 25 |
| Features | 13 | 15 |
| **Total images** | **1,881** | **477** |
| Lesson data files | 2,307 | 1,696 |
| Audio files | 879 | 986 |

## Vocab Image Categories (Thai — the gold standard)

45 categories with 615 images total. Each category has 3–30 images with size variants (400px, 800px).

Categories: animals, colors, cooking-* (7 cuisines), days, directions, diy-tools, drinks, drinks-social, emotions, entertainment, family, feelings-advanced, festivals, food-drinks, fruits-1/2, furniture, greetings, nature-sky, numbers-1-10/11-20/large, objects, office, personality, places, professions, school-supplies, small-talk, street-food, symptoms, technology, travel-actions/essentials, vegetables, vehicles, verbs, weather/weather-2

## Gap: Danish Vocab Images

132 unique images referenced in lesson JSON but not generated.

**Cost to generate via Replicate Flux Schnell: $0.40** (132 × $0.003/image)

Many of the Thai categories are universal (animals, colors, numbers, food) and could be shared across all language groups. Only culture-specific categories (cooking-*, street-food, festivals) need per-language generation.

## Recommended Approach

### Phase 1: Share Thai vocab images with Nordic (free)

The Thai vocab images for universal categories (animals, colors, numbers, food, etc.) can be copied to Nordic since the images are language-neutral (a picture of "water" is the same in any language).

**~400 of 615 Thai images are shareable** — covers animals, colors, days, directions, drinks, emotions, family, food, fruits, furniture, nature, numbers, objects, places, professions, school supplies, technology, vehicles, verbs, weather.

### Phase 2: Generate Nordic-specific images ($0.40)

The remaining 132 refs that don't match Thai categories need generation:
- Pronouns (i, you, he, she, we)
- Nordic-specific nouns (mand/kvinde/barn/hus/vand)
- Nordic-specific verbs

### Phase 3: Establish shared vocab image library

Create `learn-quest/data/shared-vocab-images/` with universal vocabulary images that all language groups can use. This prevents duplicating 615 images × 14 language groups.

## Convention Alignment

Both Thai and Danish should follow the same conventions:

```
public/languages/<lang>/images/
├── lessons/
│   ├── vocabulary/<category>/<word>.webp         # Vocab images
│   ├── vocabulary/<category>/<word>--400.webp    # Size variant
│   ├── vocabulary/<category>/<word>--800.webp    # Size variant
│   ├── chapter-<N>/<lesson-name>/<item>.webp     # Chapter-specific
│   ├── concept/                                   # Concept illustrations
│   ├── conversations/                             # Conversation scenes
│   ├── culture/                                   # Culture-specific
│   └── drills/                                    # Practice images
├── backgrounds/                                   # Scene backgrounds
├── illustrations/                                 # General illustrations
├── logos/                                         # Language logos
├── rpg/                                           # Boss, equipment images
└── ui/                                            # UI elements, frames, states
```
