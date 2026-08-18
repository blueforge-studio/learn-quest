#!/usr/bin/env npx tsx
/**
 * Modular validation system for school-quest lessons.
 *
 * Usage:
 *   npx tsx scripts/validate-all-content.ts [--subject=math] [--subjects=math,science,geography] [--verbose] [--parallel]
 *
 * Architecture:
 *   - CoreValidator: Base validation logic for standard lesson format
 *   - Subject plugins: Override findFiles, transformFile, or skipFile for subject-specific behavior
 *   - History has special epoch/region structure requiring custom handling
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface FileInfo {
  path: string;
  relativePath: string;
  content: any;
  subject: string;
}

export interface SubjectPlugin {
  name: string;
  findLessonFiles: (root: string, subject: string) => string[];
  transformFile?: (data: any, file: string) => { data: any; skip: boolean };
  skipFile?: (file: string, data: any) => boolean;
  customValidation?: (file: FileInfo) => ValidationResult | null;
  onResult?: (result: { file: string; valid: boolean; errors: string[] }, verbose: boolean) => void;
}

// ============ CORE VALIDATION SCHEMA ============

const LessonContentSchema = z.object({
  intro: z.string().optional(),
  sections: z.array(z.object({
    id: z.string().optional(),
    title: z.string(),
    body: z.string().optional(),
  })).optional(),
  quiz: z.array(z.object({
    id: z.string().optional(),
    question: z.string(),
    options: z.array(z.string()),
    correctAnswer: z.union([z.string(), z.number()]),
    explanation: z.string().optional(),
  })).optional(),
  events: z.array(z.object({
    id: z.string().optional(),
    date: z.string().optional(),
    year: z.union([z.number(), z.string()]).optional(),
    title: z.string(),
    description: z.string().optional(),
    significance: z.string().optional(),
  })).optional(),
  period: z.string().optional(),
  mode: z.string().optional(),
  eraName: z.string().optional(),
  keyEvents: z.array(z.any()).optional(),
  difficulty: z.string().optional(),
  background: z.string().optional(),
  legacy: z.string().optional(),
  summary: z.string().optional(),
  conclusion: z.string().optional(),
  title: z.string().optional(),
}).catchall(z.any());

const LessonSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  type: z.string(),
  content: LessonContentSchema,
  chapterId: z.string().optional(),
  status: z.string().optional(),
  xpReward: z.number().optional(),
  estimatedTime: z.number().optional(),
  difficulty: z.string().optional(),
  tags: z.array(z.string()).optional(),
  position: z.string().optional(),
  lastChangeType: z.enum(['content', 'image', 'metadata', 'initial', 'generated']).optional(),
});

const LessonFileSchema = z.object({
  lessons: z.array(LessonSchema).min(1),
});

export function validateLessonFile(data: unknown): ValidationResult {
  try {
    LessonFileSchema.parse(data);
    return { valid: true, errors: [], warnings: [] };
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return {
        valid: false,
        errors: e.errors.map(err => `${err.path.join('.')}: ${err.message}`),
        warnings: [],
      };
    }
    return { valid: false, errors: [e.message], warnings: [] };
  }
}

// ============ DEFAULT FINDER ============

function defaultFindLessonFiles(dir: string, subject: string): string[] {
  const results: string[] = [];
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...defaultFindLessonFiles(fullPath, subject));
      } else if (entry.name.endsWith('.json') && dir.includes('lessons/')) {
        results.push(fullPath);
      }
    }
  } catch { /* skip unreadable dirs */ }
  return results;
}

// ============ BUILT-IN PLUGINS ============

import fs from 'fs';

// History plugin - handles epoch/region structure and skips chapters.json manifests
const historyPlugin: SubjectPlugin = {
  name: 'history',
  findLessonFiles(root: string, subject: string): string[] {
    const results: string[] = [];
    const baseDir = join(root, subject, 'public', 'data', 'lessons', 'en');
    const epochs = ['ancient', 'medieval', 'early-modern', 'modern', 'contemporary', 'future', 'renaissance'];

    for (const epoch of epochs) {
      const epochDir = join(baseDir, epoch);
      if (!existsSync(epochDir)) continue;

      const regions = readdirSync(epochDir).filter(f => {
        const p = join(epochDir, f);
        return statSync(p).isDirectory() && !f.startsWith('.');
      });

      for (const region of regions) {
        const regionDir = join(epochDir, region);
        if (!statSync(regionDir).isDirectory()) continue;

        // Get chapter directories
        const chapters = readdirSync(regionDir).filter(f => {
          const p = join(regionDir, f);
          return statSync(p).isDirectory() && f.startsWith('chapter-');
        });

        for (const chapter of chapters) {
          const chapterDir = join(regionDir, chapter);
          const files = readdirSync(chapterDir).filter(f => f.endsWith('.json'));
          for (const file of files) {
            results.push(join(chapterDir, file));
          }
        }

        // Also check for files directly in region dir (like _general)
        const regionFiles = readdirSync(regionDir).filter(f => f.endsWith('.json'));
        for (const file of regionFiles) {
          // Skip chapters.json manifest
          if (file === 'chapters.json') continue;
          results.push(join(regionDir, file));
        }
      }
    }

    return results;
  },
  skipFile(file: string, data: any): boolean {
    // Skip non-lesson JSON files
    if (file.endsWith('chapters.json')) return true;
    if (!data.lessons || !Array.isArray(data.lessons)) return true;
    return false;
  },
  onResult(result: { file: string; valid: boolean; errors: string[] }, verbose: boolean) {
    if (result.valid && verbose) {
      console.log(`  PASS ${result.file}`);
    }
  }
};

// Standard plugin for math, science, etc.
function standardPlugin(subject: string): SubjectPlugin {
  return {
    name: subject,
    findLessonFiles(root: string, sub: string): string[] {
      const contentDir = join(root, sub, 'content');
      const publicDir = join(root, sub, 'public', 'data', 'lessons');
      return [
        ...defaultFindLessonFiles(contentDir, sub),
        ...defaultFindLessonFiles(publicDir, sub),
      ];
    },
    skipFile(file: string, data: any): boolean {
      // Skip chapters.json manifests
      if (file.endsWith('chapters.json')) return true;
      if (!data.lessons || !Array.isArray(data.lessons)) return true;
      return false;
    }
  };
}

// ============ VALIDATOR CLASS ============

export class LessonValidator {
  private plugins = new Map<string, SubjectPlugin>();
  private root: string;

  constructor(root: string = ROOT) {
    this.root = root;
    this.registerBuiltInPlugins();
  }

  private registerBuiltInPlugins() {
    // Register history plugin
    this.registerPlugin(historyPlugin);
    // Other plugins registered on-demand via registerPlugin
  }

  registerPlugin(plugin: SubjectPlugin) {
    this.plugins.set(plugin.name, plugin);
  }

  getPlugin(name: string): SubjectPlugin | undefined {
    return this.plugins.get(name);
  }

  getOrCreatePlugin(name: string): SubjectPlugin {
    if (this.plugins.has(name)) {
      return this.plugins.get(name)!;
    }
    const plugin = standardPlugin(name);
    this.plugins.set(name, plugin);
    return plugin;
  }

  validateSubject(subject: string, verbose: boolean = false): {
    found: number;
    skipped: number;
    valid: number;
    invalid: number;
    failures: { file: string; errors: string[] }[];
  } {
    const subjectName = subject.replace('lq-', '');
    const plugin = subjectName === 'history' ? this.getPlugin('history')! : this.getOrCreatePlugin(subjectName);

    const files = plugin.findLessonFiles(this.root, subject);
    let skipped = 0, valid = 0, invalid = 0;
    const failures: { file: string; errors: string[] }[] = [];

    for (const file of files) {
      try {
        const rawData = JSON.parse(readFileSync(file, 'utf-8'));

        // Check if should skip
        if (plugin.skipFile?.(file, rawData)) {
          skipped++;
          continue;
        }

        // Transform if needed
        let data = rawData;
        if (plugin.transformFile) {
          const result = plugin.transformFile(rawData, file);
          if (result.skip) { skipped++; continue; }
          data = result.data;
        }

        // Custom validation if plugin provides it
        let result: ValidationResult;
        if (plugin.customValidation) {
          const customResult = plugin.customValidation({
            path: file,
            relativePath: relative(this.root, file),
            content: data,
            subject,
          });
          if (customResult === null) {
            skipped++;
            continue;
          }
          result = customResult;
        } else {
          result = validateLessonFile(data);
        }

        if (result.valid) {
          valid++;
          plugin.onResult?.({ file: relative(this.root, file), valid: true, errors: [] }, verbose);
        } else {
          invalid++;
          const relPath = relative(this.root, file);
          failures.push({ file: relPath, errors: result.errors });
          console.log(`  FAIL ${relPath}`);
          for (const err of result.errors.slice(0, 3)) {
            console.log(`    ${err}`);
          }
          if (result.errors.length > 3) {
            console.log(`    ... and ${result.errors.length - 3} more`);
          }
        }
      } catch (e: any) {
        invalid++;
        console.log(`  ERROR ${relative(this.root, file)}: ${e.message}`);
      }
    }

    return { found: files.length, skipped, valid, invalid, failures };
  }

  async validateSubjects(subjects: string[], parallel: boolean = true, verbose: boolean = false): Promise<Map<string, { found: number; skipped: number; valid: number; invalid: number; failures: { file: string; errors: string[] }[] }>> {
    const results = new Map<string, { found: number; skipped: number; valid: number; invalid: number; failures: { file: string; errors: string[] }[] }>();

    const runValidate = async (subject: string) => {
      const result = this.validateSubject(subject, verbose);
      return { subject, result };
    };

    let validationResults;
    if (parallel && subjects.length > 1) {
      console.log('Running validation in parallel...\n');
      validationResults = await Promise.all(subjects.map(runValidate));
    } else {
      validationResults = subjects.map(s => ({ subject: s, result: this.validateSubject(s, verbose) }));
    }

    for (const { subject, result } of validationResults) {
      results.set(subject, result);
    }

    return results;
  }
}

// ============ CLI ============

async function main() {
  const subjectsArg = process.argv.find(a => a.startsWith('--subjects='))?.split('=')[1];
  const subjectArg = process.argv.find(a => a.startsWith('--subject='))?.split('=')[1];
  const verbose = process.argv.includes('--verbose');
  const parallel = process.argv.includes('--parallel') || (!subjectArg && !subjectsArg);

  let subjects: string[];
  if (subjectArg) {
    subjects = [`lq-${subjectArg}`];
  } else if (subjectsArg) {
    subjects = subjectsArg.split(',').map(s => s.trim()).map(s => s.startsWith('lq-') ? s : `lq-${s}`);
  } else {
    subjects = readdirSync(ROOT).filter(d => d.startsWith('lq-') && statSync(join(ROOT, d)).isDirectory());
  }

  console.log(`Validating: ${subjects.join(', ')}\n`);

  const validator = new LessonValidator(ROOT);
  const results = await validator.validateSubjects(subjects, parallel, verbose);

  let totalFound = 0, totalSkipped = 0, totalValid = 0, totalInvalid = 0;
  const allFailures: { subject: string; file: string; errors: string[] }[] = [];

  console.log('='.repeat(60));
  console.log('LESSON VALIDATION REPORT');
  console.log('='.repeat(60));

  for (const [subject, r] of results) {
    totalFound += r.found;
    totalSkipped += r.skipped;
    totalValid += r.valid;
    totalInvalid += r.invalid;
    for (const f of r.failures) {
      allFailures.push({ subject, file: f.file, errors: f.errors });
    }

    const subjectName = subject.replace('lq-', '');
    if (r.found > 0) {
      console.log(`\n${subjectName.toUpperCase()}`);
      console.log(`  Found:   ${r.found}`);
      console.log(`  Skipped: ${r.skipped} (chapters.json manifests)`);
      console.log(`  Valid:   ${r.valid}`);
      console.log(`  Invalid: ${r.invalid}`);
      if (r.invalid > 0) {
        console.log(`  → ${r.invalid} lesson files with schema errors`);
      }
    } else {
      console.log(`\n${subjectName.toUpperCase()}: no lesson files found`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total files found:   ${totalFound}`);
  console.log(`Manifests skipped:    ${totalSkipped} (chapters.json files)`);
  console.log(`Lessons validated:   ${totalValid}`);
  console.log(`Validation failures: ${totalInvalid}`);

  if (totalInvalid > 0) {
    console.log('\n' + '='.repeat(60));
    console.log('FAILURES');
    console.log('='.repeat(60));
    const bySubject = new Map<string, number>();
    for (const f of allFailures) {
      bySubject.set(f.subject, (bySubject.get(f.subject) || 0) + 1);
    }
    for (const [sub, count] of bySubject) {
      console.log(`  ${sub}: ${count} failures`);
    }
    process.exit(1);
  }
}

main();