#!/usr/bin/env npx tsx
/**
 * Fix ancient/_general/ chapter-1 lessons that still have timeline[] instead of events[]
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BASE = `${ROOT}/lq-history/public/data/lessons/en/ancient/_general`;

function parseYear(year: string | number | undefined): number {
  if (!year) return 0;
  if (typeof year === 'number') return year;
  const cleaned = year.replace(/[~,\s]/g, '').replace(/BCE$/i, '-').replace(/CE$/i, '');
  const num = parseInt(cleaned);
  if (isNaN(num)) return 0;
  if (year.toLowerCase().includes('bce') && num > 0) return -num;
  return num;
}

function fixFile(filePath: string): boolean {
  const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const lesson = content.lessons?.[0];
  if (!lesson) return false;

  const c = lesson.content;

  // Only fix timeline type with timeline array
  if (lesson.type !== 'timeline') return false;
  if (!Array.isArray(c.timeline)) return false;
  if (Array.isArray(c.events)) return false; // Already fixed

  // Convert timeline to events
  c.events = c.timeline.map((item: any, idx: number) => ({
    id: `e${idx + 1}`,
    date: String(item.year || ''),
    year: parseYear(item.year),
    title: item.title || '',
    description: item.description || '',
    significance: item.explanation || item.hint || '',
    category: 'history'
  }));
  delete c.timeline;

  // Ensure required fields
  if (!c.intro && c.introduction) {
    c.intro = c.introduction;
    delete c.introduction;
  }
  if (!c.intro) c.intro = '';
  if (!c.period) c.period = '';
  if (!c.mode) c.mode = 'explore';

  // Fix quiz format
  if (Array.isArray(c.quiz)) {
    for (const q of c.quiz) {
      if (q.options && Array.isArray(q.options) && typeof q.correctAnswer === 'string') {
        const idx = q.options.indexOf(q.correctAnswer);
        if (idx >= 0) q.correctAnswer = String(idx);
      }
    }
  }

  // Clean up
  delete c.conclusion;
  delete c.title;
  delete c.introduction;
  delete c.difficulty;

  lesson.updatedAt = new Date().toISOString();
  lesson.lastChangeType = 'content';

  fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
  return true;
}

function main() {
  const chapters = ['chapter-1', 'chapter-2', 'chapter-3', 'chapter-4', 'chapter-5'];
  let fixedCount = 0;

  console.log('Fixing ancient/_general/ chapter-1 timeline lessons...\n');

  for (const chapter of chapters) {
    const chapterDir = `${BASE}/${chapter}`;
    if (!fs.existsSync(chapterDir)) continue;

    const files = fs.readdirSync(chapterDir).filter(f => f.endsWith('.json'));

    for (const file of files) {
      const filePath = `${chapterDir}/${file}`;
      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const c = content.lessons?.[0]?.content;

      if (content.lessons?.[0]?.type === 'timeline' && Array.isArray(c?.timeline) && !Array.isArray(c?.events)) {
        if (fixFile(filePath)) {
          console.log(`FIXED: ${chapter}/${file}`);
          fixedCount++;
        }
      }
    }
  }

  console.log(`\nDone: ${fixedCount} files fixed`);
}

main();