#!/usr/bin/env npx tsx
/**
 * Enable all lessons in ancient/_general chapters.json now that schemas are fixed
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

interface LessonRef {
  type: string;
  enabled: boolean;
  id: string;
  order: number;
}

interface Chapter {
  id: string;
  order: number;
  title: string;
  description: string;
  lessons: LessonRef[];
}

function enableAllLessons() {
  const manifestPath = `${ROOT}/lq-history/public/data/lessons/en/ancient/_general/chapters.json`;
  const content = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

  console.log('Enabling all lessons in ancient/_general manifest...\n');

  let enabledCount = 0;
  for (const chapter of content.chapters) {
    for (const lesson of chapter.lessons) {
      if (!lesson.enabled) {
        lesson.enabled = true;
        enabledCount++;
      }
    }
    console.log(`${chapter.id}: ${chapter.lessons.filter(l => l.enabled).length}/${chapter.lessons.length} enabled`);
  }

  fs.writeFileSync(manifestPath, JSON.stringify(content, null, 2));
  console.log(`\nEnabled ${enabledCount} lessons`);
}

enableAllLessons();