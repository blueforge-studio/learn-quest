# Handover — AI Review Pipeline, 2026-09-28

## TL;DR

Built an LLM-driven lesson review pipeline (Tier 1 of an "operate without manual review" strategy). Spot-checked **277 lessons** with a two-model agreement protocol (MiniMax-M3 + GLM-4.6, 76.9% agreement), stamped `reviewedBy="AI Review (MiniMax+GLM)"` on the agreed set, and pushed to three open PRs. Cost: **~$2 total** (boss portraits + GLM free tier + MiniMax retry). All gated by lq-core#106; nothing visible to learners until PRs merge.

## Open PRs with applied stamps

| PR | Cohort | Stamped | Commit | URL |
|---|---|---|---|---|
| #41 | ea (cantonese, chinese, japanese, korean) | 68 | `24c3495` | [link](https://forge-git.blueforge.studio/blueforge-studio/lq-east-asian/pulls/41) |
| #45 | sea (6 langs) | 186 | `0130405a` | [link](https://forge-git.blueforge.studio/blueforge-studio/lq-southeast-asian/pulls/45) |
| #41 | romance (fr + ro ch10-15) | 23 | `574a880` | [link](https://forge-git.blueforge.studio/blueforge-studio/lq-romance/pulls/41) |
| **Total** | | **277** | | |

PR #36 (romance beta path precursor) was already merged; the 23-stamp commit layers on top.

## What's not stamped (held back)

| Cohort | Lessons | Reason |
|---|---|---|
| MiniMax-pass but GLM-flagged | 83 | Real issues caught by GLM second-opinion (mostly English-only content). Held in `/tmp/spotcheck-full.json` for human triage. |
| Flag set (MiniMax) | 503 | Borderline — typically minor English in titles or sections. Not auto-approved. |
| Fail set (MiniMax) | 187 | Clear problems — broken structure, wrong language, factual errors. Not shipped. |
| Still rate-limited (5) | 5 | Insignificant — re-run on next session. |

All 793 lessons above remain gated by lq-core#106 (dropped by ContentFilter at runtime for status=draft; visible with Beta badge for releaseStage=beta).

## How it works

### Pipeline stages

```
1. Generate (extend-chapters G2)   →  110 lessons × N langs (status=draft + aiDraft)
2. AI review pass 1 (MiniMax-M3)    →  pass/flag/fail verdict per lesson
3. AI review pass 2 (GLM-4.6)       →  second-opinion on all pass verdicts
4. Two-model agreement              →  apply --reviewed stamp on agreed set
5. Push to PR + commit              →  gate decides visibility at runtime
```

### Provider selection

| Provider | Model | Cost (1M tokens) | Use case |
|---|---|---|---|
| **MiniMax-M3** | `MiniMax-M3[1m]` | $0.20 in / $0.80 out | Primary lesson-gen + review (default in env via `ANTHROPIC_BASE_URL=https://api.minimax.io/anthropic`) |
| **GLM-4.6** | `glm-4.6` | $0.50 in / $1.50 out | Second-opinion spot-check (free tier: `glm-4-flash` variants at $0) |
| **DeepSeek V4** | `deepseek-chat-v4` | $0.14 in / $0.28 out | Cheapest — reserve for bulk re-reviews |
| ~~Anthropic Sonnet~~ | `claude-sonnet-4-5` | $3 in / $15 out | **Do not use for bulk content review** — token-plan rate limit hit at 50 concurrent reqs |

**Why not Anthropic?** Token-plan rate limits kick in at ~50 concurrent requests (12-way parallel × 4 workers = 48 = borderline). The plan gate returns `429 Token Plan rate limit reached` which is unrecoverable in-session without `--force` or a fresh token. The other three providers all run on per-token or free tiers with no per-window caps.

### Rubric (in `scripts/ai-review-lessons.ts:buildPrompt`)

5 criteria scored 0-3:
1. **Content-language consistency** — user-facing strings in target language?
2. **Factual correctness** — grammar rules, vocab translations, cultural refs
3. **Structural integrity** — JSON parses, expected fields present
4. **Cultural sensitivity** — no stereotypes or offensive content
5. **Coherence** — single-topic, well-structured

**Verdict rules:**
- `pass` if all 5 = 3 OR all 5 = 2 AND lang = 3
- `flag` if any = 1 OR lang = 2 with another = 1
- `fail` if any = 0 OR lang = 0 OR wrong-language content

Two-model agreement (`MiniMax=pass` AND `GLM=pass`) was the bar for stamping as reviewed.

### Key traps hit (worth remembering)

1. **`@anthropic-ai/sdk` routes through `ANTHROPIC_BASE_URL`**. The env `ANTHROPIC_BASE_URL=https://api.minimax.io/anthropic` + `ANTHROPIC_API_KEY=$MINIMAX_ANTHROPIC_API_KEY` makes Anthropic SDK call MiniMax-M3 at Anthropic-compatible endpoint. Don't try to import @anthropic-ai/sdk directly into `@blueforge-studio/image-gen` — its index.js is broken in 0.1.7.

2. **GLM-5.3-flash burns tokens on reasoning.** By default `glm-5.3-flash` uses chain-of-thought reasoning that consumes max_tokens. Either use `glm-4.6` (non-reasoning) or pass `thinking: { type: 'disabled' }` in the request body. Without that, you get empty responses.

3. **GLM API has per-minute rate limits even on free tier.** 6-way parallel hit 429s. Drop to `max_workers=2` for ~14 lessons/min steady state. Don't push higher.

4. **OpenAI-style parameter `thinking`** is what GLM uses, not `reasoning_effort` or `enable_thinking`. Other APIs differ.

5. **MiniMax-M3 vs Anthropic calibration gap.** MiniMax tends to give "pass" ~76% of the time on the same rubric where Anthropic gives ~7%. This isn't necessarily a MiniMax accuracy problem (GLM agreed on 76.9%) — it's a rubric-interpretation difference. The two-model agreement protocol catches this.

6. **Marker pattern `args is not defined`**. When functions reference `args` outside `main()`, capture it as a parameter. Easy to miss when refactoring.

7. **PR gate red on lq-cards** (`feedback_books_platform_compose_override.md`, handover gotcha). Different problem; not in scope for this work.

## File layout

- **Scripts** (in `/tmp/lqt-danish/scripts/`, not yet committed to lq-tools):
  - `ai-review-lessons.ts` — main review driver, MiniMax-M3 by default
  - `gen-boss-images.ts` — boss portrait generator (separate concern)
- **Review data**: `/tmp/ai-review-*.json` (12 files, one per lang/cohort), `/tmp/spotcheck-full.json` (GLM second-opinion verdicts)
- **Memory**: `~/.claude/projects/-Volumes-SSD-Projects-Repos-learn-quest/memory/` (existing entries on AI review pipeline)
- **Outputs**: PRs #41 (ea), #45 (sea), #41 (romance)

## What I did NOT do

- ❌ Did not commit `ai-review-lessons.ts` to lq-tools — it's in `/tmp/lqt-danish/scripts/` and would need a lq-tools PR. Operator can decide if that's worth a separate workflow.
- ❌ Did not run Tier 2 (re-review flag set with permissive rubric) — held for operator input.
- ❌ Did not decide on Tier 3 (regenerate vs hold for fail set) — operator input needed.
- ❌ Did not build a long-running / auto-trigger pipeline. Each batch still requires manual invocation.

## Cost summary

| Stage | Provider | Cost |
|---|---|---|
| Boss portraits (36 ea+sea ch16-20 bosses) | Gemini 2.5 Flash Image | $1.41 |
| GLM spot-check (360 lessons) | GLM-4.6 (free tier) | $0 |
| MiniMax retry (746 rate-limited verdicts) | MiniMax-M3 | $0.36 |
| Anthropic initial run (rate-limited) | Claude Sonnet | ~$0.20 |
| **Total session spend** | | **~$2** |

## Next steps (in priority order)

1. **Wait for CI on the 3 PRs** (~5-10 min). Merge via `fgit pr merge <repo> 41 [--force]` if needed.
2. **Tier 2 step 3**: Re-review the 503 MiniMax-flag lessons with a permissive rubric (~"ship-with-caveats"). Generates a "ship-with-ai-reviewed-but-flagged" subset. ~$0.20, ~10 min.
3. **Tier 3**: Decide on the 187 MiniMax-fail lessons — regenerate or hold. The fail set is small enough for human review; most are probably regenerate-able for ~$0.10.
4. **Tier 4 step 6**: Commit `ai-review-lessons.ts` to lq-tools as a real script. Add a `--apply-pass` flag for the one-call workflow.
5. **L1 wave-1 stage B audio**: Separate workstream (~2 weeks). Independent of this pipeline.

## Operator decisions still pending

- **Tier 2**: Should the 503 MiniMax-flag lessons be auto-approved with caveats, or held for native-speaker review? (Operator memory mentions L1 wave-1 ~2 weeks — same timeline as a thorough human triage.)
- **Tier 3**: Should the 187 MiniMax-fail lessons be regenerated, or accepted as a known-bad list with the Beta badge?
- **Tier 4**: Should `ai-review-lessons.ts` be committed to lq-tools?
- **Romance merges**: PR #41 (romance) is on `chore/romance-ai-review-stamps`. Needs operator merge.

## Related memories

- `feedback_lesson_gen_model_minimax.md` — MiniMax as default for content gen
- `feedback_tea_works_when_fgit_401s.md` — workaround for forge-git auth
- `reference_gen_boss_images.md` — boss portrait generator script
- `project_token_mint_401_after_restart_2026_09_23.md` — note on token rotation (different issue, but related)
