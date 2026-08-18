/**
 * AI provider abstraction for content generation.
 * Supports DeepSeek (with prompt caching), Qwen, and split mode (60/40).
 *
 * DeepSeek auto-caches system prompts — input tokens for cached prefix
 * cost $0.07/M instead of $0.27/M (75% cheaper).
 */

export type ProviderName = 'deepseek' | 'qwen' | 'split';

/** Split ratio: first N of every 10 calls use DeepSeek, rest use Qwen */
export const DEFAULT_SPLIT_RATIO = 10; // 100% DeepSeek by default

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

interface Message {
  role: 'system' | 'user';
  content: string;
}

async function callAPI(
  url: string, apiKey: string, model: string, messages: Message[], name: string, maxRetries: number
): Promise<{ text: string; cached: boolean }> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, temperature: 0.3, max_tokens: 4000 }),
      });
      if (res.status === 429 || res.status >= 500) {
        const backoff = Math.min(3000 * Math.pow(2, attempt), 60000);
        console.log(`  wait ${name} ${res.status}, retry in ${backoff / 1000}s (${attempt}/${maxRetries})...`);
        await sleep(backoff);
        continue;
      }
      if (!res.ok) throw new Error(`${name} ${res.status}: ${await res.text()}`);
      const data = await res.json() as {
        choices: { message: { content: string } }[];
        usage?: { prompt_cache_hit_tokens?: number; prompt_tokens?: number };
      };
      const cached = (data.usage?.prompt_cache_hit_tokens ?? 0) > 0;
      return { text: data.choices[0].message.content, cached };
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (attempt < maxRetries) {
        const backoff = Math.min(3000 * Math.pow(2, attempt), 30000);
        console.log(`  wait ${name}: ${lastError.message}. Retry ${attempt}/${maxRetries}...`);
        await sleep(backoff);
      }
    }
  }
  throw lastError ?? new Error(`${name}: all retries exhausted`);
}

export interface AIProvider {
  /** Call with a single prompt (backward compat) */
  call(prompt: string): Promise<string>;
  /** Call with system + user message split (enables caching) */
  callWithSystem(systemPrompt: string, userPrompt: string): Promise<string>;
  readonly lastProvider: string;
  readonly cacheHits: number;
  readonly totalCalls: number;
}

export function createProvider(opts: {
  provider: ProviderName;
  qwenKey?: string;
  deepseekKey?: string;
  maxRetries?: number;
  /** Split ratio: out of every 10 calls, how many use DeepSeek (default 10 = 100% DeepSeek) */
  splitRatio?: number;
}): AIProvider {
  const retries = opts.maxRetries ?? 5;
  const splitRatio = opts.splitRatio ?? DEFAULT_SPLIT_RATIO; // e.g. 6 = 60% DeepSeek, 4 = 40% DeepSeek
  let splitCount = 0;
  let _lastProvider = '';
  let _cacheHits = 0;
  let _totalCalls = 0;

  async function callDeepSeek(messages: Message[]): Promise<string> {
    _lastProvider = 'deepseek';
    _totalCalls++;
    const result = await callAPI(
      'https://api.deepseek.com/chat/completions',
      opts.deepseekKey!, 'deepseek-chat', messages, 'deepseek', retries
    );
    if (result.cached) _cacheHits++;
    return result.text;
  }

  async function callQwen(messages: Message[]): Promise<string> {
    _lastProvider = 'qwen';
    _totalCalls++;
    const result = await callAPI(
      'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
      opts.qwenKey!, 'qwen-plus', messages, 'qwen', retries
    );
    return result.text;
  }

  function chooseProvider(): (messages: Message[]) => Promise<string> {
    if (opts.provider === 'qwen') return callQwen;
    if (opts.provider === 'deepseek') return callDeepSeek;

    // Split: configurable ratio out of 10 (e.g. 6 = D D D D D D Q Q Q Q)
    splitCount++;
    const pos = (splitCount - 1) % 10;
    const chosen = pos < splitRatio ? 'deepseek' : 'qwen';
    process.stdout.write(`[${chosen}] `);
    return chosen === 'deepseek' ? callDeepSeek : callQwen;
  }

  return {
    get lastProvider() { return _lastProvider; },
    get cacheHits() { return _cacheHits; },
    get totalCalls() { return _totalCalls; },

    async call(prompt: string) {
      const fn = chooseProvider();
      return fn([{ role: 'user', content: prompt }]);
    },

    async callWithSystem(systemPrompt: string, userPrompt: string) {
      const fn = chooseProvider();
      return fn([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ]);
    },
  };
}
