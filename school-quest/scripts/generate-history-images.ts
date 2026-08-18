#!/usr/bin/env npx tsx
/**
 * generate-history-images.ts
 *
 * Generates lesson images for lq-history via Replicate Flux Schnell ($0.003/img).
 * History uses 3-level hierarchy: epochs/{region}/chapter-{n}/{lessonId}.json
 *
 * Usage:
 *   npx tsx scripts/generate-history-images.ts --dry-run
 *   npx tsx scripts/generate-history-images.ts --epoch=ancient
 *   npx tsx scripts/generate-history-images.ts --all
 *
 * Budget: $8.38 available. At $0.003/img:
 *   - ancient (~240 lessons x 2 = 480 imgs = $1.44)
 *   - medieval (~200 x 2 = 400 = $1.20)
 *   - renaissance + early-modern + modern + contemporary (~372 x 2 = 744 = $2.23)
 *   - industrial + total = ~200 x 2 = 400 = $1.20
 *   Total estimated: ~2024 imgs = ~$6.07
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __dirname = join(fileURLToPath(import.meta.url), '..');
const ROOT = join(__dirname, '..');
const CONFIG_DIR = join(ROOT, 'config/school-quest/history');
const HISTORY_ROOT = join(ROOT, 'lq-history');
const REPLICATE_COST = 0.003;

const EPOCHS = ['ancient', 'medieval', 'renaissance', 'early-modern', 'modern', 'contemporary', 'industrial'];

const IMAGE_TYPES: Record<string, { name: string; path: string; defaultSize: number[]; instructions: string }[]> = {
  'timeline': [
    { name: 'timeline', path: '', defaultSize: [800, 600], instructions: 'Historical timeline illustration, educational style.' },
    { name: 'scene', path: 'scenes', defaultSize: [512, 512], instructions: 'Historical scene illustration, educational style.' },
  ],
  'era-exploration': [
    { name: 'map', path: '', defaultSize: [800, 600], instructions: 'Historical map illustration, educational style.' },
    { name: 'portrait', path: 'portraits', defaultSize: [512, 512], instructions: 'Historical portrait illustration, educational style.' },
  ],
  'historical-figure': [
    { name: 'portrait', path: '', defaultSize: [512, 512], instructions: 'Historical portrait illustration, educational style.' },
    { name: 'scene', path: 'scenes', defaultSize: [512, 512], instructions: 'Historical scene featuring the figure, educational style.' },
  ],
};

interface ImageConfig {
  subject: string;
  lessonId: string;
  title: string;
  lessonType: string;
  chapter: string;
  epoch: string;
  region: string;
  basePath: string;
  images: { id: string; type: string; prompt: string; filename: string }[];
}

interface WiredImage { type: string; path: string; }

function buildPrompt(lesson: any, typeName: string, instructions: string): string {
  const title = lesson.title || '';
  const type = lesson.type || '';
  const content = lesson.content || {};
  const bg = content.background || '';
  const legacy = content.legacy || '';
  const quizTopics = (content.quiz || []).map((q: any) => q.question).slice(0, 2).join(', ');
  const parts = [instructions, `Lesson: ${title}`, `Type: ${type}`];
  if (bg) parts.push(`Background: ${bg.substring(0, 100)}`);
  if (legacy) parts.push(`Legacy: ${legacy.substring(0, 80)}`);
  if (quizTopics) parts.push(`Topics: ${quizTopics}`);
  return parts.join('. ') + '.';
}

function wireImagesToLesson(lessonPath: string, wired: WiredImage[]): void {
  try {
    const content = JSON.parse(readFileSync(lessonPath, 'utf-8'));
    if (!content.lessons?.[0]) return;
    const primaryImg = wired[0]?.path || '';
    if (primaryImg) {
      content.lessons[0].content = content.lessons[0].content || {};
      content.lessons[0].content.image = primaryImg;
      content.lessons[0].content.imageGallery = wired.map(w => w.path);
    }
    writeFileSync(lessonPath, JSON.stringify(content, null, 2));
  } catch (e) {
    console.error(`  WARNING: failed to wire ${lessonPath}: ${e}`);
  }
}

function findLessonPathsByEpoch(epoch: string): { path: string; lessonId: string; chapter: string; region: string }[] {
  const results: { path: string; lessonId: string; chapter: string; region: string }[] = [];
  const epochDir = join(HISTORY_ROOT, 'public/data/lessons/en', epoch);
  if (!existsSync(epochDir)) return results;

  const walk = (dir: string, region: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (entry === 'chapter-1' || entry === 'chapter-2' || etc) {
          // chapter dir - find lessons
          for (const f of readdirSync(full)) {
            if (f.endsWith('.json') && f !== 'chapters.json') {
              const p = join(full, f);
              const id = JSON.parse(readFileSync(p, 'utf-8')).lessons?.[0]?.id || f.replace('.json', '');
              results.push({ path: p, lessonId: id, chapter: entry, region });
            }
          }
        } else if (!entry.startsWith('.')) {
          // region dir
          walk(full, entry);
        }
      }
    }
  };
  walk(epochDir, epoch);
  return results;
}

function findAllLessonPaths(): { path: string; lessonId: string; chapter: string; region: string; epoch: string }[] {
  const results: { path: string; lessonId: string; chapter: string; region: string; epoch: string }[] = [];
  for (const epoch of EPOCHS) {
    const epochDir = join(HISTORY_ROOT, 'public/data/lessons/en', epoch);
    if (!existsSync(epochDir)) continue;

    const walkRegion = (dir: string, region: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          if (entry.startsWith('chapter-')) {
            for (const f of readdirSync(full)) {
              if (f.endsWith('.json') && f !== 'chapters.json') {
                const p = join(full, f);
                try {
                  const data = JSON.parse(readFileSync(p, 'utf-8'));
                  const id = data.lessons?.[0]?.id || f.replace('.json', '');
                  results.push({ path: p, lessonId: id, chapter: entry, region, epoch });
                } catch {}
              }
            }
          } else if (!entry.startsWith('.')) {
            walkRegion(full, entry);
          }
        }
      }
    };
    walkRegion(epochDir, '_general');
  }
  return results;
}

function ensureConfigDir(dir: string) {
  mkdirSync(dir, { recursive: true });
}

function generateHistoryConfigs(args: { epoch?: string; dryRun?: boolean }) {
  const epochs = args.epoch ? [args.epoch] : EPOCHS;
  for (const epoch of epochs) {
    const lessons = findAllLessonPaths().filter(l => l.epoch === epoch);
    console.log(`\n${epoch.toUpperCase()} (${lessons.length} lessons)`);
    let count = 0;

    for (const lesson of lessons) {
      const data = JSON.parse(readFileSync(lesson.path, 'utf-8'));
      const lessonData = data.lessons?.[0];
      if (!lessonData) continue;

      const type = lessonData.type || 'timeline';
      const imgTypes = IMAGE_TYPES[type] || IMAGE_TYPES['timeline'];
      const images = imgTypes.map((it, idx) => {
        const idSuffix = it.path ? `-${it.path.replace('s', '').replace(/[^a-z]/g, '')}` : (idx > 0 ? `-${it.name}` : '');
        return {
          id: `${lesson.lessonId}${idSuffix}`,
          type: it.name,
          prompt: buildPrompt(lessonData, it.name, it.instructions),
          filename: `${lesson.lessonId}-${it.name}.webp`,
        };
      });

      const basePath = `public/images/lessons/${epoch}/${lesson.region}`;
      const cfg: ImageConfig = {
        subject: 'history',
        lessonId: lesson.lessonId,
        title: lessonData.title || lesson.lessonId,
        lessonType: type,
        chapter: lesson.chapter,
        epoch,
        region: lesson.region,
        basePath,
        images,
      };

      const cfgDir = join(CONFIG_DIR, epoch, lesson.region);
      ensureConfigDir(cfgDir);
      const cfgPath = join(cfgDir, `${lesson.lessonId}__${lesson.chapter}.json`);
      writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
      count++;
    }
    console.log(`  Generated ${count} configs for ${epoch}`);
  }
}

// Simple inline Replicate adapter
class ReplicateAdapter {
  private token: string;
  private version = 'c846a69991daf4c0e5d016514849d14ee5b2e6846ce6b9d6f21369e564cfe51e';
  private lastCost = 0;
  constructor() { this.token = process.env.REPLICATE_API_TOKEN || ''; }
  isAvailable(): boolean { return !!this.token; }
  getLastCost(): number { return this.lastCost; }
  async generate(prompt: string): Promise<Buffer | null> {
    if (!this.token) throw new Error('REPLICATE_API_TOKEN not set');
    const createRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: { Authorization: `Token ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: this.version, input: { prompt, num_inference_steps: 4, guidance_scale: 0.0, prompt_strength: 0.85, num_outputs: 1 } }),
    });
    if (!createRes.ok) { const err = await createRes.text(); throw new Error(`Create failed (${createRes.status}): ${err}`); }
    const prediction: any = await createRes.json();
    const finalPred = await this.poll(prediction.id);
    this.lastCost = REPLICATE_COST;
    if (finalPred.status !== 'succeeded') throw new Error(`Prediction failed: ${finalPred.error ?? 'unknown'}`);
    const output = finalPred.output as string[];
    if (!output?.[0]) throw new Error('No output URL');
    const imageRes = await fetch(output[0], { signal: AbortSignal.timeout(30_000) });
    if (!imageRes.ok) throw new Error(`Download failed: ${imageRes.status}`);
    return Buffer.from(await imageRes.arrayBuffer());
  }
  private async poll(id: string): Promise<any> {
    const url = `https://api.replicate.com/v1/predictions/${id}`;
    const headers = { Authorization: `Token ${this.token}` };
    const start = Date.now();
    while (Date.now() - start < 120_000) {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw new Error(`Poll failed: ${res.status}`);
      const p: any = await res.json();
      if (p.status === 'succeeded' || p.status === 'failed' || p.status === 'canceled') return p;
      await new Promise(r => setTimeout(r, 500));
    }
    throw new Error('Prediction timed out');
  }
}

// Google Gemini Nano Banana adapter (free tier via @google/genai)
class GoogleAdapter {
  private token: string;
  private lastCost = 0;
  constructor() { this.token = process.env.GEMINI_API_KEY || ''; }
  isAvailable(): boolean { return !!this.token; }
  getLastCost(): number { return this.lastCost; }
  async generate(prompt: string): Promise<Buffer | null> {
    if (!this.token) throw new Error('GEMINI_API_KEY not set');
    const ai = new GoogleGenAI({ apiKey: this.token });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [{ role: 'user', parts: [{ text: `Generate an educational illustration: ${prompt}` }] }],
    });
    const part = response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData?.mimeType?.startsWith('image/'));
    if (!part?.inlineData?.data) throw new Error('No image in response');
    return Buffer.from(part.inlineData.data, 'base64');
  }
}

type ImageAdapter = ReplicateAdapter | GoogleAdapter;

function loadHistoryConfigs(epoch: string): ImageConfig[] {
  const configs: ImageConfig[] = [];
  const epochDir = join(CONFIG_DIR, epoch);
  if (!existsSync(epochDir)) return [];

  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith('.json')) {
        try {
          const cfg = JSON.parse(readFileSync(full, 'utf-8')) as ImageConfig;
          if (cfg.lessonId && cfg.images) configs.push(cfg);
        } catch {}
      }
    }
  };
  walk(epochDir);
  return configs;
}

async function generateHistoryImages(epoch: string, dryRun: boolean, model: 'replicate' | 'google' = 'replicate') {
  const adapter: ImageAdapter = model === 'google' ? new GoogleAdapter() : new ReplicateAdapter();
  if (!adapter.isAvailable()) {
    console.log(`  SKIP: ${model} not available`);
    return { generated: 0, skipped: 0, cost: 0 };
  }

  const configs = loadHistoryConfigs(epoch);
  if (configs.length === 0) {
    console.log(`  No configs found for ${epoch}`);
    return { generated: 0, skipped: 0, cost: 0 };
  }

  console.log(`  ${configs.length} lessons, generating images...`);
  let generated = 0, skipped = 0, cost = 0;

  for (const cfg of configs) {
    const imgOutDir = join(HISTORY_ROOT, cfg.basePath, cfg.chapter);
    const wired: WiredImage[] = [];
    let allSuccess = true;

    for (const img of cfg.images) {
      const imgPath = join(imgOutDir, img.filename);
      if (existsSync(imgPath) && !dryRun) {
        wired.push({ type: img.type, path: `${cfg.basePath}/${cfg.chapter}/${img.filename}` });
        skipped++;
        continue;
      }
      if (dryRun) {
        console.log(`  DRY: ${img.filename}: ${img.prompt.substring(0, 60)}...`);
        wired.push({ type: img.type, path: 'TBD' });
        continue;
      }
      try {
        console.log(`  GEN ${img.filename}`);
        const buffer = await adapter.generate(img.prompt);
        if (buffer) {
          mkdirSync(imgOutDir, { recursive: true });
          writeFileSync(imgPath, buffer);
          wired.push({ type: img.type, path: `${cfg.basePath}/${cfg.chapter}/${img.filename}` });
          generated++;
          cost += adapter.getLastCost();
        } else { allSuccess = false; }
      } catch (e: any) {
        console.error(`  FAIL ${img.filename}: ${e.message}`);
        allSuccess = false;
      }
    }

    if (!dryRun && wired.length > 0 && allSuccess) {
      // Parse lessonId from config filename: {lessonId}__{chapter}.json
      const cfgFilename = `${cfg.lessonId}__${cfg.chapter}.json`;
      const searchPath = join(HISTORY_ROOT, 'public/data/lessons/en', cfg.epoch, cfg.region, cfg.chapter);
      if (existsSync(searchPath)) {
        const lessonFile = join(searchPath, `${cfg.lessonId}.json`);
        if (existsSync(lessonFile)) {
          wireImagesToLesson(lessonFile, wired);
        } else {
          // Fallback: scan for exact match
          for (const f of readdirSync(searchPath)) {
            if (f === `${cfg.lessonId}.json`) {
              wireImagesToLesson(join(searchPath, f), wired);
              break;
            }
          }
        }
      }
    }
  }
  return { generated, skipped, cost };
}

function parseArgs() {
  const args: { epoch?: string; dryRun?: boolean; all?: boolean; model?: 'replicate' | 'google' } = {};
  process.argv.slice(2).forEach(arg => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      if (key === 'epoch') args.epoch = value;
      else if (key === 'dry-run') args.dryRun = true;
      else if (key === 'all') args.all = true;
      else if (key === 'model') args.model = value as 'replicate' | 'google';
    }
  });
  return args;
}

async function main() {
  const args = parseArgs();
  const model = args.model || 'replicate';
  const epochs = args.all ? EPOCHS : (args.epoch ? [args.epoch] : []);

  if (!epochs.length) {
    console.log(`\nHistory Image Generator`);
    console.log(`Usage:`);
    console.log(`  npx tsx scripts/generate-history-images.ts --epoch=ancient --dry-run`);
    console.log(`  npx tsx scripts/generate-history-images.ts --epoch=ancient --model=google`);
    console.log(`  npx tsx scripts/generate-history-images.ts --all --model=google`);
    return;
  }

  const costNote = model === 'google' ? ' (Google Imagen 4, free tier)' : ` ($${REPLICATE_COST}/img)`;
  console.log(`\nHistory Image Generator | Model: ${model} | Mode: ${args.dryRun ? 'DRY RUN' : 'LIVE'}${costNote}`);

  // First generate configs
  console.log(`\n=== PHASE 1: Generating configs ===`);
  generateHistoryConfigs(args);

  if (!args.dryRun && args.epoch && !args.all) {
    console.log(`\n=== PHASE 2: Generating images ===`);
    const result = await generateHistoryImages(args.epoch, false, model);
    console.log(`\nTOTAL: ${result.generated} generated | ${result.skipped} skipped | $${result.cost.toFixed(3)}`);
  }
}

main().catch(console.error);
