// Interactive-book walker (read-only). Content schema differs from the story book: content.text, choices[].nextSceneId,
// comprehensionQuestion{question,options,correctIndex}. Walks each choice path until the app stops responding, and records where.
import { launchBooks } from './lib-books.mjs';
import { CheckpointStore } from '../resume/checkpoint.mjs';
const BASE = process.env.BASE || 'http://localhost:3304'; const STUB = process.env.STUB || 'http://127.0.0.1:3009';
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim(); const get = async (u) => (await fetch(STUB + u)).json();
const ids = process.env.BOOK && process.env.BOOK !== 'all' ? [process.env.BOOK] : (await get('/api/content/manifest?type=interactive')).books.map((b) => b.id);
for (const bookId of ids) {
  const chapters = (await get(`/api/content/${bookId}/chapters`)).chapters; const scenes = new Map(); for (const c of chapters) for (const sid of c.sceneIds) scenes.set(sid, { ...(await get(`/api/content/${bookId}/scenes/${sid}`)), chapterId: c.id });
  const order = chapters.flatMap((c) => c.sceneIds); const firstChoice = order.find((s) => scenes.get(s).type === 'choice'); const choices = scenes.get(firstChoice).content.choices;
  const dir = `runs/interactive-${bookId}`; const store = new CheckpointStore(dir); const run = store.init({ meta: { walker: 'interactive-1', bookId } });
  console.log(`\n=== ${bookId}: ${scenes.size} scenes, ${[...scenes.values()].filter((s) => s.type === 'choice').length} choice scenes, ${[...scenes.values()].filter((s) => s.type === 'ending').length} endings; first choice ${firstChoice} has ${choices.length} options`);
  for (const [ci, ch] of choices.entries()) {
    const { b, ctx, page, ledger } = await launchBooks({ baseUrl: BASE }); const reached = []; let blockedAt = null; let outcome = 'blocked'; const t0 = Date.now();
    const seen = (text) => { for (const s of scenes.values()) { const t = norm(s.content?.text || s.content?.comprehensionQuestion?.question || ''); if (t && norm(text).toLowerCase().includes(t.toLowerCase().slice(0, 40))) { if (!reached.includes(s.id)) reached.push(s.id); return s.id; } } return null; };
    await page.goto(`/book/${bookId}`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(3500);
    for (let n = 0; n < 40; n++) {
      await page.waitForTimeout(700); const body = await page.locator('body').innerText(); const sid = seen(body);
      const q = await page.getByTestId('quiz-runner').isVisible().catch(() => false); const end = await page.getByTestId('ending-screen').isVisible().catch(() => false);
      if (end) { outcome = 'completed'; break; }
      if (q) { const cs = scenes.get(sid) || [...scenes.values()].find((s) => s.type === 'comprehension' && body.includes(s.content.comprehensionQuestion.question)); const idx = cs?.content?.comprehensionQuestion?.correctIndex ?? 0; if (!reached.includes(cs?.id)) cs && reached.push(cs.id);
        await page.getByTestId('quiz-runner').getByRole('button').nth(idx).click(); await page.waitForTimeout(8000); const still = await page.getByTestId('quiz-runner').isVisible().catch(() => false); const cont = await page.getByRole('button', { name: /continue|next/i }).count();
        if (still && !cont) { blockedAt = cs?.id; break; } continue; }
      const startBtn = page.getByRole('button', { name: /start reading/i }); if (await startBtn.count()) { await startBtn.first().evaluate((e) => e.click()); continue; }
      const choiceBtns = page.locator('main button, [data-testid="choice-scene"] button').filter({ hasText: choices[ci].text.slice(0, 20) }); if (sid && scenes.get(sid)?.type === 'choice') { const cc = scenes.get(sid).content.choices; const pick = sid === firstChoice ? ci : 0; await page.getByRole('button', { name: cc[pick].text.slice(0, 30), exact: false }).first().evaluate((e) => e.click()); continue; }
      const cont = page.getByRole('button', { name: /^continue/i }).first(); if (await cont.count()) { await cont.evaluate((e) => e.click()); continue; }
      blockedAt = sid || 'unknown'; break;
    }
    const rec = { kind: 'path', pathKey: `${firstChoice}=${choices[ci].id}`, bookId, outcome, reached, blockedAt, choiceText: choices[ci].text.slice(0, 60), ms: Date.now() - t0, blockedWrites: ledger.blockedWrites, errors: ledger.errors.slice(0, 3) };
    store.commit(rec, await ctx.storageState()); await b.close(); console.log(`  path ${firstChoice}=${choices[ci].id} ("${choices[ci].text.slice(0, 40)}"): ${outcome}; reached ${reached.join(',')}${blockedAt ? '; STUCK at ' + blockedAt + ' (answered correctly, no way forward for 8 s)' : ''}`);
  }
  store.markFinished();
}
