# Lang fleet — "where we left off" audit (2026-09-28)

Session: **lang-quest** (per-lang-app slice). Maturity + interest-coverage numbers come from the
learn-quest session's survey (`docs/STATUS_2026_09_28.md`); this doc covers **state-in-flight**:
open PRs, unmerged branches, dirty trees, stashes, and the §B–§E items from `Handover.md`
(2026-09-04). All 14 family repos live under `lang-quest/lq-*`, all live at
`<family>.lang-quest.blueforge.studio`.

---

## TL;DR

The fleet's last session wave (09-19→09-23) was **P1.4 app-shell 0.15.3 migrations + P2.4
enabled/shipChapters honouring + romance AI-authored chapters**. That wave is sitting in **open
PRs and pushed-but-PR-less branches**, not in main. The four "big dirty trees" (south-asian 1562,
romance 1581, west-slavic 874, celtic 779) are **~95% LFS audio churn, not real work** — the same
class as the lq-english 09-12 finding and the 09-21 fleet renormalize.

## 1. Dirty trees triaged — LFS noise, not work

| repo | dirty total | LFS-tracked audio among them | real residue |
|---|---|---|---|
| lq-romance | 1581 | 1517 | `blueforge.config.json` M; untracked `blueforge.product.yml` + `brand/` (sidecar work); **untracked french ch12–14 lesson JSONs (real WIP, §D)** |
| lq-south-asian | 1562 | 1532 | config M; sidecar branch checked out unmerged; `image-audit-results-2026-08-31-*.json` scratch |
| lq-west-slavic | 874 | 818 | config M; 2 visual-snapshot PNGs; untracked generated `index.json` files (asset-map regen output) |
| lq-celtic | 779 | 736 | config M; 2 visual snapshots; untracked generated `index.json` files |

**Action:** the mp3 "modifications" should not be committed as-is; they need the renormalize
treatment (4 repos already renormalized 09-21 — these four were not in that set, or regressed via
smudge). The romance ch12–14 untracked lessons are the only genuine uncommitted work in the four.

## 2. Open PRs on forge-git (nothing merged from the last wave)

**P1.4 app-shell 0.15.3 migration** (awaiting review/sign-off — P2.1):
- `lq-african#23`, `lq-celtic#24`, `lq-romance#22` (romance still on 0.15.2), `lq-west-slavic#22`

**P2.4 honour enabled/shipChapters:**
- `lq-uralic#23` — PR'd
- Pushed branches with **no PR opened**: `lq-east-asian` `chore/p24-enabled-and-shipchapters`
  (includes the §C flag flip: chinese + cantonese `enabled:false` in `locale-manifest.json`),
  `lq-english` `chore/p24-american-shipchapters` (american shipChapters 5→15… wait, 10→15:
  manifest now says 15), `lq-southeast-asian` + `lq-germanic` + `lq-balkan` `chore/p2-4-*`
  branches

**Sidecar status fields:** `lq-balkan#26`, `lq-celtic#26`, `lq-east-asian#29`, `lq-english#28`,
`lq-nordic#45`, `lq-slavic#28`, `lq-west-slavic#23`

**Content / fixes:**
- `lq-romance#24` french ch11 (8 lessons AI-authored) + `#23` romanian ch11–15 (42 lessons, aiDraft-gated)
- `lq-english#22` revert welsh retirement + `#23` generate 107 missing spelling/conversation mp3s via Edge TTS (closes Handover pick-up item 3's third test failure)
- `lq-celtic#22` rewrite two nonsense machine-translated welsh dialogues
- `lq-southeast-asian#32` fix 2 broken public audio cue copies
- `lq-nordic#36` flip primary assets to MinIO + `nordic/_shared/images` pull
- Deploy pins: `lq-germanic#14`, `lq-uralic#8/#6` (pin server to app-3, bake VITE defaults)

## 3. §B–§E from Handover.md (2026-09-04) — status today

| item | was | now |
|---|---|---|
| §B ship lq-nordic | blocked on §A4 size | **DONE** — production-mature, 4 langs × 15 ch, source = public, clean main 09-27, only app on web-app 0.5.4 |
| §C release clean languages (flag flips) | not started | **PARTLY** — east-asian chinese/cantonese disabled in source but on an unmerged, undeployed branch (app blocked by P1.1 disk guard anyway); english american raised to 15 on an unmerged branch; british/australian/scottish still at 10, welsh 5 |
| §D romance to 15 chapters | not started (179 lessons) | **IN FLIGHT** — romanian ch11–15 PR'd, french ch10–11 committed/PR'd, **french ch12–14 lessons sit uncommitted in the working tree**; ~179 → fewer owed; peer tracks as P2.5 |
| §E nordic disabled locales | ~1,700 files behind a flag | **Effectively closed** — all 4 nordic languages serve 15 chapters in production; remaining manifest `enabled:false` entries are per-feature, not locale-level |

## 4. Branch/stash hygiene

- Every repo carries the same stale branch tail: `backup/pre-squash-main`,
  `screen-audit/iterate-2026-05-*`, `verify-main`, `content/generate-chapters-index` — safe to
  prune once confirmed merged.
- `lq-nordic` HEAD sits on `feat/feature-media-experiment` (09-17 marketing sidecar work, pushed,
  no PR — matches the blueforge catalog-slideshow campaign).
- Stashes: 18 total across the fleet, all noise — `lfs-noise-pre-rebase`, `autostash`, "stale tree
  before syncing to main". `lq-english` holds 6, all the same class. Nothing worth recovering.

## 5. Where we are (merged with the maturity survey)

- **Tier 1:** nordic only. **Tier 2:** english, east-asian (undeployed, P1.1), southeast-asian
  (undeployed, P1.1), romance (prod stale vs source), germanic. **Tier 3:** slavic, african.
  **Skeleton:** balkan, celtic, middle-eastern, south-asian, uralic, west-slavic (8 source ch
  generating 15 public ch — source-vs-public truth unresolved in 13 of 14 apps; only nordic's
  trees agree).
- Fleet-wide: only nordic is on web-app 0.5.4 (sound-pattern, reading aids, DEFAULT screen map are
  nordic-only). Every README except nordic's names the missing `public/data/assets/domains.json`
  (gradient-fallback backgrounds).

## 6. Recommended order (lang-side)

1. **Merge the mechanical wave** — 4 P1.4 app-shell PRs + 7 sidecar-status PRs (review + `fgit pr merge`).
2. **Open the missing P2.4 PRs** for the pushed east-asian / english / southeast-asian / germanic / balkan branches (§C flips ship with them).
3. **Commit + PR romance french ch12–14** (finish §D french; romanian already PR'd).
4. **LFS re-renormalize** the four noisy repos before any of their next content commits.
5. **Fleet web-app 0.5.4 upgrade** (nordic = template) — lang-side prerequisite for the electives contract (peer ships the engine in lq-core + generator in lq-tools).
6. **Resolve source-vs-public chapter truth per app**, then the domains.json fix, then skeleton content depth.
