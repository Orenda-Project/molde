// The whole-program (r3) twin of measure_ops.mjs: the app's own generate() loop (grammar, line stepping, draft check) over the host copy of
// the phone's native core, on the same 40 small changes, then the case's own test. Writes a cases file for test/app_path_measure_test.dart
// (run it with MOLDE_APP_FORMAT=whole) so the real MoldeController handles each answer.
//   node tools/measure_whole.mjs MODEL.gguf OUT.json CASES.json [ids]    (also: LONG=1 to run the 7 long example-app edits instead, no tests)
import { readFileSync, writeFileSync } from 'node:fs';
import { generate } from '../src/decode_loop.mjs';
import { startCore } from './core_complete.mjs';
import { check } from '../vendor/lang/check.mjs';
import { CASES } from '/home/oye/Documents/free_work/molde-model/diag-2026-11-24/b-cases.mjs';

const [model, out, casesOut] = process.argv.slice(2);
const refs = readFileSync(`${process.env.HOME}/Documents/free_work/molde-model/r3/changes/test_refs.jsonl`, 'utf8').trim().split('\n').map(l => JSON.parse(l));
const LONGE = [['A01', 'water', 'rename the button + 250 ml to Big glass'], ['A03', 'exercise', 'rename Log exercise to Add workout'], ['A04', 'water', 'remove the Not yet legend'], ['A05', 'water', 'move the last 7 days chart above today'], ['A06', 'savings', 'add a chart'], ['A08', 'budget', 'add a weekly total of all spending'], ['A12', 'cricket', 'add a chart of runs']];
const items = process.env.LONG
  ? LONGE.map(([id, ex, request]) => ({ i: id, kind: ex, request, before: readFileSync(new URL(`../../assets/examples/${ex}.mo`, import.meta.url), 'utf8'), test: null }))
  : (process.env.IDS ? process.env.IDS.split(',').map(Number) : [...Array(40).keys()]).map(i => ({ i, kind: CASES[i][1], request: CASES[i][2], before: refs[i].before, test: CASES[i][3] }));
const core = startCore({ model, threads: +(process.env.THREADS || 4) });
const rows = [], cases = []; let good = 0, valid = 0;
try {
  for (const it of items) {
    const lines = it.before.split('\n').filter(Boolean).length;
    const r = await generate({ kind: 'edit', request: it.request, current: it.before, complete: core.complete, allowAsk: false, maxLines: Math.max(70, lines + 40), hardCapMs: 600000 });
    let v = false, g = false;
    try { v = !!r.ok; g = v && it.test ? !!it.test(it.before, r.program) : false; } catch { g = false; }
    if (v) valid++; if (g) good++;
    rows.push({ i: it.i, kind: it.kind, request: it.request, lines, ok: r.ok, valid: v, good: g, seconds: r.stats.seconds, tokens: r.stats.tokens, program: r.program, err: r.ok ? null : (r.errors || []).join('; '), unchanged: r.program.trim() === it.before.trim() });
    cases.push({ id: it.i, request: it.request, before: it.before, raw: r.ok ? r.program : null, err: r.ok ? null : (r.errors || []).join('; ') });
    console.log(`${String(it.i).padEnd(5)} ${String(it.kind).padEnd(14)} ${g ? 'GOOD' : v ? 'valid' : 'FAIL '} ${r.stats.seconds}s ${r.ok ? '' : (r.errors || []).join('; ').slice(0, 100)}`);
    writeFileSync(out, JSON.stringify({ rows }, null, 1)); writeFileSync(casesOut, JSON.stringify(cases, null, 1));
  }
  console.log(JSON.stringify({ n: rows.length, valid, good }));
} finally { core.close(); }
