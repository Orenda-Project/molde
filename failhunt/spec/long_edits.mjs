// DATA_SPEC_r5: long-program edits (40+ lines). The bases are three long programs that are already in v3.1 (they are NOT the test bases of the hunt).
// One changed line, everything else copied exactly. node long_edits.mjs > long_edits.jsonl
import { readFileSync } from 'node:fs';
const rows = new Map(readFileSync('/home/oye/Documents/free_work/molde-model/data-v31/v3.1.jsonl', 'utf8').trim().split('\n').map(l => { const r = JSON.parse(l); return [r.id, r]; }));
const base = id => { const r = rows.get(id); return (r.before || r.program_before); };
import { makeOps, applyOps } from '../tools/patch_ops_ref.mjs';
const P = [];
const add = (id, request, before, from, to) => { if (!before.includes(from)) throw new Error(id + ': missing ' + from); P.push({ class: 'long_edit_copy', id, kind: 'edit', request, before, program: before.replace(from, to) }); };
const chess = base('v3-ed-d27a24b120'), mandi = base('v3-ed-e715f537fe'), chai = base('v3-ed-bbde08f690');
add('le1', 'the Record game button should say Add result', chess, 'form game, "Record game"', 'form game, "Add result"');
add('le2', 'change the monthly profit goal to 150000', mandi, 'setting target money = 120000 "Monthly profit goal"', 'setting target money = 150000 "Monthly profit goal" set');
add('le3', 'add Tea as an option for the cost kind', chai, 'kind pick Milk|Gas|Sugar|Wages|Other = Milk', 'kind pick Milk|Gas|Sugar|Wages|Tea|Other = Milk');
add('le4', 'the Add cost button should say Add expense', chai, 'form cost, "Add cost"', 'form cost, "Add expense"');
for (const p of P) { const ops = makeOps(p.before, p.program); if (applyOps(p.before, ops) !== p.program.replace(/\n*$/, '\n')) throw new Error('round trip ' + p.id); p.answer = ops; console.log(JSON.stringify(p)); }
