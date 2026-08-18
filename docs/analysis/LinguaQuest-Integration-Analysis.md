# LinguaQuest Integration Analysis

> Date: 2026-04-10

## What is LinguaQuest?

A language learning RPG PWA focused on **dialogue-driven NPC encounters**. Currently Thai-focused, with planned Spanish, Japanese, and Khmer packs. Uses the same tech stack as LearnQuest (React 19, Vite 6, Tailwind v4, Zustand, Supabase).

## Architecture Comparison

| Aspect | LinguaQuest | LearnQuest |
|--------|-------------|------------|
| Frontend | React 19 + Vite 6 | React 19 + Vite 6 |
| State | Zustand + Immer | Zustand + Immer + XState 5 |
| Styling | Tailwind v4 | Tailwind v4 + shadcn/ui |
| Backend | Supabase + Express + Drizzle | Supabase |
| Mobile | Capacitor 8 | Web-only |
| Packages | `@gamevault/*` (4 AI packages) | `@learnquest/*` via packr |
| Content | Scenario/Scene/NPC/Dialogue | Chapter/Lesson/Boss |

## Shared Concepts (High Overlap)

| Concept | LinguaQuest | LearnQuest | Integration |
|---------|-------------|------------|-------------|
| XP + Leveling | `Player.xp`, `Player.level`, 50-150 XP/dialogue | Same fields, 50+ XP/lesson | **Unify player model** |
| Achievements | Code-based conditions | Declarative JSON | **Shared package** |
| Vocabulary/SRS | `player_vocabulary` with SRS fields | Vocab in lessons, no SRS | **LQ adopts LQ's SRS** |
| Streaks | `player_streaks` table | Daily rewards system | **Shared table** |
| Image gen | `scripts/assets/generate-images.ts` (Replicate SDXL) | `@blueforge-studio/image-gen` | **Use blueforge** |
| TTS gen | `scripts/assets/generate-tts.ts` | `@blueforge-studio/tts-gateway` | **Use blueforge** |
| AI SDK | `@gamevault/ai-sdk` (Vault7) | `@learnquest/ai-sdk` (Vault7) | **Consolidate** |

## Unique to LinguaQuest (worth contributing back)

- **NPC relationship system** — trust/respect/familiarity (0-100) per NPC. Could enrich lang-quest social features.
- **Capacitor mobile** — native mobile support. Could be adopted by lang-quest apps.
- **Dialogue-driven lessons** — LinguaQuest's conversation model is more immersive than lq-core's conversation lesson type.

## Unique to LearnQuest (LinguaQuest should adopt)

- **Boss fight system** — HP, attack, defense, elements, loot tables. LinguaQuest could have dialogue-based bosses.
- **Shared UI library** (`@learnquest/ui`) — shadcn/ui components. LinguaQuest builds its own.
- **Packr distribution** — LinguaQuest packages aren't on packr.
- **Shared vocab images** — 465 universal images available.

## Integration Plan

### Phase 1: Package Consolidation

1. **Replace `@gamevault/ai-*` with `@learnquest/ai-sdk`** (or `@blueforge-studio/ai-gateway`)
   - `@gamevault/ai-sdk` → `@learnquest/ai-sdk` (same Vault7 provider)
   - `@gamevault/ai-api` → `@learnquest/ai-api`
   - `@gamevault/ai-content-core` → `@learnquest/ai-content-core`
   - `@gamevault/logger` → `@learnquest/logger`

2. **Consume `@learnquest/ui`** from packr instead of building custom components

3. **Consume `@learnquest/hooks`** for shared React hooks

### Phase 2: Schema Alignment

4. **Align Supabase player schema** — both have player profiles with XP/level/gold. Unify so a player's progress spans both apps.

5. **Shared content validation** — LinguaQuest uses `content-schema.json` + ajv. Migrate to Zod (like lq-core) and share via `@learnquest/schemas`.

### Phase 3: Asset Sharing

6. **Use shared vocab images** (465 universal images from Thai library)
7. **Use `@blueforge-studio/image-gen`** for image generation instead of custom scripts
8. **Use `@blueforge-studio/tts-gateway`** for TTS instead of custom scripts

### Phase 4: Cross-App Features

9. **Unified player profile** — XP earned in LinguaQuest dialogue contributes to overall LearnQuest level
10. **Cross-app achievements** — "Complete 10 dialogues in LinguaQuest" unlocks rewards in lang-quest apps
11. **Shared NPC system** — contribute LinguaQuest's NPC relationship model to lq-core

## Security Issue

`scripts/upload-content-new-schema.mjs` contains hardcoded Supabase credentials. Move to `.env` immediately.
