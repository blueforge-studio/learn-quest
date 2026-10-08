import test from 'node:test'; import assert from 'node:assert/strict';
import { exitCodeFor, summarize, buildReport, runCheck } from './smoke.lib.mjs';
const c = (id, severity, status) => ({ id, app: 'x', severity, status, detail: '', ms: 1 });
test('exit 0 when every P0 passes, even if a P1 fails', () => assert.equal(exitCodeFor([c('a', 'P0', 'pass'), c('b', 'P1', 'fail')]), 0));
test('exit 1 when any P0 fails', () => assert.equal(exitCodeFor([c('a', 'P0', 'pass'), c('b', 'P0', 'fail')]), 1));
test('exit 2 (infrastructure) wins over a failure: an errored run proves nothing', () => assert.equal(exitCodeFor([c('a', 'P0', 'fail'), c('b', 'P0', 'error')]), 2));
test('summary lists failed P0 and P1 ids separately', () => { const s = summarize([c('a', 'P0', 'fail'), c('b', 'P1', 'fail'), c('d', 'P0', 'pass')]); assert.deepEqual(s.p0Failed, ['a']); assert.deepEqual(s.p1Failed, ['b']); assert.equal(s.pass, 1); });
test('report carries schema, exit code and blocked writes', () => { const r = buildReport({ target: 'live', checks: [c('a', 'P0', 'fail')], startedAt: 't', blockedWrites: ['POST x'] }); assert.equal(r.schema, 'blueforge.books-smoke/1'); assert.equal(r.exitCode, 1); assert.deepEqual(r.blockedWrites, ['POST x']); });
test('runCheck: {ok:false} is a fail, a thrown error is an error, {ok:true} is a pass', async () => {
  assert.equal((await runCheck({ id: 'a', severity: 'P0' }, async () => ({ ok: false, detail: 'bad' }))).status, 'fail');
  assert.equal((await runCheck({ id: 'a', severity: 'P0' }, async () => { throw new Error('browser closed'); })).status, 'error');
  assert.equal((await runCheck({ id: 'a', severity: 'P0' }, async () => ({ ok: true }))).status, 'pass');
});
test('an empty run is a pass of nothing: exit 0 but total 0 (callers must treat total 0 as suspicious)', () => { assert.equal(summarize([]).total, 0); assert.equal(exitCodeFor([]), 0); });
