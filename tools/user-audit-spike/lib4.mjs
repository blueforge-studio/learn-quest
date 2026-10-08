import { chromium } from '@playwright/test';
export const base = process.env.BASE_URL || 'http://localhost:3010';
export async function launch({ viewport = { width: 430, height: 900 }, storageState } = {}) {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport, ...(storageState ? { storageState } : {}) });
  await ctx.addInitScript(() => { if (!localStorage.getItem('lq-terms-accepted')) localStorage.setItem('lq-terms-accepted', '2026-08-27'); });
  const page = await ctx.newPage(); const log = { errors: [], writes: [] };
  page.on('pageerror', e => log.errors.push(e.message.slice(0, 140)));
  page.on('console', m => { if (m.type() === 'error' && !/CORS|lq-assets|Failed to load resource/.test(m.text())) log.errors.push('console: ' + m.text().slice(0, 140)); });
  page.on('request', r => { if (r.method() !== 'GET' && !/vite|hot-update/.test(r.url())) log.writes.push(r.method() + ' ' + r.url().slice(0, 80)); });
  return { b, ctx, page, log };
}
// Real onboarding -> a real player. profile: { language, proficiency, gender, name }
export async function onboard(page, { language = 'danish', proficiency = 'beginner', gender = 'female', name = 'AuditBot' } = {}) {
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await page.getByTestId(`language-option-${language}`).click();
  await page.getByTestId('welcome-next-button').click(); await page.getByTestId('welcome-next-button').click();
  await page.getByTestId(`proficiency-${proficiency}`).click(); await page.getByTestId('welcome-next-button').click();
  await page.getByTestId(`gender-option-${gender}`).click(); await page.getByTestId('character-name-input').fill(name);
  await page.getByTestId('character-continue-button').click();
  await page.waitForURL(/\/chapters\//, { timeout: 15000 });
}
export const player = (page) => page.evaluate(() => { try { const p = JSON.parse(localStorage.getItem('nordic_player')); return p && { xp: p.stats?.xp, totalXP: p.stats?.totalXP, level: p.stats?.level, done: p.progress?.completedLessons }; } catch { return 'unparsable'; } });
export const cards = (page) => page.$$eval('[data-testid^="lesson-card-"]', els => els.map(e => e.getAttribute('data-testid').slice(12) + ':' + e.getAttribute('data-status')));
