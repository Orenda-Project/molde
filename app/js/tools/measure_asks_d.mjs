// Arm D of the ask measurement: any request with at least one non-filler word builds at once (ask only when the request names nothing).
// Runs only the requests where arms B and C still ask or are unchanged and A asked; reads and extends the JSON of measure_asks.mjs.
//   node tools/measure_asks_d.mjs [port] [in.json]
import { readFileSync, writeFileSync } from 'node:fs';
import { generate } from '../src/decode_loop.mjs';
import { makeComplete } from './server_complete.mjs';
const FILLER = new Set(['a','an','the','my','me','make','build','create','new','app','apps','please','simple','some','for','of','and','with','to','i','want','need','can','you','do','it','this','that','something','anything','stuff','thing','things','tool','give','get','help','is','be','have','like','just','one','on','in','up']);
const wordsOf = t => (t.toLowerCase().match(/[a-z0-9]+/g) || []);
export const hasContent = r => wordsOf(r).some(x => !FILLER.has(x));
const port = +(process.argv[2] || 8341), file = process.argv[3] || '/tmp/molde-app-scratch/ask_measure.json';
const res = JSON.parse(readFileSync(file, 'utf8')); const complete = makeComplete(port);
for (const r of res.rows) {
  if (hasContent(r.request)) {
    if (r.A.asked && !r.c_blocks) { const t = Date.now(); const g = await generate({ kind: 'create', request: r.request, complete, allowAsk: false, deadlineMs: 120000 }); r.D = { asked: !!g.ask, ok: g.ok, seconds: (Date.now() - t) / 1000 }; }
    else r.D = r.C;   // A did not ask (or C already builds): D equals C
  } else r.D = r.A;                                     // names nothing: may ask, as before
  console.log(r.id, JSON.stringify(r.request).slice(0, 50), 'A', r.A.asked ? 'ASK' : 'ok', 'D', r.D.asked ? 'ASK' : r.D.ok ? 'ok' : 'bad');
}
const n = res.rows.length, asked = res.rows.filter(r => r.D.asked).length, ok = res.rows.filter(r => !r.D.asked && r.D.ok).length;
res.summary.D = { asked, askRate: +(asked / n).toFixed(3), builtOk: ok, checkerPassOfAll: +(ok / n).toFixed(3), askedRequests: res.rows.filter(r => r.D.asked).map(r => r.request) };
console.log(JSON.stringify(res.summary.D, null, 1)); writeFileSync(file.replace('.json', '_d.json'), JSON.stringify(res, null, 1));
