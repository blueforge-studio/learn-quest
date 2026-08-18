#!/usr/bin/env npx tsx
/**
 * Generate TTS audio for school-quest lesson content using Python edge-tts CLI (free).
 *
 * Usage:
 *   npx tsx scripts/generate-lesson-audio.ts --dry-run --all
 *   npx tsx scripts/generate-lesson-audio.ts --subject=math --limit=5
 *   npx tsx scripts/generate-lesson-audio.ts --all
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
const WATCH = process.argv.includes('--watch');
const WATCH_INTERVAL = parseInt(process.argv.find(a => a.startsWith('--watch-interval='))?.split('=')[1] ?? '5') * 1000;

if (!ALL && !SUBJECT) {
  console.error('Usage: --subject=<name> [--limit=<n>] [--voice=<name>] [--dry-run] [--watch]');
  console.error('       --all [--limit=<n>] [--dry-run] [--watch] [--watch-interval=<secs>]');
  process.exit(1);
}

// Verify edge-tts is available
try {
  execFileSync('edge-tts', ['--version'], { stdio: 'pipe' });
} catch {
  console.error('Python edge-tts not found. Install: pip3 install edge-tts');
  process.exit(1);
}

interface AudioJob {
  lessonId: string;
  subject: string;
  field: string;
  text: string;
  outputPath: string;
}

function extractTextFields(lesson: Record<string, any>): { field: string; text: string }[] {
  const fields: { field: string; text: string }[] = [];
  const content = lesson.content;
  if (!content) return fields;

  if (content.intro && content.intro.length > 10) {
    fields.push({ field: 'intro', text: content.intro });
  }
  if (content.essentialQuestion) {
    fields.push({ field: 'essential-question', text: content.essentialQuestion });
  }
  if (content.summary && content.summary.length > 10) {
    fields.push({ field: 'summary', text: content.summary });
  }

  return fields;
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

function collectJobs(subject: string): AudioJob[] {
  const appDir = join(ROOT, `lq-${subject}`);
  const audioDir = join(appDir, 'public', 'audio', 'lessons');
  const jobs: AudioJob[] = [];

  const contentDir = join(appDir, 'content');
  const publicDir = join(appDir, 'public', 'data', 'lessons');
  const lessonFiles = [...findLessonFiles(contentDir), ...findLessonFiles(publicDir)];

  for (const file of lessonFiles) {
    try {
      const data = JSON.parse(readFileSync(file, 'utf-8'));
      const lessons = data.lessons ?? [data];
      for (const lesson of lessons) {
        if (!lesson.id) continue;
        const textFields = extractTextFields(lesson);
        for (const { field, text } of textFields) {
          const outFile = join(audioDir, `${lesson.id}-${field}.mp3`);
          if (existsSync(outFile)) continue;
          jobs.push({ lessonId: lesson.id, subject, field, text, outputPath: outFile });
        }
      }
    } catch { /* skip */ }
  }
  return jobs;
}

function generateAudio(text: string, outputPath: string, voice: string): boolean {
  mkdirSync(dirname(outputPath), { recursive: true });
  const tmpText = join('/tmp', `tts-${Date.now()}.txt`);
  writeFileSync(tmpText, text);
  try {
    execFileSync('edge-tts', [
      '--voice', voice,
      '--rate', '+0%',
      '--file', tmpText,
      '--write-media', outputPath,
    ], { stdio: 'pipe', timeout: 30000 });
    try { unlinkSync(tmpText); } catch {}
    return existsSync(outputPath);
  } catch (e) {
    try { unlinkSync(tmpText); } catch {}
    throw e;
  }
}

// Main
const subjects = ALL
  ? readdirSync(ROOT).filter(d => d.startsWith('lq-') && statSync(join(ROOT, d)).isDirectory()).map(d => d.replace('lq-', ''))
  : [SUBJECT!];

let allJobs: AudioJob[] = [];
for (const subject of subjects) {
  allJobs.push(...collectJobs(subject));
}
allJobs = allJobs.slice(0, LIMIT);

console.log(`\nAudio generation plan:`);
console.log(`  Subjects: ${subjects.join(', ')}`);
console.log(`  Clips to generate: ${allJobs.length}`);
console.log(`  Voice: ${VOICE}`);
console.log(`  Provider: Python edge-tts (free)`);

const bySubject = new Map<string, number>();
for (const job of allJobs) {
  bySubject.set(job.subject, (bySubject.get(job.subject) || 0) + 1);
}
for (const [subj, count] of bySubject) {
  console.log(`    ${subj}: ${count} clips`);
}

if (allJobs.length === 0) {
  console.log('\nNo audio to generate!');
  process.exit(0);
}

if (DRY_RUN) {
  console.log('\nSample:');
  for (const job of allJobs.slice(0, 5)) {
    console.log(`  [${job.subject}] ${job.lessonId}-${job.field}: "${job.text.slice(0, 80)}..."`);
  }
  if (allJobs.length > 5) console.log(`  ... and ${allJobs.length - 5} more`);
  console.log('\n--dry-run: no audio generated');
  process.exit(0);
}

console.log(`\nGenerating ${allJobs.length} audio clips...\n`);

let generated = 0, failed = 0;
const startTime = Date.now();
let lastLogTime = startTime;

function logProgress(i: number, job: AudioJob, status: string) {
  const now = Date.now();
  const pct = Math.round(((i + 1) / allJobs.length) * 100);
  const elapsed = Math.round((now - startTime) / 1000);

  if (WATCH) {
    // In watch mode, print progress every WATCH_INTERVAL seconds
    if (now - lastLogTime >= WATCH_INTERVAL || status.includes('ok') || status.includes('FAILED')) {
      const eta = Math.round(((allJobs.length - i - 1) * (now - startTime) / (i + 1)) / 1000);
      const etaStr = eta < 60 ? `${eta}s` : `${Math.floor(eta / 60)}m${eta % 60}s`;
      console.log(`  [${elapsed}s] ${pct}% [${i + 1}/${allJobs.length}] ${job.subject}/${job.lessonId}-${job.field}... ${status} ETA ${etaStr}`);
      lastLogTime = now;
    }
  } else {
    console.log(`  ${pct}% [${i + 1}/${allJobs.length}] ${job.subject}/${job.lessonId}-${job.field}... ${status}`);
  }
}

for (let i = 0; i < allJobs.length; i++) {
  const job = allJobs[i];

  try {
    const ok = generateAudio(job.text, job.outputPath, VOICE);
    if (ok) {
      generated++;
      logProgress(i, job, 'ok');
    } else {
      failed++;
      logProgress(i, job, 'FAILED (no output)');
    }
  } catch (e) {
    failed++;
    logProgress(i, job, `FAILED: ${e instanceof Error ? e.message : String(e)}`);
  }
}

const elapsed = Math.round((Date.now() - startTime) / 1000);
console.log(`\nResults: ${generated} generated, ${failed} failed (${elapsed}s)`);
console.log(`Cost: $0.00 (Edge TTS is free)`);
