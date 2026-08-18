#!/usr/bin/env npx tsx
/**
 * Fix quiz correctAnswer format in ALL History lessons across all epochs/regions
 * correctAnswer should be an index string "0", "1", etc., not the option string itself
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BASE = `${ROOT}/lq-history/public/data/lessons/en`;

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
  const epochs = ['ancient', 'medieval', 'early-modern', 'modern', 'contemporary', 'future'];
  let fixedCount = 0;
  let skipCount = 0;

  console.log('Fixing quiz correctAnswer format across ALL History lessons...\n');

  for (const epoch of epochs) {
    const epochPath = `${BASE}/${epoch}`;
    if (!fs.existsSync(epochPath)) continue;

    const regions = fs.readdirSync(epochPath).filter(f => fs.statSync(`${epochPath}/${f}`).isDirectory());

    for (const region of regions) {
      const regionPath = `${epochPath}/${region}`;
      const chapters = fs.readdirSync(regionPath).filter(f => f.startsWith('chapter-') && fs.statSync(`${regionPath}/${f}`).isDirectory());

      for (const chapter of chapters) {
        const chapterPath = `${regionPath}/${chapter}`;
        const files = fs.readdirSync(chapterPath).filter(f => f.endsWith('.json'));

        for (const file of files) {
          const filePath = `${chapterPath}/${file}`;
          const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

          if (fixQuizAnswers(content)) {
            content.lessons[0].updatedAt = new Date().toISOString();
            content.lessons[0].lastChangeType = 'schema-fix';
            fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
            console.log(`FIXED: ${epoch}/${region}/${chapter}/${file}`);
            fixedCount++;
          } else {
            skipCount++;
          }
        }
      }
    }
  }

  console.log(`\nDone: ${fixedCount} files fixed, ${skipCount} skipped`);
}

main();