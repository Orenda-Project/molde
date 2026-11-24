// node judge_prep.mjs BATCHNAME KIND NNN,NNN,...   -> judge/in-BATCHNAME.jsonl (8% sample of requests from the batch's out files)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { rng } from '../../data-v1/gen/lib.mjs';
const [name, kind, files] = process.argv.slice(2);
const D = new URL('../items/', import.meta.url).pathname;
const pool = [];
for (const n of files.split(',')) {
  const ins = readFileSync(`${D}in-${kind}-${n}.jsonl`, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
  const f = `${D}out-${kind}-${n}.jsonl`; if (!existsSync(f)) continue;
  const outs = new Map(readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)).map(o => [o.id, o]));
  for (const it of ins) { const o = outs.get(it.id); if (!o) continue; for (const k of (kind === 'a' ? ['r1', 'r2', 'r3', 'r4'] : ['hurried', 'fuller'])) if (o[k]) pool.push({ id: `${it.id}:${k}`, kind: it.kind, request: o[k], ...(it.kind === 'edit' ? { before: it.before, after: it.after, changes: it.changes } : { program: it.program }), ...(it.oos_kind ? { oos_kind: it.oos_kind } : {}) }); }
}
const r = rng('judge' + name); const n = Math.max(20, Math.round(pool.length * 0.08));
const sample = r.shuffle(pool).slice(0, n);
writeFileSync(new URL(`../judge/in-${name}.jsonl`, import.meta.url).pathname, sample.map(x => JSON.stringify(x)).join('\n') + '\n');
console.log(name, 'pool', pool.length, 'sample', sample.length);
