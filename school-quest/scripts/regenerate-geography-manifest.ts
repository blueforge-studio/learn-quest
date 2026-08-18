#!/usr/bin/env npx tsx
/**
 * Regenerate chapters.json for lq-geography based on actual lesson files
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

function regenerateGeographyManifest() {
  const basePath = 'lq-geography/public/data/lessons/en';
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
      title: 'Maps & Continents',
      description: 'Learn to read maps and globes, locate continents, and explore world capitals'
    },
    'chapter-2': {
      title: 'Hemispheres, Oceans & Africa',
      description: 'Explore hemispheres, oceans, the equator, and the continent of Africa'
    },
    'chapter-3': {
      title: 'Landforms & Natural Wonders',
      description: 'Discover mountains, rivers, deserts, islands, and volcanic tectonics'
    },
    'chapter-4': {
      title: 'Weather & Climate',
      description: 'Understand climate zones, weather patterns, rainfall, and temperature around the world'
    },
    'chapter-5': {
      title: 'Exploring Europe',
      description: 'Tour European countries, capitals, landmarks, and regional cultures'
    }
  };

  for (let i = 1; i <= 5; i++) {
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

  console.log('Generated Geography chapters.json:');
  for (const ch of chapters) {
    console.log(`  ${ch.id}: ${ch.lessons.length} lessons`);
  }
}

regenerateGeographyManifest();
