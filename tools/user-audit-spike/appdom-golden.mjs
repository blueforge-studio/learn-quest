// Golden-flow observability probe: open a real lesson in a language app and step
// through it, recording the app-dom inventory per screen. Read-only against the dev
// server; writes appdom-golden.json (lq.appdom-inventory/1 shape, one entry per step).
import { writeFileSync } from 'node:fs';
import { launch, onboard, base } from './lib4.mjs';
import { observability } from './appdom-observe.mjs';
const id = process.argv[2] || 'concept-sounds';
// Real onboarding creates a real player (decision D6): a player-less seed makes
// LessonCompleteBar return null, so concept/MC screens would show no complete anchor.
const { b, page } = await launch();
await onboard(page);
const inventory = () => page.evaluate(() => {
  const nodes = [...document.querySelectorAll('[data-appdom-id]')].map((el) => ({ id: el.dataset.appdomId, type: el.dataset.appdomType, scope: el.dataset.appdomScope }));
  const seen = new Set(), dup = new Set(); nodes.forEach((n) => (seen.has(n.id) ? dup.add(n.id) : seen.add(n.id)));
  const inter = [...document.querySelectorAll('button, a[href], input, select, textarea, [role=button]')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
  return { appdom: nodes, testids: document.querySelectorAll('[data-testid]').length, interactive: inter.length,
    // app-root wraps the whole app, so only a non-root anchor counts as coverage
    interactiveInsideAppdom: inter.filter((e) => { const a = e.closest('[data-appdom-id]:not([data-appdom-id="app-root"])'); return !!a; }).length, duplicateIds: [...dup] };
});
await page.goto(`${base}/en/danish/chapters/chapter-1/${id}`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-appdom-id="lesson-layout"], [data-appdom-id="lesson-concept"]', { timeout: 60000 }).catch(() => console.log('no lesson anchor rendered'));
// An anchor may sit on the button itself (web-app concept screen) or on a wrapper (lesson-ui).
const anchor = (name) => page.locator(`button[data-appdom-id="${name}"], [data-appdom-id="${name}"] button`);
await page.waitForSelector('[data-appdom-id="lesson-next"], [data-appdom-id="lesson-complete"]', { timeout: 30000 }).catch(() => console.log('neither lesson-next nor lesson-complete rendered'));
const screens = {}; let driven = 0;
for (let step = 0; step < 15; step++) {
  screens[`step-${step}`] = await inventory();
  if (await anchor('lesson-complete').count()) { driven = step; break; }
  const next = anchor('lesson-next');
  if (!(await next.count())) { driven = -1; break; }
  await next.first().click({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(500);
}
const out = { schema: 'lq.appdom-inventory/1', url: page.url(), drivenToCompleteInSteps: driven, screens };
writeFileSync('appdom-golden.json', JSON.stringify(out, null, 2));
const ids = [...new Set(Object.values(screens).flatMap((s) => s.appdom.map((n) => n.id)))];
console.log('url', page.url(), '| driven via anchors to complete at step', driven);
console.log('anchors seen:', ids.join(', ') || '(none)');
const o = observability(out); console.log('observability', o.score, 'coverage', o.coverage, 'mainScopeShare', o.mainScopeShare);
await b.close();
