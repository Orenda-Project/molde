// c2_audit.mjs: node gen/c2_audit.mjs [file]  -> masked-wording stats per kind and the no_change dump
import { readFileSync } from 'node:fs';
const f = process.argv[2] || 'out/c2_rows.jsonl';
const rows = readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
const mask = r => {
  const words = new Set((r.program_before + ' ' + r.program).toLowerCase().match(/[a-z]{3,}/g) || []);
  const STOP = new Set('the and for with from that this you can please add put move make remove delete rename call change set show want need field button section card list chart graph stat number total first last above below under before after bottom top option choice choices label name title text app screen new it its my me our one more also too not any all only each every than then them they just like into onto over per day days week month year today line bar bars row rows entry entries'.split(' '));
  return r.request.toLowerCase().replace(/"[^"]*"/g, 'Q').replace(/[0-9][0-9:.]*/g, 'N').split(/\b/).map(t => /^[a-z]{3,}$/.test(t) && words.has(t) && !STOP.has(t) ? 'W' : t).join('').replace(/\bW( W)+\b/g, 'W').replace(/\s+/g, ' ').trim();
};
const by = {}; for (const r of rows) (by[r.class] ||= []).push(mask(r));
console.log('kind | rows | distinct masked | top-5 share');
for (const [k, v] of Object.entries(by)) { const m = new Map(); for (const x of v) m.set(x, (m.get(x) || 0) + 1); const top = [...m.values()].sort((a, b) => b - a).slice(0, 5).reduce((a, b) => a + b, 0); console.log(`${k} | ${v.length} | ${m.size} | ${(100 * top / v.length).toFixed(1)}%`); }
if (process.argv[3] === 'nc') for (const r of rows.filter(r => r.class === 'no_change')) console.log(`${r.id.slice(5)} [${r.meta.sub}] ${r.request}`);
