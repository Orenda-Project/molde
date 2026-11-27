// Builds the cases file for test/app_path_measure_test.dart from a measure_ops.mjs result, and scores the Dart harness's output.
//   node tools/app_path_cases.mjs make MEASURE.json CASES.json     (the 40 small changes: before + request + the model's raw answer)
//   node tools/app_path_cases.mjs score MEASURE.json APPOUT.json    (how many of the 40 the app really applied and the case's own test accepts)
import { readFileSync, writeFileSync } from 'node:fs';
import { CASES } from '/home/oye/Documents/free_work/molde-model/diag-2026-11-24/b-cases.mjs';
const [mode, a, b] = process.argv.slice(2);
const refs = readFileSync(`${process.env.HOME}/Documents/free_work/molde-model/r3/changes/test_refs.jsonl`, 'utf8').trim().split('\n').map(l => JSON.parse(l));
const rows = JSON.parse(readFileSync(a, 'utf8')).rows;
if (mode === 'make') {
  writeFileSync(b, JSON.stringify(rows.map(r => ({ id: r.i, request: r.request, before: refs[r.i].before, raw: r.raw, err: r.err })), null, 1));
} else {
  const out = JSON.parse(readFileSync(b, 'utf8'));
  let direct = 0, model = 0, good = 0, goodDirect = 0, goodModel = 0, appliedWrong = 0; const lines = [];
  for (const o of out) {
    const i = o.id, [, kind, request, test] = CASES[i]; let g = false;
    if (o.applied) { try { g = !!test(refs[i].before, o.source); } catch { g = false; } }
    if (o.route === 'direct') direct++; if (o.route === 'model') model++;
    if (g) { good++; if (o.route === 'direct') goodDirect++; else goodModel++; }
    if (o.applied && !g) appliedWrong++;
    lines.push(`ch${String(i).padStart(2, '0')} ${kind.padEnd(14)} ${o.route.padEnd(6)} ${g ? 'GOOD' : o.applied ? 'applied-but-wrong' : 'not applied'}  ${g ? '' : String(o.message).split('\n')[0].slice(0, 110)}`);
  }
  console.log(lines.join('\n'));
  console.log(JSON.stringify({ n: out.length, direct, model, good, goodDirect, goodModel, appliedWrong }));
}
