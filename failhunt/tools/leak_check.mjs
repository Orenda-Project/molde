// Leak check: no spec / training request may equal or nearly equal a test request. Exact + near-duplicate (word-set Jaccard).
//   node tools/leak_check.mjs spec/creates.jsonl spec/edits.jsonl ...      exit 1 on any hit
// Test requests = every create request, chain seed request and chain step request of cases.jsonl (the step wording menu included),
// plus the long test bases (data/long/*.mo, as program bodies). Rules: exact normalised match; Jaccard >= 0.75 (>= 0.6 for requests of 5 words or fewer).
import { readFileSync, readdirSync } from 'node:fs';
const H = new URL('..', import.meta.url).pathname;
const norm = s => String(s).toLowerCase().replace(/\\n/g, ' ').split('\nQuestion:')[0].replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
const jac = (a, b) => { const A = new Set(a), B = new Set(b); let i = 0; for (const x of A) if (B.has(x)) i++; return i / (A.size + B.size - i || 1); };
const tests = [];
for (const l of readFileSync(H + 'cases.jsonl', 'utf8').trim().split('\n')) {
  const c = JSON.parse(l);
  if (c.type === 'create') tests.push({ id: c.id, text: c.request });
  else { if (c.seed.request) tests.push({ id: c.id + ':seed', text: c.seed.request }); for (const s of c.steps) tests.push({ id: c.id + ':step', text: s.request.replace('{BTN}', '').replace('{FIELD}', '') }); }
}
const bases = readdirSync(H + 'data/long').map(f => readFileSync(H + 'data/long/' + f, 'utf8').split('\n').filter(l => l.trim()).join('\n'));
let hits = 0, n = 0;
for (const f of process.argv.slice(2)) {
  for (const l of readFileSync(f, 'utf8').trim().split('\n')) {
    const r = JSON.parse(l); n++;
    const w = norm(r.request); const thr = w.length <= 5 ? 0.6 : 0.75;
    for (const t of tests) {
      const tw = norm(t.text); if (!tw.length) continue;
      const j = jac(w, tw);
      if ((w.join(' ') === tw.join(' ')) || (w.length > 2 && j >= thr) || (w.length <= 2 && w.join(' ') === tw.join(' '))) { console.log('LEAK', f.split('/').pop(), r.id, JSON.stringify(r.request), '~', t.id, JSON.stringify(t.text), j.toFixed(2)); hits++; break; }
    }
    for (const field of ['before', 'program']) if (r[field] && field === 'before') { const body = r.before.split('\n').filter(x => x.trim()).join('\n'); if (bases.includes(body)) { console.log('LEAK base', r.id, 'before = a test base'); hits++; } }
  }
}
console.log(n, 'examples checked,', hits, 'leaks');
process.exit(hits ? 1 : 0);
