# Books-platform audio generation — 2026-09-15

Status of the per-scene TTS narration pipeline across the four reader
apps at end of the activity-book + adventure-book audio generation runs.

## TL;DR

| App | Scenes before | Scenes with audio after | Cost | Voice |
|---|---|---|---|---|
| `lq-activity-book` | 0/16 | **16/16** | $0 | Edge TTS `en-US-JennyNeural` |
| `lq-adventure-book` | 0/266 | **266/266** | ~$0.08 | Kokoro `af_bella` (Replicate) |
| `lq-story-book` | (pre-existing per-book, see narrative) | (unchanged) | — | Kokoro `af_bella` |
| `lq-interactive-book` | not audited | not audited | — | — |

Total spend across both ships: **<$0.10**.

Three scripts in place to regenerate or extend any book:

```bash
# Activity (formulaic question narration, Edge TTS, $0)
pnpm --filter @learnquest/activity-book generate-narration
REPLICATE_API_TOKEN=$REPLICATE_API_TOKEN npx tsx apps/lq-activity-book/scripts/generate-narration.ts [bookId]

# Adventure (narrative prose, Kokoro, $0.0003/scene)
REPLICATE_API_TOKEN=$REPLICATE_API_TOKEN npx tsx apps/lq-adventure-book/scripts/generate-narration.ts [bookId]  # one book
REPLICATE_API_TOKEN=$REPLICATE_API_TOKEN npx tsx apps/lq-adventure-book/scripts/generate-narration.ts all    # all 9 books

# Story (older — uses audio-gateway ReplicateTtsAdapter directly)
REPLICATE_API_TOKEN=$REPLICATE_API_TOKEN npx tsx apps/lq-story-book/scripts/generate-narration.ts [bookId]  # defaults to ancient-egypt-explorer
```

## What shipped

### Activity book (16 mp3s, $0)

`apps/lq-activity-book/scripts/generate-narration.ts` (new) walks
`public/data/books/en/<bookId>/scenes/*.json`. Each scene file is an
array of exercises; the script TTSes `content.question` into the
shared `SceneAudio.narration` slot per exercise and writes
`{exerciseId}-narration.mp3` to
`public/sounds/activity/<bookId>/{exerciseId}-narration.mp3`.

- **Voice:** `en-US-JennyNeural` (Edge TTS — free, no API token).
- **Cost:** $0 per exercise, $0 total.
- **Why Edge TTS over Kokoro:** the audio is short formulaic question
  prompts aimed at kids who haven't fully internalised the text
  visually. Edge TTS's voice quality is fine at that length and the
  $0 matters while Stripe is unactivated
  (no bookings are generating revenue to offset per-call TTS cost).

### Adventure book (266 mp3s, ~$0.08)

`apps/lq-adventure-book/scripts/generate-narration.ts` (new) walks
**recursively** into `public/data/books/en/<bookId>/scenes/ch<N>/`
(the book-app variant of the layout — chapters are nested
directories, not flat). Each scene file is a single object; the script
TTSes `narrativeText` into `audio.narration` and writes the mp3 to
`public/sounds/adventure/<bookId>/<sceneId>-narration.mp3`.

- **Voice:** `af_bella` (Kokoro via Replicate — paid, $0.0003/scene).
- **Cost:** 266 scenes × $0.0003 ≈ **$0.08** total.
- **Why Kokoro over Edge TTS:** adventure books are long-form narrative
  prose for older readers. Voice quality matters when the audio
  carries the story (vs activity where it's a question prompt).
- **Layout nuance:** adventure scenes are *single objects* (not arrays
  of exercises like activity). Scene files are nested under
  `ch1/`, `ch2/`, `ch3/` chapters (not flat like story book's
  `chapters.json`-driven enumeration). The script handles both via
  recursive directory walk + object shape (vs activity's array walk).

### Story book (unchanged)

`apps/lq-story-book/scripts/generate-narration.ts` was already in
place (uses `@blueforge-studio/audio-gateway`'s `ReplicateTtsAdapter`
directly). Books remained on whatever per-book coverage they had
before — this run did not touch story audio. Schedule a per-book
audit on StoryBookScreen if the catalogue gaps matter before launch.

## Two traps fixed in flight

### 1. Replicate under-$5 rate limit (429 wall)

Replicate's per-account rate limit depends on credit balance:

- **≥ $5 credit:** 350 req/min, generous burst.
- **< $5 credit:** drops to **6 req/min, 1 burst**, regardless of how
  much quota you've actually used (the throttle is pre-paywall).

The adventure-book script started failing on the second book because
the account is below the $5 floor. Initial 2s delay between calls
(~30 req/min) blew past the 6/min cap immediately. The 429 response
says "resets in ~1s" but the effective reset window is ~10s on this
tier — sleeping `retry_after + 1s` is insufficient.

**Fix shipped in the script:**
- Inline 429 retry up to 3 attempts per call.
- Parse `retry_after` from the error message; fall back to
  `LOW_CREDIT_DELAY_MS = 12000` (= 5/min, one safety second above the
  10s floor) when the parsed value is 0 or absent.
- Flip to `LOW_CREDIT_DELAY_MS` (12s) cadence for the rest of the book
  run once we've been throttled. Reverts only if the next request
  succeeds without a retry.
- `MAX_INLINE_RETRIES = 3` — after the third failed attempt, log the
  error and move to the next scene (a fourth attempt would still be
  throttled and would burn another 12s for nothing).

**Recovery cost:** 3 throttled calls cost 12s + 12s + 12s = 36s each
in the worst case. With ~266 scenes and most calls succeeding first
try, the overall runtime is ~22 minutes instead of the ~5 minutes the
script would take under the generous tier.

**If the operator needs to top up to $5** (recommended for any
retail-priced launch): [https://dashboard.replicate.com/account/billing](https://dashboard.replicate.com/account/billing).
The 429 wall disappears the moment credit crosses $5.

### 2. JSON writeback re-parse bug

The story-book script does this at writeback time:
```ts
const scene = JSON.parse(readFileSync(scenePath, 'utf-8')); // re-parse
scene.audio = { ...(scene.audio || {}), narration: narrationUrl };
writeFileSync(scenePath, JSON.stringify(scene, null, 2) + '\n');
```
That looks correct, but the success branch of the loop also mutated
`scene.audio` on the previously-parsed object — and then discarded
those mutations by re-parsing fresh here. In practice the story
script often worked because both writes happened to land at the same
moment (caching the variable in a tighter scope), but it's a latent
bug. Both the activity-book and adventure-book scripts use a
`Map<file, parsedScene>` cache so the in-memory object graph that gets
mutated is exactly the object that gets serialised. Pattern credit:
[project-activity-book-audio-2026-09-15] trap #3.

## What did NOT ship today

### Locale coverage (da, es)

All four reader apps declare books in three locales — `en`, `da`,
`es` — but **only `en` has scene content.** Confirmed across
`apps/lq-{story,activity,interactive,adventure}-book/public/data/books/{da,es}/`:
manifest.json stubs exist, but there is no scene content under
`{da,es}/<bookId>/scenes/`. Audio TTS cannot run on text that does
not exist.

This is a **content authoring blocker**, not a tooling blocker.
See `docs/books-platform/LOCALE_COVERAGE_BLOCKER_2026_09_15.md` for
the full finding + scope estimate.

### Stripe activation (books-platform checkout)

`apps/stripe-api/` is deployed (`books-platform-stripe-api-1-1`,
host port 3624, served at `stripe.questbooks.blueforge.studio`) but
unactivated. The endpoint will 500 on checkout until `STRIPE_SECRET_KEY`
and `STRIPE_WEBHOOK_SECRET` are populated and the Stripe dashboard
side is wired up (account, products, prices, webhook URL).

Full checklist in `docs/books-platform/RUNBOOK-stripe-activation.md`.

### Catalog sync (post-content-fix)

The 2026-09-15 content-length audit
(`books-platform/scripts/content/fix-estimated-hours.ts --write`)
locally corrected the two over-claiming books (`dragons-ally` and
`enchanted-library`). The corrected manifests have not yet been
uploaded and projected onto `publishing.books`, so the storefront
still shows the old `estimatedHours` for those two books.

Full runbook in `docs/books-platform/RUNBOOK-catalog-sync.md`. Must be
run on `forge-app-2` (the `books-api.env` file with `INTERNAL_API_KEY`
is not readable from this machine).

## Memory pointers

- `[project-activity-book-audio-2026-09-15]` — 3 traps hit in
  activity-book, summarised here.
- `[project-books-platform-live]` — pre-existing note on Stripe
  unactivated + content-length audit outstanding.
- `[reference-asset-resolution]` — apply before claiming any audio or
  imagery is "missing"; not used here since audio is consumed via
  direct `audio.narration` URL on the scene object (no resolver
  involved).

## Schema reminder

`SceneAudio` (shared, `packages/books-shared/src/types/book-base.ts`):
```ts
interface SceneAudio {
  background?: string;
  narration?: string;
  music?: string;
}
```
All three book apps that ship narration today wire it into the same
slot. Future books (interactive, any new type) should follow the same
pattern — one field on the scene/exercise, consumed by the
`<AudioLayer>` component via `current.audio`.

## Cost model going forward

Assuming the account stays below $5 credit:

- Edge TTS (`en-US-JennyNeural`): $0 — use for short question prompts
  and any high-volume audio (anything you'd write off as "free").
- Kokoro (`af_bella`): $0.0003/scene, rate-limited to 6/min. Use for
  narrative prose; budget ~$0.10 per full book.
- Custom voice via Replicate or other vendor: out of scope today.
