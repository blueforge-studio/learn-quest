#!/usr/bin/env node
// Local stand-in for books-api (port 3009), for READ-ONLY user audits of the books-platform apps.
//   GET/HEAD  -> forwarded to the live API (read-only), cached on disk to be gentle on it
//   anything else (POST/PUT/PATCH/DELETE) -> NEVER forwarded; recorded in the ledger and answered locally
// Ledger: GET /__ledger  (what the app tried to write, and what was read)   Reset: POST /__reset
// Why: the apps default to https://api.questbooks.blueforge.studio. Without this, an audit run could write reading
// progress to production. Safety rail from the proposal: "writes only against local / CI / sandbox, enforced in code".
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
const PORT = +(process.env.STUB_PORT || 3009); const LIVE = process.env.LIVE_API || 'https://api.questbooks.blueforge.studio';
const CACHE = path.join(path.dirname(new URL(import.meta.url).pathname), '.cache'); fs.mkdirSync(CACHE, { recursive: true });
const ledger = { reads: [], writes: [] };
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS' };
const send = (res, code, body, type = 'application/json') => { res.writeHead(code, { ...cors, 'content-type': type }); res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body)); };
http.createServer(async (req, res) => {
  const url = req.url || '/'; const method = req.method || 'GET';
  if (method === 'OPTIONS') return send(res, 204, '');
  if (url === '/__ledger') return send(res, 200, ledger);
  if (url === '/__reset' && method === 'POST') { ledger.reads.length = 0; ledger.writes.length = 0; return send(res, 200, { ok: true }); }
  if (method === 'GET' || method === 'HEAD') {
    const key = crypto.createHash('sha1').update(url).digest('hex'); const f = path.join(CACHE, key + '.json');
    try {
      let rec; if (fs.existsSync(f)) rec = JSON.parse(fs.readFileSync(f, 'utf8'));
      else { const r = await fetch(LIVE + url, { method: 'GET', headers: { 'user-agent': 'user-audit-readonly/0 (learn-quest spike)', accept: req.headers.accept || '*/*' } }); const buf = Buffer.from(await r.arrayBuffer());
        rec = { status: r.status, type: r.headers.get('content-type') || 'application/octet-stream', body: buf.toString('base64') }; if (r.status < 500) fs.writeFileSync(f, JSON.stringify(rec)); }
      ledger.reads.push({ url, status: rec.status, at: new Date().toISOString() });
      // AUDIT-ONLY compatibility shim, off by default (COMPAT_WRAP_SCENES=1). It is NOT a fix: it lets the audit see past a known
      // contract break (the API answers GET /api/content/<book>?chapter=N with a bare array; ContentService.loadChapterScenes reads
      // `data.scenes`). Every wrapped response is counted in the ledger so a report can state it was running in this mode.
      if (process.env.COMPAT_WRAP_SCENES === '1' && /^\/api\/content\/[^/?]+\?chapter=/.test(url) && rec.status === 200) { try { const arr = JSON.parse(Buffer.from(rec.body, 'base64').toString('utf8')); if (Array.isArray(arr)) { ledger.compat = (ledger.compat || 0) + 1; return send(res, 200, { scenes: arr }); } } catch {} }
      return send(res, rec.status, method === 'HEAD' ? '' : Buffer.from(rec.body, 'base64'), rec.type);
    } catch (e) { ledger.reads.push({ url, error: String(e.message) }); return send(res, 502, { error: 'stub: live read failed', detail: String(e.message) }); }
  }
  let body = ''; for await (const c of req) body += c; ledger.writes.push({ method, url, bytes: body.length, body: body.slice(0, 500), at: new Date().toISOString() });
  return send(res, 200, { ok: true, stubbed: true, note: 'user-audit read-only stub: not forwarded to production' });
}).listen(PORT, '127.0.0.1', () => console.log(`books-api stub on :${PORT} (reads -> ${LIVE}, writes recorded and NOT forwarded)`));
