// The app path for ops edits, measured on the laptop: the app's generateOps (its prompt, token ids, limits) over llama-server,
// then the reference applier + checker + the case's own test. Same 40 small changes as the plain test (r5 score_plain.mjs `chg`).
//   node tools/measure_ops.mjs MODEL.gguf OUT.json [PORT]      (starts its own llama-server, stops it at the end)
//   env PLAIN=path/to/out-LABEL-chg-e1.jsonl   to compare each raw answer with the plain test's
//   env LLAMA_SERVER_PORT=N  to use a server that is already up (then MODEL is ignored)
import { readFileSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { generateOps } from '../src/decode_loop.mjs';
import { makeComplete } from './server_complete.mjs';
import { applyOps } from './patch_ops_ref.mjs';
import { check } from '../vendor/lang/check.mjs';
import { CASES } from '/home/oye/Documents/free_work/molde-model/diag-2026-11-24/b-cases.mjs';

const [model, out = '/tmp/molde-app-scratch/ops_measure.json', portArg] = process.argv.slice(2);
const port = +(process.env.LLAMA_SERVER_PORT || portArg || 8000 + Math.floor(Math.random() * 1000));
const refs = readFileSync(`${process.env.HOME}/Documents/free_work/molde-model/r3/changes/test_refs.jsonl`, 'utf8').trim().split('\n').map(l => JSON.parse(l));
const plain = process.env.PLAIN ? readFileSync(process.env.PLAIN, 'utf8').trim().split('\n').map(l => JSON.parse(l)) : null;
let srv = null;
if (!process.env.LLAMA_SERVER_PORT) {
  const LLAMA = process.env.LLAMA || `${process.env.HOME}/llama.cpp-b12144/llama-b12144`;
  srv = spawn(`${LLAMA}/llama-server`, ['-m', model, '--port', String(port), '-c', '4096', '-np', '1', '-t', process.env.THREADS || '4', '--no-warmup', '-ngl', '0', '--host', '127.0.0.1'], { stdio: 'ignore', env: { ...process.env, LD_LIBRARY_PATH: LLAMA } });
  for (let i = 0; i < 120; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) break; } catch { /* not up yet */ } await new Promise(r => setTimeout(r, 1000)); }
}
const complete = makeComplete(port);
const ok = p => { try { const r = check(p); return !!(r.ok ?? (r.errors || []).length === 0); } catch { return false; } };
const rows = []; let good = 0, valid = 0, applied = 0, same = 0, sameAsPlain = 0, cut = 0;
const only = process.env.IDS ? process.env.IDS.split(',').map(Number) : [...Array(40).keys()];
try {
  for (const i of only) {
    const [file, kind, request, test] = CASES[i], before = refs[i].before;
    const r = await generateOps({ request, current: before, complete, hardCapMs: 600000, ctx: 4096 });
    const row = { i, kind, request, lines: before.split('\n').filter(Boolean).length, ok: r.ok, seconds: r.stats.seconds, tokens: r.stats.tokens, promptTokens: r.stats.promptTokens, raw: r.ops ?? null, err: r.ok ? null : (r.errors || []).join('; ') };
    if (r.patchError) cut++;
    if (r.ok) {
      try { const prog = applyOps(before, r.ops); row.applied = true; applied++; row.valid = ok(prog); if (row.valid) valid++; row.unchanged = prog.trim() === before.trim(); if (row.unchanged) same++; row.good = !!row.valid && !!test(before, prog); if (row.good) good++; }
      catch (e) { row.applied = false; row.patchError = e.message; }
    }
    if (plain) { row.plain = plain[i].output; row.sameAsPlain = plain[i].output.trim() === (r.ops || '').trim(); if (row.sameAsPlain) sameAsPlain++; }
    rows.push(row);
    console.log(`ch${String(i).padStart(2, '0')} ${kind.padEnd(14)} ${row.good ? 'GOOD' : row.valid ? 'valid' : row.applied ? 'badprog' : 'NOAPPLY'} ${row.sameAsPlain === false ? 'DIFF-from-plain' : ''} ${row.patchError || row.err || ''}`.trim());
    writeFileSync(out, JSON.stringify({ rows }, null, 1));
  }
  const n = rows.length;
  const sum = { n, applied, valid, good, unchanged: same, cutOff: cut, sameAsPlain: plain ? sameAsPlain : null };
  console.log(JSON.stringify(sum));
  writeFileSync(out, JSON.stringify({ summary: sum, rows }, null, 1));
} finally { if (srv) srv.kill(); }
