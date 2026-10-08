#!/usr/bin/env node
// books-platform smoke test: read-only, anonymous, ~2 minutes. Run against production after a deploy, or on a schedule.
//   node smoke.mjs                       all apps against https://<app>.questbooks.blueforge.studio
//   SMOKE_ONLY=story,activity node smoke.mjs
//   SMOKE_API=http://127.0.0.1:3009 SMOKE_BASE_STORY=http://localhost:3302 ... node smoke.mjs   (local stack)
// Exit: 0 all P0 pass | 1 a P0 failed | 2 infrastructure error or too few checks ran. Report: smoke-report.json (blueforge.books-smoke/1).
// SAFETY: every browser context aborts any non-GET/HEAD/OPTIONS request to a non-local host (see lib-books.mjs) and lists what it blocked.
import fs from 'node:fs';
import { launchBooks } from './lib-books.mjs';
import { checkContent, BLOCKING } from './content-check-lib.mjs';
import { runCheck, buildReport, summarize } from './smoke.lib.mjs';
const API = process.env.SMOKE_API || 'https://api.questbooks.blueforge.studio'; const ONLY = (process.env.SMOKE_ONLY || '').split(',').filter(Boolean);
const base = (app) => process.env[`SMOKE_BASE_${app.toUpperCase()}`] || `https://${app}.questbooks.blueforge.studio`; const want = (g) => !ONLY.length || ONLY.includes(g);
const MIN_CHECKS = +(process.env.SMOKE_MIN_CHECKS || 10); const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const getJson = async (u) => { const r = await fetch(API + u); if (!r.ok) throw Object.assign(new Error(`${u} -> HTTP ${r.status}`), { http: r.status }); return r.json(); };
const startedAt = new Date().toISOString(); const checks = []; const blocked = [];
const add = async (spec, fn) => { const c = await runCheck(spec, fn); checks.push(c); console.log(`${c.status === 'pass' ? 'PASS ' : c.status === 'fail' ? 'FAIL ' : 'ERROR'} ${c.severity} ${c.id.padEnd(46)} ${String(c.ms).padStart(6)} ms  ${c.detail}`.trimEnd()); };
async function withPage(app, fn) { const { b, page, ledger } = await launchBooks({ baseUrl: base(app) }); try { return await fn(page); } finally { blocked.push(...ledger.blockedWrites.map((w) => `${app}: ${w}`)); await b.close(); } }
const go = async (page, path) => { try { await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 30000 }); return null; } catch (e) { if (/ERR_NAME|ERR_CONNECTION|ERR_ADDRESS|net::ERR|Timeout/.test(String(e.message))) return `unreachable: ${String(e.message).split('\n')[0].slice(0, 90)}`; throw e; } };
const vis = (page, tid) => page.getByTestId(tid).first().isVisible().catch(() => false); const press = (page, locator) => locator.first().evaluate((e) => e.click());

// ---- API (HTTP only) ----
if (want('api')) {
  for (const t of ['story', 'activity', 'interactive', 'adventure']) await add({ id: `api.manifest.${t}`, app: 'api', severity: 'P0' }, async () => { const d = await getJson(`/api/content/manifest?type=${t}`); return { ok: (d.books || []).length > 0, detail: `${(d.books || []).length} books` }; });
  await add({ id: 'api.books', app: 'api', severity: 'P0' }, async () => { try { await getJson('/api/books'); return { ok: true }; } catch (e) { if (e.http) return { ok: false, detail: e.message }; throw e; } });
  await add({ id: 'api.config.adventure-defaults', app: 'api', severity: 'P0' }, async () => { try { await getJson('/api/config/adventure-defaults?locale=en'); return { ok: true }; } catch (e) { if (e.http) return { ok: false, detail: e.message }; throw e; } });
  await add({ id: 'api.config.activity-defaults', app: 'api', severity: 'P1' }, async () => { try { await getJson('/api/config/activity-defaults?locale=en'); return { ok: true }; } catch (e) { if (e.http) return { ok: false, detail: e.message }; throw e; } });
}
// ---- content graph (static, no browser) ----
if (want('content')) await add({ id: 'content.graph', app: 'api', severity: 'P1' }, async () => { const { books, findings } = await checkContent({ api: API }); const bad = findings.filter((f) => BLOCKING.includes(f.rule)); const byRule = bad.reduce((a, f) => ((a[f.rule] = (a[f.rule] || 0) + 1), a), {}); return { ok: bad.length === 0, detail: bad.length ? `${bad.length} blocking finding(s) in ${new Set(bad.map((f) => f.book)).size}/${books.length} books: ${JSON.stringify(byRule)}` : `${books.length} books clean` }; });
// ---- story: each book reaches its first comprehension question ----
if (want('story')) { let first = true; for (const bk of (await getJson('/api/content/manifest?type=story').catch(() => ({ books: [] }))).books) { const sev = first ? 'P0' : 'P1'; first = false;
  await add({ id: `story.${bk.id}.reaches-first-question`, app: 'story', severity: sev }, () => withPage('story', async (page) => { const u = await go(page, `/book/${bk.id}`); if (u) return { ok: false, detail: u };
    for (let i = 0; i < 14; i++) { await page.waitForTimeout(600); if (await vis(page, 'story-error')) return { ok: false, detail: `story-error: ${norm(await page.getByTestId('story-error').innerText()).slice(0, 80)}` }; if (await vis(page, 'quiz-runner')) return { ok: true, detail: `${i} actions` };
      for (const t of ['book-intro-begin-btn', 'chapter-banner-continue', 'story-next-btn', 'story-continue-btn']) { const l = page.getByTestId(t); if (await l.count() && await l.first().isVisible().catch(() => false)) { await press(page, l); break; } } }
    return { ok: false, detail: 'did not reach the first question in 14 actions' }; })); } }
// ---- activity: opens, first activity shown and answerable, second activity answerable after the first answer ----
if (want('activity')) { const bk = (await getJson('/api/content/manifest?type=activity').catch(() => ({ books: [] }))).books[0];
  await add({ id: `activity.${bk?.id}.first-and-second-activity`, app: 'activity', severity: 'P0' }, () => withPage('activity', async (page) => {
    const chapters = (await getJson(`/api/content/${bk.id}/chapters`)).chapters; const [s1, s2] = await Promise.all(chapters[0].sceneIds.slice(0, 2).map((s) => getJson(`/api/content/${bk.id}/scenes/${s}`)));
    const labels = (s) => s.content.options.map((o) => norm(o.text ?? o)); const ready = (s, ms) => page.waitForFunction(({ q, ls }) => document.body.innerText.replace(/\s+/g, ' ').includes(q) && ls.every((l) => [...document.querySelectorAll('button')].some((b) => b.offsetParent && b.innerText.trim() === l && !b.disabled)), { q: norm(s.content.question).slice(0, 40), ls: labels(s) }, { timeout: ms }).then(() => true).catch(() => false);
    const u = await go(page, `/book/${bk.id}`); if (u) return { ok: false, detail: u };
    if (!(await ready(s1, 12000))) { const main = (await page.locator('main').innerHTML().catch(() => '')).length; return { ok: false, detail: main === 0 ? 'blank page: <main> is empty (no error shown)' : 'first activity not shown or its options are not enabled within 12 s' }; }
    await page.getByRole('button', { name: labels(s1)[s1.content.correctAnswer], exact: true }).first().click();
    if (!(await ready(s2, 7000))) return { ok: false, detail: 'second activity is not answerable after answering the first (locked or never shown)' };
    return { ok: true, detail: 'two activities answered in a row' }; })); }
// ---- interactive: the first comprehension question can be answered and the book moves on ----
if (want('interactive')) { const bk = (await getJson('/api/content/manifest?type=interactive').catch(() => ({ books: [] }))).books[0];
  await add({ id: `interactive.${bk?.id}.first-quiz-advances`, app: 'interactive', severity: 'P0' }, () => withPage('interactive', async (page) => {
    const chapters = (await getJson(`/api/content/${bk.id}/chapters`)).chapters; const scenes = []; for (const c of chapters) for (const s of c.sceneIds) scenes.push(await getJson(`/api/content/${bk.id}/scenes/${s}`));
    const quiz = scenes.find((s) => s.type === 'comprehension').content.comprehensionQuestion; const choice = scenes.find((s) => s.type === 'choice').content.choices[0].text;
    const u = await go(page, `/book/${bk.id}`); if (u) return { ok: false, detail: u };
    for (let i = 0; i < 16; i++) { await page.waitForTimeout(700); if (await vis(page, 'quiz-runner')) break;
      const start = page.getByRole('button', { name: /start reading/i }); const ch = page.getByRole('button', { name: choice.slice(0, 30), exact: false }); const cont = page.getByRole('button', { name: /^continue/i });
      if (await start.count()) await press(page, start); else if (await ch.count()) await press(page, ch); else if (await cont.count()) await press(page, cont); }
    if (!(await vis(page, 'quiz-runner'))) return { ok: false, detail: 'never reached the first comprehension question' };
    await page.getByTestId('quiz-runner').getByRole('button').nth(quiz.correctIndex).click();
    for (let i = 0; i < 12; i++) { await page.waitForTimeout(700); const cont = await page.getByRole('button', { name: /continue|next/i }).count(); if (!(await vis(page, 'quiz-runner')) || cont) return { ok: true, detail: 'moves on after the first answer' }; }
    return { ok: false, detail: 'dead end: options locked, no explanation, no Continue, no auto-advance for ~8 s after a correct answer' }; })); }
// ---- adventure: loads (config), then hero creation ----
if (want('adventure')) {
  await add({ id: 'adventure.loads-book-list', app: 'adventure', severity: 'P0' }, () => withPage('adventure', async (page) => { const u = await go(page, '/'); if (u) return { ok: false, detail: u }; await page.waitForTimeout(6000);
    const body = norm(await page.locator('body').innerText()); if (/Try Again|Failed to fetch/i.test(body)) return { ok: false, detail: `error screen: "${body.match(/Failed to fetch[^.]{0,30}|[^.]{0,40}Try Again/i)?.[0]?.trim()}"` };
    return { ok: await vis(page, 'book-catalogue'), detail: (await vis(page, 'book-catalogue')) ? 'book list shown' : 'no book list shown' }; }));
  await add({ id: 'adventure.opens-hero-creation', app: 'adventure', severity: 'P1' }, () => withPage('adventure', async (page) => { const u = await go(page, '/'); if (u) return { ok: false, detail: u }; await page.waitForTimeout(5000);
    const card = page.locator('[data-testid^="book-"]:not([data-testid="book-catalogue"])').first(); if (!(await card.count())) return { ok: false, detail: 'no book card to open' }; await press(page, card); await page.waitForTimeout(3000);
    const h = norm(await page.locator('h1').first().innerText().catch(() => '')); return { ok: /create your hero/i.test(h), detail: `heading: "${h.slice(0, 40)}"` }; }));
}
const report = buildReport({ target: { api: API, apps: ['story', 'activity', 'interactive', 'adventure'].map(base) }, checks, startedAt, blockedWrites: blocked, note: 'read-only anonymous; non-local writes are aborted by the browser guard' });
if (checks.length < MIN_CHECKS && !ONLY.length) { report.exitCode = 2; report.note += ` | only ${checks.length} checks ran (< ${MIN_CHECKS}): treated as an infrastructure error`; }
fs.writeFileSync(process.env.SMOKE_REPORT || 'smoke-report.json', JSON.stringify(report, null, 1));
const s = report.summary; console.log(`\nSUMMARY ${s.pass} pass, ${s.fail} fail, ${s.error} error of ${s.total} | P0 failed: ${s.p0Failed.join(', ') || 'none'} | P1 failed: ${s.p1Failed.join(', ') || 'none'} | writes blocked by the guard: ${blocked.length}${blocked.length ? ' (' + [...new Set(blocked.map((b) => b.replace(/^\w+: /, '').slice(0, 60)))].slice(0, 2).join('; ') + ')' : ''}\nEXIT ${report.exitCode}`);
process.exit(report.exitCode);
