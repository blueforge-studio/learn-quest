# Books-platform ambient/audio reuse strategy (2026-09-15)

Operational guide for sourcing ambient audio, music, and sound effects
across the adventure book platform. **Reuse first, generate only when
reuse doesn't cover.** Replicate is the last resort, not the default.

## TL;DR

Before reaching for Replicate / Stable Audio / Kokoro music gen:

1. **Check existing pools first** — `adventure-craft/apps/<world>/public/audio/{ambient,music,sfx}/`
   in the sibling adventure-craft repo (operator-owned, reuse-unrestricted).
2. **If no internal fit, check free external libraries** — see the
   ranked list below. Most have direct mp3 download via curl.
3. **Only then reach for Replicate** — typically only when:
   - The theme is so niche that no library has anything close
   - The track must be content-specific (e.g., reading a specific
     character's name aloud with a specific voice — that's narration,
     handled separately by the lazy TTS endpoint)
   - Operator explicitly approves the spend

## Existing internal pool — `adventure-craft/`

Located at `/Volumes/SSD/Projects/Repos/adventure-craft/apps/<world>/public/audio/`.

| Source app | ambient | music | sfx | Themes |
|---|---|---|---|---|
| `arid-world` | 15 | 0 | 4 | desert, ruins, badlands, oasis, salt-flat, corruption, weather |
| `gothic-world` | 11 | 6 | 4 | ashenmoor / dreadmere / hollowmark / pale-court / ravensreach / threshold + 5 `madness-*` variants + 6 `darklord-*` boss music |
| `japan-mythic` | 9 | 2 | 3 | bamboo-forest / imperial-capital / sacred-mountains / spirit-realm + weather |
| `khmer-mythic` | 5 | 2 | 3 | river / temple themes |
| `pirates` | 3 | 1 | 8 | dock / ocean / tension + sea-shanty |
| `viking-world-quest` | 12 | 0 | 0 | **weather-only** (themed events, not generic atmosphere) |

`viking-world-quest` is "weather-only" — useful for arctic / storm
scenes specifically, not generic atmosphere. Don't try to use it for
non-viking themes.

`gothic-world` has both atmospheric ambient (`ashenmoor` /
`dreadmere` / `hollowmark` / `pale-court` / `ravensreach` /
`threshold`) AND dissonant variants (`madness-*`) AND gothic boss
music (`darklord-*`). The atmospheric set works for medieval-fantasy
if used conservatively; the madness-* / darklord-* tracks are too
intense for non-gothic themes.

## External free libraries (ranked)

### 1. [soundimage.org](https://soundimage.org/) — Eric Matyas

- **License:** CC BY 4.0 (commercial OK, attribution required)
- **Cost:** $0
- **Catalog:** ~250 sci-fi music tracks across 15 pages, ~60 dedicated
  sci-fi ambient tracks, ~50 sci-fi SFX (drones, lasers, air locks,
  robot footsteps, force fields, hull breaches)
- **Why it ranks #1:** Original non-AI production (fits project
  ethos), all-in-one (ambient + music + SFX in same library), MP3
  direct download, well-known in indie game-dev community.
- **Pattern proven** — see `apps/sci-fi-fx/public/audio/` (10 ambient
  + 6 music tracks for sci-fi books). Curated directly from
  soundimage.org via curl.
- **Attribution requirement:** "Music & sound effects by Eric Matyas
  (soundimage.org)" must appear somewhere end-user-visible. Tracked
  in `books-platform/THIRD_PARTY_LICENSES.md` (new file, 2026-09-15).

### 2. [Pixabay Music](https://pixabay.com/music/)

- **License:** Pixabay Content License (commercial OK, no attribution)
- **Cost:** $0
- **Catalog:** 11,621+ sci-fi tracks (largest music-only catalog)
- **Why #2:** No attribution friction, large catalog. Downside: music
  only (no ambient/SFX), community-uploaded quality varies.

### 3. [Freesound.org](https://freesound.org/)

- **License:** CC0 / CC-BY / CC-BY-NC (filter required)
- **Cost:** $0
- **Catalog:** Mostly SFX / soundscapes, weak ambient music
- **Why #3:** Use for SFX accents. **Filter to commercial-use
  licenses only** (CC0 or CC-BY) — CC-BY-NC is NOT for commercial use.

### 4. Backup options (smaller catalogs)

- **Fesliyan Studios** — clean royalty-free sci-fi library, subscription tier
- **Uppbeat** — free tier with attribution, per-month download limits
- **Alexander Nakarada** (YouTube creator) — high quality CC-BY

## How to source a new external pool

1. **Pick a pool-id** (e.g., `sci-fi-fx`, `pixabay-ambient`, `freesound-sfx`).
2. **Create the directory** in books-platform:
   `apps/<pool-id>/public/audio/{ambient,music,sfx}/`
3. **Download mp3s** via curl from the source (soundimage.org URLs
   follow `https://soundimage.org/wp-content/uploads/YYYY/MM/<track>.mp3`
   — no manual download step needed).
4. **Document in `THIRD_PARTY_LICENSES.md`**: license name, attribution
   string, where the mp3s are, which books consume them.
5. **Reference from a `reused-manifest.json`** with:
   - `sourceRepo: "."` if the pool lives in books-platform itself
   - `sourceRepo: "<relative-path>"` if it's a sibling repo
6. **Run the standard pipeline:** `pnpm audio:copy-reused --book=<id>` +
   `pnpm audio:wire-reused --book=<id>`, commit, push.

## Why not Replicate?

- **Cost** — Stable Audio ≈ $0.10-0.20 per generation. A typical
  adventure book wants ~50 ambient + 6 chapter music = ~$8-10 per
  book. Across 9 books = $75+. External libraries + adventure-craft
  reuse covered the same scope for $0.
- **Throttle pain** — Replicate <$5 credit floor caps at 6 calls/min.
  The 80-minute generation wall documented in
  `project-adventure-book-audio-2026_09_15` is the symptom.
- **Quality floor** — Stable Audio is fine but not better than the
  Eric Matyas curated catalog, and reuse has zero generation
  variance.
- **AI ethics** — External libraries offer original human-made work;
  Replicate generates AI music. Project ethos leans toward
  non-AI-generated creative work where possible.

## When Replicate IS the right call

- Narration / TTS — handled by the lazy-cache TTS endpoint
  (`apps/books-api/src/routes/audio/narration.ts`) which uses
  Edge TTS ($0) by default and Kokoro only when explicitly requested.
  See `docs/books-platform/AUDIO_STRATEGY_PROPOSAL_2026_09_15.md`.
- Niche themes not covered by any library (e.g., a specific
  historical-period ambient that's not in the existing pools).
- Operator explicitly approves spend on a per-book basis.

## Coverage summary (2026-09-15)

9/11 adventure books fully covered via reuse-first:

| Book | Source pool | Coverage |
|---|---|---|
| mystery-at-midnight | gothic-world | 11 amb + 6 music |
| the-pompeii-letters | arid-world (partial) | 7/15 amb |
| the-lost-city-of-gold | khmer+pirates+japan | 26/26 amb |
| jungle-detective | khmer+pirates+japan | 27/27 amb |
| the-coral-kingdom | pirates+khmer+japan+viking | 24/24 amb |
| the-viking-voyage | viking+pirates+japan | 31/31 amb |
| the-dragons-ally | gothic (atmospheric only) | 26/26 amb |
| robot-rebellion | **sci-fi-fx (soundimage.org)** | 24/24 amb + 3 music |
| the-space-heist | **sci-fi-fx (soundimage.org)** | 30/30 amb + 3 music |

`the-mariana-express` remains untouched (0 scenes, unauthored).
