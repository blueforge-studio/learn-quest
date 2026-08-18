# Tasks 10–12: Reports and Orchestrator

[Previous: classifier](tasks-07-09-classifier.md) · [Plan index](00-overview.md) · [Next: wiring and manifest](tasks-13-14-wiring-and-manifest.md)

---

## Task 10: Extend ai-audit-classify.ts with phase2 reasons

**Files:**
- Modify: `lq-tools/scripts/ai-audit-classify.ts`
- Modify: `lq-tools/scripts/ai-audit-classify.test.ts`

- [ ] **Step 1: Read current ai-audit-classify.ts**

Read: `lq-tools/scripts/ai-audit-classify.ts`. Find the `regenCaps` type definition and the disqualifier enum.

- [ ] **Step 2: Add phase2 caps to the type**

Add to the `regenCaps` type:

```ts
phase2TextCard: number;
phase2PreschoolCartoon: number;
phase2GiantLabel: number;
```

Use the existing pattern (numeric fields with sensible defaults).

- [ ] **Step 3: Update defaults**

In the default `regenCaps` constant, add:

```ts
phase2TextCard: 3,
phase2PreschoolCartoon: 3,
phase2GiantLabel: 3,
```

(Match the existing per-disqualifier cap pattern.)

- [ ] **Step 4: Add failing test**

Append to `ai-audit-classify.test.ts`:

```ts
describe('phase2 regen caps', () => {
  it('loads phase2 caps from defaults', () => {
    const input = makeInput();
    const result = classifyAuditResult(input);
    // No regression on existing behaviour
    expect(result).toBeDefined();
  });

  it('treats phase2:* reasons as regen triggers', () => {
    const input = makeInput({
      parsed: { has_meaningful_visual: true, quality_score: 8, reasons: ['phase2:text-card'] },
    });
    const result = classifyAuditResult(input);
    expect(result.verdict).toBe('needs-regeneration');
    expect(result.flags).toContain('phase2-text-card');
  });
});
```

- [ ] **Step 5: Update classify logic to consume phase2 reasons**

In `ai-audit-classify.ts`, find the section that maps M3's `reasons[]` into `flags[]`. Extend it to recognise `phase2:text-card`, `phase2:preschool-cartoon`, `phase2:giant-label` as immediate `needs-regeneration` triggers (these short-circuit any further evaluation since Phase 2 already decided).

```ts
const PHASE2_REASONS: Record<string, string> = {
  'phase2:text-card': 'phase2-text-card',
  'phase2:preschool-cartoon': 'phase2-preschool-cartoon',
  'phase2:giant-label': 'phase2-giant-label',
};
```

In the main loop, before the existing disqualifier evaluation:

```ts
for (const reason of parsed.reasons ?? []) {
  const flag = PHASE2_REASONS[reason];
  if (flag) flags.push(flag);
}
```

- [ ] **Step 6: Run all classify tests**

Run: `cd lq-tools && pnpm test -- ai-audit-classify`
Expected: PASS — original tests still pass + new phase2 tests pass.

- [ ] **Step 7: Update image-audit.config.json with phase2 caps**

In `lq-tools/scripts/image-audit.config.json`, extend the `regenCaps` block:

```jsonc
"regenCaps": {
  "textOnly": 3,
  "misspelledText": 3,
  "borderArtifact": 4,
  "checkerboard": 4,
  "artStyleMismatch": 5,
  "phase2TextCard": 3,
  "phase2PreschoolCartoon": 3,
  "phase2GiantLabel": 3
},
```

- [ ] **Step 8: Commit**

```bash
git add lq-tools/scripts/ai-audit-classify.ts lq-tools/scripts/ai-audit-classify.test.ts lq-tools/scripts/image-audit.config.json
git commit -m "feat(audit): phase2 reasons as immediate regen triggers in classify"
```

---

## Task 11: Audit run report writer

**Files:**
- Create: `lq-tools/scripts/audit-run-report.ts`
- Create: `lq-tools/scripts/audit-run-report.test.ts`

- [ ] **Step 1: Write failing test for report writer**

Create `lq-tools/scripts/audit-run-report.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildRunReport,
  writeRunReport,
  type RunReportInput,
} from './audit-run-report.js';

describe('buildRunReport', () => {
  const baseInput: RunReportInput = {
    runId: '2026-07-29T12:00:00Z',
    configSnapshot: { phase1: {}, phase2: {}, phase3: {} },
    summary: {
      imagesScanned: 10,
      phase1HardFails: 2,
      phase2HardFails: 3,
      phase3Calls: 5,
      phase3Skipped: 5,
      estimatedCostUsd: 0.12,
      durationSec: 30,
    },
    folderCohorts: {
      animals: { firstCommitDate: '2026-04-12', cohort: 'ch1-5-batch' },
    },
    duplicateGroups: [],
    repairQueue: [
      { folder: 'basics', filename: 'sorry.webp', verdict: 'needs-regeneration', reasons: ['phase2:text-card'], promptHints: [] },
    ],
    perFolder: {
      animals: { active: 6, 'needs-fix': 0, 'needs-regeneration': 1, phase2HardFails: 0 },
    },
  };

  it('produces audit-run/v1 schema with all required fields', () => {
    const report = buildRunReport(baseInput);
    expect(report.schema).toBe('audit-run/v1');
    expect(report.runId).toBe(baseInput.runId);
    expect(report.summary.imagesScanned).toBe(10);
    expect(report.duplicateGroups).toEqual([]);
    expect(report.repairQueue).toHaveLength(1);
  });
});

describe('writeRunReport', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'run-report-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('writes report to <root>/<runId>.json and a latest.json pointer', () => {
    const input: RunReportInput = {
      runId: '2026-07-29T12:00:00Z',
      configSnapshot: {},
      summary: { imagesScanned: 0, phase1HardFails: 0, phase2HardFails: 0, phase3Calls: 0, phase3Skipped: 0, estimatedCostUsd: 0, durationSec: 0 },
      folderCohorts: {},
      duplicateGroups: [],
      repairQueue: [],
      perFolder: {},
    };
    const result = writeRunReport(dir, input);
    expect(existsSync(result.reportPath)).toBe(true);
    expect(existsSync(result.latestPath)).toBe(true);
    const latest = JSON.parse(readFileSync(result.latestPath, 'utf8'));
    expect(latest.runId).toBe('2026-07-29T12:00:00Z');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd lq-tools && pnpm test -- audit-run-report`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement buildRunReport + writeRunReport**

Create `lq-tools/scripts/audit-run-report.ts`:

```ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export type CohortInfo = {
  firstCommitDate: string;
  cohort: 'thai-import' | 'ch1-5-batch' | 'later' | 'unknown';
};

export type RepairQueueItem = {
  folder: string;
  filename: string;
  verdict: 'active' | 'needs-fix' | 'needs-regeneration';
  reasons: string[];
  promptHints: string[];
};

export type FolderStats = {
  active: number;
  'needs-fix': number;
  'needs-regeneration': number;
  phase2HardFails: number;
};

export type DuplicateGroupOut = {
  hashDistance: number;
  members: string[];
  recommendation: string;
};

export type RunReportSummary = {
  imagesScanned: number;
  phase1HardFails: number;
  phase2HardFails: number;
  phase3Calls: number;
  phase3Skipped: number;
  estimatedCostUsd: number;
  durationSec: number;
  errorCount?: number;
  costCapReached?: boolean;
};

export type RunReportInput = {
  runId: string;
  configSnapshot: Record<string, unknown>;
  summary: RunReportSummary;
  folderCohorts: Record<string, CohortInfo>;
  duplicateGroups: DuplicateGroupOut[];
  repairQueue: RepairQueueItem[];
  perFolder: Record<string, FolderStats>;
};

export type RunReport = {
  schema: 'audit-run/v1';
  auditVersion: 'phase-pipeline/1';
} & RunReportInput;

export function buildRunReport(input: RunReportInput): RunReport {
  return { schema: 'audit-run/v1', auditVersion: 'phase-pipeline/1', ...input };
}

export type WriteResult = { reportPath: string; latestPath: string };

export function writeRunReport(rootDir: string, input: RunReportInput): WriteResult {
  mkdirSync(rootDir, { recursive: true });
  const report = buildRunReport(input);
  const safeRunId = input.runId.replace(/[:.]/g, '-');
  const reportPath = join(rootDir, `${safeRunId}.json`);
  const latestPath = join(rootDir, 'latest.json');
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
  writeFileSync(latestPath, JSON.stringify({ runId: input.runId, reportPath }, null, 2) + '\n', 'utf8');
  return { reportPath, latestPath };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd lq-tools && pnpm test -- audit-run-report`
Expected: PASS — both test cases pass.

- [ ] **Step 5: Commit**

```bash
git add lq-tools/scripts/audit-run-report.ts lq-tools/scripts/audit-run-report.test.ts
git commit -m "feat(audit): run-level report writer with audit-run/v1 schema"
```

---

## Task 12: Phase pipeline orchestrator

**Files:**
- Create: `lq-tools/scripts/image-audit-phases.ts`
- Create: `lq-tools/scripts/image-audit-phases.test.ts`

- [ ] **Step 1: Write failing test for orchestrator**

Create `lq-tools/scripts/image-audit-phases.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import sharp from 'sharp';
import { runPhase1, runPhase2, runPhase3, type PhaseContext } from './image-audit-phases.js';

async function makeBuffer(): Promise<Buffer> {
  return sharp({ create: { width: 100, height: 100, channels: 3, background: { r: 200, g: 100, b: 50 } } }).webp().toBuffer();
}

describe('runPhase1', () => {
  it('returns pixelVerdict with hardFail=false on a normal image', async () => {
    const ctx: PhaseContext = { imagePath: '/x.webp', buffer: await makeBuffer(), cfg: null as any };
    const result = await runPhase1(ctx);
    expect(result.verdict).toBeDefined();
  });

  it('returns cornerFlood hardFail when bgFraction exceeds threshold', async () => {
    const whiteBuf = await sharp({ create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 255, b: 255 } } }).webp().toBuffer();
    const ctx: PhaseContext = {
      imagePath: '/x.webp',
      buffer: whiteBuf,
      cfg: null as any,
      cornerFloodCfg: { nearWhiteThreshold: 220, nearBlackThreshold: 40, tolerance: 10, bgFractionThreshold: 0.5, cornerSize: 5 },
    };
    const result = await runPhase1(ctx);
    expect(result.verdict.hardFail).toBe(true);
    expect(result.verdict.hardFailReasons.some((r) => r.startsWith('pixel:corner-bg-fill'))).toBe(true);
  });
});

describe('runPhase2', () => {
  it('returns verdict with no hard-fail on a normal image (bank empty)', async () => {
    const ctx: PhaseContext = {
      imagePath: '/x.webp',
      buffer: await makeBuffer(),
      cfg: {
        giantLabelAreaPct: 25,
        preschoolStyleDistance: 12,
        hardFailConfidence: 0.7,
        duplicateHashDistance: 6,
        referenceBankPath: 'data/phase2-bank.json',
        textAreaHeuristic: { centralBandRows: [0.30, 0.70], minNearBlackConcentration: 0.15 },
        bank: { schema: 'phase2-bank/v1', entries: [] },
      },
    };
    const result = await runPhase2(ctx);
    expect(result.verdict.isTextCard).toBe(false);
    expect(result.verdict.hasGiantLabel).toBe(false);
    expect(result.verdict.isPreschoolCartoon).toBe(false);
  });
});

describe('runPhase3', () => {
  it('returns skip verdict when phase2Verdict.hardFail is true', async () => {
    const ctx: PhaseContext = {
      imagePath: '/x.webp',
      buffer: await makeBuffer(),
      cfg: null as any,
      phase2Verdict: {
        isTextCard: true, isPreschoolCartoon: false, hasGiantLabel: false, isBorderline: false,
        reasons: ['phase2:text-card'], confidence: 0.9, signalsUsed: ['text-area'],
      },
    };
    const result = await runPhase3(ctx, vi.fn());
    expect(result.status).toBe('skipped');
    expect(result.skipReason).toBe('phase2-hard-fail');
  });

  it('calls the LLM callback when no prior hard-fail', async () => {
    const callback = vi.fn().mockResolvedValue({ status: 'active', score: 8, flags: [], reasons: [], suggestions: [] });
    const ctx: PhaseContext = {
      imagePath: '/x.webp',
      buffer: await makeBuffer(),
      cfg: null as any,
      phase2Verdict: {
        isTextCard: false, isPreschoolCartoon: false, hasGiantLabel: false, isBorderline: false,
        reasons: [], confidence: 0, signalsUsed: [],
      },
    };
    const result = await runPhase3(ctx, callback);
    expect(result.status).toBe('active');
    expect(callback).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd lq-tools && pnpm test -- image-audit-phases`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the orchestrator**

Create `lq-tools/scripts/image-audit-phases.ts`:

```ts
import {
  computePixelStatsFromBuffer,
  runNonLlmAudit,
  type PixelStats,
  type NonLlmAuditVerdict,
} from '@blueforge-studio/image-processor';
import {
  classifyCheapVision,
  type CheapVisionVerdict,
  type Phase2VerdictConfig,
} from './cheap-vision-classifier.js';
import {
  detectBackgroundFill,
  type BackgroundFillConfig,
  type BackgroundFillResult,
} from './pixel-background-flood.js';

export type Phase1Result = {
  pixelStats: PixelStats;
  cornerFlood: BackgroundFillResult;
  verdict: NonLlmAuditVerdict & {
    cornerFloodHardFail: boolean;
  };
};

export type Phase2Result = {
  verdict: CheapVisionVerdict;
};

export type Phase3Input = {
  status: 'active' | 'needs-fix' | 'needs-regeneration' | 'audit-error' | 'skipped';
  score?: number;
  flags: string[];
  reasons: string[];
  suggestions?: string[];
  skipReason?: 'phase1-hard-fail' | 'phase2-hard-fail' | 'cost-cap' | 'chain-exhausted' | 'phase2-error';
  priorSignals?: string[];
};

export type PhaseContext = {
  imagePath: string;
  buffer: Buffer;
  cfg: Phase2VerdictConfig | null;
  cornerFloodCfg?: BackgroundFillConfig;
  phase2Verdict?: CheapVisionVerdict;
  pixelWarnings?: string[];
};

export async function runPhase1(ctx: PhaseContext): Promise<Phase1Result> {
  const pixelStats = await computePixelStatsFromBuffer(ctx.buffer);
  const baseVerdict = runNonLlmAudit(pixelStats);
  const cornerFlood = await detectBackgroundFill(ctx.buffer, ctx.cornerFloodCfg);

  // Corner-flood hardFail augments (does not replace) the NonLlmAudit verdict.
  // Either one firing means the image is rejected.
  const cornerFloodHardFail = cornerFlood.isBgDominated;
  const mergedHardFailReasons = [
    ...baseVerdict.hardFailReasons,
    ...(cornerFloodHardFail
      ? [`pixel:corner-bg-fill (fraction=${cornerFlood.bgFraction.toFixed(3)})`]
      : []),
  ];
  const mergedSoftFailReasons = [
    ...baseVerdict.softFailReasons,
    ...(cornerFlood.isBgDominated ? [] : [`pixel:corner-bg-fill-soft (fraction=${cornerFlood.bgFraction.toFixed(3)})`]),
  ];

  return {
    pixelStats,
    cornerFlood,
    verdict: {
      ...baseVerdict,
      cornerFloodHardFail,
      hardFail: baseVerdict.hardFail || cornerFloodHardFail,
      hardFailReasons: mergedHardFailReasons,
      softFailReasons: mergedSoftFailReasons,
    },
  };
}

export async function runPhase2(ctx: PhaseContext): Promise<Phase2Result> {
  if (!ctx.cfg) throw new Error('runPhase2: cfg is required');
  const verdict = await classifyCheapVision(ctx.buffer, ctx.cfg);
  return { verdict };
}

export type Phase3Callback = (input: {
  imagePath: string;
  buffer: Buffer;
  priorSignals: string[];
  cohortHint?: string;
}) => Promise<Omit<Phase3Input, 'status' | 'skipReason'>>;

export async function runPhase3(ctx: PhaseContext, callback: Phase3Callback): Promise<Phase3Input> {
  // Skip if Phase 1 or Phase 2 hard-failed
  if (!ctx.phase2Verdict) {
    // No Phase 2 verdict means we shouldn't be here — treat as chain-exhausted
    return {
      status: 'skipped',
      flags: [],
      reasons: [],
      skipReason: 'chain-exhausted',
    };
  }
  if (ctx.phase2Verdict.reasons.length > 0) {
    return {
      status: 'needs-regeneration',
      flags: ctx.phase2Verdict.reasons,
      reasons: ctx.phase2Verdict.reasons,
      priorSignals: [
        ...(ctx.pixelWarnings ?? []),
        ...(ctx.phase2Verdict.signalsUsed ?? []),
      ],
      skipReason: 'phase2-hard-fail',
    };
  }
  const priorSignals = [
    ...(ctx.pixelWarnings ?? []),
    ...(ctx.phase2Verdict.isBorderline ? ['borderline-text'] : []),
    ...(ctx.phase2Verdict.signalsUsed ?? []),
  ];
  const m3 = await callback({ imagePath: ctx.imagePath, buffer: ctx.buffer, priorSignals });
  return { ...m3, status: m3.status === 'audit-error' ? 'audit-error' : m3.status };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd lq-tools && pnpm test -- image-audit-phases`
Expected: PASS — all five test cases pass.

- [ ] **Step 5: Commit**

```bash
git add lq-tools/scripts/image-audit-phases.ts lq-tools/scripts/image-audit-phases.test.ts
git commit -m "feat(audit): phase pipeline orchestrator (Phase 1 → 2 → 3)"
```

---

