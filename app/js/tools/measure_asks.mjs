// Ask rate and checker pass of the app's generation loop on the 60 short requests of the r3 ask set,
// against llama-server (tools/llama_server.sh). Arms: A = asks allowed everywhere (before),
// B = the 0.4.0 rule (1 to 3 words that name a thing build at once), C = B plus any request that holds an app noun
// and another real word. Then every ask of arm A is answered with its first option and must build (second turn, no ask).
//   node tools/measure_asks.mjs [port] [out.json]
import { readFileSync, writeFileSync } from 'node:fs';
import { generate } from '../src/decode_loop.mjs';
import { makeComplete } from './server_complete.mjs';

const FILLER = new Set(['a','an','the','my','me','make','build','create','new','app','apps','please','simple','some','for','of','and','with','to','i','want','need','can','you','do','it','this','that','something','anything','stuff','thing','things','tool','give','get','help','is','be','have','like','just','one','on','in','up']); // mirror of kFiller in lib/src/rules.dart
const wordsOf = t => (t.toLowerCase().match(/[a-z0-9]+/g) || []);
const namesAThing = r => { const w = wordsOf(r); return w.length > 0 && w.length <= 3 && w.some(x => !FILLER.has(x)); };
const KIND = /\b(app|tracker|list|log|counter|timer|planner|diary|journal|calculator|scoreboard|checklist|notebook)\b/;
const namesWithKind = r => namesAThing(r) || (KIND.test(r.toLowerCase()) && wordsOf(r).filter(x => !FILLER.has(x) && !KIND.test(x)).length >= 1);

const port = +(process.argv[2] || 8341), out = process.argv[3] || '/tmp/molde-app-scratch/ask_measure.json';
const rows = readFileSync(`${process.env.HOME}/Documents/free_work/molde-model/r3/ask/test_refs.jsonl`, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
const complete = makeComplete(port);
const run = async (request, allowAsk, ask) => { const t = Date.now(); const r = await generate({ kind: 'create', request, complete, allowAsk, ask, deadlineMs: 120000 }); return { asked: !!r.ask, ok: r.ok, program: r.program, seconds: (Date.now() - t) / 1000, question: r.ask && r.ask.question, options: r.ask && r.ask.options, errors: (r.errors || []).slice(0, 1) }; };
const arms = { A: () => true, B: r => !namesAThing(r), C: r => !namesWithKind(r) };
const res = { rows: [] };
for (const row of rows) {
  const r = { id: row.id, request: row.request, words: wordsOf(row.request).length, b_blocks: namesAThing(row.request), c_blocks: namesWithKind(row.request) };
  r.A = await run(row.request, true);
  r.B = r.b_blocks ? await run(row.request, false) : r.A;      // identical when the rule does not apply
  r.C = r.c_blocks ? (r.b_blocks ? r.B : await run(row.request, false)) : r.A;
  if (r.A.asked) { const a = (r.A.options || [])[0] || 'Yes'; r.answered = await run(row.request, false, { question: r.A.question, answer: a }); }
  res.rows.push(r); console.log(row.id, JSON.stringify(row.request).slice(0, 50), 'A', r.A.asked ? 'ASK' : r.A.ok ? 'ok' : 'bad', 'B', r.B.asked ? 'ASK' : r.B.ok ? 'ok' : 'bad', 'C', r.C.asked ? 'ASK' : r.C.ok ? 'ok' : 'bad', r.answered ? 'answered:' + (r.answered.asked ? 'ASK' : r.answered.ok ? 'ok' : 'bad') : '');
}
const sum = arm => { const n = res.rows.length; const asked = res.rows.filter(r => r[arm].asked).length; const built = res.rows.filter(r => !r[arm].asked); const ok = built.filter(r => r[arm].ok).length; const secs = res.rows.map(r => r[arm].seconds).sort((a, b) => a - b);
  return { asked, askRate: +(asked / n).toFixed(3), builtOk: ok, checkerPassOfAll: +(ok / n).toFixed(3), checkerPassOfBuilt: built.length ? +(ok / built.length).toFixed(3) : null, medianSeconds: +secs[Math.floor(n / 2)].toFixed(1) }; };
res.summary = { n: res.rows.length, A: sum('A'), B: sum('B'), C: sum('C') };
const ans = res.rows.filter(r => r.answered); res.summary.answered = { n: ans.length, built: ans.filter(r => !r.answered.asked && r.answered.ok).length, askedAgain: ans.filter(r => r.answered.asked).length };
const named = res.rows.filter(r => r.words <= 3);
res.summary.short = { n: named.length, askedBefore: named.filter(r => r.A.asked).length, askedAfterB: named.filter(r => r.B.asked).length };
console.log(JSON.stringify(res.summary, null, 1)); writeFileSync(out, JSON.stringify(res, null, 1));
