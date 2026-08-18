/**
 * JSON extraction and validation utilities for AI-generated content.
 */

export function extractJson(response: string): string {
  let json = response;
  const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) json = jsonMatch[1];
  return json.trim();
}

export function parseAndValidate(
  json: string,
  expectedType: string,
  chapter: string,
  difficulty: string,
): { parsed: Record<string, unknown>; valid: boolean; errors: string[] } {
  const errors: string[] = [];
  let parsed: Record<string, unknown>;

  try {
    parsed = JSON.parse(json);
  } catch (e) {
    return { parsed: {}, valid: false, errors: [`JSON parse error: ${e instanceof Error ? e.message : String(e)}`] };
  }

  const lessons = (parsed as any).lessons;
  if (!Array.isArray(lessons) || lessons.length === 0) {
    errors.push('Missing or empty "lessons" array');
    return { parsed, valid: false, errors };
  }

  const lesson = lessons[0];

  if (lesson.type !== expectedType) errors.push(`Type mismatch: expected "${expectedType}", got "${lesson.type}"`);
  if (lesson.chapterId !== `chapter-${chapter}`) {
    lesson.chapterId = `chapter-${chapter}`; // auto-fix
  }
  if (lesson.difficulty !== difficulty) {
    lesson.difficulty = difficulty; // auto-fix
  }
  if (!lesson.content) errors.push('Missing content field');

  return { parsed, valid: errors.length === 0, errors };
}
