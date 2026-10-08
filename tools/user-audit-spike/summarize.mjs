import fs from 'node:fs';
for (const ch of [1, 2, 3, 4, 5]) { const f = `walk3-ch${ch}.jsonl`; if (!fs.existsSync(f)) continue;
  const r = fs.readFileSync(f, 'utf8').trim().split('\n').map(JSON.parse).filter(x => x.type);
  const ok = r.filter(x => x.outcome === 'completed'); const ms = r.reduce((a, x) => a + x.ms, 0);
  console.log(`\n## chapter ${ch}: ${ok.length}/${r.length} completed, ${Math.round(ms / 1000)}s total`);
  for (const x of r.filter(x => x.outcome !== 'completed')) console.log(`  BLOCKED ${x.lesson} (${x.type}) — ${x.reason} ${x.pos ? '@ ' + x.pos : ''}`);
  for (const x of r.filter(x => x.uiFlags?.length)) console.log(`  FLAG ${x.lesson}: ${x.uiFlags.join('; ')}`);
  for (const x of r.filter(x => x.infra?.length)) console.log(`  INFRA ${x.lesson}: ${x.infra.join('; ')}`);
  const xp = new Set(r.filter(x => x.outcome === 'completed').map(x => x.xpDelta + '/' + x.declaredXp)); console.log('  xp delta/declared combos:', [...xp].join(', '));
}
