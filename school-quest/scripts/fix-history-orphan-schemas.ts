#!/usr/bin/env npx tsx
/**
 * Fix History ancient/_general/ orphan lessons - convert stages[] to events[] format.
 * Also fix quiz correctAnswer format (string option -> index).
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BASE = `${ROOT}/lq-history/public/data/lessons/en/ancient/_general`;

interface Content {
  [key: string]: any;
}

function fixEraExplorationLesson(content: Content): Content {
  const fixed = { ...content };

  // Convert stages to sections
  if (Array.isArray(fixed.stages) && !Array.isArray(fixed.sections)) {
    fixed.sections = fixed.stages.map((stage: any, idx: number) => ({
      id: `s${idx + 1}`,
      title: stage.title || `Section ${idx + 1}`,
      body: stage.description || '',
    }));
    delete fixed.stages;
  }

  // Ensure required fields
  if (!fixed.intro && fixed.introduction) {
    fixed.intro = fixed.introduction;
    delete fixed.introduction;
  }
  if (!fixed.intro) fixed.intro = '';
  if (!fixed.period) fixed.period = '';
  if (!fixed.sections) fixed.sections = [];
  if (!fixed.quiz) fixed.quiz = [];
  if (!fixed.keyEvents) fixed.keyEvents = [];

  // Clean up extra fields
  delete fixed.conclusion;
  delete fixed.title;
  delete fixed.introduction;
  delete fixed.difficulty;
  delete fixed.stages;
  delete fixed.timeline;
  delete fixed.events;

  // Fix quiz format - correctAnswer should be an index string "0", "1", etc.
  if (Array.isArray(fixed.quiz)) {
    for (const q of fixed.quiz) {
      if (q.options && Array.isArray(q.options) && typeof q.correctAnswer === 'string') {
        const idx = q.options.indexOf(q.correctAnswer);
        if (idx >= 0) {
          q.correctAnswer = String(idx);
        }
      }
    }
  }

  return fixed;
}

function fixTimeline(content: Content): Content {
  const fixed = { ...content };

  // Convert stages to events format
  if (Array.isArray(fixed.stages) && !Array.isArray(fixed.events)) {
    fixed.events = fixed.stages.map((stage: any, idx: number) => ({
      id: stage.id || `e${idx + 1}`,
      date: String(stage.year || ''),
      year: parseYear(stage.year),
      title: stage.title || '',
      description: stage.description || '',
      significance: stage.explanation || stage.hint || '',
      category: 'history'
    }));
    delete fixed.stages;
  }

  // Convert timeline array to events array (for timeline type lessons)
  if (Array.isArray(fixed.timeline) && !Array.isArray(fixed.events)) {
    fixed.events = fixed.timeline.map((item: any, idx: number) => ({
      id: `e${idx + 1}`,
      date: String(item.year || ''),
      year: parseYear(item.year),
      title: item.title || '',
      description: item.description || '',
      significance: item.explanation || item.hint || '',
      category: 'history'
    }));
    delete fixed.timeline;
  }

  // Ensure required fields
  if (!fixed.intro && fixed.introduction) {
    fixed.intro = fixed.introduction;
    delete fixed.introduction;
  }
  if (!fixed.intro) fixed.intro = '';
  if (!fixed.period) fixed.period = '';
  if (!fixed.mode) fixed.mode = 'explore';
  if (!fixed.events) fixed.events = [];

  // Clean up extra fields
  delete fixed.conclusion;
  delete fixed.title;
  delete fixed.introduction;
  delete fixed.difficulty;
  delete fixed.stages;
  delete fixed.timeline;

  // Fix quiz format - correctAnswer should be an index string "0", "1", etc.
  if (Array.isArray(fixed.quiz)) {
    for (const q of fixed.quiz) {
      if (q.options && Array.isArray(q.options) && typeof q.correctAnswer === 'string') {
        const idx = q.options.indexOf(q.correctAnswer);
        if (idx >= 0) {
          q.correctAnswer = String(idx);
        }
      }
    }
  }

  return fixed;
}

function parseYear(year: string | number | undefined): number {
  if (!year) return 0;
  if (typeof year === 'number') return year;

  // Handle strings like "~3500 BCE", "3000 BCE", etc.
  const cleaned = year.replace(/[~,\s]/g, '').replace(/BCE$/i, '-').replace(/CE$/i, '');
  const num = parseInt(cleaned);
  if (isNaN(num)) return 0;

  // BCE years should be negative
  if (year.toLowerCase().includes('bce') && num > 0) return -num;
  return num;
}

function fixFile(filePath: string): boolean {
  try {
    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const lesson = content.lessons?.[0];

    if (!lesson) return false;

    const oldContent = lesson.content || {};

    // Check if changes were needed - quiz fix needed if correctAnswer is a string that exists in options
    const quiz = oldContent.quiz;
    let hasQuizFormatIssue = false;
    if (Array.isArray(quiz)) {
      for (const q of quiz) {
        if (typeof q.correctAnswer === 'string' && Array.isArray(q.options) && q.options.includes(q.correctAnswer)) {
          hasQuizFormatIssue = true;
          break;
        }
      }
    }

    let newContent: Content;

    // Fix based on lesson type
    if (lesson.type === 'timeline') {
      newContent = fixTimeline(oldContent);
    } else if (lesson.type === 'era-exploration') {
      newContent = fixEraExplorationLesson(oldContent);
    } else {
      return false; // Don't modify other types
    }

    const needsFix =
      (Array.isArray(oldContent.stages)) ||
      (Array.isArray(oldContent.timeline)) ||
      (lesson.type === 'era-exploration' && Array.isArray(oldContent.stages)) ||
      hasQuizFormatIssue;

    if (needsFix) {
      lesson.content = newContent;
      lesson.updatedAt = new Date().toISOString();
      lesson.lastChangeType = 'schema-fix';

      fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
      return true;
    }

    return false;
  } catch (e) {
    console.error(`Error reading ${filePath}: ${e}`);
    return false;
  }
}

function main() {
  const chapters = ['chapter-2', 'chapter-3', 'chapter-4', 'chapter-5'];
  let fixedCount = 0;
  let skipCount = 0;

  console.log('Fixing History ancient/_general/ orphan lesson schemas...\n');

  for (const chapter of chapters) {
    const chapterDir = `${BASE}/${chapter}`;
    if (!fs.existsSync(chapterDir)) {
      console.log(`${chapter}: directory not found`);
      continue;
    }

    const files = fs.readdirSync(chapterDir).filter(f => f.endsWith('.json'));

    for (const file of files) {
      const filePath = `${chapterDir}/${file}`;
      if (fixFile(filePath)) {
        console.log(`FIXED: ${chapter}/${file}`);
        fixedCount++;
      } else {
        skipCount++;
      }
    }
  }

  console.log(`\nDone: ${fixedCount} files fixed, ${skipCount} skipped (already valid or non-timeline)`);
}

main();