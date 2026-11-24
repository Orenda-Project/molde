import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
const HANDDIR = new URL('../hand/', import.meta.url).pathname;
process.env.HAND_DIR = HANDDIR;
const L = await import('../../data-v1/gen/lib.mjs');
const { canon, verify, diff, sha, norm, rng, saveCache, LANG, LANG_COMMIT } = L;
const { readHand } = await import('../../data-v1/gen/hand.mjs');
const { tokenCounts } = await import('../../data-v1/gen/tokcount.mjs');
const { strip } = await import(LANG + '/format.mjs');
const D = new URL('../', import.meta.url).pathname;
const rd = f => readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
const batches = JSON.parse(readFileSync(D + 'work/batches.json', 'utf8'));
const judge = existsSync(D + 'work/judge_result.json') ? JSON.parse(readFileSync(D + 'work/judge_result.json', 'utf8')) : {};
const TEMPL_CAP = Number(process.env.TEMPL || 1800);
const cand = [], info = { batches: {}, dropped_batches: [] };
// 1. Haiku real wording
for (const [bn, b] of Object.entries(batches)) {
  const j = judge[bn]; if (j && j.yes_rate < 0.85) { info.dropped_batches.push({ batch: bn, ...j }); continue; }
  let n = 0;
  for (const f of b.files) {
    const inf = `${D}items/in-${b.kind}-${f}.jsonl`, of = `${D}items/out-${b.kind}-${f}.jsonl`; if (!existsSync(of)) continue;
    const outs = new Map(rd(of).map(o => [o.id, o]));
    for (const it of rd(inf)) {
      const o = outs.get(it.id); if (!o) continue;
      const keys = b.kind === 'a' ? ['r1', 'r2', 'r3', 'r4'] : ['hurried', 'fuller'];
      for (const k of keys) {
        const req = (o[k] || '').trim(); if (!req) continue;
        const style = b.kind === 'a' ? (k < 'r3' ? 'hurried' : 'fuller') : k;
        const base = { request: req, style, domain: 'real', persona: it.persona };
        if (b.kind === 'e') cand.push({ ...base, task: 'edit', before: it.before, program: it.after, method: 'real:edit' });
        else if (b.kind === 'a') cand.push({ ...base, task: 'create', program: it.program, method: 'real:ask', style });
        else if (b.kind === 'o') cand.push({ ...base, task: 'create', program: it.program, method: 'real:oos', oos: it.oos_kind });
        else cand.push({ ...base, task: 'create', program: it.program, method: 'real:create' });
        n++;
      }
    }
  }
  info.batches[bn] = n;
}
// 2. Sonnet naming/edit records (hand v2)
const hd = readHand();
info.hand2_fail = hd.fails;
for (const h of hd.out) cand.push({ ...h, method: h.method === 'hand-edit' ? 'hand2-edit' : h.method === 'hand-oos' ? 'hand2-oos' : 'hand2' });
// 3. v1 rows: keep hand/mutate/ask/oos-hand; sample templated
const v1 = rd(D + 'work/v1.r4.jsonl');
const templ = [];
for (const r of v1) {
  const fam = r.source.split(':')[0];
  const row = { task: r.task, request: r.request, program: r.program, before: r.program_before, method: 'v1:' + r.source, style: r.meta.style, domain: r.meta.domain, oos: r.meta.oos };
  if (['template', 'edit-template', 'oos'].includes(fam)) templ.push(row); else cand.push(row);
}
{ const byDom = {}; for (const t of templ) (byDom[t.domain] = byDom[t.domain] || []).push(t);
  const r = rng('templ'); const per = Math.max(1, Math.ceil(TEMPL_CAP / Object.keys(byDom).length));
  let picked = []; for (const list of Object.values(byDom)) picked.push(...r.shuffle(list).slice(0, per));
  picked = r.shuffle(picked).slice(0, TEMPL_CAP); cand.push(...picked); info.templated_kept = picked.length; info.templated_available = templ.length; }
// held-out 2 exclusion
const h2 = rd(D + 'heldout2.jsonl'); const h2req = new Set(h2.map(r => norm(r.request))), h2prog = new Set(h2.flatMap(r => [sha(r.program)]));
const drops = { heldout2_request: 0, heldout2_program: 0, dup_request: 0, dup_pair: 0, too_long: 0, verify_fail: 0, diff_unsafe: 0, bad_text: 0 };
const progs = []; for (const c of cand) { progs.push(c.program); if (c.before) progs.push(c.before); }
const uniq = [...new Set(progs)]; const tc = tokenCounts(uniq); const tm = new Map(uniq.map((p, i) => [p, tc[i]]));
const seenReq = new Set(), seenPair = new Set(), final = []; const fails = [];
const prio = m => m.startsWith('hand2') ? 0 : m.startsWith('real') ? 1 : m.startsWith('v1:hand') ? 2 : 3;
cand.sort((a, b) => prio(a.method) - prio(b.method));
for (const c of cand) {
  const nr = norm(c.request);
  if (!/^[\x20-\x7e]+$/.test(c.request) || c.request.length < 3 || c.request.length > 700) { drops.bad_text++; continue; }
  if (h2req.has(nr)) { drops.heldout2_request++; continue; }
  if (h2prog.has(sha(c.program))) { drops.heldout2_program++; continue; }
  if (seenReq.has(nr)) { drops.dup_request++; continue; }
  const pk = sha((c.before || '') + '\0' + c.program + '\0' + nr); if (seenPair.has(pk)) { drops.dup_pair++; continue; }
  if (tm.get(c.program) > 400 || (c.before && tm.get(c.before) > 400)) { drops.too_long++; continue; }
  const p = canon(c.program), b = c.before ? canon(strip(c.before)) : { ok: true, text: undefined };
  if (!p.ok || !b.ok) { drops.verify_fail++; fails.push({ r: c.request.slice(0, 60), why: (p.errors || b.errors)[0] }); continue; }
  const v = verify(p.text, b.text ? [b.text] : null); if (!v.ok || (b.text && !verify(b.text).ok)) { drops.verify_fail++; fails.push({ r: c.request.slice(0, 60), why: v.why }); continue; }
  if (b.text) { const d = diff([b.text], p.text); if (d.verdict === 'refused' || b.text === p.text) { drops.diff_unsafe++; continue; } }
  seenReq.add(nr); seenPair.add(pk);
  final.push({ ...c, program: p.text, before: b.text, tokens: tm.get(c.program), tokens_before: c.before ? tm.get(c.before) : undefined });
}
saveCache();
const rows = final.map(c => {
  const o = { id: 'v2-' + (c.task === 'edit' ? 'ed' : 'cr') + '-' + sha(c.request + c.program).slice(0, 10), task: c.task, request: c.request };
  if (c.task === 'edit') { o.program_before = c.before; o.before = c.before; }
  o.program = c.program; o.source = c.method;
  o.meta = { style: c.style, domain: c.domain, tokens: c.tokens, ...(c.tokens_before ? { tokens_before: c.tokens_before } : {}), ...(c.oos ? { oos: c.oos } : {}), ...(c.persona ? { persona: c.persona } : {}), language_commit: LANG_COMMIT };
  return o;
});
const ordered = rng('v2order').shuffle(rows);
writeFileSync(D + 'v2.jsonl', ordered.map(r => JSON.stringify(r)).join('\n') + '\n');
writeFileSync(D + 'out/build-v2.json', JSON.stringify({ candidates: cand.length, final: rows.length, drops, info, failSamples: fails.slice(0, 30) }, null, 1));
console.log(JSON.stringify({ candidates: cand.length, final: rows.length, drops, batches: info.batches, dropped_batches: info.dropped_batches.length, templated_kept: info.templated_kept }));
