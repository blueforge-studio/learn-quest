#!/usr/bin/env npx tsx
/**
 * Fix quiz correctAnswer format in all History ancient/_general lessons
 * correctAnswer should be an index string "0", "1", etc., not the option string itself
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BASE = `${ROOT}/lq-history/public/data/lessons/en/ancient/_general`;

function fixQuizAnswers(content: any): boolean {
  let fixed = false;
  const quiz = content.lessons?.[0]?.content?.quiz;
  if (Array.isArray(quiz)) {
    for (const q of quiz) {
      if (q.options && Array.isArray(q.options) && typeof q.correctAnswer === 'string') {
        const idx = q.options.indexOf(q.correctAnswer);
        if (idx >= 0) {
          q.correctAnswer = String(idx);
          fixed = true;
        }
      }
    }
  }
  return fixed;
}

function main() {
  const chapters = ['chapter-1', 'chapter-2', 'chapter-3', 'chapter-4', 'chapter-5'];
  let fixedCount = 0;
  let skipCount = 0;

  console.log('Fixing quiz correctAnswer format...\n');

  for (const chapter of chapters) {
    const chapterDir = `${BASE}/${chapter}`;
    if (!fs.existsSync(chapterDir)) continue;

    const files = fs.readdirSync(chapterDir).filter(f => f.endsWith('.json'));

    for (const file of files) {
      const filePath = `${chapterDir}/${file}`;
      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

      if (fixQuizAnswers(content)) {
        content.lessons[0].updatedAt = new Date().toISOString();
        content.lessons[0].lastChangeType = 'schema-fix';
        fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
        console.log(`FIXED: ${chapter}/${file}`);
        fixedCount++;
      } else {
        skipCount++;
      }
    }
  }

  console.log(`\nDone: ${fixedCount} files fixed, ${skipCount} skipped`);
}

main();