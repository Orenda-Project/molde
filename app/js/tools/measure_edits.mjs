// Seconds and success of edits on long apps: the app's generation loop over the host copy of the phone's native core
// (4 threads), with and without draft verification, on cases of the 40 small changes (b-cases).
//   node tools/measure_edits.mjs MODEL.gguf [out.json] [ids,comma,separated]
import { readFileSync, writeFileSync } from 'node:fs';
import { generate } from '../src/decode_loop.mjs';
import { startCore } from './core_complete.mjs';
import { CASES } from '/home/oye/Documents/free_work/molde-model/diag-2026-11-24/b-cases.mjs';
import { check } from '../vendor/lang/check.mjs';

const model = process.argv[2], out = process.argv[3] || '/tmp/molde-app-scratch/edit_measure.json';
const ids = (process.argv[4] || '4,7,8,9,16,18,24,29,12,6').split(',').map(Number);
const refs = readFileSync(`${process.env.HOME}/Documents/free_work/molde-model/r3/changes/test_refs.jsonl`, 'utf8').trim().split('\n').map(l => JSON.parse(l));
const core = startCore({ model, threads: 4 });
const rows = [];
for (const i of ids) {
  const [file, kind, request, ok] = CASES[i], before = refs[i].before;
  const row = { i, file: file.split('/').pop(), kind, request, lines: before.split('\n').filter(Boolean).length };
  for (const [arm, useDraft] of [['full', false], ['draft', true]]) {
    const r = await generate({ kind: 'edit', request, current: before, complete: core.complete, useDraft, allowAsk: false, maxLines: Math.max(70, row.lines + 40), deadlineMs: 600000 });
    let good = false; try { good = !!r.ok && !!ok(before, r.program); } catch { good = false; }
    row[arm] = { seconds: r.stats.seconds, ok: !!r.ok, good, resamples: r.stats.resamples, calls: r.stats.calls, tokens: r.stats.tokens, promptTokens: r.stats.promptTokens, draftTried: r.stats.draftTried, draftAccepted: r.stats.draftAccepted, grammarMs: r.stats.grammarMs, same: null, program: r.program };
  }
  row.draft.same = row.draft.program === row.full.program;
  row.speedup = +(row.full.seconds / row.draft.seconds).toFixed(2);
  console.log(`ch${i} ${row.file} ${row.kind} lines=${row.lines} full=${row.full.seconds}s(ok=${row.full.ok},good=${row.full.good},rs=${row.full.resamples}) draft=${row.draft.seconds}s(ok=${row.draft.ok},good=${row.draft.good},rs=${row.draft.resamples}, drafted ${row.draft.draftAccepted}/${row.draft.draftTried}) same=${row.draft.same} x${row.speedup}`);
  rows.push(row); writeFileSync(out, JSON.stringify(rows, null, 1));
}
const med = a => a.sort((x, y) => x - y)[Math.floor(a.length / 2)];
console.log(JSON.stringify({ n: rows.length, medianFull: med(rows.map(r => r.full.seconds)), medianDraft: med(rows.map(r => r.draft.seconds)), maxFull: Math.max(...rows.map(r => r.full.seconds)), maxDraft: Math.max(...rows.map(r => r.draft.seconds)), goodFull: rows.filter(r => r.full.good).length, goodDraft: rows.filter(r => r.draft.good).length, sameText: rows.filter(r => r.draft.same).length }));
core.close();
