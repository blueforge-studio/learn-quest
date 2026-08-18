#!/usr/bin/env npx tsx
/**
 * Comprehensive content audit across all school-quest subjects.
 * Reports: lesson counts, chapter coverage, image/audio coverage, type distribution, gaps.
 *
 * Usage:
 *   npx tsx scripts/audit-content.ts
 *   npx tsx scripts/audit-content.ts --subject=math
 *   npx tsx scripts/audit-content.ts --json
 */

import { readdirSync, readFileSync, existsSync, statSync } from 'fs';
import { join, dirname, relative } from 'path';

const ROOT = dirname(dirname(new URL(import.meta.url).pathname));
const SUBJECT_FILTER = process.argv.find(a => a.startsWith('--subject='))?.split('=')[1];
const JSON_OUTPUT = process.argv.includes('--json');

interface LessonInfo {
  id: string;
  title: string;
  type: string;
  difficulty?: string;
  chapter: string;
  category?: string;
  source: 'content' | 'public';
  hasImage: boolean;
  hasAudio: boolean;
  file: string;
}

interface SubjectAudit {
  subject: string;
  totalLessons: number;
  contentLessons: number;
  publicLessons: number;
  chapters: number;
  categories: string[];
  typeDistribution: Record<string, number>;
  difficultyDistribution: Record<string, number>;
  imageCount: number;
  audioCount: number;
  imageCoverage: number;
  audioCoverage: number;
  gaps: string[];
  lessons: LessonInfo[];
}

function findJsonFiles(dir: string): string[] {
  const results: string[] = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) results.push(...findJsonFiles(full));
    else if (entry.name.endsWith('.json') && !entry.name.startsWith('chapter') && entry.name !== 'index.json' && dir.includes('lessons')) {
      results.push(full);
    }
  }
  return results;
}

function auditSubject(subject: string): SubjectAudit {
  const appDir = join(ROOT, `lq-${subject}`);
  const lessons: LessonInfo[] = [];
  const types: Record<string, number> = {};
  const difficulties: Record<string, number> = {};
  const categories = new Set<string>();
  const chapters = new Set<string>();

  // Count assets
  const imageDir = join(appDir, 'public', 'images', 'lessons');
  const audioDir = join(appDir, 'public', 'audio', 'lessons');
  const imageFiles = new Set<string>();
  const audioFiles = new Set<string>();

  if (existsSync(imageDir)) {
    findAllFiles(imageDir, '.webp').forEach(f => imageFiles.add(f.replace('.webp', '')));
    findAllFiles(imageDir, '.png').forEach(f => imageFiles.add(f.replace('.png', '')));
  }
  if (existsSync(audioDir)) {
    findAllFiles(audioDir, '.mp3').forEach(f => audioFiles.add(f));
  }

  // Scan lessons
  for (const source of ['content', 'public'] as const) {
    const baseDir = source === 'content'
      ? join(appDir, 'content')
      : join(appDir, 'public', 'data', 'lessons');
    const files = findJsonFiles(baseDir);

    for (const file of files) {
      try {
        const data = JSON.parse(readFileSync(file, 'utf-8'));
        const lessonList = data.lessons ?? [data];
        for (const lesson of lessonList) {
          if (!lesson.id || !lesson.type) continue;
          const relPath = relative(appDir, file);
          const chapterMatch = relPath.match(/chapter-(\d+)/);
          const chapter = chapterMatch ? `chapter-${chapterMatch[1]}` : 'unknown';
          const categoryMatch = relPath.match(/content\/([^/]+)\//);
          const category = categoryMatch ? categoryMatch[1] : undefined;

          chapters.add(chapter);
          if (category) categories.add(category);
          types[lesson.type] = (types[lesson.type] || 0) + 1;
          if (lesson.difficulty) difficulties[lesson.difficulty] = (difficulties[lesson.difficulty] || 0) + 1;

          const hasImage = imageFiles.has(lesson.id) || [...imageFiles].some(f => f.includes(lesson.id));
          const hasAudio = [...audioFiles].some(f => f.includes(lesson.id));

          lessons.push({
            id: lesson.id,
            title: lesson.title || lesson.id,
            type: lesson.type,
            difficulty: lesson.difficulty,
            chapter,
            category,
            source,
            hasImage,
            hasAudio,
            file: relPath,
          });
        }
      } catch { /* skip invalid */ }
    }
  }

  // Identify gaps
  const gaps: string[] = [];
  const lessonsPerChapter: Record<string, number> = {};
  for (const l of lessons) {
    lessonsPerChapter[l.chapter] = (lessonsPerChapter[l.chapter] || 0) + 1;
  }
  for (const [ch, count] of Object.entries(lessonsPerChapter)) {
    if (count < 5) gaps.push(`${ch}: only ${count} lessons (target: 5+)`);
  }

  // Check for empty content categories
  if (existsSync(join(appDir, 'content'))) {
    for (const cat of readdirSync(join(appDir, 'content'), { withFileTypes: true })) {
      if (!cat.isDirectory()) continue;
      const catLessons = lessons.filter(l => l.category === cat.name);
      if (catLessons.length === 0) gaps.push(`category "${cat.name}": 0 lessons`);
      else if (catLessons.length < 3) gaps.push(`category "${cat.name}": only ${catLessons.length} lessons`);
    }
  }

  const lessonsWithoutImage = lessons.filter(l => !l.hasImage);
  const lessonsWithoutAudio = lessons.filter(l => !l.hasAudio);
  if (lessonsWithoutImage.length > 0) gaps.push(`${lessonsWithoutImage.length} lessons missing images`);
  if (lessonsWithoutAudio.length > 0) gaps.push(`${lessonsWithoutAudio.length} lessons missing audio`);

  return {
    subject,
    totalLessons: lessons.length,
    contentLessons: lessons.filter(l => l.source === 'content').length,
    publicLessons: lessons.filter(l => l.source === 'public').length,
    chapters: chapters.size,
    categories: [...categories],
    typeDistribution: types,
    difficultyDistribution: difficulties,
    imageCount: imageFiles.size,
    audioCount: audioFiles.size,
    imageCoverage: lessons.length > 0 ? Math.round((lessons.filter(l => l.hasImage).length / lessons.length) * 100) : 0,
    audioCoverage: lessons.length > 0 ? Math.round((lessons.filter(l => l.hasAudio).length / lessons.length) * 100) : 0,
    gaps,
    lessons,
  };
}

function findAllFiles(dir: string, ext: string): string[] {
  const results: string[] = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) results.push(...findAllFiles(full, ext));
    else if (entry.name.endsWith(ext)) results.push(entry.name.replace(ext, ''));
  }
  return results;
}

// Main
const subjects = SUBJECT_FILTER
  ? [SUBJECT_FILTER]
  : readdirSync(ROOT).filter(d => d.startsWith('lq-') && statSync(join(ROOT, d)).isDirectory()).map(d => d.replace('lq-', ''));

const audits = subjects.map(auditSubject);

if (JSON_OUTPUT) {
  console.log(JSON.stringify(audits, null, 2));
  process.exit(0);
}

// Pretty print
console.log('\n=== SCHOOL-QUEST CONTENT AUDIT ===\n');

for (const a of audits) {
  console.log(`--- ${a.subject.toUpperCase()} ---`);
  console.log(`  Lessons: ${a.totalLessons} total (${a.contentLessons} content/ + ${a.publicLessons} public/)`);
  console.log(`  Chapters: ${a.chapters} | Categories: ${a.categories.join(', ') || 'none'}`);
  console.log(`  Types: ${Object.entries(a.typeDistribution).map(([t, n]) => `${t}(${n})`).join(', ')}`);
  console.log(`  Difficulty: ${Object.entries(a.difficultyDistribution).map(([d, n]) => `${d}(${n})`).join(', ') || 'none'}`);
  console.log(`  Images: ${a.imageCount} files (${a.imageCoverage}% coverage)`);
  console.log(`  Audio: ${a.audioCount} files (${a.audioCoverage}% coverage)`);
  if (a.gaps.length > 0) {
    console.log(`  GAPS:`);
    for (const gap of a.gaps) console.log(`    - ${gap}`);
  } else {
    console.log(`  No gaps detected`);
  }
  console.log('');
}

// Summary
const totalLessons = audits.reduce((s, a) => s + a.totalLessons, 0);
const totalImages = audits.reduce((s, a) => s + a.imageCount, 0);
const totalAudio = audits.reduce((s, a) => s + a.audioCount, 0);
const totalGaps = audits.reduce((s, a) => s + a.gaps.length, 0);
console.log('=== SUMMARY ===');
console.log(`Total: ${totalLessons} lessons | ${totalImages} images | ${totalAudio} audio clips | ${totalGaps} gaps`);
