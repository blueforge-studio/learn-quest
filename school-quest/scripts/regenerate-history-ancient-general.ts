#!/usr/bin/env npx tsx
/**
 * Regenerate ancient/_general/chapters.json to include all orphan lessons
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

function regenerateAncientGeneralManifest() {
  const basePath = 'lq-history/public/data/lessons/en/ancient/_general';
  const files = findJsonFiles(basePath);

  // Group by chapter
  const byChapter = new Map<string, string[]>();
  for (const file of files) {
    const chapter = path.basename(path.dirname(file));
    if (!byChapter.has(chapter)) {
      byChapter.set(chapter, []);
    }
    byChapter.get(chapter)!.push(file);
  }

  const chapters: Chapter[] = [];

  // Chapter metadata
  const chapterMeta: Record<string, { title: string; description: string }> = {
    'chapter-1': {
      title: 'Introduction to the Ancient World',
      description: 'Explore timelines, the Stone Age, and meet a great Renaissance thinker'
    },
    'chapter-2': {
      title: 'Ancient Civilizations',
      description: 'Discover ancient inventions, trade, warfare, and the rise of empires'
    },
    'chapter-3': {
      title: 'Ancient Societies',
      description: 'Explore ancient religions, laws, and cultural achievements'
    },
    'chapter-4': {
      title: 'Bronze and Iron Ages',
      description: 'Learn about metalworking and its impact on civilization'
    },
    'chapter-5': {
      title: 'Legacy of Ancient Civilizations',
      description: 'Understand how ancient inventions and ideas shape our world today'
    }
  };

  // Chapter numbers
  const chapterOrder = ['chapter-1', 'chapter-2', 'chapter-3', 'chapter-4', 'chapter-5'];

  for (const chapterId of chapterOrder) {
    const chapterFiles = byChapter.get(chapterId) || [];

    const lessonRefs: LessonRef[] = chapterFiles
      .map((file, idx) => {
        try {
          const content = JSON.parse(fs.readFileSync(file, 'utf-8'));
          const lesson = content.lessons?.[0];
          if (!lesson) return null;
          return {
            id: lesson.id,
            order: idx + 1
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .map((item: any) => ({
        type: 'lesson' as const,
        enabled: chapterId === 'chapter-1', // Only enable chapter 1 for now (staged rollout)
        id: item.id,
        order: item.order
      }))
      .sort((a: LessonRef, b: LessonRef) => a.order - b.order);

    const meta = chapterMeta[chapterId] || { title: chapterId, description: '' };
    const order = parseInt(chapterId.replace('chapter-', ''));

    chapters.push({
      id: chapterId,
      order,
      title: meta.title,
      description: meta.description,
      lessons: lessonRefs
    });
  }

  const manifest = {
    epoch: 'ancient',
    region: '_general',
    chapters
  };

  // Backup and write
  const manifestPath = `${basePath}/chapters.json`;
  fs.writeFileSync(`${manifestPath}.bak`, fs.readFileSync(manifestPath));
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log('Generated ancient/_general/chapters.json:');
  for (const ch of chapters) {
    const enabled = ch.lessons.filter(l => l.enabled).length;
    console.log(`  ${ch.id}: ${ch.lessons.length} lessons (${enabled} enabled)`);
  }
}

regenerateAncientGeneralManifest();
