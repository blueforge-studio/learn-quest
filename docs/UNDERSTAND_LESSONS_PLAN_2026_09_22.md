# "Understand" lessons — plan & design spec (2026-09-22)

**Status:** U0 done — lq-reading#30 **merged** 2026-09-22. U1–U4 not started.
**Scope:** new `understand` lesson type in lq-core, first consumers lq-reading (English) and
lq-nordic (Danish), then all lang families.
**Related:** [`READING_AIDS_PLAN_2026_09_22.md`](READING_AIDS_PLAN_2026_09_22.md) (aids inside passages),
[`PERSONALIZED_CONTENT_PLAN_2026_09_22.md`](PERSONALIZED_CONTENT_PLAN_2026_09_22.md) (passage themes per learner).

## Goal

Check that the learner **understands** what they read, not only that they can decode it. Read a text,
answer questions about it, show where in the text the answer is. Modelled on the reading tasks used in
Danish adult-education classes (the learner's partner is taking them) and on school reading programmes.

## Current state (surveyed 2026-09-22)

- **lq-reading has 22 `comprehension` lessons (ch2: 4, ch3: 4, ch4: 5, ch5: 8, ch6: 1).** 16 carry a
  passage, spread over 8 keys: `story` (8), `passage` (5), `passages` (3, each with its own question),
  `readingPassage` (2), `storyText`, `reading`, … Questions sit in `practice` (15), `questions` (5) or
  `comprehensionQuestions` (1).
- **`ComprehensionLessonScreen` renders only `intro` + `practice`.** The passage is never shown, so learners
  answer questions about a text they cannot see; lessons with `questions` instead of `practice` show
  no questions at all (7 lessons render the intro only).
- **Danish (lq-nordic) has 0 reading-comprehension lessons** (176 lessons: vocab, concept, drill,
  conversation, culture, dialogue, …). Dialogue lessons are listening/speaking, not reading checks.

## Where in the path

| Track | Ch 1–2 | Ch 3–4 | Ch 5–6+ |
|---|---|---|---|
| **English (lq-reading, kids)** | sentence level: read a sentence → pick the picture / yes-no | short passages (3–6 sentences): who/what/where, order of events, vocabulary in context | multi-paragraph: main idea, inference, author's purpose, compare two texts |
| **Danish & lang apps (adults, L2)** | — (not enough vocabulary) | from ch3: short everyday texts built only from taught words — a note, an SMS, a sign | notices, emails, adverts, timetables, short articles; later exam-style sets |

Starting English at sentence level in ch1–2 matters: decoding without meaning checks trains
"barking at print". Language apps start at ch3, once the learner has enough words for a real text.

## Design

### Lesson shape (`type: "understand"`)

```ts
interface UnderstandContent {
  intro?: string;
  texts: UnderstandText[];            // usually 1; 2+ for matching / compare tasks
  questions: UnderstandQuestion[];
  showTextDuringQuestions?: boolean;  // default true; false = recall mode (later chapters)
}

interface UnderstandText {
  id: string;
  genre: 'sentence' | 'story' | 'note' | 'sms' | 'email' | 'notice' | 'advert' | 'timetable' | 'article' | 'dialogue';
  title?: string;
  paragraphs: string[];               // sentence-addressable: evidence refs are [paragraph, sentence]
  image?: string;
  audio?: string;                     // narration; TTS lazy-cache fallback
  glossary?: Record<string, string>;  // words beyond the learner's level, tap to see in L1
  annotations?: Record<string, WordAnnotation>; // reading aids, from the reading-aids spec
}

interface UnderstandQuestion {
  id: string;
  skill: 'literal' | 'vocabulary' | 'sequence' | 'inference' | 'main-idea' | 'purpose';
  form: 'choice' | 'true-false-not-given' | 'picture' | 'match-text-to-person' | 'order' | 'find-in-text' | 'gap';
  prompt: string;
  options?: string[];
  correct: string | string[];
  evidence?: { text: string; paragraph: number; sentence: number }[]; // highlighted after answering
  explanation?: string;
}
```

**Question forms**, the ones Danish classes lean on marked ★:

- `choice` — multiple choice.
- ★ `true-false-not-given` — *rigtigt / forkert / står ikke i teksten*. Tests reading precision, not
  guessing from world knowledge.
- ★ `match-text-to-person` — several short texts (adverts, notices), several people with needs; match them.
- ★ `find-in-text` — "When does the doctor's office open?" The learner taps the sentence in the text;
  checked against `evidence`.
- `gap` — fill a word back into a sentence from the text.
- `order` — put events in order (reuses the sort/order activity).
- `picture` — sentence → pick the picture (English ch1–2).

### Screen

- Desktop: text on the left, questions on the right. Mobile: text card on top, collapsible and sticky
  while answering, with a "show text" button.
- After each answer: the evidence sentence is highlighted in the text, plus the explanation.
- Tap-to-hear per sentence (narration), tap a glossary word for its L1 meaning, and optional reading
  aids (syllable dots, silent letters) for early readers.
- Glass cards over the domain background, like the rest of the fixed lq-reading screens.

### Content rules (enforced by the generator + a content test)

1. **Vocabulary control:** ≥ 95% of word tokens in a text must be in the vocabulary taught up to that
   chapter (≥ 98% for kids / A1); the rest go in `glossary`. The lang apps already have per-chapter
   vocab lessons to build the known-word list from.
2. Every question has `evidence` except `inference`/`main-idea`, which need an `explanation`.
3. `true-false-not-given` sets must include at least one "not given" item.
4. Length by chapter: ch1–2 one sentence; ch3–4 40–120 words; ch5–6 120–300 words.
5. Genres for adult L2 skew toward everyday texts (notices, emails, timetables); themes come from the
   learner's goals and interests once the personalization spec lands (relocation → landlord email, school
   message; work → shift schedule).

### Migration of existing comprehension lessons

A normalizer maps the 8 legacy passage keys and 3 question keys into `texts` + `questions` (like the
practice-item normalizers in lq-reading's `PracticeItem`). The comprehension screen renders through the
new shape, so the 16 passages become visible immediately, before any new content is written.

## Plan

| Step | What | Exit criterion |
|---|---|---|
| **U0** (lq-reading, next) | Show passages on the existing comprehension screen via the legacy-key normalizer; render `questions` / `comprehensionQuestions` too | all 22 comprehension lessons show their text + questions; content test enforces it |
| **U1** (lq-core) | `understand` schema + screen (evidence highlighting, true/false/not-given, find-in-text, match-text-to-person) | Storybook + unit tests; lq-reading renders one lesson through it |
| **U2** (lq-tools) | Generator with vocabulary control + per-chapter known-word lists; narration via TTS cache | generated lesson passes the vocab-coverage test |
| **U3** (content) | English: 1 sentence-level lesson/chapter in ch1–2, 2 passage lessons/chapter in ch3–4. Danish: 2 everyday-text lessons/chapter from ch3 | pilot live in lq-reading + lq-nordic Danish |
| **U4** | Roll out to other language families; exam-style sets for learners whose goal is an exam | coverage report per app |

## Open decisions

1. Danish first, or all four Nordic languages at once (shared generator, per-language review)?
2. Should an Understand lesson gate chapter completion, or be optional practice?
3. Recall mode (text hidden while answering) — from which chapter, if at all?
