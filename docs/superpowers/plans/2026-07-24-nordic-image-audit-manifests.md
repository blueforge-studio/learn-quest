# Nordic Image Audit Manifests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing MiniMax-first image audit so lq-nordic concept and vocabulary assets receive non-destructive quality/provenance manifests at aggregate and leaf-folder levels.

**Architecture:** Keep image auditing in `lq-tools/scripts/ai-audit-images.ts`. Add manifest assembly as a pure local step after audit results are collected; write one aggregate manifest at each requested root and one manifest in every image-bearing leaf folder. Audit only base `.webp` files; `--400`, `--800`, and similar files are derived downscaled variants represented in the base entry's `variants` list. Existing image files remain untouched.

**Tech Stack:** TypeScript, `tsx`, Node `fs/path`, existing Blueforge vision-gateway MiniMax chain, JSON manifests.

---

### Task 1: Add manifest assembly helpers and provenance/status fields

**Files:**
- Modify: `/Users/kmandrup/Projects/Repos/learn-quest/lq-tools/scripts/ai-audit-images.ts`
- Test: `/Users/kmandrup/Projects/Repos/learn-quest/lq-tools/scripts/ai-audit-images.test.ts` if the repository's test setup supports direct script imports; otherwise add a local pure helper test under the existing lq-tools test convention.

- [ ] **Step 1: Extract pure helpers for base-image discovery, variant grouping, manifest entry construction, and status mapping.**

  Preserve the existing exclusion rule and document it in the script:
  ```ts
  // Resize variants such as foo--400.webp and foo--800.webp are derived from
  // foo.webp; audit the base once and list variants in its manifest entry.
  ```

  The helpers must:
  - group `foo.webp`, `foo--400.webp`, and `foo--800.webp` under `foo.webp`;
  - include variant suffixes without extensions, e.g. `["--400", "--800"]`;
  - use `approved` for successful scores >= 7 with no regeneration flag;
  - use `needs_review` for successful scores 4-6 or ambiguous issues;
  - use `rejected` for successful scores <= 3 or `needs_regeneration=true`;
  - use `audit_failed` when the vision call fails;
  - preserve explicit audit flags and issue strings.

- [ ] **Step 2: Add provenance resolution without guessing.**

  Resolve `metadata.model` and `metadata.provider` from explicit CLI options, an existing manifest entry, or known lq-nordic/lq-tools generation metadata. Use `unknown` when no source supports a value. Record `metadata.generatedAt` from existing metadata or file birth/change metadata only when the value is clearly available; do not label an inferred filesystem timestamp as a model-generation date.

- [ ] **Step 3: Run the focused typecheck/test command.**

  Run the existing lq-tools validation command discovered from `package.json`; expected result is either PASS or a documented test-runner mismatch before continuing.

### Task 2: Generate aggregate and leaf manifests

**Files:**
- Modify: `/Users/kmandrup/Projects/Repos/learn-quest/lq-tools/scripts/ai-audit-images.ts`
- Create/update at runtime: `/Users/kmandrup/Projects/Repos/learn-quest/lang-quest/lq-nordic/public/_shared/images/lessons/concept/index.json`
- Create/update at runtime: `/Users/kmandrup/Projects/Repos/learn-quest/lang-quest/lq-nordic/public/_shared/images/lessons/vocabulary/index.json`
- Create/update at runtime: every image-bearing leaf `index.json` below the two roots.

- [ ] **Step 1: Add CLI options for manifest output and provenance.**

  Support:
  ```text
  --manifest
  --manifest-root=<path>
  --audit-model=<name>
  --audit-provider=<name>
  --generated-model=<name>
  --generated-provider=<name>
  ```

  Keep `--output` for raw audit JSON. `--manifest` must be explicit so current audit consumers do not unexpectedly rewrite manifests.

- [ ] **Step 2: Build the root manifest.**

  Use the existing schema fields and add stable fields:
  ```json
  {
    "$schema": "image-index/v1",
    "category": "lessons-vocabulary",
    "description": "Vocabulary illustration images",
    "generated": "<manifest timestamp>",
    "audit": {"provider":"...","model":"...","completedAt":"..."},
    "images": []
  }
  ```

  Each image entry must include `id`, root-relative `filename`, `status`, `approval`, `variants`, `tags`, and `metadata` containing file size, generation provenance when known, audit provenance, score, flags, issues, and `needsRegeneration`.

- [ ] **Step 3: Build each leaf manifest.**

  Write `index.json` beside images for every image-bearing leaf folder. Leaf entries use filenames relative to that leaf, while aggregate entries use filenames relative to the requested root. Do not include `index.json` itself or derived variant files as independent images.

- [ ] **Step 4: Preserve prior metadata.**

  When rewriting an existing manifest, merge prior `generatedAt`, `model`, `provider`, tags, and status only when the new audit does not provide a stronger value. Never overwrite a known generation model with `unknown`.

- [ ] **Step 5: Run a dry-run manifest generation against both roots.**

  Verify that the planned number of base entries equals the number of non-variant `.webp` files and that every variant is attached to one base entry.

### Task 3: Run the MiniMax audit and write manifests

**Files:**
- Runtime output only: raw audit JSON and manifests under lq-nordic image directories.

- [ ] **Step 1: Verify environment and estimate cost.**

  Confirm the vision-gateway package exists and MiniMax credentials are available without printing secrets. Calculate the audit count as 36 concept bases plus vocabulary bases after excluding resize variants. Stop before the paid run if the configured budget is insufficient.

- [ ] **Step 2: Run concept audit.**

  ```bash
  cd /Users/kmandrup/Projects/Repos/learn-quest/lq-tools
  npx tsx scripts/ai-audit-images.ts \
    --path=/Users/kmandrup/Projects/Repos/learn-quest/lang-quest/lq-nordic/public/_shared/images/lessons/concept \
    --manifest \
    --output=/Users/kmandrup/Projects/Repos/learn-quest/lang-quest/lq-nordic/public/_shared/images/lessons/concept/ai-audit.json \
    --audit-model=minimax-m3 --audit-provider=minimax
  ```

- [ ] **Step 3: Run vocabulary audit.**

  ```bash
  cd /Users/kmandrup/Projects/Repos/learn-quest/lq-tools
  npx tsx scripts/ai-audit-images.ts \
    --path=/Users/kmandrup/Projects/Repos/learn-quest/lang-quest/lq-nordic/public/_shared/images/lessons/vocabulary \
    --manifest \
    --output=/Users/kmandrup/Projects/Repos/learn-quest/lang-quest/lq-nordic/public/_shared/images/lessons/vocabulary/ai-audit.json \
    --audit-model=minimax-m3 --audit-provider=minimax
  ```

- [ ] **Step 4: Inspect animals results separately.**

  Confirm the animals leaf manifest contains all base animal images, all resize variants, and only marks entries approved where the audit supports that result. Do not force approval from the prior assumption that animals are excellent.

### Task 4: Verify output and document the convention

**Files:**
- Modify: `/Users/kmandrup/Projects/Repos/learn-quest/lq-tools/scripts/ai-audit-images.ts`
- Modify or create: `/Users/kmandrup/Projects/Repos/learn-quest/lq-tools/docs/Asset-Generation-Guide.md` only if the existing guide has the appropriate manifest section; otherwise add a concise section to the nearest existing asset-audit documentation.

- [ ] **Step 1: Validate every generated JSON file.**

  Parse all manifests and assert:
  - every listed base file exists;
  - every variant file exists;
  - no `--N` file appears as an independent image entry;
  - aggregate and leaf entries agree on status and score;
  - every entry has audit provenance.

- [ ] **Step 2: Confirm no image bytes changed.**

  Compare image file modification times or hashes collected before and after the run; expected result is no image-file changes.

- [ ] **Step 3: Run the relevant lq-nordic validation command.**

  Use the repository's existing package script for JSON/type/build validation and record the exact result.

- [ ] **Step 4: Report findings.**

  Summarize total audited, approved, needs-review, rejected, failed, average scores, issue frequencies, estimated/actual audit cost, provenance completeness, and regeneration candidates. Do not regenerate or replace images in this plan.
