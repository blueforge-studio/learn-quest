// Pure logic for the books smoke test: result shape, summary, exit code. No I/O, so it is unit-tested.
// Check = { id, app, severity: 'P0'|'P1', status: 'pass'|'fail'|'error', detail, ms }
// Exit: 0 every P0 passed (P1 failures are reported, not fatal) | 1 at least one P0 FAILED | 2 infrastructure error (nothing trustworthy).
export const SCHEMA = 'blueforge.books-smoke/1';
export function exitCodeFor(checks) {
  if (checks.some((c) => c.status === 'error')) return 2;
  if (checks.some((c) => c.severity === 'P0' && c.status === 'fail')) return 1;
  return 0;
}
export function summarize(checks) {
  const by = (s) => checks.filter((c) => c.status === s).length;
  return { total: checks.length, pass: by('pass'), fail: by('fail'), error: by('error'), p0Failed: checks.filter((c) => c.severity === 'P0' && c.status === 'fail').map((c) => c.id), p1Failed: checks.filter((c) => c.severity === 'P1' && c.status === 'fail').map((c) => c.id) };
}
export function buildReport({ target, checks, startedAt, blockedWrites = [], note = '' }) {
  return { schema: SCHEMA, startedAt, finishedAt: new Date().toISOString(), target, summary: summarize(checks), exitCode: exitCodeFor(checks), blockedWrites, note, checks };
}
/** Run one named check; a thrown error is an `error` (infrastructure), a returned {ok:false} is a `fail` (the app is wrong). */
export async function runCheck(spec, fn, { now = Date.now } = {}) {
  const t0 = now();
  try { const r = await fn(); return { ...spec, status: r.ok ? 'pass' : 'fail', detail: r.detail || '', ms: now() - t0 }; }
  catch (e) { return { ...spec, status: 'error', detail: String(e?.message || e).split('\n')[0].slice(0, 200), ms: now() - t0 }; }
}
