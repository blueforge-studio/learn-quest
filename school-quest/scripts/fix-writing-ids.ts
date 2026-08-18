#!/usr/bin/env npx tsx
/**
 * Fix duplicate lesson IDs in lq-writing by adding chapter suffix
 */

import * as fs from 'fs';

const BASE = 'lq-writing/public/data/lessons/en';

const chapterSuffixes: Record<string, string> = {
  'chapter-3': 'ch3',
  'chapter-4': 'ch4',
  'chapter-5': 'ch5',
};

// Writing has 12 duplicate IDs
const duplicates = [
  'adjectives',
  'adverbs',
  'compare-contrast-essay',
  'conjunctions',
  'email-writing',
  'nouns-verbs',
  'prepositions',
  'pronouns',
  'punctuation-advanced',
  'sentence-structure',
  'subject-verb-agreement',
  'tenses',
];

function fixWritingIds() {
  console.log('Fixing Writing lesson IDs...\n');

  let fixed = 0;
  for (const lessonId of duplicates) {
    for (const [chapter, suffix] of Object.entries(chapterSuffixes)) {
      const oldFileName = `${lessonId}.json`;
      const newFileName = `${lessonId}-${suffix}.json`;
      const dirPath = `${BASE}/${chapter}`;
      const oldPath = `${dirPath}/${oldFileName}`;
      const newPath = `${dirPath}/${newFileName}`;

      if (!fs.existsSync(oldPath)) {
        continue;
      }

      const content = JSON.parse(fs.readFileSync(oldPath, 'utf-8'));
      const newLessonId = `${lessonId}-${suffix}`;
      content.lessons[0].id = newLessonId;
      content.lessons[0].chapterId = chapter;

      fs.writeFileSync(newPath, JSON.stringify(content, null, 2));
      fs.unlinkSync(oldPath);
      console.log(`RENAMED: ${chapter}/${oldFileName} -> ${newFileName}`);
      fixed++;
    }
  }

  console.log(`\nDone! Fixed ${fixed} files.`);
}

fixWritingIds();
