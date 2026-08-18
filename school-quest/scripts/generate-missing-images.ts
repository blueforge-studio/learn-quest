#!/usr/bin/env npx tsx
/**
 * generate-missing-images.ts
 * 
 * Generates images ONLY for lessons that are missing images on disk.
 * Handles partial image sets — wires whatever was generated even if not all types succeed.
 * 
 * Usage:
 *   npx tsx scripts/generate-missing-images.ts --subject=math
 *   npx tsx scripts/generate-missing-images.ts --subject=geography
 *   npx tsx scripts/generate-missing-images.ts --all
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'fs';
import { join } from 'path';

const ROOT = join('/Users/kmandrup/Projects/Repos/learn-quest/school-quest');
const CONFIG_DIR = join(ROOT, 'config/school-quest');
const REPLICATE_COST = 0.003;

const SUBJECTS = ['math', 'science', 'geography', 'reading', 'writing'];

const IMAGE_TYPES: Record<string, { name: string; path: string; instructions: string }[]> = {
  math: [
    { name: 'diagram', path: '', instructions: 'Math diagram with labels, educational style on white.' },
    { name: 'visual', path: 'visuals', instructions: 'Math visual illustration, educational style.' },
    { name: 'example', path: 'examples', instructions: 'Math example step by step, educational style.' },
  ],
  science: [
    { name: 'diagram', path: '', instructions: 'Science diagram with labels, educational style on white.' },
    { name: 'specimen', path: 'specimens', instructions: 'Scientific specimen illustration, educational style.' },
    { name: 'experiment', path: 'experiments', instructions: 'Science experiment illustration, educational style.' },
  ],
  geography: [
    { name: 'map', path: '', instructions: 'Geographic map illustration, educational style.' },
    { name: 'landmark', path: 'landmarks', instructions: 'Famous landmark illustration, educational style.' },
    { name: 'diagram', path: 'diagrams', instructions: 'Geography diagram with labels, educational style.' },
    { name: 'scene', path: 'scenes', instructions: 'Geographic scene illustration, educational style.' },
  ],
  reading: [
    { name: 'illustration', path: '', instructions: 'Reading passage illustration, educational style.' },
    { name: 'scene', path: 'scenes', instructions: 'Story scene illustration, educational style.' },
  ],
  writing: [
    { name: 'diagram', path: '', instructions: 'Writing diagram with labels, educational style.' },
    { name: 'scene', path: 'scenes', instructions: 'Writing scene illustration, educational style.' },
    { name: 'example', path: 'examples', instructions: 'Writing example illustration, educational style.' },
  ],
};

// Replicate adapter
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

interface ImageConfig {
  subject: string;
  lessonId: string;
  title: string;
  lessonType: string;
  chapter: string;
  basePath: string;
  images: { id: string; type: string; prompt: string; filename: string }[];
}

function findLessonPaths(subject: string): { path: string; lessonId: string; chapter: string }[] {
  const results: { path: string; lessonId: string; chapter: string }[] = [];
  const lessonsDir = join(ROOT, `lq-${subject}`, 'public/data/lessons/en');
  if (!existsSync(lessonsDir)) return results;
  
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith('.json') && entry !== 'chapters.json') {
        try {
          const c = JSON.parse(readFileSync(full, 'utf-8'));
          const id = c.lessons?.[0]?.id;
          if (id) {
            const chapter = dir.split('/').pop() || '';
            results.push({ path: full, lessonId: id, chapter });
          }
        } catch {}
      }
    }
  };
  walk(lessonsDir);
  return results;
}

function findMissingLessonImages(subject: string): { path: string; lessonId: string; chapter: string; config: any }[] {
  const lessons = findLessonPaths(subject);
  const imgDir = join(ROOT, `lq-${subject}`, 'public/images/lessons', `lq-${subject}`);
  const missing: any[] = [];
  
  for (const lesson of lessons) {
    const configPath = join(CONFIG_DIR, subject, lesson.chapter, `${lesson.lessonId}.json`);
    if (!existsSync(configPath)) continue;
    
    const config: ImageConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
    
    // Check which images are missing
    const missingImgs = config.images.filter((img: any) => {
      const imgPath = join(ROOT, `lq-${subject}`, config.basePath, img.filename);
      return !existsSync(imgPath);
    });
    
    if (missingImgs.length > 0) {
      missing.push({ ...lesson, config, missingImgs });
    }
  }
  return missing;
}

function buildPrompt(lesson: any, typeName: string, instructions: string): string {
  const title = lesson.title || '';
  const type = lesson.type || '';
  const content = lesson.content || {};
  const parts = [instructions, `Lesson: ${title}`, `Type: ${type}`];
  return parts.join('. ') + '.';
}

function wireImages(lessonPath: string, wired: { type: string; path: string }[]): void {
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

async function generateForSubject(subject: string, dryRun: boolean) {
  const adapter = new ReplicateAdapter();
  if (!adapter.isAvailable()) {
    console.log(`  SKIP: Replicate not available`);
    return { generated: 0, skipped: 0, cost: 0 };
  }
  
  const missing = findMissingLessonImages(subject);
  if (missing.length === 0) {
    console.log(`  All images exist for ${subject}`);
    return { generated: 0, skipped: 0, cost: 0 };
  }
  
  console.log(`  ${missing.length} lessons need images`);
  if (dryRun) {
    for (const m of missing) {
      for (const img of m.missingImgs) {
        console.log(`  DRY: ${m.lessonId}/${img.filename}`);
      }
    }
    return { generated: 0, skipped: 0, cost: 0 };
  }
  
  let generated = 0, skipped = 0, cost = 0;
  
  for (const m of missing) {
    const wired: { type: string; path: string }[] = [];
    
    for (const img of m.missingImgs) {
      const imgOutDir = join(ROOT, `lq-${subject}`, m.config.basePath);
      const imgPath = join(imgOutDir, img.filename);
      
      if (existsSync(imgPath)) {
        skipped++;
        wired.push({ type: img.type, path: `${m.config.basePath}/${img.filename}` });
        continue;
      }
      
      try {
        console.log(`  GEN ${m.lessonId}/${img.filename}`);
        const buffer = await adapter.generate(img.prompt);
        if (buffer) {
          mkdirSync(imgOutDir, { recursive: true });
          writeFileSync(imgPath, buffer);
          wired.push({ type: img.type, path: `${m.config.basePath}/${img.filename}` });
          generated++;
          cost += adapter.getLastCost();
        }
      } catch (e: any) {
        console.error(`  FAIL ${m.lessonId}/${img.filename}: ${e.message}`);
      }
    }
    
    // Wire whatever we have (even partial)
    if (wired.length > 0) {
      wireImages(m.path, wired);
    }
  }
  
  return { generated, skipped, cost };
}

function parseArgs() {
  const args: { subject?: string; dryRun?: boolean; all?: boolean } = {};
  process.argv.slice(2).forEach(arg => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      if (key === 'subject') args.subject = value;
      else if (key === 'dry-run') args.dryRun = true;
      else if (key === 'all') args.all = true;
    }
  });
  return args;
}

async function main() {
  const args = parseArgs();
  const subjects = args.all ? SUBJECTS : (args.subject ? [args.subject] : []);
  
  if (!subjects.length) {
    console.log(`\nMissing Image Generator`);
    console.log(`Usage:`);
    console.log(`  npx tsx scripts/generate-missing-images.ts --subject=math`);
    console.log(`  npx tsx scripts/generate-missing-images.ts --all`);
    console.log(`  npx tsx scripts/generate-missing-images.ts --subject=math --dry-run`);
    return;
  }
  
  console.log(`\nMissing Image Generator | Mode: ${args.dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Provider: Replicate @ $${REPLICATE_COST}/img\n`);
  
  let totalGen = 0, totalSkip = 0, totalCost = 0;
  
  for (const sub of subjects) {
    console.log(`\n${sub.toUpperCase()}`);
    const result = await generateForSubject(sub, args.dryRun ?? false);
    console.log(`  Generated: ${result.generated} | Skipped: ${result.skipped} | Cost: $${result.cost.toFixed(3)}`);
    totalGen += result.generated;
    totalSkip += result.skipped;
    totalCost += result.cost;
  }
  
  console.log(`\n${'='.repeat(50)}`);
  console.log(`TOTAL: ${totalGen} generated | ${totalSkip} skipped | $${totalCost.toFixed(3)}`);
}

main().catch(console.error);
