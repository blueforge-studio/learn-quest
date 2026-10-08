#!/usr/bin/env node
// books-content-check: CLI over content-check-lib. STUB (default http://127.0.0.1:3009) or API base via STUB/API. LIMIT=n lines per rule.
import { checkContent, BLOCKING } from './content-check-lib.mjs';
const api = process.env.API || process.env.STUB || 'http://127.0.0.1:3009'; const LIMIT = +(process.env.LIMIT || 12);
const { books, findings } = await checkContent({ api });
const by = {}; for (const f of findings) (by[f.rule] ??= []).push(f);
const kinds = books.reduce((a, b) => ((a[b.appType] = (a[b.appType] || 0) + 1), a), {});
console.log(`books checked: ${books.length} (${Object.entries(kinds).map(([k, v]) => k + ':' + v).join(' ')}) | scenes ${books.reduce((a, b) => a + b.scenes, 0)} | findings ${findings.length} | api ${api}`);
for (const [rule, fs] of Object.entries(by)) { console.log(`\n[${rule}] ${fs.length} in ${new Set(fs.map((f) => f.book)).size} books`); for (const f of fs.slice(0, LIMIT)) console.log(`  ${f.appType.padEnd(11)} ${f.book.padEnd(22)} ${(f.scene || '').padEnd(26)} ${f.detail}`); }
process.exit(findings.some((f) => BLOCKING.includes(f.rule)) ? 1 : 0);
