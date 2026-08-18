#!/usr/bin/env npx tsx
/**
 * Fix duplicate lesson IDs in lq-science by adding chapter suffix
 */

import * as fs from 'fs';

const BASE = 'lq-science/public/data/lessons/en';

const chapterSuffixes: Record<string, string> = {
  'chapter-3': 'ch3',
  'chapter-4': 'ch4',
  'chapter-5': 'ch5',
};

// Science has 35 duplicate IDs - all appear in chapters 2, 3, 4, 5
const duplicates = [
  'animal-adaptations',
  'animal-habitats',
  'atmosphere-layers',
  'atoms-intro',
  'cell-basics',
  'chemical-bonds',
  'earthquakes-volcanoes',
  'science-concept-ecosystems',
  'electricity-basics',
  'elements-compounds',
  'energy-forms',
  'erosion-weathering',
  'everyday-chemistry',
  'food-chains',
  'forces-motion',
  'fossils-intro',
  'gravity-weight',
  'heat-transfer',
  'human-body-systems',
  'life-cycles',
  'light-sound',
  'science-concept-magnetism',
  'matter-properties',
  'natural-resources',
  'ocean-floor',
  'periodic-table-basics',
  'photosynthesis',
  'plant-parts',
  'rock-types',
  'simple-machines',
  'soil-types',
  'speed-velocity',
  'water-cycle',
  'waves-intro',
  'weather-patterns',
];

function fixScienceIds() {
  console.log('Fixing Science lesson IDs...\n');

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

fixScienceIds();
