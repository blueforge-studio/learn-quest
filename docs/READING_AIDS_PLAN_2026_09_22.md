# Reading aids — plan & design spec (2026-09-22)

**Status:** step 1 done — lq-reading#29 (open). Steps 2–4 not started.
**Scope:** `lq-core` (shared model + component), `lq-reading` (first consumer),
lang apps (`lq-nordic` Danish first), `lq-tools` (annotation generator).
**Companion spec:** [`PERSONALIZED_CONTENT_PLAN_2026_09_22.md`](PERSONALIZED_CONTENT_PLAN_2026_09_22.md).

## Goal

Show early and second-language readers how a word is built and how it sounds,
directly on the word:

| Aid | Rendering | Example |
|---|---|---|
| Syllable dots | middle dot between syllables | `but·ter·fly`, `ka·ge` |
| Silent letters | struck through + greyed | ~~k~~night, ~~h~~vad, man~~d~~ |
| Sound variants (hard/soft) | color + small mark under the letter (never color alone) | hard **g** in *gade* vs soft **g** in *kage* |
| Letter teams | underline joining the letters | <u>ch</u>air, n<u>igh</u>t |
| Tap to hear | tap a letter group → its sound; tap the word → whole word | |

Then teach the patterns directly: "one spelling, several sounds" lessons
(ch → /k/ · /tʃ/ · /ʃ/; th hard/soft; silent h; Danish soft g; Danish d
hard/soft/silent), with aids gradually removed as the learner masters words.

## Current state (surveyed 2026-09-22)

Checkouts used: `/Repos/lq-core` and `/Repos/lq-reading` (current).
`learn-quest/lq-core` and `learn-quest/school-quest/lq-reading` are older
checkouts — don't audit against them.

- **No syllabification anywhere.** The only thing close is a vowel-group
  counter in `lq-core/libs/lang/drill-engine/src/propose.nb.ts:58` (Norwegian
  plural heuristic).
- **Syllables exist only as prose.** e.g. `lq-reading/public/data/lessons/en/chapter-2/syllable-types.json`
  explanations: `"'mu' is open, 'sic' is closed"`. The only structured
  syllable data is 6 `syllable-split` practice items (`"syllables": ["cab","in"]`).
- **The phonics screen drops most lesson data.** `lq-reading/src/screens/phonics/PhonicsLessonScreen.tsx`
  renders `ex.word` only — never `explanation`, `audio`, `image` on examples,
  or the lesson `sentence` (present on 36/43 phonics lessons).
- **Practice items are badly broken across all lq-reading screens** (554 items, 4 lesson types):
  - **181 multiple-choice items render without their question.**
    `QuestionActivityRenderer` routes `multiple-choice`/`multiple`/`identify`/`select`/`true-false`
    to `OptionGrid`, which takes no `prompt` (`lq-core/libs/school/lesson-ui/src/components/question-types/QuestionActivityRenderer.tsx`).
    So "How many syllables in 'butterfly'?" shows only `2 / 3 / 4`. This bug is in
    lq-core and affects **every school app** using lesson-ui, not just lq-reading.
  - **24 of those have no `correct`/`correctAnswer`** (content uses another key) → nothing can be marked right.
  - **117 items hit the "Activity type not yet supported" fallback** — incl. `syllable-split` (6),
    `blend` (12), `build` (6), `classification` (6), `order` (12), `short-answer` (6).
    `classification` is missing from `CANONICAL_TYPES` though `classify` is mapped.
  - `syllable-split` prompts give the answer away (`"Split 'cabin' into syllables: cab/in"`).
- **Example assets:** all 163 phonics example `audio`/`image` refs (`audio/words/cat.mp3`,
  `images/letters/cat.webp`) are absent from `public/`. Per `docs/ASSET_RESOLUTION.md` that does
  **not** prove they're missing (path-convention refs resolve override → shared → raw / CDN) —
  verify against the CDN before regenerating anything. Step 1 plays audio with a speech fallback so
  it works either way.
- **Danish pronunciation is informal respelling** (`farvel → "far-vel"`, `Æble → "eb-leh"`), not
  aligned to letters. The lessons exist though: "Danish Hard D vs Soft D (ð)", "Final-T
  Glottalization", "The Stød", "Danish Sounds".
- **Reusable pieces:** L1 variants (`resolveL1Variant`, `lesson-ui/variant`), the tonal lesson shape
  (hear → minimal pair → listening quiz, `lq-core/libs/app/app-types/src/lesson/tonal.ts`),
  `PronunciationDisplay` (`lq-core/libs/lang/lesson-framework`), the drill-engine
  "propose + confidence + CONFIRM" authoring pattern.

### Lesson chrome (found while verifying step 1)

All in lq-core `lesson-ui`, so it affects **every school app**, not only lq-reading:

- `LessonShell` paints an opaque `min-h-screen bg-gray-50` sheet over app-shell's `LessonLayout`, hiding
  the per-domain `<Background>` completely.
- `LessonHeader` uses its `gradient` prop as the whole background class; lq-reading passed
  `from-purple-600 to-violet-600` without `bg-gradient-to-r`, so the white title and intro were invisible.
- `ContentCard` is plain `bg-white`, not the glass recipe the topbar and app-shell cards use.
- School apps ship **no `public/data/assets/domains.json`** (checked lq-reading, lq-history, lq-math,
  lq-science, lq-geography; only language apps have one), so `loadDomainBackgrounds` returns nothing and
  the page falls back to a flat gradient.
- Art: the CDN root `_shared/images/rpg/backgrounds/` has `hygge-interior`, `fairy-forest`,
  `coastal-cliffs`, `battle-arena`, `viking-village-battle` (Nordic-themed); `study`, `library`,
  `classroom` and similar names 404. Reading-themed art was generated on 2026-09-22 (see step 1 below);
  other school apps still have none.
- Onboarding (lq-core, seen in lq-reading's production build): the character step crashes with
  `useLocation() may be used only in the context of a <Router>`. New learners cannot finish onboarding;
  the legacy `onboarding-completed` key bypasses the guard. Also the brand button shows 🇹🇭 for Reading.

## Step 1 — what shipped (lq-reading `feat/reading-aids-step1`)

- `SyllableWord` (dots, sliced from the real word, screen-reader text kept) — prototype of `<AnnotatedWord>`.
- `SyllableSplitActivity` — tap gaps between letters to place dots; reads all 3 content shapes; strips
  answers from prompts; hints on demand; one retry, then shows the split.
- `PracticeItem` wrapper for all screens: prompt shown for multiple-choice; answers resolved from
  `answer` / option index / boolean / case variants; true/false gets True/False options; `classification`
  and option-style `classify` render as choices; `groups` + answer-map sorts normalized; unsupported types
  become think-then-reveal cards (`order` reveals `correctOrder`); open tasks show the prompt only.
- Phonics screen: syllable dots, per-word play button (speech fallback, works on repeat taps), explanations,
  "Read it" sentence card, old `letter/sound/words/sentences` lesson shape supported.
- Sight-words gets quiz state (options were unselectable); fluency practice becomes interactive; non-array
  `practice` (sight-words-set-1) no longer crashes the screen.
- Glass chrome: fixed in the **standard** layout instead of per app — lesson-ui 0.6.0 (lq-core#83, published
  2026-09-22) makes `LessonShell` transparent and `ContentCard` a `GlassmorphismCard`; lq-reading uses it
  (`@learnquest/ui` added as a direct dep + Tailwind `@source`). `domains.json` maps every domain to a background.
- Backgrounds: `reading-nook` (lesson content), `grand-library` (dashboard, library, settings),
  `storybook-village` (lesson map), `story-forest` (profile, onboarding, social) in
  `public/_shared/images/rpg/backgrounds/` — gemini-3.1-flash-image realtime, 6 calls ≈ $0.47. Plain files
  are 1920×1080 (the `srcset` declares them 1920w). Uploaded to `lq-assets` `_shared/images/rpg/backgrounds/`
  on 2026-09-22 via `sync-to-storage.ts` (12 files). Edges that saw a pre-upload probe cache the 404 for 4h.
- Content: `syllables` added to ch2 + ch5 syllable-type examples (`ba-by` → `baby`); ch4 already had them.
- Tests: 17 new (components + a content guard over all 554 practice items: every choice has a correct
  option among its options, every split parses, every non-open fallback has something to reveal).

## Design

### 1. Data model — `WordAnnotation` (lq-core `@learnquest/schemas`)

Optional on any example / vocab item / sentence token. Absent → plain word, so it is
additive and content can adopt it word by word.

```ts
interface WordAnnotation {
  word: string;                 // surface form, must equal graphemes.map(g => g.g).join('')
  syllables?: string[];         // spoken syllables; join('') === word (case-insensitive)
  graphemes?: GraphemeSeg[];    // letter groups in order
  source?: 'authored' | 'generated';
  confidence?: 'high' | 'low';  // generated + unconfirmed → 'low', rendered only in review/admin
}

interface GraphemeSeg {
  g: string;                    // 'k', 'igh', 'ch'
  silent?: boolean;
  team?: boolean;               // digraph/trigraph/vowel team — draw the joining underline
  sound?: string;               // IPA, e.g. 'j', 'ð', 'k'
  soundId?: string;             // key into the per-language sound catalog, e.g. 'da:g-soft'
  variant?: 'hard' | 'soft' | 'long' | 'short' | 'voiced' | 'voiceless';
}
```

Examples:

```json
{ "word": "kage", "syllables": ["ka","ge"],
  "graphemes": [{"g":"k"},{"g":"a"},{"g":"g","sound":"j","soundId":"da:g-soft","variant":"soft"},{"g":"e"}] }
{ "word": "knight", "syllables": ["knight"],
  "graphemes": [{"g":"k","silent":true},{"g":"n"},{"g":"igh","team":true,"sound":"aɪ"},{"g":"t"}] }
{ "word": "mand", "graphemes": [{"g":"m"},{"g":"a"},{"g":"n"},{"g":"d","silent":true}] }
```

**Hand-authoring shorthand** (compiled to the JSON above by the generator and the admin editor —
JSON stays canonical):

| Mark | Meaning | Example |
|---|---|---|
| `·` | syllable break | `but·ter·fly` |
| `(x)` | silent | `(k)n[igh]t`, `man(d)`, `(h)vad` |
| `[xy]` | letter team | `[ch]air` |
| `x<ipa\|variant>` | sound / variant | `ka·g<j\|soft>e`, `[ch]<k>ri·sti·an` |

### 2. Sound catalog (per language)

`lq-core/libs/lang/.../sounds/<lang>.json`: `soundId → { ipa, label, keyword word, audio clip }`,
e.g. `en:th-voiced → /ð/, "th as in *this*"`, `da:d-soft → /ð/, "blødt d som i *mad*"`.
Clips are short phoneme recordings (TTS-generated via the audio lazy-cache, reviewed). Gives
tap-to-hear something to play and gives sound-pattern lessons their buckets.

### 3. Rendering — `<AnnotatedWord>` / `<AnnotatedText>` (lq-core, shared)

Lives in a lib both school (`lesson-ui`) and lang (`lesson-framework`) apps consume — proposed
`@learnquest/ui` or a new `@learnquest/reading-aids`. Props: `annotation`, `aids` (which layers
are on), `onSegmentTap`, `size`. Rules:

- Syllable dot is a separate, non-selectable span — copy/paste gives the plain word; screen
  readers get `aria-label={word}` plus an optional "spelled in syllables" description.
- Silent = `line-through` + reduced opacity; hard/soft = color **and** a glyph (e.g. `̣` dot vs `˘`)
  so it works for color-blind readers and in print (`print-cards` can reuse it).
- Team underline spans the grapheme's letters as one arc.
- Unannotated words render plainly; `<AnnotatedText>` tokenizes a sentence and looks up
  annotations per token from a lesson-level or language-level dictionary.

### 4. Learner setting — reading aids

`learnerProfileStore.profile.readingAids = { syllableDots, silentLetters, soundVariants,
letterTeams, fading: 'auto' | 'always-on' | 'off' }`. Defaults by app + `audienceTier`
(lq-reading kids: all on; lang apps adults: teams + silent on, dots off). Settings screen toggle
group next to the existing L1 selector. Moves to the unified preference model in the companion spec.

### 5. Annotation generator (lq-tools)

`annotate-words` script, same shape as drill-engine proposers: **propose → confidence → CONFIRM**.

- **Syllables:** TeX/Liang hyphenation patterns as the draft (available for en/da/nb/sv/de).
  Caveat: print hyphenation ≠ spoken syllables (patterns refuse 1-letter edge splits like `o·pen`,
  and Danish/English phonology differs from print rules) → early-reader words need human confirm.
- **Grapheme ↔ sound alignment:** English from CMUdict (ARPAbet → IPA, then DP alignment to
  letters); Danish from eSpeak-NG IPA output or an LLM draft. Anything that doesn't align cleanly
  is `confidence: 'low'`.
- **Rule tables** flag silent letters / variants on top of the alignment:
  - **en:** magic/final e; silent k (kn), w (wr), gh, b (mb), h (hour, honest, th→/t/ in Thomas/thyme);
    soft c/g before e/i/y; ch → /tʃ/ chair · /k/ school · /ʃ/ chef; th → /θ/ thin · /ð/ this;
    igh, vowel teams, r-controlled vowels.
  - **da:** g hard (*gade*) · soft /j/ (*kage*) · silent (*pige*); d hard (*dag*) · soft /ð/ (*mad*) ·
    silent (*mand*, *guld*, *hvad*); silent h in hv/hj (*hvem*, *hjem*); final -t often silent (*det*);
    ch → /ɕ/ (*chokolade*, *chauffør*) · /k/ (*Christian*); stød stays in the tonal lesson type.
- Output writes `annotation` into lesson JSON; review via admin editor (a `WordAnnotation` field
  editor using the shorthand).

### 6. "Sound pattern" lesson type

One spelling, several sounds. Flow (reuses the tonal lesson shape):

1. Intro card — the spelling, each sound with keyword word + tap-to-hear.
2. Sort — drag words into sound buckets (with audio).
3. Minimal pairs — hear two words, pick which sound.
4. Read with aids on → read again with aids faded.

Content shape: `{ type: 'sound-pattern', pattern: 'ch', sounds: [{soundId, keyword}], words:
[WordAnnotation], pairs: [[a,b]] }`. First lessons: **en** ch (k/tʃ/ʃ), th (θ/ð), silent h,
soft vs hard c/g, magic e; **da** g (hard/soft/silent), d (hard/soft/silent), hv/hj, final -t.

### 7. Fading

Per-word mastery (correct reads/answers without aids) drives `fading: 'auto'`: aids drop layer by
layer (dots → teams → variants → silent) once a word/pattern is mastered; any miss brings them back
for that word. Store in the existing progress store; no new backend.

## Plan

| Step | Where | What | Exit criterion |
|---|---|---|---|
| **1** | lq-reading | Show dropped example data (explanation, audio w/ speech fallback, sentence); render questions for multiple-choice items; support `syllable-split` locally with an interactive split; hand-authored syllables rendered as dots in example words (local prototype of `<AnnotatedWord>`) | phonics screens show every authored field; no hidden prompts on lq-reading screens; syllable lessons show `but·ter·fly` |
| **2a** | lq-core lesson-ui + app-shell | Fix the shared renderer bugs: prompt for `OptionGrid` types, `classification` alias, answer aliases (index / boolean / `answer`), grouped sorts, handlers for `blend` / `build` / `order` / `syllable-split`. ~~Fix the chrome~~ (done: lesson-ui 0.6.0, lq-core#83 — other school apps pick it up by bumping; dark mode for the activities still open). Ship `domains.json` + reading/school background art for school apps. Fix the onboarding character-step Router crash. Then drop lq-reading's local workarounds | 0 hidden prompts / 0 "not yet supported" across school apps (content-integrity check); school lessons show domain backgrounds; onboarding completes |
| **2b** | lq-core | `WordAnnotation` schema, `<AnnotatedWord>`/`<AnnotatedText>`, reading-aids setting | lq-reading uses the shared component; Storybook stories for en + da |
| **3** | lq-tools | `annotate-words` generator (en first, then da) + admin shorthand editor | lq-reading examples annotated & confirmed; Danish d/g lessons annotated |
| **4** | lq-core + apps | `sound-pattern` lesson type, sound catalogs + clips, fading, first en/da lessons | 5 en + 4 da pattern lessons live |

## Open decisions

- Home of the shared component: `@learnquest/ui` vs a new `@learnquest/reading-aids` lib.
- Danish syllabification convention for learners (orthographic `ka·ge` vs phonetic) — pick one and
  document it; recommend orthographic for reading.
- Whether generated (`low` confidence) annotations may ever render to learners, or admin-only until confirmed (recommend admin-only).
