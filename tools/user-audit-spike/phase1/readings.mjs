// Phase 1 mapping: user-audit report.json (blueforge.user-audit/1)  ->  app-dev-db `audit.score` readings.
//
// Contract source: blueforge/docs/plans/2026-10-05-app-dev-db-producer-contract.md (v0.5).
//  - envelope {project, repo, ref_kind, ref, commit, kind, measured_at, producer, source, payload}
//  - audit.score payload is exactly {gate, score, floor, checked}; checked >= 1; the server derives `series` = gate
//  - empty scope is a 422, not a zero; payload cap 256 KB; measured_at must not be ahead of the server clock
//  - unknown kind = 400 (we reuse an existing kind on purpose: no registry change in phase 1)
// UNVERIFIED: whether `gate` is free text. We keep it to [a-z0-9.-] to be safe.
export const KIND = 'audit.score';
export const PAYLOAD_CAP_BYTES = 256 * 1024;
export const REPORT_SCHEMA = 'blueforge.user-audit/1';

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
export const gateName = (cell, dimension) => ['learner', cell.app, cell.language, cell.l1, cell.segment, dimension].map(slug).join('.');
const round1 = (n) => Math.round(n * 10) / 10;

export class RefusedError extends Error { constructor(msg) { super(msg); this.name = 'RefusedError'; } }

/** Build the readings for one report. Pure: no I/O, no clock except `now` (injectable for tests). */
export function buildReadings(report, { project = '<project-uuid>', floors = {}, ref = 'main', refKind = 'branch', producer, all = false, now = new Date() } = {}) {
  if (!report || report.schema !== REPORT_SCHEMA) throw new RefusedError(`unsupported report schema: ${report?.schema}`);
  const walked = report.scope?.walkedLessons;
  // Same rule as the ingest: nothing exercised means nothing to say. A zero would read as a legitimate score.
  if (!Number.isInteger(walked) || walked < 1) throw new RefusedError('empty scope: walkedLessons < 1, refusing to build readings (the ingest would 422)');
  const commit = String(report.build?.head || '').toLowerCase();
  if (!/^[0-9a-f]{7,64}$/.test(commit)) throw new RefusedError(`bad commit sha: ${commit}`);
  const measuredAt = new Date(report.generatedAt);
  if (Number.isNaN(measuredAt.getTime())) throw new RefusedError('generatedAt is not a date');
  if (measuredAt.getTime() > now.getTime() + 60_000) throw new RefusedError('measured_at is ahead of the clock (ingest: 400 measured_ahead)');

  producer = producer || `gitea-actions:${report.build?.repo}`; // forge-dev: producers are registered per repo as gitea-actions:<repo>
  const entries = [];
  const skipped = [];
  for (const d of report.dimensions) { if (d.score == null) skipped.push({ dimension: d.id, reason: 'null score (unmeasured): not pushed, never as 0' }); else entries.push({ dimension: d.id, score: d.score }); }
  // Headline = the gated score; raw shows what the gate cost. Both are plain 0-100 numbers.
  entries.push({ dimension: 'total', score: report.finalScore }, { dimension: 'raw-total', score: report.total });

  // Volume control (forge-dev advice): ~9 gates x ~30 cells = ~270 series and ~270 POSTs per run is a lot.
  // Default = the headline total, completability, and any dimension that actually carries a floor; the full 9-dimension
  // detail stays in the run artifact. `all` pushes everything.
  const selected = all ? entries : entries.filter(({ dimension }) => dimension === 'total' || dimension === 'completability' || (floors[gateName(report.cell, dimension)] ?? 0) > 0);
  const notPushed = entries.filter((e) => !selected.includes(e)).map((e) => e.dimension);
  const envelopes = selected.map(({ dimension, score }) => {
    if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 100) throw new RefusedError(`score out of range for ${dimension}: ${score}`);
    const gate = gateName(report.cell, dimension);
    const floor = floors[gate] ?? 0; // 0 = no floor ratcheted yet (contract requires a number)
    if (!Number.isFinite(floor) || floor < 0) throw new RefusedError(`bad floor for ${gate}`);
    const env = {
      project, repo: report.build.repo, ref_kind: refKind, ref, commit, kind: KIND,
      measured_at: measuredAt.toISOString(), producer, source: `user-audit-run:${report.runId}`,
      payload: { gate, score: round1(score), floor, checked: walked },
    };
    if (Buffer.byteLength(JSON.stringify(env.payload)) > PAYLOAD_CAP_BYTES) throw new RefusedError(`payload over cap for ${gate}`);
    return env;
  });
  return { envelopes, skipped, notPushed };
}

/** A local-dev run must not enter shared history under a CI-looking identity. */
export function assertPushable(report, { allowLocal = false, env = process.env } = {}) {
  if (!env.APP_DEVDB_URL || !env.APP_DEVDB_PROJECT || !env.APP_DEVDB_SECRET) throw new RefusedError('APP_DEVDB_URL / APP_DEVDB_PROJECT / APP_DEVDB_SECRET not all set');
  if (/^local/i.test(report.build?.target || '') && !allowLocal) throw new RefusedError(`report target is "${report.build.target}"; pass --allow-local to push a local run (it would sit in shared history next to CI runs)`);
}
