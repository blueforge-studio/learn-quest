# New App Ideas — Life-Quest & School-Quest

Generated 2026-05-05. Survey of candidate new apps to expand the LearnQuest portfolio, with a recommended top 3 for next build.

## Current portfolio

**Life-Quest (8 apps, production):** lq-economics, lq-finance, lq-health, lq-law, lq-media, lq-philosophy, lq-psychology, lq-tech
**School-Quest (6 apps, production):** lq-math, lq-science, lq-history, lq-geography, lq-reading, lq-writing

The portfolio leans heavily *cognitive/analytical*. The biggest gap is **applied / embodied / practical knowledge** — skills you do with your hands or in the physical world.

---

## Candidate apps — Life-Quest

| App | Domain | Distinct from | Why |
|-----|--------|---------------|-----|
| **lq-engineering** | Mechanical, electrical, structural, materials, thermodynamics — how things work | lq-tech (software) | Universal literacy; heavy diagram/visual potential; complements science/tech |
| **lq-construction** | Framing, plumbing, electrical safety, blueprints, tools, codes, renovation, contractor literacy | lq-engineering (theory) | High practical adult value; most homeowners are clueless; underserved |
| **lq-craft** | Woodworking, metalwork, sewing, 3D printing, basic electronics, maker skills | lq-construction (built environment) | Hobbyist/maker counterpart; smaller scale, hands-on |
| **lq-cooking** | Culinary fundamentals, food science, technique, meal planning, food cultures | lq-health (nutrition) | Universally relevant; high engagement; asset-rich |
| **lq-relationships** | Communication, conflict resolution, boundaries, dating, family, friendship, parenting basics | lq-psychology (theory) | Applied behavioral skills; companion to psychology |
| **lq-career** | Resumes, interviews, negotiation, workplace dynamics, networking, freelancing, entrepreneurship | lq-economics (macro), lq-psychology | Sits between econ and psych; high real-world ROI |
| **lq-civics** | Government structures, voting, public services, civic engagement, courts | lq-law (legal), lq-economics (taxes) | Thinner companion to law; democratic literacy |
| **lq-environment** | Climate science, energy systems, ecosystems, sustainable living, environmental policy | lq-science (theory) | Applied/contemporary; policy-aware |
| **lq-arts** | Visual arts, music appreciation, design fundamentals, cultural literacy | lq-philosophy (aesthetics) | Cultural literacy; visual-rich |
| **lq-survival** | First aid, navigation, weather, emergency prep, outdoor skills | lq-health (wellness) | Practical preparedness |
| **lq-spirituality** | World religions, meditation, ritual, comparative belief | lq-philosophy (ethics) | Cultural-religious literacy without doctrine |
| **lq-travel** | Travel logistics, cross-cultural literacy, planning, geography for travelers | lq-geography, lingua-quest | Applied geography + culture |
| **lq-parenting** | Child development, family dynamics, education, discipline, milestones | lq-psychology, lq-relationships | Lifestage-specific; large adult audience |
| **lq-fitness** | Movement, training programs, mobility, recovery, sports science | lq-health (general wellness) | Deeper than health; performance-focused |

## Candidate apps — School-Quest

| App | Domain | Why |
|-----|--------|-----|
| **lq-art** | Drawing, color theory, art history, techniques | Highly visual, perfect fit for image pipeline; easy to populate |
| **lq-music** | Notation, theory, instruments, listening, music history | Audio-rich content; complements TTS infrastructure |
| **lq-coding** | Age-appropriate programming, algorithms, computational thinking | Distinct from lq-tech (which is IT-literacy); CS curriculum gap |
| **lq-civics-jr** | Age-appropriate civics, government, social studies | Standard curriculum gap |
| **lq-economics-jr** | Age-appropriate economics & financial literacy | School-side counterpart to life-quest econ/finance |

---

## Scoring

Each candidate is scored on six criteria (1-5, higher is better):

- **P — Practical value:** real-world adult ROI
- **V — Visual density:** fit with the image-generation pipeline
- **D — Distinctness:** low overlap with existing apps
- **U — Universal appeal:** broad audience vs. niche
- **S — Scopability:** easy to define ~10 chapters / ~200 lessons
- **R — Low sensitivity:** content risk (5 = safe, 1 = controversial)

| App | P | V | D | U | S | R | **Total** |
|---|---|---|---|---|---|---|---|
| **lq-cooking** | 5 | 5 | 5 | 5 | 5 | 5 | **30** |
| **lq-engineering** | 5 | 5 | 5 | 4 | 5 | 5 | **29** |
| **lq-construction** | 5 | 5 | 5 | 4 | 5 | 5 | **29** |
| lq-art (school) | 4 | 5 | 5 | 4 | 5 | 5 | 28 |
| lq-travel | 4 | 5 | 4 | 5 | 4 | 5 | 27 |
| lq-music (school) | 3 | 4 | 5 | 4 | 5 | 5 | 26 |
| lq-coding (school) | 5 | 3 | 4 | 4 | 5 | 5 | 26 |
| lq-career | 5 | 3 | 3 | 5 | 4 | 5 | 25 |
| lq-craft | 3 | 5 | 4 | 3 | 4 | 5 | 24 |
| lq-arts | 3 | 5 | 4 | 3 | 4 | 5 | 24 |
| lq-fitness | 4 | 5 | 3 | 4 | 4 | 4 | 24 |
| lq-environment | 4 | 5 | 3 | 4 | 4 | 3 | 23 |
| lq-survival | 3 | 4 | 4 | 3 | 4 | 5 | 23 |
| lq-economics-jr (school) | 4 | 3 | 3 | 4 | 4 | 5 | 23 |
| lq-relationships | 5 | 3 | 3 | 5 | 4 | 2 | 22 |
| lq-civics | 4 | 3 | 3 | 4 | 4 | 3 | 21 |
| lq-civics-jr (school) | 4 | 3 | 4 | 4 | 3 | 3 | 21 |
| lq-parenting | 4 | 3 | 3 | 3 | 4 | 3 | 20 |
| lq-spirituality | 3 | 4 | 4 | 3 | 3 | 1 | 18 |

## Top 3 recommended next builds

### 1. lq-engineering (Life-Quest)

The clearest domain win. Universal literacy, complements lq-tech (software) and lq-science (theory) by occupying the "how built things actually work" niche. Visually rich (diagrams, exploded views, mechanism animations) — strong fit for the image pipeline. Plausible chapter outline: mechanics & motion → electrical & circuits → structures & loads → materials → thermodynamics & energy → fluids → control systems → systems thinking → modern engineering disciplines → great engineering achievements.

### 2. lq-construction (Life-Quest)

Highest practical adult value of any candidate. Renovation, home maintenance, contractor literacy, building codes — content most adults wish they understood. Distinct enough from engineering to stand alone (engineering = theory, construction = applied built environment). Plausible chapters: tools & safety → materials → framing & structure → electrical → plumbing → HVAC → finishes → blueprints & permits → renovation projects → working with contractors.

### 3. lq-cooking (Life-Quest)

Broadest universal appeal of the practical-skills cluster. Naturally chunked content (technique-by-technique, cuisine-by-cuisine), high asset density, near-infinite engagement potential. Distinct from lq-health (nutrition theory) by being technique- and culture-focused. Plausible chapters: kitchen basics & safety → knife skills → heat & technique → flavor & seasoning → core methods (sauté, roast, braise, etc.) → baking fundamentals → world cuisines → meal planning → food science → entertaining.

### Why this trio

Together they convert Life-Quest from "things to think about" into "things you do" — engineering (understand), construction (build), cooking (make). All three have:

- Strong visual asset density → leverages existing image pipeline
- Clear, finite chapter structures (≈10 chapters, ≈200 lessons)
- Adult universal appeal (not niche)
- No content-licensing complications
- Distinct enough from existing apps to avoid overlap

### Honorable mentions

- **lq-art** (school-quest) — easiest to populate, ideal asset-pipeline match; consider as a low-effort fourth.
- **lq-career** — high real-world ROI but overlaps multiple existing apps; better as expansion content within lq-economics/lq-psychology than a separate app.
- **lq-relationships** — strong concept but content sensitivity; safer as second-wave once lq-psychology patterns are well-established.
