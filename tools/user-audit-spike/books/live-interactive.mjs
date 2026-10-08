import { launchBooks } from './lib-books.mjs';
const BASE = process.env.BASE_URL || 'http://localhost:3304'; const SHOT = process.env.SHOT || 'interactive-wait.png';
const { b, page, ledger } = await launchBooks({ baseUrl: BASE });
const state = () => page.$$eval('button,[data-testid],h2,h3', (els) => els.filter((e) => e.offsetParent !== null).map((e) => `${e.getAttribute('data-testid') || e.tagName.toLowerCase()}=${(e.innerText || '').trim().replace(/\n/g, ' ').slice(0, 28)}${e.disabled ? '(dis)' : ''}`).filter((s) => !/^(footer|locale|theme|topbar)|^button=(Subscribe)?$/.test(s)));
await page.goto('/book/mystery-island', { waitUntil: 'domcontentloaded', timeout: 30000 }); await page.waitForTimeout(3500);
for (const name of ['Start Reading', 'Continue', 'Walk over and investigate the glittering object', 'Continue', 'Continue']) { await page.getByRole('button', { name, exact: false }).first().evaluate((e) => e.click()); await page.waitForTimeout(1100); }
await page.getByTestId('quiz-runner').waitFor({ timeout: 10000 });
await page.getByTestId('quiz-runner').getByRole('button').nth(2).click();   // the correct option (index 2)
const t0 = Date.now(); let moved = null;
for (let i = 0; i < 40; i++) { await page.waitForTimeout(1000); const s = await state(); if (!s.some((x) => /^quiz-runner/.test(x))) { moved = `${Math.round((Date.now() - t0) / 1000)} s -> ${s.slice(0, 5).join(' | ')}`; break; } }
console.log(BASE, '=>', moved ? 'ADVANCED after ' + moved : 'NO ADVANCE in 40 s; state: ' + (await state()).filter((x) => !/^button=[A-D]\./.test(x)).slice(0, 6).join(' | '));
console.log('blocked writes:', ledger.blockedWrites, '| errors:', ledger.errors.slice(0, 2), '| failed:', ledger.failedRequests.slice(0, 3)); await page.screenshot({ path: SHOT }); await b.close();
