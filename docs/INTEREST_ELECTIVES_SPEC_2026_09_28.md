# Interest electives — spec (2026-09-28)

**Status:** decisions taken 2026-09-28 (operator: quota 5 default ≈30%, scales with chapter size, min 2; rest delegated). Narrows mechanism **D.3 (electives)** of
[`PERSONALIZED_CONTENT_PLAN_2026_09_22.md`](./PERSONALIZED_CONTENT_PLAN_2026_09_22.md) into a
buildable contract. **Owners:** learn-quest session (engine in lq-core, generator in lq-tools);
lang-quest session (per-app content once the contract lands).

## Problem (survey 2026-09-28)

- Profile → Settings has an interest picker (`lq-core/libs/screens/profile/src/settings/components/PersonaSection.tsx:16`):
  a hardcoded list of 10 (`love, business, travel, sports, leisure, food, culture, family, school, work`),
  stored on `Player.persona.interests` (`libs/app/app-types/src/player.ts:154`). Onboarding never asks, and
  **no lesson selection reads it**. Friend search is the only reader.
- Lesson JSON has no `facets`/`category`, only free-form `tags`. Topic content exists only where a
  chapter's *theme* is that topic, and it is part of the core path:

  | Danish (lq-nordic) Σ over 15 ch | love | business | travel | sports | music | gaming | tech | food | family |
  |---|---|---|---|---|---|---|---|---|---|
  | lessons | 0 | 7 (ch13) | 14 (ch3, 11) | 2 | 0 | 0 | 1 | 13 (ch2) | 12 (ch4) |

  French is the same shape. The target of 2–3 per category per chapter is essentially all new content.
- **Hook that already exists:** `LessonGroup` (`libs/app/app-types/src/lesson/base/group.ts:24`) with
  `type: 'side' | 'bonus' | …` + `branchPosition`, which the map renders as branches off the main
  path (`MapLayoutService.ts:28-103`). This is used for only 4–5 side groups per app.
- Personalisation P0 is still unfixed: `ContentFilter.ts:53-78` reads a window global that nothing sets.

## Contract

### 1. Taxonomy (lq-core `@learnquest/app-config/taxonomy`, Zod-validated in `@learnquest/schemas`)

v1 interest categories (stable ids; hierarchical children allowed later, e.g. `sport.football`):

`sport`, `music`, `business`, `travel`, `food`, `tech`, `gaming`, `film-tv`, `nature`, `family`,
`relationships` (adults/teens), `arts-culture`, `health-fitness`, `study`, `work`

Legacy persona ids are mapped through an alias table: `sports→sport`, `love→relationships`,
`leisure→film-tv`+`gaming`, `culture→arts-culture`, `school→study`. The picker becomes
taxonomy-driven and is also offered once in onboarding (skippable, max 8).

### 2. Lesson facet

```json
{ "id": "elective-sport-match-day", "type": "conversation", "facets": { "interests": ["sport"] }, ... }
```

Elective lessons live in the normal chapter folder (`lessons/chapter-N/`). They must use only
vocabulary from chapters ≤ N plus the facet's own topic vocabulary. That is a generator
constraint, and the content-shape check verifies it.

### 3. Chapter manifest: an `elective` group

```json
{ "id": "ch3-electives", "type": "elective", "branchPosition": 8, "quota": 5,
  "lessons": ["elective-sport-match-day", "elective-sport-gym", "elective-music-concert", "..."] }
```

`lessons` is the **pool**. Only the selected lessons render as a branch. **Quota rule:** an explicit
`quota` wins; otherwise `quota = max(2, round(0.3 × coreLessons))`, where coreLessons counts the
chapter's main-path lessons. That gives ≈5 for a typical 15–17-lesson chapter, and the floor is 2.
The id prefix `elective-` keeps pools greppable.

### 4. Selection: pure function, seeded, materialised

`selectElectives(pool, interests, quota, seed, history) → lessonId[]` in lq-core (no I/O, unit-tested).

1. **Candidates:** C = selected interests that have ≥ 1 lesson in the pool (an ancestor match counts).
   If C is empty, no elective branch is shown (the core path is unaffected).
2. **Allocate the quota across categories.** k = |C|.
   - k ≥ quota: pick `quota` categories, 1 lesson each. The pick is seeded, and categories skipped in
     the previous chapter are favoured, so every interest recurs across chapters.
   - k < quota: each category gets ⌊quota/k⌋, and the remainder goes 1-each to seeded-random categories.
     A category is **capped at its available lessons**. Any overflow is redistributed to categories
     with spare lessons.
   - k = 1: min(quota, available). This is the only case where one category takes everything.
3. **Pick lessons within a category:** seeded shuffle; uncompleted before completed; exact facet
   before ancestor match.
4. **Seed:** `hash(playerId, chapterId)`. Picks are **materialised** into player progress the
   first time the chapter opens, so SRS and review never reshuffle. A preference change re-rolls
   only picks that have not been started.

Examples with quota 5: {sport, music, business} → 2/2/1 (which two get 2 is seeded);
{sport, music} → 3/2; {sport} alone with 3 authored → 3; 7 interests → 5 × 1, and the other
2 are favoured next chapter.

### 5. Progression

**Recommendation:** electives award XP and count toward "chapter mastery" stars but **do not gate**
unlocking the next chapter. A learner with no interests set has no electives, so gating would make
the path shape depend on preferences.

## Content budget

15 categories × 15 chapters × 2–3 lessons ≈ 450–675 lessons per language, which is not buildable
fleet-wide up front. Plan by reach:

- **Pilot:** Danish (lq-nordic, the only 0.5.x app) × 6 categories (sport, music, business, travel,
  tech, food) × 15 chapters × 2 = **180 lessons**. Generating the text is cheap
  (~$0.001/lesson via qwen-turbo/flash-lite); images cost ~1–2 × $0.0335 each (≈ $6–12);
  the real cost is review.
- Then the top 3 languages by learner count × all 15 categories. Other families follow usage data,
  and only after their core path reaches 15 chapters.

## Phases

| Phase | Where | What | Exit |
|---|---|---|---|
| E0 | lq-core | P0: injected preference source replaces `window.__learnerProfileStore`; interests read from `Player.persona.interests` | a wiring test fails when unwired |
| E1 | lq-core | taxonomy + alias table, `facets` in the lesson schema, `'elective'` group type, `selectElectives` | property tests: quota respected, spread (max − min ≤ 1 unless capped), determinism, re-roll only unstarted |
| E2 | lq-core | MapLayoutService renders the selected electives; materialise picks; taxonomy picker in Settings + onboarding step | e2e: set 3 interests → branch shows 5 lessons, 2/2/1 |
| E3 | lq-tools | content-generators **facet mode**: real lesson-type mix, `{lessons:[…]}` wrapper, facet tags, `elective` group appended to `chapters.json`, vocabulary ≤ chapter N (today's generator is a stub; see C5 in STATUS) | dry-run for danish ch1–2 passes the content-shape check |
| E4 | lq-nordic (lang-quest) | pilot 180 Danish lessons + images; web-app bump | live; coverage audit green |
| E5 | fleet | scale by reach; coverage matrix (category × chapter) in `coverage-audit.ts` | per-app report |

School/life reuse the same engine: interest-themed math word problems and reading passages as
electives, with no extra engine work.

## Decisions (2026-09-28)

1. **Quota:** `max(2, round(0.3 × coreLessons))`, which is ≈5 on a typical chapter; the manifest can override it (operator).
2. **Gating:** electives do not gate chapter unlock; they count toward mastery stars and XP.
3. **Categories:** the v1 list of 15 as above; `relationships` is hidden for the kids tier.
4. **Pilot:** Danish × {sport, music, business, travel, tech, food}. Chapters 16–20 (see the
   chapter-expansion work) get electives from the start rather than being retro-fitted.
