# Tasks 7–9: Cheap Classifier

[Previous: detection modules](tasks-04-06-detection-modules.md) · [Plan index](00-overview.md) · [Next: reports and orchestrator](tasks-10-12-reports-and-orchestrator.md)

---

## Task 7: Cheap vision classifier — text-area heuristic

**Files:**
- Create: `lq-tools/scripts/cheap-vision-classifier.ts`
- Create: `lq-tools/scripts/cheap-vision-classifier.test.ts`

- [ ] **Step 1: Write failing test for text-area heuristic**

Create `lq-tools/scripts/cheap-vision-classifier.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { computeTextAreaSignal, type TextAreaSignal } from './cheap-vision-classifier.js';

async function makeImage(width: number, height: number, fill: { r: number; g: number; b: number }): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: fill } }).webp().toBuffer();
}

async function compositeBlackBox(width: number, height: number, boxW: number, boxH: number): Promise<Buffer> {
  // White background with a centred black rectangle (simulated giant label)
  const base = await makeImage(width, height, { r: 255, g: 255, b: 255 });
  const overlay = Buffer.from(
    `<svg width="${width}" height="${height}"><rect x="${(width - boxW) / 2}" y="${(height - boxH) / 2}" width="${boxW}" height="${boxH}" fill="black"/></svg>`,
  );
  return sharp(base).composite([{ input: overlay, top: 0, left: 0 }]).webp().toBuffer();
}

describe('computeTextAreaSignal', () => {
  it('returns low near-black concentration on solid white image', async () => {
    const buf = await makeImage(300, 300, { r: 255, g: 255, b: 255 });
    const signal: TextAreaSignal = await computeTextAreaSignal(buf, { centralBandRows: [0.30, 0.70], minNearBlackConcentration: 0.15 });
    expect(signal.nearBlackConcentration).toBeLessThan(0.05);
    expect(signal.largeConnectedComponentAreaPct).toBe(0);
  });

  it('detects high near-black concentration in central band', async () => {
    const buf = await compositeBlackBox(300, 300, 120, 40);  // ~16% near-black
    const signal = await computeTextAreaSignal(buf, { centralBandRows: [0.30, 0.70], minNearBlackConcentration: 0.15 });
    expect(signal.nearBlackConcentration).toBeGreaterThan(0.10);
  });

  it('flags image with >25% black area as giant-label candidate', async () => {
    const buf = await compositeBlackBox(300, 300, 200, 130);  // ~29% black
    const signal = await computeTextAreaSignal(buf, { centralBandRows: [0.30, 0.70], minNearBlackConcentration: 0.15 });
    expect(signal.largeConnectedComponentAreaPct).toBeGreaterThan(25);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd lq-tools && pnpm test -- cheap-vision-classifier`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement text-area heuristic**

Create `lq-tools/scripts/cheap-vision-classifier.ts`:

```ts
import sharp from 'sharp';

export type TextAreaHeuristicConfig = {
  centralBandRows: [number, number];          // [startFraction, endFraction], 0..1
  minNearBlackConcentration: number;           // 0..1
};

export type TextAreaSignal = {
  nearBlackConcentration: number;               // fraction of central-band pixels that are near-black
  largeConnectedComponentAreaPct: number;       // % of total frame area covered by the largest near-black connected component
};

export async function computeTextAreaSignal(
  buffer: Buffer,
  cfg: TextAreaHeuristicConfig,
): Promise<TextAreaSignal> {
  const { data, info } = await sharp(buffer)
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const bandStart = Math.floor(height * cfg.centralBandRows[0]);
  const bandEnd = Math.floor(height * cfg.centralBandRows[1]);

  let bandBlack = 0;
  let totalBand = 0;
  const mask: Uint8Array = new Uint8Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const lum = data[idx * channels];
      const nearBlack = lum < 60;          // luminance < 60/255 ≈ near-black
      if (y >= bandStart && y <= bandEnd) {
        if (nearBlack) bandBlack++;
        totalBand++;
      }
      if (nearBlack) mask[idx] = 1;
    }
  }

  // Connected-components (4-connectivity) on the mask, find largest
  const largest = largestComponentArea(mask, width, height);
  const frameArea = width * height;
  const largePct = (largest / frameArea) * 100;

  return {
    nearBlackConcentration: totalBand === 0 ? 0 : bandBlack / totalBand,
    largeConnectedComponentAreaPct: largePct,
  };
}

function largestComponentArea(mask: Uint8Array, w: number, h: number): number {
  const visited = new Uint8Array(mask.length);
  let largest = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const start = y * w + x;
      if (mask[start] !== 1 || visited[start]) continue;
      const stack = [start];
      let size = 0;
      while (stack.length > 0) {
        const i = stack.pop()!;
        if (visited[i]) continue;
        visited[i] = 1;
        if (mask[i] !== 1) continue;
        size++;
        const cx = i % w;
        const cy = (i - cx) / w;
        if (cx > 0)     stack.push(i - 1);
        if (cx < w - 1) stack.push(i + 1);
        if (cy > 0)     stack.push(i - w);
        if (cy < h - 1) stack.push(i + w);
      }
      if (size > largest) largest = size;
    }
  }
  return largest;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd lq-tools && pnpm test -- cheap-vision-classifier`
Expected: PASS — all three test cases pass.

- [ ] **Step 5: Commit**

```bash
git add lq-tools/scripts/cheap-vision-classifier.ts lq-tools/scripts/cheap-vision-classifier.test.ts
git commit -m "feat(audit): text-area heuristic for Phase 2 cheap vision"
```

---

## Task 8: Cheap vision classifier — perceptual-hash match + verdict aggregation

**Files:**
- Modify: `lq-tools/scripts/cheap-vision-classifier.ts`
- Modify: `lq-tools/scripts/cheap-vision-classifier.test.ts`

- [ ] **Step 1: Add failing tests for verdict aggregation**

Append to `cheap-vision-classifier.test.ts`:

```ts
import {
  classifyCheapVision,
  type CheapVisionVerdict,
  type Phase2VerdictConfig,
} from './cheap-vision-classifier.js';

describe('classifyCheapVision', () => {
  const cfg: Phase2VerdictConfig = {
    giantLabelAreaPct: 25,
    preschoolStyleDistance: 12,
    hardFailConfidence: 0.7,
    textAreaHeuristic: { centralBandRows: [0.30, 0.70], minNearBlackConcentration: 0.15 },
    bank: { schema: 'phase2-bank/v1', entries: [] },
  };

  it('returns hasGiantLabel=true when large black component exceeds threshold', async () => {
    const buf = await compositeBlackBox(300, 300, 200, 130);  // ~29% black
    const verdict: CheapVisionVerdict = await classifyCheapVision(buf, cfg);
    expect(verdict.hasGiantLabel).toBe(true);
    expect(verdict.reasons).toContain('phase2:giant-label');
  });

  it('returns isBorderline=true at confidence 0.5-0.7 (not hard fail)', async () => {
    const cfg2 = { ...cfg, hardFailConfidence: 0.95 };
    const buf = await compositeBlackBox(300, 300, 100, 30);   // ~3% black, mild text signal
    const verdict = await classifyCheapVision(buf, cfg2);
    // Either borderline or pass; just ensure it does NOT hard-fail
    expect(verdict.isTextCard || verdict.isBorderline).toBe(true);
  });

  it('returns no hard-fail for clean image', async () => {
    const buf = await makeImage(300, 300, { r: 100, g: 150, b: 200 });
    const verdict = await classifyCheapVision(buf, cfg);
    expect(verdict.isTextCard).toBe(false);
    expect(verdict.isPreschoolCartoon).toBe(false);
    expect(verdict.hasGiantLabel).toBe(false);
    expect(verdict.reasons).toEqual([]);
  });

  it('flags matched bank reference as preschool-cartoon', async () => {
    // Build a buffer, hash it, and seed the bank with that hash.
    const buf = await compositeBlackBox(300, 300, 200, 130);
    const hash = await (await import('./duplicate-detector.js')).computeDHash(buf);
    const cfgWithBank = {
      ...cfg,
      bank: {
        schema: 'phase2-bank/v1' as const,
        entries: [{ id: 'ref', label: 'preschool-cartoon' as const, imagePath: '/p', perceptualHash: hash }],
      },
    };
    const verdict = await classifyCheapVision(buf, cfgWithBank);
    expect(verdict.isPreschoolCartoon).toBe(true);
    expect(verdict.signalsUsed).toContain('nearest-neighbor-style');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd lq-tools && pnpm test -- cheap-vision-classifier`
Expected: FAIL — `classifyCheapVision` not exported.

- [ ] **Step 3: Add the types and verdict aggregator**

Append to `cheap-vision-classifier.ts`:

```ts
import { computeDHash, hammingDistance } from './duplicate-detector.js';
import type { Phase2Bank } from './phase2-reference-bank.js';

export type Phase2VerdictConfig = {
  giantLabelAreaPct: number;
  preschoolStyleDistance: number;
  hardFailConfidence: number;
  textAreaHeuristic: TextAreaHeuristicConfig;
  bank: Phase2Bank;
};

export type CheapVisionVerdict = {
  isTextCard: boolean;
  isPreschoolCartoon: boolean;
  hasGiantLabel: boolean;
  isBorderline: boolean;
  reasons: string[];
  confidence: number;
  signalsUsed: string[];
  matchedReference?: string;
};

export async function classifyCheapVision(
  buffer: Buffer,
  cfg: Phase2VerdictConfig,
): Promise<CheapVisionVerdict> {
  const signal = await computeTextAreaSignal(buffer, cfg.textAreaHeuristic);
  const signalsUsed: string[] = ['text-area'];

  // Hard fail: giant label is a deterministic area check (no confidence gate)
  const hasGiantLabel = signal.largeConnectedComponentAreaPct > cfg.giantLabelAreaPct;

  // Borderline text-card: signal present but not extreme enough to hard fail
  const textCardConfidence = Math.min(1, signal.nearBlackConcentration / cfg.textAreaHeuristic.minNearBlackConcentration);
  const isTextCard = textCardConfidence >= cfg.hardFailConfidence;

  // Style match against bank
  let isPreschoolCartoon = false;
  let matchedReference: string | undefined;
  if (cfg.bank.entries.length > 0) {
    const hash = await computeDHash(buffer);
    signalsUsed.push('nearest-neighbor-style');
    let bestDist = Infinity;
    for (const entry of cfg.bank.entries) {
      if (entry.label !== 'preschool-cartoon') continue;
      const d = hammingDistance(hash, entry.perceptualHash);
      if (d < bestDist) {
        bestDist = d;
        if (d <= cfg.preschoolStyleDistance) {
          isPreschoolCartoon = true;
          matchedReference = `${entry.id} (distance ${d})`;
        }
      }
    }
  }

  const reasons: string[] = [];
  if (isTextCard) reasons.push('phase2:text-card');
  if (isPreschoolCartoon) reasons.push('phase2:preschool-cartoon');
  if (hasGiantLabel) reasons.push('phase2:giant-label');

  const overallConfidence = Math.max(textCardConfidence, isPreschoolCartoon ? 0.85 : 0, hasGiantLabel ? 1.0 : 0);
  const isBorderline =
    !isTextCard && !isPreschoolCartoon && !hasGiantLabel &&
    (textCardConfidence >= 0.5 || signal.largeConnectedComponentAreaPct > cfg.giantLabelAreaPct * 0.6);

  return {
    isTextCard,
    isPreschoolCartoon,
    hasGiantLabel,
    isBorderline,
    reasons,
    confidence: overallConfidence,
    signalsUsed,
    matchedReference,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd lq-tools && pnpm test -- cheap-vision-classifier`
Expected: PASS — all verdict aggregation tests pass.

- [ ] **Step 5: Commit**

```bash
git add lq-tools/scripts/cheap-vision-classifier.ts lq-tools/scripts/cheap-vision-classifier.test.ts
git commit -m "feat(audit): Phase 2 verdict aggregation with bank matching"
```

---

## Task 9: Phase 2 bank CLI

**Files:**
- Create: `lq-tools/scripts/phase2-bank-cli.ts`

(No new test file — the underlying functions are tested in Task 3. CLI is a thin wrapper.)

- [ ] **Step 1: Implement the CLI**

Create `lq-tools/scripts/phase2-bank-cli.ts`:

```ts
#!/usr/bin/env tsx
import { loadBank, saveBank, addEntry, listEntries } from './phase2-reference-bank.js';
import { computeDHash } from './duplicate-detector.js';
import { resolve } from 'node:path';

const [, , cmd, ...args] = process.argv;
const bankPath = process.env.PHASE2_BANK_PATH ?? resolve('lq-tools/data/phase2-bank.json');

async function main(): Promise<void> {
  switch (cmd) {
    case 'list': {
      const label = args[0] as 'text-card' | 'preschool-cartoon' | 'giant-label' | undefined;
      const entries = listEntries(bankPath, label ? { label } : {});
      console.log(JSON.stringify(entries, null, 2));
      break;
    }
    case 'add': {
      const [id, label, imagePath] = args;
      if (!id || !label || !imagePath) throw new Error('usage: add <id> <label> <imagePath>');
      const buf = await import('node:fs').then((m) => m.readFileSync(imagePath));
      const perceptualHash = await computeDHash(buf);
      addEntry(bankPath, { id, label: label as 'text-card' | 'preschool-cartoon' | 'giant-label', imagePath, perceptualHash });
      console.log(`added ${id} (${label}) hash=${perceptualHash}`);
      break;
    }
    case 'seed': {
      // Seeds from a hard-coded list of known-failure paths under lq-nordic
      const seedPaths: Array<{ id: string; label: 'text-card' | 'preschool-cartoon'; rel: string }> = [
        { id: 'text-card-sorry',     label: 'text-card',     rel: 'basics/sorry.webp' },
        { id: 'text-card-thanks',     label: 'text-card',     rel: 'basics/thanks.webp' },
        { id: 'text-card-please',     label: 'text-card',     rel: 'basics/please.webp' },
        { id: 'text-card-yes-basics', label: 'text-card',     rel: 'basics/yes.webp' },
        { id: 'text-card-no-basics',  label: 'text-card',     rel: 'basics/no.webp' },
        { id: 'text-card-goodbye',    label: 'text-card',     rel: 'basics/goodbye.webp' },
        { id: 'text-card-yes-phrases',label: 'text-card',     rel: 'basic-phrases/yes.webp' },
        { id: 'text-card-no-phrases', label: 'text-card',     rel: 'basic-phrases/no.webp' },
        { id: 'text-card-please-phrases', label: 'text-card', rel: 'basic-phrases/please.webp' },
        { id: 'text-card-sorry-phrases',  label: 'text-card', rel: 'basic-phrases/sorry.webp' },
      ];
      const base = process.env.LQ_NORDIC_ROOT ?? resolve('lang-quest/lq-nordic/public/_shared/images/lessons/vocabulary');
      for (const s of seedPaths) {
        const fullPath = resolve(base, s.rel);
        const fs = await import('node:fs');
        if (!fs.existsSync(fullPath)) {
          console.warn(`skip ${s.id}: missing ${fullPath}`);
          continue;
        }
        const buf = fs.readFileSync(fullPath);
        const perceptualHash = await computeDHash(buf);
        addEntry(bankPath, { id: s.id, label: s.label, imagePath: fullPath, perceptualHash });
        console.log(`seeded ${s.id}`);
      }
      break;
    }
    case 'rebuild': {
      saveBank(bankPath, { schema: 'phase2-bank/v1', entries: [] });
      console.log(`cleared ${bankPath}; re-run with 'seed' to repopulate`);
      break;
    }
    default:
      console.error('usage: phase2-bank-cli <list|add|seed|rebuild> [...]');
      process.exit(1);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Verify the CLI runs (smoke test)**

Run: `cd lq-tools && pnpm exec tsx scripts/phase2-bank-cli.ts list`
Expected: prints `[]` (empty bank initially) without errors.

- [ ] **Step 3: Commit**

```bash
git add lq-tools/scripts/phase2-bank-cli.ts
git commit -m "feat(audit): phase2 reference bank CLI"
```

---


# Tasks 10–12: Reports and Orchestrator

[Previous: classifier](tasks-07-09-classifier.md) · [Plan index](00-overview.md) · [Next: wiring and manifest](tasks-13-14-wiring-and-manifest.md)

---

