# CLAUDE.md — Lang Quest

## Overview

Container for 14 language-group learning apps. Each language is its own Vite app consuming shared packages from lq-core.

## Language Groups

| Group | Path |
|-------|------|
| African | `lq-african/` |
| Balkan | `lq-balkan/` |
| Celtic | `lq-celtic/` |
| East Asian | `lq-east-asian/` |
| English | `lq-english/` |
| Germanic | `lq-germanic/` |
| Middle Eastern | `lq-middle-eastern/` |
| Nordic | `lq-nordic/` |
| Romance | `lq-romance/` |
| Slavic | `lq-slavic/` |
| South Asian | `lq-south-asian/` |
| Southeast Asian | `lq-southeast-asian/` |
| Uralic | `lq-uralic/` |
| West Slavic | `lq-west-slavic/` |

## Dependencies

All language apps consume shared packages from lq-core (published to packr registry):
- `@learnquest/web-app` — React app shell
- `@learnquest/web-core` — Language bootstrap bridge
- `@learnquest/ui` — UI components
- `@learnquest/hooks` — React hooks

## Scaffolding

New language repos are scaffolded using `lq-operations` templates:
```bash
pnpm scaffold <group>
```

## Package Registry

All `@learnquest/*` packages are published to:
`https://api.packr.blueforge.studio`

## Shared Image Assets

Each group declares which cross-repo image tiers it uses in `lq.config.json`:

```json
{ "regions": ["universal", "african"] }
```

| Tier | Who uses it | Storage (dev) | Storage (prod) |
|------|-------------|---------------|----------------|
| `universal` | all groups | `public/_regional/universal/` (git-ignored) | CloudFlare R2: `_regional/universal/` |
| `asian`, `western`, `african`, `middle-eastern` | region-specific (scaffolded) | same pattern | same pattern |
| `_shared` (per-group, existing) | within one group's languages | `public/_shared/` (committed) | `<group>/_shared/` in R2 |

Regional assets are synced from the golden source at `lq-operations/assets/regional/` via
`lq-operations/scripts/sync-regional-assets.ts`. Lesson JSON references them as
`"image": "@regional/<region>/vocab/<category>/<word>.webp"`.

See `lq-operations/docs/REGIONAL_ASSETS.md` for the full design.
