// build_r6.mjs: round 6 training data (long-app edit rows) and the held-out eval set.   cd r6 && node build_r6.mjs [--seed r6a]
// Every row is computed from a real program of the earlier corpora (bases.mjs): the edit is built from names found in the program, the ops are
// applied with the reference applier, the result must pass the checker (verify), the change must be visible and match the request (judge6),
// untouched lines must stay identical, and the answer must not contain any of the model's observed mistakes (neg6).
// Splits are by app (cluster of near-identical programs), never by row. Outputs: data/*.jsonl, VERIFY.md (counts), EVAL.md (eval definition).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { verify, applyOps, numbered, SYSTEM_E1, rng, sha, lines, asciiOnly, load, HERE, LANG } from './lib6.mjs';
import { pm, isEnglish, GRAMMAR_GLITCH } from './pm.mjs';
import { GENS } from './gens6.mjs';
import { judge } from './judge6.mjs';
import { negatives } from './neg6.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const SEED = arg('seed', 'r6a');
const HELD_CLUSTERS = +arg('held', 22);
const TOK_LIMIT = +arg('toklimit', 900);        // planned tokens (lang/tokens.py), as in rounds 4-5: before-program limit for long programs
const CLUSTER_CAP = +arg('clustercap', 80);     // training rows per app
const KEY_REP = 2;                              // the same edit spec at most twice per app (two programs / two wordings)
mkdirSync(HERE + '/data', { recursive: true });
const bases = JSON.parse(readFileSync(HERE + '/work/bases.json', 'utf8'));
const ONLY = arg('only', 'all');   // held | train | all (each split is deterministic on its own)

// ------------------------------------------------------------------ counters
const V = { gen: {}, rejected: {}, kept: {}, byRule: {} };
const bump = (o, k, n = 1) => { o[k] = (o[k] || 0) + n; };
const reject = (kind, rule) => { bump(V.rejected, rule); bump(V.byRule, kind + '|' + rule); };

// ------------------------------------------------------------------ split by app
const open = Object.entries(bases.clusters).filter(([c, v]) => !v.reserved).map(([c]) => c);
const order = open.map(c => [sha(SEED + 'split' + c), c]).sort();
const IF_CLUSTERS = new Set(bases.programs.filter(p => /if\([^)]*"[A-Za-z][^"]*"/.test(p.program) && !p.reserved).map(p => p.cluster));
const heldSet = new Set(order.slice(0, HELD_CLUSTERS).map(x => x[1]));
{ const have = [...heldSet].filter(c => IF_CLUSTERS.has(c)).length; const want = [...order.map(x => x[1])].filter(c => IF_CLUSTERS.has(c) && !heldSet.has(c)).slice(0, Math.max(0, 3 - have)); const drop = [...heldSet].filter(c => !IF_CLUSTERS.has(c)).slice(-want.length || undefined); want.forEach((c, i) => { heldSet.add(c); if (drop[i]) heldSet.delete(drop[i]); }); }
let trainSet = new Set(open.filter(c => !heldSet.has(c)));
if (arg('quick', '')) { trainSet = new Set([...trainSet].slice(0, +arg('quick', 6))); [...heldSet].slice(+arg('quick', 6) / 2).forEach(c => heldSet.delete(c)); }
const reservedSet = new Set(Object.entries(bases.clusters).filter(([c, v]) => v.reserved).map(([c]) => c));

// ------------------------------------------------------------------ gates
const stripIds = t => JSON.stringify(t, (k, v) => (k === 'id' ? undefined : v));
const TREE = new Map(); const treeOf = src => { if (TREE.has(src)) return TREE.get(src); let t = null; try { t = stripIds(load(src, {}).tree()); } catch { t = null; } TREE.set(src, t); return t; };
const mentions = (spec, req, cand) => {   // the request must name what the edit touches
  const q = req.toLowerCase();
  if (spec.kind === 'rename') return q.includes(spec.old.toLowerCase()) && q.includes(spec.new.toLowerCase());
  if (spec.kind === 'goalnum') return q.includes(String(spec.n));
  if (spec.kind === 'rename_field') return q.includes(spec.old.replace(/_/g, ' ')) && q.includes(spec.new.replace(/_/g, ' '));
  if (['add_chart', 'add_stat', 'add_section'].includes(spec.kind)) { const stem = s => s.replace(/_/g, ' ').slice(0, 4); return q.includes(stem(spec.T)) || (spec.F && q.includes(stem(spec.F))); }
  return true;
};
function finalize(c, before, P, req) {
  const k = c.kind;
  if (!req) { reject(k, 'no_request_template'); return null; }
  const ops = c.ops;
  if (k === 'cannot' || k === 'noop') {
    const j = judge(c.spec, '', ops); if (!j.ok) { reject(k, 'refusal_target_invalid'); return null; }
    if (k === 'cannot' && !/^ask "Molde apps cannot [^"]+"( "[^"]+")+$/.test(ops)) { reject(k, 'refusal_format'); return null; }
    if (!asciiOnly(req.text + ops)) { reject(k, 'non_ascii'); return null; }
    return { ops, after: null };
  }
  let after; try { after = applyOps(before, ops); } catch (e) { reject(k, 'ops_do_not_apply'); return null; }
  if (after !== c.after) { reject(k, 'ops_result_differs_from_construction'); return null; }
  const nv = negatives(ops, lines(before)); if (nv.length) { nv.forEach(x => reject(k, 'neg_' + x)); return null; }
  const v = verify(after, true); if (!v.ok) { reject(k, 'after_fails_checker'); return null; }
  if (after === before) { reject(k, 'unchanged'); return null; }
  const j = judge(c.spec, before, after); if (!j.ok) { reject(k, 'judge: ' + j.why.replace(/[a-z_]+ ?$/i, m => m).slice(0, 38)); return null; }
  const t0 = treeOf(before), t1 = v.tree;
  if (!(c.kind === 'goalnum' && c.sub === 'setting') && c.kind !== 'rename_field' && c.kind !== 'rename' && (t0 === null || t1 === null || t0 === t1)) { reject(k, 'no_visible_change'); return null; }
  if (!mentions(c.spec, req.text, c)) { reject(k, 'request_does_not_name_the_target'); return null; }
  if (!asciiOnly(req.text) || !asciiOnly(ops) || !asciiOnly(before)) { reject(k, 'non_ascii'); return null; }
  if (GRAMMAR_GLITCH.test(req.text)) { reject(k, 'grammar_glitch_in_request'); return null; }
  { const raw = [...Object.keys(P.tables), ...Object.values(P.tables).flatMap(t => t.fields.map(f => f.name))].filter(n => !isEnglish(n)); const q = ' ' + req.text.toLowerCase().replace(/[^a-z0-9_ ]/g, ' ') + ' '; if (raw.some(n => q.includes(' ' + n.replace(/_/g, ' ') + ' ') || q.includes(' ' + n + ' ') || q.includes(' ' + n + 's '))) { reject(k, 'raw_identifier_in_request'); return null; } }
  if (/\{\w+\}/.test(req.text) || req.text.length < 4 || req.text.length > 260) { reject(k, 'bad_request_text'); return null; }
  return { ops, after };
}

// ------------------------------------------------------------------ rows
function rowFor(split, prog, c, req, fin) {
  const before = prog.program;
  const userN = `Edit request: ${req.text}\n\nCurrent program:\n${numbered(before)}`;
  const id = `r6-${split === 'train' ? 't' : 'h'}-${sha(prog.program + c.ops + req.text).slice(0, 10)}`;
  return {
    id, task: 'edit', src: 'r6', kind: c.kind, sub: c.sub, request: req.text, style: req.style, cluster: prog.cluster, base: prog.baseId, lines: prog.lines, grown: prog.grown || 0,
    before, answer: c.ops, after: fin.after, spec: c.spec,
    meta: { kind: c.kind, sub: c.sub, style: req.style, cluster: prog.cluster, lines: prog.lines, grown: prog.grown || 0, language_commit: '4698991' },
    messages: [{ role: 'system', content: SYSTEM_E1 }, { role: 'user', content: userN }, { role: 'assistant', content: c.ops }],
  };
}

// ------------------------------------------------------------------ grow: a verified additive edit makes a longer program of the same app
function grow(prog, rnd, salt) {
  const P = pm(prog.program); if (!P) return null;
  const cands = rnd.shuffle([...GENS.add_chart(P, rnd), ...GENS.add_stat(P, rnd), ...GENS.add_section(P, rnd)]);
  for (const c of cands.slice(0, 12)) {
    let after; try { after = applyOps(prog.program, c.ops); } catch { continue; }
    if (after !== c.after) continue; const L = lines(after).length; if (L > 90) continue;
    if (!verify(after).ok) continue; if (!judge(c.spec, prog.program, after).ok) continue;
    return { ...prog, program: after, lines: L, grown: (prog.grown || 0) + 1, baseId: sha(after), parent: prog.baseId, growOp: c.kind + ':' + c.sub };
  }
  return null;
}

// ------------------------------------------------------------------ build one split
const QUOTA = { add_chart: 3, add_stat: 3, add_section: 3, move: 2, delete: 2, rename: 3, goalnum: 3, rename_field: 3, cannot: 1, noop: 1 };
const KIND_ORDER = Object.keys(QUOTA);
function build(split, clusterSet, cfg) {
  const R = rng(SEED + 'order' + split); const rows = []; const perCluster = {}; const keyCount = {};
  const progs = bases.programs.filter(p => clusterSet.has(p.cluster));
  // programs per cluster: originals (capped) + grown ones
  const byC = {}; for (const p of progs) (byC[p.cluster] ??= []).push({ ...p, baseId: sha(p.program), grown: 0 });
  const pool = [];
  for (const [c, list] of Object.entries(byC)) {
    const rnd = rng(SEED + split + c);
    const orig = rnd.shuffle(list).slice(0, cfg.origPerCluster);
    pool.push(...orig);
    const grownN = cfg.grownPerCluster; const seen = new Set(orig.map(x => x.baseId));
    for (let g = 0, tries = 0; g < grownN && tries < grownN * 3; tries++) {
      let b = rnd.pick(orig); const depth = rnd.int(2, cfg.maxDepth); let cur = b;
      for (let d = 0; d < depth; d++) { const nx = grow(cur, rnd, d); if (!nx) { cur = null; break; } cur = nx; }
      if (cur && cur !== b && !seen.has(cur.baseId) && cur.lines >= 46) { seen.add(cur.baseId); pool.push(cur); g++; }
    }
  }
  V.gen[split + '_programs'] = pool.length;
  for (const prog of R.shuffle(pool)) {
    const P = pm(prog.program); if (!P) { reject('-', 'base_not_parsed'); continue; }
    const rnd = rng(SEED + split + prog.baseId);
    for (const kind of KIND_ORDER) {
      
      let cands; try { cands = GENS[kind](P, rnd); } catch (e) { reject(kind, 'generator_threw: ' + e.message.slice(0, 40)); continue; }
      bump(V.gen, kind, cands.length);
      let taken = 0;
      for (const c of rnd.shuffle(cands).sort((x, y) => (y.prio || 0) - (x.prio || 0))) {
        if (taken >= cfg.quota(kind)) break;
        if ((perCluster[prog.cluster] || 0) >= cfg.clusterCap) break;
        const kk = prog.cluster + '|' + c.key;
        if ((keyCount[kk] || 0) >= cfg.keyRep) { reject(kind, 'duplicate_spec_in_app'); continue; }
        const o = cfg.unseenShare && rnd.chance(cfg.unseenShare) ? { unseen: true } : {};
        if ((keyCount[kk] || 0) === 1 && !o.unseen) o.style = rnd.pick(['terse', 'plain', 'casual', 'specific']);
        const req = c.ask(rnd, o);
        const fin = finalize(c, prog.program, P, req); if (!fin) continue;
        keyCount[kk] = (keyCount[kk] || 0) + 1; perCluster[prog.cluster] = (perCluster[prog.cluster] || 0) + 1; taken++;
        rows.push(rowFor(split, prog, c, req, fin));
      }
    }
  }
  return rows;
}

// ------------------------------------------------------------------ run
const trainRows = ONLY === 'held' ? [] : build('train', trainSet, { origPerCluster: 12, grownPerCluster: 9, maxDepth: 14, quota: k => QUOTA[k], clusterCap: CLUSTER_CAP, keyRep: KEY_REP, unseenShare: 0 });
const heldRows = ONLY === 'train' ? [] : build('held', heldSet, { origPerCluster: 5, grownPerCluster: 5, maxDepth: 14, quota: k => Math.max(1, Math.ceil(QUOTA[k] * 0.7)), clusterCap: 40, keyRep: 1, unseenShare: 0.25 });

// tokens (planned tokens of the before program; the answer is short)
function tokens(list) { const r = spawnSync('python3', ['-c', `import sys,json;sys.path.insert(0,${JSON.stringify(LANG)});import tokens;print(json.dumps([tokens.keyword_count(x) for x in json.load(sys.stdin)]))`], { input: JSON.stringify(list), encoding: 'utf8', maxBuffer: 1 << 28 }); if (r.status !== 0) throw new Error(r.stderr); return JSON.parse(r.stdout); }
function tokenGate(rows, split) {
  const tk = tokens(rows.map(r => r.before)); const keep = [];
  rows.forEach((r, i) => { r.meta.tokens_before = tk[i]; if (tk[i] > TOK_LIMIT) reject(r.kind, 'over_token_limit'); else keep.push(r); });
  return keep;
}
let tr = tokenGate(trainRows, 'train'), he = tokenGate(heldRows, 'held');

// leak check: no held-out app program or its lines appear in a training row's before program (by app, so lines of one app only)
const heldProgs = new Set(bases.programs.filter(p => heldSet.has(p.cluster)).map(p => p.program));
const heldBodies = bases.programs.filter(p => heldSet.has(p.cluster));
const leaks = tr.filter(r => heldProgs.has(r.before)).length;
const trTitles = new Set(bases.programs.filter(p => trainSet.has(p.cluster)).map(p => p.title.toLowerCase()));
const sameTitle = [...new Set(heldBodies.map(p => p.title.toLowerCase()))].filter(t => trTitles.has(t));

// the final negative check over the kept rows
const finalNeg = {}; for (const r of [...tr, ...he]) for (const h of negatives(r.answer, lines(r.before))) bump(finalNeg, h);

{ const cnt = {}; for (const r of he) { const k = r.kind; cnt[k] = (cnt[k] || 0) + 1; r.core = sha('core' + r.id) && 0; }
  const by = {}; he.forEach(r => (by[r.kind] ??= []).push(r)); for (const [k, L] of Object.entries(by)) L.sort((a, b2) => sha('core' + a.id).localeCompare(sha('core' + b2.id))).slice(0, 28).forEach(r => { r.core = 1; }); }
const w = (f, L) => writeFileSync(HERE + '/data/' + f, L.map(x => JSON.stringify(x)).join('\n') + '\n');
const strip = r => { const { spec, before, after, ...rest } = r; return rest; };
if (ONLY !== 'held') { w('r6_train.jsonl', tr.map(r => ({ id: r.id, task: 'edit', src: 'r6', meta: r.meta, messages: r.messages })));
w('r6_train_rows.jsonl', tr); }       // same rows with before/after/spec for audits and the critic
if (ONLY !== 'train') w('r6_heldout.jsonl', he);          // eval cases (apps not in training); the scorers use before, request, spec, answer (reference)

const count = (rows, f) => { const o = {}; rows.forEach(r => bump(o, f(r))); return Object.fromEntries(Object.entries(o).sort()); };
const summary = {
  seed: SEED, train_rows: tr.length, heldout_rows: he.length,
  train_by_kind: count(tr, r => r.kind), train_by_sub: count(tr, r => r.kind + '/' + r.sub), train_by_style: count(tr, r => r.style),
  held_by_kind: count(he, r => r.kind), held_by_style: count(he, r => r.style),
  train_apps: new Set(tr.map(r => r.cluster)).size, held_apps: new Set(he.map(r => r.cluster)).size,
  train_programs: new Set(tr.map(r => r.base)).size, held_programs: new Set(he.map(r => r.base)).size,
  train_lines: { min: Math.min(...tr.map(r => r.lines)), median: tr.map(r => r.lines).sort((a, b) => a - b)[tr.length >> 1], max: Math.max(...tr.map(r => r.lines)) },
  held_lines: { min: Math.min(...he.map(r => r.lines)), median: he.map(r => r.lines).sort((a, b) => a - b)[he.length >> 1], max: Math.max(...he.map(r => r.lines)) },
  clusters: { open: open.length, train: trainSet.size, held: heldSet.size, reserved_for_old_test_sets: reservedSet.size },
  leaks_heldout_program_in_train: leaks, held_titles_also_in_train: sameTitle, final_negative_check_hits: finalNeg, gen: V.gen, rejected: V.rejected, rejected_by_kind_rule: V.byRule,
  grown_rows_train: tr.filter(r => r.grown).length, grown_rows_held: he.filter(r => r.grown).length,
  styles_per_kind_train: Object.fromEntries(Object.entries(tr.reduce((a, r) => { (a[r.kind] ??= new Set()).add(r.style); return a; }, {})).map(([k, s]) => [k, [...s].sort()])),
  distinct_request_texts_train: new Set(tr.map(r => r.request)).size,
  held_cluster_ids: [...heldSet],
};
writeFileSync(HERE + '/data/build_summary' + (ONLY === 'all' ? '' : '.' + ONLY) + '.json', JSON.stringify(summary, null, 1));
console.log(JSON.stringify({ train_rows: summary.train_rows, held_rows: summary.heldout_rows, train_by_kind: summary.train_by_kind, held_by_kind: summary.held_by_kind, apps: [summary.train_apps, summary.held_apps], rejected: V.rejected, leaks }, null, 1));
