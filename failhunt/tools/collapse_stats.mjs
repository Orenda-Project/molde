import { readFileSync } from 'node:fs';
const { skeleton } = await import('./skeleton_check.mjs');
for (const f of ['results/gemma-r3.jsonl', 'results/gemma-r4ep2.jsonl']) {
  const rows = readFileSync(f, 'utf8').trim().split('\n').map(l => JSON.parse(l)).filter(r => r.type === 'create' && r.ok);
  const exact = new Map(), norm = new Map();
  for (const r of rows) { const b = r.program.split('\n').slice(1).join('\n'); (exact.get(b) || exact.set(b, []).get(b)).push(r); const k = skeleton(r.program); (norm.get(k) || norm.set(k, []).get(k)).push(r); }
  const inExact = [...exact.values()].filter(v => v.length > 1).reduce((a, v) => a + v.length, 0);
  const grp = [...norm.values()].filter(v => v.length >= 3).sort((a, b) => b.length - a.length);
  console.log(f, 'builds', rows.length, '| share an identical body (ignoring the app line) with another request:', inExact, '| in a same-shape family of 3+ requests:', grp.reduce((a, v) => a + v.length, 0), 'in', grp.length, 'families');
  for (const v of grp.slice(0, 5)) console.log('   x' + v.length, v.slice(0, 5).map(r => r.id + ' ' + JSON.stringify(r.request.slice(0, 28))).join(' | '));
}
