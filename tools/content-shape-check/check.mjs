#!/usr/bin/env node
// content-shape-check: deterministic, browser-free pre-check of lesson JSON.
//
// Why: the user-audit P0 spike found three lessons that crash on open because an item the screen renders
// as a string is an object in the content ("Objects are not valid as a React child"), and one drill whose
// `content` has the wrong layout. Those are decidable from the JSON alone.
//
// Two layers:
//   1. inferred  - per lesson type, learn the dominant kind (string/object/array/...) of every path from
//                  the corpus and flag instances that disagree, plus containers a type nearly always has.
//   2. explicit  - rules whose correct answer is known: answer key present in options, word-order tiles
//                  match the sentence, array-like objects, unresolved {{templates}}, sentinel strings.
//
// Usage: node check.mjs <lessonsDir> [--ui en] [--json out.json] [--quiet]
//   <lessonsDir> contains <ui>/<lang>/chapters/chapter-N/<id>.json   (e.g. <app>/public/data/lessons)
// Exit: 0 clean (warnings allowed), 1 errors found, 2 usage / read error.
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const root = args.find((a) => !a.startsWith('--') && a !== flag('--ui') && a !== flag('--json'));
if (!root || !fs.existsSync(root)) { console.error('usage: check.mjs <lessonsDir> [--ui en] [--json out.json] [--quiet]'); process.exit(2); }
const UI = flag('--ui'); const OUT = flag('--json'); const QUIET = args.includes('--quiet');
const DOMINANT = 0.9;      // a kind must account for >= 90% of instances to be "the" shape
const REQUIRED = 0.9;      // a container key present in >= 90% of a type's lessons is "required"
const MIN_TYPE_N = 8;
// Containers a screen cannot render without (verified against the screens / observed crashes). Everything else
// the corpus merely "usually has" is reported as a warning, not an error.
// Object-in-a-text-slot that the nordic screens were observed to survive (browser probe 2026-10-06, 5 culture
// lessons opened, none crashed). Still reported, as a warning: the content is inconsistent and may render oddly.
const TOLERATED = { culture: ['content.funFacts[]', 'content.tips[]'] };
const MUST_HAVE = { drill: ['content.progressiveStages'], 'multiple-choice': ['content.questions'], 'word-order': ['content.exercises'], spelling: ['content.words'] };      // don't infer from tiny corpora

const kindOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);
const isStructural = (k) => k === 'object' || k === 'array';
const isScalar = (k) => k === 'string' || k === 'number' || k === 'boolean';

// ---- load ---------------------------------------------------------------------------------------------
const files = [];
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else if (e.name.endsWith('.json')) files.push(f); } })(root);
const lessons = [];
for (const f of files) {
  const rel = path.relative(root, f).split(path.sep); // <ui>/<lang>/chapters/chapter-N/<id>.json
  if (rel.length < 5 || rel[2] !== 'chapters') continue;
  if (UI && rel[0] !== UI) continue;
  let j; try { j = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { lessons.push({ file: rel.join('/'), parseError: e.message }); continue; }
  const l = Array.isArray(j.lessons) ? j.lessons[0] : j.lessons && typeof j.lessons === 'object' ? Object.values(j.lessons)[0] : j;
  if (!l || typeof l !== 'object') { lessons.push({ file: rel.join('/'), parseError: 'no lesson object' }); continue; }
  const base = path.basename(f, '.json'); const type = l.type || 'unknown';
  // Inference group: electives carry their own content shapes (e.g. vocab `{items, slot}` vs core vocab arrays); pooling them hides drift in core lessons.
  lessons.push({ file: rel.join('/'), ui: rel[0], lang: rel[1], chapter: rel[3], base, lesson: l, type, group: type + (/^elective-/.test(base) ? '/elective' : '') });
}
if (!lessons.length) { console.error('no lesson files found under', root); process.exit(2); }

const findings = [];
const add = (L, severity, rule, p, detail) => findings.push({ severity, rule, file: L.file, type: L.type, path: p, detail });

// ---- layer 1: inference ---------------------------------------------------------------------------------
function visit(v, p, cb) {
  cb(p, v);
  if (Array.isArray(v)) v.forEach((x) => visit(x, p + '[]', cb));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) visit(x, p ? `${p}.${k}` : k, cb);
}
const stats = new Map(); // type -> { n, paths: Map(path -> {kinds:{}, lessons:Set}) }
const bump = (m, k, n = 1) => m.set(k, (m.get(k) || 0) + n);
for (const L of lessons) {
  if (L.parseError) continue;
  const t = (stats.get(L.group) || stats.set(L.group, { n: 0, paths: new Map() }).get(L.group)); t.n++;
  visit(L.lesson.content, 'content', (p, v) => {
    const s = t.paths.get(p) || t.paths.set(p, { kinds: {}, lessons: new Set(), total: 0 }).get(p);
    const k = kindOf(v); s.kinds[k] = (s.kinds[k] || 0) + 1; s.total++; s.lessons.add(L.file);
  });
}
const dominantKind = (s) => { let best = null, bn = 0; for (const [k, n] of Object.entries(s.kinds)) if (n > bn) { best = k; bn = n; } return bn / s.total >= DOMINANT ? best : null; };

for (const L of lessons) {
  if (L.parseError) { add(L, 'error', 'unparsable', '', L.parseError); continue; }
  const t = stats.get(L.group); const content = L.lesson.content;
  if (content === undefined || content === null) { add(L, 'error', 'no-content', 'content', 'lesson has no content'); continue; }
  if (t.n >= MIN_TYPE_N) {
    // kind conflicts: this instance is structural where the type is scalar (or vice versa)
    const seen = new Set();
    visit(content, 'content', (p, v) => {
      const s = t.paths.get(p); const dk = s && dominantKind(s); const k = kindOf(v);
      if (!dk || dk === k || seen.has(p)) return;
      if ((isScalar(dk) && isStructural(k)) || (isStructural(dk) && isScalar(k)) || (dk === 'array' && k === 'object') || (dk === 'object' && k === 'array')) {
        seen.add(p); { const tolerated = (TOLERATED[L.type] || []).includes(p);
        // A screen that iterates an array and is handed an object (or the reverse) crashes or renders nothing: observed as a blank
        // vocab lesson (ch16-20 `{items, slot}` where every other vocab lesson has an array) and as the drill crash.
        const structural = (dk === 'array' && k === 'object') || (dk === 'object' && k === 'array');
        const textSlot = isScalar(dk) && isStructural(k);
        const rule = structural ? 'array-object-mismatch' : textSlot ? (tolerated ? 'object-in-text-slot-tolerated' : 'object-where-text-expected') : 'shape-drift';
        add(L, (structural || (textSlot && !tolerated)) ? 'error' : 'warn', rule, p, `is ${k}; ${Math.round((s.kinds[dk] / s.total) * 100)}% of ${L.group} lessons have ${dk} here`); }
      }
    });
    // missing required containers (depth <= 2, structural only)
    for (const [p, s] of t.paths) {
      const depth = p.split('.').length; if (depth > 2 || p === 'content' || p.includes('[]')) continue;
      const dk = dominantKind(s); if (!dk || !isStructural(dk)) continue;
      if (s.lessons.size / t.n >= REQUIRED && !s.lessons.has(L.file)) add(L, (MUST_HAVE[L.type] || []).includes(p) ? 'error' : 'warn', (MUST_HAVE[L.type] || []).includes(p) ? 'missing-required' : 'missing-usual', p, `${Math.round((s.lessons.size / t.n) * 100)}% of ${L.type} lessons have a ${dk} here; this one does not`);
    }
  }
  // ---- layer 2: explicit rules -------------------------------------------------------------------------
  if (L.base !== L.lesson.id && L.lesson.id) add(L, 'warn', 'id-filename-mismatch', 'id', `id "${L.lesson.id}" vs file "${L.base}"`);
  visit(content, 'content', (p, v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) { const ks = Object.keys(v); if (ks.length > 1 && ks.every((k) => /^\d+$/.test(k))) add(L, 'error', 'array-like-object', p, `object keyed ${ks[0]}..${ks[ks.length - 1]}; should be an array or a named layout`); }
    if (typeof v === 'string') {
      const m = v.match(/\{\{\s*([\w.]+)\s*\}\}/g); if (m) add(L, 'error', 'unresolved-template', p, `${[...new Set(m)].join(', ')} in "${v.slice(0, 60)}"`);
      if (/^(undefined|null|\[object Object\]|NaN)$/.test(v.trim())) add(L, 'error', 'sentinel-string', p, `value is "${v}"`);
    }
  });
  const text = (o) => (typeof o === 'string' ? o : o?.targetLocale?.text ?? o?.text ?? null);
  const c = content;
  if (L.type === 'multiple-choice' && Array.isArray(c.questions)) c.questions.forEach((q, i) => answerKey(L, `content.questions[${i}]`, q));
  if (L.type === 'drill' && Array.isArray(c.progressiveStages)) c.progressiveStages.forEach((s, si) => (s.questions || []).forEach((q, i) => answerKey(L, `content.progressiveStages[${si}].questions[${i}]`, q)));
  if (L.type === 'word-order' && Array.isArray(c.exercises)) c.exercises.forEach((e, i) => {
    const want = String(e.correctSentence || '').toLowerCase().split(/\s+/).filter(Boolean).sort(); const have = (e.scrambledWords || []).map(text).filter((x) => x != null).flatMap((x) => String(x).toLowerCase().split(/\s+/)).filter(Boolean).sort();
    if (want.join('|') !== have.join('|')) add(L, 'error', 'word-order-mismatch', `content.exercises[${i}]`, `sentence tokens [${want.join(' ')}] != tiles [${have.join(' ')}]`);
  });
  // sound-pattern: the pairs quiz derives its question sound from the first word's graphemes (a taught soundId);
  // without one the screen renders nothing and the learner cannot advance (observed: chapter-1 -g and -d).
  if (L.type === 'sound-pattern' && Array.isArray(c.pairs) && Array.isArray(c.sounds)) {
    const taught = new Set(c.sounds.map((x) => x.soundId));
    c.pairs.forEach((p, i) => { if (!Array.isArray(p) || !p[0] || !(p[0].graphemes || []).some((g) => g.soundId && taught.has(g.soundId))) add(L, 'error', 'pair-without-sound-id', `content.pairs[${i}]`, 'first word has no grapheme with a taught soundId; the pairs screen renders blank'); });
  }
  if (L.type === 'spelling' && Array.isArray(c.words)) c.words.forEach((w, i) => { if (!w || typeof w.word !== 'string' || !w.word.trim()) add(L, 'error', 'spelling-no-word', `content.words[${i}]`, 'missing word'); });
  if (L.type === 'concept' && (!Array.isArray(c.sections) || c.sections.length === 0)) add(L, 'warn', 'concept-no-sections', 'content.sections', 'screen shows "Content coming soon" and no complete button');
  function answerKey(Lx, p, q) {
    if (!q || !Array.isArray(q.options) || q.correctAnswer === undefined) return;
    const opts = q.options.map(text); const ans = text(q.correctAnswer) ?? q.correctAnswer;
    // Numeric key = index into options. Whether a screen accepts an index key is unverified, so an in-range index is
    // only a warning ("answer-key-is-index"); an out-of-range one can never be right.
    if (typeof ans === 'number') { if (ans >= 0 && ans < opts.length) add(Lx, 'warn', 'answer-key-is-index', p, `correctAnswer ${ans} is an index into ${opts.length} options`); else add(Lx, 'error', 'answer-index-out-of-range', p, `correctAnswer ${ans} but ${opts.length} options`); return; }
    if (!opts.includes(ans)) add(Lx, 'error', 'answer-not-in-options', p, `correctAnswer ${JSON.stringify(ans)} not among [${opts.map((o) => JSON.stringify(o)).join(', ')}]`);
  }
}

// ---- report -------------------------------------------------------------------------------------------
const by = (arr, f) => arr.reduce((m, x) => ((m[f(x)] ||= []).push(x), m), {});
const errors = findings.filter((f) => f.severity === 'error'); const warns = findings.filter((f) => f.severity === 'warn');
const summary = {
  root, ui: UI || 'all', lessons: lessons.length, groups: Object.fromEntries([...stats].map(([k, v]) => [k, v.n])),
  errors: errors.length, warnings: warns.length, lessonsWithErrors: new Set(errors.map((f) => f.file)).size,
  byRule: Object.fromEntries(Object.entries(by(findings, (f) => f.rule)).map(([k, v]) => [k, v.length])),
};
if (OUT) fs.writeFileSync(OUT, JSON.stringify({ summary, findings }, null, 2));
if (!QUIET) {
  console.log(`content-shape-check  ${root}  ui=${summary.ui}`);
  console.log(`  lessons ${summary.lessons} | errors ${summary.errors} in ${summary.lessonsWithErrors} lessons | warnings ${summary.warnings}`);
  console.log('  by rule:', JSON.stringify(summary.byRule));
  for (const [rule, fs_] of Object.entries(by(errors, (f) => f.rule))) {
    console.log(`\n[${rule}] ${fs_.length}`);
    for (const f of fs_.slice(0, 25)) console.log(`  ${f.file.replace(/^[^/]+\//, '')}  ${f.path}  ${f.detail.slice(0, 150)}`);
    if (fs_.length > 25) console.log(`  … ${fs_.length - 25} more`);
  }
}
process.exit(errors.length ? 1 : 0);
