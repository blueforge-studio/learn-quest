# Tasks 13–14: Wiring and Manifest

[Previous: reports and orchestrator](tasks-10-12-reports-and-orchestrator.md) · [Plan index](00-overview.md) · [Next: fixtures and tests](tasks-15-17-fixtures-and-tests.md)

---

## Task 13: Wire phases into ai-audit-images.ts

# Tasks 13–14: Wiring and Manifest

[Previous: reports and orchestrator](tasks-10-12-reports-and-orchestrator.md) · [Plan index](00-overview.md) · [Next: fixtures and tests](tasks-15-17-fixtures-and-tests.md)

---


**Files:**
- Modify: `lq-tools/scripts/ai-audit-images.ts`

- [ ] **Step 1: Read current ai-audit-images.ts**

Read the file end-to-end. Identify:
- The main scan loop
- Where pixelStats flow in (current --no-pixel-gate flag)
- Where the manifest is written
- Where `--budget` is parsed

- [ ] **Step 2: Add CLI flag parsing**

Find the CLI flag parsing block. Add:

```ts
const noPhase2 = process.argv.includes('--no-phase2');
const dryRun = process.argv.includes('--dry-run');
```

- [ ] **Step 3: Load the phase2 reference bank**

In the setup section, after loading `imageAuditConfig`:

```ts
import { loadBank } from './phase2-reference-bank.js';
import { resolve as pathResolve } from 'node:path';

const bankPath = pathResolve(
  process.cwd(),
  imageAuditConfig.phase2.referenceBankPath,
);
const phase2Bank = loadBank(bankPath);
if (phase2Bank.entries.length === 0 && !noPhase2) {
  console.warn(`[audit] phase2 bank is empty at ${bankPath}; Phase 2 will run in degraded mode`);
}
```

- [ ] **Step 4: Build the Phase2VerdictConfig and corner-flood config**

```ts
import { loadBank } from './phase2-reference-bank.js';
import { resolve as pathResolve } from 'node:path';

const bankPath = pathResolve(
  process.cwd(),
  imageAuditConfig.phase2.referenceBankPath,
);
const phase2Bank = loadBank(bankPath);
if (phase2Bank.entries.length === 0 && !noPhase2) {
  console.warn(`[audit] phase2 bank is empty at ${bankPath}; Phase 2 will run in degraded mode`);
}

const phase2Cfg: Phase2VerdictConfig = {
  ...imageAuditConfig.phase2,
  bank: phase2Bank,
};
const cornerFloodCfg = imageAuditConfig.phase1.cornerFlood;
```

- [ ] **Step 5: Insert Phase 1 (with corner-flood) and Phase 2 into the per-image loop**

Find the per-image loop. The structure is currently:
```
for each image:
  compute pixelStats (if !--no-pixel-gate)
  if pixelGate fails → skip with pixel reason
  else → call M3
```

Refactor to:
```
for each image:
  load buffer
  if !--no-pixel-gate:
    phase1 = await runPhase1(ctx with cornerFloodCfg)
    if phase1.verdict.hardFail → record pixel verdict (with corner-flood reasons), SKIP Phase 2/3
    pixelWarnings = phase1.verdict.softFailReasons
  if !--no-phase2 AND not skipped:
    phase2 = await runPhase2(ctx with phase2Cfg)
    if phase2.verdict.reasons.length > 0 → record phase2 verdict, SKIP Phase 3
  if !dryRun AND not skipped:
    phase3 = await runPhase3(ctx, m3Callback)
  write per-image record into manifest entry
```

- [ ] **Step 6: Populate phase1 / phase2 / phase3 fields in the manifest**

The manifest writer currently emits a single verdict per image. Extend it to emit the structured phase fields per the spec:

```ts
{
  ...existingFields,
  phase1: {
    passed: !phase1Result.verdict.hardFail,
    softWarnings: phase1Result.verdict.softFailReasons,
    cornerFlood: phase1Result.cornerFlood ? {
      bgFraction: phase1Result.cornerFlood.bgFraction,
      isBgDominated: phase1Result.cornerFlood.isBgDominated,
      corners: phase1Result.cornerFlood.cornerResults,
    } : undefined,
  },
  phase2: phase2Result ? {
    passed: phase2Result.verdict.reasons.length === 0,
    verdict: phase2Result.verdict.isTextCard ? 'text-card'
           : phase2Result.verdict.isPreschoolCartoon ? 'preschool-cartoon'
           : phase2Result.verdict.hasGiantLabel ? 'giant-label'
           : 'pass',
    confidence: phase2Result.verdict.confidence,
    signalsUsed: phase2Result.verdict.signalsUsed,
    matchedReference: phase2Result.verdict.matchedReference,
  } : undefined,
  phase3: phase3Result?.status === 'skipped' ? { skipped: true, skipReason: phase3Result.skipReason } : { ...m3Fields },
  auditHistory: [...priorHistory, { date: now, verdict, score, source: 'phase-pipeline' }],
}
```

Preserve all existing manifest fields — additions only.

- [ ] **Step 7: Append to auditHistory, not overwrite**

Read each existing manifest and parse its `auditHistory[]` (defaulting to `[]` if missing). Append the new run entry. Cap at last 20 entries to bound growth.

- [ ] **Step 8: Add `--dry-run` summary**

When `--dry-run` is set, after the loop, write a summary that estimates what Phase 3 would have cost:

```ts
console.log(`[audit] dry-run complete. ${phase3Calls} M3 calls would be made (estimated cost: $${estimatedCost.toFixed(2)})`);
```

Skip writing per-folder index.json (no useful state) but DO write a run-level report with the summary.

- [ ] **Step 9: Write the run-level report on every full run**

After the loop, build and write the run report:

```ts
import { writeRunReport } from './audit-run-report.js';

writeRunReport('lq-nordic/docs/audit-runs', {
  runId: new Date().toISOString(),
  configSnapshot: imageAuditConfig,
  summary: { imagesScanned, phase1HardFails, phase2HardFails, phase3Calls, phase3Skipped, estimatedCostUsd, durationSec },
  folderCohorts: cohortMap,
  duplicateGroups,
  repairQueue,
  perFolder,
});
```

- [ ] **Step 10: Smoke test on one folder**

Run: `cd lq-tools && pnpm exec tsx scripts/ai-audit-images.ts --folder basics --limit 2 --dry-run --no-pixel-gate 2>&1 | tail -30`
Expected: prints a summary; no exceptions; no M3 call (dry-run).

- [ ] **Step 11: Real test on basics with --no-m3 escape**

If `--no-m3` isn't a flag yet, the pipeline should naturally skip M3 in dry-run. Verify by checking that the run report's `phase3Calls: 0` when `--dry-run` is passed.

- [ ] **Step 12: Commit**

```bash
git add lq-tools/scripts/ai-audit-images.ts
git commit -m "feat(audit): wire Phase 2 + run report into ai-audit-images"
```

---

## Task 14: Manifest schema extension for the per-folder index.json

**Files:**
- Modify: `lq-tools/scripts/audit-manifest-fields.ts` (NEW: thin extension types)
- Create: `lq-tools/scripts/audit-manifest-fields.test.ts`

(Note: the underlying `@blueforge-studio/audit-manifest` schema stays at `image-index/v1`. We add optional fields in lq-tools itself — they're written as JSON which is inherently extensible.)

- [ ] **Step 1: Write the extended type definitions**

Create `lq-tools/scripts/audit-manifest-fields.ts`:

```ts
export type Phase1Manifest = {
  passed: boolean;
  softWarnings: string[];
  cornerFlood?: {
    bgFraction: number;
    isBgDominated: boolean;
    corners: Array<{
      corner: 'TL' | 'TR' | 'BL' | 'BR';
      sampledColors: Array<'white' | 'black'>;
      whiteArea: number;
      blackArea: number;
    }>;
  };
};

export type Phase2Manifest = {
  passed: boolean;
  verdict: 'pass' | 'text-card' | 'preschool-cartoon' | 'giant-label' | 'borderline';
  confidence: number;
  signalsUsed: string[];
  matchedReference?: string;
};

export type Phase3Manifest =
  | { skipped: true; skipReason: 'phase1-hard-fail' | 'phase2-hard-fail' | 'cost-cap' | 'chain-exhausted' | 'phase2-error' }
  | { skipped: false; status: 'active' | 'needs-fix' | 'needs-regeneration' | 'audit-error'; score?: number; flags: string[]; reasons: string[]; suggestions?: string[] };

export type AuditHistoryEntry = {
  date: string;
  verdict: string;
  score?: number;
  source: 'phase-pipeline' | 'phase3-only' | 'manual';
};

export type ExtendedImageEntry = {
  phase1?: Phase1Manifest;
  phase2?: Phase2Manifest;
  phase3?: Phase3Manifest;
  auditHistory?: AuditHistoryEntry[];
};
```

- [ ] **Step 2: Write a test for round-tripping**

Create `lq-tools/scripts/audit-manifest-fields.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { ExtendedImageEntry } from './audit-manifest-fields.js';

describe('ExtendedImageEntry', () => {
  it('round-trips through JSON without losing fields', () => {
    const entry: ExtendedImageEntry = {
      phase1: {
        passed: true,
        softWarnings: ['dominant-empty'],
        cornerFlood: {
          bgFraction: 0.12,
          isBgDominated: false,
          corners: [{ corner: 'TL', sampledColors: ['white'], whiteArea: 25, blackArea: 0 }],
        },
      },
      phase2: { passed: false, verdict: 'text-card', confidence: 0.92, signalsUsed: ['text-area', 'nearest-neighbor-style'], matchedReference: 'phase2-bank/please.webp' },
      phase3: { skipped: true, skipReason: 'phase2-hard-fail' },
      auditHistory: [{ date: '2026-07-29', verdict: 'needs-regeneration', score: 1, source: 'phase-pipeline' }],
    };
    const json = JSON.stringify(entry);
    const parsed = JSON.parse(json) as ExtendedImageEntry;
    expect(parsed).toEqual(entry);
  });

  it('remains backwards-compatible — old entries without new fields parse fine', () => {
    const oldEntry = { filename: 'cat.webp', status: 'active', score: 9 };
    const json = JSON.stringify(oldEntry);
    const parsed = JSON.parse(json);
    expect((parsed as ExtendedImageEntry).phase1).toBeUndefined();
    expect((parsed as ExtendedImageEntry).phase2).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run the test to verify it passes**

Run: `cd lq-tools && pnpm test -- audit-manifest-fields`
Expected: PASS — both test cases pass.

- [ ] **Step 4: Commit**

```bash
git add lq-tools/scripts/audit-manifest-fields.ts lq-tools/scripts/audit-manifest-fields.test.ts
git commit -m "feat(audit): extended image-index manifest types (Phase 1/2/3 + history)"
```

---

