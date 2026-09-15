# Locale coverage blocker — books-platform (2026-09-15)

The user-facing storefront claims books are available in three
locales — **en, da, es** — but only **en** has scene content. This
file documents the gap and what would be needed to close it.

## The gap, exactly

For each of the four reader apps, the on-disk locale content is:

```
lq-story-book/da         →  0 content files (only manifest.json)
lq-story-book/es         →  0 content files (only manifest.json)
lq-interactive-book/da   →  0 content files (only manifest.json)
lq-interactive-book/es   →  0 content files (only manifest.json)
lq-adventure-book/da     →  0 content files (only manifest.json)
lq-adventure-book/es     →  0 content files (only manifest.json)
lq-activity-book/da      →  0 content files (only manifest.json)
lq-activity-book/es      →  0 content files (only manifest.json)
```

The storefront's i18n strings (topbar, browse, locale labels) all
exist and switch correctly. The product *claim* is a three-locale
catalogue. The product *delivery* is a one-locale catalogue.

The da/es manifest.json stubs DO exist — the catalog sync (see
[`RUNBOOK-catalog-sync.md`](RUNBOOK-catalog-sync.md)) would project
them onto `publishing.books` rows; what they would NOT have is
scene content. Browsing to a Danish or Spanish book would render
an empty/naked chapter list.

## Why audio TTS cannot fix this

TTS takes text and produces audio. The text does not exist in
da/es. Adding TTS to the audio pipeline without text yields nothing.

A naive automation — machine-translating the en scene content into
da/es — would work at the SEQUENCE level (translatable strings)
but break at the SCENE level (cultural references, idiomatic
expression, kid-appropriate register). It also bypasses the
content authoring loop that produced the en versions.

## What needs to happen (rough estimate)

For each book (19 total across the catalogue as of 2026-09-15, per
`books-platform/scripts/content/_full-length-audit.ts`):

1. Author/translate the scene content. This is a content writing
   task; the agent doesn't have it. Estimate per book: ~3-5 hours
   for an experienced translator with subject-matter context.
2. Validate via `pnpm validate` for type-correctness.
3. Generate audio narration for the translated scenes (existing
   scripts work — `en-US-JennyNeural` for activity,
   `da-DK-{...}Neural` for da activity if needed,
   `es-ES-{...}Neural` for es activity).
4. Re-publish via catalog sync so the storefront reflects the
   new locale content.

**Total:** ~3 weeks of dedicated human translation work to
ship the entire catalogue in da and es. da is the higher-priority
language (one of the Nordic group languages with active school-quest
adaptation in lq-nordic).

## What CAN be done today

Two things partially help without translator involvement:

1. **Marketplace strings** — `apps/lq-book-marketplace/src/i18n/`
   already supports da/es for the storefront chrome (topbar, filter
   chips, locale labels). Verify by switching the locale toggle —
   the storefront UI should translate, only the book content stays
   English. (This is what users see today, modulo the gap.)

2. **Per-locale manifest metadata** — `name`, `description`,
   `estimatedHours` etc. on the manifest stub CAN be authored
   in the original language even before scene content exists.
   The marketplace would then render "available in Danish" rather
   than "available in Danish (no content yet)".

## Recommendation

**Don't try to ship da/es content via automation.** The right
order of operations is:

1. Get en locale to a launchable state (catalog sync + Stripe
   activation — both operator-only — land the four books-platform
   pillars in working order).
2. Manually author/translation one book in da as a reference
   (push the work to a Danish-speaking content writer, ~1 week).
3. Use that reference to gauge per-book cost + cultural-adaptation
   difficulty for the other 18 books.
4. Phase the remaining translation work across the catalogue
   over Q4 2026 / Q1 2027.

## Related

- `RUNBOOK-catalog-sync.md` — operator step to bring the
  manifests into the live store (regardless of locale content
  completeness).
- `RUNBOOK-stripe-activation.md` — checkout can be live in en-only
  while da/es authoring is in flight; don't gate them together.
- `docs/INTEGRATION_PROPOSAL.md` — the original i18n architecture
  doc (WIP); the locale-stub pattern documented here predates it.
