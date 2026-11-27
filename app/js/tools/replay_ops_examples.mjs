// Replays edit requests on the app's own example programs through the app's generateOps (+ applier + checker) and prints the raw answer.
//   node tools/replay_ops_examples.mjs MODEL.gguf OUT.json   (requests: the 12 edits of the 0.7.0 critic round, or REQS='water|rename...;...')
import { readFileSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { generateOps } from '../src/decode_loop.mjs';
import { makeComplete } from './server_complete.mjs';
import { applyOps, numbered } from './patch_ops_ref.mjs';
import { check } from '../vendor/lang/check.mjs';

const EDITS = [
 ['A01', 'water', 'rename the button + 250 ml to Big glass'], ['A03', 'exercise', 'rename Log exercise to Add workout'],
 ['A04', 'water', 'remove the Not yet legend'], ['A05', 'water', 'move the last 7 days chart above today'],
 ['A06', 'savings', 'add a chart'], ['A08', 'budget', 'add a weekly total of all spending'], ['A12', 'cricket', 'add a chart of runs'],
];
const [model, out = '/tmp/molde-app-scratch/ops_examples.json'] = process.argv.slice(2);
const port = 9000 + Math.floor(Math.random() * 900), LLAMA = `${process.env.HOME}/llama.cpp-b12144/llama-b12144`;
const srv = spawn(`${LLAMA}/llama-server`, ['-m', model, '--port', String(port), '-c', '4096', '-np', '1', '-t', process.env.THREADS || '4', '--no-warmup', '-ngl', '0', '--host', '127.0.0.1'], { stdio: 'ignore', env: { ...process.env, LD_LIBRARY_PATH: LLAMA } });
for (let i = 0; i < 120; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) break; } catch { /* wait */ } await new Promise(r => setTimeout(r, 1000)); }
const complete = makeComplete(port), rows = [];
try {
  for (const [id, ex, request] of EDITS) {
    const before = readFileSync(new URL(`../../assets/examples/${ex}.mo`, import.meta.url), 'utf8');
    const r = await generateOps({ request, current: before, complete, hardCapMs: 600000 });
    const row = { id, ex, request, lines: before.split('\n').length, promptTokens: r.stats.promptTokens, tokens: r.stats.tokens, seconds: r.stats.seconds, raw: r.ops ?? null, err: r.ok ? null : r.errors.join('; ') };
    if (r.ok) { try { const p = applyOps(before, r.ops); const c = check(p); row.after = p; row.checkErrors = (c.errors || []).map(e => (e.msg || e.message || JSON.stringify(e))).slice(0, 3); row.unchanged = p.trim() === before.trim(); } catch (e) { row.patchError = e.message; } }
    rows.push(row);
    console.log(`${id} ${ex} "${request}" lines=${row.lines} prompt=${row.promptTokens} gen=${row.tokens} ${row.patchError ? 'PATCH-ERR ' + row.patchError : row.checkErrors?.length ? 'CHECK-FAIL ' + row.checkErrors[0] : row.unchanged ? 'UNCHANGED' : 'ok'}\n--- raw ---\n${row.raw}\n`);
  }
  writeFileSync(out, JSON.stringify(rows, null, 1));
} finally { srv.kill(); }
