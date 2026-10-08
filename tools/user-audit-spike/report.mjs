#!/usr/bin/env node
// P0 bridge: walk JSONL + static-check JSON  ->  report.json (blueforge.user-audit/1)  +  AuditorReport preview
// (the shape forge-dev's @forge/auditor-sdk uses, so the existing audit-suite / ratchet can ingest it).
//
// Scoring is v0 and deliberately modest:
//  - every dimension lists the checks it DECLARES and the ones implemented; its weight is scaled by that
//    check coverage, so a thinly measured dimension pulls the total toward "unknown", not toward "good";
//  - dimensions with no implemented check are null (never 0 for "no data": same rule as the SDK);
//  - scores cover the WALKED scope only; scope coverage is reported separately.
import fs from 'node:fs';

const CELL = { app: 'lq-nordic', language: 'danish', uiLocale: 'en', l1: 'en', segment: 'casual-adult', profile: 'perfect', proficiency: 'beginner', device: 'mobile-430x900' };
const HEAD = process.env.REPO_HEAD || 'f72552ef';
const CHAPTERS = [1, 2, 3, 4, 5];
const NOMINAL = { completability: 20, game_mechanics: 15, learning_pace: 15, ui_ux: 15, assistance: 10, content_quality: 10, accessibility: 5, performance: 5, engagement: 5 };
// Manual annotation of findings already ticketed (kept in the report so a reader can follow them).
const KNOWN = {
  'drill-numbers-1-10': { ownerClass: 'content', ticket: 'lq-nordic#77' },
  'multiple-choice-pronouns-1': { ownerClass: 'content', ticket: 'lq-nordic#77' },
  'culture-family-values': { ownerClass: 'content', ticket: 'lq-nordic#77' },
  'tonal-stod-minimal-pairs': { ownerClass: 'lib', ticket: 'lq-core#141' },
  'sound-pattern-g': { ownerClass: 'content', ticket: null, note: 'pairs words lack soundId; pairs screen renders blank' },
  'sound-pattern-d': { ownerClass: 'content', ticket: null, note: 'pairs words lack soundId; pairs screen renders blank' },
};

const steps = []; for (const ch of CHAPTERS) { const f = `walk3-ch${ch}.jsonl`; if (!fs.existsSync(f)) continue;
  for (const l of fs.readFileSync(f, 'utf8').trim().split('\n').map(JSON.parse)) if (l.type) steps.push({ chapter: ch, ...l }); }
const walked = steps.length; const completed = steps.filter((s) => s.outcome === 'completed').length; const blocked = steps.filter((s) => s.outcome === 'blocked');
const stat = JSON.parse(fs.readFileSync('shape-check/nordic-en.json', 'utf8'));
const ids = new Set(steps.map((s) => `en/${CELL.language}/chapters/chapter-${s.chapter}/${s.lesson}.json`));
const staticErr = stat.findings.filter((f) => f.severity === 'error' && ids.has(f.file)); const staticErrLessons = new Set(staticErr.map((f) => f.file));
const dataDir = `../public/data/lessons/en/${CELL.language}/chapters`; let declared = 0;
for (const d of fs.readdirSync(dataDir)) { const p = `${dataDir}/${d}`; if (fs.statSync(p).isDirectory()) declared += fs.readdirSync(p).filter((f) => f.endsWith('.json')).length; }
const uiFlagged = steps.filter((s) => (s.uiFlags || []).length || (s.newErrors || []).length);
const ok = (n, d) => (d ? Math.round((1000 * n) / d) / 10 : null);
// longest run of consecutive non-practice lessons per chapter
const PRACTICE = new Set(['vocab', 'drill', 'spelling', 'word-order', 'multiple-choice', 'dialogue', 'conversation', 'sound-pattern', 'tonal', 'review']);
const runs = CHAPTERS.map((ch) => { let m = 0, c = 0; for (const s of steps.filter((x) => x.chapter === ch)) { if (PRACTICE.has(s.type)) c = 0; else m = Math.max(m, ++c); } return { chapter: ch, maxRun: m }; });
const paceScore = Math.round(runs.reduce((a, r) => a + Math.max(0, 100 - 10 * Math.max(0, r.maxRun - 3)), 0) / runs.length);
const xpMismatch = steps.filter((s) => s.outcome === 'completed' && s.declaredXp != null && s.xpDelta !== s.declaredXp).length;
const avgMs = Math.round(steps.reduce((a, s) => a + s.ms, 0) / walked);

const dim = (id, title, score, checksRun, checksDeclared, notes, facts = {}) => {
  const coverage = checksDeclared ? checksRun / checksDeclared : 0; const nominal = NOMINAL[id];
  return { id, title, score: checksRun ? score : null, weight: checksRun ? Math.round(nominal * coverage * 100) / 100 : nominal, nominalWeight: nominal, checkCoverage: Math.round(coverage * 100) / 100, notes, facts: { checksRun, checksDeclared, ...facts } };
};
const dimensions = [
  dim('completability', 'Completability', ok(completed, walked), 1, 1, [`${completed}/${walked} lessons completed in chapters ${CHAPTERS[0]}-${CHAPTERS.at(-1)}`, ...blocked.map((b) => `blocked: ${b.lesson} (${b.reason})`)], { completed, walked, blocked: blocked.length }),
  dim('game_mechanics', 'Game mechanics', ok(completed, completed), 1, 5, ['unlock chain: each completion made the next card current (walker advanced on every completed lesson)', `NOT scored: XP awarded differs from declared on ${xpMismatch}/${completed} lessons; awaiting a product decision on whether that is the rule`, 'untested: hearts, boss gating, streak, level-up display'], { xpAwardedNeqDeclared: xpMismatch, untested: ['hearts', 'boss-gating', 'streak', 'level-up'] }),
  dim('learning_pace', 'Learning pace', paceScore, 1, 4, [`longest run of consecutive non-practice lessons per chapter: ${runs.map((r) => `ch${r.chapter}=${r.maxRun}`).join(', ')} (score drops 10 per lesson beyond 3)`, 'untested: new items per lesson, time to first success, accuracy curve'], { runs }),
  dim('ui_ux', 'UI / UX', ok(walked - uiFlagged.length, walked), 2, 5, [`${uiFlagged.length} lessons showed an unresolved template or a console error: ${uiFlagged.map((s) => s.lesson).join(', ') || 'none'}`, 'untested: vision grading, tap targets, feedback after actions (lesson completion shows none)'], { flagged: uiFlagged.map((s) => s.lesson) }),
  dim('assistance', 'Assistance', null, 0, 4, ['no checks implemented'], {}),
  dim('content_quality', 'Content quality', ok(walked - staticErrLessons.size, walked), 1, 2, [`static shape check: ${staticErrLessons.size}/${walked} walked lessons have error-level findings`, 'untested: walker-vs-content answer disagreement'], { staticErrorLessons: [...staticErrLessons].map((f) => f.split('/').pop().replace('.json', '')) }),
  dim('accessibility', 'Accessibility', null, 0, 4, ['no checks implemented'], {}),
  dim('performance', 'Performance', null, 0, 3, [`recorded only: ${avgMs} ms average per lesson (includes walker waits); no thresholds yet`], { avgStepMs: avgMs }),
  dim('engagement', 'Engagement', null, 0, 3, ['no checks implemented'], {}),
];
const measured = dimensions.filter((d) => d.score != null); const wsum = measured.reduce((a, d) => a + d.weight, 0);
const total = Math.round((measured.reduce((a, d) => a + d.weight * d.score, 0) / wsum) * 10) / 10;
const nominalSum = Object.values(NOMINAL).reduce((a, b) => a + b, 0); const confidence = Math.round((wsum / nominalSum) * 100) / 100;
const scopeCoverage = Math.round((walked / declared) * 1000) / 1000;
// Gates (vision spec 4.2): a learner who cannot get through the main path cannot have an excellent experience.
// The 60 cap is a placeholder pending calibration (spec open question 1). A blocked step on the linear map blocks
// everything after it, so any blocker is treated as main-path.
const GATE_CAP = 60;
const gates = [{ id: 'blocked-main-path', triggered: blocked.length > 0, cap: GATE_CAP, reason: blocked.length ? `${blocked.length} lessons blocked on a linear map; first: ${blocked[0].lesson} (chapter ${blocked[0].chapter})` : null }];
const finalScore = Math.min(total, ...gates.filter((g) => g.triggered).map((g) => g.cap));
const runId = `ua-${HEAD}-${new Date().toISOString().slice(0, 10)}-pilot1`;
const findings = [
  ...blocked.map((b) => ({ severity: 'blocker', dimension: 'completability', lesson: b.lesson, chapter: b.chapter, rule: 'blocked', reason: b.reason, ...(KNOWN[b.lesson] || { ownerClass: 'unclassified' }) })),
  ...uiFlagged.filter((s) => (s.uiFlags || []).length).map((s) => ({ severity: 'major', dimension: 'ui_ux', lesson: s.lesson, chapter: s.chapter, rule: 'visible-text', reason: s.uiFlags.join('; '), ownerClass: 'content', ticket: 'lq-nordic#77' })),
  ...(xpMismatch ? [{ severity: 'minor', dimension: 'game_mechanics', rule: 'xp-awarded-ne-declared', reason: `${xpMismatch}/${completed} completed lessons awarded XP different from the declared value (100 vs 60/80)`, ownerClass: 'design', ticket: null }] : []),
];
const report = {
  schema: 'blueforge.user-audit/1', generatedAt: new Date().toISOString(), runId, tier: 'pilot',
  build: { repo: CELL.app, head: HEAD, target: 'local dev (vite), not a deployed host' }, cell: CELL,
  scope: { chapters: CHAPTERS, declaredLessons: declared, walkedLessons: walked, scopeCoverage, note: 'declared = lesson files for this language incl. electives; scores cover the walked scope only' },
  dimensions, total, gates, finalScore, confidence, findings,
  metering: { wallMs: steps.reduce((a, s) => a + s.ms, 0), steps: walked, avgStepMs: avgMs, parallelism: 1, browser: 'chromium', cpuSeconds: null, peakRssMb: null, costUsd: null, note: 'wall time includes fixed walker waits; CPU/memory/cost not yet measured' },
  stepsFile: 'walk3-ch{1..5}.jsonl',
};
const auditorReport = {
  auditorId: 'learn-quest:user-audit', title: `User audit: ${CELL.app} / ${CELL.language} / ${CELL.l1} / ${CELL.segment}`, generatedAt: report.generatedAt, repoHead: HEAD,
  dimensions: dimensions.map((d) => ({ id: d.id, score: d.score, weight: d.weight, notes: d.notes, facts: { ...d.facts, nominalWeight: d.nominalWeight, checkCoverage: d.checkCoverage } })),
  total, confidence, commands: [], observations: [], findings: [], maxAgeDays: 7, sampleId: runId,
};
fs.writeFileSync('report.json', JSON.stringify(report, null, 2)); fs.writeFileSync('auditor-report.preview.json', JSON.stringify(auditorReport, null, 2));
console.log(`cell ${CELL.app}/${CELL.language}/${CELL.l1}/${CELL.segment}  scope ${walked}/${declared} lessons (${(scopeCoverage * 100).toFixed(1)}%)`);
for (const d of dimensions) console.log(`  ${d.id.padEnd(15)} ${String(d.score ?? 'null').padStart(5)}  weight ${String(d.weight).padStart(5)} / ${d.nominalWeight}  checks ${d.facts.checksRun}/${d.facts.checksDeclared}`);
console.log(`  RAW TOTAL ${total} -> FINAL ${finalScore} (gates: ${gates.filter((g) => g.triggered).map((g) => g.id).join(',') || 'none'})  confidence ${confidence}  findings ${findings.length} (${findings.filter((f) => f.severity === 'blocker').length} blockers)`);
