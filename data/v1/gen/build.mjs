import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { diff } from './lib.mjs';
import { rng, verify, norm, sha, canon, HELD, LANG, saveCache } from './lib.mjs';
import { makeCreate, typo } from './frame.mjs';
import { makeEdit } from './edits.mjs';
import * as P1 from './archs1.mjs';
import * as P2 from './archs2.mjs';
import * as P3 from './archs3.mjs';
import { seeds, mutateCreate, mutateEdit } from './mutate.mjs';
import { ASKS, askProgram } from './ask.mjs';
import { OOS, OOS_FOR } from './oos.mjs';
import { readHand } from './hand.mjs';
import { tokenCounts } from './tokcount.mjs';

const OUT = new URL('../out/', import.meta.url).pathname;
const STAGE = process.argv[2] || 'v1';
const SCALE = STAGE === 'A' ? 0.35 : 1;
const ARCHS = [
  [P1.Q, P1.QD, 14, 6], [P2.B, P2.BD, 12, 6], [P2.C, P2.CD, 12, 6], [P2.D, P2.DD, 14, 6], [P2.E, P2.ED, 14, 6], [P2.F, P2.FD, 12, 6], [P2.G, P2.GD, 12, 6],
  ...P3.ARCHS,
];
const STYLES = ['detailed', 'short', 'multi_feature', 'typos', 'vague', 'detailed', 'multi_feature', 'vague', 'typos', 'detailed'];
const cand = [];
const dropped = { build_error: [], edit_error: [] };
for (const [A, DS, nc, ne] of ARCHS) {
  const n = Math.ceil(nc * SCALE), m = Math.ceil(ne * SCALE);
  for (const d of DS) {
    for (let j = 0; j < n; j++) {
      const st = A.styles ? A.styles[j % A.styles.length] : STYLES[j % STYLES.length];
      const x = makeCreate(A, d, st, `${d.key}/${j}/${st}`);
      if (x.err) { dropped.build_error.push({ d: d.key, st, why: x.err[0] }); continue; }
      cand.push({ ...x, spec: undefined, meta0: A.name });
      // out-of-scope variant of every 5th pair
      if (j === 2 && st !== 'vague' && st !== 'typos' && parseInt(sha(d.key).slice(0, 2), 16) % 2 === 0) {
        const r = rng('oos/' + d.key + j); const [kind, clause] = r.pick(OOS.filter(o => (OOS_FOR[A.name] || []).includes(o[0])));
        const base = x.request.replace(/[.!?\s]+$/, '');
        const req = r.pick([`${base}. Also ${clause}.`, `${base}, plus ${clause}.`, base.includes(' and ') ? `${base}. And ${clause}.` : `${base}, and ${clause}.`]);
        cand.push({ ...x, spec: undefined, request: req, method: 'oos:' + A.name, style: x.style, oos: kind });
      }
    }
    for (let j = 0; j < m; j++) {
      const x = makeEdit(A, d, `${d.key}/${j}`);
      if (!x) continue;
      if (x.err) { dropped.edit_error.push({ d: d.key, op: x.op, why: x.err[0] }); continue; }
      cand.push(x);
    }
  }
}
// program-first variants from the corpus and examples
for (const s of seeds()) {
  const nC = Math.ceil(2 * SCALE), nE = Math.ceil(2 * SCALE);
  const seenC = new Set(), seenE = new Set();
  for (let n = 0; n < 12 && seenC.size < nC; n++) { const x = mutateCreate(s, n); if (!x) continue; if (x.err) { dropped.build_error.push({ d: s.id, why: x.err[0] }); continue; } if (seenC.has(x.method)) continue; seenC.add(x.method); cand.push(x); }
  for (let n = 0; n < 12 && seenE.size < nE; n++) { const x = mutateEdit(s, n); if (!x) continue; if (x.err) { dropped.edit_error.push({ d: s.id, why: x.err[0] }); continue; } if (seenE.has(x.method)) continue; seenE.add(x.method); cand.push(x); }
}
// ask cases
ASKS.forEach((a, i) => {
  cand.push({ task: 'create', request: a.request, program: askProgram(a), style: 'ask', domain: 'ask', method: 'hand-ask' });
  const r = rng('askv' + i); const t = typo(a.request.length > 8 ? a.request : a.request + ' pls', r, 2);
  if (norm(t) !== norm(a.request)) cand.push({ task: 'create', request: t, program: askProgram(a), style: 'ask', domain: 'ask', method: 'hand-ask:typo' });
  if (r.chance(0.5)) cand.push({ task: 'create', request: r.pick(['can you make ', 'i need ', 'help me with ', 'hey, ']) + a.request, program: askProgram(a), style: 'ask', domain: 'ask', method: 'hand-ask:prefix' });
});
// hand written (create, edit, oos)
const hand = readHand();
for (const h of hand.out) cand.push(h);
dropped.hand = hand.fails;

// v1 is cumulative: stage A rows come first, unchanged
if (STAGE !== 'A' && existsSync(OUT + '../stageA.jsonl')) {
  for (const l of readFileSync(OUT + '../stageA.jsonl', 'utf8').split('\n').filter(Boolean)) {
    const r = JSON.parse(l);
    const cp = canon(r.program), cb = r.program_before ? canon(r.program_before) : { ok: true };
    if (!cp.ok || !cb.ok) { dropped.fromA_fail = (dropped.fromA_fail || 0) + 1; continue; }
    cand.push({ task: r.task, request: r.request, program: cp.text, before: r.program_before ? cb.text : undefined, method: r.source, style: r.meta.style, domain: r.meta.domain, oos: r.meta.oos, op: r.meta.op, verdict: r.meta.verdict, seed: r.meta.seed, fromA: true });
  }
}
// held-out and duplicate filters
const heldReq = new Set(), heldProg = new Set();
{
  const reqs = readFileSync(process.env.REQS || '/home/oye/Documents/free_work/molde-design/archive-2026-11-23/requests-en/requests.jsonl', 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
  for (const r of reqs) if (HELD.has(r.id)) { heldReq.add(norm(r.text)); const p = LANG + '/corpus/' + r.id + '.mo'; if (existsSync(p)) { const c = canon(readFileSync(p, 'utf8')); if (c.ok) heldProg.add(sha(c.text)); } }
  for (const d of ['09-add-search', '12-change-quick', '14-remove-view', '19-add-per-row-total']) { heldReq.add(norm(readFileSync(LANG + '/examples/edits/' + d + '/request.txt', 'utf8'))); for (const f of ['before', 'after']) heldProg.add(sha(canon(readFileSync(LANG + `/examples/edits/${d}/${f}.mo`, 'utf8')).text)); }
}
const drops = { heldout_request: 0, heldout_program: 0, dup_request: 0, dup_program: 0, too_long: 0, verify_fail: 0 };
const failSamples = [];
// tokens
const progs = []; cand.forEach((c, i) => { progs.push(c.program); if (c.before) progs.push(c.before); });
const uniq = [...new Set(progs)];
const tc = tokenCounts(uniq); const tmap = new Map(uniq.map((p, i) => [p, tc[i]]));
const seenReq = new Set(), seenProg = new Set(), final = [];
const order = { 'hand': 0, 'hand-edit': 0, 'hand-oos': 0 };
cand.sort((a, b) => (a.fromA ? -1 : 0) - (b.fromA ? -1 : 0) || (order[a.method] ?? 1) - (order[b.method] ?? 1));
for (const c of cand) {
  const nr = norm(c.request);
  if (heldReq.has(nr)) { drops.heldout_request++; continue; }
  const key = c.task === 'edit' ? sha(c.before + '\u0000' + c.program) : sha(c.program);
  if (heldProg.has(sha(c.program))) { drops.heldout_program++; continue; }
  if (seenReq.has(nr)) { drops.dup_request++; continue; }
  if (c.task === 'create' && !c.method.startsWith('hand-ask') && !c.method.startsWith('oos') && !c.method.startsWith('mutate') && !c.fromA && seenProg.has(key)) { drops.dup_program++; continue; }
  if (c.task === 'edit' && seenProg.has(key)) { drops.dup_program++; continue; }
  const tk = tmap.get(c.program), tb = c.before ? tmap.get(c.before) : 0;
  if (tk > 400 || tb > 400) { drops.too_long++; continue; }
  const v = verify(c.program, c.before ? [c.before] : null), vb = c.before ? verify(c.before) : { ok: true };
  if (!v.ok || !vb.ok) { drops.verify_fail++; if (failSamples.length < 20) failSamples.push({ request: c.request, why: v.why || vb.why }); continue; }
  if (c.task === 'edit') { const dv = diff([c.before], c.program); if (dv.verdict === 'refused' || c.before === c.program) { drops.diff_unsafe = (drops.diff_unsafe || 0) + 1; continue; } }
  seenReq.add(nr); seenProg.add(key);
  final.push({ ...c, tokens: tk, tokens_before: tb || undefined });
}
saveCache();
const ids = new Map();
const rows = final.map(c => {
  const base = `v1-${c.task === 'edit' ? 'ed' : 'cr'}-${sha(c.request + c.program).slice(0, 10)}`;
  const o = { id: base, task: c.task, request: c.request };
  if (c.task === 'edit') { o.program_before = c.before; o.before = c.before; }
  o.program = c.program;
  o.source = c.method;
  o.meta = { style: c.style, domain: c.domain, tokens: c.tokens, ...(c.tokens_before ? { tokens_before: c.tokens_before } : {}), ...(c.oos ? { oos: c.oos } : {}), ...(c.op ? { op: c.op } : {}), ...(c.verdict ? { verdict: c.verdict } : {}), ...(c.seed ? { seed: c.seed } : {}) };
  return o;
});
const file = OUT + '../' + (STAGE === 'A' ? 'stageA.jsonl' : 'v1.jsonl');
writeFileSync(file, rows.map(r => JSON.stringify(r)).join('\n') + '\n');
writeFileSync(OUT + `build-${STAGE}.json`, JSON.stringify({ candidates: cand.length, final: rows.length, drops, dropped: { fromA_fail: dropped.fromA_fail || 0, build_error: dropped.build_error.slice(0, 30), edit_error: dropped.edit_error.slice(0, 30), hand: dropped.hand }, failSamples }, null, 1));
console.log(JSON.stringify({ stage: STAGE, candidates: cand.length, final: rows.length, drops, build_errors: dropped.build_error.length, edit_errors: dropped.edit_error.length, hand_fail: dropped.hand.length }));
