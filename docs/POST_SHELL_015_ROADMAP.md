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
