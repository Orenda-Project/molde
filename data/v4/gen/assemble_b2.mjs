import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { canon, sha, norm, rng } from '../../data-v1/gen/lib.mjs';
import { derivePlan } from './derive.mjs';
const { nearest, toks } = await import('../../data-v3/gen/simcheck.mjs');
const FH = '../failhunt/';
const rd = f => readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
const log = {};
const BASE = process.argv[2] || 'v4.1.jsonl'; const baseRows = rd(BASE); const have = new Set(baseRows.map(r => r.id));
const rows = rd('out/b2_rows.jsonl').filter(r => !have.has(r.id)).map(r => ({ ...r, origin: 'v4.1' }));
const baseReq = new Set(baseRows.map(r => norm(r.request.replace(/\n/g, ' ')) + (r.task === 'edit' ? '|e|' + sha(r.program_before || '') : '|c')));
const title = p => ((p.match(/^app "([^"]*)"/) || [])[1] || '').toLowerCase();
// 1. test programs never used as a body or a before
const testProgs = new Set(); const body = p => p.split('\n').filter(x => x.trim()).join('\n');
for (const f of readdirSync(FH + 'data/long')) testProgs.add(body(readFileSync(FH + 'data/long/' + f, 'utf8')));
for (const f of ['controls/forced_cases.jsonl', 'controls/forced_v1_cases.jsonl', 'controls/forced_v2_new_cases.jsonl', 'cases.jsonl', 'controls/cases_ctrl.jsonl']) if (existsSync(FH + f)) for (const r of rd(FH + f)) { for (const k of ['before', 'program', 'seed_program']) if (typeof r[k] === 'string') testProgs.add(body(r[k])); if (r.seed && typeof r.seed.program === 'string') testProgs.add(body(r.seed.program)); }
for (const r of rd('../data-v2/heldout2.jsonl')) testProgs.add(body(r.program));
let cur = rows.filter(r => !(testProgs.has(body(r.program)) || (r.program_before && testProgs.has(body(r.program_before))))); log.test_program_rows = rows.length - cur.length;
// 2. dedupe by request (+ before for edits)
{ const seen = new Set(); const keep = []; for (const r of cur) { const k = norm(r.request.replace(/\n/g, ' ')) + (r.task === 'edit' ? '|e|' + sha(r.program_before || '') : '|c'); if (seen.has(k) || baseReq.has(k)) continue; seen.add(k); keep.push(r); } log.dup_requests = cur.length - keep.length; cur = keep; }
// 3. near-duplicates of any test request (word-set Jaccard 0.75, 0.6 for <= 5 words) with leak_check's own tool, repeated until 0
const tmpf = 'out/_leak_tmp_b2.jsonl';
for (let round = 0; round < 6; round++) {
  writeFileSync(tmpf, cur.map(r => JSON.stringify({ id: r.id, request: r.request, kind: r.task, before: r.program_before, program: r.program })).join('\n') + '\n');
  let outp = ''; try { outp = execFileSync('node', [FH + 'tools/leak_check.mjs', tmpf], { encoding: 'utf8', maxBuffer: 1 << 26 }); } catch (e) { outp = e.stdout || ''; }
  const ids = new Set([...outp.matchAll(/^LEAK \S+ (\S+) /gm)].map(m => m[1])); for (const m of outp.matchAll(/^LEAK base (\S+)/gm)) ids.add(m[1]);
  if (!ids.size) break; log['leak_round_' + round] = ids.size; cur = cur.filter(r => !ids.has(r.id));
}
// 4. the other test sets: heldout2, 60 asks, 40 changes, 140 unseen ideas, heldout ids (same thresholds)
{ const keep = []; let n = 0; const bySet = {}; for (const r of cur) { const req = r.request.split('\nQuestion:')[0]; const w = toks(req).length; const m = nearest(req); const thr = w <= 5 ? 0.6 : 0.75; if (m.sim >= thr && !(r.task === 'edit' && m.set === 'change_test' && w <= 5 && false)) { n++; bySet[m.set] = (bySet[m.set] || 0) + 1; continue; } keep.push(r); } log.other_test_sets_dropped = n; log.other_test_sets_by = bySet; cur = keep; }
// 5. title cap again (creates), 15 per app title
{ const R = rng('v4cap2'); const by = new Map(); for (const r of baseRows) if (r.task === 'create' && !r.program.startsWith('ask ')) { const t = title(r.program); (by.get(t) || by.set(t, []).get(t)).push({ ...r, origin: 'base' }); } for (const r of cur) if (r.task === 'create' && !r.program.startsWith('ask ')) { const t = title(r.program); (by.get(t) || by.set(t, []).get(t)).push(r); } const out = new Set(); for (const [t, l] of by) if (l.length > 15) for (const x of R.shuffle(l.filter(x => x.origin === 'v4.1')).slice(Math.max(0, 15 - l.filter(x => x.origin === 'base').length))) out.add(x); log.title_cap_rows = out.size; cur = cur.filter(r => !out.has(r)); }
// 6. plans for creates that lack one (v4 hand rows already have)
const numbered = p => p.replace(/\n$/, '').split('\n').map((x, i) => `${i + 1}| ${x}`).join('\n');
const final = cur.map(r => {
  const o = { id: r.id.startsWith('v4-') || r.id.startsWith('v3-') ? r.id : r.id, task: r.task, request: r.request };
  if (r.task === 'edit') { o.program_before = r.program_before; o.before = r.program_before; }
  o.program = r.program; if (r.answer !== undefined) o.answer = r.answer; if (r.plan) o.plan = r.plan;
  o.source = r.source; o.class = r.class || null;
  o.user_text = r.task === 'edit' ? `Edit request: ${r.request}\n\nCurrent program:\n${r.program_before}` : `Request: ${r.request}`;
  if (r.task === 'edit') o.user_text_numbered = `Edit request: ${r.request}\n\nCurrent program:\n${numbered(r.program_before)}`;
  o.meta = { ...(r.meta || {}), origin: r.origin, language_commit: '4698991' }; return o;
});
const ordered = rng('v4order').shuffle(final);
writeFileSync('out/newb2.jsonl', ordered.map(r => JSON.stringify(r)).join('\n') + '\n'); writeFileSync('v4.1.jsonl', [...baseRows.map(r => JSON.stringify(r)), ...ordered.map(r => JSON.stringify(r))].join('\n') + '\n');
const c = {}; for (const r of final) c[r.task] = (c[r.task] || 0) + 1;
writeFileSync('out/assemble_b2.json', JSON.stringify({ rows: final.length, tasks: c, log }, null, 1));
console.log(JSON.stringify({ rows: final.length, tasks: c, log }));
