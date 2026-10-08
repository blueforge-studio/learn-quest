// READ-ONLY check against the deployed reader. Anonymous, no sign-in; the browser guard aborts any non-GET to a non-local host.
import { launchBooks } from './lib-books.mjs';
const BASE = process.env.LIVE_BASE || 'https://story.questbooks.blueforge.studio';
const { b, page, ledger } = await launchBooks({ baseUrl: BASE });
const ids = () => page.$$eval('[data-testid]', (els) => els.filter((e) => e.offsetParent !== null).map((e) => e.getAttribute('data-testid')));
await page.goto(process.env.LIVE_PATH || '/book/deep-sea-explorer', { waitUntil: 'domcontentloaded', timeout: 30000 }); await page.waitForTimeout(3000);
let outcome = 'no error seen';
for (let i = 0; i < 14; i++) {
  const t = await ids();
  if (t.includes('story-error')) { outcome = 'story-error: ' + (await page.getByTestId('story-error').innerText()).replace(/\s+/g, ' ').slice(0, 120); break; }
  const act = ['book-intro-begin-btn', 'chapter-banner-continue', 'story-next-btn', 'story-continue-btn'].find((x) => t.includes(x));
  if (!act) { outcome = 'stopped at: ' + t.filter((x) => !/footer|locale|reader/.test(x)).slice(0, 8).join(','); break; }
  await page.getByTestId(act).first().evaluate((e) => e.click()); await page.waitForTimeout(900);
}
console.log('LIVE', BASE + '/book/deep-sea-explorer', '=>', outcome); console.log('blocked writes:', ledger.blockedWrites, '| failed requests:', ledger.failedRequests.slice(0, 4));
await b.close();
