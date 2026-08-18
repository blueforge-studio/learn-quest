#!/usr/bin/env node
// Materialize each lq-*/blueforge.config.json as a FULL standalone config from
// the lang-quest project source. Idempotent — safe to re-run.
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

for (const [appDir, spec] of Object.entries(apps)) {
  const bucket = spec.bucket
  const out = {
    name: spec.name,
    ignore: [...new Set([...COMMON_IGNORE, ...(spec.ignore ?? [])])],
    infra: spec.infra,
    assets: {
      primary: { provider: 'minio', bucket },
      mirrors: assets.mirrors.map((m) => ({ ...m, bucket })),
      push: spec.push ?? [...assets.push, ...(spec.extraPush ?? [])],
      pull: spec.pull ?? assets.pull,
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
