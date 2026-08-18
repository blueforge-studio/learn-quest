#!/usr/bin/env npx tsx
/**
 * generate-school-images.ts
 *
 * Generates lesson images via configurable provider (Replicate, OpenAI, or Google)
 * and wires the generated image paths back into the lesson JSON files.
 *
 * Usage:
 *   npx tsx scripts/generate-school-images.ts --subject=math --dry-run
 *   npx tsx scripts/generate-school-images.ts --subject=science
 *   npx tsx scripts/generate-school-images.ts --all
 *   npx tsx scripts/generate-school-images.ts --subject=math --model=openai
 *   npx tsx scripts/generate-school-images.ts --subject=math --model=replicate
 *
 * Environment:
 *   IMAGE_PROVIDER     — "replicate" (default), "openai", or "google"
 *   REPLICATE_API_TOKEN — for Replicate Flux Schnell ($0.003/img)
 *   OPENAI_API_KEY     — for OpenAI gpt-image-2
 *   GOOGLE_AI_API_KEY  — for Google Imagen 3
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'fs';
import { join, relative, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = join(fileURLToPath(import.meta.url), '..');
const ROOT = join(__dirname, '..');
const CONFIG_DIR = join(ROOT, 'config/school-quest');
const REPLICATE_COST = 0.003;

// ============= IMAGE PROVIDER INTERFACE =============

type ImageProviderId = 'replicate' | 'openai' | 'google';

interface ImageGenerationResult {
  buffer: Buffer;
  cost: number;
}

interface ImageProvider {
  readonly id: ImageProviderId;
  readonly costPerImage: number;
  isAvailable(): boolean;
  generate(prompt: string, size?: { width: number; height: number }): Promise<ImageGenerationResult>;
}

const DEFAULT_SIZE = { width: 1024, height: 1024 };

// --- Replicate (Flux Schnell, $0.003/img) ---

class ReplicateProvider implements ImageProvider {
  readonly id: ImageProviderId = 'replicate';
  readonly costPerImage = 0.003;
  private token: string;
  private version = 'c846a69991daf4c0e5d016514849d14ee5b2e6846ce6b9d6f21369e564cfe51e';

  constructor() { this.token = process.env.REPLICATE_API_TOKEN || ''; }
  isAvailable(): boolean { return !!this.token; }

  async generate(prompt: string, size = DEFAULT_SIZE): Promise<ImageGenerationResult> {
    const createRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: { Authorization: `Token ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        version: this.version,
        input: { prompt, num_inference_steps: 4, guidance_scale: 0.0, prompt_strength: 0.85, num_outputs: 1 },
      }),
    });
    if (!createRes.ok) { const err = await createRes.text(); throw new Error(`Create failed (${createRes.status}): ${err}`); }
    const prediction: any = await createRes.json();
    const finalPred = await this.poll(prediction.id);
    if (finalPred.status !== 'succeeded') throw new Error(`Prediction failed: ${finalPred.error ?? 'unknown'}`);
    const output = finalPred.output as string[];
    if (!output?.[0]) throw new Error('No output URL');
    const imageRes = await fetch(output[0], { signal: AbortSignal.timeout(30_000) });
    if (!imageRes.ok) throw new Error(`Download failed: ${imageRes.status}`);
    return { buffer: Buffer.from(await imageRes.arrayBuffer()), cost: this.costPerImage };
  }

  private async poll(id: string): Promise<any> {
    const url = `https://api.replicate.com/v1/predictions/${id}`;
    const headers = { Authorization: `Token ${this.token}` };
    const start = Date.now();
    while (Date.now() - start < 60_000) {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw new Error(`Poll failed: ${res.status}`);
      const p: any = await res.json();
      if (p.status === 'succeeded' || p.status === 'failed' || p.status === 'canceled') return p;
      await new Promise(r => setTimeout(r, 500));
    }
    throw new Error('Prediction timed out');
  }
}

// --- OpenAI (gpt-image-2, ~$0.06/medium 1024x1024) ---

class OpenAIProvider implements ImageProvider {
  readonly id: ImageProviderId = 'openai';
  readonly costPerImage = 0.06; // medium quality 1024x1024
  private token: string;

  constructor() { this.token = process.env.OPENAI_API_KEY || ''; }
  isAvailable(): boolean { return !!this.token; }

  async generate(prompt: string, size = DEFAULT_SIZE): Promise<ImageGenerationResult> {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-image-2',
        prompt,
        n: 1,
        size: '1024x1024',
        quality: 'medium',
      }),
    });
    if (!res.ok) { const err = await res.text(); throw new Error(`OpenAI failed (${res.status}): ${err}`); }
    const data: any = await res.json();
    const url = data.data?.[0]?.url;
    if (!url) throw new Error('No image URL in response');
    const imageRes = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!imageRes.ok) throw new Error(`Download failed: ${imageRes.status}`);
    return { buffer: Buffer.from(await imageRes.arrayBuffer()), cost: this.costPerImage };
  }
}

// --- Google ( Imagen 3, Nano Banana) ---

class GoogleProvider implements ImageProvider {
  readonly id: ImageProviderId = 'google';
  readonly costPerImage = 0.0; // Google AI free tier available
  private token: string;

  constructor() { this.token = process.env.GOOGLE_AI_API_KEY || ''; }
  isAvailable(): boolean { return !!this.token; }

  async generate(prompt: string, size = DEFAULT_SIZE): Promise<ImageGenerationResult> {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/imagen-3-generate:generateImage?key=${this.token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, sampleImageWidth: size.width, sampleImageHeight: size.height }),
      }
    );
    if (!res.ok) { const err = await res.text(); throw new Error(`Google failed (${res.status}): ${err}`); }
    const data: any = await res.json();
    const b64 = data.image?.image?.bytesBase64Encoded;
    if (!b64) throw new Error('No image in response');
    return { buffer: Buffer.from(b64, 'base64'), cost: this.costPerImage };
  }
}

function getProvider(preferredId?: ImageProviderId): ImageProvider {
  if (preferredId) {
    const p = providerMap.get(preferredId)!;
    if (p.isAvailable()) return p;
    console.log(`  Provider ${preferredId} not available, trying fallbacks...`);
  }
  for (const p of providerMap.values()) {
    if (p.isAvailable()) return p;
  }
  return providerMap.get('replicate')!; // placeholder for dry-run without tokens
}

const providerMap = new Map<ImageProviderId, ImageProvider>([
  ['replicate', new ReplicateProvider()],
  ['openai', new OpenAIProvider()],
  ['google', new GoogleProvider()],
]);

// ============= TYPES =============

interface ImageConfig {
  subject: string;
  lessonId: string;
  title: string;
  lessonType: string;
  chapter: string;
  basePath: string;
  images: { id: string; type: string; prompt: string; filename: string }[];
}

// ============= WIRING =============

interface WiredImage {
  type: string;
  path: string;
}

function wireImagesToLesson(lessonPath: string, wired: WiredImage[]): void {
  try {
    const content = JSON.parse(readFileSync(lessonPath, 'utf-8'));
    if (!content.lessons?.[0]) return;

    // Determine which field name this subject uses
    // Math: first image is primary illustration
    // Science: diagram is primary
    // Geography: map/landmark
    // Reading: illustration
    // Writing: grammar/scene
    const subject = lessonPath.includes('/lq-math/') ? 'math'
      : lessonPath.includes('/lq-science/') ? 'science'
      : lessonPath.includes('/lq-geography/') ? 'geography'
      : lessonPath.includes('/lq-reading/') ? 'reading'
      : 'writing';

    // Wire images into content object
    const imageMap: Record<string, string> = {};
    for (const img of wired) {
      imageMap[img.type] = img.path;
    }

    // Add primary image field
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

// ============= CONFIG LOADER =============

function loadLessonConfigs(subject: string): ImageConfig[] {
  // Strip lq- prefix for config lookup
  const subjectKey = subject.replace('lq-', '');
  const subjectDir = join(CONFIG_DIR, subjectKey);
  if (!existsSync(subjectDir)) return [];

  const configs: ImageConfig[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (entry.endsWith('.json')) {
        try {
          const cfg = JSON.parse(readFileSync(full, 'utf-8')) as ImageConfig;
          if (cfg.lessonId && cfg.images) configs.push(cfg);
        } catch {}
      }
    }
  };
  walk(subjectDir);
  return configs;
}

// ============= GENERATE =============

async function generateSubjectImages(subject: string, dryRun: boolean, provider: ImageProvider) {
  if (!provider.isAvailable()) {
    console.log(`  SKIP: No image provider available (dry-run anyway)`);
    return { generated: 0, skipped: 0, cost: 0 };
  }

  const configs = loadLessonConfigs(subject);
  if (configs.length === 0) {
    console.log(`  No configs found for ${subject}`);
    return { generated: 0, skipped: 0, cost: 0 };
  }

  console.log(`  ${configs.length} lessons, generating images...`);

  let generated = 0;
  let skipped = 0;
  let cost = 0;

  for (const cfg of configs) {
    // Output dir: subjects/{subject}/public/images/lessons/{subject}/{chapter}
    const imgOutDir = join(
      ROOT, subject, 'public', 'images', 'lessons', subject, cfg.chapter
    );

    const wired: WiredImage[] = [];
    let allSuccess = true;

    for (const img of cfg.images) {
      const imgPath = join(imgOutDir, img.filename);

      // Skip if exists and not overwriting
      if (existsSync(imgPath) && !dryRun) {
        wired.push({ type: img.type, path: `${cfg.basePath}/${img.filename}`.replace('public/', '') });
        skipped++;
        continue;
      }

      if (dryRun) {
        console.log(`  DRY: ${img.prompt.substring(0, 60)}...`);
        wired.push({ type: img.type, path: 'TBD' });
        continue;
      }

      try {
        console.log(`  GEN ${img.filename}: ${img.prompt.substring(0, 50)}...`);
        const result = await provider.generate(img.prompt);
        if (result.buffer) {
          mkdirSync(imgOutDir, { recursive: true });
          writeFileSync(imgPath, result.buffer);
          wired.push({ type: img.type, path: `${cfg.basePath}/${img.filename}`.replace('public/', '') });
          generated++;
          cost += result.cost;
        } else {
          allSuccess = false;
        }
      } catch (e) {
        console.error(`  FAIL ${img.filename}: ${e}`);
        allSuccess = false;
      }
    }

    // Wire images to lesson JSON
    if (!dryRun && wired.length > 0 && allSuccess) {
      const lessonPath = findLessonPath(subject, cfg.lessonId, cfg.chapter);
      if (lessonPath) {
        wireImagesToLesson(lessonPath, wired);
      }
    }
  }

  return { generated, skipped, cost };
}

function findLessonPath(subject: string, lessonId: string, chapter: string): string | null {
  const lessonsDir = join(ROOT, subject, 'public/data/lessons/en', chapter);
  if (!existsSync(lessonsDir)) return null;

  for (const file of readdirSync(lessonsDir)) {
    if (!file.endsWith('.json') || file === 'chapters.json') continue;
    try {
      const content = JSON.parse(readFileSync(join(lessonsDir, file), 'utf-8'));
      if (content.lessons?.[0]?.id === lessonId) {
        return join(lessonsDir, file);
      }
    } catch {}
  }
  return null;
}

// ============= CLI =============

function parseArgs() {
  const args: { subject?: string; dryRun?: boolean; all?: boolean; model?: ImageProviderId } = {};
  process.argv.slice(2).forEach(arg => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      if (key === 'subject') args.subject = value;
      else if (key === 'dry-run') args.dryRun = true;
      else if (key === 'all') args.all = true;
      else if (key === 'model') args.model = value as ImageProviderId;
    }
  });
  return args;
}

async function main() {
  const args = parseArgs();

  const subjects = args.subject
    ? [`lq-${args.subject}`]
    : args.all
      ? ['lq-math', 'lq-science', 'lq-geography', 'lq-reading', 'lq-writing']
      : [];

  if (!subjects.length) {
    console.log(`\nSchool-Quest Image Generator`);
    console.log(`Usage:`);
    console.log(`  npx tsx scripts/generate-school-images.ts --subject=math`);
    console.log(`  npx tsx scripts/generate-school-images.ts --subject=science --dry-run`);
    console.log(`  npx tsx scripts/generate-school-images.ts --all`);
    console.log(`  npx tsx scripts/generate-school-images.ts --subject=math --model=openai`);
    console.log(`  npx tsx scripts/generate-school-images.ts --subject=math --model=google`);
    console.log(`\nProviders: replicate ($0.003/img), openai gpt-image-2 ($0.06/std), google imagen3 (free)`);
    console.log(`Env: IMAGE_PROVIDER, REPLICATE_API_TOKEN, OPENAI_API_KEY, GOOGLE_AI_API_KEY`);
    return;
  }

  const provider = getProvider(args.model);
  console.log(`\nSchool-Quest Image Generator`);
  console.log(`Provider: ${provider.id} @ $${provider.costPerImage}/img | Mode: ${args.dryRun ? 'DRY RUN' : 'LIVE'}\n`);

  let totalGen = 0, totalSkip = 0, totalCost = 0;

  for (const sub of subjects) {
    const subjectKey = sub.replace('lq-', '');
    console.log(`\n${subjectKey.toUpperCase()}`);
    const result = await generateSubjectImages(sub, args.dryRun ?? false, provider);
    console.log(`  Generated: ${result.generated} | Skipped: ${result.skipped} | Cost: $${result.cost.toFixed(3)}`);
    totalGen += result.generated;
    totalSkip += result.skipped;
    totalCost += result.cost;
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`TOTAL: ${totalGen} generated | ${totalSkip} skipped | $${totalCost.toFixed(3)}`);
}

main().catch(console.error);