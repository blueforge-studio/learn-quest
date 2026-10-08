// Activity-book walker (read-only). One run = one profile through every chapter of one book.
//   BOOK=<id|all> PROFILE=perfect|struggling|hinter  node walk-activity.mjs
// Invariants checked per activity, from the content: correct answer adds the declared XP, a hint costs 3 XP and shows the declared hint,
// score and progress advance, the explanation is shown. NOTE: the live API currently breaks the app at load (see books doc); this
// walker needs the stub's audit-only COMPAT_WRAP_SCENES=1 shim to get past that, and records whether the shim was used.
import { launchBooks } from './lib-books.mjs';
import { CheckpointStore } from '../resume/checkpoint.mjs';
const BASE = process.env.BASE || 'http://localhost:3303'; const STUB = process.env.STUB || 'http://127.0.0.1:3009'; const PROFILE = process.env.PROFILE || 'perfect';
process.on('uncaughtException', (e) => { console.error('ERROR:', String(e?.message).split('\n')[0]); process.exit(/browser has been closed|Target crashed/i.test(String(e?.message)) ? 75 : 1); });
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim(); const get = async (u) => (await fetch(STUB + u)).json();
const ids = process.env.BOOK && process.env.BOOK !== 'all' ? [process.env.BOOK] : (await get('/api/content/manifest?type=activity')).books.map((b) => b.id);
for (const id of ids) await walkBook(id);
async function walkBook(bookId) {
  const chapters = (await get(`/api/content/${bookId}/chapters`)).chapters; const scenes = {}; for (const c of chapters) for (const sid of c.sceneIds) scenes[sid] = { ...(await get(`/api/content/${bookId}/scenes/${sid}`)), chapter: c.id };
  const dir = `runs/activity-${bookId}-${PROFILE}`; const store = new CheckpointStore(dir); const run = store.init({ meta: { walker: 'activity-1', bookId, profile: PROFILE } });
  console.log(`\n=== ${bookId} [${PROFILE}]: ${chapters.length} chapters, ${Object.keys(scenes).length} activities; run ${run.runId}`);
  const t0 = Date.now(); const { b, ctx, page, ledger } = await launchBooks({ baseUrl: BASE }); const findings = []; const visited = []; let outcome = 'completed'; let leaked = false; let workaroundUsed = false;
  const header = async () => { const t = norm(await page.locator('body').innerText()); const m = (re) => (t.match(re) || [])[1]; return { n: +m(/Activity (\d+) of \d+/), of: +m(/Activity \d+ of (\d+)/), score: +m(/Score: (\d+)\//), xp: +m(/Score: \d+\/\d+ (\d+) XP/), progress: +m(/Progress (\d+)%/), text: t }; };
  await page.goto(`/book/${bookId}`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(3500);
  if (!(await page.locator('main').innerHTML().catch(() => '')).length) { findings.push({ rule: 'blank-screen', detail: `book view renders an empty <main> (live API returns a bare array for ?chapter=, client reads .scenes)` }); outcome = 'blocked'; }
  else for (const [ci, ch] of chapters.entries()) {
    if (ci > 0) { // after a chapter's end screen: what does Continue do? then make sure we are on this chapter's first activity
      const firstQ = norm(scenes[ch.sceneIds[0]].content.question).slice(0, 50); const cont = page.getByRole('button', { name: /^continue$/i }).first();
      if (await cont.count()) { await cont.click(); await page.waitForTimeout(2500); }
      const onFirst = norm(await page.locator('body').innerText()).includes(firstQ);
      if (!onFirst) { findings.push({ rule: 'continue-after-chapter', scene: ch.sceneIds[0], detail: `after the chapter-complete screen, Continue did not lead to the next chapter's first activity (shows: "${norm(await page.locator('main').innerText().catch(() => '')).slice(0, 80)}")` }); await page.goto(`/book/${bookId}?chapter=${ci + 1}`, { waitUntil: 'domcontentloaded' }); workaroundUsed = true; await page.waitForTimeout(2500); } }
    for (const [k, sid] of ch.sceneIds.entries()) {
      const sc = scenes[sid]; const c = sc.content; const q = norm(c.question).slice(0, 50);
      const labels = c.options.map((o) => norm(o.text ?? o)); const tShow = Date.now();
      const optsReady = (ms) => page.waitForFunction((ls) => { const bs = [...document.querySelectorAll('button')].filter((x) => x.offsetParent && ls.includes(x.innerText.trim())); return bs.length === ls.length && bs.every((x) => !x.disabled); }, labels, { timeout: ms }).then(() => true).catch(() => false);
      let ready = await optsReady(k === 0 ? 12000 : 3500);
      if (!ready && k > 0) { // the next activity did not become answerable in-app: gather evidence once, then continue through a fresh deep link (audit workaround, labelled)
        if (!leaked) { leaked = true; const ev = await page.$$eval('button', (els, ls) => els.filter((x) => x.offsetParent && ls.includes(x.innerText.trim())).map((x) => `${x.innerText.trim()}:${x.disabled ? 'disabled' : 'enabled'}:${/red/.test(x.className) ? 'marked-wrong' : /green/.test(x.className) ? 'marked-right' : 'plain'}`), labels);
          findings.push({ rule: 'answer-state-leaks-into-next-activity', scene: sid, detail: `after answering the previous activity, this one loads already answered and locked: ${ev.join(', ')}. ActivityCard keeps answered/selected in useState and is rendered without key={activity.id}.` }); }
        await page.goto(`/book/${bookId}?chapter=${ci + 1}&scene=${sid}`, { waitUntil: 'domcontentloaded' }); workaroundUsed = true; await page.waitForTimeout(2500); ready = await optsReady(8000); }
      const ok = ready; const enabledAfter = Date.now() - tShow; if (ok && enabledAfter > 3000 && !workaroundUsed) findings.push({ rule: 'slow-to-answer', scene: sid, detail: `answer options stayed disabled for ${enabledAfter} ms after the question appeared` });
      const h0 = await header(); const expectXp = sc.rewards?.xp ?? 10; let hintDelta = null;
      if (h0.n !== k + 1 || h0.of !== ch.sceneIds.length) findings.push({ rule: 'progress-label', scene: sid, detail: `shows "Activity ${h0.n} of ${h0.of}", expected ${k + 1} of ${ch.sceneIds.length}` });
      if (PROFILE === 'hinter' || (PROFILE === 'struggling' && k === 0)) { const hb = page.getByRole('button', { name: /show hint/i }).first(); if (await hb.count()) { await hb.click(); await page.waitForTimeout(500); const hc = norm(await page.getByTestId('hint-content').innerText().catch(() => '')); const want = norm((c.hints || [])[0]?.text ?? (c.hints || [])[0]); if (want && !hc.includes(want.slice(0, 30))) findings.push({ rule: 'hint-text', scene: sid, detail: `hint shown "${hc.slice(0, 50)}" vs content "${want.slice(0, 50)}"` }); hintDelta = (await header()).xp - h0.xp; } }
      const wantWrong = PROFILE === 'struggling' && k % 2 === 0; const idx = wantWrong ? c.options.findIndex((_, i) => i !== c.correctAnswer) : c.correctAnswer; const label = norm(c.options[idx].text ?? c.options[idx]);
      try { await page.getByRole('button', { name: label, exact: true }).first().click({ timeout: 6000 }); } catch (e) { findings.push({ rule: 'click-failed', scene: sid, detail: `could not click option "${label}"; buttons: ${(await page.$$eval('button', (els) => els.filter((x) => x.offsetParent).map((x) => x.innerText.trim().slice(0, 18) + (x.disabled ? '(dis)' : '')))).join(' | ').slice(0, 220)}` }); outcome = 'blocked'; break; } await page.waitForTimeout(700);
      const h1 = await header(); const gained = h1.xp - (h0.xp + (hintDelta ?? 0));
      const expected = wantWrong ? 0 : expectXp; if (gained !== expected && !(h1.n !== h0.n && false)) findings.push({ rule: 'xp-awarded', scene: sid, detail: `${wantWrong ? 'wrong' : 'correct'} answer changed XP by ${gained}, expected ${expected}` });
      if (hintDelta != null && hintDelta !== -3) findings.push({ rule: 'hint-cost', scene: sid, detail: `hint changed XP by ${hintDelta}, button advertises -3` });
      const shown = norm(await page.locator('main').innerText().catch(() => '')); const expl = norm(c.explanation || '').slice(0, 30); if (expl && !shown.includes(expl)) findings.push({ rule: 'explanation-missing', scene: sid, detail: 'explanation not shown after answering' });
      visited.push({ scene: sid, chapter: ch.id, optionsEnabledAfterMs: enabledAfter, pick: wantWrong ? 'wrong' : 'correct', hint: hintDelta != null, xpAfter: h1.xp, score: h1.score, progress: h1.progress });
      await page.waitForTimeout(1800);
    }
    if (outcome === 'blocked') break;
    const end = norm(await page.locator('main').innerText().catch(() => '')); console.log(`  chapter ${ch.id} end screen: ${end.slice(0, 160)}`);
  }
  const led = await (await fetch(STUB + '/__ledger')).json(); await fetch(STUB + '/__reset', { method: 'POST' });
  const rec = { kind: 'run', runId: run.runId, bookId, profile: PROFILE, outcome, visited, findings, ms: Date.now() - t0, compatShimUsed: !!led.compat, deepLinkWorkaroundUsed: workaroundUsed, writesAttempted: led.writes.map((w) => `${w.method} ${w.url}`), blockedWrites: ledger.blockedWrites, errors: ledger.errors.slice(0, 4) };
  store.commit(rec, await ctx.storageState()); store.markFinished(); await b.close();
  console.log(`  ${outcome}: ${visited.length}/${Object.keys(scenes).length} activities in ${rec.ms} ms | compat shim: ${rec.compatShimUsed} | deep-link workaround: ${rec.deepLinkWorkaroundUsed} | writes attempted: ${rec.writesAttempted.length}`); for (const f of findings) console.log(`  FINDING ${f.rule} ${f.scene || ''}: ${f.detail}`);
}
