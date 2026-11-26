// Replays a native hang saved by the hunt (core_watch.mjs writes the request when a call runs more than 90 s).
// Only hangs whose whole prompt fits the saved tail (prompt_len <= 600) can be replayed exactly: r4ep2 hang #1 (create "period", 448 characters).
//   node tools/replay_hang.mjs MODEL.gguf results/gemma-r4ep2.hangs.jsonl 0 [threads=1] [timeoutMs=60000]
import { readFileSync } from 'node:fs';
const H = new URL('..', import.meta.url).pathname;
const { startCoreWatched } = await import('./core_watch.mjs');
const [model, file, idx = '0', threads = '1', tmo = '60000'] = process.argv.slice(2);
const hang = JSON.parse(readFileSync(file, 'utf8').trim().split('\n')[+idx]);
const full = hang.prompt || hang.prompt_tail; if (hang.prompt_len > full.length) { console.error('the saved prompt is only the last 600 characters; cannot replay exactly'); process.exit(2); }
const core = startCoreWatched({ model, threads: +threads, server: process.env.SERVER || H + 'bin/core_server', libdir: process.env.LIBDIR, hangMs: +tmo, hangLog: '/tmp/replay.hangs.jsonl' });
const t0 = Date.now();
const r = await core.complete({ prompt: full, grammar: hang.grammar, nPredict: 200, stopNl: true, temp: hang.temp, seed: 1, draft: hang.draft });
console.log(JSON.stringify({ ms: Date.now() - t0, stop: r.stop, text: r.text, hang: !!r.hang, grammar_chars: hang.grammar.length }));
core.close(); process.exit(0);
