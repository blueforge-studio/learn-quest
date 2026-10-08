// Checkpoint store for resumable audit runs. Pure file logic (no browser), so crash behaviour is unit-testable.
//
// Layout (one directory per shard):   records.jsonl   append-only; one JSON object per line
//                                     snaps/snap-<seq>.json   Playwright storageState after step <seq>
//                                     run.json   { runId, startedAt, walkerVersion, ... }   finished.json  { at }
//
// Commit protocol (the record is the commit point):
//   1. write snaps/snap-<seq>.json to a temp file, fsync, rename   (atomic: the snapshot is whole or absent)
//   2. append the record line {seq, snapshot, ...} to records.jsonl, fsync
// A crash before (2) leaves an orphan snapshot that no record references: it is ignored and overwritten later.
// A crash during (2) can leave a torn last line: parsing ignores it, so that step simply counts as not done.
// Rollback: if the newest snapshot fails verification the runner appends {kind:'rollback', toSeq}; records with a
// higher seq before that marker are superseded, so a rolled-back step is redone exactly once in the effective view.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const fsyncPath = (p) => { const fd = fs.openSync(p, 'r+'); try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); } };

export class CheckpointStore {
  constructor(dir) { this.dir = dir; this.recordsFile = path.join(dir, 'records.jsonl'); this.snapDir = path.join(dir, 'snaps'); }

  /** Start or continue a run. `fresh` archives any previous run's files and starts clean. */
  init({ fresh = false, meta = {} } = {}) {
    fs.mkdirSync(this.snapDir, { recursive: true });
    const runFile = path.join(this.dir, 'run.json');
    if (fresh && fs.existsSync(this.recordsFile)) {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      fs.renameSync(this.recordsFile, path.join(this.dir, `records.${stamp}.jsonl`));
      fs.rmSync(path.join(this.dir, 'finished.json'), { force: true });
      fs.rmSync(runFile, { force: true });
      for (const f of fs.readdirSync(this.snapDir)) fs.rmSync(path.join(this.snapDir, f), { force: true });
    }
    const resumed = fs.existsSync(runFile) && this.records().length > 0;
    if (!fs.existsSync(runFile)) fs.writeFileSync(runFile, JSON.stringify({ runId: `run-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}-${crypto.randomBytes(3).toString('hex')}`, startedAt: new Date().toISOString(), ...meta }, null, 1));
    return { ...JSON.parse(fs.readFileSync(runFile, 'utf8')), resumed, finished: fs.existsSync(path.join(this.dir, 'finished.json')) };
  }

  /** Effective records: parsed, torn trailing line ignored, rollback markers applied. */
  records() {
    if (!fs.existsSync(this.recordsFile)) return [];
    const out = [];
    for (const line of fs.readFileSync(this.recordsFile, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      let r; try { r = JSON.parse(line); } catch { continue; } // a torn write (crash mid-append) is not a record
      if (r.kind === 'rollback') { while (out.length && out[out.length - 1].seq > r.toSeq) out.pop(); continue; }
      out.push(r);
    }
    return out;
  }

  nextSeq() { const rs = this.records(); return rs.length ? Math.max(...rs.map((r) => r.seq)) + 1 : 0; }

  /** Atomically persist the snapshot, then append the record that points at it. */
  commit(record, storageState) {
    const seq = this.nextSeq(); const name = `snap-${String(seq).padStart(4, '0')}.json`; const final = path.join(this.snapDir, name); const tmp = `${final}.tmp-${process.pid}`;
    fs.writeFileSync(tmp, JSON.stringify(storageState)); fsyncPath(tmp); fs.renameSync(tmp, final);
    if (this.hooks?.afterSnapshotBeforeRecord) this.hooks.afterSnapshotBeforeRecord(seq);
    const full = { ...record, seq, snapshot: name, committedAt: new Date().toISOString() };
    fs.appendFileSync(this.recordsFile, JSON.stringify(full) + '\n'); fsyncPath(this.recordsFile);
    return full;
  }

  /** Records whose snapshot file exists and parses, newest first. */
  candidates() {
    return this.records().filter((r) => r.snapshot).reverse().filter((r) => { try { JSON.parse(fs.readFileSync(path.join(this.snapDir, r.snapshot), 'utf8')); return true; } catch { return false; } });
  }
  snapshotPath(rec) { return path.join(this.snapDir, rec.snapshot); }

  /** The newest snapshot failed verification: supersede everything after `toSeq`. */
  rollback(toSeq, reason) { fs.appendFileSync(this.recordsFile, JSON.stringify({ kind: 'rollback', toSeq, reason, at: new Date().toISOString() }) + '\n'); fsyncPath(this.recordsFile); }

  /** Keep the newest `keep` snapshots plus the baseline (seq 0); delete the rest. Records stay. */
  prune(keep = 3) {
    const live = new Set(this.records().filter((r) => r.snapshot).map((r) => r.snapshot)); const sorted = [...live].sort();
    const keepSet = new Set([sorted[0], ...sorted.slice(-keep)]);
    for (const f of fs.readdirSync(this.snapDir)) if (f.endsWith('.json') && !keepSet.has(f)) fs.rmSync(path.join(this.snapDir, f), { force: true });
  }
  markFinished() { fs.writeFileSync(path.join(this.dir, 'finished.json'), JSON.stringify({ at: new Date().toISOString() })); }
}
