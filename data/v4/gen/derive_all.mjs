import { readFileSync, writeFileSync } from 'node:fs';
import { derivePlan, derivePatch } from './derive.mjs';
const rows = readFileSync('out/cleaned.jsonl', 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
let plans = 0, noplan = 0, patch = 0, nopatch = 0; const out = [];
for (const r of rows) {
  if (r.task === 'create') { if (!r.program.startsWith('ask ')) { const p = derivePlan(r.request, r.program); if (p) { r.plan = p; plans++; } else noplan++; } out.push(r); }
  else { const d = derivePatch(r.program_before, r.program); if (!d) { nopatch++; continue; } r.answer = d.answer; patch++; out.push(r); }
}
writeFileSync('out/derived.jsonl', out.map(r => JSON.stringify(r)).join('\n') + '\n');
console.log({ rows: rows.length, kept: out.length, plans, noplan, patch, nopatch_dropped: nopatch });
