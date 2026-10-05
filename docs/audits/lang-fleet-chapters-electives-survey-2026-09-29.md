# Lang fleet: chapters and electives survey (2026-09-29)

**Scope:** a read-only survey of the 14 `lq-*` lang family repos at `origin/main`, fetched 2026-09-29, plus lq-tools `2e4cbbd` and lq-core `33a4e769`. Nothing was changed.

**Purpose:** planning input for two campaigns:
- **(a) Core depth:** every language to at least 15 core chapters, and the mature ones to 20.
- **(b) Interest electives:** add electives to every chapter at about 20–30% of the chapter.

**Specs:**
- [`INTEREST_ELECTIVES_SPEC_2026_09_28.md`](../INTEREST_ELECTIVES_SPEC_2026_09_28.md)
- [`CHAPTER_EXPANSION_20_PLAN_2026_09_28.md`](../CHAPTER_EXPANSION_20_PLAN_2026_09_28.md)
- [`lang-fleet-where-we-left-off-2026-09-28.md`](./lang-fleet-where-we-left-off-2026-09-28.md). Its "skeleton, 8 source chapters" picture is **stale**: the 09-28 gap-fill wave brought every family to 15 source chapters, with source matching public.

## TL;DR

- **Fleet shape:**
  - 69 language rows: 68 active, plus Welsh English in lq-english, which is retired.
  - **63 languages sit at exactly 15 source = 15 public chapters.**
  - Danish is at 20.
  - Burmese and Lao are at 10.
  - Cantonese and Chinese (lq-east-asian) are disabled and unpublished, and have gaps: 89/213 and 120/174 lesson files against chapter refs.
- **Chapters are smaller than the spec assumes.**
  - The fleet average is **11.5 core lessons per chapter**, running from 18 in ch1 down to 8 in ch12–15. The spec assumed 15–17.
  - The electives quota `max(2, round(0.3 × core))` therefore works out to **about 3 per chapter** (≈51 slots per 15-chapter language), not 5.
  - Exceptions: Thai averages 21.7 per chapter, and Danish ch1 has 34 core lessons, which gives **quota 10**. See blocker B6.
- **Electives exist only in Danish:**
  - 20 `elective` groups, a 237-lesson pool, 237 `elective-*` files, all carrying `facets.interests`.
  - The shape is 6 interests × 2 per chapter, with no `quota` set.
  - Every other language has zero.
- **The engine is done:**
  - E0, E1 (#105) and E2 (#108) are all merged in lq-core.
  - **@learnquest/web-app 0.5.7** is the first version with the electives map branch; 0.5.8 is current.
  - 13 of 14 repos are already on `^0.5.8`. **lq-slavic is on `^0.3.10`**, and slavic#41 is open to fix that.
- **The biggest hidden blocker is the publish step.**
  - Only lq-nordic's `scripts/generate-lesson-files.ts` publishes elective groups and their pool lessons (lq-nordic `b5ba3eb4`).
  - The other 13 repos drop `chapter.groups`, so electives authored there **would never reach the app**.
- **The tooling exists and is reusable.** lq-tools `packages/app-generators/src/extend-chapters.ts` covers:
  - chapter extension (G1 and G2 merged);
  - `--fill-existing` and `--fill-missing`;
  - `--electives` facet mode (E3). The Danish pilot used this mode; it was not ad hoc.
- **Volume:**
  - (a) needs **≈1,070 new core lessons** for "≥15 everywhere + 17 mature languages to 20". That is on top of 1,120 already generated in open PRs.
  - (b) needs **≈13,900 elective lessons** fleet-wide at the pilot shape of 12 per chapter.
  - Text is nearly free (about $0.001 per lesson, or $0 marginal on MiniMax-M3).
  - Images at 1–2 per lesson would add ≈$0.47–0.93k.
  - **Review is the real cost.**

## 1. Per-language matrix (origin/main, en source)

**Column definitions:**
- **Core refs:** entries in `languages/<lang>/data/en/chapters.json` → `chapters[].lessons` (the main path).
- **Files:** source lesson files under `languages/<lang>/data/en/lessons/chapter-N/*.json`. `chapter-N-bundle.json`, `index.json` and `chapters.json` are not counted.
- **Pub:** `public/data/lessons/en/<lang>/chapters/chapters.json` chapter count, with the number of published lesson files in brackets.
- **Beta:** en lesson files stamped `releaseStage: "beta"` (AI draft, unreviewed). Only romance has any `reviewedBy` stamps: fr 18, it 10, pt 5, ro 34, es 7.
- **shipChapters:** from `languages/<lang>/data/locale-manifest.json`. Only lq-english and lq-romance set it. Elsewhere it is absent, which means no cap.

**Layout:**
- All 14 repos use the same map-form source layout, `languages/<lang>/data/en/lessons/chapter-N/<id>.json`, which is published to `public/data/lessons/en/<lang>/chapters/chapter-N/`.
- Most languages also carry a legacy `languages/<lang>/data/en/lessons.json` id map and a `content/<lang>/chapters.json`. Both are ignored here.

| Family | Language | Src ch | Core refs / files | Pub ch (files) | Avg core/ch (min–max) | shipChapters | en flag / maturity | Beta (aiDraft) | Elective groups / pool / `elective-*` files / `facets.interests` | web-app | Open PR |
|---|---|---:|---:|---|---|---|---|---:|---|---|---|
| nordic | danish | 20 | 283 / 283 | 20 (520) | 14.2 (8–34) | — | on / production | 55 core + 237 electives | 20 / 237 / 237 / 237 | ^0.5.8 | — |
| nordic | icelandic | 15 | 173 / 173 | 15 (173) | 11.5 (8–18) | — | on / production | 0 | — | ^0.5.8 | #59 → 20 ch (+50) |
| nordic | norwegian | 15 | 173 / 173 | 15 (173) | 11.5 (8–18) | — | on / production | 0 | — | ^0.5.8 | #60 → 20 ch (+50) |
| nordic | swedish | 15 | 173 / 173 | 15 (173) | 11.5 (8–18) | — | on / production | 0 | — | ^0.5.8 | #61 → 20 ch (+50) |
| english | american | 15 | 177 / 177 | 15 (177) | 11.8 (8–19) | 15 | on / production | 0 | — | ^0.5.8 | #41 → 20 ch (+50) |
| english | australian | 15 | 171 / 171 | 15 (171) | 11.4 (8–18) | 15 | on / production | 51 | — | ^0.5.8 | — |
| english | british | 15 | 171 / 171 | 15 (171) | 11.4 (8–18) | 15 | on / production | 51 | — | ^0.5.8 | — |
| english | scottish | 15 | 171 / 171 | 15 (171) | 11.4 (8–18) | 15 | on / production | 51 | — | ^0.5.8 | — |
| english | welsh (Welsh English) | 15 | 171 / 86 | — (not published) | 11.4 (8–18) | 5 | off / retired | 0 | — | ^0.5.8 | — |
| east-asian | cantonese | 15 | 213 / 89 | — (not published) | 14.2 (8–26) | — | off / production | 0 | — | ^0.5.8 | #41 → 20 ch, 174 files / 259 refs |
| east-asian | chinese | 15 | 174 / 120 | — (not published) | 11.6 (8–18) | — | off / production | 0 | — | ^0.5.8 | #41 → 20 ch, 175 files / 224 refs |
| east-asian | japanese | 15 | 177 / 177 | 15 (177) | 11.8 (8–19) | — | on / production | 11 | — | ^0.5.8 | #41 → 20 ch (+50) |
| east-asian | korean | 15 | 177 / 177 | 15 (177) | 11.8 (8–19) | — | on / production | 4 | — | ^0.5.8 | #41 → 20 ch (+50) |
| southeast-asian | burmese | 10 | 168 / 167 | 10 (168) | 16.8 (12–20) | — | on / production | 61 | — | ^0.5.8 | — |
| southeast-asian | indonesian | 15 | 174 / 174 | 15 (174) | 11.6 (8–18) | — | on / production | 68 | — | ^0.5.8 | #45 → 20 ch (+50) |
| southeast-asian | khmer | 15 | 187 / 187 | 15 (187) | 12.5 (8–18) | — | on / production | 83 | — | ^0.5.8 | #45 → 20 ch (+50) |
| southeast-asian | lao | 10 | 166 / 166 | 10 (166) | 16.6 (12–21) | — | on / production | 61 | — | ^0.5.8 | — |
| southeast-asian | malay | 15 | 173 / 173 | 15 (173) | 11.5 (8–18) | — | on / production | 56 | — | ^0.5.8 | #45 → 20 ch (+50) |
| southeast-asian | tagalog | 15 | 173 / 173 | 15 (173) | 11.5 (8–18) | — | on / production | 56 | — | ^0.5.8 | #45 → 20 ch (+50) |
| southeast-asian | thai | 15 | 325 / 337 | 15 (325) | 21.7 (11–40) | — | on / production | 37 | — | ^0.5.8 | #45 → 20 ch (+50) |
| southeast-asian | vietnamese | 15 | 174 / 172 | 15 (174) | 11.6 (8–18) | — | on / production | 32 | — | ^0.5.8 | #45 → 20 ch (+50) |
| romance | french | 15 | 173 / 173 | 15 (173) | 11.5 (8–18) | 15 | on / production | 35 | — | ^0.5.8 | — |
| romance | italian | 15 | 173 / 173 | 15 (173) | 11.5 (8–18) | 15 | on / production | 29 | — | ^0.5.8 | — |
| romance | portuguese | 15 | 173 / 173 | 15 (173) | 11.5 (8–18) | 15 | on / production | 25 | — | ^0.5.8 | — |
| romance | romanian | 15 | 173 / 173 | 15 (173) | 11.5 (8–18) | 15 | on / production | 33 | — | ^0.5.8 | — |
| romance | spanish | 15 | 173 / 173 | 15 (173) | 11.5 (8–18) | 15 | on / production | 24 | — | ^0.5.8 | — |
| germanic | dutch | 15 | 174 / 174 | 15 (174) | 11.6 (8–18) | — | on / production | 76 | — | ^0.5.8 | — |
| germanic | flemish | 15 | 174 / 174 | 15 (174) | 11.6 (8–18) | — | on / production | 75 | — | ^0.5.8 | — |
| germanic | german | 15 | 175 / 175 | 15 (175) | 11.7 (8–18) | — | on / production | 76 | — | ^0.5.8 | — |
| germanic | swiss | 15 | 175 / 175 | 15 (175) | 11.7 (8–18) | — | on / production | 76 | — | ^0.5.8 | — |
| slavic | belarusian | 15 | 173 / 173 | 15 (173) | 11.5 (8–18) | — | on / production | 51 | — | ^0.3.10 | #41 deps only |
| slavic | russian | 15 | 174 / 174 | 15 (174) | 11.6 (8–19) | — | on / production | 25 | — | ^0.3.10 | #41 deps only |
| slavic | ukrainian | 15 | 174 / 174 | 15 (174) | 11.6 (8–19) | — | on / production | 52 | — | ^0.3.10 | #41 deps only |
| african | afrikaans | 15 | 174 / 174 | 15 (174) | 11.6 (8–18) | — | on / production | 81 | — | ^0.5.8 | — |
| african | amharic | 15 | 174 / 174 | 15 (174) | 11.6 (8–18) | — | on / production | 83 | — | ^0.5.8 | — |
| african | hausa | 15 | 173 / 173 | 15 (173) | 11.5 (8–18) | — | on / production | 71 | — | ^0.5.8 | — |
| african | swahili | 15 | 174 / 174 | 15 (174) | 11.6 (8–18) | — | on / production | 77 | — | ^0.5.8 | — |
| african | yoruba | 15 | 173 / 173 | 15 (173) | 11.5 (8–18) | — | on / production | 68 | — | ^0.5.8 | — |
| african | zulu | 15 | 173 / 173 | 15 (173) | 11.5 (8–18) | — | on / production | 72 | — | ^0.5.8 | — |
| balkan | albanian | 15 | 171 / 171 | 15 (171) | 11.4 (8–18) | — | on / production | 64 | — | ^0.5.8 | — |
| balkan | bosnian | 15 | 171 / 171 | 15 (171) | 11.4 (8–18) | — | on / production | 63 | — | ^0.5.8 | — |
| balkan | bulgarian | 15 | 171 / 171 | 15 (171) | 11.4 (8–18) | — | on / production | 67 | — | ^0.5.8 | — |
| balkan | croatian | 15 | 171 / 171 | 15 (171) | 11.4 (8–18) | — | on / production | 64 | — | ^0.5.8 | — |
| balkan | greek | 15 | 172 / 172 | 15 (172) | 11.5 (8–19) | — | on / production | 93 | — | ^0.5.8 | — |
| balkan | macedonian | 15 | 171 / 171 | 15 (171) | 11.4 (8–18) | — | on / production | 64 | — | ^0.5.8 | — |
| balkan | romanian | 15 | 171 / 171 | 15 (171) | 11.4 (8–18) | — | on / production | 65 | — | ^0.5.8 | — |
| balkan | serbian | 15 | 172 / 172 | 15 (172) | 11.5 (8–19) | — | on / production | 64 | — | ^0.5.8 | — |
| balkan | slovenian | 15 | 171 / 171 | 15 (171) | 11.4 (8–18) | — | on / production | 64 | — | ^0.5.8 | — |
| celtic | breton | 15 | 202 / 200 | 15 (200) | 13.5 (8–20) | — | on / beta | 91 | — | ^0.5.8 | — |
| celtic | irish | 15 | 171 / 171 | 15 (171) | 11.4 (8–18) | — | on / production | 65 | — | ^0.5.8 | — |
| celtic | scottish-gaelic | 15 | 171 / 171 | 15 (171) | 11.4 (8–18) | — | on / production | 65 | — | ^0.5.8 | — |
| celtic | welsh | 15 | 171 / 171 | 15 (171) | 11.4 (8–18) | — | on / production | 63 | — | ^0.5.8 | — |
| middle-eastern | arabic | 15 | 175 / 175 | 15 (175) | 11.7 (8–19) | — | on / production | 64 | — | ^0.5.8 | — |
| middle-eastern | hebrew | 15 | 175 / 175 | 15 (175) | 11.7 (8–19) | — | on / production | 70 | — | ^0.5.8 | — |
| middle-eastern | persian | 15 | 174 / 174 | 15 (174) | 11.6 (8–18) | — | on / production | 67 | — | ^0.5.8 | — |
| middle-eastern | turkish | 15 | 174 / 174 | 15 (174) | 11.6 (8–18) | — | on / production | 64 | — | ^0.5.8 | — |
| south-asian | bengali | 15 | 174 / 174 | 15 (174) | 11.6 (8–18) | — | on / production | 72 | — | ^0.5.8 | — |
| south-asian | hindi | 15 | 175 / 175 | 15 (175) | 11.7 (8–19) | — | on / production | 70 | — | ^0.5.8 | — |
| south-asian | marathi | 15 | 173 / 173 | 15 (173) | 11.5 (8–18) | — | on / production | 69 | — | ^0.5.8 | — |
| south-asian | punjabi | 15 | 173 / 173 | 15 (173) | 11.5 (8–18) | — | on / production | 72 | — | ^0.5.8 | — |
| south-asian | tamil | 15 | 174 / 174 | 15 (174) | 11.6 (8–18) | — | on / production | 73 | — | ^0.5.8 | — |
| south-asian | telugu | 15 | 173 / 173 | 15 (173) | 11.5 (8–18) | — | on / production | 71 | — | ^0.5.8 | — |
| south-asian | urdu | 15 | 174 / 174 | 15 (174) | 11.6 (8–18) | — | on / production | 72 | — | ^0.5.8 | — |
| uralic | estonian | 15 | 171 / 171 | 15 (171) | 11.4 (8–18) | — | on / production | 67 | — | ^0.5.8 | — |
| uralic | finnish | 15 | 171 / 171 | 15 (171) | 11.4 (8–18) | — | on / production | 67 | — | ^0.5.8 | — |
| uralic | hungarian | 15 | 171 / 171 | 15 (171) | 11.4 (8–18) | — | on / production | 67 | — | ^0.5.8 | — |
| west-slavic | czech | 15 | 171 / 171 | 15 (171) | 11.4 (8–18) | — | on / production | 64 | — | ^0.5.8 | — |
| west-slavic | polish | 15 | 171 / 171 | 15 (171) | 11.4 (8–18) | — | on / production | 67 | — | ^0.5.8 | — |
| west-slavic | slovak | 15 | 171 / 171 | 15 (171) | 11.4 (8–18) | — | on / production | 65 | — | ^0.5.8 | — |

69 rows; total core refs 12265 files 12009

**Notes:**
- **Welsh (lq-english)** is "Welsh English". It is retired: en off, not published, 86 of 171 files present, shipChapters 5. **Skip it.** Cymraeg lives in lq-celtic.
- **Romanian exists twice:** lq-romance (published, shipChapters 15) and lq-balkan. **Decided 2026-09-29: lq-romance is canonical for Romanian.** Do not generate Balkan Romanian electives (or ch16–20); lq-balkan's Romanian gets no new content.
- **Breton** is `beta` maturity, and its manifest `coverage.chapters` still reads 5.
- **Cantonese and Chinese** are en-disabled (§C flags) and have no public tree.
- **Thai** is double-density (325 core lessons) and gets ≈100 elective slots.
- **Burmese and Lao** have 10 chapters, but dense ones (≈16.7 per chapter).

## 2. Open PRs (forge-git, `tea pr ls --state open`, 2026-09-29)

| Repo | PR | Branch | What | Touches |
|---|---|---|---|---|
| lq-nordic | #59 | feat/icelandic-ch16-20 | icelandic ch16–20: 50 lessons, bosses, achievements | `languages/icelandic/data/en/lessons/chapter-16..20`, chapters.json (adds 5 **empty** elective groups), bosses, achievements, locale-manifest |
| lq-nordic | #60 | feat/norwegian-ch16-20 | norwegian ch16–20 | same shape |
| lq-nordic | #61 | feat/swedish-ch16-20 | swedish ch16–20 | same shape |
| lq-english | #41 | feat/american-ch16-20 | american ch16–20 | same shape. **shipChapters stays 15**, so ch16–20 will not publish until it is raised (B4) |
| lq-east-asian | #41 | feat/ea-ch10-20 | cantonese/chinese/japanese/korean to ch10–20: 368 lessons, 20 bosses, plus MiniMax+GLM AI-review stamps (68 + Tier 2/3) | 4 × chapters.json with 11 empty elective groups each. After merge, cantonese has 174 files for 259 refs and chinese 175 for 224. |
| lq-southeast-asian | #45 | feat/sea-ch10-20 | id/km/ms/tl/th/vi to ch10–20: 552 lessons, 30 bosses, plus review stamps (186 + 79) | Burmese and Lao are **not** included. |
| lq-slavic | #41 | chore/fleet-upgrade-2026-09-28 | web-app 0.3.10 → current runtime (electives prerequisite) | package.json, lockfile, workspace, src |

**Race guidance for executors:**
- On the 10 languages in those PRs, do **not** touch `chapters.json`, `bosses.json`, `achievements.json` or `locale-manifest.json` until the PRs merge.
- On public trees in lq-nordic, lq-english, lq-east-asian and lq-southeast-asian, run the publish (`generate-lesson-files.ts`) only after merge. The PR branches still publish 15 chapters.

**Placeholder purges** are already merged 09-29 and have no open PRs:
- lq-english #47 (42 lessons)
- lq-germanic #48 (59)
- lq-african #43 (59)
- lq-balkan #42 (croatian/de locale `--fill` pilot)
- `docs/audits/placeholder-lessons-2026-09-28.json` (untracked in learn-quest) lists the fleet set. Any remaining purge work races with electives only if it rewrites `chapters.json`.

## 3. Tooling state

### 3.1 Chapter extension: `lq-tools/packages/app-generators/src/extend-chapters.ts`

There is no pnpm script entry. Run it from `packages/app-generators`:

```bash
# extend core chapters (appends to chapters.json; never touches existing chapters without --force)
npx tsx src/extend-chapters.ts --app=/Volumes/SSD/Projects/Repos/lq-<family> --lang=<lang> \
  --chapters=16-20 [--lang-config=<id>] [--provider=minimax|glm|gemini] [--model=<id>] \
  [--budget=3.0] [--include-tier3] [--dry-run] [--allow-dirty] [--confirm-over-200]

# fill placeholders / missing files in existing chapters
npx tsx src/extend-chapters.ts --app=… --lang=<lang> --fill-existing [--targets=<json>] [--chapters=1-15]
npx tsx src/extend-chapters.ts --app=… --lang=<lang> --fill-missing   [--chapters=…]
```

**Modes and flags:**
- **Extend (default):** writes ch16–20 lessons, `bosses.json`, `achievements.json`, `boss-fight.yaml`, terrain themes and locale-manifest coverage. It also writes an **empty** `chN-electives` group per new chapter.
- `--fill-existing` regenerates lessons titled "TODO", empty lessons and lessons with placeholder text.
- `--fill-missing` drafts only lesson files that are missing and never overwrites.
- **Mutually exclusive modes:** `--fill-existing`, `--fill-missing` and `--electives`.
- **Default provider:** `minimax` (MiniMax-M3, flat-rate, with a per-call fallback to glm-5.3-flash; `--no-fallback` disables it).
- `--provider=gemini` uses gemini-2.5-flash-lite unless `--model` is given.
- `--dry-run` prints diffs and makes no AI calls.
- Real runs write `data/en` only.
- A real run over 200 lessons exits 2 unless `--confirm-over-200` is passed. Per memory, the operator approves anything over 200 items or over $10 per 6 hours.

**G-plan status** (plan § Pipeline):

| Item | Status |
|---|---|
| G1: 20-chapter curriculum, output re-pointed to `languages/<lang>/data/<locale>/`, merge into existing chapters.json, `--dry-run` diff, elective group stubs | merged, `d00dff5` (PR #31) |
| G2: bosses, achievements, boss-fight.yaml and terrain for new chapters; `--fill-missing`; audio-tools `endCh` read from chapters.json (`generate-audio-cli.ts` `chapterCountFromManifest`); app-audit, content-audit and cost-estimate 15s lifted | merged, `18dc239` |
| `--fill-existing` fixes | `fb1e42d`, `827622f`, `6e98da1` |
| **G3 assets** (images and audio for ch16–20) | **no commits.** Boss portraits exist only in the ea and sea PRs. |

`STATUS_2026_09_29.md` §W7 still lists G2/G3 as "next". G2 is done, so that section is stale.

### 3.2 Language configs (`packages/app-generators/src/languages/*.json`)

- There are 67 configs plus `_template`, and **every fleet language has one**.
- Aliases: scottish → `scottish-english` and Welsh English → `welsh-english`, both via `--lang-config`.
- **Only `danish.json` and `swiss.json` have `chapterThemes`, `cultureTopics` and `bossTheme` for 16–20.** The other 65 stop at 15.
- For the missing chapters, `extend/plan.ts:184` warns and falls back to `themes.visual[0]`.
- The open nordic ×3, american, ea and sea PRs were therefore generated with fallback visuals, and their 16–20 configs are **not** on lq-tools main.
- Adding per-language 16–20 configs is a cheap pre-step (5 themes, 5 bosses and 5 culture topics per language) that improves quality.

### 3.3 Danish electives pilot (lq-nordic `5cc2195a`, "lq-nordic#63", 237 lessons)

- **Generated by the reusable facet mode** (E3), lq-tools `5369c52` "real dialogue writer + electives E3 facet mode" in `packages/app-generators/src/extend/electives.ts`, which has tests. It was not ad hoc. The command, reconstructed from the commit message and the script header:
  ```bash
  npx tsx src/extend-chapters.ts --app=/…/lq-nordic --lang=danish --electives \
    --interests=sport,music,business,travel,tech,food --per-interest=2 --chapters=1-20 \
    --confirm-over-200 --provider=gemini --model=gemini-3.5-flash-lite
  ```
- **Cost:** ≈$0.24 for 237 lessons (≈$0.001 per lesson). 3 of 240 failed validation and were not stubbed. The lessons were then released as beta via `mark-release` (lq-tools `11c449e`).
- **Behaviour of the mode:**
  - Lesson types rotate conversation / vocab / culture.
  - Ids follow `elective-<interest>-ch<N>-<subtopic>`, with `facets.interests: [<id>]`.
  - Vocabulary is restricted to chapters ≤ N plus the topic.
  - Interest ids are validated against a copy of the taxonomy v1.
- **Shape:** 6 categories × 2 lessons = a **pool of 12 per chapter**. Ch3, ch18 and ch20 have 11 each because of the validation failures.
- **Group example** (the generator omits `quota` on purpose, so the runtime rule applies):
  ```json
  { "id": "ch3-electives", "name": "Electives", "type": "elective", "branchPosition": 11,
    "lessons": ["elective-sport-ch3-cycling-race", "elective-sport-ch3-swimming", "elective-music-ch3-streaming-playlists", "…11 ids"] }
  ```
- **Publish:** `b0496144` carries `facets`, `aiDraft` and `releaseStage` into the public lesson tree, and **all 14 repos have an equivalent**. `b5ba3eb4` publishes elective groups and emits pool-lesson files, and **only lq-nordic has it**.

## 4. lq-core engine state

| Phase | State | Ref |
|---|---|---|
| E0: injected learner-preferences source | merged | `2213f377` (web-app 0.5.5, database 0.1.3) |
| E1: taxonomy v1 (15 ids + alias table, `normalizeInterests`), `Lesson.facets.interests` (TS types; no JSON-schema facet), `LessonGroup.type: 'elective'` + `quota`, `selectElectives` | merged, **#105** | `cc8977ee`, in `libs/app/config/src/electives/` (import path `@learnquest/app-config/electives`) |
| E2: map elective branch (`libs/lang/game-features/.../ElectiveSelectionService.ts`, MapLayoutService), materialised picks, taxonomy picker in Settings | merged, **#108** | `51069f08`; version bump fixed in `b56f1da3` |

**Versions:**
- **First web-app with E1 and E2: 0.5.7.** It was published in `publish/batch-2026-09-28-1790607204578`.
- The current version is 0.5.8, which adds #109 (hide empty lessons).
- Minimum companions: app-config 0.1.7, types 0.1.2, game-state 0.1.9, game-features 0.2.13 and screen-profile 0.2.8. lq-nordic also pins these through `pnpm-workspace.yaml` overrides to avoid duplicate singletons.
- 13 of 14 repos already carry `^0.5.8` with these overrides (fleet upgrade 09-28). The exception is lq-slavic (#41 open).
- Deploy state was not verified here. package.json is not the same as what is live.

**Gaps:**
- **Onboarding still starts with `interests: []`** (`libs/screens/onboarding/src/lib/useApp.ts:101`). Interests can only be set in Settings, so learners who never open Settings see no electives. The spec's E2 onboarding step is not done.
- The quota uses **core = the chapter's lessons outside every group**.
- `STATUS_2026_09_29.md` §W9 says E1 was "not seen merged". That is stale; it merged as #105.
- No lq-core PRs about electives are open (the open ones are #81 and #69).

## 5. Volume and cost estimate

**Unit costs:**
- **Text:** about $0.001 per lesson on flash-lite (pilot: $0.24 / 237), or $0 marginal on MiniMax-M3 (the extend-chapters default, subject to the plan's throughput cap).
- **AI review:** MiniMax + GLM two-model review is about $0.007 per lesson (the 09-28 run cost ≈$2 for 277).
- **Images:** 1–2 per lesson × $0.0335 (Gemini batch) = $0.034–0.067 per lesson. They could instead be deferred to the lazy-asset pipeline, which generates on demand.
- **Audio:** edge-tts, $0.

### (a) Core chapters

| Step | Languages | Lessons | Text | Review | Images (1–2 each) |
|---|---|---:|---:|---:|---:|
| A0: already generated, in open PRs (merge and review only) | is, no, sv, american, yue, zh, ja, ko, id, km, ms, tl, th, vi | 1,120 | done | ≈$8 | $38–75 |
| A1: Burmese and Lao ch11–15 (standard 10/8/8/8/8 template) | my, lo | ≈84 | ≈$0.1 | ≈$0.6 | $3–6 |
| A2: Cantonese and Chinese gap fill after ea#41 (`--fill-missing`) | yue, zh | ≈134 | ≈$0.1 | ≈$1 | $5–9 |
| A3: mature languages → 20 (+50 each) | fr, it, pt, ro, es, de, nl, nl-BE, gsw, en-AU/GB/SCO, ru, uk, be, my, lo | 17 × 50 = 850 | ≈$0.9 | ≈$6 | $28–57 |
| **Required subtotal (A1–A3)** | | **≈1,070** | ≈$1 | ≈$8 | $36–72 |
| A4 (optional, hold): long tail → 20 | balkan 9, african 6, celtic 4, middle-eastern 4, south-asian 7, uralic 3, west-slavic 3 | 36 × 50 = 1,800 | ≈$2 | ≈$13 | $60–120 |

Each new chapter also gets 1 boss plus portrait and achievements. The generator creates these, but the portraits are a G3 or manual step.

### (b) Electives at about 30% per chapter

**Quota versus pool:**
- The **quota** is what one learner sees: `max(2, round(0.3 × core))`.
- With real chapter sizes that is ≈3.4 per chapter on ch1–15 (5 on ch1, 2 on ch12–15), 3 on each of ch16–20 (10 core), ≈51 per 15-chapter language and ≈66 per 20-chapter language.
- The **pool** must be larger than the quota so that each learner's interests can be served.
- 2 per category is the right depth: a quota of 3–5 with 3 interests allocates 2/2/1. With a single interest the learner is capped at 2, which is acceptable.
- Breadth (the number of categories) is the real lever:

| Pool shape | Per chapter | Per 15-ch language | Per 20-ch language | Fleet (32 languages at 20 ch − Danish, 36 at 15 ch) |
|---|---:|---:|---:|---:|
| Lean: 6 categories × 1 | 6 | 90 | 120 | ≈6,960 |
| **Pilot: 6 categories × 2 (recommended)** | 12 | 180 | 240 | **≈13,920** (31 × 240 + 36 × 180) |
| Full taxonomy: 15 × 2 | 30 | 450 | 600 | ≈34,800 |

**Pilot-shape cost fleet-wide:**
- Text ≈$14 (or $0 on MiniMax).
- AI review ≈$100.
- Images ≈$470 at 1 per lesson, ≈$930 at 2 per lesson. The lazy-asset pipeline could defer this.
- Human or native review is the dominant cost.
- If A4 runs, 36 × 60 more lessons are needed (+2,160).
- A sensible first wave is the 12 A0 languages without Cantonese and Chinese, plus Romance ×5 (17 languages × 240 = **4,080**).

## 6. Blockers and risks (ordered)

- **B1 (hard): elective publish.** Port lq-nordic `b5ba3eb4` to `scripts/generate-lesson-files.ts` in the other 13 repos. Without it, elective groups and pool lessons never ship, even though the source is right.
- **B2 (hard, slavic only):** slavic#41 must merge (web-app 0.3.10 → 0.5.8 plus overrides).
- **B3: open core PRs.** The 10 languages in nordic #59–61, english #41, ea #41 and sea #45 must merge before any electives or chapters.json work on them. Their elective groups are empty stubs.
- **B4: shipChapters caps at 15** in lq-english (american, au, gb, sco) and lq-romance (5 languages). Raise it to 20 in the same PR as ch16–20, or the new chapters will not publish. american#41 does not raise it.
- **B5: language configs.** Only Danish and Swiss have 16–20 themes, bosses and culture topics. Add them per language before A3, or the chapters get the fallback visual theme.
- **B6: the quota is unbounded on big chapters.**
  - Danish ch1 (34 core) → quota 10 of a 12-lesson pool.
  - Thai ch1–5 (29–40 core) → quota 9–12.
  - Option: have the generator write an explicit `quota` capped at 5 into each elective group.
  - Option: clamp the quota in `electiveQuota`.
  - This is an operator decision; the spec said "≈5".
- **B7: onboarding does not ask for interests**, so electives appear only for learners who open Settings. E2's onboarding step is still open in lq-core.
- **B8: review debt.** About 3,900 beta (aiDraft) lessons are already live fleet-wide. In the long-tail families, 40–50% of ch1–15 is unreviewed AI draft. Adding 50 more chapters or 180 electives per language there multiplies unreviewed content.
- **B9: G3 assets for ch16–20** are not done (images and audio runs). Budget per memory: ask the operator before any run over 200 items or $10 per 6 hours. Every per-language electives run (180–240 lessons) crosses the 200 line.
- **B10: duplicate Romanian** (lq-romance and lq-balkan), and the Welsh English slot is retired. Avoid double or wasted generation. **Resolved 2026-09-29:** lq-romance is canonical for Romanian; no Balkan Romanian electives.

## 7. Recommended execution order

1. **Unblock the pipeline:**
   - B1 publish port across 13 repos. It is mechanical: one commit per repo, copied from `b5ba3eb4`.
   - Merge slavic#41.
   - Decide B6 (quota cap).
2. **Merge the core PRs already in flight:** nordic #59–61, english #41 (with shipChapters → 20), ea #41 and sea #45. Then re-run publish.
3. **Electives wave 1: the 20-chapter set**, using the pilot shape of 6 × 2 through `extend-chapters --electives`:
   - icelandic, norwegian, swedish;
   - american;
   - japanese, korean;
   - the sea ×6;
   - 12 languages × 240 ≈ 2,880 lessons in total.
   - The ch16–20 groups already exist as stubs.
4. **Core A3 for Romance ×5 and Germanic ×4, then electives on them.**
   - These are the next most mature. Romance has the only human/AI review stamps.
   - Add their 16–20 configs first (B5).
   - Raise the Romance shipChapters.
5. **English au/gb/sco and Slavic ×3 → 20 plus electives.** Then Burmese and Lao: to 15 first, then to 20.
6. **Long-tail families** (balkan, african, celtic, middle-eastern, south-asian, uralic, west-slavic):
   - **Hold A4 (→20).**
   - Only add electives at 15 chapters after their existing beta ch1–15 content has passed the AI-review pipeline.
   - Order within them by usage data, per the electives spec.
7. **Skip or hold:**
   - Welsh English (retired).
   - Cantonese and Chinese: disabled and gapped. Do A2 `--fill-missing` only if the §C flags are to flip.
   - The lq-balkan Romanian duplicate: lq-romance is canonical (decided 2026-09-29). Skip Romanian in every lq-balkan electives or chapter run.

---

*Method:* `git fetch origin` on each repo, then `git ls-tree` / `git show origin/main:<path>` read through a Python survey. The survey counts chapters.json refs and lesson files, excluding `*bundle*`, `index.json` and `chapters.json`. PR branches were read through `git fetch origin <branch>` → FETCH_HEAD, which left local checkouts untouched. Open PRs come from `tea pr ls`. lq-tools and lq-core were read at origin/main.

## Update 2026-09-29 (unblock pass)

- **B1 closed.** The elective publish is ported to all 13 repos, each with `tests/unit/publish-electives.spec.ts`, and all are merged: english#48, east-asian#44, southeast-asian#49, romance#45, germanic#49, slavic#43, african#45, balkan#44, celtic#42, middle-eastern#42, south-asian#38, uralic#39, west-slavic#40.
- **Disabled-locale wipe fixed** in lq-balkan and lq-southeast-asian (`cleanPublicLessons(heldTrees())`). Before the fix, a real publish deleted the committed de/es/fr (and ja/ms/th/zh) trees.
- **B2 closed:** slavic#41 merged.
- **B3 closed:** nordic #59–61 merged.
- **B4 closed:** english#41 merged with american `shipChapters` 20; ch16–20 publish (20 chapters, 227 lessons).
- **B6 closed.** Quota = min(5, max(2, round(0.3 × core))):
  - lq-tools#52: electives mode writes the quota explicitly.
  - lq-core#118: the engine clamps the fallback. It takes effect once app-config is republished.
  - lq-nordic#66: backfills the 20 Danish groups and restores the `facets` that placeholder refill #65 dropped from `elective-business-ch16-phone-call`.
- **B10 closed:** lq-romance is canonical for Romanian.
