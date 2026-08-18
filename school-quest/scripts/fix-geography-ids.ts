#!/usr/bin/env npx tsx
/**
 * Fix duplicate lesson IDs in lq-geography by adding chapter suffix
 */

import * as fs from 'fs';

const BASE = 'lq-geography/public/data/lessons/en';

const chapterSuffixes: Record<string, string> = {
  'chapter-3': 'ch3',
  'chapter-4': 'ch4',
  'chapter-5': 'ch5',
};

// Geography has 17 duplicate IDs - all appear in chapters 2, 3, 4, 5
const duplicates = [
  'climate-zones',
  'compass-directions',
  'continents-oceans',
  'countries-flags',
  'dams-reservoirs',
  'famous-landmarks',
  'freshwater-resources',
  'hemispheres',
  'latitude-longitude',
  'map-projections',
  'map-symbols',
  'oceans-seas',
  'physical-vs-political',
  'rivers-lakes',
  'space-exploration-timeline',
  'stars-constellations',
  'time-zones',
];

function fixGeographyIds() {
  console.log('Fixing Geography lesson IDs...\n');

  let fixed = 0;
  for (const lessonId of duplicates) {
    for (const [chapter, suffix] of Object.entries(chapterSuffixes)) {
      const oldFileName = `${lessonId}.json`;
      const newFileName = `${lessonId}-${suffix}.json`;
      const dirPath = `${BASE}/${chapter}`;
      const oldPath = `${dirPath}/${oldFileName}`;
      const newPath = `${dirPath}/${newFileName}`;

      if (!fs.existsSync(oldPath)) {
        continue;
      }

      const content = JSON.parse(fs.readFileSync(oldPath, 'utf-8'));
      const newLessonId = `${lessonId}-${suffix}`;
      content.lessons[0].id = newLessonId;
      content.lessons[0].chapterId = chapter;

      fs.writeFileSync(newPath, JSON.stringify(content, null, 2));
      fs.unlinkSync(oldPath);
      console.log(`RENAMED: ${chapter}/${oldFileName} -> ${newFileName}`);
      fixed++;
    }
  }

  console.log(`\nDone! Fixed ${fixed} files.`);
}

fixGeographyIds();
