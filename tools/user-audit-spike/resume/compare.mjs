// node compare.mjs <referenceRunDir> <runDir>...   : effective records of each run must equal the reference's.
import { CheckpointStore } from './checkpoint.mjs';
import fs from 'node:fs';
const [refDir, ...dirs] = process.argv.slice(2);
const view = (d) => new CheckpointStore(d).records().filter((r) => r.lesson).map((r) => `${r.lesson}:${r.outcome}${r.skipped ? '+skipped' : ''}`);
const ref = view(refDir); let bad = 0;
console.log(`reference ${refDir}: ${ref.length} lessons, ${ref.filter((x) => x.includes(':completed')).length} completed`);
for (const d of dirs) {
  const got = view(d); const dup = got.filter((x, i) => got.indexOf(x) !== i); const same = JSON.stringify(got) === JSON.stringify(ref);
  const store = new CheckpointStore(d); const runIds = new Set(store.records().map((r) => r.runId).filter(Boolean)); const finished = fs.existsSync(`${d}/finished.json`);
  const rolled = fs.readFileSync(`${d}/records.jsonl`, 'utf8').split('\n').filter((l) => l.includes('"kind":"rollback"')).length;
  const lastSnap = JSON.parse(fs.readFileSync(store.snapshotPath(store.candidates()[0]), 'utf8')); const ids = JSON.parse(lastSnap.origins[0].localStorage.find((x) => x.name === 'nordic_player').value).progress.completedLessons.length;
  const expectRb = (process.env.EXPECT_ROLLBACK || '').split(',').includes(d); const rbOk = expectRb ? rolled >= 1 : rolled === 0;
  const ok = same && !dup.length && runIds.size === 1 && finished && rbOk; if (!ok) bad++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${d}: ${got.length} lessons | identical to reference: ${same} | duplicates: ${dup.length} | run ids: ${runIds.size} | finished: ${finished} | rollbacks: ${rolled} (${expectRb ? 'expected >=1' : 'expected 0'}: ${rbOk ? 'ok' : 'WRONG'}) | player completed (last snapshot): ${ids}`);
  if (!same) { const miss = ref.filter((x) => !got.includes(x)); const extra = got.filter((x) => !ref.includes(x)); console.log('   missing:', miss.slice(0, 5), 'extra:', extra.slice(0, 5)); }
}
process.exit(bad ? 1 : 0);
