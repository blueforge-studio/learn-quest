#!/usr/bin/env npx tsx
/**
 * Fix ancient/_general/ chapter-1 lessons that have wrong type or content structure
 */

import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from 'path';

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

function fixFirstCivilizations(filePath: string): boolean {
  const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const lesson = content.lessons?.[0];
  if (!lesson) return false;

  const c = lesson.content;

  // Convert stages to sections for era-exploration
  if (Array.isArray(c.stages)) {
    c.sections = c.stages.map((stage: any, idx: number) => ({
      id: `s${idx + 1}`,
      title: stage.title || `Section ${idx + 1}`,
      body: stage.description || '',
    }));
    delete c.stages;
  }

  // Ensure required era-exploration fields
  if (!c.intro && c.introduction) {
    c.intro = c.introduction;
    delete c.introduction;
  }
  if (!c.intro) c.intro = '';
  if (!c.period) c.period = '';
  if (!c.sections) c.sections = [];
  if (!c.quiz) c.quiz = [];
  if (!c.keyEvents) c.keyEvents = [];

  // Clean up
  delete c.difficulty;
  delete c.stages;
  delete c.timeline;

  // Fix quiz
  if (Array.isArray(c.quiz)) {
    for (const q of c.quiz) {
      if (q.options && Array.isArray(q.options) && typeof q.correctAnswer === 'string') {
        const idx = q.options.indexOf(q.correctAnswer);
        if (idx >= 0) q.correctAnswer = String(idx);
      }
    }
  }

  // Change type to era-exploration
  lesson.type = 'era-exploration';
  lesson.updatedAt = new Date().toISOString();
  lesson.lastChangeType = 'content';

  fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
  return true;
}

function fixFallOfEmpires(filePath: string): boolean {
  const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const lesson = content.lessons?.[0];
  if (!lesson) return false;

  const c = lesson.content;

  // Has achievements - already valid for era-exploration
  // Just need to ensure all required fields
  if (!c.intro && c.introduction) {
    c.intro = c.introduction;
    delete c.introduction;
  }
  if (!c.intro) c.intro = '';
  if (!c.period) c.period = '';
  if (!c.sections) c.sections = [];
  if (!c.quiz) c.quiz = [];
  if (!c.keyEvents) c.keyEvents = [];

  // Clean up
  delete c.difficulty;
  delete c.stages;
  delete c.timeline;

  // Fix quiz
  if (Array.isArray(c.quiz)) {
    for (const q of c.quiz) {
      if (q.options && Array.isArray(q.options) && typeof q.correctAnswer === 'string') {
        const idx = q.options.indexOf(q.correctAnswer);
        if (idx >= 0) q.correctAnswer = String(idx);
      }
    }
  }

  // Change type to era-exploration (since it has achievements, not events)
  lesson.type = 'era-exploration';
  lesson.updatedAt = new Date().toISOString();
  lesson.lastChangeType = 'content';

  fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
  return true;
}

function main() {
  let fixed = 0;

  // first-civilizations.json has stages -> era-exploration with sections
  const fc = `${BASE}/chapter-1/first-civilizations.json`;
  if (fs.existsSync(fc)) {
    const d = JSON.parse(fs.readFileSync(fc, 'utf-8'));
    if (d.lessons?.[0]?.type === 'timeline' && d.lessons?.[0]?.content?.stages) {
      if (fixFirstCivilizations(fc)) {
        console.log('FIXED: chapter-1/first-civilizations.json (timeline→era-exploration, stages→sections)');
        fixed++;
      }
    }
  }

  // fall-of-empires.json has achievements -> era-exploration
  const foe = `${BASE}/chapter-1/fall-of-empires.json`;
  if (fs.existsSync(foe)) {
    const d = JSON.parse(fs.readFileSync(foe, 'utf-8'));
    if (d.lessons?.[0]?.type === 'timeline') {
      if (fixFallOfEmpires(foe)) {
        console.log('FIXED: chapter-1/fall-of-empires.json (timeline→era-exploration)');
        fixed++;
      }
    }
  }

  console.log(`\nDone: ${fixed} files fixed`);
}

main();