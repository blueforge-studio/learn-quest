# Fleet readiness — audit and roadmap

*Audited 2026-09-02, across the 14 `lq-*` language apps. Every number below is
measured, and the command that measures it is given so it can be re-run rather
than believed.*

## The finding

**Thousands of lessons ship with no content**, committed to
`public/data/lessons`. A learner reaching one gets a blank screen: the lesson
is not hidden or greyed out, it is emitted with `status: 'available'`.

Two different numbers matter, and conflating them overstates the work:

| | count | what it measures |
|---|---|---|
| Lessons declared in `chapters.json` | 11,484 | intent |
| **Distinct authoring gaps** | **4,155 (36%)** | lessons somebody must write |
| **Empty lesson files emitted** | **5,364** | files a learner can currently open |

The second is larger than the first because a lesson is emitted **once per
source locale**. One unwritten Greek lesson in `lq-balkan` becomes four empty
files (`de`, `en`, `es`, `fr`). Amplification is not uniform:

| app | source locales | gaps | empty files | amplification |
|---|---|---|---|---|
| lq-nordic | 7 | 43 | 280 | **6.5x** |
| lq-balkan | 4 | 661 | 1,810 | 2.7x |
| lq-southeast-asian | 9 | 376 | 979 | 2.6x |
| most others | 1–3 | — | — | 1.0x |

**Fixing the generator removes all 5,364 empty files. Closing the authoring
gap is 4,155 lessons, not 5,364** — plan §3 against the smaller number.

`lq-romance` shipped 204 of these until 2026-09-02; it is now at 0. `lq-english`
likewise.

## The cause

One line, in `scripts/generate-lesson-files.ts`:

```ts
function loadLessonContent(...): Record<string, unknown> {
  const p = join(LANGUAGES, lang, 'data', locale, 'lessons', chapterId, `${lessonId}.json`);
  if (!existsSync(p)) return {};        // <-- absent content becomes empty content
  ...
}
```

The caller does not distinguish "no content" from "empty content", so it writes
the lesson out regardless:

```ts
content: loadLessonContent(lang, locale, chapter.id, lesson.id),
status: 'available',
```

`chapters.json` is a declaration of intent — it lists lessons somebody planned.
The generator treats it as a manifest of lessons that exist.

**Verified present in all 14 apps:**

```sh
for a in lang-quest/lq-*/; do
  printf '%-22s %s\n' "$a" \
    "$(grep -c 'if (!existsSync(p)) return {};' "$a/scripts/generate-lesson-files.ts" 2>/dev/null)"
done
```

## The fix, already written

Landed in `lq-english` on 2026-09-02, which is now the only app at **0 empty**.
Three parts:

1. `loadLessonContent` returns `null` for absent **or all-empty** content.
   `null` and `{}` are deliberately different values.
2. Unauthored lessons are pruned **before** `chapters.json` is written. Pruning
   only at write time still left the index advertising 14 lessons whose files
   were correctly never created — dead entries in the UI. Pruning first keeps
   the index, the chapter counts and the files agreeing by construction.
3. Skips are reported loudly at the end of the run, grouped by chapter. Silence
   is how 99 blank lessons shipped under a manifest claiming 100% coverage.

Reference implementation: `lang-quest/lq-english/scripts/generate-lesson-files.ts`.

## Roadmap

### 1. Propagate the generator fix — 13 apps ✅ DONE 2026-09-02

Highest value-to-effort in the codebase: one function, already tested, removes
5,568 broken lessons.

**Order: `lq-romance` first** — it is live and serving 204 of them.

Per app: apply the fix, re-run the generator, verify `dead refs: 0` and
`empty: 0` in the emitted tree, commit both the script and the regenerated
`public/data/lessons`.

### 2. De-duplicate the generator — PACKAGE LANDED, apps not migrated

This single bug lives in 14 copies. That is precisely
`docs/TECH_DEBT_AUDIT.md`'s "Massive Script Duplication (HIGHEST PRIORITY)",
open since 2026-08-18 — now with a measured cost: **5,364 shipped defects
from one line**.

Fix first, extract second, so the extraction is a refactor of known-good code
rather than a rewrite of a bug. Target: `@learnquest/unit-core` or a new
`lesson-tooling` package, consumed by all 14.

### 3. Set `shipChapters` from real completeness

Only `lq-celtic` and `lq-english` set it. Measured completeness (authored ÷
declared, `en` locale):

Ranked by **distinct authoring gaps** — the lessons somebody has to write —
rather than by emitted files:

| app | declared | gaps | complete |
|---|---|---|---|
| lq-nordic | 698 | 43 | 94% |
| lq-germanic | 349 | 126 | 64% |
| lq-slavic | 519 | 146 | 72% |
| lq-east-asian | 696 | 157 | 77% |
| lq-romance | 865 | 204 | 76% |
| lq-west-slavic | 513 | 214 | 58% |
| lq-uralic | 513 | 219 | 57% |
| lq-celtic | 684 | 274 | 60% |
| lq-middle-eastern | 696 | 289 | 58% |
| lq-southeast-asian | 1,300 | 376 | 71% |
| lq-african | 1,041 | 433 | 58% |
| lq-south-asian | 1,215 | 503 | 59% |
| lq-english | 855 | 510 | 40% |
| lq-balkan | 1,540 | 661 | 57% |

`lq-nordic` is the most complete app in the fleet at 43 gaps — its 280 empty
files are almost entirely amplification across seven source locales, not
missing work.

`shipChapters: N` ships the first N chapters and holds the rest without
deleting authored content — raise it as chapters land.

### 4. Investigate `lq-nordic` at 105%

The inverse defect: **more authored lessons on disk than `chapters.json`
declares**. Authored content that no learner can reach, because the index never
advertises it. Different bug, opposite direction, same root — the index and the
content are maintained separately with nothing checking they agree.

### 5. Deploy

13 of 14 apps have a domain in `blueforge.config.json` and nothing behind it.
Only `romance.lang-quest.blueforge.studio` resolves.

Do this **after** 1–3, or the deploy ships the blank lessons.

## Done on 2026-09-02

- **§1 complete.** All 14 apps. 17,859 emitted lessons with 5,568 empty became
  12,291 emitted with **0 empty and 0 dead refs**, every app verified
  independently. 14 PRs.
- **§2 half done.** `@learnquest/lesson-tooling` exists in `lq-core/libs/` with
  20 tests. The apps still carry their own (now-fixed) copies until it is
  published to packr.
- **Symlinks: 1,988 of 2,259 removed.** Per-file links into `public/_shared`
  that `resolveLessonImage` already resolved without them. They broke every
  recursive audit (a routine count reported 13,145 files for lq-nordic against
  a real 1,690), and `forge r2 sync` walks with `statSync`, which FOLLOWS
  links, so each uploaded a full duplicate into the per-language CDN prefix.
  `content-integrity` green in all 14. Kept: the 14 `_regional/universal`
  links, which point outside the repo and are load-bearing.
- **Fleet CI unblocked.** Eleven of fourteen apps had CI that had never
  installed dependencies. Three layers, each hidden behind the one before it:
  missing `packageManager` (died at setup), missing `allowBuilds` in
  `pnpm-workspace.yaml` (`ERR_PNPM_IGNORED_BUILDS`), and no
  `@blueforge-studio` registry mapping in `.npmrc` (`ERR_PNPM_FETCH_404`
  against npmjs.org). The three apps that always had CI — nordic, romance,
  english — are exactly the three that had all three settings.
- **RPG game data reached production for the first time.** See below.

## The game-data path (fixed 2026-09-02)

Five files — `achievements`, `bosses`, `challenges`, `equipment`, `rewards` —
were fetched three different ways and **all three failed** on live romance:

| caller | resolved to | result |
|---|---|---|
| loaders via `getLocalizedData` | CDN `apps/romance/french/data/en/…` | 404 |
| `EquipmentService` | app origin `/apps/{locale}/…` | **200 + index.html** |
| `BossService` | app origin `/data/bosses/{locale}.json` | **200 + index.html** |

Nothing published them: they live at `languages/<lang>/data/<locale>/*.json`,
which the generator never copies into `public/` and the r2 push excluded via
its `images,audio` filter.

Three fixes, all landed:

1. `EquipmentService` and `BossService` now resolve through
   `getLocalizedData`, which `rpgLoader.ts` already used for these same files.
   The literals were root-relative, and the equipment one interpolated the
   bare language where a group app needs `<group>/<language>`.
2. A push entry `languages → apps/<group>` with `filter: json`. Pushed from
   `languages/`, **not** `public/languages/`, because `audit-specs.json` lives
   under the latter and widening that filter would publish working files. The
   cost is ~1,831 inert lesson-source JSONs per app, since the filter has no
   path matching.
3. `location ~* \.json$ { try_files $uri =404; }` in both vite-spa nginx
   templates. A missing `.json` returning the SPA shell is what let this reach
   production unnoticed.

Verified: all five files serve real JSON across all five romance languages.

**Outstanding:** the other 13 apps need the same push entry. And
`content/_shared/game/` is a byte-identical duplicate of one locale's copy —
lq-nordic already has neither and is the correct shape — deletable once this
path is confirmed on more than one app.

## Smaller items

- **`php` and `python` deploy templates still healthcheck against `localhost`**
  (`forge-control/packages/deploy-strategies/src/templates/*/Dockerfile.hbs`).
  nginx and most runtimes bind IPv4-only; Alpine musl resolves `localhost` to
  `::1` first with no fallback, so the probe is refused forever while the
  service serves fine. This gave `quest-cards-web` a `FailingStreak` of 17,491
  — six days of false-unhealthy. Every other template already uses `127.0.0.1`.

- **Guard the standardization fixed on 2026-09-02.** `packageManager` and
  `pnpm-workspace.yaml` (`allowBuilds`) are now uniform across all 14, after 11
  apps were found with CI that had never installed dependencies. A repo-level
  check would stop that drifting again.

## A note on how these went unnoticed

Every defect here reported success while failing:

| | reported | actual |
|---|---|---|
| Blank lessons | `status: 'available'` | no content |
| "1,810 empty in balkan" | 1,810 lessons to write | 661 lessons, emitted 2.7x |
| Coverage manifest | `"percentage": 100` | 42% authored |
| nordic smoke tests | "3 passed" | asserting against an invite gate |
| 11 apps' CI | red at setup | never installed, so never tested |
| quest-cards health | unhealthy | serving 200 throughout |

The common shape is a green-looking signal standing in for an absent one. Where
this roadmap adds a check, the check is written to fail loudly rather than
degrade quietly — the pruning step logs what it dropped, and the drift tests
name the constant they expect.
