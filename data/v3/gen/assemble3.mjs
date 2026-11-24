import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
const L = await import('../../data-v1/gen/lib.mjs');
const { canon, verify, diff, sha, norm, rng, saveCache, LANG, LANG_COMMIT } = L;
const { tokenCounts } = await import('../../data-v1/gen/tokcount.mjs');
const { readHand3 } = await import('./hand3.mjs');
const { nearest, key: simKey, changeTestPairs, HELD_N } = await import('./simcheck.mjs');
const { strip } = await import(LANG + '/format.mjs');
const D = new URL('../', import.meta.url).pathname;
const rd = f => readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
const outs = (kind) => { const m = new Map(); for (const f of readdirSync(D + 'items').filter(f => f.startsWith(`out-${kind}-`))) for (const o of rd(D + 'items/' + f)) m.set(o.id, o); return m; };
const cand = []; const info = {};
const hid = o => 'h' + sha(o.program).slice(0, 12);
// ---- hand records
const { out: hand, fails } = readHand3(D + 'hand/'); info.hand_fail = fails.length;
const named = new Map(rd(D + 'items/named-asks.jsonl').map(x => [x.id, x]));
const handBy = new Map(); const rich = [];
for (const o of hand) { handBy.set(hid(o), o); }
for (const o of hand) {
  if (o.kind === 'long') continue;
  const tag = o.id.split('-')[0]; const fam = tag.replace(/#.*/, '')[0];
  let request = o.request, source = 'hand3:' + tag, ctx = {};
  if (o.from) { const a = named.get(o.from); if (!a) continue; request = a.request; source = 'v3:named-ask-build'; ctx = { relabeled_from_ask: true, ask_id: o.from }; }
  if (!request) continue;
  rich.push(o);
  cand.push({ task: 'create', request, program: o.program, source, style: o.style || 'detailed', domain: o.domain, needs: o.needs, topic: o.topic, area: tag.replace(/-\d+\.txt/, ''), ...ctx });
}
info.rich_programs = rich.length;
// ---- short named requests
const S = outs('s'); let ns = 0;
for (const o of rich) { const s = S.get(hid(o)); if (s && s.short) { cand.push({ task: 'create', request: s.short, program: o.program, source: 'v3:short-named', style: 'short_named', domain: o.domain, needs: o.needs, topic: o.topic }); ns++; } }
info.short_named = ns;
// ---- multi-turn
const M = outs('m'); let nm = 0;
for (const o of rich) { const m = M.get(hid(o)); if (m) { cand.push({ task: 'create', request: `${m.orig}\nQuestion: ${m.question}\nAnswer: ${m.answer}`, program: o.program, source: 'v3:multi-turn', style: 'multi_turn', domain: o.domain, needs: o.needs, topic: o.topic, turns: { original: m.orig, question: m.question, options: m.options, answer: m.answer } }); nm++; } }
info.multi_turn = nm;
// ---- change-mode new app
const C2 = outs('c2'); let nc = 0;
for (const o of hand) { const c = C2.get(hid(o)); if (c && c.request) { const name = (o.program.match(/^app "([^"]*)"/) || [])[1]; if (!name) continue; cand.push({ task: 'edit', request: c.request, before: o.program, program: `ask "New app or change ${name}?" "New app" "Change ${name}"\n`, source: 'v3:change-mode-new-app', style: 'new_app_in_change_mode', domain: o.domain, askTarget: true }); nc++; } }
info.change_mode_new_app = nc;
// ---- long edits
const X = outs('x'); let nx = 0;
for (const e of rd(D + 'work/longedits-raw.jsonl')) { const x = X.get(e.id); if (x && x.request) { cand.push({ task: 'edit', request: x.request, before: e.before, program: e.after, source: 'v3:long-edit:' + e.kind, style: 'long_edit', domain: e.base, long: true, op: e.kind, keep_others: e.kept_others, keep_all: e.kept_all, tokens_before: e.tokens_before }); nx++; } }
info.long_edits = nx;
// ---- v2 rows (relabeled asks removed)
const v2 = rd(D + '../data-v2/v2.jsonl'); const namedIds = new Set(named.keys()); let v2kept = 0, v2relabeled = 0;
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
writeFileSync(D + 'v3.jsonl', ordered.map(r => JSON.stringify(r)).join('\n') + '\n');
writeFileSync(D + 'heldout_similarity.json', JSON.stringify({ held_requests_compared: HELD_N, threshold: THR, histogram_max_similarity: sim.hist, dropped_by_set: sim.bySet, dropped_examples: sim.dropped }, null, 1));
writeFileSync(D + 'out/build-v3.json', JSON.stringify({ candidates: cand.length, final: rows.length, drops, info, hand_fails: fails.slice(0, 20) }, null, 1));
console.log(JSON.stringify({ candidates: cand.length, final: rows.length, drops, info, sim: sim.hist }));
