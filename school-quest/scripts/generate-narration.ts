#!/usr/bin/env npx tsx
/**
 * Generate full narration audio for narrative lesson types.
 * Extracts all story/informational text, concatenates per lesson, generates MP3 via Edge TTS.
 *
 * Usage:
 *   npx tsx scripts/generate-narration.ts --dry-run --all
 *   npx tsx scripts/generate-narration.ts --subject=history
 *   npx tsx scripts/generate-narration.ts --all --limit=50
 *   npx tsx scripts/generate-narration.ts --subject=science --voice=en-US-GuyNeural
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { execFileSync } from 'child_process';

const ROOT = dirname(dirname(new URL(import.meta.url).pathname));
const DRY_RUN = process.argv.includes('--dry-run');
const SUBJECT = process.argv.find(a => a.startsWith('--subject='))?.split('=')[1];
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] ?? '0') || Infinity;
const ALL = process.argv.includes('--all');
const VOICE = process.argv.find(a => a.startsWith('--voice='))?.split('=')[1] ?? 'en-GB-SoniaNeural';

if (!ALL && !SUBJECT) {
  console.error('Usage: --subject=<name> [--limit=<n>] [--voice=<name>] [--dry-run]');
  console.error('       --all [--limit=<n>] [--dry-run]');
  process.exit(1);
}

// Verify edge-tts
try { execFileSync('edge-tts', ['--version'], { stdio: 'pipe' }); }
catch { console.error('Python edge-tts not found. Install: pip3 install edge-tts'); process.exit(1); }

// --- Narrative types and text extraction ---

const NARRATIVE_TYPES = new Set([
  'era-exploration', 'historical-figure', 'timeline',
  'science-concept', 'region-profile',
  'interactive-story', 'fluency', 'comprehension',
  'experiment',
]);

function extractNarrationText(lesson: Record<string, any>): string | null {
  if (!NARRATIVE_TYPES.has(lesson.type)) return null;
  const content = lesson.content;
  if (!content) return null;

  const parts: string[] = [];

  // Title
  if (lesson.title) parts.push(lesson.title + '.');

  // Intro / background
  if (content.intro && content.intro.length > 10) parts.push(content.intro);
  if (content.background) parts.push(content.background);
  if (content.essentialQuestion) parts.push(content.essentialQuestion);

  // Sections (era-exploration, science-concept, region-profile)
  if (Array.isArray(content.sections)) {
    for (const s of content.sections) {
      if (s.title) parts.push(s.title + '.');
      if (s.body) parts.push(s.body);
    }
  }

  // Events (timeline)
  if (Array.isArray(content.events)) {
    for (const e of content.events) {
      const date = e.date || e.year;
      parts.push(`${date ? date + ': ' : ''}${e.title}. ${e.description}`);
    }
  }

  // Key events (era-exploration)
  if (Array.isArray(content.keyEvents)) {
    parts.push('Key events:');
    for (const e of content.keyEvents) {
      parts.push(`${e.year ? e.year + ': ' : ''}${e.title}. ${e.description}`);
    }
  }

  // Achievements (historical-figure)
  if (Array.isArray(content.achievements)) {
    parts.push('Key achievements:');
    for (const a of content.achievements) {
      parts.push(`${a.title}. ${a.description}`);
    }
  }

  // Historical context + legacy (historical-figure)
  if (content.historicalContext) parts.push(content.historicalContext);
  if (content.legacy) parts.push(content.legacy);

  // Quote (historical-figure)
  if (content.quote?.text) parts.push(`Quote: "${content.quote.text}"`);

  // Culture (era-exploration)
  if (content.culture) {
    const c = content.culture;
    if (c.art) parts.push('Art: ' + c.art);
    if (c.technology) parts.push('Technology: ' + c.technology);
    if (c.dailyLife) parts.push('Daily life: ' + c.dailyLife);
  }

  // Scenes (interactive-story)
  if (Array.isArray(content.scenes)) {
    for (const scene of content.scenes) {
      if (scene.text) parts.push(scene.text);
    }
  }

  // Passages (fluency)
  if (Array.isArray(content.passages)) {
    for (const p of content.passages) {
      if (p.title) parts.push(p.title + '.');
      if (p.text) parts.push(p.text);
    }
  }

  // Hypothesis, conclusion, procedure (experiment)
  if (content.hypothesis) parts.push('Hypothesis: ' + content.hypothesis);
  if (Array.isArray(content.procedure)) {
    parts.push('Procedure:');
    for (const step of content.procedure) {
      if (step.instruction) parts.push(step.instruction);
    }
  }
  if (content.conclusion) parts.push('Conclusion: ' + content.conclusion);

  // Fun facts
  if (Array.isArray(content.funFacts)) {
    parts.push('Fun facts:');
    for (const f of content.funFacts) parts.push(f);
  }

  // Summary
  if (content.summary) parts.push(content.summary);
  // Moral (interactive-story)
  if (content.moral) parts.push('Moral: ' + content.moral);

  const text = parts.filter(Boolean).join('\n\n');
  return text.length > 50 ? text : null; // Skip very short content
}

// --- Job collection ---

interface NarrationJob {
  lessonId: string;
  subject: string;
  text: string;
  outputPath: string;
  wordCount: number;
}

function findLessonFiles(dir: string): string[] {
  const results: string[] = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) results.push(...findLessonFiles(full));
    else if (entry.name.endsWith('.json') && !entry.name.startsWith('chapter') && entry.name !== 'index.json') {
      results.push(full);
    }
  }
  return results;
}

function collectJobs(subject: string): NarrationJob[] {
  const appDir = join(ROOT, `lq-${subject}`);
  const audioDir = join(appDir, 'public', 'audio', 'narration');
  const jobs: NarrationJob[] = [];

  const lessonFiles = [
    ...findLessonFiles(join(appDir, 'public', 'data', 'lessons')),
    ...findLessonFiles(join(appDir, 'content')),
  ];

  for (const file of lessonFiles) {
    try {
      const data = JSON.parse(readFileSync(file, 'utf-8'));
      for (const lesson of (data.lessons ?? [data])) {
        if (!lesson.id || !lesson.type) continue;
        const outFile = join(audioDir, `${lesson.id}.mp3`);
        if (existsSync(outFile)) continue;
        const text = extractNarrationText(lesson);
        if (!text) continue;
        jobs.push({
          lessonId: lesson.id,
          subject,
          text,
          outputPath: outFile,
          wordCount: text.split(/\s+/).length,
        });
      }
    } catch { /* skip */ }
  }
  return jobs;
}

function generateAudio(text: string, outputPath: string): boolean {
  mkdirSync(dirname(outputPath), { recursive: true });
  const tmpText = join('/tmp', `narration-${Date.now()}.txt`);
  const tmpRaw = join('/tmp', `narration-raw-${Date.now()}.mp3`);
  writeFileSync(tmpText, text);
  try {
    // Generate with Edge TTS
    execFileSync('edge-tts', [
      '--voice', VOICE, '--rate', '-5%', '--file', tmpText, '--write-media', tmpRaw,
    ], { stdio: 'pipe', timeout: 60000 });
    // Re-encode to 32kbps mono for ~33% size savings (still clear for speech)
    try {
      execFileSync('ffmpeg', [
        '-y', '-i', tmpRaw, '-b:a', '32k', '-ac', '1', '-ar', '22050', outputPath,
      ], { stdio: 'pipe', timeout: 30000 });
      try { unlinkSync(tmpRaw); } catch {}
    } catch {
      // ffmpeg not available — use raw output
      const { renameSync } = require('fs');
      renameSync(tmpRaw, outputPath);
    }
    try { unlinkSync(tmpText); } catch {}
    return existsSync(outputPath);
  } catch (e) {
    try { unlinkSync(tmpText); } catch {}
    throw e;
  }
}

// --- Main ---

const subjects = ALL
  ? readdirSync(ROOT).filter(d => d.startsWith('lq-') && statSync(join(ROOT, d)).isDirectory()).map(d => d.replace('lq-', ''))
  : [SUBJECT!];

let allJobs: NarrationJob[] = [];
for (const s of subjects) allJobs.push(...collectJobs(s));
allJobs = allJobs.slice(0, LIMIT);

const totalWords = allJobs.reduce((s, j) => s + j.wordCount, 0);
const estMinutes = Math.round(totalWords / 150); // ~150 wpm narration

console.log(`\nNarration generation plan:`);
console.log(`  Subjects: ${subjects.join(', ')}`);
console.log(`  Lessons to narrate: ${allJobs.length}`);
console.log(`  Total words: ${totalWords.toLocaleString()} (~${estMinutes} min of audio)`);
console.log(`  Voice: ${VOICE}`);
console.log(`  Cost: $0.00 (Edge TTS is free)`);

const bySubject = new Map<string, number>();
for (const j of allJobs) bySubject.set(j.subject, (bySubject.get(j.subject) || 0) + 1);
for (const [s, c] of bySubject) console.log(`    ${s}: ${c} narrations`);

if (allJobs.length === 0) { console.log('\nNothing to narrate!'); process.exit(0); }

if (DRY_RUN) {
  console.log('\nSample:');
  for (const j of allJobs.slice(0, 5)) {
    console.log(`  [${j.subject}] ${j.lessonId} (${j.wordCount} words): "${j.text.slice(0, 80)}..."`);
  }
  if (allJobs.length > 5) console.log(`  ... and ${allJobs.length - 5} more`);
  console.log('\n--dry-run: no audio generated');
  process.exit(0);
}

console.log(`\nGenerating ${allJobs.length} narrations...\n`);

let generated = 0, failed = 0;
const startTime = Date.now();

for (let i = 0; i < allJobs.length; i++) {
  const job = allJobs[i];
  const pct = Math.round(((i + 1) / allJobs.length) * 100);
  process.stdout.write(`  ${pct}% [${i + 1}/${allJobs.length}] ${job.subject}/${job.lessonId} (${job.wordCount}w)... `);

  try {
    if (generateAudio(job.text, job.outputPath)) {
      generated++;
      console.log('ok');
    } else {
      failed++;
      console.log('FAILED (no output)');
    }
  } catch (e) {
    failed++;
    console.log(`FAILED: ${e instanceof Error ? e.message : String(e)}`);
  }
}

const elapsed = Math.round((Date.now() - startTime) / 1000);
console.log(`\nResults: ${generated} narrations, ${failed} failed (${elapsed}s)`);
console.log(`Estimated audio: ~${estMinutes} minutes | Cost: $0.00`);
