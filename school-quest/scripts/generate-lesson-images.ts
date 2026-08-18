#!/usr/bin/env npx tsx
/**
 * Generate lesson images for school-quest subjects using Replicate Flux Schnell.
 *
 * Scans lesson JSON for each subject, builds prompts based on lesson type/content,
 * generates images via Replicate, and saves to subject image directories.
 *
 * Cost: ~$0.003 per image (Replicate Flux Schnell)
 *
 * Usage:
 *   npx tsx scripts/generate-lesson-images.ts --dry-run
 *   npx tsx scripts/generate-lesson-images.ts --subject=math --limit=5
 *   npx tsx scripts/generate-lesson-images.ts --all --budget=2.00
 *   npx tsx scripts/generate-lesson-images.ts --subject=history --category=ancient
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'fs';
import { join, dirname, relative } from 'path';

const ROOT = dirname(dirname(new URL(import.meta.url).pathname));
const DRY_RUN = process.argv.includes('--dry-run');
const SUBJECT = process.argv.find(a => a.startsWith('--subject='))?.split('=')[1];
const CATEGORY_FILTER = process.argv.find(a => a.startsWith('--category='))?.split('=')[1];
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] ?? '0') || Infinity;
const BUDGET = parseFloat(process.argv.find(a => a.startsWith('--budget='))?.split('=')[1] ?? '5.00');
const ALL = process.argv.includes('--all');
const WATCH = process.argv.includes('--watch');
const WATCH_INTERVAL = parseInt(process.argv.find(a => a.startsWith('--watch-interval='))?.split('=')[1] ?? '5') * 1000;

const REPLICATE_TOKEN = process.env.REPLICATE_API_TOKEN;
const MODEL_VERSION = 'c846a69991daf4c0e5d016514849d14ee5b2e6846ce6b9d6f21369e564cfe51e';
const COST_PER_IMAGE = 0.003;
const THROTTLE_MS = 10_000;

if (!REPLICATE_TOKEN && !DRY_RUN) {
  console.error('Set REPLICATE_API_TOKEN env var (or use --dry-run)');
  process.exit(1);
}
if (!ALL && !SUBJECT) {
  console.error('Usage: --subject=<name> [--category=<cat>] [--limit=<n>] [--budget=<usd>] [--dry-run] [--watch]');
  console.error('       --all [--limit=<n>] [--budget=<usd>] [--dry-run] [--watch] [--watch-interval=<secs>]');
  process.exit(1);
}

// --- Image prompt builders per lesson type ---

const SUBJECT_STYLES: Record<string, string> = {
  math: 'Clean, colorful educational illustration style. Geometric shapes, numbers, and visual math concepts.',
  science: 'Bright, engaging scientific illustration. Lab equipment, nature, diagrams. Educational and accurate.',
  history: 'Classical painting style, museum quality. Historical scenes, portraits, artifacts.',
  geography: 'Vivid satellite/map style with landmarks. Natural landscapes, flags, cultural elements.',
  reading: 'Warm, storybook illustration style. Friendly characters, cozy settings, books.',
  writing: 'Soft watercolor/pencil illustration style. Writing tools, paper, creative scenes.',
};

function buildImagePrompt(lesson: Record<string, any>, subject: string): string {
  const style = SUBJECT_STYLES[subject] || 'Clean, educational illustration style.';
  const title = lesson.title || lesson.id;
  const type = lesson.type || 'lesson';

  const typePrompts: Record<string, string> = {
    'arithmetic': `Visual math illustration showing ${title}. Numbers, equations, counting objects.`,
    'geometry': `Geometric shapes illustration for ${title}. Colorful 2D/3D shapes on white background.`,
    'number-sense': `Number line and counting illustration for ${title}. Place value blocks, number patterns.`,
    'word-problem': `Story scene illustration for ${title}. Real-world math scenario with characters.`,
    'science-concept': `Educational diagram for ${title}. Scientific concept with labeled parts.`,
    'experiment': `Science experiment illustration for ${title}. Lab setup, materials, step-by-step visual.`,
    'classification': `Sorting/grouping illustration for ${title}. Categories with example items.`,
    'timeline': `Historical timeline illustration for ${title}. Key events along a decorated timeline.`,
    'era-exploration': `Historical scene for ${title}. Period-accurate architecture, clothing, artifacts.`,
    'historical-figure': `Portrait illustration for ${title}. Dignified, educational portrait style.`,
    'map-quiz': `Illustrated map for ${title}. Geographic features, borders, labels, colorful.`,
    'region-profile': `Landscape illustration for ${title}. Natural features, landmarks, cultural elements.`,
    'geo-challenge': `Geography challenge illustration for ${title}. Globe, flags, landmarks collage.`,
    'phonics': `Playful letter/sound illustration for ${title}. Alphabet characters with example objects.`,
    'sight-words': `Word learning illustration for ${title}. Flashcard style with friendly imagery.`,
    'fluency': `Reading scene illustration for ${title}. Child reading aloud, speech bubbles.`,
    'comprehension': `Story scene illustration for ${title}. Characters in a narrative setting.`,
    'interactive-story': `Storybook illustration for ${title}. Magical scene with characters and adventure.`,
    'handwriting': `Calligraphy/writing illustration for ${title}. Pen, paper, letter formation.`,
    'spelling': `Spelling bee illustration for ${title}. Letters, word building, educational.`,
    'grammar': `Grammar concept illustration for ${title}. Sentence building blocks, word types.`,
    'composition': `Writing composition illustration for ${title}. Essay structure, brainstorming.`,
    'creative-writing': `Creative writing illustration for ${title}. Imagination, story elements, notebook.`,
    'dictation': `Listening and writing illustration for ${title}. Headphones, pencil, notepad.`,
  };

  const typePrompt = typePrompts[type] || `Educational illustration for ${title}.`;
  return `${typePrompt} ${style} No text or labels in the image. White or light background.`;
}

// --- Replicate API ---

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function generateImage(prompt: string, retries = 3): Promise<Buffer | null> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: { Authorization: `Token ${REPLICATE_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        version: MODEL_VERSION,
        input: { prompt, num_inference_steps: 4, guidance_scale: 0, num_outputs: 1 },
      }),
    });

    if (res.status === 429) {
      const body = await res.json() as { retry_after?: number };
      const wait = (body.retry_after ?? 10) * 1000 + 1000;
      process.stdout.write(`rate limited, waiting ${Math.round(wait / 1000)}s... `);
      await sleep(wait);
      continue;
    }

    if (!res.ok) {
      console.error(`API ${res.status}: ${await res.text()}`);
      return null;
    }

    const prediction = await res.json() as { id: string };
    for (let i = 0; i < 60; i++) {
      await sleep(1000);
      const poll = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: { Authorization: `Token ${REPLICATE_TOKEN}` },
      });
      const data = await poll.json() as { status: string; output?: string[]; error?: string };
      if (data.status === 'succeeded' && data.output?.[0]) {
        const imgRes = await fetch(data.output[0]);
        return Buffer.from(await imgRes.arrayBuffer());
      }
      if (data.status === 'failed' || data.status === 'canceled') {
        console.error(data.error ?? 'prediction failed');
        return null;
      }
    }
    return null;
  }
  return null;
}

// --- Lesson scanner ---

interface ImageJob {
  lessonId: string;
  lessonTitle: string;
  lessonType: string;
  subject: string;
  category: string;
  outputPath: string;
  prompt: string;
}

function findLessonFiles(dir: string): string[] {
  const results: string[] = [];
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) results.push(...findLessonFiles(fullPath));
      else if (entry.name.endsWith('.json') && !entry.name.startsWith('chapter') && dir.includes('lessons')) {
        results.push(fullPath);
      }
    }
  } catch { /* skip */ }
  return results;
}

function collectJobs(subject: string): ImageJob[] {
  const appDir = join(ROOT, `lq-${subject}`);
  const imageDir = join(appDir, 'public', 'images', 'lessons');
  const jobs: ImageJob[] = [];

  const contentDir = join(appDir, 'content');
  const publicDir = join(appDir, 'public', 'data', 'lessons');
  const lessonFiles = [...findLessonFiles(contentDir), ...findLessonFiles(publicDir)];

  for (const file of lessonFiles) {
    try {
      const data = JSON.parse(readFileSync(file, 'utf-8'));
      const lessons = data.lessons ?? [data];
      for (const lesson of lessons) {
        if (!lesson.id || !lesson.type) continue;

        // Determine category from path — handles both flat (public/data/lessons/en/chapter-N/)
        // and nested (public/data/lessons/en/epoch/region/chapter-N/) structures
        const relPath = relative(appDir, file);
        const pathParts = relPath.split('/');
        const enIdx = pathParts.indexOf('en');
        const contentIdx = pathParts.indexOf('content');
        let category = 'general';
        if (enIdx >= 0 && enIdx + 1 < pathParts.length) {
          const afterEn = pathParts[enIdx + 1];
          if (afterEn.startsWith('chapter-')) {
            category = 'general';
          } else {
            // epoch or epoch/region
            const next = pathParts[enIdx + 2];
            category = next && !next.startsWith('chapter-') ? `${afterEn}/${next}` : afterEn;
          }
        } else if (contentIdx >= 0 && contentIdx + 1 < pathParts.length) {
          category = pathParts[contentIdx + 1];
        }

        if (CATEGORY_FILTER && !category.includes(CATEGORY_FILTER)) continue;

        const outFile = join(imageDir, category, `${lesson.id}.webp`);
        if (existsSync(outFile)) continue;

        jobs.push({
          lessonId: lesson.id,
          lessonTitle: lesson.title || lesson.id,
          lessonType: lesson.type,
          subject,
          category,
          outputPath: outFile,
          prompt: buildImagePrompt(lesson, subject),
        });
      }
    } catch { /* skip invalid files */ }
  }

  return jobs;
}

// --- Main ---

const subjects = ALL
  ? readdirSync(ROOT).filter(d => d.startsWith('lq-') && statSync(join(ROOT, d)).isDirectory()).map(d => d.replace('lq-', ''))
  : [SUBJECT!];

let allJobs: ImageJob[] = [];
for (const subject of subjects) {
  const jobs = collectJobs(subject);
  allJobs.push(...jobs);
}

allJobs = allJobs.slice(0, LIMIT);
const maxByBudget = Math.floor(BUDGET / COST_PER_IMAGE);
if (allJobs.length > maxByBudget) {
  allJobs = allJobs.slice(0, maxByBudget);
}

const estimatedCost = allJobs.length * COST_PER_IMAGE;

console.log(`\nImage generation plan:`);
console.log(`  Subjects: ${subjects.join(', ')}`);
console.log(`  Images to generate: ${allJobs.length}`);
console.log(`  Estimated cost: $${estimatedCost.toFixed(2)} (budget: $${BUDGET.toFixed(2)})`);
console.log(`  Model: Replicate Flux Schnell ($${COST_PER_IMAGE}/img)`);

// Show breakdown by subject
const bySubject = new Map<string, number>();
for (const job of allJobs) {
  bySubject.set(job.subject, (bySubject.get(job.subject) || 0) + 1);
}
for (const [subj, count] of bySubject) {
  console.log(`    ${subj}: ${count} images`);
}

if (allJobs.length === 0) {
  console.log('\nNo images to generate!');
  process.exit(0);
}

if (DRY_RUN) {
  console.log('\nSample prompts:');
  for (const job of allJobs.slice(0, 5)) {
    console.log(`  [${job.subject}/${job.category}] ${job.lessonId}`);
    console.log(`    ${job.prompt.slice(0, 120)}...`);
  }
  if (allJobs.length > 5) console.log(`  ... and ${allJobs.length - 5} more`);
  console.log('\n--dry-run: no images generated');
  process.exit(0);
}

// --- Generate ---
console.log(`\nGenerating ${allJobs.length} images...\n`);

let generated = 0, failed = 0, spent = 0;
const startTime = Date.now();
let lastLogTime = startTime;

function logProgress(i: number, job: ImageJob, status: string) {
  const now = Date.now();
  const pct = Math.round(((i + 1) / allJobs.length) * 100);
  const elapsed = Math.round((now - startTime) / 1000);
  const avgMs = i > 0 ? (now - startTime) / i : THROTTLE_MS + 3000;
  const eta = Math.round(((allJobs.length - i - 1) * avgMs) / 1000);
  const etaStr = eta < 60 ? `${eta}s` : `${Math.floor(eta / 60)}m${eta % 60}s`;

  if (WATCH) {
    // In watch mode, print progress every WATCH_INTERVAL seconds
    if (now - lastLogTime >= WATCH_INTERVAL || status.startsWith('ok') || status.startsWith('FAIL')) {
      console.log(`  [${elapsed}s] ${pct}% [${i + 1}/${allJobs.length}] ${job.subject}/${job.category}/${job.lessonId}... ${status} $${spent.toFixed(3)} ETA ${etaStr}`);
      lastLogTime = now;
    }
  } else {
    console.log(`  ${pct}% [${i + 1}/${allJobs.length}] ${job.subject}/${job.category}/${job.lessonId}... ${status} $${spent.toFixed(3)} ETA ${etaStr}`);
  }
}

for (let i = 0; i < allJobs.length; i++) {
  const job = allJobs[i];

  try {
    const buffer = await generateImage(job.prompt);
    if (buffer) {
      mkdirSync(dirname(job.outputPath), { recursive: true });
      writeFileSync(job.outputPath, buffer);
      generated++;
      spent += COST_PER_IMAGE;
      logProgress(i, job, 'ok');
      if (i < allJobs.length - 1) await sleep(THROTTLE_MS);
    } else {
      failed++;
      logProgress(i, job, 'FAILED');
      await sleep(THROTTLE_MS);
    }
  } catch (e) {
    failed++;
    logProgress(i, job, `FAILED: ${e instanceof Error ? e.message : String(e)}`);
    await sleep(THROTTLE_MS);
  }
}

console.log(`\nResults: ${generated} generated, ${failed} failed`);
console.log(`Total spent: $${spent.toFixed(3)}`);
