// similarity of candidate requests against every held-out set
import { readFileSync } from 'node:fs';
const D = '/tmp/molde-databr/data/';
const rd = f => readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
const STOP = new Set('a an the my me i to of for and or is it in on at app apps tracker track log list please pls make build want need can you'.split(' '));
export const toks = s => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);
export const key = s => toks(s).filter(t => !STOP.has(t)).sort().join(' ');
const held = []; // {set, text}
function add(set, text) { if (text) held.push({ set, text, toks: new Set(toks(text)), key: key(text) }); }
const ids = new Set(readFileSync('/home/oye/Documents/free_work/molde-model/heldout_ids.txt', 'utf8').split('\n').filter(Boolean));
for (const r of rd('/home/oye/Documents/free_work/molde-design/archive-2026-11-23/requests-en/requests.jsonl')) if (ids.has(r.id)) add('heldout_ids', r.text);
for (const d of ['09-add-search', '12-change-quick', '14-remove-view', '19-add-per-row-total']) add('heldout_ids', readFileSync(`/tmp/molde-data3/lang/examples/edits/${d}/request.txt`, 'utf8'));
for (const r of rd('/home/oye/Documents/free_work/molde-model/data-v2/heldout2.jsonl')) add('heldout2', r.request);
for (const r of JSON.parse(readFileSync(D + 'reports/eval-novel-items.json', 'utf8'))) add('eval_novel', r.request);
for (const r of JSON.parse(readFileSync(D + 'reports/diag-2026-11-24/e-ask-results.json', 'utf8'))) add('ask_test', r.request);
const changeTest = JSON.parse(readFileSync(D + 'reports/diag-2026-11-24/b-change-results.json', 'utf8'));
for (const r of changeTest) add('change_test', r.request);
export const HELD_N = held.length;
export const changeTestPairs = changeTest.map(r => ({ file: r.file, request: r.request, key: key(r.request) }));
// best match for a request: {sim, set, text}
export function nearest(req) {
  const t = new Set(toks(req)), k = key(req); let best = { sim: 0 };
  for (const h of held) {
    let sim;
    if (k && k === h.key) sim = 1;
    else { let inter = 0; for (const x of t) if (h.toks.has(x)) inter++; sim = inter / Math.max(1, t.size + h.toks.size - inter); }
    if (sim > best.sim) best = { sim, set: h.set, text: h.text };
  }
  return best;
}
