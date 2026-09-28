# LearnQuest audit state — where it lives (2026-09-28)

Input for the developer-DB `content-inventory` producer family (forge-control#1645, rollouts
ingestion spec). Read-only survey.

## Layers today

| # | Artifact | Writer | Shape / key | Git | Scope |
|---|---|---|---|---|---|
| A | `image-audit-results-<date>[-N].json` (run snapshot) | `lq-tools/scripts/ai-audit-images.ts:641` | header `{auditDate,auditModel,auditProvider,sourceDirectory,baseImagesOnly,variantRule,summary{total,audited,failed,needsRegen,avgScore,totalCost}}` + `results[{image, success, quality_score, needs_regeneration, issues[], ~15 has_* flags, art_style_match, label_integrity, cost, llm_skipped, non_llm_audit{hardFail,hardFailReasons}}]`; key = path relative to `--path` | committed ad hoc (55 in lq-nordic despite .gitignore; learn-quest docs/audits) | per run |
| B | `asset-runs.json` (`asset-runs/v1`, per folder) | `lq-tools/scripts/asset-runs.ts recordAuditRun` (only with `--manifest`) | append-only run log `{id,auditDate,model,provider,scope,imageCount,summary,resultsPath(relative!)}` | committed (109 in nordic) | per folder |
| C | `index.json` (`image-index/v1`, per folder) | audit-manifest `writeFolderManifests`, `updateIndexLatestRun`, `recordRegenInManifest` (regen resets audit) | per image `status` + `metadata.audit{auditedAt,auditedBy,provider,score,needsRegeneration,issues,flags}` + generation provenance; folder `latestRun` | committed, **shipped under public/** | per folder; **lq-history has none** |
| D | `.audit-cache.sqlite` (per app root) | `@blueforge-studio/audit-db` 0.3.1 (Drizzle, `blueforge-org/packages/content-studio/packages/audit-db`), write-through when `AUDIT_DB_ENABLED=1`, `build-audit-db.ts`, `consolidate-audit-dbs.ts` | `runs`, `folder_summary(run,folder)`, `results(run,folder,image,…, spec_hash, image_fingerprint, result_json)` — "derived cache; JSON is source of truth"; `skip-cache` on specHash+fingerprint | gitignored | per checkout; schema drift (lq-operations lacks spec_hash) |
| E | `audit-specs.json` | `loadSpecRegistry/saveSpecRegistry` | audit spec registry (hash → rules) | mixed | per images root |
| F | `lq-operations/.fleet-db.sqlite` | `score-app-maturity.ts` (+ unknown writer of `image_spend`) | `app_maturity` (appends, 260 rows/47 apps), `image_spend(ts,day,script,provider,model,mode,image_count,cost_usd,app)` | gitignored | fleet |
| G | `learn-quest/.content-db.sqlite` | content-db package | `lesson_images(app,lesson_id,chapter,image_id,…)`, `chapter_*`, `content_inventory` | gitignored | fleet |
| H | `<app>/asset-versions.json` | lq-history ab2fe89 | `{assets{repoPath:{version,updatedAt}}}` | committed | per app; no reader found |

Stateless tools: coverage-audit (stdout), app-audit, content-audit reporters, image-validation,
lq-operations validators (`validate-content-shape --dir .` is the CI gate), and annotate-words
(state inside the content JSON as `annotation{source,confidence}`).
books-platform: no image-audit state; only screen-audit flow reports.

## Keys

All path-based: renames break history, the key depends on the chosen root, and symlinked shared
pools make one file appear under several app paths. `--<size>` variants are skipped
(`baseImagesOnly`). The only content-stable key is `image_fingerprint` plus `spec_hash` in the
SQLite cache. Two folder-average rules exist (lq-tools `computeFolderSummary` vs
asset-audit-runner `aggregator.ts`); the hub needs one.

## Operations

- Regen selection: `regenerate-flagged-images --regen-file` filters `needs_regeneration`, maps
  basename to a gen config, and dedupes `basename@resolvedDir`; or `--chapter=N` from config stamps.
- Chunking (≤165 for Gemini batch downloads), budget caps (`--budget`, `--max-image-calls`).
- Thresholds: score < 7 needs-fix, regen flag gives needs-regeneration, pixel gate hard-fails at 1,
  art bar in `audit-rules.config.json`. **No ratchet, no run-to-run diff tool.**
- Rollups: per folder, per app (maturity), per chapter only via content-db and coverage-audit.
- History: run snapshots and the run log keep it; `index.json` per-image audit is overwritten.

## What must survive generalization

1. A **content-stable asset identity** (fingerprint/content hash + logical id such as
   `app/domain/lesson-id/slot`), with paths as attributes rather than keys. Only then do renames
   and shared pools keep their history.
2. **Per-asset score history** (append-only observations: run, spec_hash, scorer model, score,
   flags, issues, cost). Scores are non-deterministic, so gates need a median or tolerance over
   the last N.
3. **Joins to content:** asset ↔ lesson ↔ chapter ↔ facet, so "chapter 3 images needing regen"
   and "interest=sport lessons lacking images" are queries, not scripts.
4. **Regen queue as state:** queued, submitted (batch id), generated (commit), re-audited. That
   replaces hand-built chunk files; the 09-24 double-buy risk came from not having it.
5. **Materialize to the local shape** (results-file JSON) so `--regen-file` / `--image-list`
   CLIs keep working offline; local stays a derived cache, and the JSON journal is the offline
   write queue.
6. The **cost ledger** (`image_spend`) and the **spec registry** (`audit-specs`) as first-class
   records.
7. The runtime `index.json` `status` stays a **published projection** (CDN), not a writer.

## Addendum — SQLite layer verified (2026-09-28)

- **31 `.audit-cache.sqlite`** live under the learn-quest container tree
  (`learn-quest/{lang,life,school}-quest/lq-*`, `learn-quest/lq-operations`, books-platform
  apps × 5), not the `/Repos/lq-*` checkouts. lq-nordic's copy has 68 runs, 1,171 folder rows
  and 7,223 results.
- **`.content-db.sqlite`** (`@blueforge-studio/content-db`) row counts:

  | Table | Rows |
  |---|---|
  | lesson_images | 320 |
  | content_inventory | 193 |
  | chapter_summary | 30 |
  | chapter_wiring | 30 |
  | chapter_foundations | 20 |

  It is the natural home for chapter × interest-facet coverage (electives).
- **`.fleet-db.sqlite`**:
  - `app_maturity`: 260 rows, 47 apps, written by `score-app-maturity.ts`.
  - `image_spend`: 36 rows, **no writer in current source** (orphaned).
- `lq-core/apps/web/scripts/dev/verify-db.cjs` is dev-only code metrics (`.metrics-cache.db`,
  absent) and unrelated.
- Suggested hub record families:
  - `audit.run` + `audit.observation`
  - `content.inventory` / `content.chapter` / `content.wiring` / `content.foundation` /
    `content.lesson_asset`
  - `fleet.maturity`
  - `spend.image`

  All keyed (source, ref/sha, kind, measured_at) + content_hash.
