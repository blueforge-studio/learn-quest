/**
 * Lesson validation using Zod schemas from @learnquest/validation-schemas.
 * Imports schemas via relative path to lq-tools source.
 */

// Re-export the LessonSchema from the validation-schemas package
export { LessonSchema, LessonFileSchema } from '../../lq-tools/packages/validation-schemas/src/lessons/schemas/index.js';
export type { Lesson, LessonFile } from '../../lq-tools/packages/validation-schemas/src/lessons/schemas/index.js';

import { LessonSchema } from '../../lq-tools/packages/validation-schemas/src/lessons/schemas/index.js';
import type { ZodError } from 'zod';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate a single lesson object against the Zod schema.
 */
export function validateLesson(lesson: unknown): ValidationResult {
  const result = LessonSchema.safeParse(lesson);
  if (result.success) {
    return { valid: true, errors: [], warnings: [] };
  }
  return {
    valid: false,
    errors: result.error.issues.map(issue =>
      `${issue.path.join('.')}: ${issue.message}`
    ),
    warnings: [],
  };
}

/**
 * Validate a lesson file (with lessons array wrapper).
 */
export function validateLessonFile(data: unknown): ValidationResult {
  if (typeof data !== 'object' || data === null) {
    return { valid: false, errors: ['Not an object'], warnings: [] };
  }

  const obj = data as Record<string, unknown>;
  const lessons = obj.lessons;

  if (!Array.isArray(lessons) || lessons.length === 0) {
    return { valid: false, errors: ['Missing or empty "lessons" array'], warnings: [] };
  }

  const allErrors: string[] = [];
  const allWarnings: string[] = [];

  for (let i = 0; i < lessons.length; i++) {
    const result = validateLesson(lessons[i]);
    if (!result.valid) {
      allErrors.push(...result.errors.map(e => `lessons[${i}].${e}`));
    }
    allWarnings.push(...result.warnings);
  }

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
  };
}
