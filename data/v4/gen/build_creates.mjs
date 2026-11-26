// hand/c-*.txt -> out/hand_creates.jsonl  (create, askset, editask records; plan lines checked with plan_check coverage)
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { canon, verify, diff, sha } from '../../data-v1/gen/lib.mjs';
import { tokenCounts } from '../../data-v1/gen/tokcount.mjs';
import { derivePlan, applyOps } from './derive.mjs';
import { parsePlan, coverage } from '../../failhunt/tools/plan_check.mjs';
const rows = readFileSync('out/derived.jsonl', 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
const byId = new Map(); for (const r of rows) if (r.task === 'create' && !r.program.startsWith('ask ')) byId.set('b' + sha(r.program).slice(0, 8), r.program);
const byTitle = new Map(); for (const r of rows) if (r.task === 'create' && !r.program.startsWith('ask ')) { const t = (r.program.match(/^app "([^"]*)"/) || [])[1]; if (t && !byTitle.has(t)) byTitle.set(t, r.program); }
const out = [], bad = [];
const askLine = a => 'ask ' + a.map(x => '"' + x.replace(/"/g, '') + '"').join(' ') + '\n';
for (const f of readdirSync('hand').filter(f => /^c-.*\.txt$/.test(f)).sort()) {
  const recs = readFileSync('hand/' + f, 'utf8').split(/^===\s*$/m).map(x => x.trim()).filter(Boolean);
  recs.forEach((rec, n) => {
    const L = rec.split('\n'); const hm = L[0].match(/^@(\w+)\s*(.*)$/); const meta = Object.fromEntries([...hm[2].matchAll(/(\w+)=(\S+)/g)].map(x => [x[1], x[2]]));
    const sep = L.findIndex(l => /^---\s*$/.test(l)); const head = L.slice(1, sep), body = L.slice(sep + 1).join('\n');
    const get = k => { const l = head.find(x => x.startsWith(k + ':')); return l ? l.slice(k.length + 1).trim() : null; };
    const id = `${f}#${n}`; const fail = why => bad.push({ id, why });
    let request = head.find(l => !/^(plan|ask|base|request):/.test(l)); if (get('request')) request = get('request'); if (!request) return fail('no request');
    const cls = meta.class || 'hand', style = meta.style || 'hand';
    const mk = (task, req, program, before, extra = {}) => ({ task, request: req, program, before, ...extra, cls, style, id0: id });
    if (hm[1] === 'create') { out.push(mk('create', request, body, null, { plan: get('plan') })); }
    else if (hm[1] === 'askset') { const a = get('ask').split('|').map(x => x.trim()); const [q, ...ch] = a; out.push(mk('create', request, askLine([q, ...ch]), null, { isAsk: true })); out.push(mk('create', `${request}\nQuestion: ${q}\nAnswer: ${ch[0]}`, body, null, { plan: get('plan') })); }
    else if (hm[1] === 'editask') { const base = meta.base.startsWith('title:') ? byTitle.get(meta.base.slice(6).replace(/_/g, ' ')) : byId.get(meta.base); if (!base) return fail('unknown base'); const a = get('ask').split('|').map(x => x.trim()); const [q, ...ch] = a; const b0 = canon(base); if (!b0.ok) return fail('base'); let after; try { after = applyOps(b0.text, body); } catch (e) { return fail('patch ' + e.message); } out.push(mk('edit', request, askLine([q, ...ch]), b0.text, { isAsk: true, answer: askLine([q, ...ch]).trim() })); out.push(mk('edit', `${request}\nQuestion: ${q}\nAnswer: ${ch[0]}`, after, b0.text, { answer: body })); }
  });
}
const final = []; const tk = tokenCounts(out.flatMap(r => r.before ? [r.program, r.before] : [r.program]));
let i = 0;
for (const r of out) {
  const t = tk[i++], tb = r.before ? tk[i++] : 0; const fail = why => bad.push({ id: r.id0, request: r.request.slice(0, 40), why });
  const c = canon(r.program); if (!c.ok) { fail('check ' + c.errors[0].slice(0, 110)); continue; }
  if (t > 500 || tb > 500) { fail('tokens'); continue; }
  const bc = r.before ? canon(r.before) : { ok: true }; if (!bc.ok) { fail('before'); continue; }
  const v = verify(c.text, bc.text && !r.isAsk ? [bc.text] : null); if (!v.ok) { fail('verify ' + v.why); continue; }
  if (bc.text && !r.isAsk) { const d = diff([bc.text], c.text); if (d.verdict === 'refused') { fail('diff refused'); continue; } if (bc.text === c.text) { fail('no-op'); continue; } }
  let plan = r.plan || null;
  if (r.task === 'create' && !r.isAsk) { if (plan) { const p = parsePlan(plan); const m = p ? coverage(p, c.text) : ['unparsed']; if (m.length) { fail('plan items not in program: ' + m.join('|')); continue; } } else plan = derivePlan(r.request, c.text); }
  final.push({ id: 'v4-' + (r.task === 'edit' ? 'e' : 'c') + '-' + sha(r.request + c.text).slice(0, 10), task: r.task, request: r.request, ...(bc.text ? { program_before: bc.text, before: bc.text } : {}), program: c.text, ...(r.answer !== undefined ? { answer: r.answer } : {}), ...(plan ? { plan } : {}), source: 'v4:hand:' + r.cls, class: r.cls, meta: { style: r.style, domain: r.id0, tokens: t, language_commit: '4698991' } });
}
writeFileSync('out/hand_creates.jsonl', final.map(r => JSON.stringify(r)).join('\n') + '\n');
const c = {}; for (const r of final) c[r.class] = (c[r.class] || 0) + 1;
console.log(JSON.stringify({ rows: final.length, per_class: c, failed: bad.length }));
for (const b of bad.slice(0, 25)) console.log('FAIL', b.id, b.request || '', b.why);
