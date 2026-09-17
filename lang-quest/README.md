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

## Brand and sidecars: one per group

Every group repo deploys as its own control-plane app **and is its own product**
on blueforge.studio — `lq-nordic` deploys as `nordic-quest`, `lq-slavic` as
`slavic-quest`. Each group owns its `blueforge.product.yml` (its id, name,
tagline, description, features, status) and its own mark under `brand/`. The
fourteen marks are fourteen different images, and nothing fans a shared one out
to them.

`lang-quest/scripts/sync-brand.mjs` used to, and has been **deleted**. It was
written for the pre-migration layout, in which the groups were one product
(`id: lang-quest`); by the end it was wrong on every axis. Running it would have
overwritten each group's id, deleted the tagline/description/features/status and
cover it did not know about, and replaced all fourteen marks with the umbrella's.
Do not reintroduce a shared-mark fan-out.

Author a sidecar with blueforge's own tool (`pnpm sidecar <product-id>`, see the
blueforge README) and validate the set across repos with
`scripts/check-sidecars.mjs`. forge-control uploads the assets a sidecar points
at whenever a deploy changes their bytes — see blueforge
`docs/deploy/asset-sync.md`.

`lang-quest/brand/` is the **umbrella's** art. The family has no repo of its own,
so this is where its source art lives; it is what the `lang-quest` collection
page on blueforge.studio renders. It is not deployed to the groups.
