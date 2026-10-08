import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { CheckpointStore } from './checkpoint.mjs';
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ckpt-'));
const state = (n) => ({ cookies: [], origins: [{ origin: 'http://x', localStorage: [{ name: 'step', value: String(n) }] }] });

test('init creates a run id; a second init on a dir with records is a resume with the SAME run id', () => {
  const d = tmp(); const a = new CheckpointStore(d); const r1 = a.init(); assert.equal(r1.resumed, false);
  a.commit({ kind: 'baseline' }, state(0)); const r2 = new CheckpointStore(d).init(); assert.equal(r2.resumed, true); assert.equal(r2.runId, r1.runId);
});
test('commit writes snapshot then record; seq increments; candidates are newest first', () => {
  const s = new CheckpointStore(tmp()); s.init(); s.commit({ kind: 'baseline' }, state(0)); s.commit({ lesson: 'a', outcome: 'completed' }, state(1)); s.commit({ lesson: 'b', outcome: 'completed' }, state(2));
  assert.deepEqual(s.records().map((r) => r.seq), [0, 1, 2]); assert.deepEqual(s.candidates().map((r) => r.lesson ?? 'baseline'), ['b', 'a', 'baseline']);
  assert.equal(JSON.parse(fs.readFileSync(s.snapshotPath(s.candidates()[0]), 'utf8')).origins[0].localStorage[0].value, '2');
});
test('crash between snapshot and record leaves an ignorable orphan: the step counts as not done and is redone with the same seq', () => {
  const s = new CheckpointStore(tmp()); s.init(); s.commit({ kind: 'baseline' }, state(0));
  s.hooks = { afterSnapshotBeforeRecord() { throw new Error('SIGKILL'); } }; assert.throws(() => s.commit({ lesson: 'a' }, state(1)), /SIGKILL/);
  const s2 = new CheckpointStore(s.dir); assert.deepEqual(s2.records().map((r) => r.seq), [0]); assert.equal(s2.nextSeq(), 1);
  const rec = s2.commit({ lesson: 'a', outcome: 'completed' }, state(1)); assert.equal(rec.seq, 1); // overwrote the orphan snapshot
  assert.equal(JSON.parse(fs.readFileSync(s2.snapshotPath(rec), 'utf8')).origins[0].localStorage[0].value, '1');
});
test('a torn last line (crash mid-append) is ignored; earlier records survive', () => {
  const s = new CheckpointStore(tmp()); s.init(); s.commit({ kind: 'baseline' }, state(0)); s.commit({ lesson: 'a', outcome: 'completed' }, state(1));
  fs.appendFileSync(s.recordsFile, '{"lesson":"b","outcome":"compl'); // no newline, truncated JSON
  assert.deepEqual(new CheckpointStore(s.dir).records().map((r) => r.seq), [0, 1]);
});
test('a missing or corrupt snapshot file drops that record from candidates but not from records', () => {
  const s = new CheckpointStore(tmp()); s.init(); s.commit({ kind: 'baseline' }, state(0)); const r1 = s.commit({ lesson: 'a' }, state(1)); const r2 = s.commit({ lesson: 'b' }, state(2));
  fs.rmSync(s.snapshotPath(r2)); fs.writeFileSync(s.snapshotPath(r1), '{not json'); assert.deepEqual(s.candidates().map((r) => r.seq), [0]); assert.equal(s.records().length, 3);
});
test('rollback supersedes later records so a rolled-back step is redone exactly once in the effective view', () => {
  const s = new CheckpointStore(tmp()); s.init(); s.commit({ kind: 'baseline' }, state(0)); s.commit({ lesson: 'a' }, state(1)); s.commit({ lesson: 'b' }, state(2));
  s.rollback(1, 'newest snapshot failed verification'); assert.deepEqual(s.records().map((r) => r.lesson ?? 'baseline'), ['baseline', 'a']); assert.equal(s.nextSeq(), 2);
  s.commit({ lesson: 'b', outcome: 'completed' }, state(2)); assert.deepEqual(s.records().map((r) => r.lesson ?? 'baseline'), ['baseline', 'a', 'b']);
});
test('fresh archives the previous run and starts clean with a new run id', () => {
  const d = tmp(); const s = new CheckpointStore(d); const r1 = s.init(); s.commit({ kind: 'baseline' }, state(0)); s.markFinished();
  const r2 = new CheckpointStore(d).init({ fresh: true }); assert.equal(r2.resumed, false); assert.equal(r2.finished, false); assert.notEqual(r2.runId, r1.runId);
  assert.equal(new CheckpointStore(d).records().length, 0); assert.ok(fs.readdirSync(d).some((f) => /^records\..+\.jsonl$/.test(f)));
});
test('finished marker is reported on re-init so a completed run is not silently redone', () => {
  const d = tmp(); const s = new CheckpointStore(d); s.init(); s.commit({ kind: 'baseline' }, state(0)); s.markFinished(); assert.equal(new CheckpointStore(d).init().finished, true);
});
test('prune keeps the baseline and the newest K snapshots, never touches records', () => {
  const s = new CheckpointStore(tmp()); s.init(); for (let i = 0; i < 8; i++) s.commit(i ? { lesson: `l${i}` } : { kind: 'baseline' }, state(i));
  s.prune(3); assert.deepEqual(fs.readdirSync(s.snapDir).sort(), ['snap-0000.json', 'snap-0005.json', 'snap-0006.json', 'snap-0007.json']); assert.equal(s.records().length, 8);
  assert.deepEqual(s.candidates().map((r) => r.seq), [7, 6, 5, 0]);
});
