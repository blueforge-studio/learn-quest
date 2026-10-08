// P0 walker v4 = v3 + RESUME: storageState snapshot after every lesson, atomic commit (snapshot, then record), verified
// resume from the newest valid snapshot, rollback of stale ones, crash injection for tests (CRASH_AT=phase:seq).
// Usage: CHAPTER=5 node walk4.mjs         (continues automatically if runs/<lang>-ch5 has records)
//        FRESH=1 ...                      (archive the old run and start over)
//        CRASH_AT=after-commit:8 | before-record:5 | mid-lesson:12   (SIGKILLs itself; for tests)
//        OUT=file.jsonl                   (also mirror records there, for the summary/report scripts)
import fs from 'node:fs'; import { execSync } from 'node:child_process';
import { launch, onboard, cards, base } from './lib4.mjs';
import { CheckpointStore } from './resume/checkpoint.mjs';
const CH = +(process.env.CHAPTER || 1); const LANG = process.env.LANG_APP || 'danish'; const OUT = process.env.OUT || null; const MAX = +(process.env.MAX || 40);
const content = (id) => { const f = `../public/data/lessons/en/${LANG}/chapters/chapter-${CH}/${id}.json`; if (!fs.existsSync(f)) return null;
  const j = JSON.parse(fs.readFileSync(f)); return Array.isArray(j.lessons) ? j.lessons[0] : Object.values(j.lessons)[0]; };
const RUN_DIR = process.env.RUN_DIR || `runs/${LANG}-ch${CH}`; const FRESH = process.env.FRESH === '1'; const CRASH_AT = process.env.CRASH_AT || '';
// Browser/driver death is INFRASTRUCTURE, not a lesson result: never record it as a block; exit 75 so the supervisor restarts us.
const INFRA_RE = /Target page, context or browser has been closed|browser has been closed|Browser closed|Connection closed|browser has disconnected|Target crashed|Protocol error|Session closed/i;
process.on('uncaughtException', (e) => { const infra = INFRA_RE.test(String(e?.message)); console.error(`${infra ? 'INFRA-ERROR (restart me)' : 'ERROR'}: ${String(e?.message).split('\n')[0]}`); process.exit(infra ? 75 : 1); });
const crashPoint = (phase, n) => CRASH_AT === `${phase}:${n}`; const die = () => process.kill(process.pid, 'SIGKILL');
const store = new CheckpointStore(RUN_DIR); let run = store.init({ fresh: FRESH, meta: { walkerVersion: 4, lang: LANG, chapter: CH } });
if (run.finished) { console.log(`run ${run.runId} already finished (${RUN_DIR}); set FRESH=1 to redo`); process.exit(0); }
store.hooks = { afterSnapshotBeforeRecord: (seq) => { if (crashPoint('before-record', seq)) die(); } };
let b, ctx, page, log;
const newSession = async (storageState) => { ({ b, ctx, page, log } = await launch({ storageState })); };
const snap = () => ctx.storageState({ indexedDB: true });
const st = () => page.evaluate(() => { const p = JSON.parse(localStorage.getItem('nordic_player') || 'null'); return p && { xp: p.stats?.xp, level: p.stats?.level, done: p.progress?.completedLessons?.length, ids: p.progress?.completedLessons || [] }; });
const go = async (u) => { for (let i = 0; ; i++) { try { return await page.goto(u, { waitUntil: 'domcontentloaded' }); } catch (e) { if (i >= 3) throw e; infra.push('goto-retry: ' + e.message.split('\n')[0].slice(0, 80)); await page.waitForTimeout(1500); } } };
const infra = [];
const crashed = () => page.getByText('Something went wrong').count();
const has = async (tid) => (await page.getByTestId(tid).count()) > 0;
const click = async (loc, ms = 4000) => { await loc.click({ timeout: ms }); await page.waitForTimeout(250); };
let pos = '';
const stuck = () => page.$$eval('button,input,[role=button],[data-testid]', els => els.filter(e => e.offsetParent).map(e => (e.getAttribute('data-testid') || e.tagName) + '=' + ((e.innerText || e.value || '').trim().replace(/\n/g, ' ').slice(0, 20))).filter(s => !/Terms|Privacy|language-sel|theme|brand|logo|top-bar|bottom-nav|^DIV|^BUTTON=×|container|wrapper|avatar/.test(s)).slice(0, 45));
const ADV = ['complete-lesson-button', 'lesson-complete-btn', 'tonal-finish-learn', 'lesson-next-btn', 'activity-next', 'tonal-next', 'sp-intro-next', 'sp-sort-next', 'sp-faded-next', 'tonal-after-compare'];
async function advance() {
  if (await has('dialogue-choice-0')) { pos = 'dialogue choice'; await click(page.getByTestId('dialogue-choice-0')); return 'dialogue-choice'; }
  for (const t of ADV) { const l = page.getByTestId(t); if (await l.count() && await l.first().isEnabled()) { await l.first().click(); await page.waitForTimeout(400); return t; } }
  const g = page.getByRole('button', { name: /^(continue|next|finish|complete|done|next stage)\b/i }).filter({ hasNot: page.locator('[disabled]') }).first(); if (await g.count()) { await g.click(); await page.waitForTimeout(400); return 'generic:' + (await g.innerText().catch(() => '')).slice(0, 12); } return null; }
async function tileOrder() { return page.evaluate(() => { const bs = [...document.querySelectorAll('button')].filter(e => e.offsetParent); const r = bs.findIndex(e => e.innerText.trim() === 'Reset'); const out = [];
  let i = r - 1; while (i >= 0) { const t = bs[i].innerText.trim(); if (t === '‹') { i--; continue; } out.unshift(t); if (!(i > 0 && bs[i - 1].innerText.trim() === '‹')) break; i--; } return out; }); }
const drivers = {
  async 'multiple-choice'(l) { const qs = l.content.questions; for (const [i, q] of qs.entries()) { pos = `mc q${i}`; const lab = q.prompt || q.sentence; const t = page.getByText(lab, { exact: false });
      if (await t.count()) { const blk = t.first().locator(`xpath=ancestor::*[count(.//button)>=${q.options.length}][1]`); await click(blk.getByRole('button', { name: String(q.correctAnswer), exact: true }).first()); }
      else { pos += ' (offset)'; const flat = qs.flatMap((x) => x.options.map(String)); const texts = await page.$$eval('button', (els) => els.map((e) => e.innerText.trim()));
        let st = -1; for (let a = 0; a + flat.length <= texts.length; a++) { if (flat.every((t, k) => texts[a + k] === t)) { st = a; break; } }
        if (st < 0) throw new Error('option run not found in DOM'); const off = qs.slice(0, i).reduce((n, x) => n + x.options.length, 0); await click(page.locator('button').nth(st + off + q.options.map(String).indexOf(String(q.correctAnswer)))); } } return qs.length + ' answers'; },
  async spelling(l) { for (const [i, w] of l.content.words.entries()) { pos = `spell ${i}`; await page.locator('input').first().fill(w.word); await click(page.getByRole('button', { name: 'Check', exact: true })); await page.waitForTimeout(300); const n = page.getByTestId('activity-next'); if (await n.count() && await n.isEnabled()) await click(n); } return l.content.words.length + ' words'; },
  async 'word-order'(l) { for (const [ei, e] of l.content.exercises.entries()) { const target = e.correctSentence.split(' ');
      for (let i = 0; i < target.length; i++) { pos = `wo ex${ei} slot${i} '${target[i]}'`; const cur = await tileOrder(); let j = cur.indexOf(target[i], i); if (j < 0) throw new Error('tile not found: ' + target[i] + ' in ' + cur.join('|'));
        while (j > i) { await click(page.getByRole('button', { name: '‹', exact: true }).nth(j - 1)); j--; } }
      await click(page.getByRole('button', { name: 'Check', exact: true })); await page.waitForTimeout(300); const n = page.getByTestId('activity-next'); if (await n.count() && await n.isEnabled()) await click(n); } return l.content.exercises.length + ' sentences'; },
  async drill(l) { const all = l.content.progressiveStages.flatMap(s => s.questions); let n = 0;
    for (let k = 0; k < 40; k++) { if (await has('stage-complete')) { pos = 'drill stage-complete'; const nx = page.getByTestId('lesson-next-btn'); if (await nx.count()) { await click(nx); continue; } break; }
      if (!(await has('drill-question'))) break; const txt = (await page.getByTestId('drill-question').first().innerText()).trim().split('\n')[0]; const norm = (z) => z.replace(/\s+/g, ' ').trim(); const q = all.find(x => norm(x.prompt) === norm(txt)) || all.find(x => norm(txt).startsWith(norm(x.prompt).slice(0, 25))); pos = `drill ${q?.id || '?'}`; if (!q) throw new Error('question not in content: ' + txt.slice(0, 40));
      await click(page.getByTestId('options-list').getByText(String(q.correctAnswer), { exact: true }).first()); n++; await page.waitForTimeout(700); await advance(); }
    return n + ' drill answers'; },
  async 'sound-pattern'(l) { const words = l.content.words; for (let i = 0; i < 4 && await has('sp-intro-card'); i++) { pos = 'intro page ' + i; if (!(await advance())) break; await page.waitForTimeout(300); }
    for (let k = 0; k < 20; k++) { await page.getByTestId('sp-sort-card').waitFor({ timeout: 3000 }).catch(() => {}); if (!(await has('sp-sort-card'))) break; const txt = (await page.getByTestId('sp-play-word').first().innerText()).trim().toLowerCase();
      const w = words.find(x => txt.startsWith(x.word.toLowerCase())); const gid = w?.graphemes?.find(g => g.soundId)?.soundId; pos = `sort ${w?.word}->${gid}`; if (!gid) throw new Error('no bucket for ' + txt.slice(0, 30));
      await click(page.getByTestId(`sp-bucket-${gid}`)); let a = null; for (let r = 0; r < 4 && !a; r++) { await page.waitForTimeout(500); a = await advance(); } if (!a) break; } return 'sorted'; },
};
const uiScan = () => page.evaluate(() => { const t = document.body.innerText; const f = []; if (/\{\{.*?\}\}/.test(t)) f.push('unresolved-template: ' + t.match(/.{0,20}\{\{.*?\}\}.{0,10}/)[0].replace(/\n/g, ' ')); const k = t.match(/\b(lessons|common|errors)\.[a-z_]+\b/); if (k) f.push('raw-i18n-key: ' + k[0]); return f; });
const doneIds = () => new Set(store.records().filter((r) => r.lesson && (r.outcome === 'completed' || r.skipped)).map((r) => r.lesson));
const prevIds = []; for (let c = 1; c < CH; c++) { const d = `../public/data/lessons/en/${LANG}/chapters/chapter-${c}`; if (fs.existsSync(d)) prevIds.push(...fs.readdirSync(d).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5))); }
async function freshStart() {
  await newSession(); await onboard(page, { name: 'WalkerBot' });
  if (prevIds.length) { await page.evaluate((ids) => { const p = JSON.parse(localStorage.getItem('nordic_player')); p.progress.completedLessons = ids; localStorage.setItem('nordic_player', JSON.stringify(p)); }, prevIds); console.log('seeded', prevIds.length, 'completed lessons from chapters 1..' + (CH - 1)); }
  store.commit({ kind: 'baseline', note: 'after onboarding' + (prevIds.length ? ` + seed(1..${CH - 1})` : '') }, await snap());
}
async function verify() { // is the loaded state consistent with the records? (a stale snapshot would make us redo or skip a lesson)
  await go(`${base}/en/${LANG}/chapters/chapter-${CH}`); await page.waitForSelector('[data-testid="lesson-map-screen"]', { timeout: 15000 }).catch(() => {}); await page.waitForTimeout(600);
  const s = await st(); if (!s) return { ok: false, reason: 'no player in restored state' };
  const done = doneIds(); const missing = [...done].filter((id) => !s.ids.includes(id)); if (missing.length) return { ok: false, reason: `snapshot lacks ${missing.length} recorded lessons (e.g. ${missing[0]})` };
  const cur = (await cards(page)).find((c) => c.endsWith(':current'))?.split(':')[0]; if (cur && done.has(cur)) return { ok: false, reason: `current card ${cur} is already recorded as done` };
  return { ok: true, note: cur ? `next card ${cur}, ${done.size} lessons already done` : `no current card, ${done.size} lessons done` };
}
async function bootstrap() {
  if (run.resumed) {
    for (const cand of store.candidates()) {
      await newSession(store.snapshotPath(cand)); const v = await verify();
      if (v.ok) { console.log(`RESUMED run ${run.runId} from seq ${cand.seq} (${cand.lesson || cand.kind}); ${v.note}`); return; }
      console.log(`snapshot seq ${cand.seq} (${cand.lesson || cand.kind}) failed verification: ${v.reason}; rolling back`); await b.close(); store.rollback(cand.seq - 1, v.reason);
    }
    console.log('no snapshot could be verified; starting this chapter fresh (old records archived)'); run = store.init({ fresh: true, meta: { walkerVersion: 4, lang: LANG, chapter: CH } });
  }
  await freshStart();
}
await bootstrap(); let finished = false; let incomplete = null;
for (let n = 0; n < MAX; n++) {
  await go(`${base}/en/${LANG}/chapters/chapter-${CH}`); await page.waitForSelector('[data-testid="lesson-map-screen"]'); await page.waitForTimeout(600);
  let cardsNow = await cards(page); let cur = cardsNow.find(c => c.endsWith(':current'));
  for (let r = 0; !cur && r < 3; r++) { await page.waitForTimeout(1500); await go(`${base}/en/${LANG}/chapters/chapter-${CH}`); await page.waitForSelector('[data-testid="lesson-map-screen"]', { timeout: 15000 }).catch(() => {}); await page.waitForTimeout(800); cardsNow = await cards(page); cur = cardsNow.find(c => c.endsWith(':current')); }
  if (!cur) { const notDone = cardsNow.filter(c => !c.endsWith(':completed'));
    if (notDone.length) { console.log(`INCOMPLETE: no current card but ${notDone.length} of ${cardsNow.length} map cards are not completed (e.g. ${notDone.slice(0, 3).join(', ')}); not marking the chapter finished`); incomplete = notDone; }
    else { console.log(`no current card; all ${cardsNow.length} map cards completed -> end of chapter map`); finished = true; } break; }
  const id = cur.split(':')[0]; const seq = store.nextSeq(); const l = content(id); const type = l?.type || 'unknown'; const t0 = Date.now(); const before = await st(); const e0 = log.errors.length; const trace = []; const ui = new Set(); let reason = null; pos = '';
  await go(`${base}/en/${LANG}/chapters/chapter-${CH}/${id}`); await page.waitForTimeout(700);
  if (crashPoint('mid-lesson', seq)) setTimeout(die, 1200);
  if (crashPoint('kill-browser', seq)) setTimeout(() => { try { execSync(`pkill -9 -P ${process.pid}`); } catch {} }, 1500);
  try {
    if (drivers[type]) trace.push(`${type}:${await drivers[type](l)}`);
    for (let k = 0; k < 120; k++) { for (const f of await uiScan()) ui.add(f); if (await crashed()) { reason = 'screen-crash: ' + ((await page.innerText('body')).match(/Cannot read[^\n]*|TypeError[^\n]*/)?.[0] || ''); break; }
      const s = await st(); if (s.ids.includes(id) && !before.ids.includes(id)) break; if (await has('level-up-continue-button')) { trace.push('level-up'); break; } const a = await advance(); if (!a) break; trace.push(a); }
  } catch (e) { if (INFRA_RE.test(String(e?.message))) throw e; reason = (await crashed()) ? 'screen-crash: ' + ((await page.innerText('body')).match(/Cannot read[^\n]*/)?.[0] || '') : 'driver-error: ' + e.message.split('\n')[0].slice(0, 120); }
  const after = await st(); const ok = after.ids.includes(id) && !before.ids.includes(id);
  const rec = { lesson: id, type, outcome: ok ? 'completed' : 'blocked', reason: ok ? null : (reason || 'no-advance-control'), pos: ok ? undefined : pos, ms: Date.now() - t0, xpDelta: after.xp - before.xp, levelBefore: before.level, levelAfter: after.level, declaredXp: l?.xpReward ?? null, trace: trace.slice(0, 5), uiFlags: [...ui], infra: infra.splice(0), newErrors: log.errors.slice(e0), stuckControls: ok ? undefined : await stuck().catch(() => null) };
  if (!ok) { await page.evaluate((lid) => { const p = JSON.parse(localStorage.getItem('nordic_player')); p.progress.completedLessons.push(lid); localStorage.setItem('nordic_player', JSON.stringify(p)); }, id); rec.skipped = true; }
  rec.runId = run.runId; const full = store.commit(rec, await snap()); store.prune(3); if (OUT) fs.appendFileSync(OUT, JSON.stringify(rec) + '\n');
  console.log(`#${String(full.seq).padStart(2)}`, rec.outcome.padEnd(9), type.padEnd(16), id.padEnd(34), String(rec.ms).padStart(5) + 'ms', 'xp+' + rec.xpDelta + '/' + rec.declaredXp, rec.reason || '', rec.reason ? ('@' + pos) : '', rec.uiFlags.length ? '⚑ ' + rec.uiFlags.join('; ') : '', rec.skipped ? '[skipped to continue]' : '');
  if (crashPoint('after-commit', full.seq)) die();
}
if (finished) store.markFinished(); if (incomplete) { fs.writeFileSync(`${RUN_DIR}/incomplete.json`, JSON.stringify({ at: new Date().toISOString(), cards: incomplete })); process.exitCode = 3; } console.log(finished ? `chapter ${CH} finished (run ${run.runId})` : `stopped before the end of chapter ${CH} (MAX reached)`); await b.close();
