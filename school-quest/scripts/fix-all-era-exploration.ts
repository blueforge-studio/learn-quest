#!/usr/bin/env npx tsx
/**
 * Fix ALL ancient/_general/ era-exploration lessons - add all missing required fields
 */

import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BASE = `${ROOT}/lq-history/public/data/lessons/en/ancient/_general`;

function fixEraExploration(filePath: string): boolean {
  const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const lesson = content.lessons?.[0];
  if (!lesson || lesson.type !== 'era-exploration') return false;

  const c = lesson.content;
  let changed = false;

  // Add missing eraName
  if (!c.eraName) {
    c.eraName = lesson.title || c.name || 'Ancient World';
    changed = true;
  }

  // Add period if missing
  if (!c.period) {
    c.period = '3500 BCE – 500 CE';
    changed = true;
  }

  // Add difficulty (keep in content - schema requires it)
  if (!c.difficulty) {
    c.difficulty = lesson.difficulty || 'beginner';
    changed = true;
  }

  // Add sections if missing
  if (!c.sections || c.sections.length === 0) {
    if (Array.isArray(c.achievements)) {
      c.sections = c.achievements.map((a: any, idx: number) => ({
        id: `s${idx + 1}`,
        title: a.title || `Section ${idx + 1}`,
        body: a.description || '',
      }));
      changed = true;
    } else if (Array.isArray(c.stages)) {
      c.sections = c.stages.map((s: any, idx: number) => ({
        id: `s${idx + 1}`,
        title: s.title || `Section ${idx + 1}`,
        body: s.description || '',
      }));
      changed = true;
    } else {
      c.sections = [];
      changed = true;
    }
  }

  // Add keyEvents if missing
  if (!c.keyEvents) {
    c.keyEvents = [];
    changed = true;
  }

  // Fix quiz
  if (Array.isArray(c.quiz)) {
    for (const q of c.quiz) {
      if (q.options && Array.isArray(q.options) && typeof q.correctAnswer === 'string') {
        const idx = q.options.indexOf(q.correctAnswer);
        if (idx >= 0) {
          q.correctAnswer = String(idx);
          changed = true;
        }
      }
    }
  }

  // Clean up (keep difficulty in content)
  delete c.stages;

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

  console.log('Fixing ALL ancient/_general/ era-exploration lessons...\n');

  for (const chapter of chapters) {
    const chapterDir = `${BASE}/${chapter}`;
    if (!fs.existsSync(chapterDir)) continue;

    const files = fs.readdirSync(chapterDir).filter(f => f.endsWith('.json'));

    for (const file of files) {
      const filePath = `${chapterDir}/${file}`;
      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const lesson = content.lessons?.[0];

      if (lesson?.type === 'era-exploration') {
        const c = lesson.content;
        const missing: string[] = [];
        if (!c.eraName) missing.push('eraName');
        if (!c.period) missing.push('period');
        if (!c.difficulty) missing.push('difficulty');
        if (!c.sections || c.sections.length === 0) missing.push('sections');

        if (missing.length > 0) {
          if (fixEraExploration(filePath)) {
            console.log(`FIXED: ${chapter}/${file} (added: ${missing.join(', ')})`);
            fixed++;
          }
        }
      }
    }
  }

  console.log(`\nDone: ${fixed} files fixed`);
}

main();