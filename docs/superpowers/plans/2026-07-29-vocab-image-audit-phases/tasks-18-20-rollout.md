# Tasks 18–20: Rollout and Self-Review

[Previous: fixtures and tests](tasks-15-17-fixtures-and-tests.md) · [Plan index](00-overview.md)

---

## Task 18: Document the new audit-runs directory

# Tasks 18–20: Rollout and Self-Review

[Previous: fixtures and tests](tasks-15-17-fixtures-and-tests.md) · [Plan index](00-overview.md)

---


**Files:**
- Modify: `lang-quest/lq-nordic/.gitignore` (or `docs/.gitignore`)

- [ ] **Step 1: Create the audit-runs directory**

Run:
```bash
mkdir -p lang-quest/lq-nordic/docs/audit-runs
touch lang-quest/lq-nordic/docs/audit-runs/.gitkeep
```

- [ ] **Step 2: Commit**

```bash
git add lang-quest/lq-nordic/docs/audit-runs/.gitkeep
git commit -m "chore(audit): scaffold audit-runs directory for run-level reports"
```

---

## Task 19: Manual acceptance gate on target legacy cohorts plus animals control

**Files:** None (manual)

- [ ] **Step 1: Seed the phase2 bank from real failures**

Run: `cd lq-tools && pnpm exec tsx scripts/phase2-bank-cli.ts seed`
Expected: prints `seeded <id>` for each known-failure file that exists. Verify the bank file now has entries.

- [ ] **Step 2: Dry-run preview on 3 folders**

Run: `cd lq-tools && pnpm exec tsx scripts/ai-audit-images.ts --folder animals --folder basics --folder basic-verbs --folder basic-phrases --dry-run 2>&1 | tail -30`
Expected: prints estimated Phase 3 call count + estimated cost; no M3 calls made.

- [ ] **Step 3: Full audit on 3 folders**

Run: `cd lq-tools && pnpm exec tsx scripts/ai-audit-images.ts --folder animals --folder basics --folder basic-verbs --folder basic-phrases 2>&1 | tail -50`
Expected: M3 calls are made; per-folder index.json files updated; run-level report written to `lang-quest/lq-nordic/docs/audit-runs/`.

- [ ] **Step 4: Eyeball the audit report**

Open: `lang-quest/lq-nordic/docs/audit-runs/latest.json`.

Verify:
- Animals folder has ≥ 5 active verdicts (or whatever the previous count was).
- Basics folder verdicts include `phase2:*` reasons where they previously only had `phase3:*` ones.
- Business folder: most needs-regeneration entries should now have `phase2:giant-label` or `phase2:text-card` reasons.
- `duplicateGroups[]` contains at least the basics/basic-phrases overlap (yes, no, please).
- `summary.phase1HardFails` is significantly higher than before — the corner-flood detector is catching many bg-dominated images that the old single-histogram `isDominantEmpty` missed.

- [ ] **Step 5: Eyeball a regenerated manifest**

Open one updated `index.json` (e.g. `lang-quest/lq-nordic/public/_shared/images/lessons/vocabulary/basics/index.json`).

Verify:
- Each image entry has `phase1`, `phase2`, `phase3` fields.
- `phase1.cornerFlood` is populated for every image (bgFraction, isBgDominated, corners[]).
- For basics/sorry and other white-bg-dominant images: `phase1.passed: false` with `phase1.softWarnings` or hard-fail reasons containing `pixel:corner-bg-fill`.
- `auditHistory[]` contains the previous run + the new pipeline run.
- Backwards-compatible: the existing top-level fields (`schema`, `folder`, `generatedAt`, `images[]`) are unchanged.

- [ ] **Step 6: Commit the regenerated reports**

```bash
git add lang-quest/lq-nordic/docs/audit-runs/ lang-quest/lq-nordic/public/_shared/images/lessons/vocabulary/animals/index.json lang-quest/lq-nordic/public/_shared/images/lessons/vocabulary/basics/index.json lang-quest/lq-nordic/public/_shared/images/lessons/vocabulary/business/index.json
git commit -m "chore(audit): initial 3-folder audit run with phased pipeline"
```

---

## Task 20: Update existing design doc with cross-reference

**Files:**
- Modify: `lang-quest/lq-nordic/docs/design/2026-07-24-ai-image-audit-regen-infrastructure.md`

- [ ] **Step 1: Add a top-of-doc note**

At the top of `2026-07-24-ai-image-audit-regen-infrastructure.md`, after the title, add:

```markdown
> **Update 2026-07-29:** The audit pipeline now runs in three phases. See [`2026-07-29-vocab-image-audit-phases.md`](./2026-07-29-vocab-image-audit-phases.md) for the new Phase 2 (cheap vision classifier) and the extended manifest schemas. This doc remains the canonical reference for packages, regeneration scripts, and provider config.
```

- [ ] **Step 2: Commit**

```bash
git add lang-quest/lq-nordic/docs/design/2026-07-24-ai-image-audit-regen-infrastructure.md
git commit -m "docs(audit): cross-reference new phased pipeline design"
```

---

## Self-review checklist

- [x] **Spec coverage:** Walked every requirement in `2026-07-29-vocab-image-audit-phases.md` and pointed to a task:
  - Phase 1 pixel gate (existing): Tasks 12, 13 (wires existing `@blueforge-studio/image-processor`)
  - Phase 1 corner-flood detector (NEW per refinement): Task 5
  - Phase 2 cheap classifier: Tasks 7, 8, 12
  - Phase 2 reference bank: Tasks 3, 9
  - Duplicate detector: Task 4
  - Folder cohort: Task 6
  - Manifest schema extension: Task 14
  - Run-level report: Task 11
  - Pipeline wiring: Task 13
  - Config block: Task 2
  - Calibration test: Task 16
  - Pipeline e2e test: Task 17
  - Test fixtures: Task 15
  - Error handling per phase: Tasks 12, 13
  - Cost protection (`--dry-run`): Task 13
  - Determinism: implicit in pure functions (Tasks 5, 7, 8, 12)
  - Manifest `auditHistory[]`: Tasks 13, 14
  - Manual acceptance gate: Task 19
  - Backwards-compatibility: Task 14 (round-trip test), Task 13 (additive fields only)

- [x] **Placeholder scan:** No "TBD" / "TODO" / "fill in". Every code block contains real TypeScript. Every command has expected output.

- [x] **Type consistency:** `Phase2VerdictConfig` (Task 2) used unchanged in Tasks 7, 11, 12, 15, 16. `CheapVisionVerdict` (Task 7) used in Tasks 11, 12, 15. `PhaseContext` (Task 11) used in Task 12. `ExtendedImageEntry` (Task 13) used in Task 12. `RunReportInput` (Task 10) used in Task 12. `Phase2Bank` (Task 3) used in Tasks 7, 8, 11. All names match across tasks.

- [x] **Scope:** One coherent subsystem (lq-tools audit pipeline). Single plan. No decomposition needed.

- [x] **Spec mentions `@blueforge-studio/audit-manifest` schema extension:** I deviated from the spec's "Unchanged" note by introducing `audit-manifest-fields.ts` (Task 13) which extends the types in lq-tools rather than modifying the shared package. Rationale: optional JSON fields are inherently backwards-compatible — adding them to the shared package would require publishing a new version. The lq-tools extension lets consumers parse both old and new manifests without coordinating with the shared package.