# Top 3 New App Designs

Generated 2026-05-05. Detailed design specs for the three highest-scoring new Life-Quest apps. Each follows the standard subject-app shape (≈10 chapters × ≈20 lessons = ~200 lessons), uses the existing scaffolding pipeline, and targets the established `@learnquest/web-core` + `@learnquest/lesson-ui` stack.

---

## 1. lq-cooking — score 30/30

**Tagline:** Confident in any kitchen.
**Audience:** Universal — beginners through home cooks wanting fundamentals.
**Distinct from lq-health:** lq-health is nutrition theory; lq-cooking is technique, culture, and method.

### Categories & chapters (10)

| # | Chapter | Sample topics |
|---|---------|---------------|
| 1 | Kitchen foundations | Tools, safety, sanitation, mise en place, storage |
| 2 | Knife skills | Grip, cuts (julienne, dice, chiffonade), sharpening, knife types |
| 3 | Heat & fundamentals | Stovetop control, oven zones, conduction/convection/radiation, doneness |
| 4 | Flavor & seasoning | Salt, acid, fat, heat balance; herbs, spices, umami, building flavor |
| 5 | Core methods | Sauté, sear, roast, braise, poach, steam, fry, grill |
| 6 | Sauces & stocks | Mother sauces, pan sauces, emulsions, reductions, stocks |
| 7 | Baking fundamentals | Bread, doughs, cakes, leavening, gluten, ratios |
| 8 | World cuisines | Italian, French, Mexican, Chinese, Japanese, Indian, Thai, Middle Eastern |
| 9 | Meal planning & shopping | Menu design, batch cooking, seasonality, budgeting, leftovers |
| 10 | Food science & advanced | Maillard, fermentation, preservation, knife sharpening masterclass |

### Lesson types

`technique-walkthrough`, `recipe-breakdown`, `ingredient-profile`, `concept-explainer`, `quiz`, `troubleshoot-scenario`, `cuisine-overview`.

### Asset categories

- Process step photos (knife cuts, sear levels, dough stages)
- Ingredient photography (herbs, spices, cuts of meat)
- Cuisine cultural images (markets, traditional dishes)
- Diagrams (heat zones, ratios, flow charts)
- Avatars (chef personas — beginner, home cook, master)

### Schema additions worth considering

- `ingredients[]`, `equipment[]`, `prepTime`, `difficulty`, `cuisine` fields on recipe-style lessons.

---

## 2. lq-engineering — score 29/30

**Tagline:** Understand how built things actually work.
**Audience:** Curious adults; STEM-curious teens; non-engineers wanting literacy.
**Distinct from lq-tech / lq-science:** lq-tech is software/IT; lq-science is theory; lq-engineering is the *applied physical world*.

### Categories & chapters (10)

| # | Chapter | Sample topics |
|---|---------|---------------|
| 1 | Forces, motion & mechanics | Newton's laws, levers, pulleys, friction, work, energy |
| 2 | Mechanisms & machines | Gears, cams, linkages, transmissions, internal combustion, electric motors |
| 3 | Electrical fundamentals | Voltage, current, resistance, AC/DC, circuits, household power |
| 4 | Electronics | Components, semiconductors, signals, microcontrollers, sensors |
| 5 | Structures & loads | Beams, columns, trusses, tension/compression, failure modes, bridges |
| 6 | Materials | Metals, polymers, ceramics, composites, properties, selection |
| 7 | Thermodynamics & energy | Heat transfer, engines, refrigeration, power generation, efficiency |
| 8 | Fluids & flow | Pressure, pumps, pipes, aerodynamics, hydraulics |
| 9 | Control & systems | Feedback, automation, robotics, signals, systems thinking |
| 10 | Engineering disciplines | Civil, mechanical, electrical, chemical, aerospace, biomedical, software (cross-ref) |

### Lesson types

`mechanism-explainer`, `concept-explainer`, `diagram-walkthrough`, `case-study` (famous bridges, engines, failures), `calculation-walkthrough`, `quiz`, `system-decompose`.

### Asset categories

- Exploded diagrams (engines, gears, circuits)
- Cross-section illustrations (bridges, structures)
- Real-world photos (machines, buildings, infrastructure)
- Schematic drawings (circuits, control loops)
- Animated GIFs / sequences for mechanism motion

### Schema additions worth considering

- `diagram` field on `concept-explainer` lessons (optional SVG path or image ref).
- `caseStudyRefs[]` for cross-referencing famous engineering achievements/failures.

---

## 3. lq-construction — score 29/30

**Tagline:** Confident as a homeowner, builder, or buyer.
**Audience:** Homeowners, renters becoming buyers, anyone working with contractors.
**Distinct from lq-engineering:** Engineering is theory of built things; construction is the *practice* of building, maintaining, and renovating.

### Categories & chapters (10)

| # | Chapter | Sample topics |
|---|---------|---------------|
| 1 | Tools & safety | Hand tools, power tools, PPE, jobsite safety, basic kit |
| 2 | Materials | Lumber, concrete, steel, fasteners, sheet goods, insulation |
| 3 | Framing & structure | Foundations, walls, floors, roofs, load paths, codes |
| 4 | Electrical | Service panels, circuits, outlets, switches, GFCI, when to call a pro |
| 5 | Plumbing | Supply, drain-waste-vent, fixtures, common problems, shutoffs |
| 6 | HVAC & energy | Heating, cooling, ventilation, insulation, weatherization, efficiency |
| 7 | Finishes | Drywall, paint, flooring, tile, trim, doors & windows |
| 8 | Blueprints & permits | Reading plans, zoning, permits, inspections, building codes |
| 9 | Renovation projects | Kitchen, bathroom, basement, deck — scope, sequence, budget, common mistakes |
| 10 | Working with contractors | Hiring, bidding, contracts, change orders, dispute resolution, when to DIY |

### Lesson types

`tool-walkthrough`, `material-profile`, `process-step`, `safety-scenario`, `code-explainer`, `troubleshoot-scenario` (e.g., "your toilet is running"), `cost-breakdown`, `quiz`.

### Asset categories

- Tool photography (with labeled parts)
- Step-by-step process photos
- Diagram cutaways (wall sections, plumbing layouts, electrical panels)
- Blueprint/floor-plan illustrations
- Before/after renovation photos
- Avatars (homeowner, contractor, inspector)

### Schema additions worth considering

- `safetyLevel` flag on lessons (`diy-safe`, `caution`, `pro-only`).
- `costRange` field for renovation lessons.

---

## Cross-cutting design notes

### Shared content style

All three are **applied/practical** apps. Recommended consistent patterns:

- Heavy use of `troubleshoot-scenario` (decision-tree style) — "your X is doing Y, what do you do?"
- `concept-explainer` lessons should always pair with at least one diagram or photo asset.
- `quiz` lessons end each chapter for retention.
- Cross-link aggressively (engineering ↔ construction; cooking ↔ health).

### Asset volume estimate

Per app: ~200 lessons × ~1.5 images/lesson average = **~300 images per app**.
At Replicate Flux Schnell pricing (~$0.003/image) = **~$1/app for image gen**.
Plus shared assets (avatars, chapter headers, icons) ≈ ~50 images = **~$0.15/app**.

### Lesson generation cost

~200 lessons × ~$0.004/lesson (DeepSeek with caching) = **~$0.80/app**.

### Total per-app build cost (rough)

- Lesson gen: ~$0.80
- Image gen: ~$1.15
- TTS audio (edge-tts): free
- **~$2 per app, ~$6 for the trio**

(Excludes scaffolding effort, validation, asset wiring, and review.)

### Build sequence recommendation

Build them **sequentially**, not in parallel — first one establishes any new schema/lesson-type patterns the other two should adopt. Suggested order:

1. **lq-cooking** first — broadest appeal, lowest schema risk, validates the practical-skills pattern.
2. **lq-engineering** second — establishes diagram-heavy patterns reusable in construction.
3. **lq-construction** third — reuses both food-style process-photos and engineering-style diagrams.

---

## Status

This document defines designs only. Nothing has been scaffolded or generated. Next decision: scaffold lq-cooking (run the pipeline steps from `SCAFFOLDING_TOOLS.md`), or iterate on the design first.
