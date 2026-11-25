// Create and edit seconds of one model with one core build (4 threads), through the app's generation loop.
//   TEMPLATE=gemma|qwen SERVER=/path/core_server node tools/measure_speed.mjs MODEL.gguf [out.json]
import { writeFileSync, readFileSync } from 'node:fs';
import { generate } from '../src/decode_loop.mjs';
import { startCore } from './core_complete.mjs';
import { CASES } from '/home/oye/Documents/free_work/molde-model/diag-2026-11-24/b-cases.mjs';
const model = process.argv[2], out = process.argv[3] || '/tmp/molde-app-scratch/speed.json';
const template = process.env.TEMPLATE || 'gemma', server = process.env.SERVER || '/tmp/molde-app-scratch/core_server';
const refs = readFileSync(`${process.env.HOME}/Documents/free_work/molde-model/r3/changes/test_refs.jsonl`, 'utf8').trim().split('\n').map(l => JSON.parse(l));
const core = startCore({ model, threads: 4, server });
const rows = [];
const run = async (label, args) => {
  const c0 = core.cpu(), t0 = Date.now();
  const r = await generate({ complete: core.complete, template, deadlineMs: 900000, ...args });
  const row = { label, wall: +((Date.now() - t0) / 1000).toFixed(1), cpu: +(core.cpu() - c0).toFixed(1), ok: !!r.ok, lines: r.stats.lines, calls: r.stats.calls, resamples: r.stats.resamples, promptTokens: r.stats.promptTokens, cachedTokens: r.stats.cachedTokens, draft: `${r.stats.draftAccepted}/${r.stats.draftTried}` };
  rows.push(row); console.log(JSON.stringify(row)); writeFileSync(out, JSON.stringify(rows, null, 1)); return r;
};
for (const q of ['todo', 'budget tracker', 'a water tracker with a daily goal']) await run('create: ' + q, { kind: 'create', request: q, allowAsk: false });
for (const i of [24, 16, 9]) { const [file, kind, request] = CASES[i]; const before = refs[i].before; await run(`edit ch${i} (${before.split('\n').filter(Boolean).length} lines): ${request}`, { kind: 'edit', request, current: before, allowAsk: false, maxLines: 140 }); }
core.close();
