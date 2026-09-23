# School & life apps — shell wiring, logos and review rollout (2026-09-22)

**Status:** **3 of 23 live** (2026-09-23) — lq-reading on reading.blueforge.studio (pilot, deploy 0849d117),
lq-math on **math.blueforge.studio** and lq-writing on **writing.blueforge.studio** (deployed + verified
2026-09-23; wiring lq-math#7/#8 + lq-writing#6, config lq-math#9 + lq-writing#7, proxied CNAMEs via
`forge dns set`). The other 20 apps: not started. Scaffold gaps folded into lq-operations#13 (merged).
**Why:** school/life apps were never wired onto the shared shell the language apps use, so shared
screens (onboarding, top bar, lesson chrome) rendered with most of their styles missing, the wrong copy
("Your Language Adventure"), a 🇹🇭 brand mark and crashes. Only lq-reading was ever deployed.
**Related:** [`READING_AIDS_PLAN_2026_09_22.md`](READING_AIDS_PLAN_2026_09_22.md) ·
[`UNDERSTAND_LESSONS_PLAN_2026_09_22.md`](UNDERSTAND_LESSONS_PLAN_2026_09_22.md) ·
[`PERSONALIZED_CONTENT_PLAN_2026_09_22.md`](PERSONALIZED_CONTENT_PLAN_2026_09_22.md)

## What the pilot needed (lq-reading) — the recipe for every other app

Shared fixes, already released (every app gets them by upgrading):

| Package | Version | Fix |
|---|---|---|
| lesson-ui | 0.6.0 / 0.6.1 | glass `LessonShell`, `ContentCard`, `LessonList`, `SectionGrid`, `LessonViewer` (no opaque grey page) |
| app-shell | 0.15.4 / 0.15.5 | gold-Q logo brand mark (128/256 webp), no language flag in school/life apps; peer ranges fixed |
| screen-onboarding | 0.3.3 / 0.3.4 | subject welcome copy, history-era step only in history, character step no longer crashes, slide art fallback |
| web-app | 0.5.1 / 0.5.2 | school/life apps keep the standard chapter → lesson list (the RPG map showed no lessons) |
| quest-types | 0.2.4+ | optional `QuestConfig.logo` |

Per-app steps (lq-operations `scaffold-shell-wiring.ts --app <slug>`, lq-operations#10):

1. `main.tsx` → `createApp()` (keeps the app's screens/adapters; removes hand-written i18n init).
2. `index.css` → `@learnquest/theme` + an `@source` line for every `@learnquest/*` package, direct and transitive.
3. `vite.config.ts` → one copy of i18next / react-i18next / react / react-router-dom; `pg` → browser stub.
4. `index.html` → favicon / logo links. Env → theme + mock-db vars.
5. `pnpm install`, then **re-run the scaffold** (it only scans what's installed).

Manual steps the scaffold does **not** do yet (all hit on lq-reading — fold into the scaffold before the fleet run):

- **pnpm overrides** in `pnpm-workspace.yaml` pin old versions (app-shell `^0.15.3`, screen-onboarding
  `^0.3.1`): bump them, and add `game-state`, `core-state`, `app-config`, `app-services` overrides —
  two game-state versions left the chapter map stuck on "Loading your adventure…".
- Direct deps `@learnquest/game-state`, `core-state`, `screen-onboarding` (like lq-nordic).
- `packageManager: "pnpm@11.9.0"` in package.json (CI's pnpm setup fails without it).
- Avatar manifests `public/data/avatars/player/{male,female}/{rpg,modern}/index.json` (copied from
  lq-assets `_shared/images/avatars/player/…`; fetched same-origin).
- CI: `.github/workflows/test.yml` + `test:unit` / `test:e2e` scripts, e2e against a production build with
  onboarding skipped via stored state (lq-reading#31 is the template).
- Logos: `lq-tools/packages/logo-tools/src/logos/generate-app-logos.ts --app=<repo>` (lq-tools#24).
- Production CDN mode: default `VITE_CLOUD_ASSETS` / `VITE_ASSETS_BASE_URL` in `vite.config.ts` for `vite build` —
  forge's packer strips `.env*` and its build ignores the config env (forge-control#1391); lq-reading#35.
- Deploy with `forge app-deploy web --server --wait --verify` (upload mode) while `--from-git` fails on
  forge-git SSH (forge-git#102); verify the live body, not the status code.

Two CI traps hit on the second/third apps (2026-09-22 evening) — check both before the first push:

- **`.gitea/workflows` shadows `.github/workflows` on forge-git.** The image apps ship
  `validate-images.yml` under `.gitea/workflows/`; if that directory exists, `test.yml` in
  `.github/workflows` **never fires** (lq-math had zero Test runs until the file was moved into
  `.github/workflows/` alongside the rest — same event, two dirs, only `.gitea` ran). One workflows
  directory per repo; keep everything in `.github/workflows/` like lq-reading / lq-writing.
- **pnpm 11 blocks dependency build scripts.** `packageManager: pnpm@11.9.0` fails `Main Install`
  with `ERR_PNPM_IGNORED_BUILDS` (esbuild, sharp) unless `pnpm-workspace.yaml` lists them under
  `allowBuilds:` (`esbuild: true`, `sharp: true`, `@google/genai`, `protobufjs` where present).
  Same fix as lq-math cf140af / lq-writing 3fe2ba2.
- **Cross-repo `actions/checkout` of lq-tools fails twice over.** The Actions job token cannot read
  sibling repos ("Repository not found"), and modern checkout also rejects `path: ../lq-tools`
  ("not under" the workspace). Use the published bin instead: `validate:images` →
  `image-validate public/images --strict` with `@learnquest/image-validation` (lq-math#8; supersedes
  the stale Track-3 PRs lq-math#2/#4, now closed).
- **Restricted `remote.origin.fetch` refspec → stale `origin/main`.** The deploy-branch-era config on
  these repos fetches *only* `deploy/hetzner-<subject>-quest`, so `git fetch origin main` silently
  does not update `origin/main`. A session that bases work on the stale ref will not see PRs already
  merged to main (lq-math#7 was merged while #8 duplicated it, showing up as phantom "conflicts").
  Step 1 of the checklist: run `git ls-remote origin refs/heads/main` (or fix the refspec to
  `+refs/heads/*:refs/remotes/origin/*`) before deciding what is left to do.

Deploy traps (hit on the math/writing go-lives, 2026-09-23):

- **`"secrets": []` is rejected** — forge 2.10.2 wants the object form (`{}` when empty), else the
  deploy dies at config validation before uploading (lq-writing#7).
- **`server: "hetzner-prod-1"` warns but works** — the local CLI doesn't know the alias and falls
  back to "automatic placement … will not land where DNS points"; the hosting side resolves it
  (reading-quest's stored config says the same). Harmless.
- **CD webhook needs two env vars, neither exported by default:** `GITEA_TOKEN` (from
  `~/.config/forge/secrets.env`, which assigns without `export` — use `set -a; source …; set +a`)
  *and* `GITEA_WEBHOOK_SECRET`, which lives only in `/etc/forge/hosting-api.env` on infra-1
  (not in the local secrets.env, not in `forge vault`). Without both, deploys succeed but
  main-push auto-deploy never gets registered.
- **No wildcard DNS.** Each app needs `forge dns set <name>.blueforge.studio --type CNAME --value
  hetzner.blueforge.studio --proxied` (copy reading's shape). The local router negative-caches the
  pre-creation NXDOMAIN up to the zone SOA minimum (**1800 s**) — public resolvers see the record
  immediately, so verify new names with `dig @1.1.1.1` or `curl --resolve …` rather than trusting
  the first local failure.

## Per-app list (for prioritising)

Deploy state from the 2026-09-22 survey: only lq-reading is live; the rest have no forge app entry and
their hostnames don't resolve. In 22 of 23 repos the forge-git default branch is `deploy/hetzner-<subject>-quest`,
not `main` — decide per app which is canonical before wiring.

### School (6)

| App | Chapters / lessons | Images (audit) | Blockers / notes | Suggested order |
|---|---|---|---|---|
| lq-reading | 6 / 96 | Pilot 128: 6.58 avg | **done** (this rollout's pilot) | — |
| lq-math | 5 / 92 | Pilot 100 ch2–5: 7.3; ch1 ≈ 5.3 (chalkboard trap) | **live: math.blueforge.studio** (wired lq-math#7/#8, config #9); old PRs #1/#3/#5 stale — close or retarget | 1 |
| lq-writing | 6 / 77 | Pilot 128: 6.92; Track 5 batch 2 partial 6.10 | **live: writing.blueforge.studio** (wired lq-writing#6, config #7; handwriting `r.map` fix included); default branch still `deploy/hetzner-writing-quest` | 2 |
| lq-science | 5 / 165 | baseline 12H/175M/462L; ch1 8.5; never through Pilot 128 | no school-quest domain PR | 3 |
| lq-geography | 5 / 93 | Pilot 128: 7.48, but Track 5 ch1–2 **regressed to 4.33** (satellite-render trap) | 129 dirty files on local checkout | 4 (after image fix) |
| lq-history | 23 tracks / ~1,012 | worst: 163H/400M/1703L, 655 need regen | ~45 campaign commits not on the default branch; the only app that uses the era step | 5 (largest) |

### Life (17)

All: 10 chapters (plumbing 5), lesson counts include `-intermediate` / `-advanced` variants (≈ a third
are distinct topics), images mostly at the Aug-5 strict baseline (avg ~1.2–2.0), never deployed.

| App | Lessons | Image state | Logo | Notes |
|---|---|---|---|---|
| lq-psychology | 200 | 200/200 ≤5 (relaxed re-audit) | π-style theme present (Ψ) | |
| lq-plumbing | 150 | 150/150 ≤5 | needs theme (proposed ≈ #2563EB) | 5 chapters |
| lq-philosophy | 209 | 194/207 ≤5 | Φ | |
| lq-health | 226 | 221/224 ≤5; ch1 5.0 | + | |
| lq-anatomy | 468 | 461/468 ≤5 | PWA icon is health's "+" copy; proposed ♥ #BE123C | largest life app |
| lq-cooking | 150 | baseline 2.0 / 133 low | PWA icon is economics' "€"; proposed ♨ #EA580C | cuisine lessons = personalization pilot |
| lq-economics | 221 | empties pilot done, 5 empties | € | |
| lq-finance | 235 | empties pilot done, 9 empties | $ | |
| lq-law | 185 | baseline 2.0 / 141 low | ⚖ (may render as emoji in SVG) | |
| lq-media | 204 | — / 139 low | M | |
| lq-tech | 199 | 1.4 / 179 low | ⚙ | |
| lq-electronics | 166 | — / 101 low | "€" copy; proposed Ω #0369A1 | |
| lq-engineering | 150 | 1.6 / 153 low | "€" copy; proposed Δ #57534E | |
| lq-game-design | 160 | 1.5 / 140 low | "€" copy; proposed ♞ #7C3AED | |
| lq-game-dev | 160 | 1.9 / 124 low | "€" copy; proposed `</>` #1E293B | |
| lq-maker | 160 | 1.5 / 139 low | "€" copy; proposed ⚒ #0D9488 | |
| lq-construction | 300 | 1.5 / 266 low | **no logo files, no asset-map, no sidecar**; proposed ⌂ #CA8A04 | hostname already serves ConstructionOS — needs a new domain; no CI |

## Per-app rollout checklist

1. Pick the canonical branch (main vs `deploy/hetzner-*`), merge or close stale PRs.
2. Scaffold + manual steps above; logos; CI; e2e green.
3. Content & image review: titles (lq-reading has "Ph 001"-style titles), empty lessons, practice-item
   guard (lq-reading's `practice-content.test.ts` — port it), image re-audit on the relaxed bar and regen
   of the worst chapters.
4. Domain + forge app entry, deploy `--from-git`, verify live (body, not status code).

## Open decisions

1. Order above (math → writing → science → geography → history, then life by image readiness)?
2. Domains: `<subject>.blueforge.studio` (what reading uses and resolves) vs `<subject>.school-quest.blueforge.studio`
   (in some PRs; doesn't resolve, needs edge TLS work).
3. Logo symbols for the 9 life apps without a theme (proposals above), and a stronger symbol than "A"
   for Reading; the audit also flags the Q tail crossing the symbol — a template tweak.
4. Subject-neutral player avatars (the shared pool is Viking-styled).
