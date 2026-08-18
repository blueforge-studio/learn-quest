#!/usr/bin/env npx tsx
/**
 * Audit script to find duplicate lesson IDs across all subjects
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface LessonInfo {
  subject: string;
  chapterDir: string;
  filePath: string;
  lessonId: string;
  chapterId: string;
}

function findJsonFiles(dir: string): string[] {
  try {
    const output = execSync(`find ${dir} -name "*.json" -not -name "chapters.json" -not -name "index.json" 2>/dev/null | sort`, {
      encoding: 'utf-8'
    });
    return output.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function auditSubject(subjectPath: string, subjectName: string): Map<string, LessonInfo[]> {
  const lessons = new Map<string, LessonInfo[]>();

  const files = findJsonFiles(subjectPath);

  for (const file of files) {
    try {
      const content = JSON.parse(fs.readFileSync(file, 'utf-8'));
      const lessons_arr = content.lessons || [];
      const chapterDir = path.dirname(file).split('/').pop() || '';

      for (const lesson of lessons_arr) {
        const key = `${subjectName}:${lesson.id}`;
        const info: LessonInfo = {
          subject: subjectName,
          chapterDir,
          filePath: file,
          lessonId: lesson.id,
          chapterId: lesson.chapterId || 'unknown'
        };

        if (!lessons.has(key)) {
          lessons.set(key, []);
        }
        lessons.get(key)!.push(info);
      }
    } catch {
      // Skip invalid JSON
    }
  }

  return lessons;
}

function main() {
  const subjects = [
    { path: 'lq-math/public/data/lessons/en', name: 'lq-math' },
    { path: 'lq-science/public/data/lessons/en', name: 'lq-science' },
    { path: 'lq-geography/public/data/lessons/en', name: 'lq-geography' },
    { path: 'lq-reading/public/data/lessons/en', name: 'lq-reading' },
    { path: 'lq-writing/public/data/lessons/en', name: 'lq-writing' },
  ];

  const allLessons = new Map<string, LessonInfo[]>();
  const subjectDuplicates = new Map<string, number>();

  for (const { path: sp, name } of subjects) {
    const subjectLessons = auditSubject(sp, name);
    let duplicates = 0;

    for (const [key, infos] of subjectLessons) {
      const uniqueFiles = new Set(infos.map(i => i.filePath));
      if (uniqueFiles.size > 1) {
        duplicates++;
        if (!allLessons.has(key)) {
          allLessons.set(key, []);
        }
        allLessons.get(key)!.push(...infos);
      }
    }
    subjectDuplicates.set(name, duplicates);
  }

  // Report
  console.log('# Duplicate Lesson IDs Report\n');
  console.log(`Total duplicate lesson IDs across all subjects: ${subjectDuplicates.size > 0 ? [...new Set([...subjectDuplicates.values()].filter(v => v > 0))].length : 0}\n`);

  console.log('## Summary by Subject\n');
  console.log('| Subject | Duplicate Lesson IDs |');
  console.log('|---------|----------------------|');
  for (const [name, count] of subjectDuplicates) {
    console.log(`| ${name} | ${count} |`);
  }
  console.log();

  // Detailed duplicates
  const bySubject = new Map<string, Map<string, LessonInfo[]>>();
  for (const [key, infos] of allLessons) {
    const subject = infos[0].subject;
    if (!bySubject.has(subject)) {
      bySubject.set(subject, new Map());
    }
    bySubject.get(subject)!.set(key, infos);
  }

  for (const [subject, items] of bySubject) {
    console.log(`## ${subject}\n`);
    for (const [key, infos] of items) {
      console.log(`### ${key}`);
      // Group by chapter
      const byChapter = new Map<string, LessonInfo[]>();
      for (const info of infos) {
        if (!byChapter.has(info.chapterDir)) {
          byChapter.set(info.chapterDir, []);
        }
        byChapter.get(info.chapterDir)!.push(info);
      }

      for (const [chapter, chapterInfos] of byChapter) {
        const file = chapterInfos[0].filePath;
        const chapterId = chapterInfos[0].chapterId;
        console.log(`  - ${chapter}/ (chapterId: ${chapterId})`);
      }
      console.log();
    }
  }

  // Per-subject duplicate lists
  console.log('\n## Files Requiring Rename (by subject)\n');
  for (const [subject, items] of bySubject) {
    const renameCandidates: string[] = [];
    for (const [lessonId, infos] of items) {
      // Files in chapter-3, 4, 5 that have same ID as chapter-2
      const chapters = infos.map(i => i.chapterDir);
      if (chapters.some(c => ['chapter-3', 'chapter-4', 'chapter-5'].includes(c))) {
        renameCandidates.push(lessonId);
      }
    }
    if (renameCandidates.length > 0) {
      console.log(`### ${subject}`);
      for (const id of renameCandidates) {
        console.log(`  - ${id}`);
      }
      console.log();
    }
  }
}

main();
