# Native wrapper decision: Tauri 2 vs Capacitor for the Learn Quest PWA

*Written 2026-10-16. Research only, no code changed. Facts marked **[V]** were
verified against a fetched primary source this session, **[S]** came from search
snippets only, **[U]** could not be verified (from background knowledge, check
before relying on it).*

## 1. Recommendation (short)

1. **Use Capacitor 8** (current major, released 2025-12-08 [S]). The dependency
   set is already declared in `lq-core/apps/web/package.json`, the app already
   guards on `window.Capacitor`, and the plugins we need on a kids/education app
   (remote push, IAP via RevenueCat/community, splash, status bar, keyboard,
   deep links, browser/OAuth) exist and are widely used. Tauri 2 mobile works but
   would mean writing or adopting community plugins for IAP and remote push.
2. **Bundle the app shell (JS/CSS/index) in the binary; keep lesson content and
   audio on the R2 CDN** with a bounded, explicit offline pack. Do not bundle the
   442 MB `lq-nordic/public` tree.
3. **Estimate: about 22 person-days** to first store submission for one language
   group app (Nordic Quest first), plus roughly 5 days per additional group app.
   Largest risk is not the wrapper, it is store compliance (Kids Category /
   Families, Apple 4.2 "repackaged website") and the decision on whether the
   product is positioned as a children's app at all.

## 2. What exists today (rg across lq-*, books-platform, umbrella docs)

Searched `/Users/kmandrup/Repos-internal/learn-quest/{lq-core,lq-nordic,lq-tools,lq-operations,books-platform}` and
`learn-quest-umbrella/docs`, excluding node_modules and lockfiles.

| Where | What |
|---|---|
| `lq-core/apps/web/package.json` (lines ~403-442) | Section "Mobile (Capacitor)": scripts `mobile:icons`, `mobile:splash`, `mobile:assets`, `mobile:sync` (`npx cap sync`), `mobile:ios`, `mobile:android`. Deps `@capacitor/{android,app,cli,core,ios,keyboard,local-notifications,push-notifications,splash-screen,status-bar}` all `^8.0.x`. |
| `lq-core/apps/web/src/hooks/usePWAInstall.ts` (+ copy in `libs/app/app-hooks/src/usePWAInstall.ts`) | Hides the PWA install prompt when `window.Capacitor?.isNativePlatform?.()`. The only runtime Capacitor reference. |
| `lq-core/apps/web/scripts/DESIGN-PROPOSAL.md` | Mentions a planned `mobile/` tools folder ("Capacitor tools"). |
| `lq-core/docs/agent-pack/stack.md` | Census: "No Go, Rust, Electron, Tauri or React Native repos were found". Notes that the separate **linguaquest** product has `apps/web` Vite + Capacitor (a possible reference implementation, not inspected here). |
| Other hits | Incidental only: `lq-tools` MIGRATION-GUIDE and two image-tools lesson JSONs, a `books-platform` adventure-book scene JSON (words in story text), `screen-audit/minimax-evaluator.mjs`, a Playwright HTML report. |
| **Absent** | No `capacitor.config.*`, no `ios/` or `android/` projects, no `src-tauri/`, no `apps/web/scripts/mobile/` (the `mobile:icons`/`mobile:splash` scripts point at `.cjs` files that do not exist), no Tauri deps anywhere. `lq-operations` has no hits. |

Conclusion: Capacitor is **declared but never scaffolded**. Nothing has been
built natively; there is no sunk native code to protect either way.

## 3. What the wrapper must wrap

### Build output and base URL

* `apps/web` is a Vite SPA. `vite.config.ts` sets no `base` (so `/`, absolute
  paths) and `copyPublicDir: false` with a custom plugin that copies `public/`
  minus symlinks (public/apps/** are absolute symlinks into sibling repos on the
  operator machine and dangle on build hosts).
* Per `lq-core/CLAUDE.md`, language content is **served per-app from the CDN**
  (`@learnquest/http-content-source`, R2/S3) and "the production bundle must not
  contain it". `lq-nordic/public` is **442 MB** locally. Bundling it would blow
  store size limits and defeat the content pipeline (asset-version history, per
  `docs/ASSET_RESOLUTION.md` the runtime resolves images through per-domain
  `index.json` maps plus path-convention refs).
* Absolute `/...` asset paths work in both Capacitor and Tauri because each
  serves the bundle from its own origin root. Content URLs that are relative to
  the site origin (e.g. `/languages/...`) will **resolve to the local origin in
  the wrapper, not the CDN**. A single configurable content base
  (`VITE_CONTENT_BASE` or runtime config) is required, pointing at the R2 CDN
  absolute URL in native builds. The exact current resolution code path was not
  traced end to end (**[U]**); this is the main scaffold-phase investigation.
* CORS: the wrapper origin (`https://localhost` / `capacitor://localhost` /
  `tauri://localhost`) will be a cross-origin caller to R2 and `forge-auth`. R2
  bucket CORS and the API allow-lists must include it. Cookies are third-party
  in this setup, so session auth should use bearer tokens, not cookies.

### Service worker

* `vite-plugin-pwa` (`registerType: autoUpdate`, `src/pwa.ts` calls
  `registerSW`) with Workbox runtime caching: Google Fonts, images
  (StaleWhileRevalidate, 100 entries, 30 days), content JSON (50 entries, 7
  days), `maximumFileSizeToCacheInBytes` 12 MB.
* **Capacitor**: Android serves from `https://localhost` (default
  `androidScheme: https`) so service workers register; iOS serves from
  `capacitor://localhost`, a custom scheme where **service workers do not
  register in WKWebView** (WKWebView only supports SW for app-bound domains /
  http(s)) **[U]**. Capacitor docs confirm the scheme defaults and that
  `iosScheme` cannot be http/https **[V]**, which is why SW on iOS is not
  available. Consequence: on iOS the SW is dead code and offline must come from
  the bundled shell plus an app-managed cache (Cache API from page context,
  IndexedDB, or Capacitor Filesystem), not Workbox. Guard `registerSW` with
  `Capacitor.isNativePlatform()` so Android does not double-cache a bundle that
  is already local.
* **Tauri 2 mobile**: serves via a custom protocol (`tauri://localhost` on iOS,
  `http(s)://tauri.localhost` on Android) **[U]**. Same SW limitation on iOS.
* iOS WKWebView storage is subject to eviction under storage pressure (ITP's
  7-day rule applies to script-writable storage in Safari, not generally to
  app WebViews, but quota is smaller than native files) **[U]**. Large offline
  packs belong in the native filesystem, not IndexedDB.

### Audio

* The app uses `HTMLAudioElement` (`services/audio/AudioPlayer.ts`),
  `SpeechSynthesisService`, `useBackgroundMusic`, and `AudioInputService`
  (mic).
* Autoplay: WKWebView requires a user gesture unless
  `mediaTypesRequiringUserActionForPlayback` is relaxed. Capacitor exposes this
  via iOS config (`ios.allowsInlineMediaPlayback`, `mediaPlaybackRequiresUserAction`)
  **[U]**; background music still needs a first gesture. Tauri 2 does not
  expose the equivalent as config on iOS without custom Swift **[U]**.
* Microphone needs `NSMicrophoneUsageDescription` and the Android `RECORD_AUDIO`
  permission, and on Families/Kids apps a clear justification and privacy
  statement. `speechSynthesis` voice availability differs from desktop browsers,
  so Thai/Nordic voices must be tested on device.
* Audio focus/interruption (calls, silent switch) needs native handling via a
  community plugin in either framework.

### Auth, deep links, payments, push

| Need | Capacitor 8 | Tauri 2 mobile |
|---|---|---|
| Auth (forge-auth; Google/Facebook/WeChat are stubs: "forge-auth Google sign-in not yet wired") | `@capacitor/browser` + `@capacitor/app` `appUrlOpen` for system-browser OAuth with custom scheme / Universal Links. Google/Apple native sign-in via community plugins. | System browser plus deep-link plugin (`tauri-plugin-deep-link`, official, mobile-capable **[U]**). Less trodden. |
| Deep links | `@capacitor/app`; Universal Links / App Links need `apple-app-site-association` and `assetlinks.json` on the app host. | Official deep-link plugin **[U]**, same server files. |
| IAP (Apple 3.1.1 requires IAP for unlocking premium content **[V]**) | RevenueCat has an official Capacitor SDK (`@revenuecat/purchases-capacitor`) **[U]**; also Capgo/community plugins. Stripe (present in repo) cannot be used for digital goods inside the iOS app. | No official IAP plugin. Community `tauri-plugin-iap` (Choochmeque, 63 stars as of 2026-04-05) **[S]**. RevenueCat said in 2024 it had no plans for Tauri v2 **[S]**. |
| Remote push (APNs/FCM) | `@capacitor/push-notifications` (already a dep) plus an FCM/APNs provider. Note FCM/Firebase conflicts with the Kids data rules (see section 4); APNs-direct is preferable. | Official notification plugin lists iOS/Android but the evidence found covers local notifications only **[S]**; remote push comes from community plugins (`tauri-plugin-mobile-push`, `tauri-plugin-notifications`, latter last pushed 2026-08-07, 77 stars **[S]**). |
| Splash, status bar, keyboard, safe area | First-party plugins, already deps; Capacitor 8 adds built-in SystemBars for Android edge-to-edge **[S]**. | Partly via config; keyboard and status-bar behavior needs custom or community work **[U]**. |

## 4. Current facts (2026)

### Tauri 2 mobile

* Tauri 2.0 stable shipped 2024-10; the RC post stated production-ready mobile
  was possible but "not all of our desktop features and plugins are ported or
  available on mobile yet", with parity promised in minor releases **[S]**
  (https://v2.tauri.app/blog/tauri-2-0-0-release-candidate/). Latest release
  post found: **Tauri 2.12 on 2026-09-26** **[V]** (https://v2.tauri.app/blog/);
  its excerpt did not mention mobile, so mobile feature parity in 2026 is **not
  verified**.
* Docs list mobile plugins (biometric, haptics, NFC, barcode, geolocation) and
  signing/distribution guides for iOS and Android; Swift/Kotlin plugin
  authoring is supported **[V]** (https://v2.tauri.app/start/).
* Requires Rust toolchain plus targets (`aarch64-apple-ios`, Android triples),
  Xcode, Android Studio/NDK. Rust is on this machine (cargo/rustc 1.97.1) but
  **no `rustup`** so mobile targets cannot be added here without changing the
  toolchain (Homebrew rust).
* The webview is the system one (WKWebView / Android System WebView), same as
  Capacitor. Tauri's advantage (small Rust-core binary, security model) is
  mostly irrelevant for a content app whose logic is all in the JS bundle.

### Capacitor

* **Capacitor 8** announced 2025-12-08; **8.5 released 2026-07-31** (iOS-only,
  adds UIScene adoption, needed only for apps built with Xcode 27) **[S]**
  (https://ionic.io/blog/announcing-capacitor-8). Requirements: Xcode 26.0+ and
  Android Studio 2025.2.1+ per Ionic docs; iOS deployment target 15, Android
  minSdk 24 / target 36, JDK 21, Node 22+ per Capgo (secondary source) **[S]**
  (https://capacitorjs.com/docs/next/getting-started/environment-setup,
  https://capgo.app/blog/upgrade-capacitor-app-to-capacitor-8/). The repo's
  `^8.0.2` matches. SPM is the default for new iOS projects **[S]**.
* Server config: `server.url`, `cleartext`, `allowNavigation` are documented as
  not for production; `hostname: localhost` keeps secure-context APIs;
  changing `androidScheme` away from http/https can break routing on WebView
  117+ **[V]** (https://capacitorjs.com/docs/config).

### Apple App Review (fetched 2026-10-16)

Source: https://developer.apple.com/app-store/review/guidelines/ **[V]**
(page truncated at about 100k of 112k characters, tail of section 5 unread).

* **1.3 Kids Category**: no links out, purchasing opportunities or other
  distractions unless behind a parental gate; no PII or device info to third
  parties; "should not include third-party analytics or third-party
  advertising"; limited exceptions only if the service does not collect the
  IDFA or any identifiable child/device data.
* **5.1.4 Kids**: COPPA/GDPR care; apps primarily for kids should not include
  third-party analytics or advertising; a privacy policy is required for Kids
  Category apps and any app that can collect minors' personal information; the
  parental gate is "generally not the same" as parental consent. **2.3.8**:
  terms like "For Kids" in metadata are reserved for the Kids Category.
* **4.2 Minimum Functionality**: the app must "elevate it beyond a repackaged
  website". A pure WebView of the PWA is a rejection risk; native value must be
  visible (push reminders, offline packs, IAP, native audio/mic, haptics).
* **3.1.1**: premium content or features must use IAP.
* Not verified: the current "Upcoming Requirements" page, any 2026 age-rating
  changes, and exact Xcode/SDK upload minimum (assume Xcode 26 / iOS 26 SDK).

### Google Play (fetched 2026-10-16)

* Families policy (https://support.google.com/googleplay/android-developer/answer/9893335) **[V]**:
  ads to children only via Families Self-Certified Ads SDKs; child-only apps must
  not use APIs/SDKs not approved for child-directed services, must not transmit
  AAID/IMEI/IMSI, must not request location; mixed-audience apps need a neutral
  age screen; must disclose data collected via SDKs; and **"Apps must not be
  merely a webview of a website."** Target audience must be declared accurately
  in Play Console (misdeclaration risks removal).
* Target API (https://developer.android.com/google/play/requirements/target-sdk) **[V]**:
  from 2026-08-31 new apps and updates must target **Android 16 / API 36**;
  existing apps API 35 to stay visible to new users on newer Android; extension
  to 2026-11-01. The page itself notes it was updated 2026-10-01, so confirm in
  Play Console before submission. Capacitor 8 targets 36 by default **[S]**.
* Not verified: the Data Safety form specifics for Families, the formal
  "Designed for Families" program mechanics (the Families page did not name it),
  and Play's newer account verification / testing requirements for new personal
  developer accounts (**[U]**: 12-testers/14-day closed test rule applied to
  personal accounts created after Nov 2023; confirm if the publisher account is
  personal rather than an organization).

### What this means for compliance in this codebase

* `@blueforge-studio/analytics-api`, `notifications`, and Stripe packages exist in
  the web app. For a Kids Category / Families listing, third-party analytics and
  ads must be off in native builds (feature-flag by `isNativePlatform()`),
  Stripe links and external links need a parental gate, and Firebase Messaging
  (FCM default for `@capacitor/push-notifications` on Android) needs a data
  review. (Firebase was removed from the backend per CLAUDE.md, but FCM remains
  Google's only Android push transport.)
* **Decision needed from product owner**: is Learn Quest a Kids app? The
  product copy is general-audience ("Learn Danish, Norwegian... through RPG
  quests", status Beta). The cheaper path is **not** opting into the Kids
  Category / child-directed target audience (teens+ 13+, neutral age screen,
  privacy policy, COPPA-safe data practices), which avoids 1.3 and the Families
  SDK allow-list. Mislabelling in either direction is a rejection or removal
  risk. This choice moves the compliance phase from about 4 to 8 days.

## 5. Option comparison

| Criterion | Capacitor 8 | Tauri 2 mobile |
|---|---|---|
| Already in repo | Deps and scripts declared, `isNativePlatform` guard live | Nothing |
| Web code reuse | Direct, plugin API is JS-first | Direct, but backend glue is Rust/Swift/Kotlin |
| Push | First-party plugin | Community plugin(s), unverified maintenance |
| IAP | RevenueCat and community plugins | One small community plugin |
| Deep links/OAuth | Mature | Official deep-link plugin, less field experience **[U]** |
| Service worker on iOS | Not available (custom scheme) | Same |
| Android SW | Works (https://localhost) | Works via http(s)://tauri.localhost **[U]** |
| Toolchain weight | Node + Xcode + Android Studio, JDK 21 | Adds Rust + iOS/Android targets (no rustup on this machine) |
| Binary size/perf | WebView + small runtime | Similar |
| Team skills | Pure TS | Needs Rust and Swift/Kotlin for gaps |
| Community/docs for app-store shipping | Large | Smaller, improving |
| Risk of being blocked on a missing plugin | Low | Medium to high (IAP, remote push, audio session) |

Tauri would win if we wanted one codebase for desktop and mobile with a Rust
backend. We do not: logic lives in the JS bundle and backend is server-side.

## 6. Environment check (this machine, 2026-10-16)

* Xcode 26.1.1 (17B100); iOS 26.1 simulator runtime installed. Capacitor 8
  needs Xcode 26+, so iOS builds are feasible. **[V]**
* Node v24.11.1; JDK openjdk 21.0.9 (matches Capacitor 8's JDK 21). **[V]**
* **No Android SDK** (`~/Library/Android/sdk` absent, `ANDROID_HOME` unset): an
  Android build needs Android Studio / cmdline-tools plus SDK 36 (a
  multi-GB install, not done). **[V]**
* Rust: cargo/rustc 1.97.1 via Homebrew, no `rustup`, so no iOS/Android Rust
  targets. **[V]**
* No simulator build or install was attempted (research only).

## 7. Effort estimate (Capacitor, one language group app, Nordic Quest first)

Person-days, one engineer who knows the web app, excludes content work and
review wait time.

| Phase | Days | Contents |
|---|---|---|
| Scaffold | 3 | `capacitor.config.ts` (`appId`, `webDir: dist`, https scheme), `cap add ios/android`, create the missing icon/splash scripts, native-aware build mode (`VITE_NATIVE=1`), content/API base URL config, CORS allow-lists on R2 and forge-auth, safe-area/keyboard/status-bar polish, run on iOS simulator and an Android emulator |
| Asset and offline strategy | 6 | Disable SW registration on native; bundle shell only; offline lesson-pack downloader to Filesystem with version manifest (reuse asset-version history), cache eviction and size UI, audio autoplay/gesture handling and audio session, device QA of speech synthesis and mic for each language |
| Store compliance | 4 (8 if Kids Category) | Target audience decision, privacy policy and data inventory (Apple privacy labels, Play Data Safety), disable third-party analytics in native, parental gate if any link-out/purchase, IAP via RevenueCat (store products, restore purchases) if premium is sold, native value for 4.2/Families "not a webview" (push reminders, offline packs, haptics), age rating questionnaires, Play account/testing requirements |
| CI and signing | 4 | Apple Developer account, certs/profiles (Fastlane match or manual), APNs key, Android keystore and Play App Signing, forge-ci pipeline on a macOS runner for iOS (a runner may not exist, **[U]**), version/build number sync, secrets in forge-vault |
| Release | 5 | TestFlight and Play internal/closed testing, screenshots and metadata per store, review rounds and fixes (budget 2 rejections), phased rollout, crash reporting without third-party SDKs in Kids mode |
| **Total** | **22** (26 if Kids Category) | About 5 days per additional group app after the first (config, icons, metadata, signing, one review) |

## 8. Key risks

1. **App Review 4.2 / Play "merely a webview"**: mitigate with visible native
   features and an offline pack; keep the wrapper from looking like a site
   shortcut.
2. **Kids Category scope creep**: no third-party analytics/ads, parental gates,
   and Families SDK limits apply to the whole app, including shared packages.
   Decide audience before building.
3. **No service worker on iOS**: offline must be designed natively; content
   size (442 MB Nordic tree) forces a download-pack model with quotas.
4. **CDN/origin config**: absolute vs origin-relative asset paths, CORS, and
   non-cookie auth; forge-auth Google/Facebook/WeChat sign-in is currently
   unimplemented, so native OAuth is also blocked on that.
5. **IAP policy**: Stripe cannot unlock digital content on iOS; revenue share and
   product setup add work and lead time.
6. **Toolchain drift**: Capacitor 8.5 and Xcode 27 require UIScene adoption
   later; API 36 targeting on Android; keep Capacitor on the 8.x line and
   budget a half-day per quarterly bump.
7. **CI**: no confirmed macOS runner in forge-ci for iOS signing and builds.
8. **Multi-app fan-out**: 14 group repos each need their own bundle id and store
   listing unless a single multi-language app is chosen (a product decision that
   changes the size and Kids analysis above).

## 9. Not verified

* Tauri 2 mobile feature parity and plugin maintenance in 2026 (only 2024 posts
  and aggregator snippets found; 2.12 release content not read).
* iOS WKWebView service-worker behavior and Tauri mobile origins: from
  background knowledge, no 2026 source fetched.
* RevenueCat Capacitor SDK current status; FCM data-handling position under
  Families policy.
* Details in the last ~12k characters of Apple's guidelines page and the Apple
  "Upcoming Requirements" page; Play Data Safety specifics.
* Whether `lq-core` code resolves content URLs relative to origin or from a
  configured CDN base (not traced), and the linguaquest product's Capacitor
  setup (not inspected).
* Existence of a macOS CI runner on forge-git.

## Sources

* https://developer.apple.com/app-store/review/guidelines/ (fetched)
* https://support.google.com/googleplay/android-developer/answer/9893335 (fetched)
* https://developer.android.com/google/play/requirements/target-sdk (fetched)
* https://capacitorjs.com/docs/config (fetched)
* https://ionic.io/blog/announcing-capacitor-8, https://capacitorjs.com/docs/next/getting-started/environment-setup, https://capgo.app/blog/upgrade-capacitor-app-to-capacitor-8/ (search snippets)
* https://v2.tauri.app/start/ and https://v2.tauri.app/blog/ (fetched); https://v2.tauri.app/blog/tauri-2-0-0-release-candidate/ (snippet)
* Tauri community plugins: github.com/Choochmeque/tauri-plugin-iap, github.com/Choochmeque/tauri-plugin-notifications, github.com/yanqianglu/tauri-plugin-mobile-push (search snippets)
