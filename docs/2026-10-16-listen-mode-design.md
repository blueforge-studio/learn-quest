# Listen mode: hands-free audio playlists for lessons and chapters

*Written 2026-10-16. Design plus a prototype (lq-core, branch `feat/listen-mode-prototype`). No content was generated for this doc, no spend. Facts are tagged **[V]** verified in code or data this session, **[S]** from a fetched/search source, **[U]** unverified (background knowledge, test before relying on it).*

## 1. Problem and goal

Lessons are text. A learner doing chores, shopping or commuting cannot use them. Ask: a **play button per lesson** and a **"Play chapter"** that walks through the lessons as an audio-only playlist, working with the screen off or locked.

Requirements:

| # | Requirement | Note |
|---|---|---|
| R1 | Hands-free: after one tap, the whole lesson/chapter plays without touching the screen | Needs pauses and transitions handled in audio, not in UI |
| R2 | Continues with screen off / app in background / phone locked | The hard platform constraint (section 6) |
| R3 | Lock-screen and headset controls: play/pause, next/previous, title | Media Session API |
| R4 | Works in the learner's language (en, th, zh, de first) with Danish words in a Danish voice | Reuse the narration pipeline |
| R5 | Cheap to produce and host; no per-play cost | Pre-generated edge-tts mp3 |
| R6 | Usable offline for a bounded set (commute, supermarket with no signal) | Section 7 |
| R7 | Accessible, consent-aware, no new tracking by default | Sections 9, 10 |

Non-goals now: speech recognition ("repeat after me" scoring), a podcast feed, native-only features.

## 2. What exists today (verified)

| Piece | Where | State |
|---|---|---|
| Narration schema | `lq-core/libs/common/schemas/src/lessons/language/concept.ts` (`NarrationClipSchema {audioUrl, audioDuration?, text?}`), types in `lq-core/libs/app/app-types/src/lesson/concept.ts` | `introNarration`, `sections[i].narration`, `tipsNarration`; `quiz[i].promptNarration` is typed but not generated **[V]** (lq-core#173) |
| Narration data | `lq-nordic/languages/danish/audio/<locale>/narration/chapter-N/<lesson>/<block>-<k>.mp3` + per-locale `manifest.json`; copied to `public/` by `scripts/sync-audio-to-public.ts`; mp3 in git LFS | en, th, zh, de for concept lessons ch1-10 **[V]** (lq-nordic#88, #92-#95) |
| Generator | lq-tools `narrate-lessons` (PR #89); voices: th Premwadee, zh Xiaoxiao, de Katja, en Aria, Danish words `da-DK-ChristelNeural` -15% (`lq-nordic/scripts/tts-config-danish.json`) | edge-tts, $0 |
| **Narration consumer** | none: `rg "introNarration\|\.narration"` over lq-core `libs` and `apps` finds only the schema, types and tests **[V]** at origin/main `26d85d56` | The clips are produced but **nothing plays them yet** |
| Vocab / phrase / dialogue audio | `targetLocale.audioUrl` (vocab), `practicePhrases[].audioUrl`, `dialogue[].audioUrl`, e.g. `audio/chapter-1/conversation-greetings/dialogue/0-hi.mp3` | Danish only; no learner-language audio **[V]** |
| Concept player | `lq-core/libs/app/web-app/src/screens/concept-player/ConceptPlayer.tsx` (+ `model.ts`) plays cue/example audio through `soundService.playAudioUrl` | One-shot clips, no queue |
| Audio plumbing | `libs/app/app-services/src/audio/{AudioPlayer,SoundService}.ts` (single element, TTS fallback), `libs/screens/lessons/src/{services/AudioService.ts,lib/AudioPlayer.ts}` (IndexedDB blob cache; its `setVolume`/`isMuted` are no-ops), `libs/app/app-hooks/src/useAudioElement.ts` | Built for effects and single words; no playlist; **no `mediaSession` anywhere** **[V]** |
| Shell | `libs/common/app-shell/src/QuestShell.tsx`, `chrome/BottomNav.tsx`, `pwa/` | Natural home for a persistent mini-player |
| PWA | `lq-core/apps/web/vite.config.ts` uses `VitePWA` (12 MB per-file precache cap); **lq-nordic has no service worker** (no workbox/registerSW in its `vite.config.ts` or `package.json`) **[V]** | Offline is a gap for Nordic |
| Native | umbrella PR #71 `2026-10-16-native-wrapper-decision-tauri-vs-capacitor.md`: Capacitor, app shell bundled, **audio stays on the R2 CDN with a bounded offline pack** | Same shape as our offline plan |

Quiz, spelling and word-order lessons have no audio at all **[V]** (no `audioUrl` on `multiple-choice` and `word-order` content, ch1-10).

## 3. Sizing: what ch1-10 contains (nordic/danish, en tree)

Counted from `lq-nordic@origin/main` `languages/danish/data/en/chapters.json` and the lesson files; enabled lessons in ch1-10 only.

| Lesson type | Lessons | Items | Listen relevance |
|---|---|---|---|
| concept | 41 | narration exists (4 locales) | core content |
| vocab | 75 | **654 words**, 375 (57%) have Danish audio, 279 do not | word, pause, meaning |
| conversation | 11 | 78 dialogue lines (75 with audio), 43 practice phrases (all with audio) | dialogue + translation |
| dialogue (branching) | 9 | graph `nodes`, not linear | skip for now |
| multiple-choice | 15 | 111 questions | quiz mode |
| concept `quiz` | 22 lessons | 42 fill-in-the-blank (`sentence`, no `prompt`) | skip or "blank" reading |
| culture | 15 | 27 sections, 10.5k chars | easy win: same shape as concept sections |
| spelling, word-order, drill, tonal, sound-pattern, review | 55 | visual/input exercises | skip (listen mode is passive) |
| **Total enabled** | **221** | | |

## 4. What each lesson type contributes

A lesson becomes an ordered list of **segments**. A segment is `audio` (a clip URL) or `pause` (a duration). Voice language is part of the segment so we know what to cache and what the learner is hearing.

| Lesson type | Segment recipe | Audio status |
|---|---|---|
| **concept** | intro clips, each section's clips, tips clips (the order the player reads) | exists, 4 locales |
| **vocab** | per word: `da word` -> pause 2.5 s (learner repeats) -> `meaning (L1)` -> pause 1 s. Optional second pass of the Danish words at the end of each block of ~10 | Danish: 57% exists, **279 missing**. L1 meaning: **none** |
| **conversation** | intro (L1), then per line: `da line` -> pause 1 s -> `translation (L1)`; then practice phrases as vocab | Danish lines exist; translations none |
| **multiple-choice** | `question (L1)` -> pause 4 s -> `"The answer is" + answer` -> `explanation`. Options are not read (too long to hold in memory). Opt-in: it is a recall prompt, not teaching | none |
| **culture** | same as concept sections (heading + body) | none (extend the narration pipeline to `culture` content) |
| dialogue (branching), spelling, word-order, drill, tonal, sound-pattern, review | skipped; the playlist shows "skipped (needs the screen)" | n/a |

Three presets keep the playlist honest: **Story** (concept + culture), **Study** (adds vocab + conversation), **Quiz** (adds questions). A chapter playlist = the lessons of `chapters.json` in `order`, filtered by preset.

## 5. Audio sources: pre-generated vs runtime

| | Pre-generated edge-tts mp3 on CDN (recommended) | Runtime TTS (Web Speech / on-demand edge-tts) |
|---|---|---|
| Lock screen / background | Plays as a normal media element | Web Speech `speechSynthesis` is not a media element: no Media Session, likely stops when backgrounded **[U]** |
| Quality / Danish | Consistent; per-word Danish voice switch already built | Device voices vary; Danish often poor or missing |
| Cost | $0 generation, static hosting | A server endpoint to run and rate-limit (`docs/TTS_CACHE_HANDLER.md` is an unbuilt design) |
| Offline | Cacheable | No |
| Risk | Storage grows with content/locales | Latency per segment, pause glitches |

**Recommendation: pre-generate**, reuse `narrate-lessons`, and extend it with `vocab`, `conversation` (translation), `multiple-choice` and `culture` extractors. Keep Web Speech only as the existing last-resort fallback in `SoundService`, never in Listen mode.

Licensing caveat **[U]**: edge-tts calls Microsoft Edge's read-aloud service through an unofficial client. Free but not a contract. Budget a paid fallback (Azure Speech neural voices, roughly $16 per 1M characters **[U]**; for the ~143k new characters below that is about $2.3) and keep generation reproducible elsewhere.

### 5.1 Estimates, ch1-10

Measured from the four `languages/danish/audio/<locale>/narration/manifest.json` files plus per-file LFS pointer sizes **[V]**:

| Locale | Lessons | Clips | Characters | Minutes | Size |
|---|---|---|---|---|---|
| en | 41 | 217 | 42,562 | 51.1 | 18.5 MB |
| th | 41 | 224 | 42,014 | 53.4 | 19.3 MB |
| zh | 41 | 141 | 18,261 | 56.7 | 20.5 MB |
| de | 40 | 238 | 48,509 | 60.7 | 22.0 MB |
| **Total (exists today)** | | **820** | **151,346** | **222 (3.7 h)** | **80.4 MB** |

Encoding is ~48 kbps mono, i.e. about **0.36 MB per minute**; average clip 14-24 s. (The th figures in lq-nordic#88 were the earlier subset; this is the merged state.)

Projected **full Listen** content per locale (assumptions: Danish word 1.3 s, L1 meaning 1.5 s, ~14 chars/s speech from the manifests, pauses as in section 4):

| Part | Items | New characters | Audible min | Pauses min |
|---|---|---|---|---|
| concept (exists) | 41 lessons | 0 | ~55 | 0 |
| vocab | 654 words | 9k (L1 meanings) (+3.2k Danish, once) | 30 | 38 |
| conversation | 121 lines+phrases | ~3k | 9 | 4 |
| multiple-choice | 111 questions | ~12k | 14 | 7 |
| culture | 27 sections | 10.5k | 13 | 0 |
| **Per locale** | | **~35k** | **~121** | **~49** |

One locale is about **170 minutes (2.8 h) for ch1-10**; four locales about **11 h**. New work is about **35k characters per locale: ~140k for four locales plus 3.2k Danish, roughly 4,900 short clips** (most L1 meaning clips are 1-2 s, about 10 KB). That is the same order as everything narrated so far (151k characters). Edge-tts cost $0.

Storage: with pauses baked into stitched files (6.2) a locale is ~170 min, **~61 MB, ~245 MB for four**. Segment-only (pauses as a shared silence clip) is ~121 min, ~44 MB per locale, ~175 MB for four. On R2 at the commonly quoted $0.015/GB-month **[U]** either is under **$0.01/month**. One chapter offline is about 6 MB (avg 17 min); ch1-10 for one locale 44-61 MB. Chapters 11-15 and the other three languages scale this by about 1.5x and 4x.

Git LFS note: ~5k tiny files in LFS is a poor fit (a pointer plus an object each). Listen assets should live in R2 under a per-locale pack with a manifest, not in lq-nordic git history (Q3).

## 6. Playback technology

### 6.1 HTMLAudioElement + Media Session

- One `HTMLAudioElement`, `src` swapped on `ended`: simplest design, what the prototype does (`useListenPlaylist`).
- **Media Session API** (`navigator.mediaSession`): `MediaMetadata {title, artist, album, artwork}`; action handlers include `play`, `pause`, `previoustrack`, `nexttrack`, `seekto`, `seekbackward/forward`. MDN marks it *Limited availability* (not Baseline), says to feature-detect with `"mediaSession" in navigator`, and wraps `setActionHandler` in try/catch because unsupported actions can throw **[V]** (MDN, fetched). MDN's example starts playback from a `pointerup` handler.
- Chapter markers exist as `ChapterInformation`; browser support unknown **[U]**.

### 6.2 Browser constraints

| Constraint | Finding | Confidence |
|---|---|---|
| Autoplay | iOS Safari has long required a user gesture for `<audio>`/`<video>`; only silent `<video>` was relaxed (WebKit blog, "New video policies for iOS") | **[V]** |
| So | The playlist must start inside a tap handler; later tracks must continue with no gesture | design rule |
| Background / lock | WebKit bugs and Apple forum threads: with the screen locked JavaScript is suspended, so an `ended` handler may not run and a new `src` may not start; reports differ by iOS version (regression around iOS 17.2.1, one user reports fixed in 17.5 after a June 2024 WebKit commit; a silent second `<audio>` element is an unverified workaround) | **[S]** forums/bugzilla only, no authoritative doc |
| Silence between clips | A pause done as a JS timer with nothing playing may let iOS suspend the page and drop the audio session | **[U]**, plausible given the above |

**Design consequence:** do not rely on "JS advances the queue while locked". Make the audio carry the playlist:

1. **Phase 1 (prototype semantics):** one element, `ended` -> next, pauses as shared pre-rendered silence clips (keeps an audio session active, no JS timers).
2. **Phase 2 (robust):** build-time **stitched lesson tracks**: one mp3 per lesson per locale per preset, pauses baked in, with a cue JSON (`[{start, end, segmentId, title}]`) for Media Session titles; "next" = seek to the next cue. A 3-8 minute single file needs no JS while locked. Cost: duplicate bytes (5.1) and an ffmpeg concat step in `narrate-lessons` (ffmpeg is already a dependency).
3. Test matrix before shipping either: iOS 17/18/26 Safari and installed PWA, Android Chrome, desktop Chrome/Firefox, locked for 10+ minutes. All **[U]** today; no device lab was used.

Wake Lock is not wanted (the screen must be allowed to turn off).

## 7. Player UX

1. **Entry points:** play button in the lesson header and on each lesson card of the chapter map; "Play chapter" in the chapter header (`lessonListComponent` / `LessonMapScreen` in web-app). Hidden when the lesson has no tracks (`buildConceptTracks` returns `[]`).
2. **Mini-player bar** (prototype `ListenBar`): prev, play/pause, next, title with `i/N`, speed. Mounted once in the shell near `chrome/BottomNav.tsx` so it survives route changes; the audio element lives in a provider, not in a lesson screen.
3. **Speed** 0.8x / 1x / 1.25x / 1.5x (prototype). Consider a 0.9x default for the youngest profile (narration is already -10% for the Thai 8-year-old).
4. **Sleep timer:** 15/30/60 min and "end of lesson", by pausing the element.
5. **Resume position:** persist `{playlistId, trackId, offsetSec, rate}` per learner profile (localStorage in try/catch, or the player-state store if sync is wanted). Resume = rebuild playlist from current content, seek.
6. **Offline:** Cache API via a service worker. Needs a SW in lq-nordic (none today); `apps/web`'s VitePWA setup is the model. Rules: explicit "Download chapter" (never silent), `Range` request handling for media in the SW (Safari requires it **[U]**), LRU cap (default 150 MB, configurable), per-chapter delete, show size first. In Capacitor use the same Cache API in the webview first; native storage only if eviction hurts (PR #71).
7. **Progress/XP:** listening does not grant XP or complete lessons (no engagement signal with the screen off). Optional local "listened" badge.

## 8. Data model

```ts
type ListenSegment =
  | { kind: 'audio'; id: string; url: string; voiceLang: string;  // 'da-DK' | learner locale
      durationSec?: number; text?: string;
      role: 'narration'|'word'|'meaning'|'line'|'question'|'answer' }
  | { kind: 'pause'; id: string; durationSec: number; purpose: 'repeat'|'think'|'breath' };

interface ListenTrack    { id: string; lessonId: string; title: string; segments: ListenSegment[] }
interface ListenPlaylist { id: string; scope: 'lesson'|'chapter'; preset: 'story'|'study'|'quiz';
                           locale: string; tracks: ListenTrack[]; totalSec: number }
```

Builder (pure, tested): `buildPlaylist(chapter, lessons, narrationManifest, preset, locale)`: `chapters.json` (`chapters[].lessons[]` with `enabled`, `order`) -> per-type extractor -> segments. Extractors return `[]` when audio is missing and the builder reports `missing[]` so the UI can say "7 of 12 lessons available as audio". The manifest (`entries[path] {lesson, block, chars, duration, voice, danish[]}`) supplies durations when a lesson JSON lacks `audioDuration` and the Danish words per clip for captions.

Prototype subset already in code: `ListenTrack {id,url,title,durationSec,text}` (flat, one per clip) with `buildConceptTracks(content, {lessonId, resolveUrl})` and `buildChapterTracks`. The flat shape maps to phase 1; segments/pauses are the phase 1b extension.

Home: playlist building is domain code (web-app or a new lib); the hook and bar are shell chrome (app-shell). The prototype keeps both in `libs/common/app-shell/src/listen/` with structural types, so no new dependency edge; split later when vocab/quiz extractors land.

## 9. i18n and accessibility

- UI labels (play, pause, next, previous, speed, sleep timer, "Play chapter", "Download for offline") through `react-i18next`; `ListenBar` takes a `labels` prop today. Needs th/zh/de strings (see the Thai UI audit, lq-core#166).
- Content language = the learner's L1 (as for narration); Danish words stay Danish via the existing voice switch. Playlist locale follows learner locale, not UI locale, when they differ.
- A11y: targets >= 44 px, `aria-label`s, `aria-pressed` on play, `aria-live="polite"` track title, visible focus. No autostart on load (also an autoplay-policy requirement). Provide the clip `text` as a transcript (already stored) for deaf/hard-of-hearing users. No animated equaliser under `prefers-reduced-motion`. Headset and OS media keys come with Media Session.

## 10. Analytics and consent

- Playing audio is essential functionality: no consent needed to play. **Do not add** listening analytics unless the learner opted in through the existing consent (`libs/common/app-shell/src/legal/CookieConsent.tsx`, `useConsent`).
- If we measure, use aggregate events only (`listen_start`, `listen_complete_lesson`, preset, locale, duration bucket) and nothing for child profiles unless the kids-privacy position (PR #71 store-compliance section) allows it.
- Offline downloads stay on the device; mention in the privacy page and offer "delete downloads".
- Edge-tts sends only lesson text to Microsoft at build time; no learner data.

## 11. Phased plan

| Phase | Scope | Effort | Blocked on content generation? |
|---|---|---|---|
| **P0** (this PR set) | design doc; prototype hook + `ListenBar` + `buildConceptTracks`, flag off, unit tests | 1 day | no |
| **P1** | Concept-only Listen in Nordic: provider in shell, lesson-header button, "Play chapter" (concept lessons), speed, Media Session, resume. First **device test matrix** (iOS lock screen). Also make the concept *reader* use narration (nothing does today) | 4-5 days | no (ch1-10 concept audio exists in 4 locales; th had 18 untranslated/missing lessons at lq-nordic#88; #92 narrated the newly translated ones, remaining gaps not re-checked) |
| **P2** | Stitched per-lesson tracks with baked pauses + cue JSON if P1 tests show lock-screen advance is unreliable (likely) | 3-4 days tooling, 1 day client | no |
| **P3** | Vocab + conversation recipes: 279 missing Danish word clips, L1 meaning clips (~654 per locale), conversation translations | 3 days tooling + generation runs; ~48k characters for 4 locales + 3.2k Danish | **yes**, and needs vocab translations present in th/zh/de (not verified) |
| **P4** | Quiz and culture recipes | 3 days; ~22k characters per locale | **yes** |
| **P5** | Offline: SW for Nordic, "Download chapter", LRU cap, storage UI | 4-5 days | no |
| **P6** | Sleep timer, presets UI, resume sync, a11y pass, analytics behind consent | 3 days | no |
| **P7** | Capacitor: `UIBackgroundModes: audio`, native media-controls plugin only if the webview path falls short **[U]** | 3-5 days after #71 | no |

Total roughly 25-30 person-days. P1 answers most of the original request for concept lessons; P3 is what makes it a real "study while shopping" experience (vocab is 654 of the lesson items).

## 12. Open questions

1. Does iOS Safari / the installed PWA keep advancing a src-swap queue with the screen locked on current iOS? Evidence is version dependent. Decide P2 up front or after the P1 device test (needs a physical device).
2. Is edge-tts acceptable for production content long term (unofficial endpoint)? Pick a paid fallback and an owner.
3. Where do Listen assets live: lq-nordic git LFS (today) or R2-only packs built in CI? ~5k small files argue for R2 + manifest.
4. Do vocab translations (`learnerLocale.meaning`) exist for th/zh/de for all 654 words? Concept gaps are known (lq-nordic#88); vocab coverage not checked.
5. Quiz presentation: read options or not; how to voice the 42 fill-in-the-blank `sentence` questions; is passive quizzing worth it?
6. Adaptive repeat pause (by word length / learner level)? Start fixed 2.5 s.
7. Kids-privacy and store position for under-13 profiles (analytics, offline storage); tied to PR #71's open risks.
8. Chapter markers in Media Session once stitched tracks exist?
9. Danish-word detector caveats from lq-nordic#88 ("perfect", "te", "hoved") matter more when the learner cannot see the text.

## 13. Not verified

- All iOS/Android lock-screen behaviour (no device this session); the silent-`<audio>` workaround; `preservesPitch` and `ChapterInformation` support; Safari `Range` needs for SW-cached media; R2 and Azure pricing; Web Speech in background; edge-tts terms. Everything tagged **[U]**.
- Projected minutes use speech rates taken from the existing manifests; vocab/quiz/culture counts come from the `en` tree only.

## Prototype (lq-core)

`libs/common/app-shell/src/listen/` on branch `feat/listen-mode-prototype`: `useListenPlaylist` (single element, auto-advance, next/prev, rate, Media Session metadata and handlers, inert when the flag is off), `ListenBar`, `buildConceptTracks`/`buildChapterTracks`, `isListenModeEnabled` (`VITE_LISTEN_MODE_ENABLED`, default off), 16 unit tests. Not wired into any app, not published.

## Sources

- MDN, Media Session API: https://developer.mozilla.org/en-US/docs/Web/API/Media_Session_API
- WebKit, New video policies for iOS: https://webkit.org/blog/6784/new-video-policies-for-ios/
- WebKit Bugzilla 173332, 221413, 261554, 229688, 204681, 261858 and Apple forum thread 706499 ("Safari Audio player doesn't play next track of the audio playlist when iPhone screen locked"): found via search, summaries only, pages not individually read.
- Code and data: `lq-core@26d85d56`, `lq-nordic@256187b0`, lq-nordic#88, #92-#96, lq-core#173, lq-tools#89, learn-quest#71.
