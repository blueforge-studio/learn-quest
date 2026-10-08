# User audit: books-platform apps (2026-10-07)

**Ask (operator):** add the user audit to the books-platform apps, one at a time, and test it there.
**Done so far:** `lq-story-book` (4 books, 2 profiles), `lq-activity-book` (2 books, 3 profiles), `lq-interactive-book` (3 books, 7 choice paths), `lq-adventure-book` (load-blocked in production; explored behind the blocker,
walker not built). **Next, in this order:**
the adventure walker, then marketplace / author / discover (purchase and entitlement flows; Stripe is unactivated, so write
rails matter most there).
**Code (throw-away spike, untracked):** `spike/books/` in the lq-nordic audit worktree: `stub-api.mjs`, `lib-books.mjs`,
`graph.mjs`, `walk-story.mjs`. Reuses the `resume/checkpoint.mjs` store.

## Safety first: the apps default to PRODUCTION

`packages/books-reader/src/env.ts` falls back to `https://api.questbooks.blueforge.studio` when `VITE_BOOKS_API_URL` is unset.
An unguarded local run could write reading progress to production. Docker is not running and there is no local book content
(`books-platform/data` holds config only), so a local books-api is not available. Two layers, both enforced in code:

1. **Local stub on :3009** (`stub-api.mjs`): `GET`/`HEAD` pass through to the live API read-only and are cached on disk;
   `POST`/`PUT`/`PATCH`/`DELETE` are **never forwarded**, only recorded in a ledger and answered locally. The dev server already
   proxies `/api/content` to :3009, and the app is started with `VITE_BOOKS_API_URL` and `VITE_CONTENT_API_URL` pointing at it.
2. **Browser guard** (`lib-books.mjs`): any non-`GET/HEAD/OPTIONS` request to a non-local host is aborted and recorded.

Result across all runs: **0 writes attempted, 0 blocked**; the only external host contacted was `fonts.googleapis.com`.
The one live check (deployed reader, deep-sea-explorer) was anonymous and read-only, under the same guard.

## What a story book is: a graph, and the audit walks it

Each book's content API exposes chapters, each with scene ids, each scene typed `story` (pages), `comprehension`,
`choice`, `vocabulary` or `ending`. Edges: story -> `nextScenes`; comprehension -> `onCorrect`/`onIncorrect`; choice ->
`choices[].outcome.target`. `graph.mjs` builds this from the content, enumerates root-to-ending **paths**, and computes the
declared scene/edge set. A run walks one path, identifying the current scene by matching rendered text to content.
This is the journey-branching model from the integration design (section 10.4), built from content, with edge-coverage
over paths, on a real product.

| Book | Scenes | Edges | Paths | Result (`perfect`) |
|---|---:|---:|---:|---|
| ancient-egypt-explorer | 14 | 17 | 2 (mummification / treasury branch, rejoin at scene-10) | both completed, **14/14 scenes**, no flags |
| solar-system-journey | 14 | 17 | 2 | both completed, 14/14; text altered in scene-6 p2 |
| the-enchanted-library | 12 | 15 | 3 | all completed, 12/12; text altered in scene-8 p1-3 and scene-10 p1 |
| **deep-sea-explorer** | 13 | 15 | **0** | **blocked: "Failed to load scene"** (below) |

Timing, serial: about 28 s per path for the 14-scene books (4-5 minutes for all four books with branches). The `struggling`
profile (wrong answers) gave **identical results**, because in every comprehension scene `onCorrect` equals `onIncorrect`.

## Findings (all reproduced; none ticketed yet, pending the operator)

1. **deep-sea-explorer cannot be read past its first scene, in production.** Every story scene's `nextScenes` ids are
   `to-scene-2`, `to-scene-3`, ... which do not exist (real ids are `scene-2`, ...). 9 dangling edges. The reader asks
   for `/api/content/deep-sea-explorer/scenes/to-scene-2`, gets a 404 and shows **`story-error: Failed to load scene`**.
   Confirmed on the deployed reader `story.questbooks.blueforge.studio` (anonymous, read-only). Static detection: any
   `nextScenes[].id` that is not a scene id. Owner class: `content`.
2. **Vocabulary hotspots corrupt the page text.** `books-reader/src/components/RichTextContent.tsx` matches a token to a hotspot
   after lowercasing and stripping punctuation, then renders `hotSpot.word` (the glossary term) in place of the token (line 35).
   So the **capital letter is lost** ("Stanza" -> "stanza", "Rhyme" -> "rhyme") and **attached punctuation is dropped**
   (`afterlife.'` -> `afterlife`: the sentence loses its full stop and closing quote). Replaying the exact logic over the
   live story content: **72 pages, 55 hotspot words, 15 lose capitalisation, 18 lose punctuation.** The walker now catches this
   as an invariant, "rendered text equals content text", which flagged it in 3 of 4 books without being told about it.
   Owner class: `lib` (shared reader). Noted: the walker's own scene matcher initially failed on exactly this, which is how it
   was found.
3. **Live `GET /api/books` returns HTTP 500** (2 of 2 requests, 2026-10-07). The reader apps use `/api/content/manifest`, which
   works; the book list route is probably used by the marketplace/discover apps. Not yet exercised there.

Design observations (not defects): comprehension scenes route right and wrong answers to the same scene in all four books, so a
wrong answer has no remediation path; an anonymous reader's progress is never saved (no write attempted at all), so closing the
tab loses it; quiz answers are index keys (`correctAnswer: 1`), the convention behind lq-core #142.

## Limits, stated plainly

- **Resume granularity is one path.** Reading position is persisted only for signed-in readers, and a path takes about 30 s, so a
  crash replays the current path; finished paths are skipped on rerun (journey-level resume). Mid-book resume would need a
  signed-in session, which the safety rules do not allow against production.
- Anonymous reader only; the local app reads **live production content**, so results depend on production content at the time.
- The scoring/report layer (`blueforge.user-audit/1`) is not wired to books yet; this round established the walker, the safety
  harness and the findings.

## lq-activity-book: two defects stacked on top of each other

Content: 2 books x 2 chapters x 4 activities (16 in total). Every activity is a question with options, `hints` and an
`explanation`; the three answer keys in each question (index, option ids, `isCorrect`) agree in all 16, so there is no
answer-key defect to find in the content. The app is another matter.

| # | Finding | Evidence | Owner class |
|---|---|---|---|
| 1 | **Every activity book is a blank page in production.** The deployed reader loads, requests meta and `?chapter=1` (both 200) and renders an **empty `<main>`**: no error, no empty state. | Confirmed on `activity.questbooks.blueforge.studio/book/math-adventures` (anonymous, read-only). Cause: `books-api` answers `GET /api/content/<book>?chapter=N` with a **bare array** (`res.json(scenes)`, `routes/content.ts`), but `ContentService.loadChapterScenes` returns `data.scenes` (`books-shared/src/services/contentService.ts:127`), which is `undefined` for an array. `useActivityBook` wraps it as `[undefined]`, the current activity is undefined, and `ActivityBookScreen` returns `null` (line 89). Its only caller is the activity book. | contract drift (API vs shared client) |
| 2 | **A learner can answer exactly one activity per page load.** After the first answer, the next activity appears already answered and locked: its correct option green, the option in the *same position as the learner's previous pick* red, everything disabled for 10+ s (no timer clears it). | Reproduced locally and tracked for 10 s. Cause: `ActivityCard` keeps `selectedId`, `answered` and `showHint` in `useState`; `ActivityBookScreen` renders `<ActivityCard activity={current} .../>` **without `key={current.id}`**, so React reuses the instance and the previous answer state carries over. Masked in production by finding 1. | lib / app (missing `key`) |
| 4 | **The advertised hint cost is never charged.** The button reads "Show hint (-3 XP)", but using a hint changes nothing: XP is identical to a run without hints, and the later correct answer still awards the full reward. | `hinter` profile, every activity in both chapters. Cause: `ActivityCard` takes the label from `hints[0].cost` but `handleHint` only increments a counter (`useActivityBook.ts:108`); awarded XP is `activity.rewards?.xp || 10` (`ActivityCard.tsx:32`) with no hint term. The end screen does show "1 Hints Used". | app (game mechanics) |
| 3 | After a chapter's end screen, **Continue returns to the book page, not the next chapter.** | Walker: after "Continue" the first activity of chapter 2 was not shown; the book intro text was. May be intended; flagged as a design question. | design |

**Why this is the audit's best demonstration so far:** finding 2 cannot be seen on the live site at all, because finding 1 hides
it. A normal "does the page load" smoke test stops at 1; a journey audit that can step behind a known blocker reports both.
To get behind finding 1 the walker uses two clearly labelled aids and records that it did: the stub's **audit-only**
`COMPAT_WRAP_SCENES=1` shim (wraps the array as `{scenes: [...]}` so the client works) and, behind finding 2, a **deep link**
(`?chapter=N&scene=<id>`) that mounts a fresh `ActivityCard`. Every report states `compatShimUsed` and
`deepLinkWorkaroundUsed`. Neither is a fix; a fix is `Array.isArray(data) ? data : data.scenes` (or wrapping in the API) and
`key={current.id}`.

Invariants checked behind the blockers (both books; `perfect`, `hinter`, `struggling` on math-adventures): all 8 activities completed in every run;
the declared XP was awarded for each correct answer and none for a wrong one; the "Activity k of n" label matched; the explanation was shown after answering. The chapter end screen
reported "1 out of 4" only because the deep-link workaround resets the in-app counters, so that figure is an artefact of the
workaround, not a finding.

Suggested guard (cheap, high value): a contract test that runs the real `books-api` handler's chapter response through the
real `ContentService.loadChapterScenes`. Finding 1 is exactly the class of bug such a test catches.

## lq-interactive-book: no book can be finished

Content: 3 books (14, 16 and 15 scenes), each with 3 choice scenes and 2 endings, so genuine branching and a different graph
shape from the story books: `content.text`, `choices[].nextSceneId`, `comprehensionQuestion{question, options, correctIndex}`
(a **fourth** spelling of "which option is right" across the books apps: `correctAnswer` index, option `isCorrect`, option ids,
`correctIndex`; relevant to lq-core #142). Story scenes carry no next pointer, so the app advances them in order and only
choices jump. The walker takes each option of the first choice scene and plays on.

| Book | First choice | Paths walked | Result |
|---|---|---:|---|
| mystery-island | scene-2 (2 options) | 2 | both stuck at scene-5 |
| space-station-alpha | scene-3 (3 options) | 3 | all stuck at scene-7 |
| jungle-expedition | scene-3 (2 options) | 2 | both stuck at scene-6 |

**Finding 5: the first comprehension question is a dead end, in every interactive book.** After the learner answers (right *or* wrong)
the options lock and nothing else happens: no explanation, no Continue, no auto-advance, for 40 s locally and on the deployed
reader `interactive.questbooks.blueforge.studio` (read-only). Because the first comprehension scene sits in chapter 1, **0 of the 6
endings are reachable and no book can be completed.** Cause: `ComprehensionScene` renders `<QuizRunner ... autoAdvance={false}>`
(`lq-interactive-book/src/components/ComprehensionScene.tsx`), but `QuizRunner` calls `onComplete` only from its auto-advance timer
(`books-reader/src/components/QuizRunner.tsx:19`, which returns early when `autoAdvance` is false). Nothing else calls it, so
`handleComplete` never runs and the scene never sets `answered`, so the explanation and the Continue control (gated on it) never
appear. Owner class: `lib`/app. The story book's quiz uses the default (`autoAdvance` true) and works, which is why this only
shows up here.

**Observation:** on the deployed reader, simply reading triggers `POST /api/audio/narration` (3 calls in one page view). Those
are lazy text-to-speech generation requests against production, with a cost, issued by an anonymous reader. The browser guard
blocked them; the audit therefore cannot exercise narration, and the audit design must treat "reading causes a write" as a
safety property to verify per app, not assume.

Coverage statement the report should print: e.g. mystery-island, path choice1, 5 of 14 declared scenes (36 %), 0 of 2 endings.

## Static check for books content: `books-content-check.mjs` (tier 0 for books)

The same idea as the lesson shape check: most defects found above were decidable from the content, with no browser. The script
reads every book of all four apps through the read-only stub (17 books, 241 scenes) and checks: **dangling edges** (a scene points
at a scene id that does not exist), **unreachable scenes**, **no reachable ending**, **answer keys** (index out of range, or index
and `isCorrect` disagreeing), and **hotspot corruption** (words the reader's hotspot renderer will alter).

| Rule | Result over 17 books / 241 scenes |
|---|---|
| dangling-edge | **20 edges in 5 books**: deep-sea-explorer 13 (`to-scene-N`, `to-vents`, `to-abyss`) and 7 in adventure books (jungle-detective 1, robot-rebellion 3, the-coral-kingdom 2, the-viking-voyage 1). All 7 adventure targets return HTTP 404 from the scene endpoint, so they are real, not unlisted. |
| unreachable-scene | 40 scenes in 6 books (mostly a consequence of the dangling edges: everything after a broken link is cut off) |
| no-ending | deep-sea-explorer (its ending is unreachable) |
| answer-key | **0**: every comprehension and activity answer key is in range and consistent |
| hotspot-corruption | **10 of 17 books** (all 4 story books and 6 of 8 adventure books); e.g. the-enchanted-library 20 hotspot words, 10 lose capitalisation, 4 lose punctuation |

So the hotspot renderer bug is not a story-book quirk: it reaches the adventure books too (they share `books-reader`).
Adventure dangling edges are **not yet confirmed in a browser** (the adventure walker is the next step); the 404s are
confirmed at the API. Suggested home: a CI step in `books-platform` (it is fast and needs no browser), the same recommendation as
for `content-shape-check`.

Saved with the other spike code in `tools/user-audit-spike/books/` (stub, guard, graph, three walkers, the check, three
live read-only checks) and `tools/user-audit-spike/resume/` (checkpoint store, supervisor, crash tests).

## lq-adventure-book: down in production; explored behind the blocker

**Finding 6: the adventure book does not load for anyone.** The deployed reader `adventure.questbooks.blueforge.studio` shows
"**Failed to fetch config** / Try Again" instead of the book list. Cause: `GET /api/config/adventure-defaults?locale=en`
returns **HTTP 500 `{"error":"Failed to fetch config"}`** on the live API (as does `activity-defaults`), and the app treats the
config as mandatory (`ConfigBoundary` around `AdventureBookScreen`). All 8 adventure books are affected.
Related: `GET /api/books` also returns 500. The routes that fail are the ones that read **rows** (config is a runtime-mirrored
database row; `books` is a catalogue query); the routes that serve **content** (`/api/content/...`, backed by object storage) work.
That pattern points at the books database, not at the individual routes, but I have not verified it (no access to the host).

To audit behind it I added a second clearly labelled stub shim, **`COMPAT_LOCAL_CONFIG=1`** (off by default, counted in the ledger as
`compatConfig`): when the live config route fails, it serves the repo's own `books-platform/data/config/<name>.json` wrapped in
the `{data:{payload}}` envelope the client expects. It is not a fix. First attempt failed (served the raw file; the app threw
`Cannot read properties of undefined (reading 'payload')`), which is how the envelope was learned.

Behind the shim the app is an RPG-style journey: home with 8 books, then **Create Your Hero** (Scholar, Warrior, Explorer,
Detective; "Begin Adventure" disabled until a class is chosen), then scenes of type `story`, `choice`, `skill-check`,
`encounter` and `boss` (7 of 8 books use all five). **Not built yet: the adventure walker.** Reason: encounters and bosses
have combat/skill mechanics (HP, energy, sanity, dice) whose rules must be read before an audit can assert anything about
them; walking blind would only produce another "did it advance" check.

Static results for the 8 books are above (7 dangling edges in 4 books, all returning 404; hotspot corruption in 6).

Summary of production state found by this audit, 2026-10-07 (all read-only, anonymous):

| App | Production state | Cause |
|---|---|---|
| story | 3 of 4 books readable; **deep-sea-explorer unreadable** after scene 1; hotspot text corrupted | content ids (`to-scene-N`); renderer |
| activity | **blank page for both books** | API/client contract drift on `?chapter=` |
| interactive | **no book can be finished** (first quiz is a dead end) | `autoAdvance={false}` with no other completion path |
| adventure | **does not load** | live `/api/config/*` returns 500 |
| marketplace / author / discover | **not yet audited**; `GET /api/books` returns 500, which they likely use | likely database |

## Hosting note (2026-10-07, from the `control` session)

The deployment DB (`app_deploy_configs` -> `deploy_hosts`) places books-platform on **app-1**, not app-2. `books-platform/CLAUDE.md` still
says forge-app-2 (178.104.130.80) with a port table, so one of them is stale; the DB is treated as the source of truth.
`control` also states that the live 500s and blank readers were **not** caused by its work (an app-2 storage relocation that day
did not touch app-1). Practical effect: audits of the books apps were not paused, and the 500s are not explained by that maintenance.

## Lead on the 500s (from `control`, read-only look at app-1; checked locally by me)

app-1 shows all 10 books-platform containers Up and healthy. Its `postgres-shared` log repeats `relation "product_assets" does not exist`
and `relation "deployed_apps" does not exist` every ~5 min. **I checked: those are blueforge registry tables** (blueforge/CLAUDE.md), not
referenced anywhere in books-platform, so that log line most likely belongs to a blueforge catalog job and **does not explain the
books 500s**. Better hypothesis, still unverified: `GET /api/config/:slug` reads the `game_config` table (`GameConfigRepository`; 404 on
missing row, **500 only when the query throws**) and `GET /api/books` queries the books tables, so a missing migration or an unreachable
books DB fits both. The deciding evidence is the books-api container log line for those requests (the route catch blocks log the
error); `control` can read it, the audit cannot. Incident ticket T1 should quote that line once available.

## Tickets filed (2026-10-07, operator-approved; all in `blueforge-studio/books-platform`)

All five findings were re-verified live (12:25 UTC) immediately before filing.

| # | Ticket | Priority |
|---|---|---|
| [#55](https://forge-git.blueforge.studio/blueforge-studio/books-platform/issues/55) | Live books-api: `GET /api/books` and `/api/config/*` return 500 (adventure reader down); **cause unestablished**, asks for the books-api container logs | P0 (incident, control copied) |
| [#51](https://forge-git.blueforge.studio/blueforge-studio/books-platform/issues/51) | activity-book: blank page in production, plus answer-state leak and uncharged hint cost behind it; ship together | P0 |
| [#52](https://forge-git.blueforge.studio/blueforge-studio/books-platform/issues/52) | interactive-book: first comprehension quiz is a dead end (0 of 6 endings reachable) | P0 |
| [#53](https://forge-git.blueforge.studio/blueforge-studio/books-platform/issues/53) | Content: 20 dangling next-scene links in 5 books; deep-sea-explorer unreadable | P1 |
| [#54](https://forge-git.blueforge.studio/blueforge-studio/books-platform/issues/54) | RichTextContent hotspot rendering drops capitals and punctuation | P2 |

Corrections made while drafting (kept here because they show what the evidence did and did not support): the activity blank page was
verified in a browser for `math-adventures` only (`science-explorer` returns the same bare-array API response); the hotspot corruption
is browser-confirmed for the story books and only content-predicted for the adventure books; in deep-sea-explorer, 11 of the 13
dangling `to-` ids become valid once the prefix is removed, and the other two sit on a choice scene whose choice targets are valid.

## UPDATE: root cause of the live 500s (#55) found; my hypothesis above was wrong

After the operator authorised a read-only log check, the `control` session read the books-api container's error lines
(`books-platform-books-api-1-1` on app-1; log lines only, no DB access, no secrets read). Every `[config.GET/:slug]` call and an
`[unhandled]` error fail with **`PostgresError: password authentication failed for user "app_books_platform"`** (14 of 14 matching lines;
204 error-ish lines in 12 h). So it is **not** a missing `game_config` migration and **not** an unreachable database, which is what I
had written ("likely a missing migration or an unreachable DB"): the app reaches Postgres and is rejected on credentials, i.e. the
role's password in app-1's postgres-shared and the one in the container's `DATABASE_URL` no longer match (a rotation or redeploy that
updated only one side; which side is not known). The correct next step is for the books-platform owner to compare against the vault /
rotation record and re-sync or redeploy, and to check whether other `app_*` roles on app-1 were rotated at the same time. Posted on
books-platform#55 (the description there still contains the superseded hypothesis; the comment says so).

What was right: the failing routes are exactly the row-reading ones and the working routes are the object-storage ones. What was wrong:
the specific cause. The earlier statement was labelled "unverified" everywhere it appeared, which is why correcting it was cheap.

## CI packaging (2026-10-07)

Local branch `chore/books-smoke` in books-platform (worktree `.bp-smoke-wt`, not pushed): `scripts/user-audit/`
(self-contained, own lockfile, 7 unit tests pass) + `.gitea/workflows/books-smoke.yml` (every 6 h + dispatch).
Local live run reproduces the 5 P0 failures (exit 1). Re-audit after #51–#55 fixes land. Push/PR awaits operator go-ahead.
