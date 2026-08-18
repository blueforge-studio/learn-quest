# AI Package Consolidation Plan

> Analysis date: 2026-04-10
> Status: Phase 1 in progress — DeepSeek + Ollama adapters added to ai-gateway

## Current State

### BlueForge AI packages (`blueforge-org/packages/ai/`)

| Package | Lines | Purpose |
|---------|-------|---------|
| `@blueforge-studio/ai-gateway` | 3,275 | Universal provider abstraction — 8 adapters, fallback chains, streaming |
| `@blueforge-studio/ai-budget` | 2,209 | Cost tracking, budget enforcement, monthly reporting |
| `@blueforge-studio/image-gen` | 1,530 | Config-driven batch image generation |
| `@blueforge-studio/image-gateway` | 1,432 | Multi-adapter image generation orchestrator |
| `@blueforge-studio/ai-sdk-config` | 571 | Centralized model config, task-based routing |
| `@blueforge-studio/ai-functioncaller` | 496 | LLM→tool routing with Zod schemas |

### LearnQuest AI packages (`lq-core/services/`)

| Package | Lines | Purpose |
|---------|-------|---------|
| `@learnquest/ai-generators` | 4,537 | Worker/route framework for all media types |
| `@learnquest/ai-sdk` | 3,186 | Multi-provider SDK (Vault7, GLM, MiniMax, Ollama, DeepSeek, Qwen) |
| `@learnquest/ai-server` | 1,741 | RunPod serverless deployment |
| `@learnquest/ai-api` | 1,450 | Vault7 REST API client |
| `@learnquest/ai-content-core` | 1,361 | Provider-agnostic types and interfaces |
| `@learnquest/ai-image-generator` | 1,361 | SDXL/SD3.5 image workers |
| `@learnquest/ai-audio-generator` | 1,205 | TTS + SFX workers |
| `@learnquest/ai-text-generator` | 757 | Narrative/dialogue/quest text workers |
| `@learnquest/ai-video-generator` | 686 | SVD video workers |
| `@learnquest/ai-music-generator` | 668 | MusicGen workers |
| `@learnquest/logger` | 579 | Logging utility |

## Overlap Analysis

### High overlap — replace with BlueForge

| LQ Package | BF Replacement | Rationale |
|-----------|----------------|-----------|
| `@learnquest/ai-sdk` (3.2K) | `@blueforge-studio/ai-gateway` | BF has more adapters (8 vs 6), fallback chains, streaming, structured output. LQ-specific providers (Vault7, DeepSeek, Qwen) can be added as adapters. |

### No overlap — keep as LQ-specific

| LQ Package | Lines | Rationale |
|-----------|-------|-----------|
| `ai-content-core` | 1.4K | Game-content types — domain-specific |
| `ai-generators` | 4.5K | Worker/route framework — LQ architecture |
| `ai-text-generator` | 757 | Game narrative generation — domain-specific |
| `ai-audio-generator` | 1.2K | TTS + SFX — no BF equivalent |
| `ai-music-generator` | 668 | MusicGen — no BF equivalent |
| `ai-video-generator` | 686 | SVD — no BF equivalent |
| `ai-api` | 1.5K | Vault7 REST client — LQ-specific backend |
| `ai-server` | 1.7K | RunPod deployment — LQ infra |
| `logger` | 579 | Zero-dep utility — keep |

### Adopt from BlueForge (no LQ equivalent)

| BF Package | Lines | Value |
|-----------|-------|-------|
| `ai-budget` | 2.2K | Cost tracking across all providers — LQ has nothing equivalent |
| `ai-sdk-config` | 571 | Centralized model config + task routing — replaces ad-hoc config |

## Import Sites (28 total)

| Consumer | Imports | Provider Used |
|----------|---------|---------------|
| `libs/tools/assets/src/image-gen/` | Vault7Provider, Vault7ImageOptions | Vault7 |
| `libs/tools/assets/src/video/` | Vault7Provider, Vault7VideoOptions | Vault7 |
| `libs/tools/assets/src/audio/` | Vault7Provider, Vault7SfxOptions, Vault7MusicOptions | Vault7 |
| `libs/tools/assets/src/tts/` | Vault7Provider, Vault7TTSOptions | Vault7 |
| `libs/tools/assets/src/lib/` | Vault7Provider | Vault7 |
| `libs/tools/shared/src/ai/` | Vault7Provider | Vault7 |
| `libs/tools/content/src/enrich-learner-locales.ts` | OllamaProvider, QwenProvider, DeepSeekProvider | Ollama, Qwen, DeepSeek |
| `libs/tools/app-builder/src/create-group.ts` | QwenProvider, DeepSeekProvider | Qwen, DeepSeek |
| `apps/web/src/lib/queue/` | Vault7Provider, Vault7ImageOptions, GenerationResult | Vault7 |

### Key Finding

**80% of imports are Vault7-specific** — this is an LQ-only provider (wraps Vault7 REST API). `ai-gateway` cannot replace this.

**20% of imports use Qwen/DeepSeek/Ollama** — `ai-gateway` already has Qwen and GLM adapters. DeepSeek and Ollama are OpenAI-compatible and can use `OpenAICompatibleProvider`.

## Revised Migration Plan

### Phase 1: Migrate Qwen/DeepSeek/Ollama consumers to ai-gateway (medium effort)

**Done:** DeepSeek and Ollama adapters added to `@blueforge-studio/ai-gateway` (committed to blueforge-org). The gateway now supports 10 providers: OpenAI, Anthropic, Google, Gateway, Qwen, GLM, Replicate, OpenAI-Compatible, **DeepSeek**, **Ollama**.

**Remaining:** Publish `ai-gateway` to packr, then update lq-core consumers.

The 5 import sites using non-Vault7 providers can switch to `ai-gateway`:

| File | Current | After |
|------|---------|-------|
| `content/enrich-learner-locales.ts` (×3) | `@learnquest/ai-sdk/ollama`, `/qwen`, `/deepseek` | `@blueforge-studio/ai-gateway` (QwenAdapter, OpenAICompatibleProvider) |
| `app-builder/create-group.ts` (×2) | `@learnquest/ai-sdk/qwen`, `/deepseek` | `@blueforge-studio/ai-gateway` |

This removes the only non-Vault7 dependencies on `ai-sdk`.

### Phase 2: Slim ai-sdk to Vault7-only (low effort)

After Phase 1, `ai-sdk` is only used for Vault7Provider. Remove the dead providers:
- Delete `providers/ollama/`
- Delete `providers/qwen/`
- Delete `providers/deepseek/`
- Delete `providers/glm/`
- Delete `providers/minimax/`
- Keep `providers/vault7/` and `core/`

This cuts ai-sdk from 3.2K to ~1.5K lines — it becomes a focused Vault7 client.

### Phase 3: Wire ai-budget for cost tracking (low effort, high value)

`ai-budget` is already in the workspace. Add tracking at the adapter level in `libs/tools/assets/` where all generation happens. The existing credit system in `ai-content-core` handles user-facing limits; `ai-budget` adds operational cost visibility.

### Phase 4: Adopt ai-sdk-config (low effort)

Replace scattered model configuration in `ai-sdk` and `ai-generators` with `ai-sdk-config`'s centralized routing.

## Expected Result

| Metric | Before | After |
|--------|--------|-------|
| ai-sdk size | 3.2K lines, 6 providers | ~1.5K lines, 1 provider (Vault7) |
| Non-Vault7 text generation | Via ai-sdk providers | Via ai-gateway (better fallback, streaming) |
| Cost tracking | Credit system only | Credits + operational cost tracking (ai-budget) |
| Model routing | Ad-hoc per provider | Centralized (ai-sdk-config) |
