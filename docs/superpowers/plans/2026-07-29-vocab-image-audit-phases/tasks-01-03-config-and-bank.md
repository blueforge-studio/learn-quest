# Tasks 1–3: Config and Reference Bank

[Plan index](00-overview.md) · [Next: detection modules](tasks-04-06-detection-modules.md)

---

## Task 1: Verify baseline — existing audit runs cleanly

**Files:**
- Read: `lq-tools/scripts/ai-audit-images.ts`
- Read: `lq-tools/scripts/ai-audit-classify.ts`
- Read: `lq-tools/scripts/image-audit.config.json`

- [ ] **Step 1: Confirm existing audit still runs**

Run: `cd lq-tools && pnpm test`
Expected: all existing tests pass (vitest output, no failures).

- [ ] **Step 2: Confirm current Phase 1 pixel gate works**

Run: `cd lq-tools && pnpm exec tsx scripts/ai-audit-images.ts --help 2>&1 | head -40`
Expected: prints usage with current flags. No errors.

- [ ] **Step 3: Document baseline observations**

In the PR description (or a comment in Task 2), note any current behaviour relevant to wiring (e.g. existing prompt prefix/suffix, where pixelStats flow into the prompt).

- [ ] **Step 4: Commit any unrelated fixes**

If Step 1 or Step 2 surfaced broken tests, fix them on a separate commit *before* starting Phase 2 work.

```bash
git add <fixed files>
git commit -m "fix: baseline audit tests pass before phase pipeline work"
```

If nothing to fix, skip this commit.

---

## Task 2: Add `phase2` block to image-audit.config.json

**Files:**
- Modify: `lq-tools/scripts/image-audit.config.json:53-56` (extend with new blocks)
- Modify: `lq-tools/scripts/image-audit.config.example.json:53-56`

- [ ] **Step 1: Write failing test for config loading**

Create `lq-tools/scripts/image-audit-config.phase2.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { loadAuditConfig } from './ai-audit-config.js';

describe('audit config phase1.cornerFlood block', () => {
  it('loads phase1.cornerFlood with default values when missing from file', () => {
    const cfg = loadAuditConfig({ phase1: undefined });
    expect(cfg.phase1.cornerFlood).toBeDefined();
    expect(cfg.phase1.cornerFlood.nearWhiteThreshold).toBe(220);
    expect(cfg.phase1.cornerFlood.nearBlackThreshold).toBe(40);
    expect(cfg.phase1.cornerFlood.tolerance).toBe(10);
    expect(cfg.phase1.cornerFlood.bgFractionThreshold).toBe(0.5);
    expect(cfg.phase1.cornerFlood.cornerSize).toBe(5);
  });
});

describe('audit config phase2 block', () => {
  it('loads phase2 block with default values when missing from file', () => {
    const cfg = loadAuditConfig({ phase2: undefined });
    expect(cfg.phase2).toBeDefined();
    expect(cfg.phase2.giantLabelAreaPct).toBe(25);
    expect(cfg.phase2.preschoolStyleDistance).toBe(12);
    expect(cfg.phase2.hardFailConfidence).toBe(0.7);
    expect(cfg.phase2.duplicateHashDistance).toBe(6);
    expect(cfg.phase2.referenceBankPath).toBe('data/phase2-bank.json');
  });

  it('loads phase2 block from file when present', () => {
    const cfg = loadAuditConfig({
      phase2: {
        giantLabelAreaPct: 30,
        preschoolStyleDistance: 14,
        hardFailConfidence: 0.8,
        duplicateHashDistance: 8,
        referenceBankPath: 'custom/bank.json',
      },
    });
    expect(cfg.phase2.giantLabelAreaPct).toBe(30);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd lq-tools && pnpm test -- image-audit-config.phase2`
Expected: FAIL — `loadAuditConfig` does not return a `phase2` block.

- [ ] **Step 3: Read ai-audit-config.ts to understand loader**

Read: `lq-tools/scripts/ai-audit-config.ts`. Find the function that merges file config with defaults.

- [ ] **Step 4: Extend the loader with phase1.cornerFlood + phase2 defaults**

In `lq-tools/scripts/ai-audit-config.ts`, add to the defaults object:

```ts
const DEFAULT_PHASE1_CORNER_FLOOD = {
  nearWhiteThreshold: 220,
  nearBlackThreshold: 40,
  tolerance: 10,
  bgFractionThreshold: 0.5,
  cornerSize: 5,
};

const DEFAULT_PHASE2 = {
  giantLabelAreaPct: 25,
  preschoolStyleDistance: 12,
  hardFailConfidence: 0.7,
  duplicateHashDistance: 6,
  referenceBankPath: 'data/phase2-bank.json',
  textAreaHeuristic: {
    centralBandRows: [0.30, 0.70],
    minNearBlackConcentration: 0.15,
  },
};
```

Merge into the returned config under `phase1.cornerFlood` and `phase2`. Mirror the existing merge pattern used for other top-level keys.

- [ ] **Step 5: Update the TypeScript types**

Find the config type definition in `ai-audit-config.ts` and add:

```ts
export type CornerFloodConfig = {
  nearWhiteThreshold: number;
  nearBlackThreshold: number;
  tolerance: number;
  bgFractionThreshold: number;
  cornerSize: number;
};

export type Phase2Config = {
  giantLabelAreaPct: number;
  preschoolStyleDistance: number;
  hardFailConfidence: number;
  duplicateHashDistance: number;
  referenceBankPath: string;
  textAreaHeuristic: {
    centralBandRows: [number, number];
    minNearBlackConcentration: number;
  };
};
```

Add `phase1: { cornerFlood: CornerFloodConfig }` and `phase2: Phase2Config` to the top-level config type.

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd lq-tools && pnpm test -- image-audit-config.phase2`
Expected: PASS — both test cases pass.

- [ ] **Step 7: Add the phase1.cornerFlood and phase2 blocks to image-audit.config.example.json**

In `lq-tools/scripts/image-audit.config.example.json`, after the existing `"manifest"` block (line 53-56), add:

```jsonc
,
"phase1": {
  "cornerFlood": {
    "nearWhiteThreshold": 220,
    "nearBlackThreshold": 40,
    "tolerance": 10,
    "bgFractionThreshold": 0.5,
    "cornerSize": 5
  }
},
"phase2": {
  "giantLabelAreaPct": 25,
  "preschoolStyleDistance": 12,
  "hardFailConfidence": 0.7,
  "duplicateHashDistance": 6,
  "referenceBankPath": "data/phase2-bank.json",
  "textAreaHeuristic": {
    "centralBandRows": [0.30, 0.70],
    "minNearBlackConcentration": 0.15
  }
}
```

- [ ] **Step 8: Update the JSON $comment in image-audit.config.example.json**

Add to the $comment at the top: `"- phase1.cornerFlood augments the existing pixel gate with a 4-corner flood-fill check. - phase2.* controls the deterministic classifier ahead of M3 (see docs/superpowers/specs/2026-07-29-vocab-image-audit-phases.md)."`.

- [ ] **Step 9: Commit**

```bash
git add lq-tools/scripts/image-audit-config.ts lq-tools/scripts/image-audit-config.phase2.test.ts lq-tools/scripts/image-audit.config.example.json
git commit -m "feat(audit): add phase2 config block with sensible defaults"
```

---

## Task 3: Phase 2 reference bank — types, schema, load/save

**Files:**
- Create: `lq-tools/scripts/phase2-reference-bank.ts`
- Create: `lq-tools/scripts/phase2-reference-bank.test.ts`
- Create: `lq-tools/data/phase2-bank.example.json` (committed reference for tests)

- [ ] **Step 1: Write failing test for bank load/save**

Create `lq-tools/scripts/phase2-reference-bank.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  loadBank,
  saveBank,
  addEntry,
  listEntries,
  type Phase2Bank,
  type Phase2BankEntry,
} from './phase2-reference-bank.js';

describe('phase2 reference bank', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'phase2-bank-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns empty bank when file is missing', () => {
    const bank = loadBank(join(dir, 'nope.json'));
    expect(bank.schema).toBe('phase2-bank/v1');
    expect(bank.entries).toEqual([]);
  });

  it('saves and reloads entries', () => {
    const path = join(dir, 'bank.json');
    const entry: Phase2BankEntry = {
      id: 'text-card-yes',
      label: 'text-card',
      imagePath: '/abs/path/to/yes.webp',
      perceptualHash: '0101010101010101',
    };
    saveBank(path, { schema: 'phase2-bank/v1', entries: [entry] });
    expect(existsSync(path)).toBe(true);
    const loaded = loadBank(path);
    expect(loaded.entries).toHaveLength(1);
    expect(loaded.entries[0]).toEqual(entry);
  });

  it('appends a new entry idempotently', () => {
    const path = join(dir, 'bank.json');
    addEntry(path, { id: 'a', label: 'text-card', imagePath: '/p/a.webp', perceptualHash: '00' });
    addEntry(path, { id: 'a', label: 'text-card', imagePath: '/p/a.webp', perceptualHash: '00' });
    const bank: Phase2Bank = loadBank(path);
    expect(bank.entries).toHaveLength(1);
  });

  it('lists entries by label', () => {
    const path = join(dir, 'bank.json');
    saveBank(path, {
      schema: 'phase2-bank/v1',
      entries: [
        { id: 'tc-1', label: 'text-card', imagePath: '/p/1', perceptualHash: '00' },
        { id: 'pc-1', label: 'preschool-cartoon', imagePath: '/p/2', perceptualHash: '01' },
        { id: 'tc-2', label: 'text-card', imagePath: '/p/3', perceptualHash: '10' },
      ],
    });
    const tcs = listEntries(path, { label: 'text-card' });
    expect(tcs.map((e) => e.id).sort()).toEqual(['tc-1', 'tc-2']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd lq-tools && pnpm test -- phase2-reference-bank`
Expected: FAIL — module `./phase2-reference-bank.js` not found.

- [ ] **Step 3: Create the bank module**

Create `lq-tools/scripts/phase2-reference-bank.ts`:

```ts
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

export type Phase2BankEntry = {
  id: string;
  label: 'text-card' | 'preschool-cartoon' | 'giant-label';
  imagePath: string;
  perceptualHash: string;       // 16 hex chars (8-bit dHash)
};

export type Phase2Bank = {
  schema: 'phase2-bank/v1';
  entries: Phase2BankEntry[];
};

export const EMPTY_BANK: Phase2Bank = { schema: 'phase2-bank/v1', entries: [] };

export function loadBank(path: string): Phase2Bank {
  if (!existsSync(path)) return structuredClone(EMPTY_BANK);
  const raw = readFileSync(path, 'utf8');
  const parsed = JSON.parse(raw);
  if (parsed?.schema !== 'phase2-bank/v1') {
    throw new Error(`phase2-bank: unsupported schema '${parsed?.schema}' at ${path}`);
  }
  return parsed as Phase2Bank;
}

export function saveBank(path: string, bank: Phase2Bank): void {
  writeFileSync(path, JSON.stringify(bank, null, 2) + '\n', 'utf8');
}

export function addEntry(
  path: string,
  entry: Phase2BankEntry,
): Phase2Bank {
  const bank = loadBank(path);
  const existing = bank.entries.findIndex((e) => e.id === entry.id);
  if (existing >= 0) bank.entries[existing] = entry;
  else bank.entries.push(entry);
  saveBank(path, bank);
  return bank;
}

export function listEntries(
  path: string,
  filter: { label?: Phase2BankEntry['label'] } = {},
): Phase2BankEntry[] {
  const bank = loadBank(path);
  return filter.label ? bank.entries.filter((e) => e.label === filter.label) : bank.entries;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd lq-tools && pnpm test -- phase2-reference-bank`
Expected: PASS — all four test cases pass.

- [ ] **Step 5: Create the example bank**

Create `lq-tools/data/phase2-bank.example.json`:

```json
{
  "schema": "phase2-bank/v1",
  "entries": []
}
```

- [ ] **Step 6: Add gitignore**

In `lq-tools/.gitignore` (create if missing), add:
```
data/phase2-bank.json
```
(keeps the real bank out of git; the `.example.json` is committed for tests.)

- [ ] **Step 7: Commit**

```bash
git add lq-tools/scripts/phase2-reference-bank.ts lq-tools/scripts/phase2-reference-bank.test.ts lq-tools/data/phase2-bank.example.json lq-tools/.gitignore
git commit -m "feat(audit): phase2 reference bank load/save/CRUD"
```

---


# Tasks 4–6: Detection Modules

[Previous: config and bank](tasks-01-03-config-and-bank.md) · [Plan index](00-overview.md) · [Next: classifier](tasks-07-09-classifier.md)

---

