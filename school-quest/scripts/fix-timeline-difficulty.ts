#!/usr/bin/env npx tsx
/**
 * Fix ALL ancient/_general/ timeline lessons - add difficulty
 */

import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BASE = `${ROOT}/lq-history/public/data/lessons/en/ancient/_general`;

function fixTimeline(filePath: string): boolean {
  const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const lesson = content.lessons?.[0];
  if (!lesson || lesson.type !== 'timeline') return false;

  const c = lesson.content;
  let changed = false;

  // Add difficulty
  if (!c.difficulty) {
    c.difficulty = lesson.difficulty || 'beginner';
    changed = true;
  }

  if (changed) {
    lesson.updatedAt = new Date().toISOString();
    lesson.lastChangeType = 'content';
    fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
  }

  return changed;
}

function main() {
  const chapters = ['chapter-1', 'chapter-2', 'chapter-3', 'chapter-4', 'chapter-5'];
  let fixed = 0;

  console.log('Fixing ancient/_general/ timeline lessons...\n');

  for (const chapter of chapters) {
    const chapterDir = `${BASE}/${chapter}`;
    if (!fs.existsSync(chapterDir)) continue;

    const files = fs.readdirSync(chapterDir).filter(f => f.endsWith('.json'));

    for (const file of files) {
      const filePath = `${chapterDir}/${file}`;
      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const lesson = content.lessons?.[0];

      if (lesson?.type === 'timeline' && !lesson.content?.difficulty) {
        if (fixTimeline(filePath)) {
          console.log(`FIXED: ${chapter}/${file} (added difficulty)`);
          fixed++;
        }
      }
    }
  }

  console.log(`\nDone: ${fixed} files fixed`);
}

main();