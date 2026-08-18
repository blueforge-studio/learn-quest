# LearnQuest Future Roadmap

## Difficulty-Tiered Content

### Current State (2026-04-11)
- All existing lessons default to `difficulty: "beginner"`
- 5 difficulty levels defined: beginner, elementary, intermediate, advanced, expert
- Difficulty selector available in app settings (lang-quest + school-quest)
- Difficulty field added to lesson schema (optional, defaults to beginner)

### Phase 1: Difficulty-Specific Lessons (Priority)
Generate alternative versions of existing lessons at each difficulty level:
- **Beginner (5-8):** Simple vocab, lots of images, basic sentence patterns, short lessons
- **Elementary (8-11):** Expanded vocab, basic grammar, guided exercises
- **Intermediate (11-14):** Compound sentences, cultural context, writing exercises
- **Advanced (14-18):** Formal/informal registers, idioms, essay writing, exam prep
- **Expert (18+):** Technical vocabulary, business language, academic writing, literature

### Phase 2: Monetization Integration
- Free tier: beginner + elementary lessons (hook users)
- Pro ($9.99/mo): unlock intermediate + advanced
- Expert: unlock expert-level content
- UI: locked levels show "Upgrade to Pro" prompt with preview
- Stripe integration already exists in lq-core

### Phase 3: Adaptive Difficulty
- Auto-detect user's level from quiz performance
- Suggest difficulty adjustment after chapter completion
- Spaced repetition adjusts per difficulty level

### Per-Language Priority
Generate difficulty variants for top languages first:
1. Danish, Thai, Japanese, Korean (92% base, most mature)
2. French, Spanish, German, Chinese (high demand)
3. All remaining languages

### Cost Estimate
- ~100 lessons per difficulty level per language
- 5 levels x 67 languages = 33,500 lessons total
- At $0/lesson (Qwen free tier) + $0 audio (edge-tts) = ~$0
- Premium images per level: ~$0.15/language x 67 = ~$10 total
