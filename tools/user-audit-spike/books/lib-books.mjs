// Browser launcher for books audits: a context with a second safety layer on top of the stub.
// Any non-GET/HEAD/OPTIONS request to a host that is not local is ABORTED and recorded (never sent).
import { chromium } from '@playwright/test';
export const LOCAL = /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/;
export async function launchBooks({ baseUrl, viewport = { width: 430, height: 900 }, storageState } = {}) {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport, baseURL: baseUrl, ...(storageState ? { storageState } : {}) });
  const ledger = { blockedWrites: [], externalHosts: new Set(), errors: [], failedRequests: [] };
  await ctx.route('**/*', (route) => { const r = route.request(); let host = ''; try { host = new URL(r.url()).hostname; } catch {}
    if (!LOCAL.test(host)) ledger.externalHosts.add(host);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(r.method()) && !LOCAL.test(host)) { ledger.blockedWrites.push(`${r.method()} ${r.url().slice(0, 120)}`); return route.abort('blockedbyclient'); }
    return route.continue(); });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => ledger.errors.push('pageerror: ' + e.message.slice(0, 140)));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|CORS|favicon/.test(m.text())) ledger.errors.push('console: ' + m.text().slice(0, 140)); });
  page.on('response', (r) => { if (r.status() >= 400 && !/favicon/.test(r.url())) ledger.failedRequests.push(`${r.status()} ${r.request().method()} ${r.url().replace(/^https?:\/\/[^/]+/, '').slice(0, 90)}`); });
  return { b, ctx, page, ledger };
}
