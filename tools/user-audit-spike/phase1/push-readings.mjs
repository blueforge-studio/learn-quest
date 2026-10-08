#!/usr/bin/env node
// usage: node push-readings.mjs <report.json> [--floors floors.json] [--ref main] [--producer id] [--push] [--allow-local]
// DRY RUN by default: prints the readings it would send. --push also needs APP_DEVDB_URL / APP_DEVDB_PROJECT /
// APP_DEVDB_SECRET (same env as forge-dev's push-devdb-reading.mjs). Exit: 0 ok, 1 refused/failed.
import fs from 'node:fs';
import { buildReadings, assertPushable, RefusedError } from './readings.mjs';

const a = process.argv.slice(2);
const file = a.find((x) => !x.startsWith('--') && a[a.indexOf(x) - 1] !== '--floors' && a[a.indexOf(x) - 1] !== '--ref' && a[a.indexOf(x) - 1] !== '--producer');
const opt = (n, d) => (a.includes(n) ? a[a.indexOf(n) + 1] : d);
if (!file) { console.error('usage: push-readings.mjs <report.json> [--floors f.json] [--ref main] [--producer id] [--push] [--allow-local] [--all]'); process.exit(1); }
const doPush = a.includes('--push');
try {
  const report = JSON.parse(fs.readFileSync(file, 'utf8'));
  const floors = opt('--floors') ? JSON.parse(fs.readFileSync(opt('--floors'), 'utf8')) : {};
  const { envelopes, skipped, notPushed } = buildReadings(report, { project: process.env.APP_DEVDB_PROJECT || '<project-uuid>', floors, ref: opt('--ref', 'main'), all: a.includes('--all'), producer: opt('--producer', process.env.APP_DEVDB_PRODUCER) });
  console.log(`${envelopes.length} audit.score readings for ${report.cell.app}/${report.cell.language}/${report.cell.l1}/${report.cell.segment} @ ${report.build.head} (run ${report.runId})`);
  for (const e of envelopes) console.log(`  ${e.payload.gate.padEnd(66)} score ${String(e.payload.score).padStart(5)}  floor ${e.payload.floor}  checked ${e.payload.checked}`);
  if (notPushed.length) console.log(`  not pushed (kept in the run artifact; use --all): ${notPushed.join(', ')}`);
  for (const s of skipped) console.log(`  skipped ${s.dimension}: ${s.reason}`);
  if (!doPush) { console.log('\nDRY RUN: nothing sent. Re-run with --push (and APP_DEVDB_* set) to send.'); process.exit(0); }
  assertPushable(report, { allowLocal: a.includes('--allow-local') });
  let stored = 0, deduped = 0;
  for (const e of envelopes) {
    const res = await fetch(process.env.APP_DEVDB_URL, { method: 'POST', headers: { Authorization: `Bearer ${process.env.APP_DEVDB_SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify(e) });
    const text = await res.text(); if (!res.ok) throw new Error(`ingest ${res.status} for ${e.payload.gate}: ${text.slice(0, 300)}`);
    (JSON.parse(text).deduped ? deduped++ : stored++);
  }
  console.log(`pushed: ${stored} stored, ${deduped} deduped`);
} catch (e) { console.error(`push-readings: ${e instanceof RefusedError ? 'REFUSED: ' : ''}${e.message}`); process.exit(1); }
