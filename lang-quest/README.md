# Language Quest apps

Thin wrappers apps over `lq-core`. Each app should import `@learnquest/web-core` and `@learnquest/web-app` from `lq-core` via the packr registry (`https://api.packr.blueforge.studio`).

The language apps (language quests) can be integrated with the school app `BrightPath`, just like subject apps.

## Language-Specific Repos (lang-quest)

`lang-quest/` is a **container** holding one git repo per language family:

| Language Group | Path |
|----------------|------|
| African | `lang-quest/lq-african/` |
| Balkan | `lang-quest/lq-balkan/` |
| Celtic | `lang-quest/lq-celtic/` |
| East Asian | `lang-quest/lq-east-asian/` |
| English | `lang-quest/lq-english/` |
| Germanic | `lang-quest/lq-germanic/` |
| Middle Eastern | `lang-quest/lq-middle-eastern/` |
| Nordic | `lang-quest/lq-nordic/` |
| Romance | `lang-quest/lq-romance/` |
| Slavic | `lang-quest/lq-slavic/` |
| South Asian | `lang-quest/lq-south-asian/` |
| Southeast Asian | `lang-quest/lq-southeast-asian/` |
| Uralic | `lang-quest/lq-uralic/` |
| West Slavic | `lang-quest/lq-west-slavic/` |
## Brand: one mark, fourteen repos

Every group repo deploys as its own control-plane app, but they are one
product on blueforge.studio (`lang-quest`). forge-control reads
`blueforge.product.yml` from the repo it deploys, so each group repo carries
the sidecar and the mark it references. Do not edit those copies:

```bash
node lang-quest/scripts/sync-brand.mjs            # write into every lang-quest/lq-* checkout present
node lang-quest/scripts/sync-brand.mjs --dir ../lq-nordic   # one checkout
node lang-quest/scripts/sync-brand.mjs --check    # CI: exit 1 when a copy drifted
```

Source of truth is `lang-quest/brand/` (`logo-512.webp`, `og.webp`). Change
a file there, re-run, commit the group repos; their next deploy uploads the new
sha (see blueforge `docs/deploy/asset-sync.md`).
