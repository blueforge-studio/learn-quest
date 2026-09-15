# Track 5.2 Stage B — L1-Aware Phonics Design

**Status:** Draft (pending user approval)
**Date:** 2026-09-15
**Builds on:** [Track 5.1 — Directive Tuning (`docs/school-quest-fleet-readiness-2026-09-14.md`)](../school-quest-fleet-readiness-2026-09-14.md) (Stage A universal phonetics concept-images shipped on `track5/directive-tuning-2026-09-15`, commit `9ace154`)
**Scope:** `lq-core` (data + service + UI) + `lang-quest/lq-nordic` (Danish lessons) + `school-quest/lq-reading` (English phonics) + `lq-tools/packages/tts-tools` + `lq-tools/packages/audio-tools` + `lq-tools/packages/image-tools` (`--l1` CLI flag)
**Pattern:** Optional per-learner content + audio variants keyed by `learnerL1`; image layer stays universal (per Stage A precedent — gemini can't render IPA/text reliably, so L1 cues live at the content layer as audio + structured text, not as image-prompt fragments)

## Problem

Track 5.1 Stage A shipped 3 universal Danish phonetics concept-images on `track5/directive-tuning-2026-09-15` (lq-tools commit `9ace154`):
- `danish-hard-vs-soft-d` — split profile, fire-orange vs cool-blue
- `danish-sk-cluster` — Viking shouting, ice-crystal vortex
- `danish-final-t-glottal` — swallowed/absorbed rune-stone at row's end

These are intentionally **universal** — no IPA, no text, no L1 cues — because gemini-3.1-flash-image's text rendering is broken (per memory `project-math-chalkboard-trap-2026-09-14`, `project-geography-satellite-trap-2026-09-15`, and the Stage 3 directive tuning on the writing track).

**But the universal art is not enough on its own.** Phonics drills are inherently **audio + L1-contrast notes**, not decorative imagery. The same Danish `r` (uvular /ʁ/) requires:
- A **Thai learner** to be told *"notice the Danish /ʁ/ — your L1 trill uses the tongue tip; the Danish one uses the back of the throat, like gargling softly"*
- A **German learner** to be told *"similar to your uvular /R/, but Danish /ʁ/ is softer, less harsh — relax the back of the tongue"*
- An **English learner** to be told *"the closest English sound is the /r/ in 'red', but the tongue is pulled further back"*

Without that cue, the audio plays but the learner can't map it to their existing L1 inventory, and they default to the closest L1 phoneme (Thai → trilled /r/ instead of uvular /ʁ/; the user's Thai wife and son are doing exactly this per their report).

**User need (verbatim, 2026-09-15):** *"Perhaps the guidance should vary slightly based on who is learning (difference in the phonics, fx. profficient German and English speakers are likely much closer phonetically and thus need less guidance) — your thoughts?"*

## Goals

1. **`learnerL1` field on the player/learner profile** — ISO 639-1 (`da`, `de`, `en`, `th`, `zh`, `ja`, `ko`, `ar`, `es`, `fr`, ...), set during onboarding, default `en` for English-only paths
2. **Per-L1 content variants in phonics lessons** — under each phonics lesson, a `variants: { 'th': {...}, 'de': {...}, 'default': {...} }` map carrying L1-contrast notes (text) + IPA (text, never rendered in image) + a per-L1 `audioPrompt` for TTS
3. **Per-(target, L1) voice selection** — the same Danish word pronounced *for a Thai learner* (slow, exaggerated tongue-position cue) gets a different TTS config than *for a German learner* (native-like pace, brief cue)
4. **Image layer stays universal** — no `--l1` flag that mutates the gen prompt (gemini can't render text anyway, and L1 cues are audio + structured text); Stage A's 3 universal concept-images remain the only phonetics art
5. **Onboarding captures L1 cleanly** — new step in the wizard between `TargetLanguagePicker` and `AudienceSelectionScreen`
6. **Backward-compatible** — existing players without `learnerL1` set fall through to `variants.default` and the current TTS voice
7. **Pilot scope is bounded** — 1 school app (`lq-reading`) + 1 lang app (`lq-nordic` Danish), 4 L1s initially (`da`, `de`, `en`, `th`)

## Non-Goals

- Per-L1 **image variants** (Stage A proved universal is sufficient; gemini can't render text/IPA reliably)
- Per-L1 UI translations of lesson prose (separate `i18n` track; not Stage B)
- AI-suggested L1 detection from audio samples
- L1-specific drill *types* (only the *cues* differ; the drill structure stays the same)
- Voice cloning / custom voice upload
- Per-lesson audio re-narration in the learner's L1 (Thai audio explaining Danish; that's a separate multilingual TTS track)
- L1 influence on grammar lessons (only phonetics/audio carry L1 cues; grammar is language-agnostic)
- Migration of existing players to set `learnerL1` automatically (default `en`; user can change in settings)

## Decisions Made

| Question | Decision | Rationale |
|---|---|---|
| Where does `learnerL1` live? | `Player.settings.language` already exists for UI locale — reuse the field but rename to `learnerL1` (UI locale + L1 are usually the same in production). Add a separate `learnerL1` field for the case where UI is `en` but L1 is `th` | User explicitly mentioned Thai family — UI in English, but L1 matters for phonetics. Two distinct fields prevent ambiguity |
| Schema migration number | `0009_learner_l1.sql` (latest is `0008_household_goals.sql`) | Drizzle naming convention |
| Where do per-L1 variants live? | Inside the lesson JSON: `content.variants: { 'th': {...}, 'de': {...}, 'default': {...} }` | Per-lesson content lives in `lessons.json`; no new file format needed |
| Voice per (target, L1) — flat or nested? | Nested: `voice-registry.json` keyed by `target` then `l1` inside | Matches existing per-lang `tts-config-{da,de,...}.json` shape; composes cleanly |
| New audio files needed? | Yes — for the 4-L1 pilot, ~30 audio clips × 4 L1s = 120 new mp3 files in `audio/chapter-N/{lesson}/l1-{th,de,en,default}/` | The L1-cue audio is a short cue (5-10 sec), not the full lesson; manageable scale |
| `--l1` CLI flag on `regenerate-flagged-images.ts`? | **NO** — image layer is universal | Stage A precedent + memory `project-l1-aware-phonics-flagged-2026-09-15` confirms image layer can't carry L1 |
| Onboarding step — modal or full screen? | Full screen between target-language and audience-tier; 3-option grid (Common: English, German, Thai, Danish, Spanish, French, Mandarin, Arabic) + "Other" → text input | Discoverable without burying under "advanced settings" |
| Default `learnerL1` for existing players? | `en` | Existing player base is primarily English-locale; non-English players can update in settings |
| Persistence layer for `learnerL1`? | Add to Postgres `players.learner_l1` + zustand `LearnerProfile.learnerL1` + Drizzle type | Mirrors existing `Player` shape |
| Audit cost for L1-content variants? | 3-pass median audit on text content (because L1 contrast cues are inherently qualitative — different raters will read them differently) | Per memory `feedback-audit-non-deterministic`; phonetics content is harder to audit than text accuracy |
| L1s in initial pilot? | `da` (Danish), `de` (German), `en` (English), `th` (Thai) | Danish is the target language; German + English are phonetically close; Thai is the user's primary motivation |
| Phonetic inventory per L1? | Hard-code the mapping: Danish /ʁ/ ← Thai /r/ trill cue; Danish /sk/ ← Thai /sk/ cue (both exist but Danish is harder); Danish final glottal-t ← all L1s (none have it natively) | Phonetic mapping table lives in `packages/tts-tools/src/tts/l1-phonetic-map.json`; shared across langs |

## Architecture

### Layer 1: Player schema (lq-core)

**File:** `lq-core/libs/app/app-types/src/player.ts`

```ts
export interface Player {
  // ... existing fields ...
  settings: {
    language: string;          // UI locale tag (existing) — ISO 639-1
    learnerL1: string;         // NEW — ISO 639-1, the learner's native language for phonetics cues
    gender?: 'male'|'female'|'other'|'prefer_not_to_say';
    showPronunciation: boolean;
    betaFeaturesEnabled: boolean;
  };
}
```

**File:** `lq-core/libs/infra/database/drizzle/0009_learner_l1.sql`

```sql
ALTER TABLE "players" ADD COLUMN "learner_l1" text DEFAULT 'en' NOT NULL;
```

**File:** `lq-core/libs/lang/game-state/src/learnerProfileStore.ts`

```ts
export interface LearnerProfile {
  // ... existing fields ...
  learnerL1?: string;  // NEW — defaults to undefined until onboarding sets it
}
```

### Layer 2: Onboarding wizard step

**File:** `lq-core/libs/screens/onboarding/src/learnerl1/` (NEW dir)

- `NativeLanguagePicker.tsx` — 3-option grid + "Other" → text input. Stores in `LearnerProfile.learnerL1` via existing `useLearnerProfileStore` hook
- Inserted in onboarding flow between `TargetLanguagePicker` and `AudienceSelectionScreen`
- "Skip" option available (defaults to `en`)
- i18n strings: `onboarding.learnerL1.title`, `onboarding.learnerL1.subtitle`, etc.

### Layer 3: Lesson content variants (lang-quest)

**File:** `lang-quest/lq-nordic/languages/danish/data/en/lessons/chapter-1/concept-danish-stod.json` (example modification)

```json
{
  "lessons": [{
    "id": "concept-danish-stod",
    "title": "Danish Pronunciation: The Stød",
    "type": "concept",
    "tags": ["pronunciation", "stød", "essential"],
    "content": {
      "intro": "The Danish stød is a glottal stop — like the pause between 'uh-oh'.",
      "diagramRef": "danish-pronunciation-the-stod",
      "sections": [
        // ... existing sections unchanged ...
      ],
      "variants": {
        "default": {
          "intro": "The Danish stød is a glottal stop...",
          "ipa": "[ˈhunʌ] vs [ˈhunˀ] — note the catch in the second",
          "audioPrompt": "Read 'hun' (without stød) then 'hund' (with stød) — same length, different catch"
        },
        "th": {
          "intro": "The Danish stød is similar to the Thai 'stop' sound at the end of 'มาก' (máak). Your L1 has this! Try it at the end of Danish words.",
          "ipa": "[ˈhunʌ] vs [ˈhunˀ] — you already know this catch; just apply it to Danish",
          "audioPrompt": "Read 'hun' then 'hund' — say it like you would say 'máak' but with the catch more pronounced"
        },
        "de": {
          "intro": "German doesn't have a glottal stop between words the way Danish does. The closest is the 'Knacklaut' before vowel-initial words. Here it's INSIDE the word — between 'hund' and the final consonant.",
          "ipa": "[ˈhunˀ] — note the small catch before the final /d/",
          "audioPrompt": "Read 'hund' with a tiny Knacklaut before the final /d/ — like saying 'hun.d' but tighter"
        },
        "en": {
          "intro": "English doesn't have this phoneme. The closest is the glottal stop in 'uh-oh' (between the two vowels). Apply that catch to the middle of 'hund'.",
          "ipa": "[ˈhunˀ] — like 'uh-oh' but compressed inside a word",
          "audioPrompt": "Read 'hund' — make a tiny 'uh-oh' between 'hun' and the trailing sound"
        }
      },
      "quiz": [/* unchanged */]
    }
  }]
}
```

**Lesson renderer** (`packages/content-generators` or `lq-nordic` UI) reads `variants[player.learnerL1] || variants.default` and renders the appropriate intro + IPA + audio.

### Layer 4: Audio per (target, L1)

**File:** `lq-tools/packages/tts-tools/src/tts/voice-registry.json` (extend, not replace)

```json
{
  "da-DK": {
    "edge-tts": { "female": "da-DK-ChristelNeural", "male": "da-DK-JeppeNeural" },
    "google":   { "female": "da-DK-Wavenet-A",       "male": "da-DK-Wavenet-B" }
  },
  "da-DK-for-th": {
    "edge-tts": { "female": "da-DK-ChristelNeural", "male": "da-DK-JeppeNeural", "speakingRate": 0.7, "emphasis": "consonant_clusters" },
    "google":   { "female": "da-DK-Wavenet-A",       "male": "da-DK-Wavenet-B",   "speakingRate": 0.7, "emphasis": "consonant_clusters" }
  },
  "da-DK-for-de": {
    "edge-tts": { "female": "da-DK-ChristelNeural", "male": "da-DK-JeppeNeural", "speakingRate": 0.9, "emphasis": "minimal" },
    "google":   { "female": "da-DK-Wavenet-A",       "male": "da-DK-Wavenet-B",   "speakingRate": 0.9, "emphasis": "minimal" }
  },
  "da-DK-for-en": {
    "edge-tts": { "female": "da-DK-ChristelNeural", "male": "da-DK-JeppeNeural", "speakingRate": 0.85, "emphasis": "stød_and_soft_d" },
    "google":   { "female": "da-DK-Wavenet-A",       "male": "da-DK-Wavenet-B",   "speakingRate": 0.85, "emphasis": "stød_and_soft_d" }
  }
  // ...
}
```

**File:** `lq-tools/packages/tts-tools/src/tts/l1-phonetic-map.json` (NEW)

```json
{
  "da": {
    "consonants": {
      "/ʁ/ (uvular R)": "L1 /r/ trill — back of throat, not tongue tip",
      "/sk/ cluster": "L1 /sk/ exists but Danish is sharper — tongue further forward",
      "/ð/ (soft d)": "L1 has no equivalent — closest is /d/ in 'mad' (voiced th in English)",
      "final /t/ glottal": "L1 /t/ exists but Danish often swallows it to a glottal stop"
    },
    "vowels": {
      "/æ/": "L1 /æ/ exists — Danish /æ/ is slightly longer",
      "/ø/": "L1 has /ø/ — similar",
      "/å/": "L1 /o/ — Danish /å/ is backer"
    }
  },
  "th": {
    "consonants": {
      "/ʁ/ (uvular R)": "Thai has /r/ trill — use back of throat instead of tongue tip",
      "/sk/ cluster": "Thai /sk/ exists but Danish initial /sk/ is sharper and unvoiced",
      "/ð/ (soft d)": "Thai has no /ð/ — closest is /tʰ/ or /d/",
      "final /t/ glottal": "Thai final consonants often glottalize — this is natural for you!"
    },
    "vowels": { /* ... */ }
  }
}
```

**Audio gen pass:**
- `--parallel=l1s` flag on `lq-tools/packages/audio-tools/src/generate-audio.ts` — for each lesson, generates N L1-cue audio files (one per `variants` entry)
- Output path: `lang-quest/lq-nordic/languages/danish/audio/chapter-N/{lesson}/l1-{th,de,en,default}/{N}-cue.mp3`
- ~5-10 sec per cue → ~30 cues × 4 L1s = 120 mp3 files = ~6 MB audio (~$0.18 at Google TTS pricing)

### Layer 5: Image layer — NO CHANGE

Per Stage A precedent + memory `project-l1-aware-phonics-flagged-2026-09-15`:
- `regenerate-flagged-images.ts` gets **NO** `--l1` flag
- The 3 Stage A concept-images remain universal (no per-L1 variants)
- All other phonetics art stays universal

### Layer 6: Audit

- 3-pass median on `variants[].intro` text content per L1 (per memory `feedback-audit-non-deterministic`)
- Audio audit: spot-check 5 mp3 per L1 for correctness (is the Danish actually Danish? Is the cue length appropriate?)
- Phonetics-cue quality audit: a separate prompt that scores "does this L1 cue actually help a {l1} speaker?" — needs design + user-validation set (manual for now)

## Pilot Scope

**Apps:**
- **lang-quest/lq-nordic (Danish)** — 3 lessons: `concept-danish-stod`, `concept-danish-sounds`, `danish-pronunciation-the-std` (existing concept lesson with phonetics focus)
- **school-quest/lq-reading** — 2 phonics lessons: `consonant-blends`, `digraphs`

**L1s:** `da`, `de`, `en`, `th`

**Audio scope:**
- For each pilot lesson: 1 L1-cue audio per L1 (4 cues × 5 lessons = 20 new mp3 files)

**Image scope:** unchanged from Stage A (universal only)

## Slice Breakdown

| Slice | Effort | Deliverable |
|---|---|---|
| **Slice 1: Schema + content variants** | 4 days | `learnerL1` field (Player type + Drizzle migration + zustand + onboarding screen). 5 pilot lessons populated with `variants: { th, de, en, default }`. UI renders variant by `player.learnerL1`. **No audio yet** — variants are text-only with cue strings. |
| **Slice 2: Audio per L1** | 3 days | `l1-phonetic-map.json` populated for `da`/`de`/`en`/`th` on Danish consonants/vowels. `voice-registry.json` extended with `da-DK-for-{th,de,en}` entries (slow + emphasis). `generate-audio.ts --parallel=l1s` generates 20 L1-cue mp3 files. CDN paths wired into lesson JSON. |
| **Slice 3: Audit + ship** | 2 days | 3-pass median audit on `variants` text. Audio spot-check (5 mp3 × 4 L1s). E2E test: onboarding → learner profile → Danish lesson → L1 variant renders correctly. |
| **Slice 4 (future): School app rollout** | 5 days | Extend school-quest phonics lessons with `variants`. Add Stage B to the school-quest regen pipeline. |

**Total Slice 1-3: ~9 working days (1 dev, ~2 calendar weeks).**

## Risks

1. **Voice quality for L1-cue audio** — TTS for "Danish pronounced slowly with extra consonant emphasis" may not produce the desired effect (Google Wavenet has limited phoneme-level control). Mitigation: edge-tts as fallback + manual review of the 5 spot-check mp3s per L1 in Slice 3
2. **Phonetic-map accuracy** — the `l1-phonetic-map.json` requires a linguist or L1-speaker validation. Mitigation: in Slice 3, recruit one native speaker per L1 (4 users) for 30-min review sessions; treat their feedback as the source of truth
3. **Onboarding friction** — adding a step to onboarding may drop completion rate. Mitigation: "Skip" option defaults to `en`; A/B test completion rate before/after (no-op for now, instrument later)
4. **Cost of audio at scale** — 4 L1s × 5 lessons × 1 cue = 20 files in pilot. At scale (all 14 langs × all lessons), could be 1000s of mp3 files. Mitigation: only generate L1-cue audio for phonetics lessons (grammar lessons don't need it); budget ~$0.18/pilot, ~$5/lang-app at full scale
5. **No `--l1` flag on regen** — if a user wants L1-specific images later (e.g., for a marketing screenshot showing "what a Thai learner sees"), there's no path. Mitigation: deferred; revisit if user demand appears
6. **L1 detection accuracy** — if we ever add automatic L1 detection, it needs to handle code-switching and multilingual speakers. Mitigation: manual setting only for v1

## Open Questions (need user input before Slice 1 starts)

1. **L1 list — initial scope:** OK with `da`, `de`, `en`, `th` only? Or expand to all 14 ISO codes up front?
2. **UI placement:** full-screen onboarding step vs settings-only? (I recommend full-screen + settings-edit-later)
3. **Default for existing players:** `en` (my recommendation) vs prompt-on-next-login?
4. **Pilot app scope:** OK with `lq-nordic Danish` + `lq-reading`? Or pick a different lang/school app?
5. **Voice cost budget:** OK with the per-L1 voice differentiation? Or keep voice unchanged and only vary cue text?

## Files Touched (Slice 1 estimate)

| Repo | Files | Lines (est.) |
|---|---|---|
| `lq-core` | `app-types/src/player.ts`, `lang/game-state/src/learnerProfileStore.ts`, `infra/database/drizzle/0009_learner_l1.sql`, new `screens/onboarding/src/learnerl1/` | ~+200 / ~−20 |
| `lang-quest/lq-nordic` | 3 lesson JSONs in `data/en/lessons/chapter-1/`, 1 new dir `lq-nordic/src/components/L1Variant/` | ~+400 / ~−50 |
| `school-quest/lq-reading` | 2 phonics lesson JSONs in `content/phonics/lessons/chapter-1/`, 1 new dir `lq-reading/src/components/L1Variant/` | ~+250 / ~−30 |
| `lq-tools` | `packages/tts-tools/src/tts/l1-phonetic-map.json` (new) | ~+200 (later slices) |

**Slice 1 PRs:**
- 1 lq-core PR (schema + onboarding)
- 1 lq-nordic PR (Danish variant content)
- 1 lq-reading PR (English phonics variant content)
- Total: 3 PRs, ~+850 / −100 lines, ~4 days work

## Verification (Slice 1)

- `pnpm install && pnpm build && pnpm test && pnpm typecheck` at lq-core root: green
- `pnpm --filter @learnquest/lq-nordic test` — new `L1Variant` component tests pass (4 L1s × 3 lessons = 12 variants render correctly)
- `pnpm --filter @learnquest/lq-reading test` — same for phonics lessons
- E2E: onboarding flow renders new step, persists `learnerL1`, lesson loads correct variant

## Related

- Memory `project-l1-aware-phonics-flagged-2026-09-15.md` — Stage A shipped; Stage B deferred; ~2-week scope
- Memory `feedback-audit-non-deterministic.md` — 3-pass median justified for L1-cue text
- Memory `feedback-gemini-batch-quota-evening.md` — unrelated but shapes any audio gen budget
- `docs/school-quest-fleet-readiness-2026-09-14.md` — Track 5.1 closes writing; Track 5.2 = Stage B this doc
- `lq-tools/packages/image-tools/src/config/languages/nordic/langs/danish/concept-images.json` — Stage A 3 universal concept-images (input, not modified by Stage B)
