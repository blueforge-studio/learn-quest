#!/usr/bin/env node
// Materialize each lq-*/blueforge.config.json as a FULL standalone config from
// the lang-quest project source. Idempotent — safe to re-run.
//
// Asset shape follows docs/ASSET_RESOLUTION.md (decided 2026-09-01) and the
// lq-nordic revert d4cdc420 (2026-09-02):
//   - primary is cloudflare_r2 on the SHARED `lq-assets` bucket — the one the
//     R2 custom domain serves; a per-app bucket is unreachable through it.
//   - minio is a mirror into the per-family `<group>-quest-assets` bucket.
//   - push prefixes must mirror the runtime read path (`<group>` is
//     interpolated here); `public/data` is deliberately NOT pushed (ships in
//     the image) and nothing pulls.
//
// Per-app overrides in lang-quest/blueforge.config.json:
//   push  — full push list (default: shared assets.push + spec.extraPush)
//   pull  — full pull list (default: shared assets.pull)
//   extraEnv — merged onto the standard VITE_* env
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const langQuestRoot = dirname(dirname(fileURLToPath(import.meta.url))) // lang-quest/
const sourcePath = join(langQuestRoot, 'blueforge.config.json')
const source = JSON.parse(readFileSync(sourcePath, 'utf-8'))
const { assets, apps } = source

const COMMON_IGNORE = [
  '.git', 'node_modules', 'dist', '.next', 'lib', '.turbo', 'coverage',
  '.env*.local', '.env.local', '.idea', '.vscode', '*.log', '.local', '*.local',
  '.sync-state', '.superpowers', '.audit-cache.sqlite*', 'audit-results',
]

/** Interpolate the `<group>` token (lq-nordic → nordic) in prefix/bucket strings. */
const groupOf = (appDir) => appDir.replace(/^lq-/, '')
const fillGroup = (value, group) =>
  typeof value === 'string' ? value.replaceAll('<group>', group) : value
const fillGroupDeep = (value, group) => {
  if (Array.isArray(value)) return value.map((v) => fillGroupDeep(v, group))
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fillGroupDeep(v, group)]))
  return fillGroup(value, group)
}

for (const [appDir, spec] of Object.entries(apps)) {
  const group = groupOf(appDir)
  const bucket = spec.bucket
  const out = {
    name: spec.name,
    ignore: [...new Set([...COMMON_IGNORE, ...(spec.ignore ?? [])])],
    infra: fillGroupDeep(spec.infra, group),
    assets: {
      primary: fillGroupDeep(assets.primary, group),
      mirrors: (assets.mirrors ?? []).map((m) => ({ ...fillGroupDeep(m, group), bucket })),
      push: (spec.push ?? [...assets.push, ...(spec.extraPush ?? [])]).map((p) =>
        fillGroupDeep(p, group)),
      ...(() => {
        const pull = (spec.pull ?? assets.pull ?? []).map((p) => fillGroupDeep(p, group))
        return pull.length ? { pull } : {} // empty pull is omitted — matches canonical nordic
      })(),
    },
    audit: spec.audit ?? { enabled: true, flows: ['site-landing'], failOn: ['critical', 'major'], timeout: 120 },
    phases: { postBuild: [] }, // legacy R2 script dropped — assetSync phase is canonical
    hetzner: {
      target: 'hetzner',
      server: 'hetzner-prod-1',
      registry: 'ghcr.io/blueforge-studio',
      caddyEmail: 'ops@blueforge.studio',
      packageManager: 'pnpm',
      apps: {
        web: {
          path: '.', type: 'vite', port: 80,
          domains: spec.domains,
          dependencies: { s3: 'cloudflare-r2' },
          healthcheck: '/',
          secrets: [],
          env: {
            VITE_CLOUD_ASSETS: 'true',
            VITE_ASSETS_BASE_URL: 'https://lq-assets.blueforge.studio',
            ...(spec.extraEnv ?? {}),
          },
        },
      },
    },
  }
  const target = join(langQuestRoot, appDir, 'blueforge.config.json')
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, JSON.stringify(out, null, 2) + '\n')
  console.log(`generated ${target}`)
}
console.log(`done — ${Object.keys(apps).length} app configs materialized`)
