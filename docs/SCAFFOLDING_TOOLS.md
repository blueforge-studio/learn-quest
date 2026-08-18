# Scaffolding & Generation Tools

Generated 2026-05-05. Inventory of scripts and packages used to scaffold new apps, generate content (lessons, audio, images), wire assets, validate, and publish across the LearnQuest monorepo.

## End-to-end workflow

| Step | Action | Tool |
|------|--------|------|
| 1 | Scaffold new repo / language group | `lq-operations/scripts/scaffold-repo.ts` |
| 2 | Bootstrap subject app with packr | `lq-core/apps/lang-core/src/bootstrap-subject.ts` |
| 3 | Generate lessons (AI) | `<quest>/scripts/generate-subject-lessons.ts` |
| 4 | Generate audio (TTS) | `<quest>/scripts/generate-lesson-audio.ts` |
| 5 | Scaffold image configs | `lq-tools/packages/asset-scaffolding/scaffold-subject-configs.ts` |
| 6 | Generate images | `<quest>/scripts/generate-lesson-images.ts` or `lq-tools/packages/image-tools/` |
| 7 | Resize variants | `lq-tools/packages/asset-scaffolding/generate-missing-variants.ts` |
| 8 | Wire asset refs into lessons | `<quest>/scripts/wire-life-images.ts` or `lq-tools/scripts/wire-conversation-images.ts` |
| 9 | Validate against Zod schemas | `school-quest/scripts/validate-all-content.ts` |
| 10 | Publish to packr registry | `lq-tools/scripts/publish-changed.ts` |
| 11 | Smoke test before deploy | `lq-operations/scripts/smoke-test-apps.ts` |

Reference architectural blueprint: `school-quest/ARCHITECTURE.md`.

---

## Repo & app scaffolding

| Tool | Path | Purpose | Example |
|------|------|---------|---------|
| **scaffold-repo** | `lq-operations/scripts/scaffold-repo.ts` | Scaffold a new language-group or subject-app repo with full directory structure, package.json, Vite config, packr `.npmrc` | `npx tsx scripts/scaffold-repo.ts <group-name>` |
| **bootstrap-subject** | `lq-core/apps/lang-core/src/bootstrap-subject.ts` | Wire packr dependencies + registry into a newly scaffolded subject app | (called internally during scaffold) |
| **create-group** | `lq-tools/packages/app-generators/create-group.ts` | Scaffold a language group with all language configs | (CLI within app-generators package) |
| **create-app** | `lq-tools/packages/app-generators/create-app.ts` | Scaffold an individual language or subject app | (CLI within app-generators package) |
| **diff-groups** | `lq-tools/packages/app-generators/diff-groups.ts` | Compare structures across language groups | (CLI within app-generators package) |

Includes 37 language-specific generators and 60+ language metadata configs (image themes, RPG styles, scripts).

---

## Lesson & content generation

| Tool | Path | Purpose | Example |
|------|------|---------|---------|
| **generate-subject-lessons** (school) | `school-quest/scripts/generate-subject-lessons.ts` | AI-generate lessons via DeepSeek (with caching) or Qwen | `npx tsx scripts/generate-subject-lessons.ts --subject=math --chapter=2 --count=10` |
| **generate-subject-lessons** (life) | `life-quest/scripts/generate-subject-lessons.ts` | Same pattern, tuned for life-skills domains; ~$0.004/lesson | `npx tsx scripts/generate-subject-lessons.ts --all --count=10 --workers=3` |
| **generate-scene-dialogue** | `lingua-quest/scripts/generate-scene-dialogue.ts` | Generate NPC scene dialogue bundles via DeepSeek (Viking-format scenes), generalized to any primary language | `npx tsx scripts/generate-scene-dialogue.ts --brief=<config>` |
| **generate-chapters** | `school-quest/lq-history/scripts/generate-chapters.ts` | Auto-regenerate `chapters.json` manifests from lesson filenames (3-level hierarchy for history) | `npx tsx scripts/generate-chapters.ts` |

Common flags for `generate-subject-lessons`: `--subject`, `--category`, `--chapter`, `--count`, `--workers` (1-4), `--provider` (deepseek/qwen/split), `--difficulty` (beginner/elementary/intermediate/advanced/expert), `--dry-run`.

---

## Audio / TTS generation

| Tool | Path | Purpose | Example |
|------|------|---------|---------|
| **generate-lesson-audio** (school) | `school-quest/scripts/generate-lesson-audio.ts` | TTS narration via edge-tts (free) or OpenAI TTS | `npx tsx scripts/generate-lesson-audio.ts --subject=math --all --format=mp3` |
| **generate-lesson-audio** (life) | `life-quest/scripts/generate-lesson-audio.ts` | Same; edge-tts is free for concept-heavy content | `npx tsx scripts/generate-lesson-audio.ts --subject=health --all` |

---

## Image generation & wiring

| Tool | Path | Purpose | Example |
|------|------|---------|---------|
| **generate-lesson-images** | `school-quest/scripts/generate-lesson-images.ts` | AI lesson illustrations via Replicate Flux Schnell (~$0.003/image) | `npx tsx scripts/generate-lesson-images.ts --subject=math --limit=5` |
| **wire-life-images** | `life-quest/scripts/wire-life-images.ts` | Inject `content.image` fields into life-quest lesson JSON from on-disk images | `npx tsx scripts/wire-life-images.ts --app=economics` |
| **generate-conversation-asset-maps** | `lq-tools/scripts/generate-conversation-asset-maps.ts` | Scan on-disk conversation images; emit asset-map JSONs per locale | `npx tsx scripts/generate-conversation-asset-maps.ts --app=/path/to/lq-slavic` |
| **wire-conversation-images** | `lq-tools/scripts/wire-conversation-images.ts` | Match scene + character images to lesson JSONs; inject `sceneRef` / `characterRef` | `npx tsx scripts/wire-conversation-images.ts --app=/path/to/lq-slavic --lang=russian` |

---

## Asset scaffolding (lq-tools/packages/asset-scaffolding)

| Tool | Path | Purpose | Example |
|------|------|---------|---------|
| **scaffold-image-configs** | `lq-tools/packages/asset-scaffolding/scaffold-image-configs.ts` | Generate AI image-gen configs per language (GameVault/Gemini) | `npx tsx scripts/assets/scaffold-image-configs.ts --lang=swedish --categories=rpg-bosses,backgrounds` |
| **scaffold-subject-configs** | `lq-tools/packages/asset-scaffolding/scaffold-subject-configs.ts` | Image configs for subject apps (history, geography, math, science) | `npx tsx scripts/assets/scaffold-subject-configs.ts --subject=history` |
| **generate-group-assets** | `lq-tools/packages/asset-scaffolding/generate-group-assets.ts` | Group logos + textures via Gemini | `npx tsx scripts/assets/generate-group-assets.ts --group=romance --budget=3.0` |
| **generate-shared-group-assets** | `lq-tools/packages/asset-scaffolding/generate-shared-group-assets.ts` | Shared RPG equipment, onboarding, achievements per group | `npx tsx scripts/assets/generate-shared-group-assets.ts --group=romance` |
| **generate-missing-variants** | `lq-tools/packages/asset-scaffolding/generate-missing-variants.ts` | Responsive variants (128/256/512px) from full-size images | `npx tsx scripts/assets/generate-missing-variants.ts --lang=danish --group=nordic` |
| **scaffold-assets** | `lq-tools/packages/asset-scaffolding/scaffold-assets/` | Standard image/audio dir constants; used internally | (internal) |
| **expand-avatar-configs** | `lq-tools/packages/asset-scaffolding/expand-avatar-configs/` | Expand avatar configs to all gender/style variants | (used during app setup) |

Key constant: `EMPTY_ASSET_MAP` template for new locales.

---

## Image tool suite (lq-tools/packages/image-tools)

| Tool | Purpose |
|------|---------|
| **generate-lesson-images** | Batch image gen per lesson type / category |
| **generate-rpg-assets** | RPG bosses, equipment, backgrounds |
| **generate-social-images** | Social media card generation |
| **generate-image-index** | Build runtime image indexes from on-disk assets |
| **image-ref-validate** | Validate image refs in lesson JSON against on-disk assets |
| **regen-images-all** | Bulk regenerate across all apps |

---

## Validation & auditing

| Tool | Path | Purpose |
|------|------|---------|
| **validate-all-content** | `school-quest/scripts/validate-all-content.ts` | Validate all lessons against Zod schemas (1,536 lessons currently 100% valid) |
| **audit-lesson-ids** | `school-quest/scripts/audit-lesson-ids.ts` | Detect duplicate lesson IDs across chapters |
| **audit-repos** | `lq-operations/scripts/audit-repos.ts` | Cross-repo health checks |
| **smoke-test-apps** | `lq-operations/scripts/smoke-test-apps.ts` | Pre-deploy health checks across all 14 apps |

---

## Content packages (lq-tools)

| Package | Path | Purpose |
|---------|------|---------|
| **content-enrichment** | `lq-tools/packages/content-enrichment/` | Lesson enrichment, translation, cost estimation |
| **content-migration** | `lq-tools/packages/content-migration/` | Asset structure migration, patching, fixes |
| **content-generators** | `lq-tools/packages/content-generators/` | Batch lesson/subject generation, dashboard, statistics |
| **app-generators** | `lq-tools/packages/app-generators/` | Group + app scaffolders + 37 language generators |
| **asset-scaffolding** | `lq-tools/packages/asset-scaffolding/` | Asset config generation, variant resizing, scaffolds |
| **image-tools** | `lq-tools/packages/image-tools/` | Image generation, indexing, validation |

---

## Publication & deployment

| Tool | Path | Purpose |
|------|------|---------|
| **prepare-publish** | `lq-tools/scripts/prepare-publish.ts` | Pre-publish validation + changelog generation |
| **publish-changed** | `lq-tools/scripts/publish-changed.ts` | Publish only changed packages to packr registry |
| **generate-logos** | `lq-operations/scripts/generate-logos.ts` | Subject-app logos |
| **smoke-test-apps** | `lq-operations/scripts/smoke-test-apps.ts` | Pre-deploy checks |

Note: `@learnquest/*` packages publish via GitHub Actions on push to main from `lq-core`; local tokens only update existing packages.

---

## Known consolidation candidate

The `generate-subject-lessons.ts` script is duplicated between `school-quest/scripts/` and `life-quest/scripts/` with near-identical logic. Worth consolidating into `lq-tools/packages/content-generators/` if more quest verticals are added.
