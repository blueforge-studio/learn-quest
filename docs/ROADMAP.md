# LearnQuest — Consolidated Roadmap

> **⚠️ Superseded by [`docs/ROADMAP_2026_09_20.md`](./ROADMAP_2026_09_20.md)
> (compiled 2026-09-20).** This file remains for historical reference per
> the operator's "supersede dated rather than edit-accumulate" rule; the
> dated file is the canonical forward-looking list.
>
> Earlier dated versions: [`docs/ROADMAP_2026_09_19.md`](./ROADMAP_2026_09_19.md).

---

> **Compiled 2026-09-09.** Aggregates open work from `MEMORY.md`, the in-repo
> roadmaps (`CONTENT_WIRING_ROADMAP.md`, `FLEET_READINESS_ROADMAP.md`,
> `DEPLOYMENT_READINESS_ROADMAP.md`, `MIGRATION_PLAN.md`,
> `image-quality-fleet-handover-2026-08-09.md`, `TECH_DEBT_AUDIT.md`), open
> PRs on `forge-control`, and outstanding app-shell audits. The roadmaps
> linked above remain the source of truth on the per-section mechanics —
> this file is the priority order across all of them.

## How to read this

Each item lists: **what** is owed, **why it matters**, **what blocks it**, and
**the smallest honest first step**. P1 = active user-visible gap; P2 = on
the critical path to the next ship; P3 = deferred but won't get cheaper.

---

## P1 · Fleet correctness — what learners hit today

### P1.1 · Authoring backlog — 3,971 lessons ship with no content (TOOLING LANDED 2026-09-10; lq-romance ch11-15 drafts scaffolded)

**Source:** `CONTENT_WIRING_ROADMAP.md` §3 + §5; `FLEET_READINESS_ROADMAP.md`.
**Status:** Generator now prunes absent files (5,364 empty emissions → 0),
but 3,971 distinct lessons are still on the backlog. **Tooling landed
2026-09-10** in `lang-quest/lq-romance/scripts/draft-missing-lessons.ts`:
walks `chapters.json` per language/locale, finds every declared lesson with
no file, derives the lesson kind from the id prefix (`concept-…` → `concept`,
`word-order-…` → `word-order`, etc.), scaffolds a schema-valid draft
(template body + TODO markers), validates against `LessonFileSchema`, and
writes the file. Supports `--lang`, `--all-langs`, `--chapter`, `--locale`,
`--dry-run`. **102 drafts scaffolded for lq-romance ch11-15 across all 5
languages** (3 chapter-6 french + 6 partial-batch + 91 main batch). Per-app
backlog:

| app | source locales | authoring gaps |
|---|---|---|
| lq-balkan | 4 | 661 |
| lq-southeast-asian | 9 | 376 |
| lq-east-asian (chinese, cantonese) | 1 | 138 |
| lq-english (british/australian/scottish/welsh) | 4 | ~130 |
| lq-romance | 5 | 77 (was 179) — drafts scaffolded; human content TBD |
| lq-uralic | 1 | 196 |
| ... others | — | smaller |

**Why this matters:** A learner can currently open a lesson, see the title, and
get a blank screen. `status: 'available'` is shown; only an HTTP audit tells
you the file is empty. Drafts are schema-valid but content is TODO — they
will not ship until authors fill in the `lastChangeType: "draft"` files and
`shipChapters` is bumped from 5 to 15 (the generator cap that masks ch6-15).
**First step:** Fill the drafts (grep `lastChangeType: "draft"` in
`lang-quest/lq-romance/languages/`) — every draft has TODO markers in
intro/sections/examples/tips that name the lesson id and chapter theme.
Then raise `shipChapters` to 15 in the locale manifest and re-deploy. Mirror
the script in `lq-east-asian/`, `lq-balkan/`, `lq-uralic/` for the next
cheapest groups.
**Blocker:** None on the tooling side. Pure authoring throughput.

### P1.2 · lq-english unit tests failing (3 of 3) — FIXED 2026-09-10

**Source:** `DEPLOYMENT_READINESS_ROADMAP.md` §C; memory
`project_lq_cards_open_stack_2026_08_31.md` (also calls this out).
**Status:** RESOLVED. The "two real bugs in `findPreservationBreaches`"
diagnosis was wrong — the function is correct. The 2 failing tests were
mutating the wrong path: `items[0].text` instead of `items[0].targetLocale.text`
(the actual lesson shape nests the target word under `targetLocale`). The
function correctly reports "key count changed" when a new key is added at
the wrong path, and reports "preserved field changed" only when a preserved
key is genuinely altered. Fix: correct the test paths in
`tests/unit/locale-fields.spec.ts:115,123`. **22/22 locale-fields tests pass.**
The 3rd failing test was the content-integrity one (214 missing audio refs
across american/australian/british/scottish) — that belongs to P1.3.

### P1.3 · lq-english welsh + audio gaps — DECISION LANDED 2026-09-10

**Source:** `DEPLOYMENT_READINESS_ROADMAP.md` §C; `lq-english/tests` failures.
**Status:** Decision memo below — the audio gap (107 unique missing files)
was mis-reported as "214 missing american audio refs" in the prior roadmap;
it is actually spread across 4 locales. Welsh (85 missing lessons) and
british/australian/scottish (37 missing each) are lesson gaps, not audio.

#### Lesson-gap audit (2026-09-10)

| locale | declared | present | missing | shipped via shipChapters |
|---|---|---|---|---|
| american | 177 | 177 | **0** | all 15 (no cap) |
| british | 171 | 134 | 37 (ch11-15) | ch1-10 (cap=10) |
| australian | 171 | 134 | 37 (ch11-15) | ch1-10 (cap=10) |
| scottish | 171 | 134 | 37 (ch11-15) | ch1-10 (cap=10) |
| welsh | 171 | 86 | **85** (ch6-15) | ch1-5 (cap=5) |

**Lesson-gap decision: ship as-is.** The shipChapters caps on british/au/sc
(10) and welsh (5) already hide every lesson gap. **No authoring work
required to keep these live.** The caps lift automatically as ch11-15
(welsh: ch6-15) are authored.

#### Audio-gap audit (107 unique missing refs in shipped chapters)

| locale | spelling (ch6/7/8/10) | conversation (ch1-5 practice) | total |
|---|---|---|---|
| american | 32 (8 each × 4 lessons) | 0 | **32** |
| australian | 0 | 25 (5 each × 5 lessons) | **25** |
| british | 0 | 25 | **25** |
| scottish | 0 | 25 | **25** |

**The american 32 are *not* missing audio files** — the audio directories
have placeholder files (`0-word-1.mp3`, `1-word-2.mp3`, ...), but the
lessons reference word-named files (`0-head.mp3`, `1-shoulder.mp3`, ...).
The authoring work was done; the per-word audio generation was not.
**The au/br/sc 25 each are missing audio files entirely** — the audio
directories exist but contain zero files.

**Audio-gap decision: GENERATE, do not drop.**
- **Why generate:** `scripts/voices.json` has Azure neural voices
  pre-configured per locale (`en-US-JennyNeural` for american,
  `en-AU-NatashaNeural` for australian, `en-GB-SoniaNeural` for british
  + scottish). The TTS path is known (memory
  `project_gendered_dialogue_audio_2026_09_08.md` shipped gendered
  audio via the same Azure stack 2026-09-08). 107 files × ~$0.005/file
  = ~$0.54 total; ~$0.18 per affected locale. Cheaper than authoring
  audio refs back out + re-running the generator + re-running the gate.
- **Why not drop:** the lessons still build and the practice items just
  play silence — the user-visible regression is "the practice phrases
  have no audio." For a *language-learning* app that is a content hole,
  not a polish gap.
- **First step:** Write `scripts/generate-missing-audio.ts` — read the
  failing-asset-ref list from the content-integrity test, look up each
  ref's lesson to find the word/phrase, run Azure TTS per locale using
  `voices.json`, write `mp3` to the expected path, and re-run the test
  to verify. Loop is small enough to be one PR.

**Net status:** Welsh + british/au/sc ship-clean today. American is the
production-ready locale; the 32 spelling gaps and 75 conversation gaps
across the other 3 locales are the next concrete task. The audio decision
above unblocks it.

### P1.4 · Roll app-shell 0.15 to 5 remaining group apps — ✅ DONE 2026-09-10

**Source:** memory `project_appshell_014_migration.md` (was DONE for 9 of 14),
`project_shell_phase_chrome_2026_09_06.md`; per-app `pnpm-workspace.yaml`
audit on 2026-09-09.

**Apps still on app-shell 0.13.0 (no migration) before today:**
- lq-african (on `content/generate-chapters-index`)
- lq-celtic (on `fix/honour-locale-enabled`)
- lq-english (on `content/american-foundation-lessons`)
- lq-romance (on `content/generate-chapters-index`)
- lq-west-slavic (on `content/generate-chapters-index`)

**Status:** RESOLVED. Each app was migrated against the lq-balkan/lq-germanic
template. Diff per app:
- `package.json` — 10 `@learnquest/*` bumps: app-shell 0.13→0.15.3, assets
  0.1.1→0.1.3, ui 0.1.4→0.1.5, web-app 0.3.4→0.3.10, e2e-core 0.4.7→0.5.3,
  app-services 0.1.4→0.1.6, app-config 0.1.3→0.1.4, game-features
  0.2.9→0.2.10, screen-onboarding 0.2.3→0.3.1, screen-profile 0.2.5→0.2.6,
  react-router-dom 7.18.1→7.18.3; devDeps unit-core 0.1.2→0.1.4.
- `pnpm-workspace.yaml` — added 7-line `overrides:` block (app-shell, assets,
  ui, react-router-dom, i18next, react-i18next).
- `vite.config.ts` — added `ENV_DEFAULTS` block + `define:` block, added
  `'react-router-dom'` to `optimizeDeps.include` (fixes a real `useLocation()
  may be used only in the context of a <Router>` pageerror caused by vite
  bundling a second router into the web-app chunk).
- `src/AlphaGate.tsx` (NEW) + `src/main.tsx` (AlphaGate wired as
  `providers:` to `createApp({...})`).
- `tests/global-setup.ts` (NEW) + `tests/alpha-gate-state.json` (NEW) +
  `tests/unit/alpha-gate-state.spec.ts` (NEW) — pin the E2E storage state to
  `ACCEPTANCE_VERSION = '2026-08-27'`.
- `tests/e2e.config.ts` — added `termsAcceptedVersion: '2026-08-27'`.
- `playwright.config.ts` — added `globalSetup:` + `storageState:`.

**Per-app verification (`pnpm install` + `pnpm test:unit` + `pnpm build`):**

| app | unit | build |
|---|---|---|
| lq-african | 28/28 ✅ | ✅ |
| lq-celtic | 22/22 ✅ | ✅ |
| lq-english | 50/51 (1 pre-existing audio-gap fail, see P1.3) | ✅ |
| lq-romance | 25/25 ✅ | ✅ |
| lq-west-slavic | 19/19 ✅ | ✅ |

**Live-render verification:** `node` + `playwright` snapshots of all 5 apps
on a local dev server show the welcome screen renders, no `pageerror`, all
contentLanguages visible.

**Out-of-scope follow-up — smoke harness bug (NOT a migration defect):**
The `pnpm test:smoke` run fails on **all 13 group apps** with the same
symptom: the `LandingPage` constructor's `void page.addInitScript(...)`
calls (for `lq-terms-accepted` + `onboarding-completed`) are not honoured
before `landing.goto()`. The init script returns a Promise that nobody
awaits; `goto()` fires while the queue is still in flight; localStorage
ends up `null/null`; AlphaGate renders; the smoke assertions fail.
**Pre-existing** — reproduces identically on `lq-balkan` (which the
memory claims shipped on 0.15.3 in 2026-09). The migration does NOT
introduce this. Fix needs to land in `@learnquest/e2e-core` itself
(await the `addInitScript` Promises before `goto`); flagged for the
next e2e-core PR.

**Branches:** 5 commits created (one per app), each on the same per-app
branch as the in-flight content work. Ready to push + PR once the user
gives the go-ahead.

### P1.5 · Image quality — fleet re-audit under the relaxed bar

**Source:** `image-quality-fleet-handover-2026-08-09.md`; memory
`project_image_art_direction.md`.
**Status:** The relaxed art bar landed 2026-08-09 (lq-tools `eaaa647`) and
**only lq-history has been re-audited under it** (163H/400M/1703L; 655
needs-regen, art-mismatch 1255 → 20). The other 5 school apps, 17 life apps,
13 lang apps are essentially untouched past their Aug-5 strict baselines.

**Why:** Without the relaxed-bar re-audit we don't know which low scores are
real failures vs the strict bar's noise. The 7/7 region art-style fix
(lq-history) is proven; fleet-wide application is the high-leverage move.

**First step:** Empties sweep across all 23 school+life apps (deterministic,
~$0.02/img). Then re-audit under the relaxed bar to find the real ≤5 set;
defer the borderline-5 chase.

---

## P2 · Critical path to ship lq-nordic + next clean apps

### P2.1 · Asset resolver `_shared` path mismatch — ✅ RESOLVED 2026-09-10

**Source:** `DEPLOYMENT_READINESS_ROADMAP.md` §A4 (2026-09-04). Re-verified
today against live CDN + resolver source.

**Findings (2026-09-10):**
- The **resolver** (`@learnquest/assets@0.1.2` in lq-core `path-resolution.ts`)
  already scopes `_shared/` to `${APP_GROUP}/_shared/` when `IS_GROUP_APP &&
  APP_GROUP` (lines 34-36, with the same guarantee from `path-resolution.shared.test.ts`
  cases on lines 122-141). This landed before the §A4 report — the report's
  premise that "the resolver reads from bucket root" was stale.
- **CDN side confirmed live:** `https://lq-assets.blueforge.studio/nordic/_shared/images/chapters/chapter-13.webp` → 200; same path at the bucket root → 404. Files are published to the correct `<group>/_shared/` prefix and resolve correctly.
- **Bundle side:** `applyIgnore` (`deploy-strategies/src/ignore.ts`) runs
  `fast-glob` against `cwd: buildDir`, and the patterns `_regional`, `_shared`,
  `languages/*/images` in each app's `blueforge.config.json` already prune those
  trees from the deploy artifact — this is the §A1 reduction (1.5 GB → 358 MB).
- The §A4 observation that the **app's nginx origin still serves `/_shared/`**
  with 200 (verified today) is real but harmless: those are 326 MB of local
  container files that never get uploaded. It's a missed pruning opportunity,
  not a deploy-blocker.

**Net:** lq-nordic's 554 MB artifact failure was a one-time build-state issue,
not a chronic resolver bug. There is **no code change required** for P2.1.

**Outstanding (small):**
- The ignore patterns could be tightened to also drop `images/` at the dist
  root (still 4 MB) and `_shared/legal/` (24K). Not material.
- `_shared/` is still served from the app origin in addition to the CDN. To
  remove it cleanly: add `_shared` to a `vite.config.ts` `publicDir` exclusion
  for the SPA template. Not a blocker.

**Status update:** delete P2.1 from the active list. The "critical path to
lq-nordic" is now §B's domain reconcile (`nordic.lang-quest.blueforge.studio`
vs `nordic.quest.blueforge.studio`).

### P2.2 · Publish `@learnquest/unit-core@0.1.5` + `@learnquest/assets` next

**Source:** `CONTENT_WIRING_ROADMAP.md` §4 + `DEPLOYMENT_READINESS_ROADMAP.md`
§A4. Same root cause: PACKR_TOKEN has read scope only, not publish, so the
publish step 403s. Both packages block real downstream work.
**First step:** Mint a publish-scoped token (`role: admin` per memory
`reference_packr_publish_path.md`), publish both versions, bump the 14 apps.

### P2.3 · Ship lq-nordic end-to-end

**Source:** `DEPLOYMENT_READINESS_ROADMAP.md` §B.
**Status:** The only app clean on both maturity axes (4 languages × 15/15, 2825
unit tests passing, images confirmed on R2 at `apps/nordic/...`, prebuild wired,
no broken postBuild). Blocked on P2.1 (bundle size) and the domain reconcile
(mission-control has `nordic.quest.blueforge.studio`, config has
`nordic.lang-quest.blueforge.studio` — neither resolves).
**First step:** Once P2.1 lands, reconcile the domain, run the verified
deploy recipe (`project_lq_nordic_shipped_2026_09_05.md`), verify live.

### P2.4 · Release clean languages behind unfinished siblings

**Source:** `DEPLOYMENT_READINESS_ROADMAP.md` §C.

**Status (2026-09-12):** **NOT a flag flip.** The language-level
`enabled` flag and the `shipChapters` gate do not exist on any
lq-east-asian manifest — `generate-lesson-files.ts:202` reads
`manifest.shipChapters` but every call gets `undefined`, the cap
fails open, and all 15 chapters ship. Chinese is currently visible
in the picker despite only 5 chapters being authored. Cantonese has
15 chapters authored but 84 dangling lessons.

The roadmap previously stated this was "zero content work, just flags" —
it inherited the ambiguity from the 2026-09-04 Handover, which described
`shipChapters` as if it were set conservatively when in fact it is not
set at all on these manifests.

**What the work actually is (~½ day focused + deploy):**

1. **Schema:** add `enabled` (and/or `shipChapters`) to the locale-manifest
   schema and document it.
2. **Generator:** thread the filter through `generate-lesson-files.ts`
   so `enabled === false` languages are excluded from `localeIndex`.
3. **Picker:** lq-core's language-picker reads the generated index;
   verify the filtered index is what it expects, then ship
   `@learnquest/web-app` (or `web-core`).
4. **Per-app apply:**
   - lq-east-asian: `enabled: false` on `chinese` and `cantonese`
     → release japanese/korean at 15/15.
   - lq-english: hold british/australian/scottish at `shipChapters: 10`,
     welsh at 5, ship american at 15. *(Verify these fields exist on
     lq-english manifests before acting — same cap-failing-open risk.)*
5. **Backstop:** per the P5 entry, add a repo-level guard so a future
   `enabled: false` cannot be silently ignored.

**Gating:** steps 1–3 require publishing `@learnquest/web-app` /
`@learnquest/web-core` / schema updates — all gated on P2.2 (PACKR_TOKEN
publish scope, see `reference_packr_publish_path.md`). Steps 4–5 are
local config changes.

**Memory:** `project_p24_scope_2026_09_12.md` — full investigation +
day estimate.

### P2.5 · Close lq-romance to 15 chapters

**Source:** `DEPLOYMENT_READINESS_ROADMAP.md` §D. **Status:** Live app serving
stale content — production advertises and serves 15 chapters while source
ships 5. Author 179 lessons (cheapest chapters first: 34/34/25/26/60
across french/italian/portuguese/spanish/romanian), re-run
`set-ship-chapters.ts`, redeploy.
**First step:** Romanian ch11-15 (8 lessons each, single-language authoring),
then french/italian ch6-15 (2-5 each, 5 languages × 2-5 = 60 lessons left
after the per-chapter table).

### P2.6 · Nordic disabled locales — ~1,700 authored files behind a flag

**Source:** `DEPLOYMENT_READINESS_ROADMAP.md` §E. Danish 7-locale tree has
4 disabled (`de`/`es`/`fr`/`vi`) at full parity with enabled ones
(210/173/172 files). Norwegian/Swedish carry 4 with only `en` enabled.
**First step:** Audit one disabled tree for translation quality (sampling,
not full read), then promote-or-hold per language with a written reason.

---

## P3 · Blueforge-stack migration (MIGRATION_PLAN.md)

### P3.1 · Phase 2 pilot — lq-math on blueforge-stack

**Source:** `MIGRATION_PLAN.md`. **Status:** Planning only; no migration
code started. Live SaaS surface: 6 school-quest subjects + 10+ life-quest apps
+ lq-site + lingua-quest (live on Vercel + Hetzner).
**First step:** Categorize the 170 sub-packages into buckets A (worth
migrating) / B (defer) / C (archive) before any code change. The pilot
lq-math is the proof-of-concept — until it ships, we don't know whether
`service-database` + `service-auth` cover every Supabase feature.

### P3.2 · Phase 3 fan-out — other 5 school-quest subjects, then life-quest

Same recipe as the pilot. Defer lingua-quest (Turborepo) until school-quest
is complete; books-platform needs `clinic-os`/`proposal-os` coordination.

---

## P4 · Forge-control open PRs (relevant subset)

Full list at https://forge-git.blueforge.studio/blueforge-studio/forge-control/pulls.
Picked for direct learn-quest impact; **NOT in priority order — read the PR
descriptions and check current state before acting**.

### P4.1 · Deploy infrastructure fixes

- **#1004** — `fix(hosting-api): stop the allocator handing out ports that are already bound` — directly relevant if any lq-* deploy hit "port in use" recently.
- **#1010** — `fix(build-worker): deploy lane defects — portless deployables + reconcile failing live queued jobs` — related to the `dd0f0fe8e` port regression memory; all deploys after 14:41 UTC 2026-09-07 are suspect per `project_worker_port_regression_2026_09_07.md`.
- **#1011** — `fix(fleet): runner→host resolution could never reach its VM-name fallback` — fleet-wide; could explain CI queue gaps.
- **#1019** — `feat(build-worker): per-host build lane — BUILD_CONCURRENCY + in-process host mutex` — related to build lane scaling.
- **#1096** — `fix(caddy): require upstream bound before passing verify` — direct tie-in to the caddy `localhost` IPv6 trap (`feedback_box1_caddy_operational_traps.md`).
- **#1094** — `fix(caddy): restrict routes glob to *.conf` — possible cause of the app-3 `/etc/caddy/routes/*.conf` pattern memory.

### P4.2 · Migration / hosting architecture

- **#1008** — `feat(checker): §7 drift — the commit a deploy staged vs the one actually running` — ties in with the build-worker stale dist memory (`project_build_worker_stale_unpack.md`).
- **#1064** — `feat(build-worker): alert when the builds queue has work and no consumer` — ties in with the CI fleet stall saga memory.
- **#982** — `fix(deploy): a failed deploy must not leave an un-rewritten compose on the box` — direct hit on the books-platform stray deploy (`project_books_platform_stray_deploy_2026_09_07.md`).
- **#974** — `fix(ci-telemetry): put the Gitea reader grants in the repo, not in someone's memory` — small but recurring frustration; pull the secret out of operator memory.

### P4.3 · Secrets + security (do not bundle-merge without review)

- **#1086** — `sec(deploy): stop writing vault secrets into the generated compose` — touches every generated compose; verify no learn-quest app reads secrets from compose env vs `env_file:`.
- **#1075** — `fix(security): floor next at 16.3.3, in the overrides block pnpm actually reads` — security PR; read carefully before merging.
- **#983** — `docs(secrets): rotation tooling — the gap, measured, and the shape of the fix` — design doc; light read.

---

## P5 · Recurring fleet pathologies (each is one ticket to file-and-forget)

Pulled from `MEMORY.md` + `FLEET_READINESS_ROADMAP.md` "Smaller items" section.
Each has a one-line root cause; ticket + link to the memory, file a follow-up
PR per item only when a concrete project needs it.

- **Alpine musl wget on `localhost`** — `feedback_box1_caddy_operational_traps.md`; php/python templates still do this.
- **LFS false-dirty mp3s in group-app repos** — `project_appshell_014_migration.md`; recipe documented, but no repo-level guard.
- **Asset-map regen scripts OOM on full-monorepo** — `reference_asset_map_scripts.md`; targeted tests only.
- **`pnpm deploy` reifies for build host** — `reference_direct_container_deploy.md` + `reference_lq_cards_api_redeploy.md`; sharp needs `--os=linux --libc=musl --cpu=x64 --force` for any alpine deploy.
- **Gitea combined-status hangs on CANCELLED runs** — `project_appshell_014_migration.md`; merge gating must read PR-level run, not commit-level.
- **Generator `enabled: false` was silently ignored** (fixed 2026-09-02) — guard against drift is now in place; `FLEET_READINESS_ROADMAP.md` recommends a repo-level check.
- **App-3 docker network pool cap** — `project_app3_docker_address_pools_2026_09_07.md`; 116.203.97.105 hit 32-network cap, daemon.json now has 10.200.0.0/16 + live-restore; live-restore only activates when dockerd restarts.
- **CI PACKR_TOKEN expires** — `project_wrapper_app_progress_loop.md`; rotated by user 2026-09-07, will recur.
- **Worker IIFE / pool-not-ready race** — `reference_lq_cards_api_redeploy.md`; pattern is the lq-cards fix from this session. Audit other forge services for the same shape.

---

## Cross-references

- `MEMORY.md` — fleet operational memory (92 entries, compacted 2026-09-09).
- `docs/CONTENT_WIRING_ROADMAP.md` — reachability + authoring backlog.
- `docs/FLEET_READINESS_ROADMAP.md` — generator fix + smaller items.
- `docs/DEPLOYMENT_READINESS_ROADMAP.md` — deploy pipeline, lq-nordic ship path.
- `docs/MIGRATION_PLAN.md` — Supabase/Firebase/Vercel → blueforge-stack.
- `docs/image-quality-fleet-handover-2026-08-09.md` — relaxed art bar, region descriptors.
- `docs/TECH_DEBT_AUDIT.md` — ~6,850 duplicated script lines (April audit; not re-checked since).
- `docs/LangQuest-Future-Roadmap.md` — difficulty-tiered content (long horizon).
