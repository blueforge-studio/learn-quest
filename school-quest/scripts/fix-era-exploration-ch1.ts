#!/usr/bin/env npx tsx
/**
 * Fix ancient/_general/ chapter-1 era-exploration lessons - add missing required fields
 */

import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BASE = `${ROOT}/lq-history/public/data/lessons/en/ancient/_general`;

function fixEraExplorationChapter1(filePath: string): boolean {
  const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const lesson = content.lessons?.[0];
  if (!lesson || lesson.type !== 'era-exploration') return false;

  const c = lesson.content;

  // Add missing eraName (derived from title or name)
  if (!c.eraName) {
    c.eraName = lesson.title || c.name || 'Ancient World';
  }

  // Add period if missing
  if (!c.period) {
    c.period = '3500 BCE – 500 CE';
  }

  // Add sections if missing (create from available content)
  if (!c.sections || c.sections.length === 0) {
    // Use achievements or other content to create sections
    if (Array.isArray(c.achievements)) {
      c.sections = c.achievements.map((a: any, idx: number) => ({
        id: `s${idx + 1}`,
        title: a.title || `Section ${idx + 1}`,
        body: a.description || '',
      }));
    }
  }

  // Ensure sections is always an array
  if (!c.sections) c.sections = [];

  // Add keyEvents if missing
  if (!c.keyEvents) c.keyEvents = [];

  // Fix quiz
  if (Array.isArray(c.quiz)) {
    for (const q of c.quiz) {
      if (q.options && Array.isArray(q.options) && typeof q.correctAnswer === 'string') {
        const idx = q.options.indexOf(q.correctAnswer);
        if (idx >= 0) q.correctAnswer = String(idx);
      }
    }
  }

  lesson.updatedAt = new Date().toISOString();
  lesson.lastChangeType = 'content';

  fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
  return true;
}

function main() {
  const chapter1Dir = `${BASE}/chapter-1`;
  if (!fs.existsSync(chapter1Dir)) {
    console.log('chapter-1 directory not found');
    return;
  }

  const files = fs.readdirSync(chapter1Dir).filter(f => f.endsWith('.json'));
  let fixed = 0;

  console.log('Fixing era-exploration chapter-1 lessons...\n');

  for (const file of files) {
    const filePath = `${chapter1Dir}/${file}`;
    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const lesson = content.lessons?.[0];

    if (lesson?.type === 'era-exploration') {
      const c = lesson.content;
      const missing: string[] = [];
      if (!c.eraName) missing.push('eraName');
      if (!c.period) missing.push('period');
      if (!c.sections || c.sections.length === 0) missing.push('sections');

      if (missing.length > 0) {
        if (fixEraExplorationChapter1(filePath)) {
          console.log(`FIXED: ${file} (added: ${missing.join(', ')})`);
          fixed++;
        }
      }
    }
  }

  console.log(`\nDone: ${fixed} files fixed`);
}

main();