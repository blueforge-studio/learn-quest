#!/usr/bin/env npx tsx
/**
 * Fix duplicate lesson IDs in lq-math by adding chapter suffix
 * Files in chapter-3, 4, 5 get renamed: X -> X-ch3, X-ch4, X-ch5
 * Files in chapter-2 stay as base (no suffix)
 */

import * as fs from 'fs';
import * as path from 'path';

const BASE = 'lq-math/public/data/lessons/en';

// Math has 17 duplicate IDs - all appear in chapters 2, 3, 4, 5
// Strategy: rename chapter-3, 4, 5 files with chapter suffix
const duplicates = [
  '3d-shapes',
  'angles-intro',
  'angles-measurement',
  'area-basics',
  'basic-shapes',
  'coordinate-grid',
  'division-intro',
  'division-long',
  'mental-math',
  'multiplication-intro',
  'multiplication-multi-digit',
  'order-of-operations',
  'perimeter-basics',
  'subtraction-basics',
  'symmetry-intro',
  'tessellations',
  'volume-intro',
];

const chapterSuffixes: Record<string, string> = {
  'chapter-3': 'ch3',
  'chapter-4': 'ch4',
  'chapter-5': 'ch5',
};

function fixMathIds() {
  console.log('Fixing Math lesson IDs...\n');

  for (const lessonId of duplicates) {
    for (const [chapter, suffix] of Object.entries(chapterSuffixes)) {
      const oldFileName = `${lessonId}.json`;
      const newFileName = `${lessonId}-${suffix}.json`;
      const dirPath = `${BASE}/${chapter}`;
      const oldPath = `${dirPath}/${oldFileName}`;
      const newPath = `${dirPath}/${newFileName}`;

      if (!fs.existsSync(oldPath)) {
        console.log(`SKIP: ${oldPath} does not exist`);
        continue;
      }

      // Read and update the JSON
      const content = JSON.parse(fs.readFileSync(oldPath, 'utf-8'));

      // Update the lesson ID inside the file
      const newLessonId = `${lessonId}-${suffix}`;
      content.lessons[0].id = newLessonId;
      // Also update chapterId to match
      content.lessons[0].chapterId = chapter;

      // Write to new file
      fs.writeFileSync(newPath, JSON.stringify(content, null, 2));
      console.log(`RENAMED: ${oldFileName} -> ${newFileName}`);
      console.log(`  ID: ${lessonId} -> ${newLessonId}`);

      // Remove old file
      fs.unlinkSync(oldPath);
    }
  }

  console.log('\nDone!');
}

fixMathIds();
