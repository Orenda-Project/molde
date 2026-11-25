// Failure kinds of an r3 run on the 40 small changes (b-cases): wrong line / invalid / no-op / lost lines / too slow.
//   node tools/changes_failures.mjs ROWS.json > changes-failures.md
import { CASES } from '/home/oye/Documents/free_work/molde-model/diag-2026-11-24/b-cases.mjs';
import { readFileSync } from 'node:fs';
import { check } from '../vendor/lang/check.mjs';
import { format } from '../vendor/lang/format.mjs';
const rows = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const refs = readFileSync('/home/oye/Documents/free_work/molde-model/r3/changes/test_refs.jsonl', 'utf8').trim().split('\n').map(l => JSON.parse(l));
const norm = s => { try { return format(s); } catch { return s; } };
const lines = s => norm(s).split('\n').filter(l => l.trim());
const out = [];
for (const x of rows) {
  const i = +x.id.slice(3), [file, kind, request, ok] = CASES[i], before = refs[i].before, after = x.output || '';
  const b = lines(before), a = lines(after), A = new Set(a), B = new Set(b);
  const kept = b.filter(l => A.has(l)).length / b.length, added = a.filter(l => !B.has(l)).length, removed = b.filter(l => !A.has(l)).length;
  let good = false; try { good = !!x.pass && !!ok(before, after); } catch { good = false; }
  let kindOf = 'ok';
  if (!good) {
    if (!x.pass || !check(after).ok) kindOf = 'invalid (fails the checker)';
    else if (norm(before) === norm(after)) kindOf = 'no-op (program returned unchanged)';
    else if (kept < 0.8) kindOf = 'lost lines (kept ' + Math.round(kept * 100) + '% of the old lines)';
    else kindOf = 'wrong line (changed ' + added + ' added / ' + removed + ' removed, but not the asked thing)';
  }
  out.push({ i, file, kind, request, lines: b.length, kindOf, added, removed, kept: +kept.toFixed(2), err: x.err });
}
const fail = out.filter(o => o.kindOf !== 'ok');
const count = f => out.filter(f).length;
console.log(`# r3 on the 40 small changes: failure kinds\n`);
console.log(`Run: r3 Q4_K_M, arm E, full re-emit prompt (decode_eval.py rows). Passing: ${out.length - fail.length} of ${out.length}.\n`);
console.log(`| failure kind | count |\n|---|---|`);
for (const k of ['invalid', 'no-op', 'lost lines', 'wrong line']) console.log(`| ${k} | ${fail.filter(o => o.kindOf.startsWith(k)).length} |`);
console.log(`| too slow (program over 30 lines: more than 6 minutes on the emulator, about 25 s on the laptop) | ${count(o => o.lines > 30)} of ${out.length} cases are that long (${fail.filter(o => o.lines > 30).length} of them also fail) |\n`);
console.log(`## By asked kind\n\n| kind | cases | pass | most common failure |\n|---|---|---|---|`);
const kinds = [...new Set(out.map(o => o.kind))];
for (const k of kinds) { const g = out.filter(o => o.kind === k), f = g.filter(o => o.kindOf !== 'ok'); const c = {}; f.forEach(o => { const t = o.kindOf.split(' (')[0]; c[t] = (c[t] || 0) + 1; }); const top = Object.entries(c).sort((a, b) => b[1] - a[1])[0]; console.log(`| ${k} | ${g.length} | ${g.length - f.length} | ${top ? top[0] + ' x' + top[1] : '-'} |`); }
console.log(`\n## Every failure\n\n| id | app | kind | request | lines | failure |\n|---|---|---|---|---|---|`);
for (const o of fail) console.log(`| ch${String(o.i).padStart(2, '0')} | ${o.file.split('/').pop()} | ${o.kind} | ${o.request} | ${o.lines} | ${o.kindOf}${o.err ? ' [' + String(o.err).slice(0, 70).replace(/\|/g, '/') + ']' : ''} |`);
