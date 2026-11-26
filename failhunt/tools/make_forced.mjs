// Applicable-by-construction edit steps (fix for the 120 chain steps that were n/a): programs the model wrote in the create run (r3, checker ok)
// are bent into a state where the request makes sense, then the request is asked. Writes controls/forced_cases.jsonl (type edit1).
import { readFileSync, writeFileSync } from 'node:fs';
const H = new URL('..', import.meta.url).pathname;
const APPJS = process.env.APPJS || '/tmp/molde-app/app/js';
const { check } = await import(`${APPJS}/vendor/lang/check.mjs`);
const P = await import('./preds.mjs');
let seed = 77; const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const pick = a => a[Math.floor(rnd() * a.length)];
const progs = readFileSync(H + 'results/gemma-r3.jsonl', 'utf8').trim().split('\n').map(l => JSON.parse(l)).filter(r => r.type === 'create' && r.ok && r.lines >= 4 && r.lines <= 30).map(r => ({ id: r.id, p: r.program }));
const out = []; const used = {};
const top = (p, rx) => { const L = p.split('\n'); const i = L.findIndex(l => rx.test(l)); return i; };
const okp = p => { try { return check(p).ok; } catch (e) { return false; } };
const OPT = ['Other', 'Cash', 'Weekly', 'Urgent', 'Snacks', 'Maybe', 'Gym', 'Online', 'Gifts', 'Refund'];
for (const { id, p } of progs.sort(() => rnd() - 0.5)) {
  const L = p.trimEnd().split('\n');
  // add option
  if ((used.ao || 0) < 70 && L.some(l => /^table .*\bpick\b/.test(l))) { const o = pick(OPT); if (!p.includes(o)) { out.push({ type: 'edit1', id: `F-ao-${id}`, before: p, step: { k: 'addoption', word: o, request: pick([`add ${o} as one more choice`, `let me pick ${o} as well`, `${o} should be in the list of choices too`]) } }); used.ao = (used.ao || 0) + 1; } }
  // remove: chart, list, stat, goal single top-level lines
  for (const [what, nm, reqs] of [['chart', 'rm', ['remove the chart', 'i do not need the graph', 'take the chart away']], ['list', 'rl', ['remove the list at the bottom', 'hide the history']], ['stat', 'rs', ['remove the totals', 'take away the big numbers']], ['goal', 'rg', ['remove the goal', 'i do not want a goal']]]) {
    if ((used[nm] || 0) < 40 && L.filter(l => P.RX[what].test(l) && !/^\s/.test(l)).length === 1) { const after = L.filter(l => !(P.RX[what].test(l) && !/^\s/.test(l))).join('\n') + '\n'; if (okp(after)) { out.push({ type: 'edit1', id: `F-${nm}-${id}`, before: p, step: { k: 'remove', what, request: pick(reqs) } }); used[nm] = (used[nm] || 0) + 1; } }
  }
  // button rename
  if ((used.bt || 0) < 40) { const m = /^\s*(?:form|topbar)\s+\w+,\s*"([^"]+)"/m.exec(p) || /^\s*button\s+"([^"]+)"/m.exec(p); if (m) { const x = pick(['Add now', 'Save it', 'Log it', 'New one']); out.push({ type: 'edit1', id: `F-bt-${id}`, before: p, step: { k: 'btn', old: m[1], to: x, request: pick([`rename the ${m[1]} button to ${x}`, `the ${m[1]} button should say ${x}`]) } }); used.bt = (used.bt || 0) + 1; } }
  // reorder: form after the list/chart, request to move it to the top / chart above list
  if ((used.ro || 0) < 80) {
    const fi = L.findIndex(l => /^form \w+(, "[^"]*")?$/.test(l)), li = L.findIndex(l => /^(list|each)\b/.test(l)), ci = L.findIndex(l => P.RX.chart.test(l) && !/^\s/.test(l));
    if (fi > 0 && li >= 0 && li < fi) { /* already after */ }
    if (fi >= 1 && li >= 0 && fi < li) { const M = L.filter((_, i) => i !== fi); const li2 = M.findIndex(l => /^(list|each)\b/.test(l)); M.splice(li2 + 1 + (M.slice(li2 + 1).findIndex(l => !/^\s/.test(l)) < 0 ? M.length - li2 - 1 : M.slice(li2 + 1).findIndex(l => !/^\s/.test(l))), 0, L[fi]); const b = M.join('\n') + '\n'; if (okp(b) && P.did({ k: 'reorder', a: 'form', b: 'list' }, b, p) && !P.did({ k: 'reorder', a: 'form', b: 'list' }, b, b)) { out.push({ type: 'edit1', id: `F-ro-f-${id}`, before: b, step: { k: 'reorder', a: 'form', b: 'list', request: pick(['put the add form at the top', 'show the form above the list', 'the form should come first']) } }); used.ro++; } }
    else if (ci >= 0 && li >= 0 && ci < li && !/^\s/.test(L[li])) { const M = L.slice(); const [c] = M.splice(ci, 1); const li2 = M.findIndex(l => /^(list)\b/.test(l)); if (li2 >= 0) { M.splice(li2 + 1, 0, c); const b = M.join('\n') + '\n'; if (okp(b) && P.did({ k: 'reorder', a: 'chart', b: 'list' }, b, p) && !P.did({ k: 'reorder', a: 'chart', b: 'list' }, b, b)) { out.push({ type: 'edit1', id: `F-ro-c-${id}`, before: b, step: { k: 'reorder', a: 'chart', b: 'list', request: pick(['put the chart above the list', 'chart first, then the list']) } }); used.ro = (used.ro || 0) + 1; } } }
  }
}
writeFileSync(H + 'controls/forced_cases.jsonl', out.map(o => JSON.stringify(o)).join('\n') + '\n');
const c = {}; for (const o of out) c[o.step.k] = (c[o.step.k] || 0) + 1; console.log(out.length, c);
