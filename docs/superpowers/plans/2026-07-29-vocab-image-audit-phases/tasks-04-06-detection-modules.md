# Tasks 4–6: Detection Modules

[Previous: config and bank](tasks-01-03-config-and-bank.md) · [Plan index](00-overview.md) · [Next: classifier](tasks-07-09-classifier.md)

---

## Task 4: 8-bit dHash implementation + duplicate detector

**Files:**
- Create: `lq-tools/scripts/duplicate-detector.ts`
- Create: `lq-tools/scripts/duplicate-detector.test.ts`

- [ ] **Step 1: Write failing test for dHash + clustering**

Create `lq-tools/scripts/duplicate-detector.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import {
  computeDHash,
  hammingDistance,
  clusterByHash,
  type DuplicateGroup,
} from './duplicate-detector.js';

async function makeImage(width: number, height: number, fill: { r: number; g: number; b: number }): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: fill },
  }).webp().toBuffer();
}

describe('dHash', () => {
  it('returns 16 hex chars (64-bit)', async () => {
    const buf = await makeImage(9, 8, { r: 128, g: 128, b: 128 });
    const hash = await computeDHash(buf);
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('is stable for identical buffers', async () => {
    const buf = await makeImage(9, 8, { r: 200, g: 100, b: 50 });
    const a = await computeDHash(buf);
    const b = await computeDHash(buf);
    expect(a).toBe(b);
  });

  it('differs for visually distinct images', async () => {
    const a = await makeImage(9, 8, { r: 255, g: 255, b: 255 });
    const b = await makeImage(9, 8, { r: 0, g: 0, b: 0 });
    const ha = await computeDHash(a);
    const hb = await computeDHash(b);
    expect(ha).not.toBe(hb);
  });
});

describe('hammingDistance', () => {
  it('returns 0 for identical hashes', () => {
    expect(hammingDistance('0000000000000000', '0000000000000000')).toBe(0);
  });

  it('counts bit differences correctly', () => {
    expect(hammingDistance('ffffffffffffffff', '0000000000000000')).toBe(64);
    expect(hammingDistance('ff00ff00ff00ff00', '00ff00ff00ff00ff')).toBe(64);
    expect(hammingDistance('0000000000000001', '0000000000000000')).toBe(1);
  });
});

describe('clusterByHash', () => {
  it('groups identical hashes', () => {
    const items = [
      { path: 'a', hash: '0000000000000000' },
      { path: 'b', hash: '0000000000000000' },
      { path: 'c', hash: 'ffffffffffffffff' },
    ];
    const groups = clusterByHash(items, 6);
    expect(groups).toHaveLength(1);
    expect(groups[0].members.map((m) => m.path).sort()).toEqual(['a', 'b']);
  });

  it('respects threshold boundary', () => {
    const items = [
      { path: 'a', hash: '0000000000000000' },
      { path: 'b', hash: '0000000000000003' },   // 2 bits different
      { path: 'c', hash: '00000000000000ff' },   // 8 bits different
    ];
    const tight = clusterByHash(items, 6);
    const loose = clusterByHash(items, 10);
    expect(tight[0].members).toHaveLength(2);   // a+b cluster, c alone
    expect(loose[0].members).toHaveLength(3);
  });

  it('groups cross-folder duplicates', () => {
    const items = [
      { path: 'basics/yes.webp',       hash: '0101010101010101' },
      { path: 'basic-phrases/yes.webp', hash: '0101010101010101' },
    ];
    const groups: DuplicateGroup[] = clusterByHash(items, 6);
    expect(groups).toHaveLength(1);
    expect(groups[0].members).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd lq-tools && pnpm test -- duplicate-detector`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement dHash + clustering**

Create `lq-tools/scripts/duplicate-detector.ts`:

```ts
import sharp from 'sharp';

const HASH_WIDTH = 9;
const HASH_HEIGHT = 8;

export async function computeDHash(buffer: Buffer): Promise<string> {
  const { data, info } = await sharp(buffer)
    .resize(HASH_WIDTH, HASH_HEIGHT, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let bits = '';
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width - 1; x++) {
      const left = data[y * info.width + x];
      const right = data[y * info.width + x + 1];
      bits += left > right ? '1' : '0';
    }
  }
  if (bits.length !== 64) throw new Error(`dHash produced ${bits.length} bits, expected 64`);
  return BigInt('0b' + bits).toString(16).padStart(16, '0');
}

export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) throw new Error('hash length mismatch');
  const ba = BigInt('0x' + a);
  const bb = BigInt('0x' + b);
  let x = ba ^ bb;
  let count = 0;
  while (x > 0n) {
    if (x & 1n) count++;
    x >>= 1n;
  }
  return count;
}

export type HashedItem = { path: string; hash: string };
export type DuplicateGroup = { hashDistance: number; members: HashedItem[] };

export function clusterByHash(items: HashedItem[], threshold: number): DuplicateGroup[] {
  // Union-find via single-link clustering at threshold
  const parent = items.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const union = (i: number, j: number) => { parent[find(i)] = find(j); };

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (hammingDistance(items[i].hash, items[j].hash) <= threshold) {
        union(i, j);
      }
    }
  }

  const buckets = new Map<number, HashedItem[]>();
  for (let i = 0; i < items.length; i++) {
    const root = find(i);
    if (!buckets.has(root)) buckets.set(root, []);
    buckets.get(root)!.push(items[i]);
  }

  return Array.from(buckets.values())
    .filter((members) => members.length > 1)
    .map((members) => {
      // hashDistance for the group = min pairwise distance
      let minDist = Infinity;
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          const d = hammingDistance(members[i].hash, members[j].hash);
          if (d < minDist) minDist = d;
        }
      }
      return { hashDistance: minDist, members };
    });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd lq-tools && pnpm test -- duplicate-detector`
Expected: PASS — all dHash and cluster tests pass.

- [ ] **Step 5: Commit**

```bash
git add lq-tools/scripts/duplicate-detector.ts lq-tools/scripts/duplicate-detector.test.ts
git commit -m "feat(audit): 8-bit dHash + duplicate clustering"
```

---

## Task 5: Pixel background corner-flood detector

**Files:**
- Create: `lq-tools/scripts/pixel-background-flood.ts`
- Create: `lq-tools/scripts/pixel-background-flood.test.ts`

- [ ] **Step 1: Write failing test for corner-flood detection**

Create `lq-tools/scripts/pixel-background-flood.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { detectBackgroundFill, type BackgroundFillConfig } from './pixel-background-flood.js';

async function makeImage(width: number, height: number, fill: { r: number; g: number; b: number }): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: fill } }).webp().toBuffer();
}

async function compositeCenterObject(
  width: number, height: number,
  bgColor: { r: number; g: number; b: number },
  objectColor: { r: number; g: number; b: number },
  objectW: number, objectH: number,
): Promise<Buffer> {
  const base = await makeImage(width, height, bgColor);
  const overlay = Buffer.from(
    `<svg width="${width}" height="${height}"><rect x="${(width - objectW) / 2}" y="${(height - objectH) / 2}" width="${objectW}" height="${objectH}" fill="rgb(${objectColor.r},${objectColor.g},${objectColor.b})"/></svg>`,
  );
  return sharp(base).composite([{ input: overlay, top: 0, left: 0 }]).webp().toBuffer();
}

const cfg: BackgroundFillConfig = {
  nearWhiteThreshold: 220,
  nearBlackThreshold: 40,
  tolerance: 10,
  bgFractionThreshold: 0.5,
  cornerSize: 5,
};

describe('detectBackgroundFill', () => {
  it('returns bgFraction ~1.0 on pure white image', async () => {
    const buf = await makeImage(300, 300, { r: 255, g: 255, b: 255 });
    const result = await detectBackgroundFill(buf, cfg);
    expect(result.bgFraction).toBeGreaterThan(0.95);
    expect(result.isBgDominated).toBe(true);
  });

  it('returns bgFraction ~1.0 on pure black image', async () => {
    const buf = await makeImage(300, 300, { r: 0, g: 0, b: 0 });
    const result = await detectBackgroundFill(buf, cfg);
    expect(result.bgFraction).toBeGreaterThan(0.95);
    expect(result.isBgDominated).toBe(true);
  });

  it('returns bgFraction ~0 on solid non-bg image', async () => {
    const buf = await makeImage(300, 300, { r: 120, g: 180, b: 90 });
    const result = await detectBackgroundFill(buf, cfg);
    expect(result.bgFraction).toBeLessThan(0.05);
    expect(result.isBgDominated).toBe(false);
  });

  it('returns bgFraction ~0.75 on white-bg image with central object', async () => {
    const buf = await compositeCenterObject(300, 300, { r: 255, g: 255, b: 255 }, { r: 100, g: 50, b: 200 }, 150, 150);
    const result = await detectBackgroundFill(buf, cfg);
    expect(result.bgFraction).toBeGreaterThan(0.6);
    expect(result.bgFraction).toBeLessThan(0.85);
    expect(result.isBgDominated).toBe(true);
  });

  it('handles black bg with white artifacts (common failure mode)', async () => {
    const buf = await compositeCenterObject(300, 300, { r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 }, 50, 50);
    const result = await detectBackgroundFill(buf, cfg);
    expect(result.bgFraction).toBeGreaterThan(0.85);
    expect(result.isBgDominated).toBe(true);
  });

  it('records per-corner details for traceability', async () => {
    const buf = await makeImage(300, 300, { r: 255, g: 255, b: 255 });
    const result = await detectBackgroundFill(buf, cfg);
    expect(result.cornerResults).toHaveLength(4);
    expect(result.cornerResults[0].corner).toBe('TL');
    expect(result.cornerResults[0].sampledColors).toContain('white');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd lq-tools && pnpm test -- pixel-background-flood`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the detector**

Create `lq-tools/scripts/pixel-background-flood.ts`:

```ts
import sharp from 'sharp';

export type BackgroundFillConfig = {
  nearWhiteThreshold: number;       // luminance ≥ this = "near-white"
  nearBlackThreshold: number;       // luminance ≤ this = "near-black"
  tolerance: number;                // ±band around the threshold
  bgFractionThreshold: number;      // 0..1; above this = isBgDominated
  cornerSize: number;               // pixels per side to sample at each corner
};

export const DEFAULT_BG_FILL_CONFIG: BackgroundFillConfig = {
  nearWhiteThreshold: 220,
  nearBlackThreshold: 40,
  tolerance: 10,
  bgFractionThreshold: 0.5,
  cornerSize: 5,
};

export type CornerResult = {
  corner: 'TL' | 'TR' | 'BL' | 'BR';
  sampledColors: ('white' | 'black')[];
  whiteArea: number;
  blackArea: number;
};

export type BackgroundFillResult = {
  bgPixelCount: number;
  bgFraction: number;
  isBgDominated: boolean;
  cornerResults: CornerResult[];
};

const CORNERS: ReadonlyArray<{ name: 'TL' | 'TR' | 'BL' | 'BR'; xOffset: 0 | 1; yOffset: 0 | 1 }> = [
  { name: 'TL', xOffset: 0, yOffset: 0 },
  { name: 'TR', xOffset: 1, yOffset: 0 },
  { name: 'BL', xOffset: 0, yOffset: 1 },
  { name: 'BR', xOffset: 1, yOffset: 1 },
];

export async function detectBackgroundFill(
  buffer: Buffer,
  cfg: BackgroundFillConfig = DEFAULT_BG_FILL_CONFIG,
): Promise<BackgroundFillResult> {
  const { data, info } = await sharp(buffer)
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const cs = cfg.cornerSize;

  const isBgPixel = new Uint8Array(width * height);
  const cornerResults: CornerResult[] = [];

  for (const c of CORNERS) {
    const xStart = c.xOffset === 0 ? 0 : width - cs;
    const yStart = c.yOffset === 0 ? 0 : height - cs;
    const cx = xStart + Math.floor(cs / 2);
    const cy = yStart + Math.floor(cs / 2);
    const cornerLum = data[(cy * width + cx) * channels];

    const isWhite = cornerLum >= cfg.nearWhiteThreshold - cfg.tolerance;
    const isBlack = cornerLum <= cfg.nearBlackThreshold + cfg.tolerance;

    let whiteArea = 0;
    let blackArea = 0;
    const visited = new Uint8Array(width * height);

    for (let dy = 0; dy < cs; dy++) {
      for (let dx = 0; dx < cs; dx++) {
        const sx = xStart + dx;
        const sy = yStart + dy;
        const startIdx = sy * width + sx;
        if (visited[startIdx]) continue;
        const lum = data[startIdx * channels];
        const matchesWhite = isWhite && lum >= cfg.nearWhiteThreshold - cfg.tolerance;
        const matchesBlack = isBlack && lum <= cfg.nearBlackThreshold + cfg.tolerance;
        if (!matchesWhite && !matchesBlack) continue;

        const stack: number[] = [startIdx];
        let size = 0;
        while (stack.length > 0) {
          const i = stack.pop()!;
          if (visited[i]) continue;
          visited[i] = 1;
          const l = data[i * channels];
          const mW = matchesWhite && l >= cfg.nearWhiteThreshold - cfg.tolerance;
          const mB = matchesBlack && l <= cfg.nearBlackThreshold + cfg.tolerance;
          if (!mW && !mB) continue;
          size++;
          isBgPixel[i] = 1;
          const px = i % width;
          const py = (i - px) / width;
          if (px > 0)         stack.push(i - 1);
          if (px < width - 1) stack.push(i + 1);
          if (py > 0)         stack.push(i - width);
          if (py < height - 1) stack.push(i + width);
        }
        if (matchesWhite) whiteArea += size;
        if (matchesBlack) blackArea += size;
      }
    }

    const sampledColors: ('white' | 'black')[] = [];
    if (isWhite) sampledColors.push('white');
    if (isBlack) sampledColors.push('black');

    cornerResults.push({ corner: c.name, sampledColors, whiteArea, blackArea });
  }

  let bgPixelCount = 0;
  for (let i = 0; i < isBgPixel.length; i++) bgPixelCount += isBgPixel[i];
  const frameArea = width * height;
  const bgFraction = bgPixelCount / frameArea;

  return {
    bgPixelCount,
    bgFraction,
    isBgDominated: bgFraction > cfg.bgFractionThreshold,
    cornerResults,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd lq-tools && pnpm test -- pixel-background-flood`
Expected: PASS — all six test cases pass.

- [ ] **Step 5: Commit**

```bash
git add lq-tools/scripts/pixel-background-flood.ts lq-tools/scripts/pixel-background-flood.test.ts
git commit -m "feat(audit): corner-flood background detector for Phase 1"
```

---

## Task 6: Folder cohort module

**Files:**
- Create: `lq-tools/scripts/folder-cohort.ts`
- Create: `lq-tools/scripts/folder-cohort.test.ts`

- [ ] **Step 1: Write failing test for cohort classification**

Create `lq-tools/scripts/folder-cohort.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { classifyCohort, parseFirstCommit, type Cohort } from './folder-cohort.js';

describe('classifyCohort', () => {
  it('classifies 2026-04-11 as thai-import', () => {
    expect(classifyCohort('2026-04-11T12:00:00Z')).toBe('thai-import');
  });

  it('classifies 2026-04-12 to 2026-04-13 as ch1-5-batch', () => {
    expect(classifyCohort('2026-04-12T00:00:00Z')).toBe('ch1-5-batch');
    expect(classifyCohort('2026-04-13T23:59:59Z')).toBe('ch1-5-batch');
  });

  it('classifies 2026-05-01 as later', () => {
    expect(classifyCohort('2026-05-01T00:00:00Z')).toBe('later');
  });

  it('classifies missing date as unknown', () => {
    expect(classifyCohort(null)).toBe('unknown');
  });
});

describe('parseFirstCommit', () => {
  it('parses git log output with one commit', () => {
    const log = `abc1234|2026-04-12T10:00:00+00:00|Add animals folder`;
    const parsed = parseFirstCommit(log);
    expect(parsed).toEqual({ sha: 'abc1234', date: '2026-04-12T10:00:00+00:00' });
  });

  it('returns null for empty log', () => {
    expect(parseFirstCommit('')).toBeNull();
  });
});

describe('Cohort type', () => {
  it('is a closed union of literal strings', () => {
    const c: Cohort = 'thai-import';
    expect(c).toBe('thai-import');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd lq-tools && pnpm test -- folder-cohort`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement cohort classifier**

Create `lq-tools/scripts/folder-cohort.ts`:

```ts
export type Cohort = 'thai-import' | 'ch1-5-batch' | 'later' | 'unknown';

const THAI_IMPORT_DAY = '2026-04-11';
const CH1_5_START = '2026-04-12';
const CH1_5_END = '2026-04-13';

export function classifyCohort(isoDate: string | null): Cohort {
  if (!isoDate) return 'unknown';
  const day = isoDate.slice(0, 10); // YYYY-MM-DD prefix
  if (day === THAI_IMPORT_DAY) return 'thai-import';
  if (day >= CH1_5_START && day <= CH1_5_END) return 'ch1-5-batch';
  return 'later';
}

export type FirstCommit = { sha: string; date: string };

export function parseFirstCommit(gitLogOutput: string): FirstCommit | null {
  const firstLine = gitLogOutput.split('\n')[0]?.trim();
  if (!firstLine) return null;
  const [sha, date] = firstLine.split('|');
  if (!sha || !date) return null;
  return { sha, date };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd lq-tools && pnpm test -- folder-cohort`
Expected: PASS — all four test cases pass.

- [ ] **Step 5: Add shell-based cohort fetcher (real git invocation)**

Append to `folder-cohort.ts`:

```ts
import { execFileSync } from 'node:child_process';

export function fetchFirstCommit(repoRoot: string, folderPath: string): FirstCommit | null {
  try {
    const out = execFileSync(
      'git',
      ['log', '--reverse', '--diff-filter=A', '--format=%H|%cI', '--', folderPath],
      { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    return parseFirstCommit(out);
  } catch {
    return null;
  }
}
```

- [ ] **Step 6: Add a test for fetchFirstCommit**

Append to `folder-cohort.test.ts`:

```ts
import { fetchFirstCommit } from './folder-cohort.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

describe('fetchFirstCommit', () => {
  let repo: string;

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'cohort-repo-'));
    execFileSync('git', ['init', '-q', repo]);
    execFileSync('git', ['-C', repo, 'config', 'user.email', 'test@example.com']);
    execFileSync('git', ['-C', repo, 'config', 'user.name', 'test']);
    execFileSync('git', ['-C', repo, 'commit', '--allow-empty', '-q', '-m', 'init']);
  });

  afterEach(() => rmSync(repo, { recursive: true, force: true }));

  it('returns null for folder not in git history', () => {
    expect(fetchFirstCommit(repo, 'no-such-folder')).toBeNull();
  });

  it('returns commit info when folder is tracked', () => {
    execFileSync('mkdir', [join(repo, 'animals')]);
    execFileSync('touch', [join(repo, 'animals', 'cat.webp')]);
    execFileSync('git', ['-C', repo, 'add', '.']);
    execFileSync('git', ['-C', repo, 'commit', '-q', '-m', 'add animals']);
    const result = fetchFirstCommit(repo, 'animals');
    expect(result).not.toBeNull();
    expect(result?.sha).toMatch(/^[0-9a-f]{40}$/);
    expect(result?.date).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
```

Also add `beforeEach`/`afterEach` to the existing test file (vitest imports + extending the suite). Run the new test.

- [ ] **Step 7: Run the test to verify it passes**

Run: `cd lq-tools && pnpm test -- folder-cohort`
Expected: PASS — all five test cases pass.

- [ ] **Step 8: Commit**

```bash
git add lq-tools/scripts/folder-cohort.ts lq-tools/scripts/folder-cohort.test.ts
git commit -m "feat(audit): folder cohort classifier with git log integration"
```

---


# Tasks 7–9: Cheap Classifier

[Previous: detection modules](tasks-04-06-detection-modules.md) · [Plan index](00-overview.md) · [Next: reports and orchestrator](tasks-10-12-reports-and-orchestrator.md)

---

