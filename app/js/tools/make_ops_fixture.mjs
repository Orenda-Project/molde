// Builds test/fixtures/patch_ops_parity.json: real model answers in the patch-operation format, each with the result of the
// JavaScript reference applier (js/tools/patch_ops_ref.mjs, a copy of molde-model/failhunt/tools/patch_ops_ref.mjs).
// test/patch_ops_test.dart replays every case through the Dart port and requires the same program, or a refusal where the reference refuses.
//   node js/tools/make_ops_fixture.mjs RUNS_DIR FAILHUNT_DIR OUT.json
// RUNS_DIR holds the prompts (chg-e1, chain-e1, forced-e1 .jsonl) and the answers out-<run>-<set>-e1.jsonl (Spark: ~/kamal/molde/exp/p).
// FAILHUNT_DIR is molde-model/failhunt (the forced edit suite and the r3/r4 whole-program answers, turned into operations by the reference's makeOps).
import { readFileSync, writeFileSync } from 'node:fs';
import { applyOps, makeOps } from './patch_ops_ref.mjs';
const [runs, fh, out] = process.argv.slice(2);
const jl = f => readFileSync(f, 'utf8').trim().split('\n').map(l => JSON.parse(l));
const programs = {}, keyOf = new Map(), cases = [];
const pid = text => { if (!keyOf.has(text)) { const k = 'p' + keyOf.size; keyOf.set(text, k); programs[k] = text; } return keyOf.get(text); };
const ref = (before, ops) => { try { return { out: applyOps(before, ops) }; } catch (e) { return { err: String(e.message) }; } };
const seen = new Set();
const add = (src, id, before, ops, kind) => {
  const k = JSON.stringify([before, ops]); if (seen.has(k)) return; seen.add(k);
  cases.push({ src, id, kind, p: pid(before), ops, ...ref(before, ops) });
};
// 1. what the models really wrote
const before = {};
for (const set of ['chg', 'chain', 'forced']) for (const r of jl(`${runs}/${set}-e1.jsonl`)) {
  const u = r.messages[1].content; const prog = u.slice(u.indexOf('Current program:\n') + 'Current program:\n'.length);
  before[r.id] = prog.split('\n').map(l => l.replace(/^\d+\| ?/, '')).join('\n') + '\n';
}
for (const run of ['r5c-ops-ep3', 'r5b-ops-ep3', 'r5b-ops-ep2', 'r5a-p-ep3']) for (const set of ['chg', 'chain', 'forced']) {
  for (const r of jl(`${runs}/out-${run}-${set}-e1.jsonl`)) add(run, r.id, before[r.id], r.output, 'model');
}
// 2. real r3 / r4 whole-program edits of the forced suite, written as operations by the reference
const fc = Object.fromEntries(jl(`${fh}/controls/forced_cases.jsonl`).map(c => [c.id, c]));
for (const f of ['forced-r3', 'forced-r4ep2']) for (const r of jl(`${fh}/results/${f}.jsonl`)) {
  const c = fc[r.id]; if (!c || !r.raw) continue;
  try { add(f, r.id, c.before, makeOps(c.before, r.raw), 'diff'); } catch (e) { /* reference cannot express it */ }
}
const stat = { cases: cases.length, programs: Object.keys(programs).length, applies: cases.filter(c => c.out !== undefined).length, refused: cases.filter(c => c.err).length, model: cases.filter(c => c.kind === 'model').length, diff: cases.filter(c => c.kind === 'diff').length };
writeFileSync(out, JSON.stringify({ about: 'replay of real model answers through the reference applier; see js/tools/make_ops_fixture.mjs', stat, programs, cases }));
console.log(JSON.stringify(stat));
