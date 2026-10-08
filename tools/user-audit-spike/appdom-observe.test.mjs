import test from 'node:test';
import assert from 'node:assert/strict';
import { observability } from './appdom-observe.mjs';
const scr = (o) => ({ interactive: 10, interactiveInsideAppdom: 0, appdom: [], duplicateIds: [], ...o });
test('nothing measured is null, not 0', () => {
  assert.equal(observability({ screens: {} }).score, null);
  assert.equal(observability(undefined).score, null);
  assert.equal(observability({ screens: { a: { interactive: 0, appdom: [] } } }).score, null);
});
test('full coverage with a main scope scores 100', () => {
  const r = observability({ screens: { a: scr({ interactiveInsideAppdom: 10, appdom: [{ id: 'm', scope: 'main' }] }) } });
  assert.equal(r.score, 100);
});
test('chrome-only coverage scores low', () => {
  const r = observability({ screens: { a: scr({ interactiveInsideAppdom: 2, appdom: [{ id: 'h', scope: 'header' }] }) } });
  assert.equal(r.score, 14);
});
test('duplicate ids are penalised and the score never goes below 0', () => {
  const r = observability({ screens: { a: scr({ duplicateIds: ['x', 'y', 'z', 'w'] }) } });
  assert.equal(r.score, 0);
});
