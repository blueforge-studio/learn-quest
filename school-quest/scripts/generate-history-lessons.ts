#!/usr/bin/env npx tsx
/**
 * Generate history lessons using the 3-layer hierarchy: epoch → region → chapter.
 * Uses DeepSeek + Qwen in 60/40 split (default).
 *
 * Target: 5 chapters × 10 lessons per epoch/region combination.
 *
 * Usage:
 *   npx tsx scripts/generate-history-lessons.ts --dry-run
 *   npx tsx scripts/generate-history-lessons.ts --epoch=ancient --region=african --chapter=1 --count=10
 *   npx tsx scripts/generate-history-lessons.ts --epoch=medieval --count=10
 *   npx tsx scripts/generate-history-lessons.ts --all --count=10
 *   npx tsx scripts/generate-history-lessons.ts --provider=qwen --epoch=ancient --count=5
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { createProvider } from './lib/ai-providers.js';
import { extractJson, parseAndValidate } from './lib/json-utils.js';
import { loadEnv } from './lib/env-loader.js';
import { runWorkerPool, type WorkerJob } from './lib/worker-pool.js';
import type { ProviderName } from './lib/ai-providers.js';

loadEnv(new URL(import.meta.url).pathname);

// --- CLI ---
const DRY_RUN = process.argv.includes('--dry-run');
const EPOCH = process.argv.find(a => a.startsWith('--epoch='))?.split('=')[1];
const REGION = process.argv.find(a => a.startsWith('--region='))?.split('=')[1];
const CHAPTER = process.argv.find(a => a.startsWith('--chapter='))?.split('=')[1];
const COUNT = Number(process.argv.find(a => a.startsWith('--count='))?.split('=')[1] ?? '10');
const DIFFICULTY = process.argv.find(a => a.startsWith('--difficulty='))?.split('=')[1] ?? 'elementary';
const PROVIDER = (process.argv.find(a => a.startsWith('--provider='))?.split('=')[1] ?? 'deepseek') as ProviderName;
const WORKERS = Number(process.argv.find(a => a.startsWith('--workers='))?.split('=')[1] ?? '1');
const ALL = process.argv.includes('--all');
const ROOT = dirname(dirname(new URL(import.meta.url).pathname));
const HISTORY_DIR = join(ROOT, 'lq-history', 'public', 'data', 'lessons', 'en');

if (!ALL && !EPOCH) {
  console.error('Usage: --epoch=<name> [--region=<name>] [--chapter=<n>] [--count=<n>] [--provider=split|deepseek|qwen] [--dry-run]');
  console.error('       --all [--count=<n>] [--dry-run]');
  process.exit(1);
}
if (!DRY_RUN && PROVIDER === 'split' && (!process.env.DEEPSEEK_API_KEY || !process.env.QWEN_API_KEY)) {
  console.error('Split mode requires DEEPSEEK_API_KEY + QWEN_API_KEY');
  process.exit(1);
}

// --- Epoch/Region definitions ---

interface RegionDef {
  id: string;
  label: string;
  topics: TopicDef[];
}

interface EpochDef {
  id: string;
  label: string;
  period: string;
  regions: RegionDef[];
}

interface TopicDef {
  id: string;
  title: string;
  type: 'timeline' | 'era-exploration' | 'historical-figure';
  description: string;
}

// Load from topics/history-epochs.json
function loadEpochTopics(): EpochDef[] {
  const path = join(ROOT, 'scripts', 'topics', 'history-epochs.json');
  if (existsSync(path)) return JSON.parse(readFileSync(path, 'utf-8')).epochs;
  console.error(`Missing ${path} — run: npx tsx scripts/scaffold-history-topics.ts`);
  process.exit(1);
}

// --- Template loading ---

function findTemplate(): string {
  const candidates = [
    join(HISTORY_DIR, 'ancient', '_general', 'chapter-1'),
    join(HISTORY_DIR, 'ancient', 'african', 'chapter-1'),
    join(HISTORY_DIR, 'ancient', 'european', 'chapter-1'),
  ];
  for (const dir of candidates) {
    if (!existsSync(dir)) continue;
    const files = readdirSync(dir).filter(f => f.endsWith('.json'));
    if (files.length > 0) return readFileSync(join(dir, files[0]), 'utf-8');
  }
  return '{}';
}

// --- Prompt ---

function buildPrompt(epoch: EpochDef, region: RegionDef, topic: TopicDef, chapter: string, template: string): string {
  return `You are generating educational lesson content for a children's learning app called "History Quest".

Generate a ${topic.type} lesson about "${topic.title}" for the ${region.label} region in the ${epoch.label} era.

Topic description: ${topic.description}
Historical period: ${epoch.period}
Target audience: Children ages 6-12
Difficulty: ${DIFFICULTY}
Era: ${epoch.label}
Region: ${region.label}

Here is an example lesson to use as structural reference (match this JSON format EXACTLY):
${template}

REQUIREMENTS:
- Output a complete lesson JSON wrapped in a "lessons" array
- The lesson id must be: "${topic.id}"
- The lesson type must be: "${topic.type}"
- chapterId must be: "chapter-${chapter}"
- Include 5-8 questions/events/stages as appropriate
- Include hints and explanations
- Include metadata: xpReward (60-100), estimatedTime (5-15 min), difficulty ("${DIFFICULTY}")
- Include tags array with relevant keywords
- Use date "${new Date().toISOString().split('T')[0]}T00:00:00.000Z" for timestamps
- Set createdBy to "ai-split"
- Output ONLY valid JSON, no markdown code fences`;
}

// --- Generation ---

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
  const epochs = loadEpochTopics();
  const template = findTemplate();
  const provider = createProvider({
    provider: PROVIDER,
    qwenKey: process.env.QWEN_API_KEY,
    deepseekKey: process.env.DEEPSEEK_API_KEY,
  });

  const targets: { epoch: EpochDef; region: RegionDef; chapter: string; topic: TopicDef }[] = [];

  for (const epoch of epochs) {
    if (EPOCH && epoch.id !== EPOCH) continue;
    for (const region of epoch.regions) {
      if (REGION && region.id !== REGION) continue;
      const chaptersToGen = CHAPTER ? [CHAPTER] : ['1', '2', '3', '4', '5'];
      for (const ch of chaptersToGen) {
        for (let i = 0; i < Math.min(COUNT, region.topics.length); i++) {
          const topic = region.topics[i];
          const outDir = join(HISTORY_DIR, epoch.id, region.id, `chapter-${ch}`);
          const outFile = join(outDir, `${topic.id}.json`);
          if (existsSync(outFile)) continue;
          targets.push({ epoch, region, chapter: ch, topic });
        }
      }
    }
  }

  console.log(`\nHistory lesson generation plan:`);
  console.log(`  Provider: ${PROVIDER} | Workers: ${WORKERS}`);
  console.log(`  Targets: ${targets.length} lessons to generate`);
  if (DRY_RUN) {
    for (const t of targets.slice(0, 10)) {
      console.log(`  [dry-run] ${t.epoch.id}/${t.region.id}/chapter-${t.chapter}/${t.topic.id}`);
    }
    if (targets.length > 10) console.log(`  ... and ${targets.length - 10} more`);
    console.log('\n--dry-run: no API calls');
    process.exit(0);
  }

  // Build worker jobs
  const jobs: WorkerJob<'ok'>[] = targets.map(t => ({
    id: `${t.epoch.id}/${t.region.id}/ch${t.chapter}/${t.topic.id}`,
    run: async () => {
      const prompt = buildPrompt(t.epoch, t.region, t.topic, t.chapter, template);
      const response = await provider.callWithSystem(
        // System prompt (cached across calls for same epoch)
        `You are generating history lessons for "History Quest", a children's learning app (ages 6-12). Era: ${t.epoch.label} (${t.epoch.period}). Region: ${t.region.label}. Difficulty: ${DIFFICULTY}.\n\nTemplate:\n${template}\n\nREQUIREMENTS: Output ONLY valid JSON wrapped in "lessons" array. Include 5-8 events/questions. Set createdBy to "deepseek-ai". No markdown fences.`,
        `Generate a ${t.topic.type} lesson:\n- ID: "${t.topic.id}"\n- Title: "${t.topic.title}"\n- Type: "${t.topic.type}"\n- Chapter: "chapter-${t.chapter}"\n- Difficulty: "${DIFFICULTY}"\n- Description: ${t.topic.description}\n- Date: "${new Date().toISOString().split('T')[0]}T00:00:00.000Z"`
      );
      const json = extractJson(response);
      const { parsed, valid, errors } = parseAndValidate(json, t.topic.type, t.chapter, DIFFICULTY);
      if (!valid) throw new Error(errors[0]);

      const outDir = join(HISTORY_DIR, t.epoch.id, t.region.id, `chapter-${t.chapter}`);
      mkdirSync(outDir, { recursive: true });
      writeFileSync(join(outDir, `${t.topic.id}.json`), JSON.stringify(parsed, null, 2));
      return 'ok' as const;
    },
  }));

  const startTime = Date.now();
  let generated = 0, failed = 0;

  await runWorkerPool(jobs, WORKERS, (completed, total, result) => {
    if (result.error) {
      failed++;
      console.log(`  ${completed}/${total} FAIL ${result.id}: ${result.error}`);
    } else {
      generated++;
      console.log(`  ${completed}/${total} ok ${result.id}`);
    }
  });

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log(`\nResults: ${generated} generated, ${failed} failed | Time: ${elapsed}s | Cache: ${provider.cacheHits}/${provider.totalCalls}`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
