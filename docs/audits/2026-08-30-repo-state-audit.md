# learn-quest — Repo State & Release Readiness (2026-08-30)

> Portfolio-sweep audit. **Read the scope note first — this repo is not what
> a naive file count suggests.**

**Verdict: CONTAINER REPO — N/A for release.** Healthy as what it is; the
release question belongs to its 46 children.

---

## Scope note

`learn-quest` is a **container repo**. Its own `.gitignore` opens with:

> *"learn-quest is a container repo — every child that is its own git repo is
> ignored. Each product sub-repo lives on its own remote; the container only
> tracks container-level docs/configs."*

**46 nested `.git` repositories** live inside it — `lq-core`, `lq-cards`,
`lq-site`, `lq-tools`, `lq-assets`, `lq-operations`, `lingua-quest`,
`books-platform`, `life-quest` (itself wrapping 17 children), 14 `lang-quest/lq-*`
language groups, and 6 `school-quest/lq-*` subject repos.

Naive tooling reports 10,175 source files, 2,256 unit tests, 914 stories,
167 E2E files and 13 audit packages for "learn-quest". **None of that belongs
to this repo.** Those totals aggregate 46 independent products, each with its
own remote, CI and release cadence. Any portfolio dashboard that counts this
directory as one app is double-counting the entire LearnQuest ecosystem.

## Snapshot (the container itself)

| Signal | Value |
|---|---|
| Last commit | 2026-08-29 (30 hours) — `4138888` |
| Branch / dirty | `main`, clean |
| Commits | 7 — the repo was initialised 2026-08 as a container |
| **Own tracked files** | **2,421** |
| Remote | `origin` → forge-git ✅ (forge-git only, no GitHub mirror) |

What those 2,421 files actually are:

| Path | Files | Nature |
|---|---|---|
| `school-quest/` | 1,898 | lesson content outside the 6 ignored subject repos |
| `lang-quest/` | 469 | lesson content outside the 14 ignored language repos |
| `docs/` | 46 | container-level documentation |
| root | 8 | `blueforge.config.{ts,json}`, README, CLAUDE.md, Handover.md, MIGRATION_PLAN.md |

So the container carries **curriculum content plus deployment config** — not
application code.

## CI

**None** — no `.github/workflows`, no `.gitea/workflows`. For a container
repo holding content and config this is defensible, but two things would
earn their keep:

- **Validate `blueforge.config.json`** the way property-platform does
  (`scripts/forge-validate.mjs` in CI). Two of the last five commits were
  config fixes (`fix(config): declare role on every app`,
  `chore(config): drop inert top-level server/dns.target`) — exactly the
  class of error a validator catches.
- **Content-integrity checks** over the 2,367 lesson files.

## Docs

46 files under `docs/` — `analysis/`, `archive/`, `audit/`, `books-platform/`,
`superpowers/{specs,plans}`. Newest: `image-quality-fleet-handover-2026-08-09.md`,
`INFRASTRUCTURE_STRATEGY.md`. README 333 lines; CLAUDE.md only 43 lines,
thin for something coordinating 46 repos.

## Readiness

**Not applicable.** A container repo doesn't ship. It is doing its job: the
`.gitignore` boundary is explicit and documented, and recent commits are
sensible container-level hygiene.

Ordered actions:
1. **Add config validation to CI** — 2 of the last 5 commits were config fixes.
2. Expand `CLAUDE.md` (43 lines) to describe the 46-repo topology, so agents
   and humans don't mistake this for an app.
3. Consider a GitHub mirror; this is currently forge-git-only.
4. **Audit the sub-repos separately.** The LearnQuest products
   (`lq-core`, `lq-cards`, `lq-site`, `lingua-quest`, `books-platform`,
   `life-quest`, and the 20 content repos) each need their own readiness
   assessment — they are the things that actually ship.
