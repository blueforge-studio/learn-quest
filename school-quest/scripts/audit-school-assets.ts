#!/usr/bin/env npx tsx
import { readdirSync, readFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';

const base = '/Users/kmandrup/Projects/Repos/learn-quest/school-quest';
const subjects = ['lq-math', 'lq-science', 'lq-geography', 'lq-reading', 'lq-writing'];

const REPLICATE_COST = 0.003;
const EDGE_TTS_COST = 0;

const imagesPerLesson: Record<string, number> = {
  'lq-math': 3,
  'lq-science': 3,
  'lq-geography': 4,
  'lq-reading': 2,
  'lq-writing': 3,
};

interface SubjectStats {
  lessons: number;
  existingImages: number;
  existingAudioLessons: number;
  existingNarrations: number;
  lessonTypes: Map<string, number>;
  neededImages: number;
  imageGap: number;
  imageCost: number;
}

const stats: Record<string, SubjectStats> = {};

for (const sub of subjects) {
  const subDir = join(base, sub);
  const lessonCount = 0;
  const lessonTypes = new Map<string, number>();

  // Count lessons
  const lessonsDir = join(subDir, 'public/data/lessons/en');
  if (existsSync(lessonsDir)) {
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          walk(full);
        } else if (entry.endsWith('.json') && entry !== 'chapters.json') {
          try {
            const content = JSON.parse(readFileSync(full, 'utf-8'));
            if (content.lessons?.[0]?.type) {
              const t = content.lessons[0].type;
              lessonTypes.set(t, (lessonTypes.get(t) || 0) + 1);
            }
          } catch {}
        }
      }
    };
    walk(lessonsDir);
  }

  // Count existing images (recursive)
  const imagesDir = join(subDir, 'public/images');
  const countRecursive = (dir: string): number => {
    let count = 0;
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        count += countRecursive(full);
      } else if (/\.(png|jpg|webp|svg)$/.test(entry)) {
        count++;
      }
    }
    return count;
  };
  let existingImages = 0;
  if (existsSync(imagesDir)) {
    existingImages = countRecursive(imagesDir);
  }

  // Count existing audio
  const audioLessonsDir = join(subDir, 'public/audio/lessons');
  const audioNarrDir = join(subDir, 'public/audio/narration');
  const existingAudioLessons = existsSync(audioLessonsDir) ? readdirSync(audioLessonsDir).filter(f => f.endsWith('.mp3')).length : 0;
  const existingNarrations = existsSync(audioNarrDir) ? readdirSync(audioNarrDir).filter(f => f.endsWith('.mp3')).length : 0;

  // Count total lesson files
  let totalLessons = 0;
  const walkCount = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walkCount(full);
      else if (entry.endsWith('.json') && entry !== 'chapters.json') totalLessons++;
    }
  };
  walkCount(lessonsDir);

  const perLesson = imagesPerLesson[sub] || 2;
  const neededImages = totalLessons * perLesson;
  const imageGap = Math.max(0, neededImages - existingImages);
  const imageCost = imageGap * REPLICATE_COST;

  stats[sub] = {
    lessons: totalLessons,
    existingImages,
    existingAudioLessons,
    existingNarrations,
    lessonTypes,
    neededImages,
    imageGap,
    imageCost,
  };
}

// Print summary table
console.log('\n============================================================');
console.log('SCHOOL-QUEST ASSET BUDGET REPORT');
console.log('============================================================');
console.log('Image generation: Replicate Schnell @ $0.003/img');
console.log('Narration audio:  Edge TTS @ $0 (free)');
console.log('============================================================\n');

let totalLessons = 0;
let totalImageGap = 0;
let totalImageCost = 0;
let totalExistingImages = 0;

for (const sub of subjects) {
  const s = stats[sub];
  totalLessons += s.lessons;
  totalExistingImages += s.existingImages;
  totalImageGap += s.imageGap;
  totalImageCost += s.imageCost;

  const name = sub.replace('lq-', '').toUpperCase().padEnd(10);
  const types = [...s.lessonTypes.entries()].map(([k, v]) => `${k}(${v})`).join(', ') || 'n/a';
  console.log(`${name}`);
  console.log(`  Lessons:           ${s.lessons}`);
  console.log(`  Lesson types:      ${types}`);
  console.log(`  Existing images:   ${s.existingImages}`);
  console.log(`  Images/lesson:     ${imagesPerLesson[sub]}`);
  console.log(`  Total needed:      ${s.neededImages}`);
  console.log(`  Image gap:         ${s.imageGap}`);
  console.log(`  Image cost:        $${s.imageCost.toFixed(2)}`);
  console.log(`  Lesson audio:      ${s.existingAudioLessons}`);
  console.log(`  Narrations:       ${s.existingNarrations}`);
  console.log('');
}

console.log('============================================================');
console.log('SUMMARY (excludes History)');
console.log('============================================================');
console.log(`Total lessons:        ${totalLessons}`);
console.log(`Total existing images: ${totalExistingImages}`);
console.log(`Total image gap:       ${totalImageGap}`);
console.log(`Total image cost:     $${totalImageCost.toFixed(2)}`);
console.log('============================================================');