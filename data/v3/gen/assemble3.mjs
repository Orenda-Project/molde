import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
const L = await import('../../data-v1/gen/lib.mjs');
const { canon, verify, diff, sha, norm, rng, saveCache, LANG, LANG_COMMIT, migrateBatch } = L;
const OUTD = process.env.OUTD || new URL('../', import.meta.url).pathname; const OUTNAME = process.env.OUTNAME || 'v3.jsonl';
const { tokenCounts } = await import('../../data-v1/gen/tokcount.mjs');
const { readHand3 } = await import('./hand3.mjs');
const { nearest, key: simKey, changeTestPairs, HELD_N } = await import('./simcheck.mjs');
const { strip } = await import(LANG + '/format.mjs');
const D = new URL('../', import.meta.url).pathname;
const rd = f => readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
const outs = (kind) => { const m = new Map(); for (const f of readdirSync(D + 'items').filter(f => f.startsWith(`out-${kind}-`))) for (const o of rd(D + 'items/' + f)) m.set(o.id, o); return m; };
const cand = []; const info = {};
// judge verdicts: hand records whose program misses a checklist item are dropped
const judgeMissing = new Set(); const judgeStats = {};
for (const f of readdirSync(D + 'judge').filter(f => /^out-J\d/.test(f))) { let t = 0, ok = 0, rq = 0; for (const o of rd(D + 'judge/' + f)) { t++; if (!o.missing || !o.missing.length) ok++; else judgeMissing.add(o.id); if (o.request_ok) rq++; } judgeStats[f] = { n: t, target_ok: ok, request_ok: rq }; }
info.judge = judgeStats; info.judge_dropped = judgeMissing.size;
const hid = o => 'h' + sha(o.program).slice(0, 12);
// ---- hand records
const { out: hand, fails } = readHand3(D + 'hand/'); info.hand_fail = fails.length;
const named = new Map(rd(D + 'items/named-asks.jsonl').map(x => [x.id, x]));
const handBy = new Map(); const rich = [];
for (const o of hand) { handBy.set(hid(o), o); }
for (const o of hand) {
  if (o.kind === 'long') continue;
  if (judgeMissing.has(o.id)) continue;
  const tag = o.id.split('-')[0]; const fam = tag.replace(/#.*/, '')[0];
  let request = o.request, source = 'hand3:' + tag, ctx = {};
  if (o.from) { const a = named.get(o.from); if (!a) continue; request = a.request; source = 'v3:named-ask-build'; ctx = { relabeled_from_ask: true, ask_id: o.from }; }
  if (!request) continue;
  rich.push(o);
  cand.push({ task: 'create', request, program: o.program, source, style: o.style || 'detailed', domain: o.domain, needs: o.needs, topic: o.topic, area: tag.replace(/-\d+\.txt/, ''), ...ctx });
}
info.rich_programs = rich.length;
// ---- carried over from v3.0 (short names, multi-turn, change-mode asks): their item ids were keyed to the old program text, so reuse the frozen rows and migrate the programs
{
  const old = existsSync(D + 'v3.jsonl') ? rd(D + 'v3.jsonl').filter(r => ['v3:short-named', 'v3:multi-turn', 'v3:change-mode-new-app'].includes(r.source)) : [];
  const texts = [...new Set(old.flatMap(r => r.program_before ? [r.program, r.program_before] : [r.program]))]; const mg = migrateBatch(texts); const MM = new Map(texts.map((t, i) => [t, mg[i]]));
  const cnt = {};
  for (const r of old) { cnt[r.source] = (cnt[r.source] || 0) + 1; cand.push({ task: r.task, request: r.request, before: r.program_before ? MM.get(r.program_before) : undefined, program: MM.get(r.program), source: r.source, style: r.meta.style, domain: r.meta.domain, needs: r.meta.needs, topic: r.meta.topic, turns: r.meta.turns, askTarget: !!r.meta.ask_target }); }
  info.short_named = cnt['v3:short-named'] || 0; info.multi_turn = cnt['v3:multi-turn'] || 0; info.change_mode_new_app = cnt['v3:change-mode-new-app'] || 0;
}
// ---- long edits
const X = outs('x'); let nx = 0;
const raw3 = existsSync(D + 'work/longedits3-raw.jsonl') ? rd(D + 'work/longedits3-raw.jsonl') : [];
const SKIP_KINDS = new Set(['colour', 'title', 'bigger']); // the app does these edits itself (round 4)
const rawLong = [...rd(D + 'work/longedits-raw.jsonl'), ...raw3].filter(e => !SKIP_KINDS.has(e.kind)), rawSmall = (existsSync(D + 'work/smalledits-raw.jsonl') ? rd(D + 'work/smalledits-raw.jsonl') : []).filter(e => !SKIP_KINDS.has(e.kind));
{ const texts = [...new Set([...rawLong, ...rawSmall].flatMap(e => [e.before, e.after]))]; const mg = migrateBatch(texts); const MM = new Map(texts.map((t, i) => [t, mg[i]])); for (const e of [...rawLong, ...rawSmall]) { e.before = MM.get(e.before); e.after = MM.get(e.after); } }
for (const e of rawLong) { const x = X.get(e.id); if (x && x.request) { cand.push({ task: 'edit', request: x.request, before: e.before, program: e.after, source: 'v3:long-edit:' + e.kind, style: 'long_edit', domain: e.base, long: true, op: e.kind, keep_others: e.kept_others, keep_all: e.kept_all, tokens_before: e.tokens_before }); nx++; } }
info.long_edits = nx;
// ---- small edits (colour word on the app line, title, setting with `set`) on short programs
let nse = 0;
for (const e of rawSmall) { const x = X.get(e.id); if (x && x.request) { cand.push({ task: 'edit', request: x.request, before: e.before, program: e.after, source: 'v3:small-edit:' + e.kind, style: 'small_edit', domain: e.base, op: e.kind, small: true }); nse++; } }
info.small_edits = nse;
// ---- v2 rows (relabeled asks removed)
const v2 = rd(D + '../data-v2/v2.jsonl'); { const t2 = [...new Set(v2.flatMap(r => r.program_before ? [r.program, r.program_before] : [r.program]))]; const g2 = migrateBatch(t2); const MV = new Map(t2.map((t, i) => [t, g2[i]])); for (const r of v2) { r.program = MV.get(r.program); if (r.program_before) r.program_before = MV.get(r.program_before); } } const namedIds = new Set(named.keys()); let v2kept = 0, v2relabeled = 0;
for (const r of v2) {
  if (namedIds.has(r.id)) { v2relabeled++; continue; }
  cand.push({ task: r.task, request: r.request, before: r.program_before, program: r.program, source: 'v2:' + r.source, style: r.meta.style, domain: r.meta.domain, oos: r.meta.oos, v2: true }); v2kept++;
}
info.v2_kept = v2kept; info.v2_asks_relabeled_to_builds = v2relabeled;
// ---- filters
const sim = { drop: 0, hist: { '<0.3': 0, '0.3-0.5': 0, '0.5-0.8': 0, '>=0.8': 0 }, bySet: {}, dropped: [] }; const THR = 0.8;
const progs = []; for (const c of cand) { progs.push(c.program); if (c.before) progs.push(c.before); }
const uniq = [...new Set(progs)]; const tc = tokenCounts(uniq); const tm = new Map(uniq.map((p, i) => [p, tc[i]]));
const drops = { held_similar: 0, change_test_pair: 0, dup_request: 0, too_long: 0, verify_fail: 0, diff_unsafe: 0, bad_text: 0 };
const seenReq = new Set(), seenPair = new Set(), final = [];
const prio = c => c.v2 ? 3 : c.source.startsWith('hand3') || c.source === 'v3:named-ask-build' ? 0 : 1;
cand.sort((a, b) => prio(a) - prio(b));
const ctp = changeTestPairs;
for (const c of cand) {
  const rq = c.request; const flat = rq.replace(/\n/g, ' ');
  if (!/^[\x20-\x7e\n]+$/.test(rq) || rq.length < 2 || rq.length > 900) { drops.bad_text++; continue; }
  const nr = norm(flat);
  if (!c.v2 || true) { const n = nearest(flat); const b = n.sim < 0.3 ? '<0.3' : n.sim < 0.5 ? '0.3-0.5' : n.sim < 0.8 ? '0.5-0.8' : '>=0.8'; sim.hist[b]++; if (n.sim >= THR) { drops.held_similar++; sim.bySet[n.set] = (sim.bySet[n.set] || 0) + 1; if (sim.dropped.length < 40) sim.dropped.push({ req: flat.slice(0, 80), set: n.set, sim: +n.sim.toFixed(2) }); continue; } }
  if (c.task === 'edit' && !c.askTarget) { const nm = ((c.before.match(/^app "([^"]*)"/) || [])[1] || '').toLowerCase(); const k = simKey(rq); if (ctp.some(t => t.key === k && nm.includes(t.file.split('/').pop().replace('.mo', '')))) { drops.change_test_pair++; continue; } }
  const dk = nr + (c.task === 'edit' ? '|e|' + sha(c.before || '') : '|c'); if (seenReq.has(dk)) { drops.dup_request++; continue; }
  const lim = c.long ? 900 : 500;
  if (tm.get(c.program) > lim || (c.before && tm.get(c.before) > lim)) { drops.too_long++; continue; }
  const p = canon(c.program); const b = c.before ? canon(strip(c.before)) : { ok: true };
  if (!p.ok || !b.ok) { drops.verify_fail++; continue; }
  const v = verify(p.text, c.askTarget ? null : (b.text ? [b.text] : null)); if (!v.ok || (b.text && !verify(b.text).ok)) { drops.verify_fail++; continue; }
  if (b.text && !c.askTarget) { const d = diff([b.text], p.text); if (d.verdict === 'refused' || b.text === p.text) { drops.diff_unsafe++; continue; } }
  seenReq.add(dk);
  final.push({ ...c, program: p.text, before: b.text, tokens: tm.get(c.program), tokens_before: c.before ? tm.get(c.before) : undefined });
}
saveCache();
const rows = final.map(c => {
  const o = { id: 'v3-' + (c.task === 'edit' ? 'ed' : 'cr') + '-' + sha(c.request + c.program).slice(0, 10), task: c.task, request: c.request };
  if (c.task === 'edit') { o.program_before = c.before; o.before = c.before; }
  o.program = c.program; o.source = c.source;
  o.user_text = c.task === 'edit' ? `Edit request: ${c.request}\n\nCurrent program:\n${c.before}` : `Request: ${c.request}`;
  o.meta = { style: c.style, domain: c.domain, tokens: c.tokens, ...(c.tokens_before ? { tokens_before: c.tokens_before } : {}), ...(c.long ? { long: true, op: c.op, keep_others: c.keep_others, keep_all: c.keep_all } : {}), ...(c.needs ? { needs: c.needs } : {}), ...(c.topic ? { topic: c.topic } : {}), ...(c.turns ? { turns: c.turns } : {}), ...(c.oos ? { oos: c.oos } : {}), ...(c.relabeled_from_ask ? { relabeled_from_ask: true, ask_id: c.ask_id } : {}), ...(c.askTarget ? { ask_target: 'new_app_or_change' } : {}), language_commit: LANG_COMMIT };
  return o;
});
const ordered = rng('v3order').shuffle(rows);
writeFileSync(OUTD + OUTNAME, ordered.map(r => JSON.stringify(r)).join('\n') + '\n');
writeFileSync(OUTD + 'heldout_similarity.json', JSON.stringify({ held_requests_compared: HELD_N, threshold: THR, histogram_max_similarity: sim.hist, dropped_by_set: sim.bySet, dropped_examples: sim.dropped }, null, 1));
writeFileSync(OUTD + 'build.json', JSON.stringify({ candidates: cand.length, final: rows.length, drops, info, hand_fails: fails.slice(0, 20) }, null, 1));
console.log(JSON.stringify({ candidates: cand.length, final: rows.length, drops, info, sim: sim.hist }));
