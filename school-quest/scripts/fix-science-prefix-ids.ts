#!/usr/bin/env npx tsx
/**
 * Fix science-concept- prefixed lesson IDs that are inside files with different names
 * File: ecosystems.json -> internal ID: science-concept-ecosystems
 */

import * as fs from 'fs';

const BASE = 'lq-science/public/data/lessons/en';

const chapterSuffixes: Record<string, string> = {
  'chapter-3': 'ch3',
  'chapter-4': 'ch4',
  'chapter-5': 'ch5',
};

// Map of filename -> internal lesson ID that needs fixing
const specialCases: Record<string, string> = {
  'ecosystems.json': 'science-concept-ecosystems',
  'magnetism.json': 'science-concept-magnetism',
};

function fixScienceIds() {
  console.log('Fixing Science lesson IDs with science-concept prefix...\n');

  for (const [chapter, suffix] of Object.entries(chapterSuffixes)) {
    for (const [filename, oldId] of Object.entries(specialCases)) {
      const dirPath = `${BASE}/${chapter}`;
      const oldPath = `${dirPath}/${filename}`;

      if (!fs.existsSync(oldPath)) {
        console.log(`SKIP: ${oldPath} does not exist`);
        continue;
      }

      // Compute new lesson ID
      const baseId = oldId.replace('science-concept-', '');
      const newLessonId = `science-concept-${baseId}-${suffix}`;
      const newFilename = `${baseId}-${suffix}.json`;
      const newPath = `${dirPath}/${newFilename}`;

      const content = JSON.parse(fs.readFileSync(oldPath, 'utf-8'));
      content.lessons[0].id = newLessonId;
      content.lessons[0].chapterId = chapter;

      fs.writeFileSync(newPath, JSON.stringify(content, null, 2));
      fs.unlinkSync(oldPath);
      console.log(`RENAMED: ${chapter}/${filename} -> ${newFilename}`);
      console.log(`  ID: ${oldId} -> ${newLessonId}`);
    }
  }

  console.log('\nDone!');
}

fixScienceIds();
