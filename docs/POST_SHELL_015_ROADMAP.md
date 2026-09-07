# Post-shell-0.15 roadmap — deepen the shipped apps (2026-09-06)

Written the evening app-shell 0.15 shipped (see
`shell-phase-chrome-handover-2026-09-06.md`). It sequences what is worth doing
next across four tiers, each entry with its blocker, its owner and the
measurement that closes it. It supersedes nothing: `DEPLOYMENT_READINESS_ROADMAP.md`
§C–§E are folded in here as Tier 2 rather than restated.

Owners: **(agent)** can be started in a worktree without a human; **(human)**
needs a decision, a credential, or an approval an agent cannot give itself.

## Where we stand

| | state |
|---|---|
| lq-core | app-shell 0.15.0, screen-onboarding 0.3.0, web-app 0.3.5 on packr; web-app source restored to git |
| lq-nordic | live on 0.15 (deploy f6fd39be); verified desktop/tablet/mobile |
| lq-english, lq-romance | merged on 0.15, no hosting project |
| 11 other group apps | on 0.13; another session's `feat/app-shell-0-14` rollout in flight |
| CI fleet | dispatch starvation seen all day (runs requeued ×4 before starting; one cancelled by the sweep) |

---

## Tier 1 — make today's UX change hold up for a real learner

### T1.1 Player progress persists end to end (agent) — **first**

**Problem.** `PlayerSession` (web-app 0.3.5) keeps the *player record* across
reloads, but the wrapper apps still hand every screen the default
`GameFlowProviders` app context: `player: null`, `updatePlayer`,
`saveStepProgress` and `setPlayer` are no-ops. A finished lesson therefore
writes nothing: the map never unlocks lesson 2, XP stays 0, the top bar stays
"Lv 1", and step progress inside a lesson is lost on refresh. The original
apps/web `AppProvider` did all of this; the shell transition dropped it.

**Fix.** A live bridge in `@learnquest/web-app` between `useGameStore` and
`AppContext`:

- `player`, `isAuthenticated`, `userTier`, `loading` read from the store;
- `setPlayer`/`updatePlayer` delegate to the store (the store already persists
  through `fluentDb.players`);
- `saveStepProgress`/`getStepProgress` backed by a small per-app localStorage
  map (`<prefix>_step_progress`);
- `GameFlowApp` receives this context reactively (a wrapper component, since
  `createApp` builds a static element).

Then make sure the map reads the same player: `useLessonMap` takes `player`
from `useApp`, so once the bridge is in, `completedLessons` drives node status
without further changes.

**Done when.** Complete the first Danish lesson on a fresh profile, reload:
lesson 2 is unlocked, XP > 0 in the top bar, the lesson's step index is
remembered. Covered by a web-app unit test for the bridge and a persona flow
step (`returning` with one completed lesson seeded) in the generated audit
flows.

### T1.2 Scored baseline of the persona audit flows (agent)

The 8 generated flows per app and the three lq-core flows exist but have never
run through the vision evaluator. Run `pnpm audit:full` (desktop, tablet,
mobile, both themes) for nordic, english and romance against local dev servers
with the published packages, evaluate with the MiniMax pipeline
(`screen-audit/minimax-evaluator.mjs`), and check the results into
`screen-audit/results/<date>/` with a one-page summary in this file's progress
log. This is the number every later chrome change is measured against.

Needs `MINIMAX_API_KEY` in the environment (human, if it is not already in
`~/.config/forge/secrets.env`).

### T1.3 Roll 0.15 to the other 11 group apps (agent, after the 0.14 PRs merge)

Blocked on the other session's `feat/app-shell-0-14` branches (open PR on
lq-germanic; unpushed elsewhere). Then per app: `rollout-015.py <worktree>
<group> <default-lang> <langs>` (dep bumps + vite `ENV_DEFAULTS` +
`__APP_VERSION__`), add the `'@learnquest/app-shell': ^0.15.0` workspace
override, `pnpm install`, `codegen-flows --apps <app>`, PR, gate, merge.
Verify one app end to end (first-run → map) before batch-merging the rest.

### T1.4 Audit leftovers (agent, small)

- Hide the lesson-map version badge and force-sync button outside `import.meta.env.DEV`
  (game-features).
- Replace the placeholder strings in web-app `src/i18n/locales/en.json`
  (every `"X Y Message"`-shaped value; ~30) with real copy.
- Stop the `apps/thai/data/asset-map.json` fetch that every page issues to the
  CDN and fails CORS: `AssetMapProvider` falls back to `VITE_APP_LOCALE`'s
  default when no map is configured. Either ship the per-app map under `/data/`
  or skip the fetch for group apps.

### T1.5 Lesson-type consolidation (agent, after 0.15.2 ships)

**Measured 2026-09-07.** Content across all 13 language repos uses exactly ten
`lesson.type` values (vocab 1565, concept 560, drill 404, multiple-choice 352,
conversation 336, culture 334, word-order 318, spelling 309, dialogue 302,
review 61). The 22-member `LessonType` union is the Thai-era design; the other
twelve have no content anywhere.

**State.** `@learnquest/lang-lesson-types` (lq-core `libs/lang/lesson-types`)
holds 16 screens but exports 5 — the rest still read `useParams` and import
from the deleted `apps/web` tree via `@/` aliases (tasks #184-#185). That is
why thin re-implementations of concept and multiple-choice exist in both
`app-shell/src/shell-adapters/` and `web-app/src/screens/`, why spelling and
word-order go through the school-style activity renderer, and why `review`
rendered the unknown-lesson stub in production (fixed in web-app 0.3.7 by
mapping it to the concept screen — same intro/sections/tips shape).

**Target.** Defaults in lq-core; app-specific types via each lq- app's
`createApp({ screens })` override (already supported). In content-weight
order: port the original concept, multiple-choice, word-order and spelling
screens to the prop contract (`{lesson, config, onBack, onComplete}`), delete
the two copies each, keep `ContentLessonScreen` only as the non-lang fallback,
archive the seven zero-content legacy screens instead of porting them, prune
the union last. **Done when** `DEFAULT_LESSON_SCREENS` has one source per type,
every entry completes a lesson, and `screens/*` in web-app is gone.

---

## Tier 2 — deployment readiness (§C–§E of the 2026-09-04 plan)

### T2.1 §C Release clean languages behind unfinished siblings (agent → human flag flip)

- lq-east-asian: `enabled: false` on chinese and cantonese → Japanese/Korean
  ship at 15/15, 0 dangling.
- lq-english: american at 15; british/australian/scottish held at their honest
  `shipChapters: 10`; welsh at 5.
- Fix the 3 failing lq-english unit tests (two are real bugs in
  `findPreservationBreaches`: a dropped preserved key yields 0 breaches).
- Decide the 214 missing `american` audio refs: generate (see T4.3) or drop.

### T2.2 §A4 `_shared` prefix fix (agent code; human packr token)

`@learnquest/assets` `path-resolution.ts` must read `<group>/_shared/` for
group apps and bucket root for non-group apps (cdn-url in app-shell already
does). Publishing `@learnquest/assets` hits the same 403 token blocker as
`unit-core`. Payoff: prune `_shared` from the bundle, 381 MB → ~22 MB, which
is the margin nordic shipped under a 500 MB cap with.

### T2.3 §D lq-romance to 15 chapters (content)

179 lessons. `shipChapters` was set from the contiguous run and withdrew ~60
real French lessons. Cheapest chapters first, `set-ship-chapters.ts`, redeploy.

### T2.4 §E nordic's disabled locales (agent)

~1,700 authored files behind a flag. Audit one disabled tree for translation
quality; promote what passes with a written reason for the rest.

### T2.5 Word-order content is not shippable (content pipeline; agent measures, human decides)

`lq-operations/scripts/validate-word-order.ts` (PR #3, 2026-09-07) over all
14 lang repos: 763 lessons, 4,550 exercises, **3,040 errors** (57% under
three words, 384 not scrambled, 42 unsolvable, one Cyrillic-lettered
`scрамbledWords` key) and 3,303 suspicious. Chapters 1–5's
`word-order-{simple,daily,directions,possessives,prepositions}` are
auto-assembled bags of chapter-1 pronouns and politeness words in nearly every
language; only the `-1`-suffixed lessons are hand-written. Four exercise
schemas coexist (localized chips, lq-english `scrambled: "a / b / c"`, Thai
`correctSequence`, Japanese ch-9 without chips). Options: regenerate through
lq-tools with the validator as the gate, or set the generated lessons
`status: hidden` until then. Either way the 318 word-order lessons should not
count toward `shipChapters`.

---

## Tier 3 — the 2026-09-04 handover items still waiting on a human

### T3.1 forge-git secret rotation (human)

Backups at `/root/forge-git-rotation-20260904-174057/`; runbook in
`docs/handover.md` §4. Open since 09-04.

### T3.2 blueforge-org PRs #18/#19/#20 merge order (human)

`--lang` never reached the audit prompt (#19) and the neutral art baseline
demanded fantasy (#20). Image audit scores are not trustworthy until both land;
decide against #18 first.

### T3.3 English character art with the gate in the loop (agent, after T3.2)

Welsh and Scottish reached 9.8 average with the prompt principle in
`docs/handover.md` §1; apply it to the locales that still share art.

---

## Tier 4 — platform gaps that cost time today

### T4.1 CI fleet dispatch starvation (agent, forge-control)

Symptoms today: runs `queued` with `run_attempt` climbing to 4 and
`started_at` epoch-zero for hours; a PR run cancelled by the sweep; the
platform-api smoke test collided on a fixed port (39080) when two jobs shared
a host. First checks: `forge git-runners autoscale status`, sweep interval vs.
dispatch latency, and giving the smoke test a free port.

### T4.2 Hosting projects for english and romance (human approves, agent runs)

Both are merged on 0.15; `forge app list` has no project for either. Same
recipe as nordic (R2 creds in project env, `ignore` at `languages/*/images`
grain, `forge app-deploy web --server`).

### T4.3 Lazy TTS with durable cache (agent)

Design in `TTS_CACHE_HANDLER.md`. `TTSService` posts to
`/api/tts/synthesize`, which nobody implements; 13 of 14 apps have no speech
audio. Self-contained service work; also the cheapest answer to T2.1's 214
missing audio refs.

---

## Order of work

1. T1.1 and T1.2 in parallel (one is the correctness of today's change, the
   other its measurement).
2. T2.1 and T4.1 in parallel (a flag flip with user value; a tax on every merge).
3. T1.3 as soon as the 0.14 rollout lands.
4. T1.4, T2.2, T4.3 as fillers between the above.
5. T2.3, T2.4, T3.3 when the content pipeline is the bottleneck, not the shell.

## Progress log

| date | what landed |
|---|---|
| 2026-09-06 | Plan opened. T1.1 and T1.2 started. |
| 2026-09-06 | **T1.1 built and verified locally** (lq-core PR #39, app PRs nordic #12 / english #8 / romance #10). Three more faults surfaced on the way: `GameFlowApp` put the shell on the memory router's `*` route, so every game-flow screen unmounted the shell and its router (now an overlay over a permanently mounted shell); the shell-rendered concept and multiple-choice screens had no completion action at all; and `useGameLoop().completeLesson` writes activity rows and achievements through the app database, which in a group app is the Postgres adapter — its rejection aborted completions half-way (the shell now runs the pure `ProgressionService` and treats the database as best effort). Apps need `react-router-dom` deduped and pre-bundled in vite. |
| 2026-09-06 | **T1.2 baseline (lq-nordic, local, web-app 0.3.6 overlaid).** 8 persona flows × desktop+mobile × light+dark captured (`screen-audit/results/2026-09-06`, JSON kept under `screen-audit/baselines/2026-09-06/` in lq-nordic PR #12). Expectations: 0 pass / 7 warning / 1 fail — every warning is the `apps/thai/data/asset-map.json` CORS console error (T1.4), the fail was a critical axe `aria-required-children` on the avatar carousel (`role=listbox` without option children; fixed in screen-onboarding 0.3.1, PR #39). MiniMax-M3 vision score **64.8 / 100** over 16 screens, 138 issues. Lowest: Settings 0.42 (bottom nav over the Account card in the stitched full-page capture), Welcome slide 2 0.55 (gender switch judged premature — product decision, kept), Profile 0.62 (guest state has copy but no button), chapter grid 0.62 (bottom nav over first card's description). Recurring: alpha banner text contrast; map node labels colliding with the path. |
| 2026-09-06 | **T1.2 english baseline: 59.5 / 100** (16 screens, 130 issues; lq-english PR #8 carries the JSON). 3 flows fail expectations: the carousel `aria-required-children` (fixed in screen-onboarding 0.3.1) and a serious axe `link-in-text-block` on every lesson page — the alpha banner's Terms/Privacy links sit inside running text without an underline (index.html in each app). **T1.4 root cause of the `apps/thai/...` CDN fetch found:** `EquipmentService`/`BossService` default `locale = 'thai'` and game-features calls `bossService.getByChapter(chapterId)` without a locale, so the RPG services load asset maps for a locale that does not exist here; the asset service itself is group-aware. Fix: default to `assets.locale` (app-services). |
| 2026-09-06 | lq-core #39 merged; app PRs nordic #12 / english #8 / romance #10 merged (gates green). **Publish blocked:** run 12334 failed at `Publishing: @learnquest/app-services@0.1.5` with `E401 invalid or expired token` — the repo's `PACKR_TOKEN` Actions secret expired between run 12168 (16:xx, succeeded) and 12334. Nothing from #39 is on packr yet: app-services 0.1.5, screen-profile 0.2.6, screen-onboarding 0.3.1, app-shell 0.15.1, web-app 0.3.6 and 16 dependents wait on a fresh token (human: mint an admin token per `reference_packr_publish_path`, set it as the lq-core Actions secret, rerun 12334). T4.1 note: the fleet was saturated (14 runners online, all busy), not stalled. |
| 2026-09-06 | **T2.1 measured** with `lq-core/scripts/set-ship-chapters.ts` (dry run): lq-english already carries the honest values on the local `content/american-foundation-lessons` branch (american all 15, australian/british/scottish 10, welsh 5) — those manifests are not on origin/main yet, another session's work; lq-east-asian: japanese/korean unset (= all), chinese/cantonese 5. Releasing Japanese/Korean cleanly still needs `enabled: false` on chinese + cantonese, a product call. |
| 2026-09-07 | PACKR_TOKEN rotated (human), publish rerun green: app-services 0.1.5, screen-profile 0.2.6, screen-onboarding 0.3.1, app-shell 0.15.1, web-app 0.3.6 on packr. Dependency-bump PRs nordic #13 / english #9 / romance #11 merged after green gates; progress loop re-verified on the published packages. Nordic redeployed (e4715122). |
| 2026-09-07 | **Nordic production re-baseline (T1.2 closes for nordic): MiniMax-M3 66.4 / 100** over 16 screens, 128 issues (was 64.8 local on 09-06; english local 59.5). Probe against production passed end to end: onboard → map node → Start → Complete → level-up → Continue → reload keeps XP and lesson 2 unlocked. Expectations: 5 pass / 3 warning / **0 fail** — the carousel axe critical is gone; the three warnings (front door, lesson map, site landing) are console noise only. Lowest screens now: Concept lesson 0.45 (one unbroken text block — content shape, not chrome), Settings 0.52 and Switch-language 0.55 (bottom nav pill overlaps the last card in stitched full-page captures — needs a bottom spacer equal to the nav height), chapter map 0.55 (`school` badge clipped at the left edge), Profile 0.55 (blank band below the nav). All four chrome items are in the proposed follow-up list (bottom-nav spacer, badge clipping, guest profile). Results JSON in lq-nordic `screen-audit/results/2026-09-07/`. |
| 2026-09-07 | **Audit follow-ups built and verified locally** (lq-core PR #40: app-shell 0.15.2, ui 0.1.5, game-features 0.2.10, lang-lesson-types 0.1.4, web-app 0.3.7). Root causes behind four of the five lowest production screens: the content inset added the release banner a second time (the banner is in flow, the app root already starts below it) — ~80px gap under the bar on every page and a banner-height scroll on short pages; the map node icon was a Material Symbols ligature that renders as the word "school" until the webfont arrives; the version badge and force-sync button shipped to learners. Lesson completion: the five ported lesson-type screens used `onBack` as their finish handler, so vocab/drill/culture/conversation/dialogue never completed; spelling and word-order rendered one exercise with no finish and crashed on localized word objects; `review` hit the unknown-lesson stub. All ten content types now render and complete (probe: vocab Finish → level-up → Continue → chapter map, mobile + desktop). Content bug seen on the way: danish `word-order-simple` exercise 1 has `correctSentence: "jeg tak du"` (hint "I thank you") — authoring fault, not code. Next: gate → merge → publish → nordic bump (preconnect for the icon font prepared in `chore/shell-0-15-2`) → deploy → re-audit. |
| 2026-09-07 | Parallel worktree batch while PR #40 sat in the queue: lq-core PR #41 (packr auth preflight before `turbo build`, 15 tests), lq-operations PR #2 + lq-nordic PR #16 (`returning-one-done` persona, `progress-persists` flow — passes 6/6 against production), lq-operations PR #3 (word-order validator → **T2.5**: the fleet's word-order content is mostly auto-assembled and fails structurally). |
| 2026-09-07 | Published app-shell 0.15.2 / web-app 0.3.7 / ui 0.1.5 / game-features 0.2.10 / lang-lesson-types 0.1.4 (run 12982). Merged: lq-core #40 + #41, lq-operations #2 + #3, lq-nordic #16 + #17, lq-english #12, lq-romance #14. Two traps on the way: ui 0.1.5 vs the 0.1.4 the published screen-* packages pin made pnpm instantiate app-shell once per ui peer (two shells, two stores) — every app now overrides `@learnquest/ui` next to `@learnquest/app-shell` in `pnpm-workspace.yaml`; and amending a pushed branch leaves the old commit's push run in the queue, starving the new one — cancel superseded runs via `POST actions/runs/<id>/cancel`. Nordic deploy 6b470b1b queued. |
| 2026-09-07 | **Nordic live on 0.15.2 / web-app 0.3.7** (deploy 49af621d). First attempt 6b470b1b failed on the host: "all predefined address pools have been fully subscribed" — the box had 32 Docker networks, exactly the default-pool cap, because the 0.14 rollout's blue/green stacks take two subnets per app. Fixed by the user (agents cannot restart dockerd): `/etc/docker/daemon.json` adds a `10.200.0.0/16` /24 pool and `live-restore: true`; all 49 containers back in ~2 min. Production probe after deploy, mobile + desktop: no dev chrome, SVG node icons, settings heading 42px under the bar, short pages no longer scroll, vocab Finish → level-up → Continue → chapter map, spelling / word-order / review render. Full audit + MiniMax rerun in flight. Side finding: books-platform api/image-worker health checks probe `/api/health` which 404s — permanently "unhealthy", pre-existing. |
| 2026-09-07 | **Production re-baseline after 0.15.2: MiniMax-M3 71.5 / 100** (17 screens, 130 issues; was 66.4 this morning, 64.8 local yesterday). 9 flows incl. the new `progress-persists`: 5 pass / 4 warning / 0 fail — warnings are the asset-map CORS console error only (T1.4, still open: ship the map under `/data/` or skip the fetch). Per-flow: language-chapters 0.82, pregame picker 0.82, site landing 0.82 (was 0.62), full journey 0.72, lesson map 0.72, progress-persists 0.72, onboarding 0.69, profile 0.65 (was 0.54), lesson screen 0.62 (was 0.45). Lowest now: Settings 0.52 (bottom-nav pill over the last card — a full-page-capture artefact of a fixed element; real viewports clear it with `pb-24`), Profile 0.62 (nav icon contrast on light art), Concept 0.62 (hero text clipped), Character creation 0.62 (banner contrast), welcome slide 0.62 (flag emoji rendered as text on the audit host — no colour emoji font). Next chrome candidates: nav-icon contrast, hero text clamp, banner contrast; the rest is content or capture. |
