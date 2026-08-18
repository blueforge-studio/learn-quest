# School-Quest Production Readiness

Status as of 2026-04-13.

## Content

| Subject | Lessons | Valid | Chapters | Status |
|---------|---------|-------|----------|--------|
| Math | 40 | 40/40 (100%) | 5 | Complete |
| History | 52 | 52/52 (100%) | 5 | Complete |
| Geography | 40 | 40/40 (100%) | 5 | Complete |
| Science | 37 | 37/37 (100%) | 5 | Complete |
| Reading | 42 | 42/42 (100%) | 6 | Complete |
| Writing | 42 | 42/42 (100%) | 6 | Complete |

**Total**: 253 lessons, 253 valid (100%). All subjects at 100%.

## Deployment Config

- [x] `vercel.json` created for all 6 apps (Vite framework, SPA routing)
- [x] `.env.example` templates for all 6 apps
- [x] Chapter 6 registered in chapters.json (Reading + Writing)

## Image Assets

- [x] Category definitions exist (7 files in image-tools/categories/subjects/)
- [x] Config generation scaffolded (history, geography, math, science)
- [ ] Run image generation (requires GEMINI_API_KEY or GAMEVAULT_API_KEY)
- [ ] Reading/Writing image configs (categories exist but not in scaffolding subjects)
- [ ] Inject image references into lesson JSON

## Infrastructure Checklist

### Vercel Deployment
- [ ] Create `vercel.json` for each lq-* app (Vite framework config)
- [ ] Configure build command: `npm run build` (Vite outputs to `dist/`)
- [ ] Set output directory: `dist`
- [ ] Configure SPA routing: `rewrites: [{ source: "/(.*)", destination: "/index.html" }]`
- [ ] Link each app as separate Vercel project or monorepo config

### Environment Variables
- [ ] Create `.env.example` template for each app
- [ ] Set on Vercel dashboard:
  - `VITE_CONTENT_API_URL` (REST content source — replaces Supabase `sql` mode)
  - `VITE_AUTH_URL` (forge-auth)
  - `VITE_API_URL` (if backend needed)

### Storage Backend
- [x] Content served from on-prem Postgres via REST API (`@learnquest/content-source-rest`)
- [x] R2 (CloudFlare) for image + audio assets
- [x] lq-writing entitlements disabled — QuestShell skips paywall until a forge-auth-backed provider is wired

### Authentication (Forge Auth)
- [x] forge-auth service running at forge-auth.blueforge.studio
- [ ] Register school-quest apps in forge-auth
- [ ] Add auth client to school-quest shared config
- [ ] Implement login/signup flows per app

### Stripe Payments
- [x] Stripe keys exist (used by lingua-quest)
- [ ] Create school-quest products/prices in Stripe
- [ ] Implement chapter-gating monetization (free: ch1-2, paid: ch3+)
- [ ] Add subscription option ($50/mo for all subjects)

### CI/CD
- [x] sync-core.yml workflows exist for dependency syncing
- [ ] Add deployment workflows per subject app
- [ ] Add preview deployment for PRs

### Content Pipeline
- [x] Generation script improved (retry, quality checks, Zod validation)
- [x] Zod schemas for all 20+ lesson types
- [x] Content fixer script (fix-content-schemas.ts)
- [x] Validation script (validate-all-content.ts)
- [ ] Audio generation (edge-tts tooling exists, not run for school-quest)
- [ ] Image generation (configs scaffolded, generation blocked on API keys)

## Quick Start for Deployment

```bash
# 1. Validate all content
cd school-quest
npx tsx scripts/validate-all-content.ts

# 2. Fix any failing content
npx tsx scripts/fix-content-schemas.ts

# 3. Generate images (requires API key)
cd ../lq-tools/packages/asset-scaffolding
GEMINI_API_KEY=xxx npx tsx src/generate-assets.ts --subject=math

# 4. Deploy to Vercel (per app)
cd ../../school-quest/lq-math
vercel --prod
```
