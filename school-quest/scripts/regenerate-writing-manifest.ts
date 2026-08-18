#!/usr/bin/env npx tsx
/**
 * Regenerate chapters.json for lq-writing based on actual lesson files
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

function regenerateWritingManifest() {
  const basePath = 'lq-writing/public/data/lessons/en';
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
      title: 'Letter Formation',
      description: 'Learn to write each letter correctly with proper stroke order'
    },
    'chapter-2': {
      title: 'CVC Spelling',
      description: 'Learn to spell consonant-vowel-consonant words'
    },
    'chapter-3': {
      title: 'Dictation Practice',
      description: 'Listen carefully and write what you hear'
    },
    'chapter-4': {
      title: 'Nouns & Verbs',
      description: 'Learn about naming words and action words'
    },
    'chapter-5': {
      title: 'Sentence Writing',
      description: 'Learn to write complete sentences with capital letters and periods'
    },
    'chapter-6': {
      title: 'Capstone: Writing Mastery',
      description: 'Review all skills — handwriting, spelling, grammar, composition, and creative writing'
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

  console.log('Generated Writing chapters.json:');
  for (const ch of chapters) {
    console.log(`  ${ch.id}: ${ch.lessons.length} lessons`);
  }
}

regenerateWritingManifest();
