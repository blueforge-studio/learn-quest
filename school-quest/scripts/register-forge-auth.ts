#!/usr/bin/env npx tsx
/**
 * Register school-quest apps with Forge Auth.
 *
 * Requires a forge-auth admin session. Either:
 * 1. Set FORGE_AUTH_SESSION cookie via env var
 * 2. Or run with --local to use localhost:3580
 *
 * Usage:
 *   FORGE_AUTH_SESSION=<cookie> npx tsx scripts/register-forge-auth.ts
 *   npx tsx scripts/register-forge-auth.ts --local
 *   npx tsx scripts/register-forge-auth.ts --dry-run
 */

const DRY_RUN = process.argv.includes('--dry-run');
const LOCAL = process.argv.includes('--local');
const BASE_URL = LOCAL ? 'http://localhost:3580' : 'https://auth.blueforge.studio';
const SESSION = process.env.FORGE_AUTH_SESSION;

const apps = [
  { name: 'School Quest - Math', slug: 'school-quest-math', port: 3200, domain: 'lq-math.vercel.app' },
  { name: 'School Quest - Science', slug: 'school-quest-science', port: 3201, domain: 'lq-science.vercel.app' },
  { name: 'School Quest - History', slug: 'school-quest-history', port: 3202, domain: 'lq-history.vercel.app' },
  { name: 'School Quest - Geography', slug: 'school-quest-geography', port: 3203, domain: 'lq-geography.vercel.app' },
  { name: 'School Quest - Reading', slug: 'school-quest-reading', port: 3204, domain: 'lq-reading.vercel.app' },
  { name: 'School Quest - Writing', slug: 'school-quest-writing', port: 3205, domain: 'lq-writing.vercel.app' },
];

async function registerApp(app: typeof apps[0]) {
  const body = {
    name: app.name,
    slug: app.slug,
    redirectUrls: [
      `http://localhost:${app.port}`,
      `http://localhost:${app.port}/auth/callback`,
      `https://${app.domain}`,
      `https://${app.domain}/auth/callback`,
    ],
    providers: ['google', 'github'],
  };

  if (DRY_RUN) {
    console.log(`  [dry-run] ${app.slug}: ${JSON.stringify(body, null, 2)}`);
    return;
  }

  try {
    const res = await fetch(`${BASE_URL}/api/admin/apps`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(SESSION ? { 'Cookie': `better-auth.session_token=${SESSION}` } : {}),
      },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const data = await res.json();
      console.log(`  ok ${app.slug} (id: ${data.app?.id ?? 'unknown'})`);
    } else {
      const text = await res.text();
      console.log(`  FAIL ${app.slug}: ${res.status} ${text.slice(0, 100)}`);
    }
  } catch (e) {
    console.log(`  ERROR ${app.slug}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function main() {
  console.log(`\nRegistering ${apps.length} school-quest apps with Forge Auth`);
  console.log(`  URL: ${BASE_URL}`);
  console.log(`  Session: ${SESSION ? 'provided' : 'none (will fail without auth)'}`);
  if (DRY_RUN) console.log('  [DRY RUN]\n');
  else console.log('');

  for (const app of apps) {
    await registerApp(app);
  }

  console.log(`\nDone. After registration, generate API keys for each app via:`);
  console.log(`  POST ${BASE_URL}/api/admin/apps/{id}/keys`);
  console.log(`\nThen add to each app's .env:`);
  console.log(`  VITE_FORGE_AUTH_URL=${BASE_URL}`);
  console.log(`  VITE_FORGE_AUTH_KEY=fk_live_xxx`);
}

main();
