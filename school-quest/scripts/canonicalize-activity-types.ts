/**
 * Canonicalize Activity Types
 *
 * Scans all lesson JSON files and reports which activity type strings are used,
 * grouped by canonical type. Also reports unrecognized types.
 *
 * Usage:
 *   npx tsx scripts/canonicalize-activity-types.ts
 *
 * To also fix the files (normalize type strings), add --fix:
 *   npx tsx scripts/canonicalize-activity-types.ts --fix
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Canonical type mappings - maps variant strings to canonical type
const CANONICAL_MAP: Record<string, string> = {
  // Match variants
  'match': 'match',
  'matching': 'match',
  'country-match': 'match',
  'capital-match': 'match',
  'location-match': 'match',

  // Fill variants
  'fill': 'fill',
  'fill-in': 'fill',
  'fill-blank': 'fill',
  'fill-in-blank': 'fill',
  'complete': 'fill',

  // Sort variants
  'sort': 'sort',
  'sorting': 'sort',
  'classify': 'sort',
  'categorize': 'sort',

  // Multiple choice variants
  'multiple-choice': 'multiple-choice',
  'multiple': 'multiple-choice',
  'identify': 'multiple-choice',
  'choose': 'multiple-choice',
  'select': 'multiple-choice',

  // True/false
  'true-false': 'true-false',
  'truefalse': 'true-false',
  'true_false': 'true-false',

  // Drag-drop
  'drag-drop': 'drag-drop',
  'drag-and-drop': 'drag-drop',
  'map-placement': 'drag-drop',

  // Spell
  'spell': 'spell',

  // Sentence builder
  'sentence-builder': 'sentence-builder',
  'sentence-construction': 'sentence-builder',
  'sentence-creation': 'sentence-builder',
  'sentence-correction': 'sentence-builder',

  // Memory
  'memory': 'memory',

  // Unscramble (letter rearrangement - treat as fill for now)
  'unscramble': 'unscramble',

  // Syllable-split is a fill-in-blank variant
  'syllable-split': 'fill',
};

interface TypeStats {
  canonical: string;
  variants: Map<string, number>;
}

function findJsonFiles(dir: string): string[] {
  const files: string[] = [];
  try {
    for (const entry of readdirSync(dir)) {
      const fullPath = join(dir, entry);
      try {
        if (statSync(fullPath).isDirectory()) {
          files.push(...findJsonFiles(fullPath));
        } else if (extname(entry) === '.json') {
          files.push(fullPath);
        }
      } catch {
        // Skip inaccessible entries
      }
    }
  } catch {
    // Skip inaccessible directories
  }
  return files;
}

interface ScanResult {
  totalFiles: number;
  totalActivities: number;
  stats: Map<string, TypeStats>;
  unrecognized: Map<string, number>;
  changedFiles: Map<string, number>;
}

function scanFile(filePath: string, fix: boolean): { activities: Array<{ line: number; oldType: string; newType: string }>; content: string } {
  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    return { activities: [], content };
  }

  const activities: Array<{ line: number; oldType: string; newType: string }> = [];
  const lines = content.split('\n');

  // Match "type" field values in practice/questions arrays
  const typePattern = /"type"\s*:\s*"([^"]+)"/g;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    let match: RegExpExecArray | null;
    typePattern.lastIndex = 0;

    while ((match = typePattern.exec(line)) !== null) {
      const oldType = match[1];
      const normalized = oldType.toLowerCase().replace(/[_-]/g, '-');
      const canonical = CANONICAL_MAP[normalized] ?? oldType;

      if (canonical !== oldType) {
        activities.push({
          line: lineIdx + 1,
          oldType,
          newType: canonical,
        });

        if (fix) {
          // Replace the type value while preserving quotes style
          const escapedOld = oldType.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const typeValuePattern = new RegExp(`"type"\\s*:\\s*"${escapedOld}"`);
          lines[lineIdx] = lines[lineIdx].replace(typeValuePattern, `"type": "${canonical}"`);
        }
      }
    }
  }

  return { activities, content: lines.join('\n') };
}

function scanSubject(subjectDir: string, fix: boolean): ScanResult {
  const result: ScanResult = {
    totalFiles: 0,
    totalActivities: 0,
    stats: new Map(),
    unrecognized: new Map(),
    changedFiles: new Map(),
  };

  const lessonsDir = join(subjectDir, 'public/data/lessons/en');
  const files = findJsonFiles(lessonsDir);

  for (const file of files) {
    // Skip chapters.json files
    if (file.endsWith('chapters.json')) continue;

    const { activities, content } = scanFile(file, fix);

    if (activities.length > 0) {
      result.totalFiles++;
      result.totalActivities += activities.length;

      if (fix) {
        try {
          writeFileSync(file, content, 'utf-8');
          result.changedFiles.set(file, activities.length);
        } catch (e) {
          console.error(`  Failed to write: ${file}`, e);
        }
      }

      for (const activity of activities) {
        const canonical = CANONICAL_MAP[activity.oldType.toLowerCase().replace(/[_-]/g, '-')] ?? activity.oldType;
        if (!result.stats.has(canonical)) {
          result.stats.set(canonical, { canonical, variants: new Map() });
        }
        const stats = result.stats.get(canonical)!;
        stats.variants.set(activity.oldType, (stats.variants.get(activity.oldType) ?? 0) + 1);
      }
    }
  }

  return result;
}

function main() {
  const args = process.argv.slice(2);
  const fix = args.includes('--fix');
  const subjects = ['lq-math', 'lq-science', 'lq-history', 'lq-geography', 'lq-reading', 'lq-writing'];
  const rootDir = join(__dirname, '..');

  console.log('=== Activity Type Scan ===\n');
  if (fix) {
    console.log('MODE: FIX (will modify files)\n');
  } else {
    console.log('MODE: DRY RUN (use --fix to modify files)\n');
  }

  const overall: ScanResult = {
    totalFiles: 0,
    totalActivities: 0,
    stats: new Map(),
    unrecognized: new Map(),
    changedFiles: new Map(),
  };

  for (const subject of subjects) {
    const subjectDir = join(rootDir, subject);

    // Check if directory exists
    try {
      statSync(subjectDir);
    } catch {
      console.log(`Skipping ${subject} (not found)`);
      continue;
    }

    console.log(`\n--- ${subject} ---`);
    const result = scanSubject(subjectDir, fix);

    if (result.totalActivities === 0) {
      console.log('  No activities found');
      continue;
    }

    console.log(`  Files: ${result.totalFiles}, Activities: ${result.totalActivities}`);
    console.log('  Canonical types:');

    for (const [canonical, stats] of result.stats) {
      const total = Array.from(stats.variants.values()).reduce((a, b) => a + b, 0);
      console.log(`    ${canonical}: ${total} (${Array.from(stats.variants.entries()).map(([v, c]) => `${v}=${c}`).join(', ')})`);
    }

    overall.totalFiles += result.totalFiles;
    overall.totalActivities += result.totalActivities;
    for (const [k, v] of result.stats) {
      if (!overall.stats.has(k)) {
        overall.stats.set(k, { canonical: k, variants: new Map() });
      }
      const s = overall.stats.get(k)!;
      for (const [vk, vc] of v.variants) {
        s.variants.set(vk, (s.variants.get(vk) ?? 0) + vc);
      }
    }
    for (const [k, v] of result.unrecognized) {
      overall.unrecognized.set(k, (overall.unrecognized.get(k) ?? 0) + v);
    }

    if (fix && result.changedFiles.size > 0) {
      console.log(`  Fixed ${result.changedFiles.size} files:`);
      for (const [file, count] of result.changedFiles) {
        console.log(`    ${file}: ${count} changes`);
      }
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Total files modified: ${overall.totalFiles}`);
  console.log(`Total activities: ${overall.totalActivities}`);
  console.log('\nAll canonical types:');
  for (const [canonical, stats] of overall.stats) {
    const total = Array.from(stats.variants.values()).reduce((a, b) => a + b, 0);
    const variants = Array.from(stats.variants.entries())
      .filter(([v]) => v !== canonical)
      .map(([v, c]) => `${v}=${c}`)
      .join(', ');
    console.log(`  ${canonical}: ${total}${variants ? ` (${variants})` : ''}`);
  }

  if (overall.unrecognized.size > 0) {
    console.log('\nUnrecognized types (no mapping):');
    for (const [type, count] of overall.unrecognized) {
      console.log(`  ${type}: ${count}`);
    }
  }
}

main();
