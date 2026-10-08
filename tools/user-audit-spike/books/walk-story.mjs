// Story-book journey walker (read-only). One run = one root-to-ending PATH through the book's scene graph.
//   BOOK=<id|all> PROFILE=perfect|struggling node walk-story.mjs      (RUN_DIR default runs/story-<book>-<profile>)
// Journey-level resume: a path already recorded as finished is skipped on rerun. (Mid-book resume is not possible for an
// anonymous reader: the app persists reading position only for signed-in users, and a book takes about a minute.)
import fs from 'node:fs';
import { launchBooks } from './lib-books.mjs';
import { CheckpointStore } from '../resume/checkpoint.mjs';
import { loadGraph, enumeratePaths, declaredEdges, matchScene, edgesOf } from './graph.mjs';
const BASE = process.env.BASE || 'http://localhost:3302'; const STUB = process.env.STUB || 'http://127.0.0.1:3009';
const norm = (x) => String(x ?? '').replace(/\s+/g, ' ').trim();
const PROFILE = process.env.PROFILE || 'perfect'; const MAXACT = +(process.env.MAXACT || 160);
const INFRA_RE = /Target page, context or browser has been closed|browser has been closed|Connection closed|Target crashed/i;
process.on('uncaughtException', (e) => { const infra = INFRA_RE.test(String(e?.message)); console.error(`${infra ? 'INFRA-ERROR (restart me)' : 'ERROR'}: ${String(e?.message).split('\n')[0]}`); process.exit(infra ? 75 : 1); });
const bookIds = process.env.BOOK && process.env.BOOK !== 'all' ? [process.env.BOOK] : (await (await fetch(STUB + '/api/content/manifest?type=story')).json()).books.map((b) => b.id);
for (const bookId of bookIds) await walkBook(bookId);

async function walkBook(bookId) {
  const g = await loadGraph(STUB, bookId); let paths = enumeratePaths(g); const dangling = [...g.scenes.values()].flatMap((sc) => edgesOf(sc).filter((e) => !g.scenes.has(e.to)).map((e) => `${sc.id}->${e.to}`));
  if (dangling.length) console.log(`  GRAPH DEFECT: ${dangling.length} dangling edge(s) (target scene does not exist), e.g. ${dangling.slice(0, 3).join(', ')}`);
  if (!paths.length) { console.log('  no enumerable path (graph broken): walking one UI-led path instead'); paths = [{ decisions: [], scenes: [] }]; } const dir = process.env.RUN_DIR || `runs/story-${bookId}-${PROFILE}`;
  const store = new CheckpointStore(dir); const run = store.init({ meta: { walker: 'story-1', bookId, profile: PROFILE } });
  const doneKeys = new Set(store.records().filter((r) => r.kind === 'path').map((r) => r.pathKey));
  console.log(`\n=== ${bookId}: ${g.scenes.size} scenes, ${declaredEdges(g).length} edges, ${paths.length} path(s); run ${run.runId}${run.resumed ? ' (RESUMED)' : ''}`);
  for (const [i, p] of paths.entries()) {
    const pathKey = p.decisions.map((d) => `${d.scene}=${d.pick}`).join('|') || 'linear';
    if (doneKeys.has(pathKey)) { console.log(`  path ${i + 1}/${paths.length} [${pathKey}] already recorded: skipped`); continue; }
    const rec = await walkPath(g, p, pathKey); const { b, ctx, ...clean } = rec; await ctx.storageState().then((s) => store.commit({ kind: 'path', pathKey, runId: run.runId, ...clean }, s)); await b.close();
    console.log(`  path ${i + 1}/${paths.length} [${pathKey}] ${rec.outcome}: ${rec.visited.length} scenes in ${rec.ms} ms${rec.reason ? ' - ' + rec.reason : ''}${rec.flags.length ? ' | flags: ' + rec.flags.slice(0, 3).join('; ') : ''}`);
  }
  const recs = store.records().filter((r) => r.kind === 'path'); const vis = new Set(recs.flatMap((r) => r.visited.map((v) => v.sceneId).filter(Boolean)));
  console.log(`  COVERAGE ${vis.size}/${g.scenes.size} scenes | paths finished ${recs.filter((r) => r.outcome === 'completed').length}/${paths.length}`); store.markFinished();
}

async function walkPath(g, path, pathKey) {
  const t0 = Date.now(); const { b, ctx, page, ledger } = await launchBooks({ baseUrl: BASE }); const plan = new Map(path.decisions.map((d) => [d.scene, d.pick]));
  const visited = []; const flags = []; const seenScenes = new Set(); let reason = null; let outcome = 'completed'; let lastSig = ''; let still = 0;
  const vis = (id) => page.getByTestId(id).first().isVisible().catch(() => false);
  const sig = async () => (await page.$$eval('[data-testid]', (els) => els.filter((e) => e.offsetParent !== null).map((e) => e.getAttribute('data-testid')).filter((t) => !/footer|locale|reader-settings|narration-(progress|time)|header|brand/.test(t)).join(',')) + '|' + ((await page.getByTestId('story-book-screen').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 160)));
  const note = (type, text, extra = {}) => { const m = matchScene(g, type, text); const sceneId = m?.id || null; if (m?.altered) flags.push(`text altered vs content in ${m.id}${m.page ? ' p' + m.page : ''} (case/punctuation differs from the content)`); const key = sceneId ? `${sceneId}${m.page ? ':p' + m.page : ''}` : `?${type}:${text.slice(0, 20)}`; if (!seenScenes.has(key)) { seenScenes.add(key); if (!(sceneId && visited.some((v) => v.sceneId === sceneId))) visited.push({ sceneId, type, ms: Date.now() - t0, ...(sceneId ? {} : { text: norm(text).slice(0, 90) }), ...extra }); if (!sceneId) flags.push(`unmatched ${type} scene`); } return sceneId; };
  const scan = async () => { const t = await page.evaluate(() => document.body.innerText); if (/\{\{.*?\}\}/.test(t)) flags.push('unresolved-template: ' + t.match(/.{0,15}\{\{.*?\}\}.{0,10}/)[0].replace(/\n/g, ' ')); const k = t.match(/\b(common|reader|book|story|quiz)\.[a-z_]{3,}\b/); if (k) flags.push('raw-i18n-key: ' + k[0]); };
  const click = (loc) => loc.first().evaluate((el) => el.click());
  await page.goto(`/book/${g.bookId}`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1500);
  for (let n = 0; n < MAXACT; n++) {
    await page.waitForTimeout(350); await scan(); const s = await sig(); if (s === lastSig) { still++; if (still >= 6) { outcome = 'blocked'; reason = 'no state change after 6 actions: ' + s.slice(0, 160); break; } } else still = 0; lastSig = s;
    if (await vis('story-error')) { outcome = 'blocked'; reason = 'story-error shown: ' + (await page.getByTestId('story-error').innerText()).replace(/\s+/g, ' ').slice(0, 120); break; }
    if (await vis('ending-screen')) { note('ending', await page.getByTestId('ending-screen').innerText()); await click(page.getByTestId('ending-screen').getByRole('button')); await page.waitForTimeout(500); break; }
    if (await vis('book-intro-begin-btn')) { await click(page.getByTestId('book-intro-begin-btn')); continue; }
    if (await vis('chapter-banner-continue')) { await click(page.getByTestId('chapter-banner-continue')); continue; }
    if (await vis('vocabulary-scene')) { const sid = note('vocab', await page.getByTestId('vocabulary-scene').innerText()); const words = await page.$$eval('[data-testid^="vocab-word-"]', (e) => e.map((x) => x.getAttribute('data-testid'))); for (const w of words) { await click(page.getByTestId(w).locator('button')); await page.waitForTimeout(150); } const cont = page.getByTestId('vocab-continue-btn'); if (await cont.isEnabled()) await click(cont); else flags.push(`vocab-continue-btn still disabled after opening ${words.length} words (${sid})`); continue; }
    if (await vis('choice-scene')) { const sid = note('choice', await page.getByTestId('choice-scene').innerText()); const pick = plan.get(sid) || (g.scenes.get(sid)?.content?.choices?.[0]?.id); await click(page.getByTestId(`choice-${pick}`)); continue; }
    if (await vis('quiz-runner')) { const text = await page.getByTestId('quiz-runner').innerText(); const sid = note('quiz', text); const c = g.scenes.get(sid)?.content; const btns = page.getByTestId('quiz-runner').getByRole('button'); if ((await btns.count()) && (await btns.first().isEnabled())) { const wantWrong = PROFILE === 'struggling' || plan.get(sid) === 'incorrect'; const idx = c ? (wantWrong ? (c.correctAnswer + 1) % c.options.length : c.correctAnswer) : 0; await click(btns.nth(idx)); await page.waitForTimeout(1200); } continue; }
    if (await vis('story-page')) { note('story', await page.getByTestId('story-page').innerText()); const nx = page.getByTestId('story-next-btn'); const ct = page.getByTestId('story-continue-btn'); if (await nx.count() && await nx.first().isEnabled()) await click(nx); else if (await ct.count() && await ct.first().isEnabled()) await click(ct); continue; }
  }
  if (outcome === 'completed' && !visited.some((v) => v.type === 'ending')) { outcome = 'blocked'; reason = reason || 'ended without reaching the ending screen'; }
  const led = await (await fetch(STUB + '/__ledger')).json(); await fetch(STUB + '/__reset', { method: 'POST' });
  return { b, ctx, outcome, reason, pathKey, visited, flags: [...new Set(flags)], ms: Date.now() - t0, writesAttempted: led.writes.map((w) => `${w.method} ${w.url}`), blockedWrites: ledger.blockedWrites, errors: ledger.errors.slice(0, 5), failedRequests: ledger.failedRequests.slice(0, 5), externalHosts: [...ledger.externalHosts] };
}
