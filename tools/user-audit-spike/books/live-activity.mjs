// READ-ONLY check of the deployed activity reader (anonymous; non-local writes are aborted by the guard).
import { launchBooks } from './lib-books.mjs';
const BASE = 'https://activity.questbooks.blueforge.studio';
const { b, page, ledger } = await launchBooks({ baseUrl: BASE });
page.on('response', (r) => { if (/\/api\/content\//.test(r.url())) console.log('  RESP', r.status(), r.url().replace(/^https?:\/\/[^/]+/, '').slice(0, 80)); });
await page.goto('/book/math-adventures', { waitUntil: 'domcontentloaded', timeout: 30000 }); await page.waitForTimeout(6000);
console.log('LIVE', BASE + '/book/math-adventures');
console.log('  <main> html length:', (await page.locator('main').innerHTML().catch(() => '')).length, '| visible testids:', await page.$$eval('[data-testid]', (e) => e.map((x) => x.getAttribute('data-testid')).filter((t) => !/footer|topbar|theme|locale/.test(t)).slice(0, 6)));
console.log('  body text (first 160):', (await page.innerText('body')).replace(/\s+/g, ' ').slice(0, 160)); console.log('  blocked writes:', ledger.blockedWrites, '| errors:', ledger.errors.slice(0, 2));
await page.screenshot({ path: 'live-activity.png' }); await b.close();
