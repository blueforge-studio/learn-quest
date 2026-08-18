# App Testing & Audit Proposal — School Quest + Lang Quest

> Date: 2026-04-10

## Problem

20 lang-quest apps and 6 school-quest apps have no smoke tests, E2E tests, or screen capture/audit infrastructure. We need to verify each app:
1. Builds and renders correctly
2. Has no console errors or missing assets
3. Meets performance thresholds (first render, LCP)
4. Looks correct visually (screenshot comparison)

## Existing Infrastructure

### In lq-core
- `apps/web/src/e2e/` — 136 Playwright specs for the main web app
- `apps/web/scripts/screen-capture/` — Config-driven Playwright screenshot capture with multi-device/theme support
- `apps/web/e2e.config.js` — Domain-based test runner config
- `playwright.config.ts` — Projects for mock, smoke, perf, indexeddb, mobile

### In blueforge-org (available via packr)

| Package | What it does |
|---------|-------------|
| `@blueforge-studio/screen-audit` | Flow-based element captures, axe-core a11y, perf metrics, console error collection, multi-device, AI vision evaluation, visual diff |
| `@blueforge-studio/lighthouse-audit` | Lighthouse perf/SEO/best-practices on deployed URLs with markdown reports |
| `@blueforge-studio/screen-capture` | Standalone Playwright screenshot capture with multi-device/theme, CLI |
| `@blueforge-studio/screen-evaluator` | AI visual evaluation pipeline, reads capture manifests |
| `@blueforge-studio/e2e-agent` | Domain-based Playwright E2E execution with resource monitoring and report aggregation |
| `@blueforge-studio/audit-upload` | Shared upload for audit results |

## Design

### Architecture

```
lq-operations/                          # Cross-repo test orchestrator
├── scripts/
│   ├── audit-apps.ts                   # Orchestrate audits across all 26 apps
│   └── smoke-test-apps.ts              # Quick smoke test all apps
├── configs/
│   ├── school-quest.audit.json         # Audit config for 6 subjects
│   └── lang-quest.audit.json           # Audit config for 14 language groups
└── reports/                            # Generated reports (gitignored)

Each app (e.g., lq-geography/):
├── playwright.config.ts                # Minimal config — port, testDir
├── tests/
│   ├── smoke.spec.ts                   # App boots, renders, no console errors
│   ├── lessons.spec.ts                 # Lesson loading, navigation, types
│   └── performance.spec.ts             # First render, LCP thresholds
└── audit.config.json                   # Screen-audit flow config (optional)
```

### Three Tiers of Testing

#### Tier 1: Smoke Tests (per app, fast, CI-friendly)

Each of the 26 apps gets a minimal `tests/smoke.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('App Smoke Test', () => {
  test('renders without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', err => errors.push(err.message));
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // App rendered
    await expect(page.locator('[data-testid="app-root"]')).toBeVisible({ timeout: 10000 });
    
    // No console errors
    expect(errors).toEqual([]);
  });

  test('no missing network assets', async ({ page }) => {
    const failures: string[] = [];
    page.on('response', res => {
      if (res.status() >= 400) failures.push(`${res.status()} ${res.url()}`);
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    expect(failures).toEqual([]);
  });

  test('first render under 3s', async ({ page }) => {
    const start = Date.now();
    await page.goto('/');
    await page.locator('[data-testid="app-root"]').waitFor({ state: 'visible' });
    const elapsed = Date.now() - start;
    
    expect(elapsed).toBeLessThan(3000);
  });
});
```

**Run locally:** `cd lq-geography && npx playwright test`
**Run all:** `tsx lq-operations/scripts/smoke-test-apps.ts` (loops through all 26 apps)

#### Tier 2: Screen Audit (per app, comprehensive)

Uses `@blueforge-studio/screen-audit` for full visual + a11y + perf audit.

Each app gets an `audit.config.json`:

```json
{
  "name": "lq-geography",
  "baseUrl": "http://localhost:3203",
  "devices": ["Desktop Chrome", "iPhone 12"],
  "flows": [
    {
      "name": "home",
      "steps": [
        { "action": "goto", "url": "/" },
        { "action": "waitFor", "selector": "[data-testid='app-root']" },
        { "action": "capture", "name": "home" }
      ]
    },
    {
      "name": "lesson-chapter-1",
      "steps": [
        { "action": "goto", "url": "/lessons/chapter-1" },
        { "action": "waitFor", "selector": "[data-testid='lesson-list']" },
        { "action": "capture", "name": "chapter-1" }
      ]
    }
  ],
  "checks": {
    "a11y": true,
    "console": true,
    "network": true,
    "performance": {
      "lcp": 2500,
      "fcp": 1800,
      "cls": 0.1
    }
  }
}
```

Screen-audit produces per-flow:
- **Screenshots** (desktop + mobile) in `reports/captures/`
- **Console log capture** — errors, warnings
- **Network failures** — 4xx/5xx responses, missing assets
- **Perf metrics** — LCP, FCP, CLS, TTFB via Performance API
- **A11y report** — axe-core violations
- **Visual diff** — compared against baseline screenshots
- **Manifest** — machine-readable JSON with all results

#### Tier 3: Cross-App Orchestration (lq-operations)

A single script in `lq-operations` runs audits across all 26 apps:

```typescript
// lq-operations/scripts/audit-apps.ts

const APPS = [
  // School Quest
  { name: 'lq-math', port: 3200, dir: '../school-quest/lq-math' },
  { name: 'lq-science', port: 3201, dir: '../school-quest/lq-science' },
  { name: 'lq-history', port: 3202, dir: '../school-quest/lq-history' },
  { name: 'lq-geography', port: 3203, dir: '../school-quest/lq-geography' },
  { name: 'lq-reading', port: 3204, dir: '../school-quest/lq-reading' },
  { name: 'lq-writing', port: 3205, dir: '../school-quest/lq-writing' },
  // Lang Quest
  { name: 'lq-nordic', port: 3010, dir: '../lang-quest/lq-nordic' },
  { name: 'lq-romance', port: 3020, dir: '../lang-quest/lq-romance' },
  // ... all 14
];

for (const app of APPS) {
  // 1. Start dev server
  // 2. Run smoke tests (Playwright)
  // 3. Run screen-audit (captures + a11y + perf + console + network)
  // 4. Generate report
  // 5. Stop server
}

// 6. Generate cross-app summary report
```

### Package Dependencies

| Package | Used for | From |
|---------|----------|------|
| `@blueforge-studio/screen-audit` | Visual capture, a11y, perf, console, network, AI eval, visual diff | packr |
| `@blueforge-studio/lighthouse-audit` | Lighthouse perf/SEO on deployed URLs | packr |
| `@blueforge-studio/e2e-agent` | Domain-based test orchestration with resource monitoring | packr |
| `playwright` | Browser automation | npm |
| `axe-core` | Accessibility testing (bundled in screen-audit) | npm |

### Report Output

```
lq-operations/reports/
├── summary.md                    # Cross-app summary with pass/fail table
├── lq-geography/
│   ├── smoke-results.json        # Smoke test pass/fail
│   ├── captures/
│   │   ├── home-desktop.webp
│   │   ├── home-mobile.webp
│   │   ├── chapter-1-desktop.webp
│   │   └── manifest.json         # Metadata for all captures
│   ├── a11y-report.json          # Axe-core violations
│   ├── console-logs.json         # Console errors/warnings
│   ├── network-failures.json     # Missing assets, 4xx/5xx
│   └── perf-metrics.json         # LCP, FCP, CLS, TTFB
├── lq-history/
│   └── ...
└── lq-nordic/
    └── ...
```

### Summary Report (markdown)

```markdown
# LearnQuest App Audit — 2026-04-10

| App | Smoke | A11y | Console | Network | LCP | FCP | Screenshot |
|-----|-------|------|---------|---------|-----|-----|------------|
| lq-math | ✅ | 0 violations | 0 errors | 0 failures | 1.2s | 0.8s | ✅ |
| lq-science | ✅ | 2 warnings | 0 errors | 0 failures | 1.4s | 0.9s | ✅ |
| lq-geography | ❌ | 0 violations | 1 error | 2 failures | 2.8s | 1.6s | ⚠️ |
| lq-nordic | ✅ | 0 violations | 0 errors | 0 failures | 1.1s | 0.7s | ✅ |
| ... | | | | | | | |
```

### Visual Diff (baseline comparison)

Screen-audit supports visual diffing against stored baselines:

1. **First run**: captures become the baseline (stored in `reports/baselines/`)
2. **Subsequent runs**: new captures are diffed against baselines using pixel comparison
3. **Threshold**: configurable pixel diff tolerance (default 0.1%)
4. **Output**: diff images highlighting changed regions + pass/fail status

This catches visual regressions after dependency updates or content changes.

## Implementation Plan

### Phase 1: Shared Playwright Config + Smoke Tests (low effort)

1. Create a shared `playwright.config.ts` template in `lq-operations/templates/`
2. Add `tests/smoke.spec.ts` to each school-quest app (6 apps)
3. Add `tests/smoke.spec.ts` to a sample lang-quest app (lq-nordic)
4. Create `lq-operations/scripts/smoke-test-apps.ts` orchestrator
5. Verify all 6 school-quest apps pass smoke tests

### Phase 2: Screen Audit Integration (medium effort)

6. Add `@blueforge-studio/screen-audit` to `lq-operations` dependencies
7. Create `audit.config.json` for each school-quest app
8. Create `lq-operations/scripts/audit-apps.ts` orchestrator
9. Run first audit, capture baselines
10. Generate cross-app summary report

### Phase 3: Lang Quest Coverage (medium effort)

11. Add smoke tests + audit configs to all 14 lang-quest apps
12. Extend orchestrator to run all 26 apps
13. Add visual diff baseline comparison

### Phase 4: CI Integration (later)

14. Add smoke tests to each app's CI (run on push)
15. Add periodic full audit to lq-operations CI (weekly/manual)
16. Store baselines in git or Supabase storage for visual diff

## Key Design Decisions

1. **Per-app playwright.config.ts** — each app can run tests independently, but the orchestrator can also run them all centrally
2. **`@blueforge-studio/screen-audit` over custom capture** — the blueforge package already handles a11y, console, network, perf, visual diff, and multi-device. No need to rebuild this.
3. **Orchestrator in lq-operations** — the central ops repo is the right place for cross-app tooling. Individual apps just have smoke tests.
4. **Reports gitignored** — generated reports are ephemeral. Baselines are committed for visual diff.
5. **Config-driven** — audit.config.json per app means the orchestrator doesn't need to know app internals.
