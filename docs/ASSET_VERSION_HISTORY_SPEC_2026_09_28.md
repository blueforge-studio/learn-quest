# Asset version history + audits in the developer DB — spec (2026-09-28)

**Status:** contract agreed. The lq-tools producer is being built; ingest waits on the developer DB.
**Operator intent:** keep every generation attempt, see how each image progressed, and let a human
promote ANY earlier version even when the auto-auditor scored it lower ("human eval wins").

**Sources:**
- forge-control (dev-DB owner): `forge-control/docs/superpowers/specs/2026-09-27-tenant-developer-database-design-spec.md`
  §7, and the DDL `scripts/sql/2026-09-28-tdb0-tenant-databases.sql`.
- rollouts: ingestion spec (forge-control#1645).
- bevy-game-editor: content-addressed/pointer model from native binary distribution (forge-cloud#145).

## Model

All records are append-only dev-DB artifacts (`devdb_artifacts`):
`{project_slug, repo, ref_kind, ref, commit_sha, kind, measured_at, producer, source, content_hash, payload}`.
`ref_kind` / `ref` / `commit_sha` stay the **git** axis: the generating run's branch and commit
(rollouts, #1645 amendment). Asset identity lives in the key and payload instead: `asset.version` is keyed
`(project, source=app, assetPath, content_hash, measured_at)`, with `payload.assetPath` on every asset
record. Per-asset latest comes from a family-scoped table, `asset.version_latest (project, app, assetPath)`.
DB columns are snake_case; the producer JSON can stay camelCase, since ingest translates.

| kind | payload (essentials) |
|---|---|
| `asset.version` | `blob {bucket, key, sha256, bytes, contentType}`, `width`, `height`, `usage`, `parentVersionId`, `generation {model, modelVersion, seed, paramsHash, promptHash}`, `thumbnail` (a blob) |
| `asset.verdict` | `{versionHash, verdict: promoted \| rejected, actor: 'audit:keep-better' \| 'human:<name>', reason}` |
| `audit.observation` | keyed `(assetVersionId, auditor, auditorVersion)`: score, issues, flags, `specHash` (rubric version) |
| `audit.run` | run header (model, provider, scope, summary) |
| `spend.image` | `{provider, model, mode, imageCount, costUsd}` |

- **Current version** is derived: the latest verdict decides, and a human `promoted` outranks the auditor.
  Versions are never mutated or deleted; a rejected version is only flagged.
- **Blobs** go in one shared MinIO bucket, `asset-history`, keyed `<project>/<app>/<sha256>.<ext>`
  (immutable, dedupes identical bytes). Thumbnails are made client-side at ingest as their own blobs.
  Reads use short-TTL presigned GETs.
- **Write path:**
  - The target is `POST /api/devdb-artifacts` (`devdb:write`-scoped key) plus presigned PUTs to a public
    S3 front for `asset-history`. Both are forge-control TDB-1/TDB-4 and not built yet.
  - Until then, lq-tools writes a local outbox (`<app>/.asset-history/outbox/*.jsonl`) plus a local
    content-addressed store. A flush command sends the outbox once the API exists.
  - Blob bytes never go through the control-plane API.

## LearnQuest producer (lq-tools)

- **regenerate-flagged-images:**
  - archives the original and every attempt, kept or rejected, as `asset.version`
  - emits an `audit.observation` per new version
  - keep-better emits an `asset.verdict` from `audit:keep-better`, so the default current is the
    better-scored version
- **restore-asset-version:** lists the versions of an asset (with scores and verdicts) and promotes any
  one of them. That writes a `human:<name>` verdict and re-derives the responsive variants into `public/`.
- **Review UI (later, admin audit A3):** the LearnQuest Admin "Assets" view reads versions and
  verdicts through the forge-dev read API (#1645) and promotes with one click.
- **Game editor consumer:** asset records pin `source: { kind: 'gas', assetVersionId }` (bevy-game-editor).

## Open

1. ~~ref_kind mapping~~ resolved: ref_kind stays the git axis; asset path lives in the key (rollouts, folded into #1645 §4.7).
2. forge-control TDB-4: a PUT-capable S3 front scoped to `asset-history` (generation runs on laptops;
   forge-infra-minio isn't public).
3. The earlier ad-hoc stores (`asset-versions.json`, the `.audit-cache.sqlite` results) become derived
   caches of these records.
