// content-check-lib: deterministic, browser-free checks of books-platform content, read through the books API (GET only).
// Rules: dangling-edge, unreachable-scene, no-ending, answer-key, hotspot-corruption (+ unavailable chapters/scenes).
// Used by books-content-check.mjs (CLI) and smoke.mjs. No writes, no browser.
export const BLOCKING = ['dangling-edge', 'unreachable-scene', 'no-ending', 'answer-key', 'scene-unavailable', 'chapters-unavailable'];
export async function checkContent({ api, types = ['story', 'activity', 'interactive', 'adventure'] } = {}) {
  const get = async (u) => { try { const r = await fetch(api + u); return r.ok ? await r.json() : { __err: r.status }; } catch (e) { return { __err: String(e.message) }; } };
  const out = []; const findings = [];
  for (const t of types) { const man = await get(`/api/content/manifest?type=${t}`); if (man.__err) { findings.push({ book: '(manifest)', appType: t, rule: 'chapters-unavailable', detail: `manifest?type=${t}: ${man.__err}` }); continue; } for (const bk of man.books || []) await checkBook(t, bk.id); }
  async function checkBook(appType, id) {
    const ch = await get(`/api/content/${id}/chapters`); if (ch.__err) { findings.push({ book: id, appType, rule: 'chapters-unavailable', detail: String(ch.__err) }); return; }
    const scenes = new Map(); const order = [];
    for (const c of ch.chapters) for (const s of c.sceneIds || c.scenes || []) { const sid = typeof s === 'string' ? s : s.id; const sc = await get(`/api/content/${id}/scenes/${sid}`); if (sc.__err) { findings.push({ book: id, appType, rule: 'scene-unavailable', scene: sid, detail: String(sc.__err) }); continue; } scenes.set(sid, sc); order.push(sid); }
    const edges = []; const explicit = new Set();
    for (const [sid, s] of scenes) { const ct = s.content || {};
      for (const n of s.nextScenes || []) { edges.push([sid, n.id]); explicit.add(sid); }
      for (const c of ct.choices || []) { const to = c.nextSceneId || c.next || c.target || c.outcome?.target; if (to) { edges.push([sid, to]); explicit.add(sid); } }
      for (const k of ['onCorrect', 'onIncorrect', 'nextSceneId']) if (ct[k]) { edges.push([sid, ct[k]]); explicit.add(sid); } }
    for (const [a, b] of edges) if (!scenes.has(b)) findings.push({ book: id, appType, rule: 'dangling-edge', scene: a, detail: `-> ${b} (does not exist)` });
    // reachability: explicit edges, else the next scene in declared order (the interactive books advance story scenes in order)
    const reach = new Set(); const go = (sid) => { if (reach.has(sid) || !scenes.has(sid)) return; reach.add(sid); const outs = edges.filter(([a]) => a === sid).map(([, b]) => b); const i = order.indexOf(sid); if (!explicit.has(sid) && order[i + 1]) outs.push(order[i + 1]); outs.forEach(go); };
    if (appType !== 'activity') go(order[0]); else order.forEach((s) => reach.add(s));
    for (const sid of order) if (!reach.has(sid)) findings.push({ book: id, appType, rule: 'unreachable-scene', scene: sid, detail: 'not reachable from the first scene' });
    if (appType !== 'activity' && ![...reach].some((s) => scenes.get(s).type === 'ending') && [...scenes.values()].some((s) => s.type === 'ending')) findings.push({ book: id, appType, rule: 'no-ending', detail: 'declared endings exist but none is reachable' });
    let hot = { matches: 0, capLost: 0, punctDropped: 0 };
    for (const [sid, s] of scenes) { const ct = s.content || {};
      const q = ct.question && ct.options ? ct : ct.comprehensionQuestion; if (q?.options) { const n = q.options.length; const key = q.correctAnswer ?? q.correctIndex; const flagged = q.options.map((o, i) => (o?.isCorrect ? i : -1)).filter((i) => i >= 0);
        if (typeof key === 'number' && (key < 0 || key >= n)) findings.push({ book: id, appType, rule: 'answer-key', scene: sid, detail: `index ${key} outside ${n} options` });
        if (typeof key === 'number' && flagged.length && !flagged.includes(key)) findings.push({ book: id, appType, rule: 'answer-key', scene: sid, detail: `index ${key} but isCorrect marks ${flagged}` }); }
      const hs = new Map((ct.hotSpots || []).map((h) => [h.word.toLowerCase(), h])); if (hs.size) for (const p of ct.pages || []) for (const tok of String(p.text).split(/(\s+)/)) { const h = hs.get(tok.toLowerCase().replace(/[.,!?;:'"]/g, '')); if (!h) continue; hot.matches++; if (/[A-Z]/.test((tok.match(/[A-Za-z]/) || [''])[0])) hot.capLost++; if (tok.replace(/[A-Za-z]/g, '')) hot.punctDropped++; } }
    if (hot.capLost || hot.punctDropped) findings.push({ book: id, appType, rule: 'hotspot-corruption', detail: `${hot.matches} hotspot words: ${hot.capLost} lose capitalisation, ${hot.punctDropped} lose punctuation` });
    out.push({ appType, id, scenes: scenes.size, edges: edges.length });
  }
  return { books: out, findings };
}
