# NordicQuest Kids: two-variant build plan (Kids vs standard)

*Written 2026-10-16. Plan only, no code changed. Builds on the native wrapper
decision in PR #71 (`docs/2026-10-16-native-wrapper-decision-tauri-vs-capacitor.md`,
Capacitor 8, still open when this was written). Facts are cited to what was read;
anything not verified is in section 9. Store-policy facts below are quoted from
PR #71, which fetched Apple's and Google's pages on 2026-10-16; this plan did not
re-fetch them.*

## 1. Summary

Ship two store listings from one codebase: **NordicQuest** (general audience,
the current product) and **NordicQuest Kids** (Apple Kids Category / Google Play
Families). They differ by build-time variant, not by fork: a `VARIANT=kids|standard`
flag selects the capability set (no third-party SDKs, parental gate, no social
login, curated lesson subset, child-safe copy), and the lesson subset is a
content manifest, not a copy of the lesson files.

PR #71 already says the Kids decision "moves the compliance phase from about 4
to 8 days" (22 to 26 person-days to first submission, one app). This plan splits
that into what the Kids variant adds on top of the standard build.

## 2. Goals and non-goals

**Goals**

1. A Kids build that satisfies the rules PR #71 quotes: Apple 1.3 / 5.1.4 (no
   third-party analytics or advertising, no PII or device info to third parties,
   parental gate in front of links out and purchases, privacy policy) and the
   Google Families policy (no unapproved SDKs/APIs, no AAID/IMEI/IMSI, no
   location, accurate target-audience declaration, data disclosure for SDKs).
2. One codebase and one content pipeline: the Kids variant selects lessons by
   manifest and strips capabilities at build time.
3. A parent keeps control: the existing household model (a child is a profile
   inside an adult's household, see section 4) is the account model for Kids.
4. Keep the standard app unchanged for users who are not children.

**Non-goals**

* A separate content tree, a separate repo, or a Kids-only lesson generator.
* A multi-language Kids app in the first slice (Danish first; see open question 3).
* Replacing the Capacitor decision. If #71 is not accepted, this plan needs a
  new section 5; the capability list in section 3 is wrapper-independent.
* Legal sign-off. The entity address and CVR in `lq-core/docs/legal/entity.json`
  are still placeholders (the legal pages carry a provisional notice), so a
  store submission cannot happen before they are real.

## 3. What differs between the variants

| Area | NordicQuest (standard) | NordicQuest Kids | Source / basis |
|---|---|---|---|
| Audience / store category | General audience | Apple Kids Category, Play Families | #71 section 4; 2.3.8: "For Kids" metadata is reserved for the Kids Category |
| Third-party analytics / ads | Allowed behind consent (the web build offers "Allow analytics" in its cookie notice) | **None.** No third-party analytics or ads; crash reporting without third-party SDKs | #71 sections 4, 7 (release row); Apple 1.3 / 5.1.4 |
| Social / OAuth login | forge-auth hosted sign-in; Google/Facebook/WeChat are stubs ("not yet wired") | **None.** Parent signs in once (email); children are profiles with no login | #71 section 3; privacy policy section 4 |
| Links out and purchases | Stripe checkout; external links | Behind a **parental gate**; on iOS premium unlocks use IAP, not Stripe (3.1.1) | #71 sections 3, 4 |
| Push notifications | Optional | Parent-controlled; APNs-direct preferred; FCM needs a data review | #71 section 3 (push row) |
| Microphone | Speaking practice | Off by default; parent opt-in with a stated purpose; `NSMicrophoneUsageDescription` / `RECORD_AUDIO` justification | #71 "Audio" |
| Lesson set | All chapters (20 Danish chapters in the authoring tree) | Curated subset, section 6 | `lq-nordic` PR #85 inventory |
| Copy and UI | Current | Short sentences, large targets (44 px minimum), no timers on checks | #85 sections 4.1, 5.3 |
| Cookie / consent UI | Cookie notice with Choose / Essential only / Allow analytics | **No analytics choice is offered** because there is no analytics; a plain notice of essential storage only | observed in the web build; see open question 4 |
| Bundle id, name, icons, listing | To be chosen | Own bundle id, name, screenshots, age rating | #71 phase "Release" |

## 4. What already exists to build on

* **A household and child-profile model.** The privacy policy (section 4,
  `lq-core/docs/legal/privacy-policy.md`) says accounts are for adults (18+),
  children use the app as a *profile* of a parent's household with only a display
  name, no email, password or login, and the policy does not ask a child's age.
  The adult sees everything the profile records and can delete it.
  Consequence: the Kids variant needs no child accounts, and GDPR Art. 8 is
  not triggered *as long as that stays true*. A Kids listing must not change it.
* **Age gate and consent work in lq-core** (recent PRs #165 install guide / legal
  pages / cookie consent / age gate, #179 to #183 essentials-kit adoption,
  consent migration). Their exact semantics for a *parental* gate (versus an age
  screen) were not inspected here; see section 9.
* **`isNativePlatform()` guard**: the only runtime Capacitor reference today
  (#71 section 2). It is the natural place to branch native-only behaviour, but a
  *variant* flag must be separate (a standard native build is not a Kids build).
* **Release gate**: `@learnquest/app-config/release` hides lessons by
  `releaseStage` / `aiDraft` (cited in `lq-nordic` PR #85 section 4.4). The Kids
  manifest should be an additional filter on top of it, never a bypass.
* **Persona audit** (`lq-core/screen-audit/learning`): has `thai-boy-8` and
  parent personas. Add a Kids persona set (section 7) rather than inventing a new
  harness.

## 5. Design

### 5.1 Variant mechanism

* Build-time `VITE_APP_VARIANT=kids|standard`, read once into a typed
  `appVariant` constant in `lq-core` (app-config), exposed through one
  `useCapabilities()` hook: `{ analytics, socialLogin, externalLinks,
  purchases, microphone, push }`. Features ask the hook, never the flag, so the
  list in section 3 lives in one table in code.
* Third-party packages that must not exist in the Kids bundle (analytics client,
  social-login stubs, anything that fetches a third-party host) are removed by
  **dynamic import behind the capability**, and the Kids CI job asserts they are
  absent from the built output (a grep over `dist/` for a denylist of hosts and
  package names). "Disabled at runtime" is not enough for Apple 1.3.
* A network-egress test: load the Kids build in Playwright and fail if any
  request goes to a host outside an allow-list (own origin, the R2 content CDN,
  forge-auth, platform API). This is the check a reviewer cannot argue with.

### 5.2 Parental gate

* A gate component in `lq-core` (not in nordic): a short adult-only challenge
  (for example a multi-step task a young child cannot do by accident, not a
  fixed answer), required before: external links, the paywall / purchase flow,
  account settings and household management, notifications, microphone opt-in.
* It is not parental *consent* (Apple 5.1.4 says the two are "generally not the
  same"); consent for anything that collects data stays with the parent through
  the existing consent flow.
* Accessibility: the gate must work with screen readers; a non-visual challenge
  variant is needed.

### 5.3 Curated lesson subset

* A `kids.manifest.json` in `lq-nordic` listing lesson ids per chapter (with a
  schema and validator), applied as a filter in the chapter/map loader when
  `appVariant === 'kids'`. No lesson file is copied.
* Selection criteria (to be confirmed, open question 2): child-safe topics
  only; types with a scored check (concept 2.0, multiple-choice, spelling,
  sound-pattern, vocab with checks); no free-text dialogue with adult themes;
  audio coverage (vocab has audio on 96% of items, `lq-nordic` #85 section 2);
  reading load fit for a 7 to 12 reader whose first language may be Thai/Chinese
  (the persona audit's `thai-boy-8`).
* Dependencies on the exercise-layer plan (`2026-10-16-lesson-type-exercise-layer-plan.md`):
  Kids needs lessons that *prove* learning before reward; concept lessons
  without checks, culture, and review lessons that only read are poor Kids
  content. Kids should not launch on lesson types still at "Proof before reward: No".

### 5.4 Data, privacy and listing

* A Kids privacy policy section (Apple requires a privacy policy for Kids
  Category apps, per #71) generated from `lq-core/docs/legal/` with the
  existing `build-legal-pages.ts`, plus a data inventory feeding Apple privacy
  labels and the Play Data Safety form.
* Crash reporting: first-party only (no third-party SDK) in Kids mode. The
  existing `@learnquest/error-tracker` was not inspected for its transport; check
  it before claiming this (section 9).
* Store metadata: do not use "For Kids" wording in the standard listing (2.3.8).

## 6. Stages

| Stage | Scope | Repos | Exit criteria | Days (estimate) |
|---|---|---|---|---|
| 0. Decide | Answer open questions 1 to 3; get the real controller address and CVR; accept or reject #71 | owner | Written decisions recorded in this doc; entity.json real | 0.5 (owner time) |
| 1. Variant plumbing | `appVariant`, `useCapabilities`, build flag, capability table, CI job building both variants | lq-core, lq-nordic | Both variants build in CI; capability table has tests; standard build unchanged (same output hash apart from the flag) | 3 |
| 2. Strip third parties | Dynamic-import analytics/social/other clients behind capabilities; Kids bundle denylist check; egress allow-list test | lq-core, lq-nordic | Denylist and egress tests green on the Kids build; failing one on purpose is caught | 3 |
| 3. Parental gate | Gate component, wire to link-outs, paywall, settings, push, mic; a11y variant | lq-core | Every gated action unreachable without passing; screen-reader pass; unit and e2e tests | 3 |
| 4. Curated subset | Manifest + validator + loader filter; chapters 1 to 5 selection reviewed by the owner | lq-nordic | Kids map shows only manifest lessons; validator fails on ids that don't exist or are unreleased | 2 |
| 5. Kids persona audit | Kids personas (7 to 9, 10 to 12; phone and iPad) in the scorecard; baseline for Kids | lq-core, lq-nordic | Scorecard run on the Kids build with no `primary-action-covered` or dead ends; scores recorded as the Kids baseline | 2 |
| 6. Compliance and listing | Kids privacy section, data inventory, store forms, bundle ids, screenshots, age rating, IAP products | lq-core, owner | Checklist signed by the owner; TestFlight / Play closed test pass | 4 to 6 (inside #71's 26-day estimate) |

Stages 1 to 5 are about 13 person-days of new work specific to the two-variant
approach. #71 budgets 8 days for compliance if the app is Kids Category (against
4 otherwise), and stage 6 here falls inside that budget; how much of stages 1 to 3
(parental gate, third-party removal) overlaps #71's 8 days was **not reconciled**.
Treat 13 days as additive to the wrapper's 22 days until the owner confirms.
These are estimates built on #71's, not independent measurements.

## 7. Risks

1. **Policy drift between the privacy policy and the build.** The policy (section
   "No analytics or tracking") and the web cookie notice ("Allow analytics")
   must be reconciled before a Kids submission; Kids claims must be provable by
   the egress test, not by the policy text.
2. **Apple 4.2 / Play "merely a webview"** applies to the Kids app too and is
   harder to dodge with a small lesson subset (#71 risk 1). Native value (offline
   pack, parent-controlled reminders, audio) must be visible in the Kids build.
3. **FCM / Firebase** on Android push may conflict with Families data rules (#71);
   without push in v1 this risk is removed.
4. **Shared packages**: the Kids rules apply to the whole app, including shared
   packages (#71 risk 2); a dependency that phones home breaks the build's claim.
   Mitigated by the denylist and egress tests.
5. **Content quality**: Kids exposes weaker lesson types first; a Kids launch on
   the current concept/review/culture lessons would be "no proof before reward"
   for a child audience. Depends on the exercise-layer plan.
6. **Two listings, double review cycles.** #71 budgets 2 rejections per
   submission; Kids may need more.
7. **Misdeclaring the audience** (either direction) risks rejection or removal
   (#71 section 4).

## 8. Open questions for the owner

1. **Is NordicQuest Kids a real product, and is the standard app *not* in the
   Kids Category?** (#71 asks the same question for one app; this plan assumes
   two listings. The cheaper alternative in #71 is a single teen/adult app
   without Kids Category.)
2. **Who selects the Kids lessons, and on what rule?** Proposed: child-safe
   topics, lessons with scored checks, audio coverage, reading load; chapters 1
   to 5 first.
3. **Languages for Kids v1:** Danish only, or all four Nordic languages? #71 risk
   8 notes each group app needs its own bundle id and listing.
4. **Cookie/consent UI in Kids:** drop the analytics choice entirely (this plan),
   or keep a first-party-only usage setting for the parent?
5. **Social login:** none in Kids (this plan). Confirm this also holds for the
   parent account (email only).
6. **Microphone / push in v1:** off in Kids v1 (simplest) or parent opt-in?
7. **Premium model in Kids:** is any content paid? Apple 3.1.1 requires IAP;
   Stripe cannot be used for digital goods inside iOS (#71).
8. **Publisher account type** (personal vs organisation) decides the Play
   closed-testing requirements (#71 section 4, unverified there).

## 9. Not verified

* Apple/Google policy text above is as quoted in PR #71; not re-fetched.
* Whether the existing lq-core age gate (#165) and consent code (#179 to #183)
  can be reused as the parental gate; their behaviour was not inspected.
* `@learnquest/error-tracker` transport and any third-party hosts in the
  current nordic bundle (no egress capture was run for this plan).
* Whether `lq-nordic` has an analytics client today. The web build offers
  "Allow analytics" in its cookie notice, but what it sends and to whom was not
  traced.
* Whether the household/child-profile model is exposed in the Nordic app UI as
  described in the privacy policy (only the policy text was read).
* Effort figures are estimates built on #71's, not independent measurements.

## Sources

* `docs/2026-10-16-native-wrapper-decision-tauri-vs-capacitor.md` (branch
  `docs/native-wrapper-decision`, PR #71)
* `lq-core/docs/legal/privacy-policy.md` sections 4 and "No analytics or tracking";
  `lq-core/docs/legal/terms-of-service.md` (child profiles belong to the household)
* `lq-nordic/docs/design/2026-10-lesson-type-playability-review.md` (PR #85)
* Observed behaviour of the Nordic web build on 2026-10-16 (cookie notice text)
