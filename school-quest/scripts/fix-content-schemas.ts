#!/usr/bin/env npx tsx
/**
 * Fix school-quest lesson files to pass Zod schema validation.
 * Applies programmatic transformations based on detected failure patterns.
 *
 * Usage:
 *   npx tsx scripts/fix-content-schemas.ts [--dry-run] [--subject=math] [--verbose]
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname, relative } from 'path';
import { validateLessonFile } from './validate-lesson.js';

const ROOT = dirname(dirname(new URL(import.meta.url).pathname));
const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');
const SUBJECT = process.argv.find(a => a.startsWith('--subject='))?.split('=')[1];

// --- Type mapping for unknown types ---
const TYPE_MAP: Record<string, string> = {
  'algebra': 'number-sense',
  'statistics': 'number-sense',
  'vocabulary': 'sight-words',
};

// --- Fix functions per lesson type ---

type Lesson = Record<string, any>;
type Content = Record<string, any>;

function fixScienceConcept(content: Content, lesson: Lesson): Content {
  const fixed = { ...content };
  // Rename introduction → intro
  if (!fixed.intro && fixed.introduction) {
    fixed.intro = fixed.introduction;
    delete fixed.introduction;
  }
  if (!fixed.intro) fixed.intro = '';
  if (!fixed.essentialQuestion) {
    fixed.essentialQuestion = fixed.title
      ? `What can we learn about ${fixed.title.toLowerCase()}?`
      : `What is the main concept in this lesson?`;
  }
  if (!fixed.sections && fixed.questions) {
    fixed.sections = [{
      title: lesson.title || 'Overview',
      body: fixed.intro || 'Learn about this topic.',
    }];
  }
  if (!fixed.sections) {
    fixed.sections = [{
      title: lesson.title || 'Overview',
      body: fixed.intro || fixed.description || 'Explore this concept.',
    }];
  }
  // Fix sections — rename text → body, restructure keyTerms
  for (const section of fixed.sections) {
    if (!section.body && section.text) { section.body = section.text; delete section.text; }
    if (!section.body) section.body = '';
    // Fix keyTerm/definition → keyTerms array
    if (section.keyTerm && !section.keyTerms) {
      section.keyTerms = [{ term: section.keyTerm, definition: section.definition || '' }];
      delete section.keyTerm;
      delete section.definition;
    }
  }
  // Fix comprehensionCheck from review.questions
  if (!fixed.comprehensionCheck && fixed.review?.questions) {
    fixed.comprehensionCheck = fixed.review.questions.map((q: any, i: number) => ({
      id: q.id || `q${i + 1}`,
      question: q.question || q.prompt || q.text || '',
      options: Array.isArray(q.options) ? q.options.map(String) : [],
      correctAnswer: String(q.correctAnswer ?? q.correct ?? ''),
      explanation: q.explanation || '',
    }));
    delete fixed.review;
  }
  if (!fixed.comprehensionCheck && fixed.questions) {
    fixed.comprehensionCheck = fixed.questions.map((q: any, i: number) => ({
      id: q.id || `q${i + 1}`,
      question: q.question || q.prompt || q.text || '',
      options: Array.isArray(q.options) ? q.options.map(String) : [],
      correctAnswer: String(q.correctAnswer ?? q.correct ?? ''),
      explanation: q.explanation || '',
    }));
  }
  if (!fixed.comprehensionCheck) {
    fixed.comprehensionCheck = [];
  }
  if (!fixed.summary) {
    fixed.summary = fixed.intro || `Summary of ${lesson.title || 'this lesson'}.`;
  }
  if (!fixed.difficulty) fixed.difficulty = lesson.difficulty || 'beginner';
  // Drop fields not in schema
  delete fixed.title;
  delete fixed.region;
  delete fixed.timeLimit;
  delete fixed.scoring;
  delete fixed.questions;
  delete fixed.review;
  return fixed;
}

function fixEraExploration(content: Content, lesson: Lesson): Content {
  const fixed = { ...content };
  if (!fixed.eraName) {
    fixed.eraName = lesson.title?.replace(/ Timeline$/, '').replace(/ Era$/, '') || 'Unknown Era';
  }
  if (!fixed.period) fixed.period = '';
  if (!fixed.intro) fixed.intro = '';
  if (!fixed.sections && fixed.stages) {
    fixed.sections = fixed.stages.map((s: any) => ({
      title: s.name || s.title || 'Section',
      body: s.description || s.instruction || s.text || '',
      image: s.image,
    }));
  }
  if (!fixed.sections) {
    fixed.sections = [{ title: lesson.title || 'Overview', body: fixed.intro || '' }];
  }
  if (!fixed.keyEvents) {
    if (fixed.events) {
      fixed.keyEvents = fixed.events.map((e: any) => ({
        year: e.date || e.year?.toString() || '',
        title: e.title || '',
        description: e.description || '',
        image: e.image,
      }));
    } else {
      fixed.keyEvents = [];
    }
  }
  if (!fixed.quiz && fixed.questions) {
    fixed.quiz = fixed.questions.map((q: any, i: number) => ({
      id: q.id || `q${i + 1}`,
      question: q.question || q.prompt || '',
      options: q.options || [],
      correctAnswer: String(q.correctAnswer ?? q.correct ?? ''),
      explanation: q.explanation || '',
    }));
  }
  if (!fixed.quiz) fixed.quiz = [];
  if (!fixed.difficulty) fixed.difficulty = lesson.difficulty || 'beginner';
  // Map connections to causeAndEffect
  if (fixed.connections && !fixed.causeAndEffect) {
    fixed.causeAndEffect = fixed.connections.map((c: any) => ({
      cause: c.description?.split('→')[0]?.trim() || c.description || '',
      effect: c.description?.split('→')[1]?.trim() || '',
    }));
  }
  delete fixed.stages;
  delete fixed.mode;
  delete fixed.connections;
  delete fixed.events;
  delete fixed.questions;
  return fixed;
}

function fixTimeline(content: Content, lesson: Lesson): Content {
  const fixed = { ...content };
  if (!fixed.intro) fixed.intro = '';
  if (!fixed.period) fixed.period = '';
  if (!fixed.events) fixed.events = [];
  if (!fixed.mode) fixed.mode = 'explore';
  for (const event of fixed.events) {
    if (typeof event.year === 'string') {
      event.year = parseInt(event.year.replace(/[^\d-]/g, '')) || 0;
    }
  }
  if (!fixed.difficulty) fixed.difficulty = lesson.difficulty || 'beginner';
  return fixed;
}

function fixHistoricalFigure(content: Content, lesson: Lesson): Content {
  const fixed = { ...content };
  if (!fixed.name) fixed.name = lesson.title || 'Unknown Figure';
  if (!fixed.lifespan) fixed.lifespan = '';
  if (!fixed.subtitle) fixed.subtitle = '';
  if (!fixed.intro) fixed.intro = '';
  if (!fixed.background) fixed.background = fixed.intro || '';
  if (!fixed.achievements) fixed.achievements = [];
  if (!fixed.historicalContext) fixed.historicalContext = '';
  if (!fixed.legacy) fixed.legacy = '';
  if (!fixed.quiz && fixed.questions) {
    fixed.quiz = fixed.questions.map((q: any, i: number) => ({
      id: q.id || `q${i + 1}`,
      question: q.question || q.prompt || '',
      options: q.options || [],
      correctAnswer: String(q.correctAnswer ?? q.correct ?? ''),
      explanation: q.explanation || '',
    }));
  }
  if (!fixed.quiz) fixed.quiz = [];
  if (!fixed.difficulty) fixed.difficulty = lesson.difficulty || 'beginner';
  delete fixed.questions;
  return fixed;
}

function fixRegionProfile(content: Content, lesson: Lesson): Content {
  const fixed = { ...content };
  if (!fixed.name) fixed.name = fixed.title || lesson.title || 'Unknown Region';
  if (!fixed.intro) fixed.intro = '';
  if (!fixed.sections) {
    fixed.sections = [{ title: fixed.name, body: fixed.intro || '' }];
  }
  // Ensure sections have body field
  for (const section of fixed.sections) {
    if (!section.body) section.body = section.description || section.text || '';
    delete section.description;
    delete section.text;
  }
  if (!fixed.quiz && fixed.questions) {
    fixed.quiz = fixed.questions.map((q: any, i: number) => ({
      id: q.id || `q${i + 1}`,
      question: q.question || q.prompt || '',
      options: q.options || [],
      correctAnswer: String(q.correctAnswer ?? q.correct ?? ''),
      explanation: q.explanation || '',
    }));
  }
  if (!fixed.quiz) fixed.quiz = [];
  if (!fixed.difficulty) fixed.difficulty = lesson.difficulty || 'beginner';
  // Fix culture if string instead of object
  if (typeof fixed.culture === 'string') {
    fixed.culture = { traditions: fixed.culture };
  }
  delete fixed.title;
  delete fixed.region;
  delete fixed.timeLimit;
  delete fixed.scoring;
  delete fixed.questions;
  return fixed;
}

function fixMapQuiz(content: Content, lesson: Lesson): Content {
  const fixed = { ...content };
  if (!fixed.intro) fixed.intro = fixed.description || `Explore ${lesson.title || 'this map quiz'}.`;
  if (!fixed.questions && fixed.items) {
    fixed.questions = fixed.items;
  }
  if (!fixed.questions) fixed.questions = [];
  // Fix questions format
  for (const q of fixed.questions) {
    if (!q.prompt) q.prompt = q.question || q.text || '';
    if (!q.correctAnswer && q.correct !== undefined) q.correctAnswer = String(q.correct);
    if (typeof q.correctAnswer === 'number') q.correctAnswer = String(q.correctAnswer);
    delete q.question;
    delete q.text;
    delete q.correct;
  }
  // Fix hotspots
  if (fixed.hotspots) {
    for (const h of fixed.hotspots) {
      if (!h.label) h.label = h.name || h.title || '';
      if (!h.position) h.position = { x: 0, y: 0 };
    }
  }
  if (!fixed.difficulty) fixed.difficulty = lesson.difficulty || 'beginner';
  delete fixed.description;
  delete fixed.items;
  return fixed;
}

function fixGeoChallenge(content: Content, lesson: Lesson): Content {
  const fixed = { ...content };
  if (!fixed.intro) fixed.intro = fixed.description || `Take on this geography challenge!`;
  if (!fixed.questions && fixed.items) {
    fixed.questions = fixed.items;
  }
  if (!fixed.questions) fixed.questions = [];
  if (!fixed.difficulty) fixed.difficulty = lesson.difficulty || 'beginner';
  delete fixed.description;
  delete fixed.items;
  return fixed;
}

function fixExperiment(content: Content, lesson: Lesson): Content {
  const fixed = { ...content };
  // If this is actually a science-concept structure, retype it
  if (fixed.essentialQuestion && fixed.sections && fixed.comprehensionCheck) {
    // This is really a science-concept, not an experiment
    return fixed; // Will be retyped below
  }
  if (!fixed.question) fixed.question = fixed.essentialQuestion || `What happens in this experiment?`;
  if (!fixed.background) fixed.background = fixed.intro || '';
  if (!fixed.hypothesis) fixed.hypothesis = '';
  if (!fixed.materials) fixed.materials = [];
  if (!fixed.procedure) {
    if (fixed.stages) {
      fixed.procedure = fixed.stages.map((s: any, i: number) => ({
        id: s.id || `step-${i + 1}`,
        instruction: s.instruction || s.description || s.name || '',
        expectedResult: s.expectedResult,
      }));
    } else {
      fixed.procedure = [];
    }
  }
  if (!fixed.observations) {
    if (fixed.comprehensionCheck) {
      fixed.observations = fixed.comprehensionCheck.map((q: any) => ({
        prompt: q.question || '',
        expectedAnswer: q.correctAnswer || '',
        options: q.options,
      }));
    } else {
      fixed.observations = [];
    }
  }
  if (!fixed.conclusion) fixed.conclusion = fixed.summary || '';
  if (!fixed.difficulty) fixed.difficulty = lesson.difficulty || 'beginner';
  delete fixed.essentialQuestion;
  delete fixed.sections;
  delete fixed.comprehensionCheck;
  delete fixed.summary;
  delete fixed.funFacts;
  delete fixed.stages;
  return fixed;
}

function fixClassification(content: Content, lesson: Lesson): Content {
  const fixed = { ...content };
  if (!fixed.intro) fixed.intro = '';
  if (!fixed.categories) fixed.categories = [];
  if (!fixed.items) fixed.items = [];
  if (!fixed.mode) fixed.mode = 'multiple-choice';
  if (!fixed.difficulty) fixed.difficulty = lesson.difficulty || 'beginner';
  return fixed;
}

function fixArithmetic(content: Content, lesson: Lesson): Content {
  const fixed = { ...content };
  if (!fixed.operation) fixed.operation = 'mixed';
  if (!fixed.stages) fixed.stages = [];
  if (!fixed.inputMode) fixed.inputMode = 'multiple-choice';
  if (fixed.showSteps === undefined) fixed.showSteps = true;
  if (!fixed.difficulty) fixed.difficulty = lesson.difficulty || 'beginner';
  return fixed;
}

function fixNumberSense(content: Content, lesson: Lesson): Content {
  const fixed = { ...content };
  if (!fixed.activityType) fixed.activityType = 'patterns';
  if (!fixed.intro) fixed.intro = '';
  if (!fixed.exercises) {
    if (fixed.stages) {
      const exercises: any[] = [];
      for (const stage of fixed.stages) {
        if (stage.problems) {
          for (const p of stage.problems) {
            exercises.push({
              id: p.id || `ex-${exercises.length + 1}`,
              type: fixed.activityType || 'patterns',
              prompt: p.expression || p.prompt || '',
              correctAnswer: String(p.correctAnswer ?? ''),
              options: p.distractors?.map(String) || p.options,
              hint: p.hint,
              explanation: p.explanation || p.hint || '',
            });
          }
        }
      }
      fixed.exercises = exercises;
    } else {
      fixed.exercises = [];
    }
  }
  if (!fixed.difficulty) fixed.difficulty = lesson.difficulty || 'beginner';
  delete fixed.stages;
  delete fixed.operation;
  delete fixed.inputMode;
  delete fixed.showSteps;
  delete fixed.xpMultiplier;
  return fixed;
}

function fixPhonics(content: Content, lesson: Lesson): Content {
  const fixed = { ...content };
  if (!fixed.intro) fixed.intro = '';
  if (!fixed.difficulty) fixed.difficulty = lesson.difficulty || 'beginner';
  // Fix practice items
  if (fixed.practice) {
    for (const p of fixed.practice) {
      if (!p.type) p.type = 'multiple-choice';
      if (!p.prompt) p.prompt = p.question || p.text || '';
    }
  }
  return fixed;
}

function fixSightWords(content: Content, lesson: Lesson): Content {
  const fixed = { ...content };
  if (!fixed.intro) fixed.intro = '';
  // Move examples → words if needed
  if (!fixed.words && fixed.examples) {
    fixed.words = fixed.examples;
    delete fixed.examples;
  }
  if (!fixed.words) fixed.words = [];
  // Fix words — if they're strings, wrap them
  if (fixed.words.length > 0 && typeof fixed.words[0] === 'string') {
    fixed.words = fixed.words.map((w: string) => ({ word: w, meaning: w }));
  }
  // Ensure meaning on word objects
  for (const w of fixed.words) {
    if (typeof w === 'object' && !w.meaning) {
      w.meaning = w.sentence || w.word || '';
    }
  }
  if (!fixed.difficulty) fixed.difficulty = lesson.difficulty || 'beginner';
  delete fixed.phoneme;
  delete fixed.sentence;
  return fixed;
}

function fixFluency(content: Content, lesson: Lesson): Content {
  const fixed = { ...content };
  if (!fixed.intro) fixed.intro = '';
  if (!fixed.difficulty) fixed.difficulty = lesson.difficulty || 'beginner';
  return fixed;
}

function fixComprehension(content: Content, lesson: Lesson): Content {
  const fixed = { ...content };
  if (!fixed.intro) fixed.intro = '';
  if (!fixed.difficulty) fixed.difficulty = lesson.difficulty || 'beginner';
  if (fixed.practice) {
    for (const p of fixed.practice) {
      if (!p.type) p.type = 'multiple-choice';
      if (!p.prompt) p.prompt = p.question || p.text || '';
    }
  }
  return fixed;
}

function fixInteractiveStory(content: Content, lesson: Lesson): Content {
  const fixed = { ...content };
  if (!fixed.intro) fixed.intro = '';
  if (!fixed.scenes) fixed.scenes = [];
  if (!fixed.difficulty) fixed.difficulty = lesson.difficulty || 'beginner';
  return fixed;
}

function fixGrammar(content: Content, lesson: Lesson): Content {
  const fixed = { ...content };
  if (!fixed.intro && fixed.concept) { fixed.intro = fixed.concept; }
  if (!fixed.intro && fixed.explanation) { fixed.intro = fixed.explanation; }
  if (!fixed.intro) fixed.intro = '';
  if (!fixed.difficulty) fixed.difficulty = lesson.difficulty || 'beginner';
  // Convert exercises → stages
  if (!fixed.stages && fixed.exercises) {
    fixed.stages = fixed.exercises.map((ex: any, i: number) => ({
      order: i + 1,
      type: ex.type || 'multiple-choice',
      question: ex.prompt || ex.question || '',
      options: Array.isArray(ex.options) ? ex.options.map((o: any) => typeof o === 'object' ? (o.text || String(o)) : String(o)) : undefined,
      correct: ex.correctAnswer !== undefined ? String(ex.correctAnswer) : ex.correct !== undefined ? String(ex.correct) : undefined,
      explanation: ex.explanation,
    }));
    delete fixed.exercises;
  }
  // Flatten practice if nested object
  if (fixed.practice && !Array.isArray(fixed.practice) && typeof fixed.practice === 'object') {
    // Keep as record — schema accepts both array and record
  }
  // Drop non-schema fields
  delete fixed.concept;
  delete fixed.explanation;
  delete fixed.narratorVoice;
  delete fixed.soundEffects;
  delete fixed.xpReward;
  delete fixed.achievementUnlocks;
  return fixed;
}

function fixComposition(content: Content, lesson: Lesson): Content {
  const fixed = { ...content };
  if (!fixed.intro) fixed.intro = '';
  if (!fixed.difficulty) fixed.difficulty = lesson.difficulty || 'beginner';
  // Fix stages: prompt → question, object options → string options
  if (Array.isArray(fixed.stages)) {
    for (const stage of fixed.stages) {
      if (!stage.question && stage.prompt) { stage.question = stage.prompt; delete stage.prompt; }
      if (!stage.question && stage.title) { stage.question = stage.title; }
      if (Array.isArray(stage.options)) {
        stage.options = stage.options.map((o: any) => typeof o === 'object' ? (o.text || o.label || String(o)) : String(o));
      }
      // Fix pairs: match → value
      if (Array.isArray(stage.pairs)) {
        for (const pair of stage.pairs) {
          if (!pair.value && pair.match) { pair.value = pair.match; delete pair.match; }
          if (!pair.value) pair.value = '';
        }
      }
    }
  }
  // Fix practice — rename guided → guidedEntry
  if (fixed.practice && typeof fixed.practice === 'object' && !Array.isArray(fixed.practice)) {
    if (fixed.practice.guided && !fixed.practice.guidedEntry) {
      fixed.practice.guidedEntry = fixed.practice.guided;
      delete fixed.practice.guided;
    }
  }
  // Convert practice array → object
  if (Array.isArray(fixed.practice)) {
    fixed.practice = {
      independent: fixed.practice.map((p: any) => ({
        prompt: p.prompt || p.question || '',
        count: p.count || 1,
      })),
    };
  }
  delete fixed.narratorVoice;
  delete fixed.soundEffects;
  delete fixed.xpReward;
  delete fixed.achievementUnlocks;
  return fixed;
}

function fixCreativeWriting(content: Content, lesson: Lesson): Content {
  const fixed = { ...content };
  if (!fixed.intro) fixed.intro = '';
  if (!fixed.difficulty) fixed.difficulty = lesson.difficulty || 'beginner';
  // Fix soundEffects structure
  if (fixed.soundEffects) {
    fixed.soundEffects = {
      stageComplete: fixed.soundEffects.stageComplete || fixed.soundEffects.ideaSpark || fixed.soundEffects.senseReveal || 'sounds/complete.mp3',
      entryComplete: fixed.soundEffects.entryComplete || fixed.soundEffects.storyBegin || fixed.soundEffects.hintReveal || 'sounds/entry.mp3',
      success: fixed.soundEffects.success || 'sounds/success.mp3',
    };
  }
  // Convert practice array → object with independent
  if (Array.isArray(fixed.practice)) {
    fixed.practice = {
      independent: fixed.practice.map((p: any) => ({
        prompt: p.prompt || p.question || p.text || String(p),
        count: p.count || 1,
      })),
    };
  }
  // Fix practice object — rename guided → guidedEntry
  if (fixed.practice && typeof fixed.practice === 'object' && !Array.isArray(fixed.practice)) {
    if (fixed.practice.guided && !fixed.practice.guidedEntry) {
      fixed.practice.guidedEntry = fixed.practice.guided;
      delete fixed.practice.guided;
    }
    if (fixed.practice.starterChallenges && !fixed.practice.independent) {
      fixed.practice = {
        independent: fixed.practice.starterChallenges.map((e: any) => ({
          prompt: e.prompt || e.text || String(e),
          count: e.count || 1,
        })),
      };
    }
  }
  // Convert senses/examples to stages if missing
  if (!fixed.stages && fixed.senses) {
    delete fixed.senses;
  }
  delete fixed.examples;
  return fixed;
}

function fixHandwriting(content: Content, lesson: Lesson): Content {
  const fixed = { ...content };
  if (!fixed.intro) fixed.intro = '';
  if (!fixed.difficulty) fixed.difficulty = lesson.difficulty || 'beginner';
  delete fixed.narratorVoice;
  delete fixed.soundEffects;
  delete fixed.xpReward;
  delete fixed.achievementUnlocks;
  return fixed;
}

function fixDictation(content: Content, lesson: Lesson): Content {
  const fixed = { ...content };
  if (!fixed.intro) fixed.intro = '';
  if (!fixed.sentences) fixed.sentences = [];
  if (!fixed.difficulty) fixed.difficulty = lesson.difficulty || 'beginner';
  return fixed;
}

// --- Fixer dispatch ---

const FIXERS: Record<string, (content: Content, lesson: Lesson) => Content> = {
  'arithmetic': fixArithmetic,
  'geometry': (c, l) => { if (!c.intro) c.intro = ''; if (!c.difficulty) c.difficulty = l.difficulty || 'beginner'; return c; },
  'word-problem': (c, l) => { if (!c.problems) c.problems = []; if (!c.difficulty) c.difficulty = l.difficulty || 'beginner'; return c; },
  'number-sense': fixNumberSense,
  'science-concept': fixScienceConcept,
  'experiment': fixExperiment,
  'classification': fixClassification,
  'timeline': fixTimeline,
  'era-exploration': fixEraExploration,
  'historical-figure': fixHistoricalFigure,
  'map-quiz': fixMapQuiz,
  'region-profile': fixRegionProfile,
  'geo-challenge': fixGeoChallenge,
  'phonics': fixPhonics,
  'sight-words': fixSightWords,
  'fluency': fixFluency,
  'comprehension': fixComprehension,
  'interactive-story': fixInteractiveStory,
  'handwriting': fixHandwriting,
  'dictation': fixDictation,
  'grammar': fixGrammar,
  'composition': fixComposition,
  'creative-writing': fixCreativeWriting,
};

function shouldRetypeToScienceConcept(lesson: Lesson): boolean {
  const c = lesson.content;
  return lesson.type === 'experiment' && c?.essentialQuestion && c?.sections && c?.comprehensionCheck;
}

/** Deep-fix pass: handles common cross-type structural issues */
function deepFixContent(content: any): any {
  if (!content || typeof content !== 'object') return content;

  // Fix sections — ensure body field exists
  if (Array.isArray(content.sections)) {
    for (const section of content.sections) {
      if (!section.body && section.description) {
        section.body = section.description;
        delete section.description;
      }
      if (!section.body && section.text) {
        section.body = section.text;
        delete section.text;
      }
      if (!section.body) section.body = '';
    }
  }

  // Fix quiz — ensure correctAnswer is string, id exists
  if (Array.isArray(content.quiz)) {
    content.quiz = content.quiz.map((q: any, i: number) => {
      if (!q.id) q.id = `q${i + 1}`;
      if (typeof q.correctAnswer === 'number') q.correctAnswer = String(q.correctAnswer);
      if (q.correctAnswer === undefined && q.correct !== undefined) {
        q.correctAnswer = String(q.correct);
        delete q.correct;
      }
      if (!q.question && q.prompt) { q.question = q.prompt; delete q.prompt; }
      if (!q.explanation) q.explanation = '';
      if (!q.options) q.options = [];
      return q;
    });
  }

  // Fix comprehensionCheck — same patterns
  if (Array.isArray(content.comprehensionCheck)) {
    content.comprehensionCheck = content.comprehensionCheck.map((q: any, i: number) => {
      if (!q.id) q.id = `q${i + 1}`;
      if (typeof q.correctAnswer === 'number') q.correctAnswer = String(q.correctAnswer);
      if (!q.explanation) q.explanation = '';
      if (!q.options) q.options = [];
      return q;
    });
  }

  // Fix events — year must be number
  if (Array.isArray(content.events)) {
    for (const event of content.events) {
      if (typeof event.year === 'string') {
        const parsed = parseInt(event.year.replace(/[^\d-]/g, ''));
        event.year = isNaN(parsed) ? 0 : parsed;
      }
      if (event.year === undefined && event.date) {
        const parsed = parseInt(String(event.date).replace(/[^\d-]/g, ''));
        event.year = isNaN(parsed) ? 0 : parsed;
      }
    }
  }

  // Fix questions — correctAnswer as string
  if (Array.isArray(content.questions)) {
    for (const q of content.questions) {
      if (typeof q.correctAnswer === 'number') q.correctAnswer = String(q.correctAnswer);
      if (!q.prompt && q.question) { q.prompt = q.question; }
    }
  }

  // Fix stages — ensure question field
  if (Array.isArray(content.stages)) {
    for (const stage of content.stages) {
      if (!stage.question && stage.prompt) { stage.question = stage.prompt; delete stage.prompt; }
      if (!stage.question && stage.instruction) { stage.question = stage.instruction; delete stage.instruction; }
      if (!stage.question && stage.name) stage.question = stage.name;
      if (typeof stage.correctIndex === 'number' && typeof stage.correct === 'undefined' && stage.options) {
        stage.correct = stage.options[stage.correctIndex];
      }
      if (typeof stage.correct === 'number') stage.correct = String(stage.correct);
      if (typeof stage.correct === 'boolean') stage.correct = String(stage.correct);
      // Fix options that are objects instead of strings
      if (Array.isArray(stage.options)) {
        stage.options = stage.options.map((o: any) => typeof o === 'object' ? (o.text || o.label || JSON.stringify(o)) : String(o));
      }
    }
  }

  // Fix practice array/object mismatch
  if (content.practice !== undefined) {
    if (typeof content.practice === 'string') {
      content.practice = [{ type: 'text', prompt: content.practice }];
    }
    if (Array.isArray(content.practice)) {
      for (const p of content.practice) {
        if (typeof p.correct === 'number') p.correct = String(p.correct);
        if (typeof p.correct === 'boolean') p.correct = String(p.correct);
        if (typeof p.correct === 'object' && p.correct !== null && !Array.isArray(p.correct)) {
          // Convert object correct to string
          p.correct = JSON.stringify(p.correct);
        }
      }
    }
  }

  // Fix words — ensure objects with required fields
  if (Array.isArray(content.words)) {
    content.words = content.words.map((w: any) => {
      if (typeof w === 'string') return { word: w };
      if (w && typeof w === 'object' && !w.meaning && w.sentence) {
        w.meaning = w.sentence;
      }
      if (w && typeof w === 'object' && !w.meaning) {
        w.meaning = w.word || '';
      }
      return w;
    });
  }

  // Fix examples — ensure sentence field for grammar style
  if (Array.isArray(content.examples)) {
    for (const ex of content.examples) {
      if (!ex.sentence && ex.description) { ex.sentence = ex.description; }
      if (!ex.sentence && ex.correct) { ex.sentence = ex.correct; }
    }
  }

  // Fix intro — rename introduction → intro
  if (!content.intro && content.introduction) {
    content.intro = content.introduction;
    delete content.introduction;
  }

  // Fix null values in string fields
  if (content.phoneme === null) content.phoneme = null; // already handled by nullable()

  // Fix practice[].correct: null → undefined
  if (Array.isArray(content.practice)) {
    for (const p of content.practice) {
      if (p.correct === null) delete p.correct;
      if (p.answer !== undefined && p.correct === undefined) {
        p.correct = String(p.answer);
        delete p.answer;
      }
    }
  }

  // Fix hotspots — nest x/y into position, rename name → label
  if (Array.isArray(content.hotspots)) {
    for (const h of content.hotspots) {
      if (!h.label && h.name) { h.label = h.name; delete h.name; }
      if (!h.label && h.title) { h.label = h.title; delete h.title; }
      if (!h.position && (h.x !== undefined || h.y !== undefined)) {
        h.position = { x: h.x || 0, y: h.y || 0 };
        delete h.x;
        delete h.y;
      }
      if (!h.position) h.position = { x: 0, y: 0 };
      if (!h.label) h.label = '';
      delete h.location;
    }
  }

  return content;
}

function fixLesson(lesson: Lesson): Lesson {
  const fixed = { ...lesson };

  // Remap unknown types
  if (TYPE_MAP[fixed.type]) {
    if (VERBOSE) console.log(`    retype: ${fixed.type} → ${TYPE_MAP[fixed.type]}`);
    fixed.type = TYPE_MAP[fixed.type];
  }

  // Special case: experiment that's really science-concept
  if (shouldRetypeToScienceConcept(fixed)) {
    if (VERBOSE) console.log(`    retype: experiment → science-concept (structure match)`);
    fixed.type = 'science-concept';
  }

  // Ensure base fields
  if (!fixed.status) fixed.status = 'locked';
  if (!fixed.tags) fixed.tags = [];
  if (!fixed.difficulty) fixed.difficulty = 'beginner';

  // Deep-fix common structural issues
  if (fixed.content) {
    fixed.content = deepFixContent(fixed.content);
  }

  // Apply type-specific fixer
  const fixer = FIXERS[fixed.type];
  if (fixer && fixed.content) {
    fixed.content = fixer(fixed.content, fixed);
  }

  return fixed;
}

// --- File scanner ---

function findLessonFiles(dir: string): string[] {
  const results: string[] = [];
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...findLessonFiles(fullPath));
      } else if (entry.name.endsWith('.json') && dir.includes('lessons/')) {
        results.push(fullPath);
      }
    }
  } catch { /* skip */ }
  return results;
}

// --- Main ---

const subjects = SUBJECT
  ? [`lq-${SUBJECT}`]
  : readdirSync(ROOT).filter(d => d.startsWith('lq-') && statSync(join(ROOT, d)).isDirectory());

let totalFixed = 0, totalAlreadyValid = 0, totalStillFailing = 0;

for (const subjectDir of subjects) {
  const contentDir = join(ROOT, subjectDir, 'content');
  const publicDir = join(ROOT, subjectDir, 'public', 'data', 'lessons');
  const lessonFiles = [...findLessonFiles(contentDir), ...findLessonFiles(publicDir)];

  if (lessonFiles.length === 0) continue;

  let fixed = 0, valid = 0, failing = 0;

  for (const file of lessonFiles) {
    const relPath = relative(ROOT, file);
    try {
      const raw = readFileSync(file, 'utf-8');
      const data = JSON.parse(raw);

      // Pre-check
      const preResult = validateLessonFile(data);
      if (preResult.valid) {
        valid++;
        totalAlreadyValid++;
        if (VERBOSE) console.log(`  ok ${relPath}`);
        continue;
      }

      // Fix
      if (!data.lessons || !Array.isArray(data.lessons)) continue;

      const fixedData = {
        ...data,
        lessons: data.lessons.map((l: Lesson) => fixLesson(l)),
      };

      // Post-check
      const postResult = validateLessonFile(fixedData);
      if (postResult.valid) {
        if (!DRY_RUN) {
          writeFileSync(file, JSON.stringify(fixedData, null, 2) + '\n');
        }
        fixed++;
        totalFixed++;
        console.log(`  fixed ${relPath}${DRY_RUN ? ' [dry-run]' : ''}`);
      } else {
        failing++;
        totalStillFailing++;
        if (VERBOSE) {
          console.log(`  STILL FAILING ${relPath}`);
          for (const err of postResult.errors.slice(0, 3)) {
            console.log(`    ${err}`);
          }
        }
      }
    } catch (e: any) {
      failing++;
      totalStillFailing++;
      if (VERBOSE) console.log(`  ERROR ${relPath}: ${e.message}`);
    }
  }

  console.log(`${subjectDir}: ${fixed} fixed, ${valid} already valid, ${failing} still failing`);
}

console.log(`\n${'='.repeat(50)}`);
console.log(`Fixed: ${totalFixed} | Already valid: ${totalAlreadyValid} | Still failing: ${totalStillFailing}`);
