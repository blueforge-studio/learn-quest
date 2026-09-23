# Books Platform × Game Asset Studio — design spec (2026-09-23)

**Status:** draft for operator review · no code
**Companion to:** `adventure-craft/docs/superpowers/specs/2026-09-23-creative-studio-game-asset-studio-design.md`
(landed — cross-linked both ways; structure agreed cross-session, sections 4
and 7 are where the two specs diverge: world/asset authoring vs book
authoring).
**Authority on branding:**
`game-asset-platform/docs/design/2026-09-23-branding-game-asset-studio-vault7.md`
(game-asset-platform PR #46) — this spec only states **how the brand lands for
books-platform clients**.
**Requested by:** operator, 2026-09-23 — "hook up Books Platform to Game Asset
Platform … for book authors", with the platform renamed to match the `.gas`
format. A **two-umbrella model** was ratified by the operator mid-draft (via
the adventure-craft session): see §1.

---

## 1. Naming & positioning

**The rename — two umbrellas (operator-ratified 2026-09-23).** The platform is
**not** collapsing into a single name. The ratified split:

| Umbrella | Covers | Consequence for this spec |
|---|---|---|
| **Game Asset Studio** | The *apps* ecosystem: `gas-studio` hub, the editor packages, `forge-studio`, site | The books feature is **"Import from Game Asset Studio"**; editor deep-links are Studio surfaces |
| **Vault7** | The *vault* of assets and data — "designed for API, SDK and agentic access via MCP as well as integrated into Game Asset Studio apps (`.gas` interchange format)" | The marketplace API, MCP server, API keys and `.gas` retrieval we consume are **Vault7** surfaces; the provenance scheme (§4) points at the vault |

Free consequence: **Vault7 leans into the already-frozen catalog id `vault7`**
(`game-asset-platform: vault7` in `blueforge/data/repo-products.yml`) — the
brand follows the id, no "source is identity" migration. The remaining
reconciliation (authored copy "GAS = Game Asset **Server**", display brand
**GameVault** across openapi/DNS/gamevault.com, the `@gamevault/*` npm scope)
is the game-asset-platform session's **branding spec** — authority linked in
the header; this document keeps only the client-facing mapping:

| Surface we touch | Under the two-umbrella model |
|---|---|
| Search/retrieve/import API, MCP, API keys, `.gas` bundles | Vault7 |
| Editor deep-links (`…/sprite-editor` etc.), the import feature's display name | Game Asset Studio |
| `@gamevault/*` npm scope | stays Vault7's SDK surface (published-name identity — noted agreement, not a decision this spec makes) |
| `.gas` format name | unchanged (it is the interchange, not a brand) |

**Positioning vs `apps/gas-studio`.** `gas-studio` is the Studio umbrella's
unified editor shell (mounts the `*-editor-core` libraries). Books Platform is
a **consumer** of the Vault7 asset library, not an editor host: v1 imports
assets into books; it does not embed gas-studio or ship a competing "studio"
UI. When authors need to edit, they deep-link to the live editors (§4); when
the books UI needs a name for the feature it is **"Import from Game Asset
Studio"** — never "Books Studio".

Books is a *client* in the same sense the engine plugins are: it reads the
`.gas` interchange, it does not extend the vault's data model.

## 2. Current-state audit

### Books Platform (learn-quest side)

- **`lq-books-author`** — the authoring app (screens: editor, library,
  preview, submission, dashboard, analytics, settings). Its *entire* image
  surface today:
  - `BookEditorScreen` — a manual `coverImageUrl` text field + preview;
  - `ImageManagementScreen` — list / upload / **regenerate** / remove, via
    `useImageGeneration` → books-api → `books-image-worker`;
- **`books-image-worker-api`** — the existing generative pipeline:
  `prompt-gen` → `image-gen` → `r2-upload` (Cloudflare API, `R2_BUCKET`) →
  `content-updater` (writes paths back into book content). Server-side keys,
  no browser-held credentials — the pattern the GAS import should copy.
- **`lq-tools` `book-builder`** — bulk generation orchestrator (phase
  pipeline, resume, validation gates) + `content-generators` — the hook for
  batch GAS imports once the single-asset path works.
- **Content shape** — `public/data/books/en/manifest.json` lists books with
  `coverImage` CDN paths (`/apps/subjects/<app>/images/covers/*.webp` in
  `lq-assets`); each book is its own directory. Readers (5 book apps) consume
  paths only — **they need no changes**; anything that lands a valid CDN path
  in the manifest/content flows straight through.
- **Conventions an import must respect** (repo law, see
  `docs/ASSET_RESOLUTION.md` + memory): two resolution systems; never trust
  naive image counts; responsive `--<size>` variants; `sync-to-storage.ts`
  for pushes (never `aws`/`rclone`); **source is identity** — a path without
  its `source` is not an identity, so imports carry provenance (§5).

### Game Asset Platform (verified live 2026-09-23, not README prose)

| Claim | Evidence | State |
|---|---|---|
| Site deployed | `https://gamevault.blueforge.studio/` → 307 `/en` → 200 (app-2, Caddy) | ✅ |
| **Editors publicly reachable by path** | `…/sprite-editor` → 307 → `/en/sprite-editor` → **200**, `<title>Sprite Editor \| GameVault</title>`; config deploys sprite/3d/world/audio/video/overlays | ✅ |
| **Marketplace (the API + MCP) deployed** | absent from `blueforge.config.json` `apps` (only site + 6 editors) | ❌ **not deployed** |
| `gas-studio`, `forge-studio`, `ai-server`, batch editors deployed | same absence | ❌ |
| DNS records for editors | `forge dns list` — none; editors ride the site's host by path | n/a |

**P0 blocker follows immediately:** the integration surface (REST + OpenAPI +
MCP + API keys) exists entirely inside `apps/marketplace`, which is **not
live**. "Already deployed" is true for the studio editors and site, false for
the API this spec depends on.

Code-side facts (all read from the repo):

- **Marketplace**: Next.js App Router, `middleware → handler → service →
  repository → Drizzle/Postgres`; **OpenAPI 3.0.3, ~250 paths**
  (`src/api-docs/openapi.yaml`, CI has an OpenAPI drift check); auth =
  **`x-api-key` header** or session cookie; keys stored sha256-hashed,
  per-key Redis limits (120 read / 30 write per minute; doc tier table also
  lists `assets: 100 req / 15 min`); key management UI `/admin/api-keys`
  (session-authenticated); federation orgs are forge-auth's lane.
- **MCP** `asset-marketplace-mcp` (`src/features/mcp/server.ts`, route
  `/api/mcp`): tools **`search_assets`, `get_asset_details`,
  `retrieve_asset`, `ai_audio_generate`, `generate_composite_sprite`** —
  `retrieve_asset` is the import primitive. Transport is session-oriented
  (internal-request verification) → headless key auth is a GAP work item
  (§6).
- **`.gas`** (`docs/architecture/gas-interchange-format.md`): a **ZIP bundle
  = JSON manifest + embedded media**; manifest `{ version, type:
  sprite|sound|scene|logic, name, author, nodes[{ id, type, transform:
  position[3] / rotation[4] quaternion / scale[3], data_ref }] }`; versioning
  via JSON Patch (`docs/JSON_PATCH_VERSIONING.md`). Types in
  `@gamevault/types` (`gas-scengraph.ts`, `gas-material.ts`), processing
  contracts in `@gamevault/asset-core` (`Generator`/`Processor`/`Exporter`,
  `ImageJob`, `AudioJob`, `PackJob`, …), published npm + JSR.
- **Storage**: asset files on **Backblaze B2 (S3 API) behind Cloudflare
  CDN**, buckets per creator store; metadata in Postgres.
- **Client SDKs**: `@gamevault/sdk` (npm + JSR), `python-bridge`.
- **Trap — repo is npm, not pnpm**; **trap — main merges do not auto-deploy**
  (`forge app-deploy --server --no-dns` from clean main is the deploy path).
- Adjacent precedent: `world-map-editor` round-trips `.gas-world` and treats
  world objects as GAS assets (`packages/asset-pipeline/src/gas.ts`);
  adventure-craft's `2026-09-22-game-api-design.md` is the house pattern for
  API-first, agent-friendly services (OpenAPI at a well-known path, layered
  routes→services→ports→adapters, spend safe by construction).

## 3. GAP apps & packages ranked for Books

### In — ranked by value to book authors

| # | GAP app/package | Why for books | Phase |
|---|---|---|---|
| 1 | **`apps/marketplace`** (REST + OpenAPI + MCP + packs/stores/payments) | The asset library itself: search, license/store context, retrieval. Everything else is downstream. | **P0 (deploy)** → P1 |
| 2 | **`.gas` format + `@gamevault/types` + `@gamevault/asset-core`** | The interchange: import container (bundle), validation, versioning. Books reads it the way engine plugins do. | P1 |
| 3 | **`apps/sprite-editor` + `sprite-editor-core` + `sprite-animation`, `creature-generator`, `static-assets`** | Stylized 2D art closest to children's-book needs (covers, characters, stickers, spot art); editor already live at `…/sprite-editor`; `.gas`/GIF/Aseprite export. | P1 (import) → P4 (deep-link edit) |
| 4 | **`apps/audio-editor` + `ai-audio-generator` / `ai-music-generator`** | SFX + read-aloud beds under the books **reuse-first audio policy** (free/reuse before paid generation). `ai_audio_generate` MCP tool exists. | P4 |
| 5 | **`packages/asset-map`** (`AssetMapBuilder/Loader/Resolver`, Zod `AssetEntry { path, meta: { width, height, format, size, duration } }`) | Same concept as learn-quest's per-domain asset maps — use its metadata shape when writing imported assets into our maps so both sides speak one vocabulary. | P1 |
| 6 | **`apps/overlays-web` + `overlays-core`** (optional) | Author marketing (social cards, announcement art) — outside the book itself. | later |
| 7 | **`apps/video-editor`** (optional) | Book trailers. | later |

### Out of scope (explicitly)

- `apps/3d-editor`, `apps/world-editor` (+ `.gas-world`) — world/game lane,
  adventure-craft / WorldForge's companion (see §9).
- `apps/forge-studio` — game-studio management; its *shape* (projects,
  teams, publishing) is a possible future model for an "author studio", but
  it is game-project-shaped today.
- Engine plugins/SDKs (Godot, Bevy, Unity, Unreal, Phaser, RN, Flutter,
  Aseprite, LDtk, Tiled) — books are not engines.
- `ai-text-generator` — tuned for game content, not prose; book prose stays
  with `content-generators`/`book-builder`.
- `gas-lore-schema`, encounter/loot/lore/npc/event editors — worldbuilding.
- `apps/site`, `batch-image-editor-desktop`, marketing chrome — irrelevant or
  covered by the web batch editor later.

## 4. Integration surface

```
author (lq-books-author)          bulk (book-builder / lq-tools)
        │                                   │
        ▼                                   ▼
   books-api  ◄── x-api-key held in forge vault (server-side only)
        │  search / details / retrieve
        ▼
   marketplace API  (OpenAPI 3.0.3, ~250 paths;  x-api-key; rate limits)
        │  .gas ZIP (manifest + media)  ·  or raw file per asset
        ▼
   import worker (books-api or image-worker sibling)
        │  validate (@gamevault/asset-core) → sharp: webp + responsive variants
        │  provenance: source = gas://marketplace/assets/<id>@v<version>
        ▼
   sync-to-storage.ts → lq-assets (R2/MinIO)  +  asset-map entry {path, meta}
        │
        ▼
   book content (coverImageUrl / page image) → readers unchanged
```

- **Auth:** `x-api-key` header. Operator mints a books-platform key in the
  marketplace admin (`/admin/api-keys`) once deployed; key lives in the forge
  vault, is used **only server-side** (browsers never hold provider/API keys —
  house rule from adventure-craft's game-api spec and our own lazy-asset
  work). Session-cookie auth is for the marketplace UI, not us.
- **Read path:** REST `GET /api/assets`, `GET /api/assets/{id}` (+ versions,
  forks, branches — assets are versioned); download via the asset file
  endpoints documented in `assets.md` / `upload-zip.md`, or MCP
  `retrieve_asset` once headless auth exists. **OpenAPI is the contract
  source of truth** — generate the books client from `openapi.yaml`, do not
  hand-roll.
- **Write path:** none in v1. Books *imports*; publishing books assets back
  to the marketplace is a separate, operator-ratified idea (see §8 Q5).
- **Storage:** **copy, don't hotlink.** GAP files live in per-store B2
  buckets; books content must resolve through our own `lq-assets` conventions
  (variants, resolution order, `sync-to-storage.ts`). Hot-linking B2 would
  split the source of truth and break the variant/audit rules.
- **`.gas` handling:** treat the bundle as the import container — unzip,
  validate manifest via `asset-core`, extract `data_ref` media, run our
  normal image pipeline (format check, webp, `--<size>` variants where the
  rules apply), then write the map entry + content path. Sound imports do the
  same into the audio tree under the reuse-first policy.
- **Provenance (source is identity):** every imported image records
  `source: gas://marketplace/assets/<id>@v<version>` next to its content
  entry (the `external_id`/`source` discipline from forge-protocol). A later
  re-import of the same version is a no-op; a newer version is an explicit
  update.
- **Rate limits:** design bulk import (book-builder) to respect 120 read/min
  and the `assets` tier (100/15 min): worker pool with backoff on 429, same
  shape as `sync-to-storage.ts`'s pool. First retrieval burst is the only
  heavy read; everything downstream is local.
- **Editors:** live today at `https://gamevault.blueforge.studio/{editor}`
  (verified: sprite). P4 deep-links ("Open in Sprite Editor") need no GAP
  deploy work.

## 5. Agent-first design

Mirrors the house pattern (adventure-craft game-api spec; our lazy-asset
pipeline):

1. **OpenAPI is the contract.** Books integrates against
   `openapi.yaml` (CI-drift-checked on GAP's side), not against UI behavior.
2. **MCP for agent workflows.** `asset-marketplace-mcp` already exposes
   `search_assets` / `get_asset_details` / `retrieve_asset` — ideal for
   `book-builder` phases and authoring agents doing bulk cover/spot-art
   selection. **Gap:** the MCP server is session/internal-request oriented;
   it needs an API-key (headless) mode before server-side consumers can use
   it. Until then, books uses REST + `x-api-key`. (GAP work item.)
3. **Anything the UI can do, a script can do.** The author UI's Import
   button calls the same books-api endpoints an agent would — no private UI
   channel.
4. **Keys and spend are server-side.** Vault-held key; rate-limit backoff;
   no generation spend in v1 imports (retrieval only — generation stays in
   `books-image-worker`, which already has its own budget/gate discipline).

## 6. Enhancements to the books apps (the author-facing payoff)

1. **`ImageManagementScreen` gains a third source:** *Upload | Generate |
   **Import from Game Asset Studio*** — search the marketplace (proxied),
   preview with license + store attribution, one click → books-api import →
   the image appears in the existing list with a provenance chip
   (`gas://…`) and the existing regenerate/remove actions unchanged.
2. **`BookEditorScreen` cover field** gets an "Import" affordance next to
   the manual URL field (covers-first: every book in `manifest.json` already
   has a `coverImage`, so this is the highest-visibility win).
3. **`book-builder` new phase `import-gas-assets`** — config-driven bulk
   selection (e.g. "covers for these 10 topics, style: sprite"), throttled
   against the rate limits, resumable like the other phases; results flow
   through the existing validation gates.
4. **Readers: zero changes.** They resolve paths via the existing pipeline.
5. **Optional later:** deep-link edit loop (Sprite Editor), audio SFX import
   (reuse-first), overlays marketing cards, agent-driven selection via MCP.

## 7. Phasing / PR sequence

| Phase | Where | What | Exit |
|---|---|---|---|
| **P0** | GAP | Deploy `apps/marketplace` (API + `/admin/api-keys` + MCP) with a stable URL; operator mints the books key into the vault. Rename rollout decided (§8 Q1–Q2). | `x-api-key` request succeeds from books-api |
| **P1** | books | `books-api` OpenAPI-generated client + vault key; `GET /search`, `POST /import` (retrieve → validate → sharp → `sync-to-storage` → map entry + provenance); unit tests + one end-to-end cover import on a real book | imported cover renders live on a reader |
| **P2** | books | `lq-books-author` Import browser + cover affordance + provenance chip | author imports without CLI |
| **P3** | books | `book-builder` `import-gas-assets` phase, throttled bulk | batch covers/spot art for a title set |
| **P4** | both | Sprite Editor deep-link; MCP headless auth (GAP) → agent selection; audio import under reuse-first; optional overlays/video | agent-driven pipeline |

Each books phase is one PR series per repo (books-platform, then
lq-tools if the builder phase lands there) — no reader-app deploys until P1's
content actually changes.

## 8. Open questions for the operator

1. **Rename scope:** Game Asset Studio across which surfaces — repo display
   name, CLAUDE/docs, OpenAPI `info.title`, catalog card (`vault7`), the
   `gamevault.blueforge.studio` DNS, the `@gamevault/*` npm scope,
   gamevault.com? (Recommend: docs/UI copy now; DNS + npm scope later —
   they're the breaking ones.)
2. ~~Marketplace deploy URL~~ — **DECIDED 2026-09-23:** dedicated host
   **`vault7.blueforge.studio` → 46.225.226.92** (app-2), plus
   `marketplace.vault7.blueforge.studio` on the same target; both verified
   directly against the authoritative NS (`algin.ns.cloudflare.com`,
   bypassing resolver caches) and the zombie `*.vault7` wildcard deleted
   (random-subdomain probe NXDOMAIN at authority). forge-control ran
   `forge dns set` + zone verify; forge-auth `cae70a8` registered both
   OAuth origins with a pinning test + prod smoke. Dedicated host over the
   path-route, as §4 recommended. Deploy itself: building from `947a0267`
   with `--wait` (still no main-push auto-deploy — explicit
   `forge app-deploy --server --no-dns`). **P0 remains: when the build
   reports, mint the books key at `/admin/api-keys`.**
3. **Paid assets:** marketplace packs are Stripe-priced. v1 recommendation:
   **free + federation-owned creator store only** — paid in-book assets need
   a separate licensing/royalty answer. Ratify or reject.
4. **Provenance scheme:** `source = gas://marketplace/assets/<id>@v<version>`
   — approve as the identity key (it feeds the same "source is identity"
   rule as forge-protocol's `external_id`/`source`).
5. **Reverse direction (later?):** should book illustration styles ever be
   *published back* to the marketplace as a creator store? Not in v1; say
   "not now" or "explore" so the data model isn't painted into a corner.
6. **Priority:** where does P1 sit against the school/life rollout and the
   reading-aids track?

## 9. Related work & credits

- **Companion spec (landed, cross-linked both ways):**
  `adventure-craft/docs/superpowers/specs/2026-09-23-creative-studio-game-asset-studio-design.md`
  — same structure; its sections 4/7 rank GAP apps for world/asset authoring
  (read-only catalog + link-into-project first, editor deep-links, export
  lane deferred, a Studio-side `studio-mcp` mirroring Studio's REST 1:1 —
  the split from this spec is book-authoring tools on the existing
  `asset-marketplace-mcp` + shared `gsk_` key scheme).
- **Branding authority:**
  `game-asset-platform/docs/design/2026-09-23-branding-game-asset-studio-vault7.md`
  (PR #46) — the two-umbrella model (§1) comes from there via the
  adventure-craft session; its P0 (deploy the Vault7 API plane) is the same
  deploy that unblocks this spec's books-P1 key minting, and its sequencing
  rule "copy-first, identifiers-never, DNS-last" governs the rename surfaces
  in §8 Q1.
- **GAP inventory + surfaces** — from the game-asset-platform session
  (2026-09-23 message), verified against the repo and live endpoints where
  noted.
- **`world-map-editor/docs/superpowers/notes/2026-09-22-companion-books-concept-survey.md`**
  — "companion books" exists as a *lore* concept in the WorldForge lane;
  adjacent name, different product (worldbuilding, not our readers).
- **adventure-craft `docs/superpowers/specs/2026-09-22-game-api-design.md`**
  — API-first / agent-friendly / spend-safe principles mirrored in §5.
- **GAP primary sources:** `CLAUDE.md`, `.claude/repo-map.md`,
  `docs/architecture/gas-interchange-format.md`,
  `apps/marketplace/src/api-docs/{openapi.yaml,assets.md,api-keys.md,
  asset-pipeline.md}`, `apps/marketplace/src/features/mcp/server.ts`,
  `packages/{types,asset-core,asset-map}/`, `blueforge.config.json`.
- **Books primary sources:** `lq-books-author` editor screens,
  `books-image-worker/src/{image-gen,r2-upload,content-updater}.ts`,
  `lq-tools/packages/book-builder/`, `lq-adventure-book/public/data/books/en/
  manifest.json`, `learn-quest/docs/ASSET_RESOLUTION.md`.
