#!/usr/bin/env npx tsx
/**
 * Regenerate chapters.json for lq-math based on actual lesson files
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
  return parts[parts.length - 2]; // e.g., "chapter-1", "chapter-2"
}

function regenerateMathManifest() {
  const basePath = 'lq-math/public/data/lessons/en';
  const files = findJsonFiles(basePath);

  // Group files by chapter
  const byChapter = new Map<string, string[]>();
  for (const file of files) {
    const chapter = getChapterFromPath(file);
    if (!byChapter.has(chapter)) {
      byChapter.set(chapter, []);
    }
    byChapter.get(chapter)!.push(file);
  }

  // Build chapters array
  const chapters: Chapter[] = [];

  // Define chapter metadata
  const chapterMeta: Record<string, { title: string; description: string }> = {
    'chapter-1': {
      title: 'Number Sense & Basics',
      description: 'Build a foundation with counting, addition, shapes, and simple word problems'
    },
    'chapter-2': {
      title: 'Arithmetic & Word Problems I',
      description: 'Practice arithmetic operations and apply them to everyday word problems'
    },
    'chapter-3': {
      title: 'Arithmetic & Word Problems II',
      description: 'Strengthen arithmetic fluency with more challenging problems and scenarios'
    },
    'chapter-4': {
      title: 'Geometry: Shapes & Symmetry',
      description: 'Explore 2D shapes, count sides and corners, discover patterns and symmetry'
    },
    'chapter-5': {
      title: 'Place Value & Number Operations',
      description: 'Understand place value, expanded form, and use it in addition and subtraction'
    }
  };

  for (let i = 1; i <= 5; i++) {
    const chapterId = `chapter-${i}`;
    const chapterFiles = byChapter.get(chapterId) || [];

    // Extract lesson IDs from files
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
      // Sort to get consistent order
      .sort((a: LessonRef, b: LessonRef) => {
        // Sort by order property
        return a.order - b.order;
      });

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

  // Backup old manifest
  const manifestPath = `${basePath}/chapters.json`;
  fs.writeFileSync(`${manifestPath}.bak`, fs.readFileSync(manifestPath));

  // Write new manifest
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log('Generated Math chapters.json:');
  for (const ch of chapters) {
    console.log(`  ${ch.id}: ${ch.lessons.length} lessons`);
  }
}

regenerateMathManifest();
