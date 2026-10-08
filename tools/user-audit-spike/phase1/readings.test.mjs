import test from 'node:test'; import assert from 'node:assert/strict';
import { buildReadings, assertPushable, gateName, RefusedError, KIND } from './readings.mjs';
// Synthetic fixture (NOT a real run): shape of blueforge.user-audit/1, just enough for the mapping.
const base = () => ({ schema: 'blueforge.user-audit/1', generatedAt: '2026-10-06T12:00:00.000Z', runId: 'ua-test-1', build: { repo: 'lq-nordic', head: 'f72552ef', target: 'ci preview' },
  cell: { app: 'lq-nordic', language: 'danish', l1: 'en', segment: 'casual-adult' }, scope: { walkedLessons: 123 }, total: 93.94, finalScore: 60,
  dimensions: [{ id: 'completability', score: 95.1 }, { id: 'game_mechanics', score: 100 }, { id: 'assistance', score: null }] });
const NOW = new Date('2026-10-06T12:30:00Z');

test('default pushes only total + completability (+ floor-gated dimensions); the rest is reported as not pushed', () => {
  const { envelopes, notPushed } = buildReadings(base(), { now: NOW });
  assert.deepEqual(envelopes.map((e) => e.payload.gate.split('.').pop()), ['completability', 'total']);
  assert.deepEqual(notPushed, ['game-mechanics'.replace('-', '_'), 'raw-total']);
  const g = 'learner.lq-nordic.danish.en.casual-adult.game-mechanics';
  const gated = buildReadings(base(), { now: NOW, floors: { [g]: 80 } }).envelopes.map((e) => e.payload.gate.split('.').pop());
  assert.deepEqual(gated, ['completability', 'game-mechanics', 'total']);
});
test('--all maps every measured dimension, skips null ones (never pushed as 0), adds total and raw-total', () => {
  const { envelopes, skipped } = buildReadings(base(), { now: NOW, all: true });
  assert.deepEqual(envelopes.map((e) => e.payload.gate.split('.').pop()), ['completability', 'game-mechanics', 'total', 'raw-total']);
  assert.deepEqual(skipped.map((s) => s.dimension), ['assistance']);
});
test('gate names are lowercase [a-z0-9.-] and underscores become hyphens', () => {
  const g = gateName({ app: 'lq-nordic', language: 'Danish', l1: 'en', segment: 'Casual Adult' }, 'game_mechanics');
  assert.equal(g, 'learner.lq-nordic.danish.en.casual-adult.game-mechanics'); assert.match(g, /^[a-z0-9.-]+$/);
});
test('headline total is the gated score, raw-total keeps the raw one', () => {
  const m = Object.fromEntries(buildReadings(base(), { now: NOW, all: true }).envelopes.map((e) => [e.payload.gate.split('.').pop(), e.payload.score]));
  assert.equal(m.total, 60); assert.equal(m['raw-total'], 93.9);
});
test('payload is exactly {gate, score, floor, checked}; kind is the existing audit.score', () => {
  for (const e of buildReadings(base(), { now: NOW, all: true }).envelopes) { assert.deepEqual(Object.keys(e.payload).sort(), ['checked', 'floor', 'gate', 'score']); assert.equal(e.kind, KIND); assert.match(e.kind, /^[a-z]+\.[a-z-]+$/); assert.equal(e.payload.checked, 123); }
});
test('empty scope is refused, like the ingest (422), not pushed as zero', () => {
  const r = base(); r.scope.walkedLessons = 0; assert.throws(() => buildReadings(r, { now: NOW }), RefusedError);
});
test('scores outside 0-100 or non-finite are refused', () => {
  for (const bad of [101, -1, NaN, 'x']) { const r = base(); r.dimensions[0].score = bad; assert.throws(() => buildReadings(r, { now: NOW }), RefusedError); }
});
test('floor defaults to 0 (none ratcheted) and can be overridden per gate', () => {
  const g = 'learner.lq-nordic.danish.en.casual-adult.completability';
  assert.equal(buildReadings(base(), { now: NOW }).envelopes[0].payload.floor, 0);
  assert.equal(buildReadings(base(), { now: NOW, floors: { [g]: 90 } }).envelopes[0].payload.floor, 90);
  assert.throws(() => buildReadings(base(), { now: NOW, floors: { [g]: -5 } }), RefusedError);
});
test('envelope identity: commit sha, producer/source, measured_at not ahead of the clock', () => {
  const e = buildReadings(base(), { now: NOW, producer: 'gitea-actions:lq-nordic' }).envelopes[0];
  assert.match(e.commit, /^[0-9a-f]{7,64}$/); assert.equal(e.source, 'user-audit-run:ua-test-1'); assert.equal(e.producer, 'gitea-actions:lq-nordic'); assert.equal(buildReadings(base(), { now: NOW }).envelopes[0].producer, 'gitea-actions:lq-nordic');
  const r = base(); r.generatedAt = '2026-10-06T14:00:00Z'; assert.throws(() => buildReadings(r, { now: NOW }), RefusedError);
  const s = base(); s.build.head = 'zzz'; assert.throws(() => buildReadings(s, { now: NOW }), RefusedError);
});
test('wrong report schema is refused', () => { const r = base(); r.schema = 'other/1'; assert.throws(() => buildReadings(r, { now: NOW }), RefusedError); });
test('deterministic: same report builds identical readings (retry-safe, matches ingest dedupe)', () => {
  assert.deepEqual(buildReadings(base(), { now: NOW }), buildReadings(base(), { now: NOW }));
});
test('push needs all three env vars and refuses a local-dev report unless --allow-local', () => {
  const full = { APP_DEVDB_URL: 'u', APP_DEVDB_PROJECT: 'p', APP_DEVDB_SECRET: 's' };
  assert.throws(() => assertPushable(base(), { env: {} }), RefusedError);
  assert.doesNotThrow(() => assertPushable(base(), { env: full }));
  const local = base(); local.build.target = 'local dev (vite), not a deployed host';
  assert.throws(() => assertPushable(local, { env: full }), RefusedError);
  assert.doesNotThrow(() => assertPushable(local, { env: full, allowLocal: true }));
});
test('gate is the series key: normalisation is idempotent and ignores case/whitespace variants (control: they would be separate latest rows)', () => {
  const a = gateName({ app: 'LQ-Nordic ', language: ' Danish', l1: 'EN', segment: 'Casual Adult' }, 'Game_Mechanics');
  const b = gateName({ app: 'lq-nordic', language: 'danish', l1: 'en', segment: 'casual-adult' }, 'game-mechanics');
  assert.equal(a, b); assert.equal(a, a.trim()); assert.ok(a.length <= 300);
});
