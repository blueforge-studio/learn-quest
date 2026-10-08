// Journey graph for a story book, built from the content API (via the read-only stub). Pure functions + one loader.
// Nodes = scenes. Edges: story -> nextScenes; comprehension -> onCorrect / onIncorrect; choice -> choices[].outcome.target.
export async function loadGraph(stub, bookId) {
  const get = async (u) => (await fetch(stub + u)).json();
  const meta = await get(`/api/content/${bookId}/meta`); const chapters = (await get(`/api/content/${bookId}/chapters`)).chapters;
  const scenes = new Map();
  for (const c of chapters) for (const sid of c.sceneIds) scenes.set(sid, { ...(await get(`/api/content/${bookId}/scenes/${sid}`)), chapterId: c.id, chapterTitle: c.title });
  const order = chapters.flatMap((c) => c.sceneIds); return { bookId, title: meta.title, chapters, scenes, order, start: order[0] };
}
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
export function edgesOf(scene) {
  const c = scene.content || {}; const out = [];
  if (scene.type === 'comprehension') { out.push({ kind: 'correct', to: c.onCorrect ?? scene.nextScenes?.[0]?.id }); out.push({ kind: 'incorrect', to: c.onIncorrect ?? scene.nextScenes?.[0]?.id }); }
  else if (scene.type === 'choice') for (const ch of c.choices || []) out.push({ kind: 'choice', choiceId: ch.id, to: ch.outcome?.target });
  else for (const n of scene.nextScenes || []) out.push({ kind: 'next', to: n.id, label: n.label });
  return out.filter((e) => e.to);
}
/** All distinct root-to-ending paths, as decision lists. A comprehension node branches only if right and wrong lead elsewhere. */
export function enumeratePaths(g, { maxPaths = 50 } = {}) {
  const paths = [];
  const walk = (sid, decisions, visited) => {
    if (paths.length >= maxPaths || visited.has(sid)) return; const s = g.scenes.get(sid); if (!s) return; const v = new Set(visited).add(sid);
    const es = edgesOf(s); if (!es.length) { paths.push({ decisions, scenes: [...v] }); return; }
    if (s.type === 'comprehension') { const [ok, bad] = es; if (ok.to === bad.to) walk(ok.to, decisions, v); else { walk(ok.to, [...decisions, { scene: sid, pick: 'correct' }], v); walk(bad.to, [...decisions, { scene: sid, pick: 'incorrect' }], v); } }
    else if (s.type === 'choice') for (const e of es) walk(e.to, [...decisions, { scene: sid, pick: e.choiceId }], v);
    else if (es.length === 1) walk(es[0].to, decisions, v); else for (const e of es) walk(e.to, [...decisions, { scene: sid, pick: `next:${e.to}` }], v);
  };
  walk(g.start, [], new Set()); return paths;
}
export const declaredEdges = (g) => [...g.scenes.values()].flatMap((s) => edgesOf(s).map((e) => `${s.id}->${e.to}${e.choiceId ? '#' + e.choiceId : e.kind === 'incorrect' ? '#wrong' : ''}`));
/** Which scene is the UI showing? Match visible text against the content, loosely (case and punctuation ignored), and report whether
 *  the rendered text is EXACTLY the content text. A loose match that is not exact means the renderer altered the text. */
const loose = (s) => norm(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export function matchScene(g, type, text) {
  const t = norm(text); const tl = loose(text);
  for (const s of g.scenes.values()) { const c = s.content || {};
    if (type === 'story' && s.type === 'story') { for (const p of c.pages || []) { const want = loose(p.text).slice(0, 45); if (want && tl.includes(want)) return { id: s.id, altered: !t.includes(norm(p.text).slice(0, 45)), page: p.pageNumber }; } }
    if (type === 'quiz' && s.type === 'comprehension' && tl.includes(loose(c.question).slice(0, 40))) return { id: s.id, altered: !t.includes(norm(c.question).slice(0, 40)) };
    if (type === 'choice' && s.type === 'choice' && tl.includes(loose(c.prompt).slice(0, 40))) return { id: s.id, altered: !t.includes(norm(c.prompt).slice(0, 40)) };
    if (type === 'vocab' && s.type === 'vocabulary' && (c.words || []).length && (c.words || []).every((w) => tl.includes(loose(w.word)))) return { id: s.id, altered: false };
    if (type === 'ending' && s.type === 'ending' && tl.includes(loose(c.title).slice(0, 20))) return { id: s.id, altered: !t.includes(norm(c.title).slice(0, 20)) }; }
  return null;
}
