# Personalized content — plan & design spec (2026-09-22)

**Status:** proposal. Nothing started.
**Scope:** `lq-core` (preference model, taxonomy, selection), all lesson apps (lang families,
school, life, books), `lq-tools` content-generators (production), onboarding + settings UI.
**Companion spec:** [`READING_AIDS_PLAN_2026_09_22.md`](READING_AIDS_PLAN_2026_09_22.md) (its
reading-aids setting moves into the preference model defined here).

## Goal

Lessons that fit the learner: their age, why they're learning (travel, work, relocation, exams),
their profession, their interests (sports, music, gaming…), where they live and which variety of
the target culture they're heading for. Today this is used sparingly — kid-level content and
cuisine-specific cooking lessons. Target: every learner sees a core path that stays the same for
everyone plus personalized **variants**, **electives** and **examples** chosen from their preferences.

## Current state (surveyed 2026-09-22, `/Repos/lq-core`)

### 1. The preference filter is not connected — highest-priority finding

`ContentFilter.getLearnerPreferences()` (`libs/infra/database/src/providers/LessonProvider/ContentFilter.ts:52`)
reads the profile via `window.__learnerProfileStore`. **Nothing in lq-core or any lq-* app sets
that global** (grep across `lq-*/src`, `apps`, `libs`). It therefore always takes the catch branch
and returns `{ audienceTier: 'teens' }`:

- `audience` gating always evaluates as a teen, whatever onboarding chose.
- `preferredEpochs` / `preferredRegions` / `preferredThemes` (history/geography) are never applied.

Onboarding does write these (`libs/screens/onboarding/src/audience/AudienceSelectionScreen.tsx` →
`useLearnerProfileStore`), so the data exists — it just never reaches selection. The latent impact
is small only because **no lesson JSON in the fleet carries an `audience` field** (0 hits across
`lq-*/public/data`, `lq-*/languages`, `lq-*/content`). Fix: inject the preference source into
`LessonProvider` (DI / a registered getter from app-shell) instead of a window global, with a test
that fails if it isn't wired.

### 2. Two unconnected preference stores

| Store | Fields | Persisted | Read by |
|---|---|---|---|
| `learnerProfileStore` (`libs/lang/game-state`) | `audienceTier`, `ageGroup`, `preferredEpochs/Civilizations/Regions/Themes`, `learnerL1` | local only (zustand persist) | `ContentFilter` (broken, see 1), L1 phonics variants |
| `Player.persona` (`libs/app/app-types/src/player.ts:143`) | `type` (tourist/expat/student/business), `proficiency`, `interests[]` | player record (DB) | **friend search only** (`PlayerSearchService`) + profile badges |

`persona.interests` is a hardcoded 10-item list in `PersonaSection.tsx`
(`love, business, travel, sports, leisure, food, culture, family, school, work`), no taxonomy, no
lesson ever reads it. Profession isn't captured at all.

### 2b. Onboarding isn't app-aware

Seen in lq-reading's production build: after the age question, the **Reading** app asks kids to pick
favourite *history eras and regions* (`AudienceSelectionScreen` shows the epoch step for every
school user). The next step (character) then crashes with a Router error, so onboarding can't be
finished (tracked in the reading-aids spec, step 2a). The new preference screens must be declared per app
(which dimensions an app asks for), not shown to every school app.

### 3. What "sparingly used" actually is today

- **Age:** `AudienceTier` type + onboarding picker + per-app `public/taxonomy.json`
  `audienceLevels` (authoring guidance for generators, not read at runtime). The runtime gate is the
  disconnected filter above. *Open question: which surface did the kid-vocabulary behaviour come
  from — a separate content set, or generator prompts? I couldn't find a runtime path.*
- **Cooking/locale:** cuisine lessons (e.g. `lq-cooking/public/data/lessons/en/chapter-8/mexican-base-flavors.json`)
  and per-language `vocab-cooking` lessons (e.g. `lq-african/languages/*/data/*/lessons/chapter-5/`)
  are **authored per language/cuisine**; they carry free-form `tags` only (`mexican`, `chiles`,
  `regional`). Nothing selects them by the learner's locale.
- **Working mechanisms to build on:**
  - L1 `variants` + `resolveL1Variant` (`lesson-ui/variant`) — in-lesson substitution keyed by a
    learner attribute. The one per-learner personalization that actually runs.
  - `@regional/<region>/` image tier (`libs/common/assets/.../regional-resolution.ts`) — shared
    cross-repo asset pools, reusable for facet vocabulary packs.
  - `word-problem` lesson type (math) — natural home for interest-themed examples.

## Design

### A. One preference model

Consolidate into `LearnerPreferences`, owned by `learnerProfileStore`, **synced to the player
record** (so it follows the learner across devices and apps; household/guest seats keep their own).

```ts
interface LearnerPreferences {
  audienceTier: AudienceTier;                 // gate — kids | teens | adults
  learnerL1: string;                          // ISO 639-1
  goals: GoalId[];                            // why: travel, relocation, work, study, exam, family-heritage, hobby
  professions: ProfessionId[];                // optional, adults/teens only; 0–2
  interests: InterestId[];                    // 0–8, hierarchical ids, e.g. 'sport.football'
  homeRegion?: RegionId;                      // where the learner lives (currency, foods they know)
  targetRegion?: RegionId;                    // which variety of the target culture (pt-BR vs pt-PT, dk vs no)
  exam?: ExamId;                              // e.g. 'da:pd3', 'nb:norskprove-b1'
  history?: { epochs: HistoricalEpoch[]; regions: string[]; themes: string[] }; // existing school prefs
  readingAids?: ReadingAidsPrefs;             // from the companion spec
}
```

`persona.type` maps onto `goals` (tourist→travel, expat→relocation, student→study, business→work);
`persona.interests` migrates through an alias table. `persona.proficiency` stays where it is
(placement, not personalization).

### B. Controlled taxonomy (lq-core `@learnquest/app-config/taxonomy`)

One versioned list per dimension: stable ids, i18n label keys, icon, `audience` restriction, and
parent for hierarchy. Selection matches on any ancestor (`sport.football` matches `sport`).

- **Interests v1:** `sport.{football,handball,basketball,cycling,running,swimming,tennis,winter,martial-arts}`,
  `music`, `gaming`, `film-tv`, `books`, `art-design`, `tech`, `science-space`, `nature-outdoors`,
  `animals`, `food-cooking`, `travel`, `fashion`, `health-fitness`, `vehicles`, `history`,
  `family-parenting` (adults), `money-business`, `relationships` (adults), `crafts-diy`.
- **Professions v1:** `healthcare.{nursing,medical,care-work}`, `hospitality-tourism`, `it-software`,
  `construction-trades`, `education-childcare`, `retail-sales`, `office-admin`, `finance`,
  `logistics-driving`, `manufacturing`, `agriculture`, `legal`, `engineering`, `research-academia`,
  `cleaning-facilities`, `beauty-wellness`, `public-sector`, `creative-media`.
- **Kids:** professions hidden; offer `dream-jobs` (firefighter, vet, astronaut…) as interests instead.
- Taxonomy is a schema-validated JSON (Zod in `@learnquest/schemas`) so generators and the admin
  editor share it; unknown ids fail CI, like `learnerL1Options` does today.

### C. Lesson facets

Replace the flat, ad-hoc `audience` / `epoch` / `region` / `theme` fields with one optional object
(old fields read as aliases during migration):

```ts
facets?: {
  audience?: AudienceTier[];     // hard gate
  goals?: GoalId[];
  professions?: ProfessionId[];
  interests?: InterestId[];
  regions?: RegionId[];          // target-culture region the content is about
  homeRegions?: RegionId[];      // bridges from the learner's home (e.g. "your kitchen → Danish kitchen")
  exam?: ExamId[];
  history?: {...};               // existing epoch/region/theme
}
```

### D. Four mechanisms (in resolution order)

1. **Gate (hard filter)** — `audience` and content-safety only. Everything else is soft: a learner
   never loses core content because of a preference. (Today's filter treats region/theme as hard
   exclusions — change that.)
2. **Variants (in-lesson substitution)** — generalize `resolveL1Variant` to `resolveVariant(content,
   prefs)`: `variants` keyed by facet selectors, most specific match wins, `default` fallback.
   ```json
   "variants": {
     "default":                      { "words": ["bread","cheese","apple"] },
     "audience=kids":                { "words": ["cookie","apple","juice"] },
     "targetRegion=dk":              { "words": ["rugbrød","leverpostej","æblekage"] },
     "interest=sport":               { "sentence": "After the match we eat…" }
   }
   ```
   Specificity: explicit multi-key > single key > default; ties break on declared order. L1 variants
   become `l1=<code>` keys (back-compatible reader).
3. **Electives (slots in the path)** — chapter manifests declare slots:
   `electives: [{ slot: 'ch3-e1', dimension: 'interests', count: 1, fallback: 'vocab-hobbies' }]`.
   The selector scores candidate lessons (facet overlap, ancestor match = half weight, not yet
   completed) and fills the slot; no match → generic fallback, so the path never has holes. Learner
   can swap an elective from a small picker. Plus an off-path **"For you"** track listing all
   matching lessons (profession packs, interest packs) for learners who want more.
4. **Examples (sentence/word-problem pools)** — drills, word problems, reading passages draw example
   items from facet-tagged pools, falling back to generic. Cheapest personalization per unit of
   content: one pool serves many lessons.

Selection is deterministic per learner + chapter (seeded) so progress, reviews and SRS don't
reshuffle between sessions; changing preferences only affects slots not yet started.

### E. Locale, three ways

- `learnerL1` — explanation language / contrastive notes (existing).
- `homeRegion` — bridge content ("ingredients you know → what they're called/used in Denmark"),
  currency and units in word problems.
- `targetRegion` — which variety: ingredients, dialect, institutions (Danish vs Norwegian bakery
  words, pt-BR vs pt-PT). Cooking is the pilot: cuisine lessons get `regions`, per-language
  `vocab-cooking` gets `targetRegion` variants.

### F. Content production

- **Facet packs, authored once, localized many times.** A pack = concept-id vocabulary + phrases +
  scenarios for one facet (e.g. `profession.healthcare.nursing`: 60 concepts, 20 phrases, 3 dialogues),
  authored in English with concept ids, images from `@regional/universal/vocab/<facet>/`, then
  localized per language by `lq-tools` content-generators (L1 review gate as in `L1_CONTENT_REVIEW.md`).
- **Prioritize by reach**, not the full matrix (14 lang families × ~40 languages × ~40 facets is
  unbuildable): v1 = 6 interests (football, music, gaming, food-cooking, travel, nature) + 4
  professions (healthcare, hospitality, IT, construction) + 2 goals (relocation, work) in the top
  3 languages by learners, then expand by usage data.
- **Generator changes:** content-generators take a `facet` argument, read the taxonomy, emit
  `facets` + `variants`; image configs get a `facet` field so regen/audit stay per-facet.
- **Kids tier:** separate generation prompts + vocabulary caps (reuse `taxonomy.json`
  `audienceLevels`) rather than post-hoc filtering of adult content.

### G. Per app family

| Family | Variants | Electives / packs | Examples |
|---|---|---|---|
| Lang (14 families) | kids vocab, target-region vocab, cooking | profession packs, interest packs, exam prep, relocation | drill + dialogue pools by interest |
| School (reading, math, history…) | kids/teens reading level | interest-themed reading passages, history epochs (existing prefs) | math word problems by interest; reading fluency passages |
| Life (cooking, health…) | home/target region (cuisines, units) | cuisine electives by region | — |
| Books | — | story themes by interest | — |

### H. Onboarding & settings

- Onboarding adds one screen after audience: **"What do you like?"** (interest chips, max 8) and for
  teens/adults **"Why are you learning?"** (goals) + optional **profession**. Skippable; defaults
  are empty = generic path.
- Settings: replace `PersonaSection`'s hardcoded list with taxonomy-driven pickers; show "changes
  apply to upcoming lessons".
- Privacy: profession and interests are optional, stored on the player record, excluded from public
  profile/friend search unless the learner opts in (friend search uses interests today — keep it
  opt-in).

### I. Measurement

- Coverage audit script (like `coverage-audit.ts`): per app, facet × chapter matrix of variants /
  electives / pool size; flags slots that always fall back.
- Events: elective picked / swapped, variant served, completion rate personalized vs generic.

## Plan

| Phase | What | Exit criterion |
|---|---|---|
| **P0 — wire what exists** | Replace the `window.__learnerProfileStore` lookup with an injected preference source; make region/theme soft; wiring test in every app shell | an app's `ContentFilter` sees the onboarding `audienceTier` (test proves it) |
| **P1 — model + taxonomy** | `LearnerPreferences` + player-record sync + persona migration; taxonomy JSON + schema; `facets` on lesson schema (aliases for old fields) | persona interests round-trip into the new model; schema CI validates facet ids |
| **P2 — selection engine** | `resolveVariant` (generalized L1 resolver), elective slots in chapter manifests, "For you" track, seeded selection | unit tests; one app with 2 elective slots live behind a flag |
| **P3 — onboarding/settings** | per-app declaration of which preference steps to show (drop history eras from non-history apps); interest / goal / profession screens, settings pickers, privacy defaults | new learners can set all dimensions; E2E covers skip path |
| **P4 — pilot content** | cooking by `targetRegion` (lq-cooking + lq-nordic `vocab-cooking`); healthcare + hospitality packs in Danish; football + music interest electives in lq-nordic; interest-themed math word problems | pilot content live; coverage audit green for pilot |
| **P5 — generators + scale-out** | facet-aware content-generators + image configs; v1 facet set across top 3 languages; kids-tier generation | coverage report per app; usage data drives next facets |

## Open decisions

1. Where did the existing kid-vocabulary behaviour come from (separate content vs generator prompts)?
2. Top 3 languages for P4/P5 — by learner count or by strategic market?
3. Should electives count toward chapter completion (recommended yes: path shape stays constant)?
4. Is profession collected for teens (vocational students) or adults only?
5. Sync preferences through the existing player record or a new `learner_preferences` table
   (recommended: player JSON column first, table when household seats need per-seat prefs).
