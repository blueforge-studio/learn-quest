#!/usr/bin/env npx tsx
/**
 * Enable all disabled lessons across all History epochs/regions
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BASE = `${ROOT}/lq-history/public/data/lessons/en`;

interface Chapter {
  id: string;
  order: number;
  title: string;
  description: string;
  lessons: {
    type: string;
    enabled: boolean;
    id: string;
    order: number;
  }[];
}

interface Manifest {
  epoch?: string;
  region?: string;
  chapters: Chapter[];
}

function enableAllLessons(manifestPath: string): number {
  const content: Manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

  let enabledCount = 0;
  for (const chapter of content.chapters) {
    for (const lesson of chapter.lessons) {
      if (!lesson.enabled) {
        lesson.enabled = true;
        enabledCount++;
      }
    }
  }

  fs.writeFileSync(manifestPath, JSON.stringify(content, null, 2));
  return enabledCount;
}

function main() {
  const epochs = ['ancient', 'medieval', 'early-modern', 'modern', 'contemporary', 'future'];
  let totalEnabled = 0;

  console.log('Enabling all disabled lessons across ALL History manifests...\n');

  for (const epoch of epochs) {
    const epochPath = `${BASE}/${epoch}`;
    if (!fs.existsSync(epochPath)) continue;

    const regions = fs.readdirSync(epochPath).filter(f => fs.statSync(`${epochPath}/${f}`).isDirectory());

    for (const region of regions) {
      const manifestPath = `${epochPath}/${region}/chapters.json`;
      if (!fs.existsSync(manifestPath)) {
        console.log(`SKIP: ${epoch}/${region} - no chapters.json`);
        continue;
      }

      const enabled = enableAllLessons(manifestPath);
      if (enabled > 0) {
        console.log(`${epoch}/${region}: enabled ${enabled} lessons`);
        totalEnabled += enabled;
      }
    }
  }

  console.log(`\nTotal lessons enabled: ${totalEnabled}`);
}

main();