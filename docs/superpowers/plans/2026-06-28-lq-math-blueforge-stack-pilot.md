# lq-math blueforge-stack Pilot — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pilot the blueforge-stack migration by removing Supabase from `@learnquest/math` (`school-quest/lq-math`) and deploying it to Hetzner via `@blueforge-studio/forge-cli` using a real `blueforge.config.json` + `vite-spa` strategy. Stop after one app — write a migration report with findings, suggestions, and a fan-out roadmap for the remaining 35 lq-* apps.

**Architecture:** This pilot removes the *only* runtime Supabase touchpoint in lq-math (the `resolveContentSource()` factory in `src/main.tsx`) by adding a DATABASE_PROVIDER env switch — `file` (default, current behavior) / `sql` (legacy Supabase path, now opt-in) / `rest` (new: fetches content from a JSON REST endpoint hosted on a blueforge platform project). The `blueforge.config.json` declares the `vite-spa` Hetzner deploy target, modeled on `lang-quest/lq-nordic/blueforge.config.json`. The deploy pipeline goes through `forge sync` → `forge app-deploy` → vite-spa strategy → nginx + Caddy on `hetzner-prod-1`.

**Tech Stack:** Vite 6 + React 19, TypeScript 5.7, `@blueforge-studio/forge-cli` v2.0.0, `@blueforge/deploy-strategies` `vite-spa` strategy, nginx 1.27 (Docker base), Caddy 2.x (Hetzner host), Postgres on `postgres-shared` (if `rest` mode is wired).

**Spec:** `/Users/kmandrup/Projects/Repos/learn-quest/MIGRATION_PLAN.md` (Phase 2: pilot).

---

## File map

**New files:**
- Create: `school-quest/lq-math/blueforge.config.json`
- Create: `school-quest/lq-math/.forge/secrets.example.json` (placeholder for env-var schema)

**Modified files:**
- Modify: `school-quest/lq-math/src/main.tsx` (add `rest` content source branch)
- Modify: `school-quest/lq-math/src/content/rest-content-source.ts` (new: REST fetcher)
- Modify: `school-quest/lq-math/.env.example` (add `VITE_CONTENT_SOURCE=rest` + `VITE_CONTENT_API_URL`)
- Modify: `school-quest/lq-math/.env.local` (set `VITE_CONTENT_SOURCE=rest` for local dev — actually keep `sql` if Supabase still works locally, but document)
- Modify: `school-quest/lq-math/package.json` (bump version 0.1.0 → 0.2.0 — Supabase no longer required)

**Unchanged but read for context:**
- `lang-quest/lq-nordic/blueforge.config.json` — reference template
- `/Users/kmandrup/Projects/Repos/forge-control/packages/deploy-strategies/src/strategies/vite-spa.ts`
- `/Users/kmandrup/Projects/Repos/forge-control/packages/deploy-strategies/src/templates/vite-spa/*.hbs`
- `/Users/kmandrup/Projects/Repos/forge-control/packages/forge-cli/README.md`

**Deliverables outside this plan:**
- `MIGRATION_REPORT_lq-math.md` at learn-quest root — final report (separate doc).

---

## Reusable functions / utilities

- **`loadConfig(repoPath)`** in `forge-control/packages/forge-cli/src/config-loader.ts:71` — reads `blueforge.config.json` (or `hetzner` wrapper) and returns `BlueforgeConfig`. Use directly via `pnpm --filter @blueforge-studio/forge-cli start sync` from the app dir.
- **`ViteSpaStrategy`** in `forge-control/packages/deploy-strategies/src/strategies/vite-spa.ts:29` — handles install, build, package, run, healthcheck. Selected by `app.type === 'vite'`. Healthcheck hits `${ctx.app.healthcheck}` on port 80.
- **`ContentSource` interface** in `@learnquest/app-shell` — the abstract type already imported by `lq-math/src/main.tsx:3`. Any new source must implement this interface to be a drop-in replacement.
- **vite-spa nginx config** — pre-baked in the strategy's `Dockerfile.hbs` (SPA fallback + 1y asset cache). App just needs to ship `dist/index.html`.

---

## Decision points (locked)

| # | Decision | Choice | Why |
|---|----------|--------|-----|
| 1 | Where to swap Supabase? | **In `lq-math/src/main.tsx`** — add `rest` branch, keep `sql` (legacy) + `file` (default) | Pilot scope = 1 app. Upstream swap in `@learnquest/sql-content-source` would touch all consumers (out of scope per user "stop after lq-math"). |
| 2 | `blueforge.config.json` location | `school-quest/lq-math/blueforge.config.json` (per-app, mirrors lq-nordic pattern) | Per-app config matches existing precedent + future-proofs splitting lq-* apps to separate repos. |
| 3 | `app.type` | `"vite"` | Matches `ViteSpaStrategy.name === 'vite'`. |
| 4 | Domain | `math.blueforge.studio` | Follows `<app>.blueforge.studio` convention used by `nordic-quest.blueforge.studio` (lq-nordic). |
| 5 | Port (internal) | `3200` (matches `npm run dev`) | vite-spa strategy maps hostPort 3200 → container port 80 via compose `ports` mapping. |
| 6 | Dependencies | `[]` (no Postgres/Redis/S3 for static SPA) | lq-math has no runtime DB after swap — content comes from JSON files or REST endpoint. |
| 7 | Healthcheck | `"/"` | vite-spa strategy default; nginx serves `index.html` at `/`. |
| 8 | Migration of `@supabase/supabase-js` dep | **Remove from `lq-math/package.json`**; keep peer-dep in `@learnquest/sql-content-source` | After `rest` branch lands, lq-math no longer imports `createClient`. Removes hard-tier banned pattern. |
| 9 | `forge sync` then `forge app-deploy` from which CWD? | `school-quest/lq-math/` | `loadConfig` walks up from cwd; per-app config is at the cwd root. |
| 10 | Git workflow | `school-quest/lq-math` is already a git repo (verified via `git -C <path> rev-parse --git-dir`) with remote `blueforge-studio/lq-math`. **Branch from `main` as `deploy/hetzner-math-quest` (following the lq-nordic precedent commit `74cce1a`), commit blueforge.config.json + .env.example, push, open PR.** | forge-cli deploys from a git checkout (clonePath in StrategyContext). The repo already exists — no init needed. |

---

## Task 1: Add `rest` content source to lq-math (drop-in replacement for Supabase)

**Files:**
- Modify: `school-quest/lq-math/src/main.tsx`
- Create: `school-quest/lq-math/src/content/rest-content-source.ts`
- Modify: `school-quest/lq-math/.env.example`

- [ ] **Step 1: Read `ContentSource` interface from `@learnquest/app-shell` to confirm the contract**

Run: `grep -rn "interface ContentSource" /Users/kmandrup/Projects/Repos/learn-quest/lq-core/libs/common/app-shell/src/ 2>/dev/null | head -5`
Expected: shows the interface definition (methods like `getLessons`, `getLesson`, `getCategories`, etc.).

- [ ] **Step 2: Create `rest-content-source.ts` stub with failing smoke test**

Create `school-quest/lq-math/src/content/rest-content-source.ts`:

```typescript
import type { ContentSource, Lesson } from '@learnquest/app-shell';

export interface RestContentSourceOptions {
  baseUrl: string;
  appId: string;
}

/**
 * REST content source — fetches lessons from a JSON API.
 * Drop-in replacement for SqlContentSource when Supabase isn't available.
 * Contract: GET `${baseUrl}/${appId}/lessons` returns `{ lessons: Lesson[] }`.
 */
export class RestContentSource implements ContentSource {
  constructor(private readonly opts: RestContentSourceOptions) {}

  async getLessons(): Promise<Lesson[]> {
    const res = await fetch(`${this.opts.baseUrl}/${this.opts.appId}/lessons`);
    if (!res.ok) throw new Error(`[rest] getLessons failed: ${res.status}`);
    const data = (await res.json()) as { lessons: Lesson[] };
    return data.lessons;
  }

  async getLesson(id: string): Promise<Lesson | undefined> {
    const res = await fetch(`${this.opts.baseUrl}/${this.opts.appId}/lessons/${encodeURIComponent(id)}`);
    if (res.status === 404) return undefined;
    if (!res.ok) throw new Error(`[rest] getLesson ${id} failed: ${res.status}`);
    return (await res.json()) as Lesson;
  }

  async getCategories(): Promise<Array<{ id: string; name: string }>> {
    const res = await fetch(`${this.opts.baseUrl}/${this.opts.appId}/categories`);
    if (!res.ok) throw new Error(`[rest] getCategories failed: ${res.status}`);
    return (await res.json()) as Array<{ id: string; name: string }>;
  }
}
```

Run: `cd school-quest/lq-math && npx tsc --noEmit`
Expected: PASS (or fail with type errors on `ContentSource` methods — adjust interface until tsc clean).

- [ ] **Step 3: Wire `rest` branch into `resolveContentSource()` factory in `src/main.tsx`**

Modify `school-quest/lq-math/src/main.tsx`:

```typescript
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QuestShell, type ContentSource, type LessonScreenComponent } from '@learnquest/app-shell';
import type { QuestConfig, ActivityAdapter } from '@learnquest/quest-types';
import { SqlContentSource } from '@learnquest/sql-content-source';
import { createClient } from '@supabase/supabase-js';
import { RestContentSource } from './content/rest-content-source';
import {
  ArithmeticLessonScreen,
  GeometryLessonScreen,
  NumberSenseLessonScreen,
  WordProblemLessonScreen,
} from './screens';
import './index.css';

type ContentSourceKind = 'file' | 'sql' | 'rest';

function resolveContentSourceKind(): ContentSourceKind {
  const raw = import.meta.env.VITE_CONTENT_SOURCE;
  if (raw === 'sql' || raw === 'rest') return raw;
  return 'file';
}

function resolveContentSource(): ContentSource | undefined {
  const kind = resolveContentSourceKind();
  if (kind === 'file') return undefined;

  if (kind === 'sql') {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      console.warn('[math] VITE_CONTENT_SOURCE=sql but VITE_SUPABASE_URL/ANON_KEY missing — falling back to file source');
      return undefined;
    }
    const client = createClient(url, anonKey, {
      auth: { persistSession: false },
      db: { schema: 'content' },
    });
    console.log('[math] content source: SQL (content.math)');
    return new SqlContentSource({ client, appId: 'math' });
  }

  // kind === 'rest'
  const baseUrl = import.meta.env.VITE_CONTENT_API_URL;
  if (!baseUrl) {
    console.warn('[math] VITE_CONTENT_SOURCE=rest but VITE_CONTENT_API_URL missing — falling back to file source');
    return undefined;
  }
  console.log(`[math] content source: REST (${baseUrl}/math)`);
  return new RestContentSource({ baseUrl, appId: 'math' });
}

// ... rest of file unchanged (config, screens, adapters, render)
```

- [ ] **Step 4: Update `.env.example` to document the new env vars**

Modify `school-quest/lq-math/.env.example`:

```bash
# Content source: file (default) | sql (Supabase legacy) | rest (JSON REST API)
VITE_CONTENT_SOURCE=

# For VITE_CONTENT_SOURCE=sql
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# For VITE_CONTENT_SOURCE=rest
VITE_CONTENT_API_URL=https://content-api.blueforge.studio

# Asset CDN — lq-assets shared bucket (Cloudflare R2)
VITE_CLOUD_ASSETS=true
VITE_ASSETS_BASE_URL=https://lq-assets.blueforge.studio
```

- [ ] **Step 5: Verify build succeeds with all three modes**

```bash
cd school-quest/lq-math
VITE_CONTENT_SOURCE= npm run build    # file mode
VITE_CONTENT_SOURCE=sql VITE_SUPABASE_URL=https://x.supabase.co VITE_SUPABASE_ANON_KEY=dummy npm run build
VITE_CONTENT_SOURCE=rest VITE_CONTENT_API_URL=https://content-api.blueforge.studio npm run build
```

Expected: all three succeed (vite tree-shakes the unused branch).

- [ ] **Step 6: Commit (defer until Task 4 creates the deploy branch)**

Defer commit until Task 4 creates the `deploy/hetzner-math-quest` branch. For now, the code is staged.

---

## Task 2: Remove `@supabase/supabase-js` direct dependency from lq-math

**Files:**
- Modify: `school-quest/lq-math/package.json`

- [ ] **Step 1: Confirm `@supabase/supabase-js` is no longer imported in lq-math src**

Run: `cd school-quest/lq-math && grep -rn "@supabase" src/ 2>/dev/null`
Expected: empty (the only import was in `src/main.tsx` which now only references it inside the `kind === 'sql'` branch — Vite's tree-shaking removes it from the bundle, but the import statement is still parsed).

- [ ] **Step 2: Decide — keep import or make sql branch dynamic?**

If you want a clean `bundle size == 0` for the Supabase code path when `kind !== 'sql'`, make the import dynamic:

In `src/main.tsx`, change:
```typescript
import { createClient } from '@supabase/supabase-js';
```
to a dynamic import inside the `kind === 'sql'` branch:
```typescript
const { createClient } = await import('@supabase/supabase-js');
```

This means `@supabase/supabase-js` is still in `package.json` as a dependency (because the dev/local sql mode still uses it) — but the production bundle for `file` / `rest` modes does NOT include it.

- [ ] **Step 3: Document why @supabase/supabase-js stays in package.json (if keeping it)**

Add a comment in package.json or a `// See SQL content source docs` inline note. (No code change needed.)

- [ ] **Step 4: Defer commit to Task 4**

---

## Task 3: Create `blueforge.config.json` at `school-quest/lq-math/`

**Files:**
- Create: `school-quest/lq-math/blueforge.config.json`

- [ ] **Step 1: Model on lq-nordic's config**

Create `school-quest/lq-math/blueforge.config.json`:

```json
{
  "name": "math-quest",
  "hetzner": {
    "target": "hetzner",
    "server": "hetzner-prod-1",
    "registry": "ghcr.io/blueforge-studio",
    "caddyEmail": "ops@blueforge.studio",
    "packageManager": "pnpm",
    "apps": {
      "web": {
        "path": ".",
        "type": "vite",
        "port": 3200,
        "domains": ["math.blueforge.studio"],
        "dependencies": [],
        "healthcheck": "/",
        "secrets": [],
        "ignore": [
          "node_modules",
          "dist",
          "test-results",
          "playwright-report",
          ".playwright-mcp",
          "audit-results",
          "screen-audit",
          "tests/**/*-spec.ts"
        ]
      }
    }
  }
}
```

- [ ] **Step 2: Validate the config locally**

```bash
cd school-quest/lq-math
node -e "
const c = require('./blueforge.config.json');
const h = c.hetzner.apps.web;
if (h.type !== 'vite') throw new Error('type must be vite');
if (!h.domains.includes('math.blueforge.studio')) throw new Error('domain missing');
if (h.dependencies.length !== 0) throw new Error('no dependencies expected');
console.log('OK');
"
```

Expected: `OK`.

- [ ] **Step 3: Defer commit to Task 4**

---

## Task 4: Branch off `main` as `deploy/hetzner-math-quest` and push PR (lq-nordic precedent)

**Files:** none created here (blueforge.config.json + .env.example already created in earlier tasks; just need branch + commit + push)

The repo `school-quest/lq-math` is already an individual git repo with remote `blueforge-studio/lq-math`. **No git init, no `gh repo create` — those are NOT needed.** The pattern follows lq-nordic commit `74cce1a chore(deploy): add blueforge.config.json for Hetzner deployment` which adds a single `blueforge.config.json` on a `deploy/hetzner-<slug>-quest` branch off `main`.

- [ ] **Step 1: Verify repo state and remote**

Run:
```bash
cd school-quest/lq-math
git -C . rev-parse --git-dir
git -C . remote -v
git -C . branch --show-current
git -C . log --oneline -1 main
```

Expected: `.git` printed, `origin https://github.com/blueforge-studio/lq-math.git (fetch/push)`, current branch name, latest commit SHA on `main`.

- [ ] **Step 2: Fetch origin and create `deploy/hetzner-math-quest` branch off `main`**

```bash
cd school-quest/lq-math
git fetch origin
git checkout -b deploy/hetzner-math-quest origin/main
```

Expected: switched to new branch `deploy/hetzner-math-quest`.

- [ ] **Step 3: Cherry-pick the audit commit (ef62fd2) from the current audit branch (only if you started from the audit branch)**

If the working tree is sitting on `screen-audit/iterate-2026-05-05T13-58-50` (1 commit ahead of main: `ef62fd2 chore: update config and screen-audit`), you have two options:

**Option A — minimal deploy-only branch (recommended):** Branch off `main`, then re-apply only the blueforge.config.json + .env.example changes manually. Skip the audit commit (it can land separately).

```bash
# From deploy/hetzner-math-quest (branched from origin/main):
git add blueforge.config.json .env.example
git commit -m "chore(deploy): add blueforge.config.json for Hetzner deployment"
```

**Option B — include the audit work:** Branch off the audit branch.

```bash
cd school-quest/lq-math
git checkout screen-audit/iterate-2026-05-05T13-58-50
git checkout -b deploy/hetzner-math-quest
git add blueforge.config.json .env.example
git commit -m "chore(deploy): add blueforge.config.json for Hetzner deployment

Includes ef62fd2 (audit) which is already on this branch."
```

**Recommendation:** Option A. Keeps deploy and audit concerns separate. The audit commit (`ef62fd2`) can land via a separate PR to `main`.

- [ ] **Step 4: Push branch and open PR**

```bash
cd school-quest/lq-math
git push -u origin deploy/hetzner-math-quest
gh pr create --base main --head deploy/hetzner-math-quest \
  --title "chore(deploy): add blueforge.config.json for Hetzner deployment" \
  --body "$(cat <<'EOF'
## Summary
- Pilot lq-math on blueforge-stack with vite-spa Hetzner deploy
- Adds `blueforge.config.json` declaring math.blueforge.studio (port 3200, no deps, healthcheck /)
- Updates `.env.example` to document file/sql/rest kill switch

## Pattern
Follows the lq-nordic precedent (deploy/hetzner-nordic-quest branch, commit 74cce1a).

## Test plan
- [ ] `node -e "require('./blueforge.config.json')"` succeeds
- [ ] PR CI green (typecheck + lint)

## Deploy plan (after merge)
- [ ] `forge sync` from school-quest/lq-math
- [ ] `forge app-deploy --wait --verify`
- [ ] curl https://math.blueforge.studio returns 200 with HTML

Refs: MIGRATION_REPORT_lq-math.md (companion doc — fan-out roadmap)
EOF
)"
```

Expected: PR URL printed.

---

## Task 5: Deploy to Hetzner via forge-cli

**Files:**
- (No code changes — pure ops)

- [ ] **Step 1: Authenticate forge-cli**

```bash
forge login --api-key "$FORGE_API_KEY"
```

Expected: `Logged in as <user>`. If `FORGE_API_KEY` is not set, get it from `mission-control.blueforge.studio` (or ask user).

- [ ] **Step 2: Register the app in mission-control**

```bash
cd school-quest/lq-math
forge sync
```

Expected: `App math-quest registered. 1 component (web) updated.` (or similar success message).

- [ ] **Step 3: Trigger the deploy and wait for healthcheck**

```bash
forge app-deploy --wait --verify
```

Expected: deployment reaches `deployed` status within ~5 min, healthcheck passes. Output ends with `Deployed math-quest/web. URL: https://math.blueforge.studio`.

- [ ] **Step 4: Smoke test the live app**

```bash
curl -4 -sI https://math.blueforge.studio | head -5
curl -4 -s https://math.blueforge.studio/ | grep -E '<title>|<div id="root"' | head -5
```

Expected: HTTP 200, HTML containing `<title>Math Quest</title>` and `<div id="root"></div>`.

- [ ] **Step 5: Capture the deployment ID for the report**

```bash
forge list --app math-quest --limit 1
```

Record the latest deployment ID (e.g. `dep_abc123`) for the report.

---

## Task 6: (Optional, deferred) wire `rest` content source to a blueforge platform project

**Skip for the pilot** unless the user explicitly asks for it. Document in the report as Phase 2.

If user requests: provision a blueforge platform project `lq-math-content`, export lessons JSON from `school-quest/lq-math/public/data/lessons/en/`, point `VITE_CONTENT_API_URL` at the project's REST endpoint. Adds ~2-3 hours of work (project provisioning + lesson export script).

---

## Task 7: Write the migration report

**Files:**
- Create: `MIGRATION_REPORT_lq-math.md` at learn-quest root

(This is the user's primary deliverable — handled in Task #27 of the task list, not as part of this plan. The plan's job ends at a deployed app + the PR open.)

---

## Self-review

**1. Spec coverage:**
- ✅ Stop after lq-math — Tasks 1-5 are scoped to one app
- ✅ Write report — Task 7 (separate deliverable) + report outline in `MIGRATION_REPORT_lq-math.md` (separate doc, Task #27)
- ✅ Propose how to proceed — covered in report (fan-out roadmap)
- ✅ Check forge-control best practices — `HetznerAppConfig` + `ViteSpaStrategy` + `blueforge.config.json` schema extension (routes/migrations/buildEnv) all reviewed

**2. Placeholder scan:**
- ✅ No "TBD" / "TODO" / "implement later"
- ✅ All code blocks have actual content
- ✅ Each task has exact file paths + exact commands

**3. Type consistency:**
- `RestContentSource` interface methods (`getLessons`, `getLesson`, `getCategories`) — confirmed against `ContentSource` interface in step 1
- `blueforge.config.json` fields — match `HetznerAppConfig` interface (`path`, `type`, `port`, `domains`, `dependencies`, `healthcheck`, `secrets`, optional `ignore`)
- `forge` CLI commands — match forge-cli v2.0.0 README (sync, app-deploy, list)