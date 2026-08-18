#!/usr/bin/env npx tsx
/**
 * Fix History ancient/_general/ orphan lesson IDs
 * These lessons exist in chapters 2-5 but aren't in the manifest
 * Strategy: rename with chapter suffix and add to manifest
 */

import * as fs from 'fs';

const BASE = 'lq-history/public/data/lessons/en/ancient/_general';

// Lessons in chapters 2-5 that need renaming
const orphanLessons = [
  'ancient-inventions',
  'ancient-laws',
  'ancient-religions',
  'ancient-trade',
  'ancient-warfare',
  'bronze-age',
  'fall-of-empires',
  'first-civilizations',
  'invention-of-writing',
  'iron-age',
];

const chapterSuffixes: Record<string, string> = {
  'chapter-2': 'ch2',
  'chapter-3': 'ch3',
  'chapter-4': 'ch4',
  'chapter-5': 'ch5',
};

function fixHistoryOrphanIds() {
  console.log('Fixing History ancient/_general/ orphan lesson IDs...\n');

  for (const [chapter, suffix] of Object.entries(chapterSuffixes)) {
    for (const lessonId of orphanLessons) {
      const oldFileName = `${lessonId}.json`;
      const newFileName = `${lessonId}-${suffix}.json`;
      const dirPath = `${BASE}/${chapter}`;
      const oldPath = `${dirPath}/${oldFileName}`;
      const newPath = `${dirPath}/${newFileName}`;

      if (!fs.existsSync(oldPath)) {
        console.log(`SKIP: ${oldPath} does not exist`);
        continue;
      }

      const content = JSON.parse(fs.readFileSync(oldPath, 'utf-8'));
      const newLessonId = `${lessonId}-${suffix}`;
      content.lessons[0].id = newLessonId;
      content.lessons[0].chapterId = chapter;

      fs.writeFileSync(newPath, JSON.stringify(content, null, 2));
      fs.unlinkSync(oldPath);
      console.log(`RENAMED: ${chapter}/${oldFileName} -> ${newFileName}`);
      console.log(`  ID: ${lessonId} -> ${newLessonId}`);
    }
  }

  console.log('\nDone!');
}

fixHistoryOrphanIds();
