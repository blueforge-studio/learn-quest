#!/usr/bin/env npx tsx
/**
 * Regenerate chapters.json for lq-reading based on actual lesson files
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

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

function findJsonFiles(dir: string): string[] {
  try {
    const output = execSync(`find ${dir} -name "*.json" -not -name "chapters.json" 2>/dev/null | sort`, {
      encoding: 'utf-8'
    });
    return output.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function getChapterFromPath(filePath: string): string {
  const parts = filePath.split('/');
  return parts[parts.length - 2];
}

function regenerateReadingManifest() {
  const basePath = 'lq-reading/public/data/lessons/en';
  const files = findJsonFiles(basePath);

  const byChapter = new Map<string, string[]>();
  for (const file of files) {
    const chapter = getChapterFromPath(file);
    if (!byChapter.has(chapter)) {
      byChapter.set(chapter, []);
    }
    byChapter.get(chapter)!.push(file);
  }

  const chapters: Chapter[] = [];

  const chapterMeta: Record<string, { title: string; description: string }> = {
    'chapter-1': {
      title: 'Letters & Sounds',
      description: 'Learn the alphabet and the sounds each letter makes'
    },
    'chapter-2': {
      title: 'Short Vowel Words',
      description: 'Practice reading words with short vowel sounds like cat, bed, sit'
    },
    'chapter-3': {
      title: 'Sight Words',
      description: 'Memorize common words that appear frequently in reading'
    },
    'chapter-4': {
      title: 'Fluency Building',
      description: 'Read with expression, proper pacing, and phrasing'
    },
    'chapter-5': {
      title: 'Comprehension: Main Idea',
      description: 'Learn to identify the main idea and key details in passages'
    },
    'chapter-6': {
      title: 'Capstone: Reading Mastery',
      description: 'Review all skills — phonics, sight words, fluency, comprehension, and stories'
    }
  };

  for (let i = 1; i <= 6; i++) {
    const chapterId = `chapter-${i}`;
    const chapterFiles = byChapter.get(chapterId) || [];

    const lessonRefs: LessonRef[] = chapterFiles
      .map(file => {
        try {
          const content = JSON.parse(fs.readFileSync(file, 'utf-8'));
          const lesson = content.lessons?.[0];
          if (!lesson) return null;
          return {
            id: lesson.id,
            filename: path.basename(file)
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .map((item: any, idx: number) => ({
        type: 'lesson' as const,
        enabled: true,
        id: item.id,
        order: idx + 1
      }))
      .sort((a: LessonRef, b: LessonRef) => a.order - b.order);

    const meta = chapterMeta[chapterId] || { title: chapterId, description: '' };

    chapters.push({
      id: chapterId,
      order: i,
      title: meta.title,
      description: meta.description,
      lessons: lessonRefs
    });
  }

  const manifest = { chapters };

  const manifestPath = `${basePath}/chapters.json`;
  fs.writeFileSync(`${manifestPath}.bak`, fs.readFileSync(manifestPath));
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log('Generated Reading chapters.json:');
  for (const ch of chapters) {
    console.log(`  ${ch.id}: ${ch.lessons.length} lessons`);
  }
}

regenerateReadingManifest();
