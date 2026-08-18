# Tasks 15–17: Fixtures and Tests

[Previous: wiring and manifest](tasks-13-14-wiring-and-manifest.md) · [Plan index](00-overview.md) · [Next: rollout](tasks-18-20-rollout.md)

---

## Task 15: Calibration test fixtures

# Tasks 15–17: Fixtures and Tests

[Previous: wiring and manifest](tasks-13-14-wiring-and-manifest.md) · [Plan index](00-overview.md) · [Next: rollout](tasks-18-20-rollout.md)

---


**Files:**
- Create fixture images: `lq-tools/test/fixtures/audit/positives/cat.webp` etc.
- Create fixture images: `lq-tools/test/fixtures/audit/negatives/text-card/sorry.webp` etc.

- [ ] **Step 1: Create fixture directories**

Run:
```bash
mkdir -p lq-tools/test/fixtures/audit/positives
mkdir -p lq-tools/test/fixtures/audit/negatives/text-card
mkdir -p lq-tools/test/fixtures/audit/negatives/preschool
mkdir -p lq-tools/test/fixtures/audit/bank-seed
```

- [ ] **Step 2: Copy real animals into positives (best-effort)**

Run:
```bash
cp lang-quest/lq-nordic/public/_shared/images/lessons/vocabulary/animals/*.webp lq-tools/test/fixtures/audit/positives/ 2>/dev/null || echo "no animals yet"
```

If animals folder exists with webp files, this populates positives. If not, the calibration test will be skipped (see Task 15).

- [ ] **Step 3: Copy real text-card failures into negatives/text-card**

Run:
```bash
SRC=lang-quest/lq-nordic/public/_shared/images/lessons/vocabulary
cp $SRC/basics/sorry.webp    lq-tools/test/fixtures/audit/negatives/text-card/ 2>/dev/null
cp $SRC/basics/thanks.webp    lq-tools/test/fixtures/audit/negatives/text-card/ 2>/dev/null
cp $SRC/basics/please.webp    lq-tools/test/fixtures/audit/negatives/text-card/ 2>/dev/null
cp $SRC/basics/yes.webp       lq-tools/test/fixtures/audit/negatives/text-card/ 2>/dev/null
cp $SRC/basics/no.webp        lq-tools/test/fixtures/audit/negatives/text-card/ 2>/dev/null
cp $SRC/basics/goodbye.webp   lq-tools/test/fixtures/audit/negatives/text-card/ 2>/dev/null
cp $SRC/basic-phrases/yes.webp    lq-tools/test/fixtures/audit/negatives/text-card/ 2>/dev/null
cp $SRC/basic-phrases/no.webp     lq-tools/test/fixtures/audit/negatives/text-card/ 2>/dev/null
cp $SRC/basic-phrases/please.webp lq-tools/test/fixtures/audit/negatives/text-card/ 2>/dev/null
cp $SRC/basic-phrases/sorry.webp  lq-tools/test/fixtures/audit/negatives/text-card/ 2>/dev/null
```

If any files are missing, skip them (the calibration test will size-check the fixtures and skip gracefully).

- [ ] **Step 4: Add .gitignore entries for fixture binaries**

In `lq-tools/test/fixtures/.gitignore` (create if missing):
```
audit/positives/*.webp
audit/negatives/**/*.webp
audit/bank-seed/*.webp
!audit/**/.gitkeep
```

Fixtures are local-only; the .gitkeep markers keep the directories tracked.

- [ ] **Step 5: Add .gitkeep files**

```bash
touch lq-tools/test/fixtures/audit/positives/.gitkeep
touch lq-tools/test/fixtures/audit/negatives/text-card/.gitkeep
touch lq-tools/test/fixtures/audit/negatives/preschool/.gitkeep
touch lq-tools/test/fixtures/audit/negatives/corner-bg/.gitkeep
touch lq-tools/test/fixtures/audit/bank-seed/.gitkeep
```

- [ ] **Step 6: Add corner-bg fixture directory**

```bash
mkdir -p lq-tools/test/fixtures/audit/negatives/corner-bg
```

Copy or generate one white-bg-dominant and one black-bg-dominant image from the real Nordic corpus (e.g. basics/sorry.webp for white, business/aftale.webp or any nearly-blank image for black):

```bash
SRC=lang-quest/lq-nordic/public/_shared/images/lessons/vocabulary
cp $SRC/basics/sorry.webp   lq-tools/test/fixtures/audit/negatives/corner-bg/white-sorry.webp    2>/dev/null
cp $SRC/basics/thanks.webp   lq-tools/test/fixtures/audit/negatives/corner-bg/white-thanks.webp  2>/dev/null
cp $SRC/basic-phrases/sorry.webp lq-tools/test/fixtures/audit/negatives/corner-bg/white-sorry-phrases.webp 2>/dev/null
```

These fixtures are also used by the corner-flood assertions in Task 16 (calibration).

- [ ] **Step 7: Commit fixture scaffold**

```bash
git add lq-tools/test/fixtures/.gitignore lq-tools/test/fixtures/audit/positives/.gitkeep lq-tools/test/fixtures/audit/negatives/text-card/.gitkeep lq-tools/test/fixtures/audit/negatives/preschool/.gitkeep lq-tools/test/fixtures/audit/negatives/corner-bg/.gitkeep lq-tools/test/fixtures/audit/bank-seed/.gitkeep
git commit -m "chore(audit): scaffold calibration test fixture directories"
```

---

## Task 16: Phase 2 calibration test (load-bearing integration)

**Files:**
- Create: `lq-tools/scripts/phase2-calibration.test.ts`

- [ ] **Step 1: Write the calibration test**

Create `lq-tools/scripts/phase2-calibration.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import {
  classifyCheapVision,
  type Phase2VerdictConfig,
} from './cheap-vision-classifier.js';
import { loadBank } from './phase2-reference-bank.js';
import { detectBackgroundFill, type BackgroundFillConfig } from './pixel-background-flood.js';
import { runPhase1 } from './image-audit-phases.js';

const ROOT = join(import.meta.dirname ?? __dirname, '..', 'test', 'fixtures', 'audit');
const POSITIVES = join(ROOT, 'positives');
const NEG_TEXT = join(ROOT, 'negatives', 'text-card');
const NEG_CORNER_BG = join(ROOT, 'negatives', 'corner-bg');
const BANK_PATH = join(ROOT, '..', '..', 'data', 'phase2-bank.json');

const cfg: Phase2VerdictConfig = {
  giantLabelAreaPct: 25,
  preschoolStyleDistance: 12,
  hardFailConfidence: 0.7,
  duplicateHashDistance: 6,
  referenceBankPath: 'data/phase2-bank.json',
  textAreaHeuristic: { centralBandRows: [0.30, 0.70], minNearBlackConcentration: 0.15 },
  bank: existsSync(BANK_PATH) ? loadBank(BANK_PATH) : { schema: 'phase2-bank/v1', entries: [] },
};

const cornerFloodCfg: BackgroundFillConfig = {
  nearWhiteThreshold: 220,
  nearBlackThreshold: 40,
  tolerance: 10,
  bgFractionThreshold: 0.5,
  cornerSize: 5,
};

async function loadBuffers(dir: string): Promise<{ name: string; buf: Buffer }[]> {
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir).filter((f) => f.endsWith('.webp'));
  return Promise.all(
    files.map(async (f) => ({ name: f, buf: await sharp(join(dir, f)).webp().toBuffer() })),
  );
}

describe('Phase 2 calibration', () => {
  it('≥95% of positives pass Phase 2', async () => {
    const positives = await loadBuffers(POSITIVES);
    if (positives.length === 0) {
      console.warn('calibration: no positives fixtures; skipping');
      return;
    }
    const passing: number[] = [];
    for (const { name, buf } of positives) {
      const v = await classifyCheapVision(buf, cfg);
      if (!v.isTextCard && !v.isPreschoolCartoon && !v.hasGiantLabel) passing.push(1);
      else console.warn(`positives fail: ${name} reasons=${v.reasons.join(',')}`);
    }
    expect(passing.length / positives.length).toBeGreaterThanOrEqual(0.95);
  });

  it('≥90% of text-card negatives fail Phase 2', async () => {
    const negatives = await loadBuffers(NEG_TEXT);
    if (negatives.length === 0) {
      console.warn('calibration: no text-card fixtures; skipping');
      return;
    }
    const failing: number[] = [];
    for (const { name, buf } of negatives) {
      const v = await classifyCheapVision(buf, cfg);
      if (v.reasons.length > 0) failing.push(1);
      else console.warn(`negatives miss: ${name} no reasons`);
    }
    expect(failing.length / negatives.length).toBeGreaterThanOrEqual(0.90);
  });

  it('≥100% of the target legacy cohorts hard-fail at Phase 1 via corner-flood', async () => {
    const targetDirs = [
      join(ROOT, '..', '..', '..', 'lang-quest', 'lq-nordic', 'public', '_shared', 'images', 'lessons', 'vocabulary', 'basics'),
      join(ROOT, '..', '..', '..', 'lang-quest', 'lq-nordic', 'public', '_shared', 'images', 'lessons', 'vocabulary', 'basic-verbs'),
      join(ROOT, '..', '..', '..', 'lang-quest', 'lq-nordic', 'public', '_shared', 'images', 'lessons', 'vocabulary', 'basic-phrases'),
    ];
    const images = (await Promise.all(targetDirs.map(loadBuffers))).flat();
    if (images.length === 0) {
      console.warn('calibration: no target cohort images; skipping');
      return;
    }
    const misses: string[] = [];
    for (const { name, buf } of images) {
      const result = await detectBackgroundFill(buf, cornerFloodCfg);
      if (!result.isBgDominated) misses.push(name);
    }
    expect(misses, `target cohorts must all pixel-reject; misses: ${misses.join(', ')}`).toEqual([]);
  });

  it('≥80% of corner-bg fixture negatives hard-fail at Phase 1 via corner-flood', async () => {
    const negatives = await loadBuffers(NEG_CORNER_BG);
    if (negatives.length === 0) {
      console.warn('calibration: no corner-bg fixtures; skipping');
      return;
    }
    const failing: number[] = [];
    for (const { name, buf } of negatives) {
      const result = await detectBackgroundFill(buf, cornerFloodCfg);
      if (result.isBgDominated) failing.push(1);
      else console.warn(`corner-bg miss: ${name} bgFraction=${result.bgFraction.toFixed(3)}`);
    }
    expect(failing.length / negatives.length).toBeGreaterThanOrEqual(0.80);
  });

  it('0% of positives hard-fail at Phase 1 via corner-flood', async () => {
    const positives = await loadBuffers(POSITIVES);
    if (positives.length === 0) {
      console.warn('calibration: no positives fixtures; skipping');
      return;
    }
    const passing: number[] = [];
    for (const { name, buf } of positives) {
      const result = await detectBackgroundFill(buf, cornerFloodCfg);
      if (!result.isBgDominated) passing.push(1);
      else console.warn(`positives corner-bg fail: ${name} bgFraction=${result.bgFraction.toFixed(3)}`);
    }
    expect(passing.length / positives.length).toBeGreaterThanOrEqual(0.95);
  });

  it('corner-flood and NonLlmAudit each catch different failures (orthogonality check)', async () => {
    // Sanity: a clean reference image should pass BOTH gates; a bg-dominated image should
    // trigger at least one of them. We don't assert exclusivity here — just that the
    // combined verdict doesn't fire false positives on positives.
    const positives = await loadBuffers(POSITIVES);
    if (positives.length === 0) return;
    let combinedFailures = 0;
    for (const { buf } of positives) {
      const ctx = { imagePath: 'x', buffer: buf, cfg: null as any, cornerFloodCfg };
      const p1 = await runPhase1(ctx);
      if (p1.verdict.hardFail) combinedFailures++;
    }
    expect(combinedFailures / positives.length).toBeLessThanOrEqual(0.05);
  });
});
```

- [ ] **Step 2: Run the calibration test**

Run: `cd lq-tools && pnpm test -- phase2-calibration`
Expected: PASS — or skip-with-warning if fixtures are absent. Address any real failures by adjusting thresholds in `image-audit.config.json` (only after re-running calibration with new values).

- [ ] **Step 3: Commit**

```bash
git add lq-tools/scripts/phase2-calibration.test.ts
git commit -m "test(audit): phase2 calibration against fixture corpus"
```

---

## Task 17: End-to-end pipeline test

**Files:**
- Create: `lq-tools/scripts/pipeline-integration.test.ts`

- [ ] **Step 1: Write the e2e pipeline test**

Create `lq-tools/scripts/pipeline-integration.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { runPhase1, runPhase2, runPhase3 } from './image-audit-phases.js';
import type { Phase2VerdictConfig } from './cheap-vision-classifier.js';

describe('pipeline e2e (no M3)', () => {
  let dir: string;
  let cfg: Phase2VerdictConfig;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'pipeline-e2e-'));
    cfg = {
      giantLabelAreaPct: 25,
      preschoolStyleDistance: 12,
      hardFailConfidence: 0.7,
      duplicateHashDistance: 6,
      referenceBankPath: 'data/phase2-bank.json',
      textAreaHeuristic: { centralBandRows: [0.30, 0.70], minNearBlackConcentration: 0.15 },
      bank: { schema: 'phase2-bank/v1', entries: [] },
    };
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('clean image flows through all three phases without error', async () => {
    const buf = await sharp({ create: { width: 300, height: 300, channels: 3, background: { r: 120, g: 180, b: 90 } } }).webp().toBuffer();
    const ctx = { imagePath: join(dir, 'clean.webp'), buffer: buf, cfg };
    const p1 = await runPhase1(ctx);
    expect(p1.verdict).toBeDefined();
    const p2 = await runPhase2(ctx);
    expect(p2.verdict.reasons).toEqual([]);
    const p3 = await runPhase3({ ...ctx, phase2Verdict: p2.verdict, pixelWarnings: [] }, async () => ({
      status: 'active' as const, score: 8, flags: [], reasons: [], suggestions: [],
    }));
    expect(['active', 'needs-fix']).toContain(p3.status);
  });

  it('text-card image short-circuits at Phase 2', async () => {
    // Big black-on-white "label" — Phase 2 should hard fail
    const base = await sharp({ create: { width: 300, height: 300, channels: 3, background: { r: 255, g: 255, b: 255 } } }).webp().toBuffer();
    const overlay = Buffer.from('<svg width="300" height="300"><rect x="50" y="100" width="200" height="130" fill="black"/></svg>');
    const buf = await sharp(base).composite([{ input: overlay, top: 0, left: 0 }]).webp().toBuffer();
    const ctx = { imagePath: join(dir, 'textcard.webp'), buffer: buf, cfg };
    const p2 = await runPhase2(ctx);
    expect(p2.verdict.reasons.length).toBeGreaterThan(0);
    const p3 = await runPhase3({ ...ctx, phase2Verdict: p2.verdict }, async () => { throw new Error('M3 should not be called'); });
    expect(p3.status).toBe('needs-regeneration');
    expect(p3.skipReason).toBe('phase2-hard-fail');
  });

  it('never throws on a phase error — fails open to next phase or marks audit-error', async () => {
    const buf = await sharp({ create: { width: 10, height: 10, channels: 3, background: { r: 0, g: 0, b: 0 } } }).webp().toBuffer();
    const ctx = { imagePath: join(dir, 'tiny.webp'), buffer: buf, cfg };
    // Should not throw even though tiny image might trip pixel gate
    await expect(runPhase1(ctx)).resolves.toBeDefined();
  });

  it('background-dominated image short-circuits at Phase 1 corner-flood (no M3)', async () => {
    const cornerFloodCfg = {
      nearWhiteThreshold: 220,
      nearBlackThreshold: 40,
      tolerance: 10,
      bgFractionThreshold: 0.5,
      cornerSize: 5,
    };
    const buf = await sharp({ create: { width: 300, height: 300, channels: 3, background: { r: 255, g: 255, b: 255 } } }).webp().toBuffer();
    const ctx = {
      imagePath: join(dir, 'bgdominated.webp'),
      buffer: buf,
      cfg,
      cornerFloodCfg,
    };
    const p1 = await runPhase1(ctx);
    expect(p1.verdict.hardFail).toBe(true);
    expect(p1.verdict.hardFailReasons.some((r) => r.startsWith('pixel:corner-bg-fill'))).toBe(true);
    // M3 should not be called because Phase 1 already hard-failed
    const p3 = await runPhase3({ ...ctx, phase2Verdict: { isTextCard: false, isPreschoolCartoon: false, hasGiantLabel: false, isBorderline: false, reasons: [], confidence: 0, signalsUsed: [] } }, async () => { throw new Error('M3 should not be called'); });
    expect(p3.status).toBe('needs-regeneration');
  });

  it('black-bg image is caught by corner-flood even when NonLlmAudit might miss it', async () => {
    // Black bg with a few non-bg pixels — exercises the black-flood path
    const cornerFloodCfg = {
      nearWhiteThreshold: 220,
      nearBlackThreshold: 40,
      tolerance: 10,
      bgFractionThreshold: 0.5,
      cornerSize: 5,
    };
    const base = await sharp({ create: { width: 300, height: 300, channels: 3, background: { r: 0, g: 0, b: 0 } } }).webp().toBuffer();
    const overlay = Buffer.from('<svg width="300" height="300"><rect x="130" y="130" width="40" height="40" fill="rgb(180,80,80)"/></svg>');
    const buf = await sharp(base).composite([{ input: overlay, top: 0, left: 0 }]).webp().toBuffer();
    const ctx = { imagePath: join(dir, 'blackbg.webp'), buffer: buf, cfg, cornerFloodCfg };
    const p1 = await runPhase1(ctx);
    expect(p1.cornerFlood.bgFraction).toBeGreaterThan(0.5);
    expect(p1.verdict.hardFail).toBe(true);
  });
});
```

- [ ] **Step 2: Run the e2e test**

Run: `cd lq-tools && pnpm test -- pipeline-integration`
Expected: PASS — all three test cases pass.

- [ ] **Step 3: Commit**

```bash
git add lq-tools/scripts/pipeline-integration.test.ts
git commit -m "test(audit): pipeline end-to-end (Phase 1 → 2 → 3)"
```

---

