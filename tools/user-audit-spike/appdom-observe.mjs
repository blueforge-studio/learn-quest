// Observability dimension for the user audit: how much of each screen an agent
// (or a golden-flow driver) can address through the app-dom attribute family.
// Input: lq.appdom-inventory/1 (written by the lq-core appdom-inventory spec).
// Null, never 0, when nothing was measured (same rule as report.mjs).
export function observability(inv) {
  const rows = Object.entries(inv?.screens ?? {}).map(([screen, s]) => {
    const total = s.interactive ?? 0;
    const covered = total ? (s.interactiveInsideAppdom ?? 0) / total : null;
    const dup = (s.duplicateIds ?? []).length;
    const scopes = new Set((s.appdom ?? []).map((n) => n.scope).filter(Boolean));
    // main-scope presence matters more than chrome: a screen whose content region is
    // not instrumented cannot be driven by id even if its header is.
    const hasMain = scopes.has('main');
    return { screen, covered, interactive: total, instrumented: (s.appdom ?? []).length, duplicates: dup, scopes: [...scopes], hasMain };
  });
  const measured = rows.filter((r) => r.covered !== null);
  if (!measured.length) return { score: null, checked: 0, rows };
  const cov = measured.reduce((a, r) => a + r.covered, 0) / measured.length;
  const main = measured.filter((r) => r.hasMain).length / measured.length;
  const dupPenalty = Math.min(30, measured.reduce((a, r) => a + r.duplicates, 0) * 10);
  const score = Math.max(0, Math.round(70 * cov + 30 * main - dupPenalty));
  return { score, checked: measured.length, coverage: +cov.toFixed(3), mainScopeShare: +main.toFixed(3), duplicatePenalty: dupPenalty, rows };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const fs = await import('node:fs');
  const r = observability(JSON.parse(fs.readFileSync(process.argv[2], 'utf8')));
  for (const x of r.rows) console.log(`${x.screen.padEnd(10)} ${x.instrumented} nodes  ${(x.covered === null ? 'n/a' : Math.round(x.covered * 100) + '%').padStart(4)} of ${x.interactive} interactive covered  main-scope:${x.hasMain}`);
  console.log(`observability: ${r.score ?? 'n/a (nothing measured)'}  (screens: ${r.checked})`);
}
