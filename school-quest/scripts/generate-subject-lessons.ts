#!/usr/bin/env npx tsx
/**
 * Generate lesson content for school-quest subjects.
 * Default: 100% DeepSeek with system prompt caching.
 *
 * Usage:
 *   npx tsx scripts/generate-subject-lessons.ts --subject=math --chapter=2 --count=10
 *   npx tsx scripts/generate-subject-lessons.ts --all --count=10 --workers=3
 *   npx tsx scripts/generate-subject-lessons.ts --provider=split --split=6 --all --count=5
 *   npx tsx scripts/generate-subject-lessons.ts --dry-run --all --count=10
 *
 * Options:
 *   --subject=<name>    Single subject | --all for all subjects
 *   --category=<name>   Filter by category (default: all)
 *   --chapter=<n>       Chapter number (default: 1)
 *   --count=<n>         Lessons per category (default: 3)
 *   --workers=<n>       Parallel workers (default: 1, recommended: 2-4)
 *   --provider=<name>   deepseek (default), qwen, or split
 *   --split=<n>         DeepSeek share out of 10 (default: 10 = 100% DeepSeek)
 *   --difficulty=<lvl>  beginner|elementary|intermediate|advanced|expert
 *   --dry-run           Show plan without API calls
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { validateLessonFile } from './validate-lesson.js';
import { createProvider, type ProviderName } from './lib/ai-providers.js';
import { extractJson } from './lib/json-utils.js';
import { loadEnv } from './lib/env-loader.js';
import { runWorkerPool, type WorkerJob } from './lib/worker-pool.js';

loadEnv(new URL(import.meta.url).pathname);

// --- CLI args ---

const PROVIDER = process.argv.find(a => a.startsWith('--provider='))?.split('=')[1] ?? 'deepseek';
const QWEN_API_KEY = process.env.QWEN_API_KEY;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const SUBJECT = process.argv.find(a => a.startsWith('--subject='))?.split('=')[1];
const CATEGORY = process.argv.find(a => a.startsWith('--category='))?.split('=')[1] ?? 'all';
const COUNT = Number(process.argv.find(a => a.startsWith('--count='))?.split('=')[1] ?? '3');
const CHAPTER = process.argv.find(a => a.startsWith('--chapter='))?.split('=')[1] ?? '1';
const DIFFICULTY = process.argv.find(a => a.startsWith('--difficulty='))?.split('=')[1] ?? 'elementary';
const MAX_RETRIES = Number(process.argv.find(a => a.startsWith('--retries='))?.split('=')[1] ?? '5');
const WORKERS = Number(process.argv.find(a => a.startsWith('--workers='))?.split('=')[1] ?? '1');
const ALL = process.argv.includes('--all');

const VALID_DIFFICULTIES = ['beginner', 'elementary', 'intermediate', 'advanced', 'expert'];
const ROOT = dirname(dirname(new URL(import.meta.url).pathname));

// --- Types ---

interface TopicDef {
  id: string;
  title: string;
  type: string;
  description: string;
}

interface LqConfig {
  app: { name: string; type: string; label: string };
  categories: { id: string; name: string; children?: string[] }[];
  difficulty: { levels: { id: string; name: string }[]; default: string };
}

interface TopicsConfig {
  templateLesson: string;
  categories: Record<string, TopicDef[]>;
}

// --- Validation ---

if (!ALL && !SUBJECT) {
  console.error(`Usage: --subject=<name> --category=<cat> --count=<n> [--chapter=<n>] [--difficulty=<level>] [--retries=<n>] [--dry-run]`);
  console.error(`       --all --count=<n> [--chapter=<n>] [--difficulty=<level>] [--dry-run]`);
  console.error(`\nDifficulty levels: ${VALID_DIFFICULTIES.join(', ')}`);
  console.error(`Subjects: ${discoverSubjects().join(', ')}`);
  process.exit(1);
}
if (!VALID_DIFFICULTIES.includes(DIFFICULTY)) {
  console.error(`Invalid difficulty "${DIFFICULTY}". Must be one of: ${VALID_DIFFICULTIES.join(', ')}`);
  process.exit(1);
}
if (!DRY_RUN) {
  if (PROVIDER === 'qwen' && !QWEN_API_KEY) {
    console.error('Set QWEN_API_KEY env var (or use --dry-run)');
    process.exit(1);
  }
  if (PROVIDER === 'deepseek' && !DEEPSEEK_API_KEY) {
    console.error('Set DEEPSEEK_API_KEY env var (or use --dry-run)');
    process.exit(1);
  }
  if (PROVIDER === 'split' && (!DEEPSEEK_API_KEY || !QWEN_API_KEY)) {
    console.error('Split mode requires both DEEPSEEK_API_KEY and QWEN_API_KEY env vars');
    process.exit(1);
  }
}

// --- Config loaders ---

function discoverSubjects(): string[] {
  return readdirSync(join(ROOT, 'scripts', 'topics'))
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''));
}

function loadLqConfig(subject: string): LqConfig {
  const configPath = join(ROOT, `lq-${subject}`, 'lq.config.json');
  if (!existsSync(configPath)) {
    throw new Error(`lq.config.json not found for subject "${subject}" at ${configPath}`);
  }
  return JSON.parse(readFileSync(configPath, 'utf-8'));
}

function loadTopicsConfig(subject: string): TopicsConfig {
  const topicsPath = join(ROOT, 'scripts', 'topics', `${subject}.json`);
  if (!existsSync(topicsPath)) {
    throw new Error(`Topics config not found for subject "${subject}" at ${topicsPath}`);
  }
  return JSON.parse(readFileSync(topicsPath, 'utf-8'));
}

function resolveCategories(config: LqConfig, topics: TopicsConfig, categoryFilter: string): { id: string; name: string; path: string; topics: TopicDef[] }[] {
  if (categoryFilter === 'all') {
    return Object.entries(topics.categories).map(([path, topicList]) => {
      const catId = path.split('/')[0];
      const configCat = config.categories.find(c => c.id === catId);
      return { id: catId, name: configCat?.name ?? catId, path, topics: topicList };
    });
  }

  // Match by category id or path
  const matching = Object.entries(topics.categories).filter(
    ([path]) => path === categoryFilter || path.split('/')[0] === categoryFilter
  );

  if (matching.length === 0) {
    const available = Object.keys(topics.categories).join(', ');
    throw new Error(`No matching category "${categoryFilter}". Available: ${available}`);
  }

  return matching.map(([path, topicList]) => {
    const catId = path.split('/')[0];
    const configCat = config.categories.find(c => c.id === catId);
    return { id: catId, name: configCat?.name ?? catId, path, topics: topicList };
  });
}

// --- Provider setup (uses lib/ai-providers with system prompt caching) ---

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const SPLIT_RATIO = Number(process.argv.find(a => a.startsWith('--split='))?.split('=')[1] ?? '10');

const provider = DRY_RUN ? null : createProvider({
  provider: PROVIDER as ProviderName,
  deepseekKey: DEEPSEEK_API_KEY,
  qwenKey: QWEN_API_KEY,
  maxRetries: MAX_RETRIES,
  splitRatio: SPLIT_RATIO,
});

async function callProvider(systemPrompt: string, userPrompt: string): Promise<string> {
  return provider!.callWithSystem(systemPrompt, userPrompt);
}

// --- Prompt builder (split for caching) ---

function buildSystemPrompt(subjectName: string, templateJson: string, difficulty: string): string {
  return `You are generating educational lesson content for a children's learning app called "${subjectName} Quest".

Target audience: Children ages 6-12
Difficulty: ${difficulty}
Subject: ${subjectName}

Here is an example lesson to use as structural reference (match this JSON format EXACTLY):
${templateJson}

REQUIREMENTS:
- Output a complete lesson JSON object wrapped in a "lessons" array
- Include 5-8 questions/problems/stages as appropriate for the lesson type
- Include hints and explanations for answers
- Include metadata: xpReward (60-100), estimatedTime (5-15 min)
- Include tags array with relevant keywords
- Set createdBy to "deepseek-ai", lastChangeType to "generated"
- Make content educational, fun, and accurate
- Output ONLY valid JSON, no markdown code fences, no explanation`;
}

function buildUserPrompt(topic: TopicDef, categoryName: string, chapter: string, difficulty: string): string {
  return `Generate a ${topic.type} lesson:
- ID: "${topic.id}"
- Title: "${topic.title}"
- Type: "${topic.type}"
- Chapter: "chapter-${chapter}"
- Difficulty: "${difficulty}"
- Category: ${categoryName}
- Description: ${topic.description}
- Date: "${new Date().toISOString().split('T')[0]}T00:00:00.000Z"`;
}

// --- Content quality checks ---

interface QualityResult {
  pass: boolean;
  warnings: string[];
  errors: string[];
}

function checkContentQuality(parsed: Record<string, unknown>, topic: TopicDef, chapter: string, difficulty: string): QualityResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Must have lessons array
  const lessons = parsed.lessons;
  if (!Array.isArray(lessons) || lessons.length === 0) {
    errors.push('Missing or empty "lessons" array');
    return { pass: false, warnings, errors };
  }

  const lesson = lessons[0] as Record<string, unknown>;

  // Type match
  if (lesson.type !== topic.type) {
    errors.push(`Type mismatch: expected "${topic.type}", got "${lesson.type}"`);
  }

  // Chapter match
  if (lesson.chapterId !== `chapter-${chapter}`) {
    warnings.push(`Chapter mismatch: expected "chapter-${chapter}", got "${lesson.chapterId}"`);
  }

  // Difficulty match
  if (lesson.difficulty !== difficulty) {
    warnings.push(`Difficulty mismatch: expected "${difficulty}", got "${lesson.difficulty}"`);
  }

  // XP range
  const xp = lesson.xpReward as number;
  if (typeof xp === 'number' && (xp < 60 || xp > 100)) {
    warnings.push(`xpReward ${xp} outside expected range 60-100`);
  }

  // Estimated time range
  const time = lesson.estimatedTime as number;
  if (typeof time === 'number' && (time < 5 || time > 15)) {
    warnings.push(`estimatedTime ${time} outside expected range 5-15`);
  }

  // Tags check
  const tags = lesson.tags;
  if (Array.isArray(tags) && tags.length === 0) {
    warnings.push('Empty tags array');
  }

  // Content check — should have stages/problems/questions
  const content = lesson.content as Record<string, unknown> | undefined;
  if (content && typeof content === 'object') {
    const hasItems = content.stages || content.problems || content.questions ||
      content.items || content.sections || content.events || content.steps || content.procedure;
    if (!hasItems) {
      warnings.push('Content lacks stages/problems/questions/items — may be incomplete');
    }
  }

  // Zod schema validation
  const zodResult = validateLessonFile(parsed);
  if (!zodResult.valid) {
    for (const err of zodResult.errors) {
      errors.push(`schema: ${err}`);
    }
  }

  return { pass: errors.length === 0, warnings, errors };
}

// --- Generation ---

interface GenerationResult {
  generated: number;
  failed: number;
  skipped: number;
  qualityWarnings: number;
}

interface GenerationJob {
  subjectName: string;
  appDir: string;
  categoryName: string;
  topic: TopicDef;
  templateJson: string;
  chapter: string;
  targetPath: string;
}

function generateOneLesson(job: GenerationJob): () => Promise<'ok' | 'failed'> {
  return async () => {
    const { subjectName, topic, categoryName, templateJson, chapter, targetPath } = job;

    const systemPrompt = buildSystemPrompt(subjectName, templateJson, DIFFICULTY);
    const userPrompt = buildUserPrompt(topic, categoryName, chapter, DIFFICULTY);
    const response = await callProvider(systemPrompt, userPrompt);
    const json = extractJson(response);
    const parsed = JSON.parse(json);

    if (typeof parsed === 'object' && parsed !== null && !parsed.difficulty) {
      parsed.difficulty = DIFFICULTY;
    }

    const quality = checkContentQuality(parsed, topic, chapter, DIFFICULTY);
    if (!quality.pass) {
      throw new Error(quality.errors[0] || 'quality check failed');
    }

    if (Array.isArray(parsed.lessons) && parsed.lessons.length > 0) {
      const lesson = parsed.lessons[0];
      if (lesson.chapterId !== `chapter-${chapter}`) lesson.chapterId = `chapter-${chapter}`;
      if (lesson.difficulty !== DIFFICULTY) lesson.difficulty = DIFFICULTY;
    }

    mkdirSync(dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, JSON.stringify(parsed, null, 2));
    return 'ok' as const;
  };
}

// --- Main ---

async function main() {
  const subjects = ALL ? discoverSubjects() : [SUBJECT!];
  const allJobs: WorkerJob<'ok' | 'failed'>[] = [];
  let totalSkipped = 0;

  for (const subjectKey of subjects) {
    let config: LqConfig;
    let topics: TopicsConfig;
    try {
      config = loadLqConfig(subjectKey);
      topics = loadTopicsConfig(subjectKey);
    } catch (e) {
      console.error(`Skipping "${subjectKey}": ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }

    const templatePath = join(ROOT, topics.templateLesson);
    let templateJson = '{}';
    if (existsSync(templatePath)) {
      templateJson = readFileSync(templatePath, 'utf-8');
    } else {
      console.warn(`  warning: template not found: ${templatePath}`);
    }

    const categories = resolveCategories(config, topics, CATEGORY);
    const appDir = join(ROOT, `lq-${subjectKey}`);

    for (const category of categories) {
      for (let i = 0; i < Math.min(COUNT, category.topics.length); i++) {
        const topic = category.topics[i];
        const lessonDir = join(appDir, 'public', 'data', 'lessons', 'en', `chapter-${CHAPTER}`);
        const targetPath = join(lessonDir, `${topic.id}.json`);

        if (existsSync(targetPath)) {
          totalSkipped++;
          continue;
        }

        if (DRY_RUN) {
          console.log(`  [dry-run] ${subjectKey}/${category.path}/ch${CHAPTER}/${topic.id}`);
          continue;
        }

        allJobs.push({
          id: `${subjectKey}/${category.path}/${topic.id}`,
          run: generateOneLesson({
            subjectName: config.app.label,
            appDir,
            categoryName: category.name,
            topic,
            templateJson,
            chapter: CHAPTER,
            targetPath,
          }),
        });
      }
    }
  }

  console.log(`\nGeneration plan: ${allJobs.length} lessons to generate, ${totalSkipped} skipped (exist)`);
  console.log(`  Workers: ${WORKERS} | Provider: ${PROVIDER}`);

  if (DRY_RUN || allJobs.length === 0) {
    console.log(allJobs.length === 0 ? 'Nothing to generate!' : '--dry-run: no API calls');
    process.exit(0);
  }

  const startTime = Date.now();
  let generated = 0, failed = 0;

  const results = await runWorkerPool(allJobs, WORKERS, (completed, total, result) => {
    if (result.error) {
      failed++;
      console.log(`  ${completed}/${total} FAIL ${result.id}: ${result.error}`);
    } else {
      generated++;
      console.log(`  ${completed}/${total} ok ${result.id}`);
    }
  });

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  const cacheInfo = provider ? ` | Cache hits: ${provider.cacheHits}/${provider.totalCalls}` : '';
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Generated: ${generated} | Failed: ${failed} | Skipped: ${totalSkipped} | Time: ${elapsed}s${cacheInfo}`);
  if (failed > 0) process.exit(1);
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
