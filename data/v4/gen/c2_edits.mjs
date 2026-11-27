// c2_edits.mjs: edits computed from real programs (no hand-written rows, no generated programs).
//   node gen/c2_edits.mjs [--target 4000] [--seed c2a]    -> out/c2_rows.jsonl, out/c2_report.json
// For each base program (a create row of v4.1; long bases also come from the "before" of existing long edits) the builder
// parses the program (lang parse.mjs AST), proposes applicable edits of seven kinds plus "no change needed", computes the
// after-program by a deterministic transformation, and keeps the pair only if every gate passes:
//   checker + canonical form, evaluator (verify), data-safety diff not refused, patch ops round-trip (applyOps(before, answer) = program),
//   the edit touches only the intended lines, token limit, request not a near-duplicate of a test request.
// Only the request text is slot-filled, with names taken from the program (see c2_words.mjs); programs are never filled from skeletons.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { canon, verify, diff, sha, norm, rng, LANG } from '../../data-v1/gen/lib.mjs';
import { tokenCounts } from '../../data-v1/gen/tokcount.mjs';
import { derivePatch } from './derive.mjs';
import { applyOps, makeOps } from '../../failhunt/tools/patch_ops_ref.mjs';
import { FAMILIES, familyFor, normOpt } from './c2_families.mjs';
import { T as TPL, typo, SYN, SEC_SYN, WORD_SYN } from './c2_words.mjs';
import { TPL2, OPEN, CLOSE_N, CLOSE_R } from './c2_words2.mjs';
import { TPL3, CLOSE_NEUTRAL, CLOSE_BY_CLS } from './c2_words3.mjs';
for (const [k, v] of Object.entries(TPL2)) TPL[k] = (TPL[k] || []).concat(v);
for (const [k, v] of Object.entries(TPL3)) TPL[k] = v; // add_field, add_chart, add_list, add_section: round 3 wording replaces the earlier pools
const { parse } = await import(LANG + '/parse.mjs');
const { KEYWORDS } = await import(LANG + '/engine.mjs');
const { nearest, toks } = await import('../../data-v3/gen/simcheck.mjs');

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const TARGET = +arg('target', 4000), SEED = arg('seed', 'c2a');
const FH = '../failhunt/';
const rd = f => readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
const R = rng(SEED);

// ---------------------------------------------------------------- bases
const body = p => p.split('\n').filter(x => x.trim()).join('\n');
const testProgs = new Set();
for (const f of readdirSync(FH + 'data/long')) testProgs.add(body(readFileSync(FH + 'data/long/' + f, 'utf8')));
for (const f of ['controls/forced_cases.jsonl', 'controls/forced_v1_cases.jsonl', 'controls/forced_v2_new_cases.jsonl', 'controls/forced_fix_cases.jsonl', 'cases.jsonl', 'controls/cases_ctrl.jsonl', 'controls/identical_proof_cases.jsonl', 'controls/noop_steps_r3.jsonl'])
  if (existsSync(FH + f)) for (const r of rd(FH + f)) { for (const k of ['before', 'program', 'seed_program']) if (typeof r[k] === 'string') testProgs.add(body(r[k])); if (r.seed && typeof r.seed.program === 'string') testProgs.add(body(r.seed.program)); }
for (const r of rd('../data-v2/heldout2.jsonl')) testProgs.add(body(r.program));
// leak reference: every test request (cases.jsonl, chain steps) with the leak_check rule
const normW = s => String(s).toLowerCase().replace(/\\n/g, ' ').split('\nQuestion:')[0].replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
const jac = (a, b) => { const A = new Set(a), B = new Set(b); let i = 0; for (const x of A) if (B.has(x)) i++; return i / (A.size + B.size - i || 1); };
const testReqs = [];
for (const c of rd(FH + 'cases.jsonl')) { if (c.type === 'create') testReqs.push(normW(c.request)); else { if (c.seed.request) testReqs.push(normW(c.seed.request)); for (const s of c.steps) testReqs.push(normW(s.request.replace('{BTN}', '').replace('{FIELD}', ''))); } }
const testSet = new Set(testReqs.map(w => w.join(' ')));
function leaky(req) {
  const w = normW(req); const thr = w.length <= 5 ? 0.6 : 0.75;
  for (const tw of testReqs) { if (!tw.length) continue; if (w.join(' ') === tw.join(' ')) return true; if (w.length > 2 && jac(w, tw) >= thr) return true; }
  const m = nearest(req); if (m.sim >= thr) return true;
  return false;
}

const V41 = rd('v4.1.jsonl');
const nl = p => p.replace(/\n$/, '').split('\n').length;
function loadBases() {
  const m = new Map();
  for (const r of V41) {
    if (r.id.startsWith('c2-')) continue; // c2's own rows (and their reversed programs) are never bases
    if (r.program.startsWith('ask ')) continue;
    if (r.task === 'create') m.set(r.program, { program: r.program, from: 'create' });
    else if (r.program_before && !r.program_before.startsWith('ask ') && nl(r.program_before) >= 25 && !m.has(r.program_before)) m.set(r.program_before, { program: r.program_before, from: 'edit-before' });
  }
  const out = [];
  const titleCount = new Map();
  for (const b of R.shuffle([...m.values()])) {
    const n = nl(b.program);
    if (n < 4 || n > 90) continue;
    if (testProgs.has(body(b.program))) continue;
    if (/^\s*(def|lesson)\b/m.test(b.program)) continue;
    const title = ((b.program.match(/^app "([^"]*)"/) || [])[1] || '').toLowerCase();
    const c = titleCount.get(title) || 0; if (c >= 10) continue; titleCount.set(title, c + 1);
    b.long = n >= 25; b.id = 'b' + sha(b.program).slice(0, 8); out.push(b);
  }
  return out;
}

// ---------------------------------------------------------------- program model
function buildModel(src) {
  let prog; try { prog = parse(src); } catch { return null; }
  if (prog.errors.length || !prog.header || prog.header.kind !== 'app') return null;
  const lines = src.replace(/\n$/, '').split('\n');
  const nodes = [], byLine = new Map();
  const walk = (arr, parent) => { for (const n of arr) { n.parent = parent; n.i = n.line - 1; nodes.push(n); byLine.set(n.i, n); if (n.children) walk(n.children, n); } };
  walk(prog.body, null);
  const endOf = n => { let e = n.i; if (n.children) for (const c of n.children) e = Math.max(e, endOf(c)); n.e = e; return e; };
  prog.body.forEach(endOf);
  return { src, lines, prog, nodes, byLine, top: prog.body, header: prog.header };
}
const strLit = s => { const m = /^"((?:[^"\\]|\\.)*)"/.exec(s || ''); return m && !m[1].includes('\\') ? m[1] : null; };
const hum = s => s.replace(/_/g, ' ');
const plural = s => /(s|x|ch|sh)$/.test(s) ? s + 'es' : /[^aeiou]y$/.test(s) ? s.slice(0, -1) + 'ies' : s + 's';
const PL = t => t.length < 4 ? `${hum(t)} entries` : plural(hum(t));
const art = w => (/^[aeiou]/i.test(w) ? 'an ' : 'a ') + w;
const cap1 = s => s.charAt(0).toUpperCase() + s.slice(1);
const isVisibleSimple = n => ['call', 'text', 'each', 'button', 'box'].includes(n.kind);
const DECL = new Set(['table', 'setting', 'state', 'let', 'def', 'lesson', 'remind', 'every', 'when']);
const CHART = new Set(['daybars', 'bars', 'trend', 'heat', 'share', 'goalbars', 'daygrid', 'weekdots']);
const STATC = new Set(['stat', 'statcard', 'goal']);

function chartWords(n) {
  const a0 = n.args[0] || ''; const w = []; const win = /^last (\d+) (days|weeks|months)/.exec(a0);
  const winWords = () => { if (!win) return; const k = +win[1], u = win[2]; w.push(`last ${k} ${u} chart`); if (u === 'days' && k === 7) w.push('weekly graph', 'weekly chart', 'week chart'); if (u === 'days' && k === 30) w.push('monthly graph', 'monthly chart'); if (u === 'weeks') w.push(`${k} week chart`); };
  switch (n.name) {
    case 'daybars': w.push('bar chart', 'daily bars', 'daily chart', 'bars', 'daily graph'); winWords(); break;
    case 'goalbars': w.push('goal bars', 'bar chart', 'bars against the goal'); winWords(); break;
    case 'bars': w.push('bar chart', 'bars'); break;
    case 'trend': w.push('trend line', 'line graph', 'line chart', 'trend'); break;
    case 'heat': w.push('heat map', 'heatmap'); winWords(); break;
    case 'share': { w.push('breakdown', 'comparison chart', 'share chart'); const m = / by ([a-z_]+)/.exec(a0); if (m) w.push(`${hum(m[1])} breakdown`, `chart by ${hum(m[1])}`); break; }
    case 'daygrid': w.push('habit grid', 'day grid', 'grid of days'); break;
    case 'weekdots': w.push('week dots', 'weekly dots', 'dots for the week'); break;
  }
  if (n.name !== 'heat' && n.name !== 'weekdots') w.push('chart', 'graph'); else w.push('chart');
  return w;
}

// the things a request can name; every noun phrase in nps denotes exactly one statement of the program
function catalog(M) {
  const th = []; const lc = new Map(); const bump = l => lc.set(l.toLowerCase(), (lc.get(l.toLowerCase()) || 0) + 1);
  const L = new Map(); // node -> {type,label,nouns}
  for (const n of M.nodes) {
    let o = null;
    if (n.kind === 'call') {
      if (n.name === 'stat') { const c = strLit(n.args[1]); if (c) o = { type: 'stat', label: c, nouns: ['stat', 'number', 'box'] }; }
      else if (n.name === 'statcard') { const c = strLit(n.args[1]); if (c && !/( of| per| \/)$/.test(c) && c.length <= 40) o = { type: 'stat', label: c, nouns: ['card', 'stat', 'number'] }; }
      else if (n.name === 'goal') { const c = strLit(n.args[2]); if (c && !/( of| per)$/.test(c)) o = { type: 'stat', label: c, nouns: ['progress bar', 'goal bar'] }; }
      else if (n.name === 'section') { const c = strLit(n.args[0]); if (c) o = { type: 'section', label: c, nouns: ['section', 'card'] }; }
      else if (n.name === 'form' || n.name === 'topbar') { const c = strLit(n.args[1]); if (c) o = { type: 'btn', label: c, nouns: ['button'], form: n.name }; }
    } else if (n.kind === 'button' && n.parts.length === 1 && n.parts[0].k === 'str') o = { type: 'btn', label: n.parts[0].v, nouns: ['button'] };
    else if (n.kind === 'remind' && n.text) o = { type: 'reminder', label: n.text, nouns: ['reminder'] };
    else if (n.kind === 'text' && !n.children && n.parts.length >= 2 && n.parts[0].k === 'str' && /[A-Za-z]{3}/.test(n.parts[0].v) && n.parts[0].v.length <= 36) o = { type: 'textstat', label: n.parts[0].v.replace(/[:]$/, ''), nouns: ['line', 'text', 'number'] };
    if (o && (/[:;,]|[.?!]$|^\s|\s$/.test(o.label) || /\b(for|of|to|in|on|at|by|per|with|and|or|the|a|an|than|from|is|are)$/i.test(o.label) || (o.type !== 'btn' && (o.label.match(/[A-Za-z]/g) || []).length < 3))) o = null;
    if (o) { L.set(n, o); bump(o.label); }
  }
  const calls = n => M.nodes.filter(x => x.kind === 'call' && n.has(x.name));
  const charts = calls(CHART), stats = M.nodes.filter(x => x.kind === 'call' && x.name === 'stat' || x.name === 'statcard'), goals = calls(new Set(['goal'])), forms = calls(new Set(['form'])), lists = calls(new Set(['list']));
  const sections = calls(new Set(['section'])), reminds = M.nodes.filter(x => x.kind === 'remind');
  const tableRef = t => hum(t); const okT = t => t.length >= 3;
  const eachLists = M.nodes.filter(n => n.kind === 'each' && n.source && n.source.k === 'query' && n.source.q && n.source.q.path && n.source.q.path.parts.length === 0 && !n.source.q.by && M.lines.slice(n.i, n.e + 1).some(l => /tap edit|swipe remove/.test(l)));
  const listLikes = [...lists, ...eachLists];
  const tblOf = n => n.kind === 'each' ? n.source.q.path.head : (n.args[0] || '').split(' ')[0];
  const wordCount = new Map(); const cw = new Map();
  for (const c of charts) { cw.set(c, chartWords(c)); for (const w of new Set(cw.get(c))) wordCount.set(w, (wordCount.get(w) || 0) + 1); }
  const add = (n, type, nps, extra = {}) => th.push({ type, node: n, start: n.i, end: n.e, nps, ...extra });
  const nounPhrases = (label, nouns, loose = true) => { const o = []; for (const nn of nouns) { o.push({ t: `the "${label}" ${nn}`, k: 'label' }); if (loose && /^[A-Za-z][A-Za-z']{2,20}( [A-Za-z][A-Za-z']{1,20})?$/.test(label) && !/^(the|this|last|by|of|per|my|next|all)\b/i.test(label)) o.push({ t: `the ${label.toLowerCase()} ${nn}`, k: 'label' }); } return o; };
  for (const n of M.nodes) {
    const lab = L.get(n);
    if (n.kind === 'call' && CHART.has(n.name)) {
      const nps = []; for (const w of new Set(cw.get(n))) if (wordCount.get(w) === 1) nps.push({ t: `the ${w}`, k: 'role' });
      if (/^(?:the )?(?:chart|graph)$/.test('')) { }
      if (nps.length) add(n, 'chart', nps, { removable: true, movable: true });
    } else if (n.kind === 'call' && STATC.has(n.name)) {
      let nps = lab && lc.get(lab.label.toLowerCase()) === 1 ? nounPhrases(lab.label, lab.nouns) : [];
      if (n.name !== 'goal' && stats.length === 1 && goals.length === 0) nps.push({ t: 'the stat', k: 'role' }, { t: 'the big number', k: 'role' });
      if (n.name === 'goal' && goals.length === 1) nps.push({ t: 'the progress bar', k: 'role' }, { t: 'the goal bar', k: 'role' });
      if (nps.length) add(n, 'stat', nps, { removable: true, movable: true, label: lab && lab.label });
    } else if (n.kind === 'call' && n.name === 'list') {
      const t = tblOf(n); const same = listLikes.filter(x => tblOf(x) === t).length; const nps = [];
      if (listLikes.length === 1) nps.push({ t: 'the list', k: 'role' }, { t: 'the history', k: 'role' }, { t: 'the log', k: 'role' }, { t: 'the entries', k: 'role' });
      if (same === 1 && okT(t)) nps.push({ t: `the ${tableRef(t)} list`, k: 'role' }, { t: `the list of ${plural(tableRef(t))}`, k: 'role' }, { t: `the ${tableRef(t)} history`, k: 'role' });
      if (nps.length) add(n, 'list', nps, { removable: true, movable: true, table: t });
    } else if (n.kind === 'each' && eachLists.includes(n)) {
      const t = tblOf(n); const same = listLikes.filter(x => tblOf(x) === t).length; const nps = [];
      if (listLikes.length === 1) nps.push({ t: 'the list', k: 'role' }, { t: 'the entries', k: 'role' });
      if (same === 1 && okT(t)) nps.push({ t: `the ${tableRef(t)} list`, k: 'role' }, { t: `the list of ${plural(tableRef(t))}`, k: 'role' });
      if (nps.length) add(n, 'list', nps, { removable: true, movable: true, table: t });
    } else if (n.kind === 'call' && n.name === 'section' && lab) {
      const nps = lc.get(lab.label.toLowerCase()) === 1 ? nounPhrases(lab.label, lab.nouns, false) : [];
      if (sections.length === 1) nps.push({ t: 'the section', k: 'role' });
      if (nps.length) add(n, 'section', nps, { removable: true, movable: true, label: lab.label });
    } else if (n.kind === 'call' && n.name === 'form') {
      const nps = []; if (forms.length === 1) nps.push({ t: 'the form', k: 'role' }, { t: 'the entry form', k: 'role' }, { t: 'the input form', k: 'role' });
      if (lab && lc.get(lab.label.toLowerCase()) === 1) nps.push({ t: `the "${lab.label}" form`, k: 'label' });
      if (nps.length) add(n, 'form', nps, { removable: false, movable: true });
    } else if (n.kind === 'remind' && lab) {
      const nps = lc.get(lab.label.toLowerCase()) === 1 ? nounPhrases(lab.label, lab.nouns) : []; if (reminds.length === 1) nps.push({ t: 'the reminder', k: 'role' });
      if (nps.length) add(n, 'reminder', nps, { removable: true, label: lab.label });
    } else if (n.kind === 'button' && lab && !n.children?.length) {
      const nps = lc.get(lab.label.toLowerCase()) === 1 ? nounPhrases(lab.label, lab.nouns) : [];
      if (nps.length) add(n, 'button', nps, { removable: true, label: lab.label });
    } else if (n.kind === 'text' && lab) {
      const nps = lc.get(lab.label.toLowerCase()) === 1 ? nounPhrases(lab.label, lab.nouns, false) : [];
      if (nps.length) add(n, 'textstat', nps, { removable: true, movable: false, label: lab.label });
    }
  }
  // rename targets (button-like labels, section titles, app title, screen labels), independent of removal rules
  const labels = [];
  for (const [n, o] of L) if ((o.type === 'btn' || o.type === 'section') && lc.get(o.label.toLowerCase()) === 1) labels.push({ n, ...o });
  return { things: th, L, lc, labels, charts, sections, eachLists, listLikes };
}

// ---------------------------------------------------------------- helpers
const splitTop = s => { const out = []; let d = 0, q = false, cur = ''; for (let i = 0; i < s.length; i++) { const c = s[i]; if (c === '"') q = !q; if (!q) { if ('([{'.includes(c)) d++; if (')]}'.includes(c)) d--; if (c === ',' && d === 0) { out.push(cur); cur = ''; continue; } } cur += c; } out.push(cur); return out.map(x => x.trim()); };
const tableHead = line => (/^(table [a-z][a-z0-9_]*(?: was [a-z][a-z0-9_]*)?(?: "(?:[^"\\]|\\.)*")? )(.*)$/.exec(line) || []).slice(1);
const nonStr = (line, fn) => line.split(/("(?:[^"\\]|\\.)*")/).map((p, i) => i % 2 ? p : fn(p)).join('');
const wordRe = w => new RegExp('(?<![A-Za-z0-9_.]|[.])' + w + '(?![A-Za-z0-9_(])|(?<=\\.)' + w + '(?![A-Za-z0-9_(])', 'g');
const hasWord = (line, w) => { let f = false; nonStr(line, p => { if (new RegExp('(?<![A-Za-z0-9_])' + w + '(?![A-Za-z0-9_(])').test(p)) f = true; return p; }); return f; };
const replWord = (line, a, b) => nonStr(line, p => p.replace(new RegExp('(?<![A-Za-z0-9_])' + a + '(?![A-Za-z0-9_(])', 'g'), b));
const identsOf = M => { const s = new Set(); for (const l of M.lines) nonStr(l, p => { for (const m of p.matchAll(/[a-z][a-z0-9_]*/g)) s.add(m[0]); return p; }); return s; };
const niceNum = x => { if (x < 10) return Math.max(1, Math.round(x)); const p = Math.pow(10, Math.floor(Math.log10(x)) - 1); const v = Math.round(x / p) * p; const steps = [10, 12, 15, 20, 25, 30, 40, 50, 60, 75, 80]; let best = v; const base = Math.pow(10, Math.floor(Math.log10(v))); const m = v / base * 10; let bs = steps.reduce((a, s) => Math.abs(s - m) < Math.abs(a - m) ? s : a, steps[0]); best = bs * base / 10; return best; };
const fmtNum = v => String(Math.round(v * 100) / 100);
const mkCand = (kind, cls, o) => ({ kind, cls: o.noChange ? 'no_change' : cls, ...o });

// ---------------------------------------------------------------- generators
// each returns candidates {kind, cls, sub, after: string[] lines, touched: Set(before indexes), pools:[..], slots:{...}, noChange?}
function genRemove(M, C) {
  const out = [];
  const visibleLeft = n => M.top.filter(x => x !== n && !DECL.has(x.kind) && x.kind !== 'app').length;
  for (const t of C.things) {
    if (!t.removable) continue; const n = t.node;
    if (n.parent && n.parent.children.length === 1) continue;
    if (!n.parent && !visibleLeft(n)) continue;
    if (t.end - t.start + 1 > 14 || (t.end - t.start + 1) > 0.45 * M.lines.length) continue;
    if (t.type === 'reminder' && n.parent) continue;
    const after = M.lines.filter((_, i) => i < t.start || i > t.end);
    const touched = new Set(); for (let i = t.start; i <= t.end; i++) touched.add(i);
    out.push(mkCand('remove', 'remove_one', { sub: t.type, after, touched, pools: ['remove'], slots: { X: t.nps } }));
  }
  // fields
  const idents = identsOf(M);
  const tables = M.nodes.filter(n => n.kind === 'table');
  const fcount = new Map(); for (const tb of tables) for (const f of tb.fields) fcount.set(f.name, (fcount.get(f.name) || 0) + 1);
  const declared = new Set(M.nodes.filter(n => ['table', 'setting', 'state', 'let'].includes(n.kind)).map(n => n.name));
  for (const tb of tables) {
    if (tb.fields.length < 2) continue;
    const [head, rest] = tableHead(M.lines[tb.i]); if (!head) continue;
    const segs = splitTop(rest); if (segs.length !== tb.fields.length) continue;
    tb.fields.forEach((f, fi) => {
      if (fcount.get(f.name) !== 1 || declared.has(f.name) || /^(at|id)$/.test(f.name) || RISKY.has(f.name)) return;
      const removed = new Set([tb.i]); const gone = new Set(); let names = new Set([f.name]); let ok = true;
      for (let round = 0; round < 3 && ok; round++) {
        for (const nm of [...names]) for (let i = 0; i < M.lines.length; i++) {
          if (i === tb.i || removed.has(i) || gone.has(i)) continue;
          if (!hasWord(M.lines[i], nm)) continue;
          const n = M.byLine.get(i); if (!n) { ok = false; break; }
          if (n.kind === 'let') { for (let k = n.i; k <= n.e; k++) gone.add(k); names.add(n.name); continue; }
          const simple = (n.kind === 'call' && !n.children.length && (CHART.has(n.name) || STATC.has(n.name) || n.name === 'quick')) || (n.kind === 'text' && !n.children) || n.kind === 'field' || n.kind === 'toggle';
          if (!simple) { ok = false; break; }
          gone.add(i);
        }
      }
      if (!ok || gone.size > 4) return;
      // the lines a line removal leaves must not strand a parent
      const dead = new Set(gone);
      for (const i of gone) { const n = M.byLine.get(i); if (n && n.parent && n.parent.children.every(c => dead.has(c.i))) return; }
      const newSegs = segs.filter((_, k) => k !== fi);
      const after = M.lines.map((l, i) => i === tb.i ? head + newSegs.join(', ') : l).filter((_, i) => !gone.has(i));
      const touched = new Set([tb.i, ...gone]);
      const nm = hum(f.name); const generic = /^(title|name|label|text|heading|group|section|kind|type|size|total|count|number|note|what|who|item|thing|day|time|part|work)$/.test(nm); const nps = generic ? [{ t: `the "${nm}" field`, k: 'role' }, { t: `the "${nm}" column`, k: 'role' }] : [{ t: `the ${nm} field`, k: 'role' }, { t: `the ${nm} column`, k: 'role' }]; if (!generic) nps.push({ t: `the ${nm}`, k: 'role' }, { t: `${nm}`, k: 'role' });
      if (f.label && f.label.length < 30 && !/[^A-Za-z ]/.test(f.label)) nps.push({ t: `the ${f.label.toLowerCase()} field`, k: 'label' });
      if (/^(\w+ )?(of|per)$/.test(nm)) return;
      out.push(mkCand('remove', 'remove_one', { sub: gone.size ? 'field+dep' : 'field', after, touched, pools: gone.size ? ['remove_dep'] : ['remove'], slots: { X: nps } }));
    });
  }
  return out;
}
const RISKY = new Set('day days week weeks month months year today yesterday last prev all on by top sort desc where as empty set count sum avg min max first streak best since due gap at id index it tap swipe span text label size color unit words'.split(' '));

function genReorder(M, C) {
  const out = [];
  const containers = [{ node: null, kids: M.top }]; for (const n of M.nodes) if (n.kind === 'screen' || (n.kind === 'call' && n.name === 'section')) containers.push({ node: n, kids: n.children });
  for (const ct of containers) {
    const units = C.things.filter(t => t.movable && t.node.parent === ct.node).sort((a, b) => a.start - b.start);
    if (units.length < 2) continue;
    // "first" and "last" mean first and last visible statement of the container (the app bar, declarations and reminders do not count)
    const vis = ct.kids.filter(n => !DECL.has(n.kind) && !(n.kind === 'call' && n.name === 'topbar'));
    if (!vis.length) continue;
    const v0 = vis[0], vN = vis[vis.length - 1];
    const move = (X, p) => { const blk = M.lines.slice(X.start, X.end + 1); const rest = M.lines.filter((_, i) => i < X.start || i > X.end); const pp = p > X.start ? p - blk.length : p; return [...rest.slice(0, pp), ...blk, ...rest.slice(pp)]; };
    const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
    const touchedOf = X => { const s = new Set(); for (let i = X.start; i <= X.end; i++) s.add(i); return s; };
    const mk = (X, Y, dir, p, noChange, extra) => {
      const after = noChange ? M.lines.slice() : move(X, p);
      if (!noChange && same(after, M.lines)) return;
      const slots = { X: X.nps }; if (Y) slots.Y = Y.nps;
      out.push(mkCand('reorder', 'reorder', { sub: dir, after, touched: touchedOf(X), pools: [dir], slots, noChange, ...extra }));
    };
    const titleFirst = v0.kind === 'text'; // a title-like line on top: "first" would be ambiguous, so those cases are left out
    for (const X of units) {
      if (!titleFirst) {
        if (X.node === v0) mk(X, null, 'first', 0, true, { check: () => X.start === v0.i }); else mk(X, null, 'first', v0.i);
      }
      if (vN.kind !== 'else') { if (X.node === vN) mk(X, null, 'last', 0, true, { check: () => X.end === vN.e }); else mk(X, null, 'last', vN.e + 1); }
      for (const Y of units) {
        if (X === Y) continue;
        if (X.start < Y.start) { if (X.end + 1 === Y.start) mk(X, Y, 'above', 0, true); mk(X, Y, 'below', Y.end + 1); }
        else { mk(X, Y, 'above', Y.start); if (Y.end + 1 === X.start) mk(X, Y, 'below', 0, true); }
      }
    }
  }
  return out;
}

const NUMWORD = { 1: 'one', 2: 'two', 3: 'three', 5: 'five', 10: 'ten' };
function newLabel(old, isSection) {
  const alts = [];
  if (/^[+\-]\d*$/.test(old)) { const sign = old[0], d = old.slice(1); if (sign === '+') alts.push(d ? `Add ${d}` : 'Add', d === '1' ? 'Add one' : d ? `Plus ${d}` : 'Plus', d === '1' ? 'One more' : null); else alts.push(d ? `Take ${d}` : 'Less', d === '1' ? 'Take one' : d ? `Minus ${d}` : 'Minus'); return alts.filter(x => x && x !== old); }
  const low = old.toLowerCase();
  if (isSection && SEC_SYN[low]) return SEC_SYN[low].filter(x => x !== old);
  const words = old.split(' ');
  if (!isSection && SYN[low] && words.length === 1) return SYN[low].filter(x => x !== old);
  if (SYN[words[0].toLowerCase()] && words.length >= 2 && !isSection) { const rest = words.slice(1).join(' '); const a = SYN[words[0].toLowerCase()].filter(x => !x.includes(' ')); return a.map(x => `${x} ${rest}`).filter(x => x !== old); }
  const ws = words.map(w => w.toLowerCase());
  for (let i = 0; i < ws.length; i++) if (WORD_SYN[ws[i]]) { const nw = WORD_SYN[ws[i]]; const t = words.slice(); t[i] = i === 0 ? cap1(nw) : nw.toLowerCase(); alts.push(t.join(' ')); }
  if (isSection && words.length <= 2 && /^[A-Za-z]{3,}( [A-Za-z]{3,})?$/.test(old) && !/^(my|your|this|last|by|the|a|an|per|each|all)\b/i.test(old)) alts.push('My ' + low);
  return alts.filter(x => x && x !== old);
}
function newTitle(old) {
  const alts = []; const words = old.split(' '); const ws = words.map(w => w.toLowerCase());
  for (let i = 0; i < ws.length; i++) if (WORD_SYN[ws[i]]) { const t = words.slice(); t[i] = i === 0 ? cap1(WORD_SYN[ws[i]]) : WORD_SYN[ws[i]].toLowerCase(); alts.push(t.join(' ')); }
  if (words.length <= 2 && !/\b(log|tracker|diary|my)\b/i.test(old)) alts.push(old + ' log', 'My ' + old.toLowerCase().replace(/^./, c => c.toUpperCase()) === old ? null : 'My ' + old);
  if (words.length <= 2 && !/\b(log|tracker|diary)\b/i.test(old)) alts.push(old + ' tracker');
  return alts.filter(x => x && x !== old && x.length <= 28);
}
function genRename(M, C) {
  const out = [];
  const asc = s => /^[A-Za-z0-9 +\-']+$/.test(s) && s.length <= 24;
  const swap = (i, re, nw) => M.lines.map((l, k) => k === i ? l.replace(re, (m, a) => a + '"' + nw + '"') : l);
  for (const lab of C.labels) {
    const n = lab.n; const isSec = lab.type === 'section'; const nps = C.things.find(t => t.node === n)?.nps;
    let np = nps; if (!np) np = (lab.nouns || []).map(nn => ({ t: `the "${lab.label}" ${nn}`, k: 'label' }));
    if (isSec) np = np.filter(x => x.t.includes('"')); if (!np.length) continue;
    const esc = lab.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let re = null;
    if (n.kind === 'button') re = new RegExp('^(\\s*button )"' + esc + '"');
    else if (n.kind === 'call' && (n.name === 'form' || n.name === 'topbar')) re = new RegExp('^(\\s*(?:form|topbar) [^,]+, )"' + esc + '"');
    else if (n.kind === 'call' && n.name === 'section') re = new RegExp('^(\\s*section )"' + esc + '"');
    if (!re || !re.test(M.lines[n.i])) continue;
    const alts = newLabel(lab.label, isSec).filter(asc); if (!alts.length) continue;
    const nw = R.pick(alts);
    out.push(mkCand('rename', 'rename_button', { sub: isSec ? 'section' : 'button', after: swap(n.i, re, nw), touched: new Set([n.i]), pools: ['rename'], slots: { X: np, N: [nw] }, newLabel: nw }));
  }
  // app title
  const t0 = M.header.name; const alts = newTitle(t0).filter(asc);
  if (alts.length) { const nw = R.pick(alts); out.push(mkCand('rename', 'rename_button', { sub: 'title', after: M.lines.map((l, k) => k === 0 ? l.replace(`app "${t0}"`, `app "${nw}"`) : l), touched: new Set([0]), pools: ['rename_title'], slots: { N: [nw] }, newLabel: nw })); }
  // no change: title already that
  out.push(mkCand('rename', 'no_change', { sub: 'title', after: M.lines.slice(), touched: new Set(), pools: ['rename_title'], slots: { N: [t0] }, noChange: true }));
  // screen labels
  for (const n of M.nodes) if (n.kind === 'screen') { const m = /^(screen [a-z0-9_]+ )"([^"\\]+)"/.exec(M.lines[n.i]); if (!m) continue; const alts2 = newLabel(m[2], true).filter(asc); if (!alts2.length) continue; const nw = R.pick(alts2); const cnt = M.nodes.filter(x => x.kind === 'screen' && M.lines[x.i].includes(`"${m[2]}"`)).length; if (cnt !== 1) continue; out.push(mkCand('rename', 'rename_button', { sub: 'screen', after: M.lines.map((l, k) => k === n.i ? l.replace(/^(screen [a-z0-9_]+ )"[^"]+"/, (_, a) => a + '"' + nw + '"') : l), touched: new Set([n.i]), pools: ['rename'], slots: { X: [{ t: `the "${m[2]}" tab`, k: 'label' }, { t: `the ${m[2].toLowerCase()} tab`, k: 'label' }], N: [nw] }, newLabel: nw })); }
  return out;
}

const FSYN = Object.fromEntries(`amount:cost,total,sum|name:title|what:item,thing,details|note:comment,remark,memo|kind:type,category,group|price:cost,rate|title:name,heading|mins:minutes,duration|done:finished,complete|qty:quantity,units|due:deadline|kg:weight,kilos|item:product,thing|cost:price,spent|paid:settled,cleared|who:person|status:stage,state|subject:topic,course|phone:number,contact|customer:client,buyer|km:distance,kms|hours:hrs,duration|client:customer,buyer|litres:liters,volume|kid:child,student|team:side,squad|pts:points,score|rate:price,charge|fee:charge,cost|student:pupil,learner|pages:page_count|category:group,type,kind|reps:repetitions|place:location,spot|topic:subject,theme|memo:note,comment|tag:label,group|expires:expiry|score:points,result|member:person|stage:step,phase|room:space,area|person:name,who|child:kid,student|part:piece|rating:stars,score|task:job,chore|owner:person,holder|level:grade,stage|bought:purchased,got|area:region,zone|crop:plant,produce|priority:urgency,importance|dish:meal,food|size:measure|player:member|plant:crop|reason:cause,why|book:title|sent:posted|units:pieces|fare:cost,charge|total:sum,amount|author:writer|value:amount|job:task,work|runs:points|result:outcome,score|body:content|shop:store,vendor|route:path|role:position|rent:payment|pet:animal|kcal:calories,energy|project:task,work|ready:finished|patient:person|steps:distance|side:party|flat:unit,apartment|exercise:move,workout|service:work|waist:measure|donor:giver|bed:berth|stars:rating,score|house:home|points:score|given:handed|plan:goal,idea|packed:boxed|target:goal,aim|pieces:units|dose:measure|plate:number|class:grade,group|word:term,entry|cm:length|meaning:definition|odo:mileage,reading|sets:rounds|mood:feeling|severity:grade|batch:lot|fixed:repaired|eggs:egg_count|returned:given_back|flavour:taste|farmer:grower|work:job|grade:mark|tenant:renter|minutes:mins|renews:renewal|company:firm,business|code:ref|event:occasion|length:distance|spot:position|got:received|ml:millilitres|grams:weight|days:duration|fees:dues|temp:temperature|weight:mass|loan:debt|lent:given|borrowed:taken|people:guests|guests:attendees|dose_mg:dose`.split('|').map(x => { const [k, v] = x.split(':'); return [k, v.split(',')]; }));
function genRenameField(M, C) {
  const out = [];
  const tables = M.nodes.filter(n => n.kind === 'table'); const idents = identsOf(M);
  const fcount = new Map(); for (const tb of tables) for (const f of tb.fields) fcount.set(f.name, (fcount.get(f.name) || 0) + 1);
  const declared = new Set(M.nodes.filter(n => ['table', 'setting', 'state', 'let'].includes(n.kind)).map(n => n.name));
  for (const tb of tables) {
    const [head, rest] = tableHead(M.lines[tb.i]); if (!head) continue; const segs = splitTop(rest); if (segs.length !== tb.fields.length) continue;
    tb.fields.forEach((f, fi) => {
      const syn = FSYN[f.name]; if (!syn || fcount.get(f.name) !== 1 || declared.has(f.name) || RISKY.has(f.name) || f.was) return;
      const cands = syn.filter(s => !idents.has(s) && !KEYWORDS.has(s) && /^[a-z][a-z0-9_]*$/.test(s)); if (!cands.length) return;
      const nw = R.pick(cands);
      const touched = new Set();
      const after = M.lines.map((l, i) => {
        if (i === tb.i) { const ns = segs.map((s, k) => k === fi ? s.replace(new RegExp('^' + f.name + ' '), nw + ' ') + ' was ' + f.name : s); touched.add(i); return head + ns.join(', '); }
        if (hasWord(l, f.name)) { touched.add(i); return replWord(l, f.name, nw); } return l;
      });
      out.push(mkCand('rename_field', 'rename_field', { sub: 'field', after, touched, ti: tables.indexOf(tb), fi, ntab: tables.length, pools: ['rename_field'], slots: { o: /^(what|who|name|kind|item|done|paid|cost|note|part|side|spot|work|time|code|word|body|title|text|total|level|class|size|plan|ready|fixed|given|sent|out|flat|bed|unit|plate|grade|role|tag|job|fee|rate)$/.test(f.name) || R() < 0.25 ? [`"${hum(f.name)}"`] : [hum(f.name)], n: R() < 0.25 ? [`"${hum(nw)}"`] : [hum(nw)] } }));
    });
  }
  return out;
}

function genOption(M, C) {
  const out = [];
  const decls = []; // {line, opts, kind}
  for (const n of M.nodes) {
    if (n.kind === 'table') n.fields.forEach(f => { if (f.type.t === 'pick') decls.push({ n, opts: f.type.options, name: f.name, label: f.label, kind: 'field', f }); });
    else if ((n.kind === 'setting') && n.type.t === 'pick') decls.push({ n, opts: n.type.options, name: n.name, label: n.label, kind: 'setting' });
    else if (n.kind === 'state' && n.type && n.type.t === 'pick') decls.push({ n, opts: n.type.options, name: n.name, label: null, kind: 'state' });
  }
  const keyOf = d => d.opts.join('|'); const cnt = new Map(); for (const d of decls) cnt.set(keyOf(d), (cnt.get(keyOf(d)) || 0) + 1);
  const idents = identsOf(M);
  for (const d of decls) {
    if (d.opts.length < 2) continue;
    if (d.opts.every(o => o.length <= 2)) continue;
    if (d.kind !== 'field' && d.name.length < 3 && !d.label) continue;
    const group = decls.filter(x => keyOf(x) === keyOf(d));
    let targets = [d];
    if (group.length > 1) { if (group.length === 2 && group.some(g => g.kind === 'field') && group.some(g => g.kind !== 'field' && !g.n.force)) targets = group; else continue; }
    // the name the user uses: a field name that is unique among tables, or the setting/state label or name
    if (d.kind === 'field' && M.nodes.filter(n => n.kind === 'table').filter(tb => tb.fields.some(f => f.name === d.name)).length !== 1) continue;
    if (d.kind === 'field' && /^(at|id|a|b|c|s|t|n|x|team|side|player|who|name|owner|kid|child|person|member|student|user|by|to|from)$/.test(d.name)) continue;
    const fam = familyFor(d.opts); if (!fam) continue;
    const allT = M.nodes.filter(n => n.kind === 'table'); const tf = d.kind === 'field' ? { ti: allT.indexOf(d.n), fi: d.n.fields.indexOf(d.f), ntab: allT.length } : {};
    const have = d.opts.map(normOpt);
    const fullsize = FAMILIES.find(f => f.id === fam.family.id);
    if (fullsize.members.size <= 14 && have.filter(o => fullsize.members.has(o)).length >= 0.85 * fullsize.members.size) continue;
    const mkLine = (tg, nw, at) => {
      const key = keyOf(d); const last = d.opts[d.opts.length - 1]; let list = d.opts.slice(); if (at !== undefined) list.splice(at, 0, nw); else if (/^(Other|Others|Misc|Else|Anything)$/.test(last) && !/^(Other|Others|Misc)$/.test(nw)) list.splice(list.length - 1, 0, nw); else list.push(nw);
      const lin = M.lines[tg.n.i]; const needle = 'pick ' + key; const idx = lin.indexOf(needle); if (idx < 0 || lin.indexOf(needle, idx + 1) >= 0) return null;
      return lin.slice(0, idx) + 'pick ' + list.join('|') + lin.slice(idx + needle.length);
    };
    const fname = d.kind === 'field' ? hum(d.name) : (d.label ? d.label.toLowerCase().replace(/\s*\(.*?\)\s*/g, ' ').trim() : hum(d.name));
    const Fs = [`the ${fname}`]; if (d.label && d.kind === 'field' && !/[^A-Za-z ]/.test(d.label)) Fs.push(`the ${d.label.toLowerCase()}`);
    const existing = d.opts.map(o => hum(o));
    const slots = { F: Fs.map(t => ({ t })), A: [existing[0]], B: [existing[1]] };
    for (const nw of fam.adds.slice(0, 6)) {
      if (idents.has(nw.toLowerCase()) && false) continue;
      const after = M.lines.slice(); let okk = true; const touched = new Set();
      for (const tg of targets) { const l = mkLine(tg, nw); if (!l) { okk = false; break; } after[tg.n.i] = l; touched.add(tg.n.i); }
      if (!okk) continue;
      out.push(mkCand('add_option', 'add_option', { sub: d.kind, after, touched, pools: ['add_option'], slots: { ...slots, O: [hum(nw)] }, ...tf, family: fam.family.id, require: decls.length > 1 ? 'F' : null }));
      // the same option put at a named place in the list
      const n0 = d.opts.length; let ii = R.int(0, n0); const lastIsOther = /^(Other|Others|Misc|Else|Anything)$/.test(d.opts[n0 - 1]);
      if (lastIsOther && ii === n0) ii = n0 - 1;
      const after2 = M.lines.slice(); let ok2 = true; const touched2 = new Set();
      for (const tg of targets) { const l = mkLine(tg, nw, ii); if (!l) { ok2 = false; break; } after2[tg.n.i] = l; touched2.add(tg.n.i); }
      if (ok2) {
        const hs = d.opts.map(hum); let pools, sl = { ...slots, O: [hum(nw)] }, req = decls.length > 1 ? 'F' : null;
        if (ii === 0) { pools = ['opt_before']; sl.B = [hs[0]]; req = null; }
        else if (ii === n0) { pools = ['opt_end']; req = 'F'; }
        else { pools = ['opt_between', 'opt_after', 'opt_before']; sl.A = [hs[ii - 1]]; sl.B = [hs[ii]]; req = null; }
        out.push(mkCand('add_option', 'add_option', { sub: d.kind + '+pos', after: after2, touched: touched2, pools, slots: sl, ...tf, family: fam.family.id, require: req }));
      }
    }
    // no change: the option is already there
    if (fam.exist.length) out.push(mkCand('add_option', 'no_change', { sub: 'option', after: M.lines.slice(), touched: new Set(), pools: ['add_option'], slots: { ...slots, O: [hum(R.pick(fam.exist))] }, noChange: true, ...tf, family: fam.family.id, require: decls.length > 1 ? 'F' : null }));
  }
  return out;
}

const timeStr = (min, style) => { const h = Math.floor(min / 60) % 24, m = min % 60; return (style === 2 ? String(h).padStart(2, '0') : String(h)) + ':' + String(m).padStart(2, '0'); };
const parseTime = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
const sayTime = (t, r) => { const [h, m] = t.split(':').map(Number); const ap = h >= 12 ? 'pm' : 'am'; const h12 = h % 12 || 12; const forms = [t.replace(/^0/, '')]; if (m === 0) forms.push(`${h12}${ap}`, `${h12} ${ap}`); else forms.push(`${h12}:${String(m).padStart(2, '0')}${ap}`); return r.pick(forms); };
const sayDur = (sec, r) => { if (sec % 3600 === 0) { const h = sec / 3600; return r.pick([`${h} hour${h > 1 ? 's' : ''}`, `${h}h`]); } if (sec % 60 === 0) { const m = sec / 60; return r.pick([`${m} minutes`, `${m} min`, `${m}m`]); } return `${sec} seconds`; };
const durLit = sec => sec % 86400 === 0 ? `${sec / 86400}d` : sec % 3600 === 0 ? `${sec / 3600}h` : sec % 60 === 0 ? `${sec / 60}m` : `${sec}s`;
function newNum(v, lo, hi) {
  const opts = new Set();
  const tries = v < 10 ? [v + 1, v + 2, v - 1, v * 2, v + 3, Math.max(1, v - 2)] : [v * 1.25, v * 1.5, v * 2, v * 0.5, v * 0.75, v * 0.8, v * 1.2, v * 3, v * 0.6];
  for (const t of tries) { const x = niceNum(t); if (x !== v && x > 0 && (lo == null || x >= lo) && (hi == null || x <= hi)) opts.add(x); }
  return [...opts];
}
function genNumber(M, C) {
  const out = [];
  const settings = M.nodes.filter(n => n.kind === 'setting' && !n.parent);
  const numSettings = settings.filter(s => ['num', 'money', 'dur'].includes(s.type.t) && s.dflt && ['num', 'dur'].includes(s.dflt.k));
  for (const s of numSettings) {
    const pretty = (s.label || hum(s.name)).replace(/\s*\(.*?\)\s*/g, ' ').trim().toLowerCase();
    if (s.label && /[^A-Za-z0-9 ()'\-/]/.test(s.label)) continue;
    const dup = settings.filter(x => (x.label || x.name).toLowerCase() === (s.label || s.name).toLowerCase()).length; if (dup > 1) continue;
    const friendly = pretty.split(' ').length <= 4 && !/\b(to|below|above|before|after|of|per|at|from|for|until|than|when|if|and|or|more|less|over|under)$/.test(pretty);
    const Ss2 = friendly ? [{ t: `the ${pretty}` }, { t: `my ${pretty}` }] : [{ t: `the "${s.label || pretty}" setting` }];
    if (s.label && friendly) Ss2.push({ t: `the "${s.label}" setting` });
    const lin = M.lines[s.i]; const isDur = s.dflt.k === 'dur';
    if (s.force) continue;
    const old = s.dflt.v; const lo = s.range ? s.range.lo : null, hi = s.range ? s.range.hi : null;
    const nums = isDur ? [] : newNum(old, lo, hi); const durs = isDur ? [300, 600, 900, 1200, 1500, 1800, 2700, 3600, 5400, 7200, 10800].filter(x => x !== old) : [];
    const m = isDur ? /^(setting [a-z0-9_]+ dur(?: [0-9.]+\.\.[0-9.]*)? = )(\d+[smhd])(.*)$/.exec(lin) : /^(setting [a-z0-9_]+ (?:num|money)(?: [0-9.]+\.\.[0-9.]*)? = )(-?[0-9.]+)(.*)$/.exec(lin);
    if (!m) continue;
    const pickNew = isDur ? R.pick(durs) : nums.length ? R.pick(nums) : null; if (pickNew == null) continue;
    const lit = isDur ? durLit(pickNew) : fmtNum(pickNew);
    const after = M.lines.slice(); after[s.i] = m[1] + lit + m[3] + ' set';
    const V = isDur ? [sayDur(pickNew, R)] : [fmtNum(pickNew)];
    const pools = ['setting_value']; if (!isDur) pools.push(pickNew > old ? 'setting_up' : 'setting_down');
    out.push(mkCand('setting_value', 'setting_value', { sub: 'setting', after, touched: new Set([s.i]), pools, slots: { S: Ss2, V } }));
    // no change: already that value
    if (!isDur) out.push(mkCand('setting_value', 'no_change', { sub: 'number', after: M.lines.slice(), touched: new Set(), pools: ['setting_value'], slots: { S: Ss2, V: [fmtNum(old)] }, noChange: true }));
  }
  // range limits of table fields and settings
  const rangeOwners = [];
  for (const tb of M.nodes.filter(n => n.kind === 'table')) { const [head, rest] = tableHead(M.lines[tb.i]); if (!head) continue; const segs = splitTop(rest); if (segs.length !== tb.fields.length) continue; tb.fields.forEach((f, fi) => { if (f.type.t === 'num' && f.range && f.range.hi != null && f.range.hi > 10 && f.name.length >= 3 && !/^(every|what|who|name|kind|item|part|side|work|time|text|total|level|unit|plan|start|next|out|day|days|at)$/.test(f.name) && !f.was && M.nodes.filter(n => n.kind === 'table').filter(x => x.fields.some(y => y.name === f.name)).length === 1) rangeOwners.push({ tb, f, fi, segs, head }); }); }
  for (const o of rangeOwners) {
    const { f, tb, segs, fi, head } = o; const hi = f.range.hi, lo = f.range.lo; const dfl = f.dflt && f.dflt.k === 'num' ? f.dflt.v : null;
    const choices = (hi >= 1000 ? [hi * 2, hi * 5, hi / 2, hi * 1.5] : [hi * 2, hi / 2, hi * 1.5]).map(x => niceNum(x)).filter(x => x !== hi && x > Math.max(lo, 0) && (dfl == null || x >= dfl));
    if (!choices.length) continue; const nh = R.pick(choices);
    const seg = segs[fi]; const re = new RegExp('(^| )' + String(lo).replace('.', '\\.') + '\\.\\.' + String(hi).replace('.', '\\.') + '(?= |$)'); if (!re.test(seg)) continue;
    const ns = segs.map((s, k) => k === fi ? s.replace(re, `$1${lo}..${fmtNum(nh)}`) : s);
    const after = M.lines.slice(); after[tb.i] = head + ns.join(', ');
    const nm = f.label && !/[^A-Za-z ]/.test(f.label) ? f.label.toLowerCase() : hum(f.name);
    const Fs = [{ t: nm }, { t: hum(f.name) }, { t: `the ${hum(f.name)}` }].filter(x => !/^the the/.test(x.t)).map(x => ({ t: x.t.replace(/^the /, '') }));
    out.push(mkCand('setting_value', 'setting_value', { sub: 'range', after, touched: new Set([tb.i]), pools: ['range'], slots: { F: Fs, V: [fmtNum(nh)] } }));
  }
  // quick-add values
  for (const n of M.nodes) if (n.kind === 'call' && n.name === 'quick' && n.args.length === 3 && /^\[[0-9., ]+\]$/.test(n.args[2])) {
    const vals = n.args[2].slice(1, -1).split(',').map(x => +x.trim()); if (vals.length < 1 || vals.length > 5 || vals.some(v => !(v >= 0))) continue;
    const mkq = (nv, pool, slots) => { const after = M.lines.slice(); after[n.i] = M.lines[n.i].replace(/\[[0-9., ]+\]$/, '[' + nv.map(fmtNum).join(', ') + ']'); out.push(mkCand('setting_value', 'setting_value', { sub: 'quick', after, touched: new Set([n.i]), pools: [pool], slots })); };
    const mx = Math.max(...vals), mn = Math.min(...vals);
    const addv = niceNum(R.pick([mx * 2, mx * 1.5, mn / 2, mx * 4])); if (!vals.includes(addv) && addv > 0 && vals.length < 5) mkq([...vals, addv].sort((a, b) => a - b), 'quick_add', { V: [fmtNum(addv)] });
    const k = R.int(0, vals.length - 1); const chg = niceNum(R.pick([vals[k] * 1.2, vals[k] * 1.5, vals[k] * 0.8, vals[k] * 2, vals[k] + 50])); if (!vals.includes(chg) && chg > 0) { const nv = vals.slice(); nv[k] = chg; if (new Set(nv).size === nv.length) mkq(nv, 'quick_change', { A: [fmtNum(vals[k])], B: [fmtNum(chg)] }); }
    if (vals.length >= 2 && vals.length <= 4) { const nv = vals.map(v => niceNum(v * R.pick([2, 0.5, 1.5]))); if (new Set(nv).size === nv.length && nv.join() !== vals.join() && nv.every(x => x > 0)) mkq(nv, 'quick_set', { K: [nv.length === 2 ? `${fmtNum(nv[0])} and ${fmtNum(nv[1])}` : nv.slice(0, -1).map(fmtNum).join(', ') + ' and ' + fmtNum(nv[nv.length - 1])] }); }
  }
  // reminders
  const rem = M.nodes.filter(n => n.kind === 'remind' && !n.parent); const lc = C.lc;
  for (const n of rem) {
    const unique = lc.get(n.text.toLowerCase()) === 1 && !/[^A-Za-z0-9 ']/.test(n.text);
    const Rs = []; if (unique) Rs.push({ t: `the ${n.text.toLowerCase()} reminder` }, { t: `the "${n.text}" reminder` }); if (rem.length === 1) Rs.push({ t: 'the reminder' }, { t: 'my reminder' }); if (!Rs.length) continue;
    const lin = M.lines[n.i];
    if (n.times && n.times.length && !n.monthly && !n.at) {
      const m = /^(remind "(?:[^"\\]|\\.)*" at )([0-9:, ]+)(.*)$/.exec(lin); if (!m) continue; const ts = m[2].split(', '); if (ts.length !== n.times.length) continue;
      const k = R.int(0, ts.length - 1); const mins = parseTime(ts[k]); const style = /^0/.test(ts[k]) ? 2 : 1;
      const cand = [-120, -90, -60, -30, 30, 60, 90, 120, 180].map(d => mins + d).filter(x => x >= 5 * 60 && x <= 23 * 60 + 30); const nm = R.pick(cand); const nt = timeStr(nm, style);
      if (ts.includes(nt)) continue; const nts = ts.slice(); nts[k] = nt;
      if (nts.some((x, i) => i && parseTime(nts[i - 1]) > parseTime(x))) nts.sort((a, b) => parseTime(a) - parseTime(b));
      const after = M.lines.slice(); after[n.i] = m[1] + nts.join(', ') + m[3];
      const sub = ts.length > 1 ? `the ${ts[k].replace(/^0/, '')} ` : ''; const Rk = ts.length > 1 ? Rs.map(r => ({ t: r.t.replace(/^the /, `the ${ts[k].replace(/^0/, '')} `) })) : Rs;
      out.push(mkCand('setting_value', 'setting_value', { sub: 'time', after, touched: new Set([n.i]), pools: ['time_set'], slots: { R: Rk, T: [sayTime(nt, R)] } }));
    } else if (n.every) {
      const m = /^(remind "(?:[^"\\]|\\.)*" every )(\d+[smhd])(.*)$/.exec(lin); if (!m) continue; const opts = [900, 1800, 2700, 3600, 5400, 7200, 10800, 14400].filter(x => x !== n.every && x >= 900); const nv = R.pick(opts);
      const after = M.lines.slice(); after[n.i] = m[1] + durLit(nv) + m[3];
      out.push(mkCand('setting_value', 'setting_value', { sub: 'time', after, touched: new Set([n.i]), pools: ['time_every'], slots: { R: Rs, T: [sayDur(nv, R).replace(/^(\d+) (minutes|hours?)$/, '$1 $2')] } }));
    } else if (n.at && n.offset) {
      const m = /^(remind "(?:[^"\\]|\\.)*" at [a-z0-9_.]+ [-+] )(\d+)d(.*)$/.exec(lin); if (!m) continue; const cur = +m[2]; const opts = [1, 2, 3, 5, 7].filter(x => x !== cur); const nv = R.pick(opts);
      const after = M.lines.slice(); after[n.i] = m[1] + nv + 'd' + m[3];
      out.push(mkCand('setting_value', 'setting_value', { sub: 'time', after, touched: new Set([n.i]), pools: ['time_before'], slots: { R: Rs, T: [`${nv} day${nv > 1 ? 's' : ''}`] } }));
    } else if (n.monthly && n.monthly.length === 1) {
      const m = /^(remind "(?:[^"\\]|\\.)*" monthly on )(\d+)(.*)$/.exec(lin); if (!m) continue; const cur = +m[2]; const opts = [1, 5, 10, 15, 20, 25].filter(x => x !== cur); const nv = R.pick(opts);
      const after = M.lines.slice(); after[n.i] = m[1] + nv + m[3];
      out.push(mkCand('setting_value', 'setting_value', { sub: 'time', after, touched: new Set([n.i]), pools: ['time_month'], slots: { R: Rs, T: [String(nv)] } }));
    }
  }
  // timer duration
  for (const n of M.nodes) if (n.kind === 'call' && n.name === 'timer' && /^\d+[smh]$/.test(n.args[0])) {
    const cur = n.args[0]; const secs = +cur.slice(0, -1) * { s: 1, m: 60, h: 3600 }[cur.slice(-1)]; const opts = [300, 600, 900, 1200, 1500, 1800, 2700, 3600].filter(x => x !== secs); const nv = R.pick(opts);
    if (M.nodes.filter(x => x.kind === 'call' && x.name === 'timer').length !== 1) continue;
    const after = M.lines.slice(); after[n.i] = M.lines[n.i].replace(/^(\s*timer )\d+[smh]/, (_, a) => a + durLit(nv));
    out.push(mkCand('setting_value', 'setting_value', { sub: 'timer', after, touched: new Set([n.i]), pools: ['timer_set'], slots: { V: [sayDur(nv, R)] } }));
  }
  // numeric target of goal / statcard
  for (const n of M.nodes) if (n.kind === 'call' && ((n.name === 'goal' && /^[0-9.]+$/.test(n.args[1] || '')) || (n.name === 'statcard' && /^[0-9.]+$/.test(n.args[2] || '')))) {
    const th = C.things.find(t => t.node === n); if (!th) continue; const ai0 = n.name === 'goal' ? 1 : 2; const lit = n.args[ai0]; if (M.lines.filter((l, i) => i !== n.i && hasWord(l, lit)).length || /\d/.test(n.args.slice(0, ai0).join(' ').replace(/[a-z]+[.]?[a-z]*\d*/g, '')) || /\d/.test((strLit(n.args[n.name === 'goal' ? 2 : 1]) || ''))) continue; const ai = n.name === 'goal' ? 1 : 2; const cur = +n.args[ai]; if (cur < 10) continue; const nums = newNum(cur, 1, null); if (!nums.length) continue; const nv = R.pick(nums);
    const parts = splitTop(M.lines[n.i].replace(/^\s*[a-z]+ /, '')); if (parts.length !== n.args.length) continue; parts[ai] = fmtNum(nv);
    const ind = M.lines[n.i].match(/^ */)[0]; const after = M.lines.slice(); after[n.i] = ind + n.name + ' ' + parts.join(', ');
    out.push(mkCand('setting_value', 'setting_value', { sub: 'target', after, touched: new Set([n.i]), pools: ['target_set'], slots: { X: th.nps, V: [fmtNum(nv)] } }));
  }
  return out;
}

const ROLE = n => { if (n.kind === 'call') { if (CHART.has(n.name)) return 'chart'; if (STATC.has(n.name)) return 'stats'; if (n.name === 'list') return 'list'; } if (n.kind === 'each') return null; if (n.kind === 'box' && n.box === 'row') { const kids = n.children; if (kids.length && kids.every(k => k.kind === 'call' && STATC.has(k.name))) return 'stats'; } return null; };
const TITLES = { stats: ['Totals', 'Numbers', 'Summary', 'Overview', 'At a glance'], chart: ['Trends', 'Charts', 'Progress', 'Over time'], list: ['History', 'Entries', 'Log', 'All entries', 'Records'] };
function genSections(M, C) {
  const out = [];
  if (M.nodes.some(n => n.kind === 'screen')) return out;
  const top = M.top.filter(n => !DECL.has(n.kind));
  const units = top.map(n => ({ n, role: ROLE(n) || (n.kind === 'each' && C.eachLists.includes(n) ? 'list' : null) })).filter(u => u.role);
  const hasSec = M.top.some(n => n.kind === 'call' && n.name === 'section');
  const segs = []; for (const u of units) { const last = segs[segs.length - 1]; if (last && last.role === u.role && last.items[last.items.length - 1].n.e + 1 === u.n.i) last.items.push(u); else segs.push({ role: u.role, items: [u] }); }
  const wrapLines = (list) => { let after = M.lines.slice(); const ins = []; for (const s of list.slice().sort((a, b) => b.start - a.start)) { const blk = M.lines.slice(s.start, s.end + 1).map(l => '  ' + l); after = [...after.slice(0, s.start), `section "${s.title}"`, ...blk, ...after.slice(s.end + 1)]; } return after; };
  const usedTitles = new Set(M.nodes.filter(n => n.kind === 'call' && n.name === 'section').map(n => (strLit(n.args[0]) || '').toLowerCase()));
  const titleFor = (role, seg) => { const cands = TITLES[role].filter(t => !usedTitles.has(t.toLowerCase())); if (role === 'chart') { const a = seg.items[0].n; if (a.kind === 'call' && a.name === 'daybars' && /^last 7 days/.test(a.args[0] || '')) cands.push('Last 7 days', 'This week'); } return cands.length ? R.pick(cands) : null; };
  const deep = s => s.items.some(u => M.nodes.some(x => x.i >= u.n.i && x.i <= u.n.e && x.depth >= 7));
  // wrap one named element
  if (!hasSec) for (const seg of segs) {
    if (seg.items.length !== 1 || deep(seg)) continue; const th = C.things.find(t => t.node === seg.items[0].n); if (!th || !th.nps.length) continue; const title = titleFor(seg.role, seg); if (!title) continue;
    const s = { start: th.start, end: th.end, title }; const touched = new Set(); for (let i = s.start; i <= s.end; i++) touched.add(i);
    out.push(mkCand('sections', 'sections', { sub: 'wrap', after: wrapLines([s]), touched, pools: ['wrap'], slots: { X: th.nps, T: [title] } }));
  }
  // split the screen into sections by role segments
  const wr = segs.filter(s => !deep(s));
  if (!hasSec && wr.length >= 2 && wr.length === segs.length) {
    const sel = wr.map(s => ({ start: s.items[0].n.i, end: s.items[s.items.length - 1].n.e, title: titleFor(s.role, s) })); if (sel.some(s => !s.title)) return out;
    if (new Set(sel.map(s => s.title)).size === sel.length) {
      const touched = new Set(); for (const s of sel) for (let i = s.start; i <= s.end; i++) touched.add(i);
      const titles = sel.map(s => s.title); const L = titles.length === 2 ? `${titles[0]} and ${titles[1]}` : titles.slice(0, -1).join(', ') + ' and ' + titles[titles.length - 1];
      out.push(mkCand('sections', 'sections', { sub: 'split', after: wrapLines(sel), touched, pools: ['split'], slots: { L: [L] } }));
    }
  }
  return out;
}

// ---------------------------------------------------------------- reversal kinds: add field / stat / chart / list+section / reminder
// Take a real program P that has the thing, remove it cleanly to get P'. Row: before = P', request = "add <the thing, described>", after = P.
const WINTXT = { today: 'today', yesterday: 'yesterday', week: 'this week', month: 'this month', year: 'this year', 'prev week': 'last week', 'prev month': 'last month', 'prev year': 'last year', all: 'of all time' };
const winPhrase = w => { if (!w) return ''; if (WINTXT[w]) return WINTXT[w]; const k = /^last (\d+) (days|weeks|months)$/.exec(w); return k ? `over the last ${k[1]} ${k[2]}` : null; };
const WIN_RE = '(?:today|yesterday|week|month|year|prev week|prev month|prev year|all|last \\d+ (?:days|weeks|months))';
function parseAgg(s, perItem) {
  let m = new RegExp('^(sum|avg|min|max|last|first)\\(([a-z][a-z0-9_]*)\\.([a-z][a-z0-9_]*)(?: (' + (perItem ? 'on it' : WIN_RE) + '))?(?: where ([a-z][a-z0-9_]*) = ([A-Za-z0-9_]+))?\\)$').exec(s);
  if (m) return { fn: m[1], t: m[2], f: m[3], win: m[4] || null, wf: m[5] || null, wv: m[6] || null };
  m = new RegExp('^count\\(([a-z][a-z0-9_]*)(?: (' + (perItem ? 'on it' : WIN_RE) + '))?(?: where ([a-z][a-z0-9_]*) = ([A-Za-z0-9_]+))?\\)$').exec(s);
  if (m) return { fn: 'count', t: m[1], f: null, win: m[2] || null, wf: m[3] || null, wv: m[4] || null };
  if (!perItem && (m = /^(streak|best|since)\(([a-z][a-z0-9_]*)\)$/.exec(s))) return { fn: m[1], t: m[2], f: null, win: null, wf: null, wv: null };
  return null;
}
function aggWords(a, perDay) {
  const t = hum(a.t), f = a.f && hum(a.f);
  const base = { sum: /^(amount|cost|price|fee|rate|total|value)$/.test(a.f || '') ? `the total ${f} from ${t}` : R.pick([`the total ${f} from ${t}`, `how much ${f} i put in ${t}`]), avg: `the average ${f} in ${t}`, min: `the lowest ${f} in ${t}`, max: `the highest ${f} in ${t}`, last: `the latest ${f} in ${t}`, first: `the earliest ${f} in ${t}`, count: R.pick([`how many ${t} entries i made`, `how often i logged ${t}`, `the number of ${t} entries`]), streak: `my current streak of days with ${t}`, best: `my longest streak of days with ${t}`, since: `how many days it has been since the last ${t}` }[a.fn];
  const w = perDay ? R.pick([' each day', ' day by day']) : (a.win ? winPhrase(a.win) : '');
  if (w === null) return null;
  const wh = a.wf ? `, only where ${hum(a.wf)} is ${hum(a.wv)}` : '';
  return base + wh + (w ? (w.startsWith(' ') ? w : ' ' + w) : '');
}
const litStr = s => { const m = /^"([^"\\]*)"$/.exec(s || ''); return m ? m[1] : null; };
const numOrName = s => /^[0-9.]+$/.test(s || '') ? { num: s } : /^[a-z][a-z0-9_]*$/.test(s || '') ? { name: s } : null;
// returns {D: [phrases], role} for a leaf call node, or null when its content cannot be said in words that fix the line exactly
function describeNode(n) {
  if (n.kind !== 'call' || (n.children && n.children.length)) return null;
  const A = n.args;
  if (n.name === 'stat' || n.name === 'statcard') {
    const cap = litStr(A[1]); if (cap === null || cap.length < 2) return null;
    const agg = parseAgg(A[0], false); if (!agg) return null; const w = aggWords(agg, false); if (!w) return null;
    if (n.name === 'stat' && A.length === 2) return { role: 'stat', D: [`a stat showing ${w}, captioned "${cap}"`, `a big number for ${w} with the caption "${cap}"`, `a stat with the caption "${cap}" that shows ${w}`] };
    if (n.name === 'statcard' && A.length === 2) return { role: 'stat', D: [`a stat card showing ${w}, captioned "${cap}"`, `a card with a big number for ${w} and the caption "${cap}"`] };
    if (n.name === 'statcard' && A.length === 3) { const tg = numOrName(A[2]); if (!tg) return null; const tt = tg.num ? `a target of ${tg.num}` : `the ${hum(tg.name)} as its target`; return { role: 'stat', D: [`a stat card showing ${w}, captioned "${cap}", with ${tt}`, `a card with ${w} and a progress ring toward ${tt.replace(/^a /, 'a ')}, caption "${cap}"`] }; }
    return null;
  }
  if (n.name === 'goal') {
    if (A.length < 3 || A.length > 4) return null; const agg = parseAgg(A[0], false); if (!agg) return null; const w = aggWords(agg, false); if (!w) return null;
    const tg = numOrName(A[1]); if (!tg) return null; const cap = litStr(A[2]); if (cap === null) return null; const suf = A[3] === undefined ? null : litStr(A[3]); if (A[3] !== undefined && suf === null) return null;
    const tt = tg.num ? `${tg.num}` : `the ${hum(tg.name)}`;
    const sx = suf ? `, with the unit "${suf}"` : '';
    return { role: 'stat', D: [`a progress bar of ${w} toward ${tt}, captioned "${cap}"${sx}`, `a goal bar for ${w} against ${tt} with the caption "${cap}"${sx}`] };
  }
  if (n.name === 'daybars' || n.name === 'heat' || n.name === 'goalbars' || n.name === 'daygrid') {
    const wm = /^last (\d+) (days|weeks|months)$/.exec(A[0] || ''); let winT = wm ? ((wm[1] === '7' && wm[2] === 'days') ? R.pick(['the last 7 days', 'the past week']) : (wm[1] === '14' && wm[2] === 'days') ? R.pick(['the last 14 days', 'the past two weeks']) : `the last ${wm[1]} ${wm[2]}`) : ({ week: 'this week', month: 'this month', year: 'this year', 'prev month': 'last month', 'prev week': 'last week' })[A[0]];
    if (!winT) return null;
    const agg = parseAgg(A[1], true); if (!agg) return null; const w = aggWords(agg, true); if (!w) return null;
    if (n.name === 'daybars' && A.length === 2) return { role: 'chart', D: [`bars of ${w} over ${winT}`, `a bar chart of ${w}, for ${winT}`, `a bar chart for ${winT} showing ${w}`, w.startsWith('how ') ? `${w}, as a bar chart over ${winT}` : `how ${w} looks as a bar chart over ${winT}`] };
    if ((n.name === 'heat' || n.name === 'daygrid') && (A.length === 2 || A.length === 3)) { let pk = ''; if (A.length === 3) { if (!/^[0-9.]+$/.test(A[2])) return null; pk = `, where ${A[2]} is the darkest`; }
      if (n.name === 'heat') return { role: 'chart', D: [`a heat map of ${winT} that shows ${w}${pk}`, `a calendar heat map over ${winT} showing ${w}${pk}`] };
      return { role: 'chart', D: [`a habit grid with one cell per day over ${winT} showing ${w}${pk.replace('darkest', 'fullest')}`, `a grid of days for ${winT} that fills up with ${w}${pk.replace('darkest', 'fullest')}`] }; }
    if (n.name === 'goalbars' && A.length === 3) { const tg = numOrName(A[2]); if (!tg) return null; const tt = tg.num ? tg.num : `the ${hum(tg.name)}`; return { role: 'chart', D: [`bars of ${w} over ${winT} with a goal line at ${tt}`, `a bar chart for ${winT} that shows ${w} against ${tt}`] }; }
    return null;
  }
  if (n.name === 'weekdots' && A.length === 1) { const m = /^count\(([a-z][a-z0-9_]*) on it\) > 0$/.exec(A[0]); if (!m) return null; return { role: 'chart', D: [`a row of dots for the past week, filled on days when i made ${art(hum(m[1]) + ' entry')}`, `dots for each day of the week that fill in whenever i log ${hum(m[1])}`] }; }
  if (n.name === 'bars' && A.length === 3) {
    const sm = new RegExp('^([a-z][a-z0-9_]*)(?: (' + WIN_RE + '))? by ([a-z][a-z0-9_]*)$').exec(A[0] || ''); if (!sm || A[2] !== 'it.key') return null;
    let vw; if (A[1] === 'count(it)') vw = 'how many there are'; else { const m = /^(sum|avg)\(it\.([a-z][a-z0-9_]*)\)$/.exec(A[1]); if (!m) return null; vw = `the ${m[1] === 'sum' ? 'total' : 'average'} ${hum(m[2])}`; }
    const wp = sm[2] ? ' ' + winPhrase(sm[2]) : ''; if (sm[2] && !winPhrase(sm[2])) return null;
    return { role: 'chart', D: [`a bar chart with one bar for each ${hum(sm[3])}, showing ${vw}${wp} from ${hum(sm[1])}`, `bars that compare each ${hum(sm[3])} of ${hum(sm[1])} by ${vw}${wp}`] };
  }
  if (n.name === 'trend' && A.length === 2) {
    const sm = new RegExp('^([a-z][a-z0-9_]*)(?: (last \\d+ (?:days|weeks|months)))? sort at$').exec(A[0] || ''); const vm = /^it\.([a-z][a-z0-9_]*)$/.exec(A[1] || ''); if (!sm || !vm) return null;
    const wp = sm[2] ? ' ' + winPhrase(sm[2]) : '';
    return { role: 'chart', D: [`a line chart of how my ${hum(vm[1])} in ${hum(sm[1])} changed${wp}, oldest first`, `a trend line of ${hum(vm[1])} from ${hum(sm[1])}${wp}`] };
  }
  if (n.name === 'share' && A.length === 3) {
    const sm = new RegExp('^([a-z][a-z0-9_]*)(?: (' + WIN_RE + '))? by ([a-z][a-z0-9_]*)$').exec(A[0] || ''); if (!sm || A[2] !== 'it.key') return null;
    let vw; if (A[1] === 'count(it)') vw = 'how many there are'; else { const m = /^(sum|avg)\(it\.([a-z][a-z0-9_]*)\)$/.exec(A[1]); if (!m) return null; vw = `the ${m[1] === 'sum' ? 'total' : 'average'} ${hum(m[2])}`; }
    const wp = sm[2] ? ' ' + winPhrase(sm[2]) : ''; if (sm[2] && !winPhrase(sm[2])) return null;
    return { role: 'chart', D: [`a breakdown of ${hum(sm[1])} by ${hum(sm[3])} that shows ${vw}${wp}`, `a comparison of ${hum(sm[1])} grouped by ${hum(sm[3])}, with ${vw}${wp}`] };
  }
  if (n.name === 'list') {
    const m = /^([a-z][a-z0-9_]*)( by day)?$/.exec(A[0] || ''); if (!m || A.length > 2) return null; let emp = ''; if (A.length === 2) { const e = litStr(A[1]); if (e === null) return null; emp = R.pick([`, and say "${e}" when there is nothing yet`, `, with the message "${e}" while it is empty`]); }
    const g = m[2] ? R.pick([', grouped by day', ', day by day']) : '';
    return { role: 'list', D: [`a list of all my ${PL(m[1])}${g}${emp}`, `the ${hum(m[1])} history${g}${emp}`, `everything i logged in ${hum(m[1])}${g}${emp}`, `the latest ${hum(m[1])} entries first${g}${emp}`] };
  }
  return null;
}
function positionClauses(M, C, n) {
  const kids = n.parent ? n.parent.children : M.top; const i = kids.indexOf(n);
  const vis = kids.filter(x => !DECL.has(x.kind) && !(x.kind === 'call' && x.name === 'topbar'));
  const npOf = x => { const t = C.things.find(y => y.node === x); return t && t.nps.length ? R.pick(t.nps).t : null; };
  const prev = kids[i - 1], next = kids[i + 1]; const cl = [];
  const box = n.parent && n.parent.kind === 'box' ? n.parent.box : null; const nested = n.parent && n.parent.kind !== 'screen' && !(n.parent.kind === 'call' && n.parent.name === 'section');
  if (vis[vis.length - 1] === n) { if (!nested) cl.push('', '', ' at the bottom', ' at the end'); else if (box) cl.push(` at the end of the ${box}`); if (prev && npOf(prev)) cl.push(` below ${npOf(prev)}`, ` under ${npOf(prev)}`, ` after ${npOf(prev)}`); }
  else if (vis[0] === n && vis.length > 1) { if (!nested) cl.push(' at the top', ' at the very top'); else if (box) cl.push(` at the start of the ${box}`); if (next && next.kind !== 'else' && npOf(next)) cl.push(` above ${npOf(next)}`); }
  else { if (next && next.kind !== 'else' && npOf(next)) cl.push(` above ${npOf(next)}`, ` right before ${npOf(next)}`); if (prev && prev.kind !== 'if' && npOf(prev)) cl.push(` below ${npOf(prev)}`, ` right after ${npOf(prev)}`); }
  return cl;
}
function fieldMeaning(nm0, tt, m) {
  const nm = /^(what|who|why|how|when|which|where|to|from|by|at)$/.test(nm0) ? `"${nm0}"` : nm0;
  const pickL = o => o.length === 2 ? `${o[0]} or ${o[1]}` : o.slice(0, -1).join(', ') + ' or ' + o[o.length - 1];
  let bases;
  if (tt.startsWith('pick ')) { const l = pickL(tt.slice(5).split('|').map(hum)); bases = [`a choice of ${l} for the ${nm}`, `one of ${l} for the ${nm}`, `which ${nm} it is, one of ${l}`]; }
  else if (tt.startsWith('ref ')) { const t = hum(tt.slice(4)); bases = [`which ${t} it belongs to, as the ${nm}`, `the ${nm}, picked from my ${plural(t)}`]; }
  else bases = ({ text: [`some text for the ${nm}`, `a short ${nm}`], long: [`a long ${nm} that can run over several lines`, `several lines of text for the ${nm}`], num: [`a number of ${nm}`, `how many ${nm}`, `the number of ${nm}`], money: [`the ${nm} amount in money`, `the ${nm}, an amount of money`], bool: [`a yes or no for ${nm}`, `a tick for ${nm}`, `yes or no for ${nm}`], date: [`a date for the ${nm}`, `the date of the ${nm}`], time: [`a time of day for the ${nm}`], when: [`the date and time of the ${nm}`, `a date with a time for the ${nm}`], dur: [`a length of time for the ${nm}`, `how long the ${nm} takes, as a length of time`], image: [`a picture for the ${nm}`, `a photo for the ${nm}`] })[tt];
  const out = [];
  for (const b of bases) {
    let d = b; const ex = [];
    if (m[3]) ex.push(R.pick([' (it can stay empty)', ', but it is optional', ', if i know it']));
    if (m[4]) { const r = /^ ([-0-9.]+)\.\.([0-9.]*)$/.exec(m[4]); if (r[2]) ex.push(R.pick([`, between ${r[1]} and ${r[2]}`, `, from ${r[1]} up to ${r[2]}`])); else ex.push(r[1] === '0' ? ', never below zero' : r[1] === '1' ? ', at least one' : `, at least ${r[1]}`); }
    if (m[7]) ex.push(R.pick([`, in ${m[7]}`, `, measured in ${m[7]}`]));
    if (m[5]) { const dv = m[5]; if (dv === 'yes') ex.push(', ticked by default'); else if (dv === 'today') ex.push(', today by default'); else if (/^"/.test(dv)) ex.push(`, starting as ${dv}`); else ex.push(R.pick([`, usually ${hum(dv)}`, `, starting at ${hum(dv)}`])); }
    if (m[6]) ex.push(R.pick([`, and show it on the form as "${m[6]}"`, `, labelled "${m[6]}" on the form`]));
    out.push(d + ex.join(''));
  }
  return out;
}
const sectionD = (title, note, c) => {
  const nt = note ? R.pick([` with the little caption "${note}" beside it`, ` and the small text "${note}"`]) : '';
  return [`a block titled "${title}"${nt} showing ${c}`, `a card named "${title}"${nt} that has ${c} in it`, `a new "${title}" section${nt} with ${c}`, `a "${title}" card${nt} holding ${c}`, `a section with the heading "${title}"${nt} and ${c} inside`, `${c}, under a heading "${title}"${nt}`, `${c} in a box called "${title}"${nt}`, `a titled area "${title}"${nt} for ${c}`, `a panel headed "${title}"${nt} where i can see ${c}`, `a "${title}" part of the screen${nt} with ${c}`];
};
function genAdd(M, C) {
  const out = [];
  const lines = M.lines;
  const mkRow = (cls, sub, n, desc, pos, noNC) => {
    const start = n.i, end = n.e; const before = lines.filter((_, i) => i < start || i > end);
    if (n.parent && n.parent.children.length === 1) return;
    if (!n.parent && !M.top.some(x => x !== n && !DECL.has(x.kind) && x.kind !== 'app')) return;
    const D = desc.D;
    out.push(mkCand('add', cls, { sub, after: lines.slice(), beforeSrc: before.join('\n') + '\n', touched: new Set(), pools: [sub.startsWith('section') ? 'add_section' : cls], slots: { D }, pos }));
    if (!noNC) out.push(mkCand('add', 'no_change', { sub: 'add_present', after: lines.slice(), touched: new Set(), pools: [cls === 'add_list' && sub === 'section' ? 'add_section' : cls], slots: { D }, noChange: true, check: () => true }));
  };
  for (const n of M.nodes) {
    if (n.kind === 'call' && !n.children.length && (STATC.has(n.name) || CHART.has(n.name) || n.name === 'list')) {
      const d = describeNode(n); if (!d) continue; const pos = positionClauses(M, C, n); if (!pos.length) continue;
      mkRow(d.role === 'stat' ? 'add_stat' : d.role === 'chart' ? 'add_chart' : 'add_list', d.role, n, d, pos);
    } else if (n.kind === 'call' && n.name === 'section' && n.children.length === 1) {
      const t = litStr(n.args[0]); if (!t || n.args.length > 2) continue; if (n.args.length === 2 && litStr(n.args[1]) === null) continue;
      const ch = n.children[0]; const cd = describeNode(ch); if (!cd) continue; const pos = positionClauses(M, C, n); if (!pos.length) continue;
      const D = sectionD(t, n.args.length === 2 ? litStr(n.args[1]) : '', R.pick(cd.D));
      mkRow('add_list', 'section', n, { D }, pos);
      if (cd.role === 'chart' || cd.role === 'stat') mkRow(cd.role === 'chart' ? 'add_chart' : 'add_stat', 'section+' + cd.role, n, { D }, pos, true);
    }
  }
  // fields: unreferenced, last in their table (or placed by name)
  const tables = M.nodes.filter(n => n.kind === 'table' && !n.was);
  for (const tb of tables) {
    if (tb.fields.length < 2) continue; const [head, rest] = tableHead(M.lines[tb.i]); if (!head) continue; const segs = splitTop(rest); if (segs.length !== tb.fields.length) continue;
    segs.forEach((seg, fi) => {
      const f = tb.fields[fi]; if (f.was || RISKY.has(f.name)) return;
      if (M.lines.some((l, i) => i !== tb.i && hasWord(l, f.name))) return;
      if (tables.some(o => o !== tb && o.fields.some(g => g.name === f.name))) return;
      const m = /^([a-z][a-z0-9_]*) (text|long|num|money|bool|date|time|when|dur|image|pick [A-Za-z0-9_|]+|ref [a-z][a-z0-9_]*)(\?)?( [-0-9.]*\.\.[0-9.]*)?(?: = ("[^"]*"|[^ ]+))?(?: "([^"]*)")?(?: unit "([^"]*)")?$/.exec(seg); if (!m) return;
      const rebuilt = `${m[1]} ${m[2]}${m[3] || ''}${m[4] || ''}${m[5] ? ' = ' + m[5] : ''}${m[6] ? ' "' + m[6] + '"' : ''}${m[7] ? ' unit "' + m[7] + '"' : ''}`; if (rebuilt !== seg) return;
      const nm = hum(m[1]); const tt = m[2];
      const D = fieldMeaning(nm, tt, m);
      const tn = hum(tb.name); const multi = tables.length > 1;
      const Q = multi ? (/(entry|entries)$/.test(tn) ? [` in the ${tn} list`, ` in the ${tn} list`] : [` for each ${tn}`, ` in the ${tn} list`, ` on the ${tn} form`]) : ['', '', ''];
      let pos; if (fi === tb.fields.length - 1) pos = ['', '', '']; else { const nx = hum(tb.fields[fi + 1].name), pv = hum(tb.fields[fi - 1] ? tb.fields[fi - 1].name : ''); const q = x => /^(next|what|who|name|day|time|text|kind|item|part|work|done|paid|total|label|size|unit|start|end|note|to|from|at|by|last|first)$/.test(x) ? `"${x}"` : x; pos = [`, before the ${q(nx)}`, `, ahead of the ${q(nx)}`]; if (fi > 0) pos.push(`, after the ${q(pv)}`, `, right after the ${q(pv)}`); }
      const beforeLines = M.lines.map((l, i) => i === tb.i ? head + segs.filter((_, k) => k !== fi).join(', ') : l);
      out.push(mkCand('add', 'add_field', { sub: fi === tb.fields.length - 1 ? 'field-last' : 'field-mid', after: M.lines.slice(), beforeSrc: beforeLines.join('\n') + '\n', touched: new Set([tb.i]), pools: ['add_field'], slots: { D, Q: Q.map(x => x) }, pos, ti: M.nodes.filter(n => n.kind === 'table').indexOf(tb), fi, ntab: M.nodes.filter(n => n.kind === 'table').length }));
      if (fi === tb.fields.length - 1) out.push(mkCand('add', 'no_change', { sub: 'add_present', after: M.lines.slice(), touched: new Set(), pools: ['add_field'], slots: { D, Q }, noChange: true, check: () => true }));
    });
  }
  // reminders: a reminder draws nothing, so its place among the declarations carries no meaning. The rule for the answer is:
  // a new reminder goes right after the last declaration at the top (table, setting, state, let, other reminders).
  // P is normalised once (the reminder moved there) so that before + answer = that program; meta.normalized marks the rows that needed the move.
  for (const n of M.top.filter(x => x.kind === 'remind' && !x.cond)) {
    const lin = M.lines[n.i]; const tx = n.text; let d = null;
    if (!/^[A-Za-z0-9 '?-]{3,40}$/.test(tx)) continue;
    if (n.times && n.times.length && !n.monthly && !n.at) { const m = /^remind "[^"]*" at ([0-9:, ]+)(?: on ((?:mon|tue|wed|thu|fri|sat|sun)(?: (?:mon|tue|wed|thu|fri|sat|sun))*))?$/.exec(lin); if (m) { const ts = m[1].split(', '); const tw = ts.length > 1 ? ts.slice(0, -1).join(', ') + ' and ' + ts[ts.length - 1] : ts[0]; const dw = m[2] ? ' on ' + m[2].split(' ').map(x => cap1(x)).join(' and ') : ''; d = [`a reminder "${tx}" at ${tw}${dw}`, `a daily reminder saying "${tx}" at ${tw}${dw}`]; } }
    else if (n.every) { const m = /^remind "[^"]*" every (\d+)([smhd])(?: from ([0-9:]+) to ([0-9:]+))?$/.exec(lin); if (m) { const u = { s: 'second', m: 'minute', h: 'hour', d: 'day' }[m[2]]; const per = `every ${m[1] === '1' ? '' : m[1] + ' '}${u}${m[1] === '1' ? '' : 's'}`; const win = m[3] ? ` from ${m[3]} to ${m[4]}` : ''; d = [`a reminder "${tx}" ${per}${win}`, `a repeating reminder saying "${tx}" ${per}${win}`]; } }
    else if (n.monthly && n.times && n.times.length === 1) { const m = /^remind "[^"]*" monthly on ([0-9, ]+) at ([0-9:]+)$/.exec(lin); if (m) { const ds = m[1].split(', '); const dw = ds.length > 1 ? ds.slice(0, -1).join(', ') + ' and ' + ds[ds.length - 1] : ds[0]; d = [`a monthly reminder "${tx}" on day ${dw} at ${m[2]}`, `a reminder saying "${tx}" on day ${dw} of every month at ${m[2]}`]; } }
    if (!d) continue;
    const rest = lines.filter((_, i) => i !== n.i); // P without the reminder, indexes shift after n.i
    const restTop = M.top.filter(x => x !== n);
    let k = 0; while (k < restTop.length && DECL.has(restTop[k].kind)) k++;
    if (k === 0) continue;
    const lastDecl = restTop[k - 1]; const insAt = lastDecl.e + 1 - (lastDecl.i > n.i ? 1 : 0); // index in `rest` after the last leading declaration
    const afterLines = [...rest.slice(0, insAt), lin, ...rest.slice(insAt)];
    const moved = afterLines.join('\n') !== lines.join('\n');
    out.push(mkCand('add', 'add_reminder', { sub: moved ? 'reminder-moved' : 'reminder', after: afterLines, beforeSrc: rest.join('\n') + '\n', touched: new Set(), pools: ['add_reminder'], slots: { D: d }, pos: ['', ''], normalized: moved }));
    if (!moved) out.push(mkCand('add', 'no_change', { sub: 'add_present', after: lines.slice(), touched: new Set(), pools: ['add_reminder'], slots: { D: d }, noChange: true, check: () => true }));
  }
  return out;
}

const GENS = [genRemove, genReorder, genRename, genRenameField, genOption, genNumber, genSections, genAdd];
function candidates(M) { const C = catalog(M); const out = []; for (const g of GENS) { try { out.push(...g(M, C)); } catch (e) { if (process.env.DEBUG) console.error(g.name, e.message); } } return out; }

// ---------------------------------------------------------------- requests
const usage = new Map(); // pool|index -> uses
function fill(tpl, slots, r) {
  return tpl.replace(/\{([A-Za-z])\}/g, (_, k) => { const v = slots[k]; if (!v) throw new Error('slot ' + k); const x = r.pick(v); return typeof x === 'string' ? x : x.t; });
}
const splitEnd = s => { const m = /^([\s\S]*?)([?!.]*)$/.exec(s); return [m[1], m[2]]; };
const REASONED = new Set(['remove_one', 'reorder', 'rename_button', 'rename_field', 'add_option', 'sections']);
function makeRequest(c, baseKey) {
  const need = tpl => [...tpl.matchAll(/\{([A-Za-z])\}/g)].every(m => c.slots[m[1]]) && (!c.require || tpl.includes('{' + c.require + '}'));
  const all = []; for (const p of c.pools) (TPL[p] || []).forEach((tpl, i) => { if (need(tpl)) all.push({ p, i, tpl }); });
  if (!all.length) return null;
  const used = baseKey.usedTpl;
  all.sort((a, b) => (usage.get(a.p + '|' + a.i) || 0) - (usage.get(b.p + '|' + b.i) || 0) || R() - 0.5);
  const minU = usage.get(all[0].p + '|' + all[0].i) || 0;
  const pool = all.filter(x => (usage.get(x.p + '|' + x.i) || 0) <= minU + 1 && !used.has(x.p + '|' + x.i));
  for (const t of (pool.length ? pool : all)) {
    if (used.has(t.p + '|' + t.i)) continue;
    let text; let typod = false;
    try {
      const slots = { ...c.slots }; if (slots.X) slots.X = R.shuffle(slots.X); if (slots.Y) slots.Y = R.shuffle(slots.Y);
      let tp = t.tpl; if (R() < 0.05) { const t2 = typo(tp, R); if (t2 !== tp) { tp = t2; typod = true; } }
      text = fill(tp, slots, R);
    } catch { continue; }
    let [core, end] = splitEnd(text);
    if (c.pos && !c.noChange) core += R.pick(c.pos);
    let oi = -1, ci = -1;
    if (R() < 0.3) { oi = R.int(0, OPEN.length - 1); core = OPEN[oi] + ' ' + core; }
    if (R() < 0.3 && end !== '?') { const byCls = CLOSE_BY_CLS[c.cls]; const list = byCls && R() < 0.5 ? byCls : CLOSE_NEUTRAL; ci = R.int(0, list.length - 1) + (list === byCls ? 100 : 0); core += list[ci % 100]; }
    let req = core + end;
    const st = R(); const endP = /[?!.]$/.test(req);
    if (st < 0.3) req = cap1(req); else if (st < 0.4 && !endP) req = cap1(req) + '.'; else if (st < 0.45 && !endP) req = req + '!';
    req = req.replace(/\s+/g, ' ').replace(/ ([,.?!])/g, '$1').trim();
    if (/[^\x20-\x7e]/.test(req) || req.length < 3 || req.length > 420) continue;
    if (leaky(req)) continue;
    return { req, pool: t.p, idx: t.i, typo: typod, skel: `${t.p}:${t.i}|${oi}|${ci}` };
  }
  return null;
}

// ---------------------------------------------------------------- gates + selection
const stats = { bases: 0, cand: 0, gate_fail: {}, kept: 0 };
const fail = w => { stats.gate_fail[w] = (stats.gate_fail[w] || 0) + 1; return null; };
function gate(M, c) {
  if (c.noChange) {
    if (c.check && !c.check()) return fail('nochange-predicate');
    return { before: M.src, after: M.src, answer: 'none' };
  }
  let B0 = M.src;
  if (c.beforeSrc) { const kb = canon(c.beforeSrc); if (!kb.ok) return fail('before-check'); if (kb.text !== c.beforeSrc) return fail('before-noncanon'); B0 = kb.text; const vb = verify(B0); if (!vb.ok) return fail('before-verify'); }
  const a0 = c.after.join('\n') + '\n';
  const k = canon(a0); if (!k.ok) return fail('check:' + (k.errors[0].match(/E_[A-Z_]+/) || ['?'])[0]);
  const after = k.text; if (after === B0) return fail('no-op');
  const v = verify(after, [B0]); if (!v.ok) return fail('verify:' + v.why.slice(0, 30));
  const d = diff([B0], after); if (d.verdict === 'refused') return fail('diff-refused');
  const pt = derivePatch(B0, after); if (!pt) return fail('patch');
  let ok = false; try { ok = applyOps(B0, pt.answer) === after; } catch { }
  if (!ok) return fail('roundtrip');
  const B = B0.replace(/\n$/, '').split('\n'), A = after.replace(/\n$/, '').split('\n');
  if (c.kind === 'reorder') { if ([...B].sort().join('\n') !== [...A].sort().join('\n')) return fail('not-a-permutation'); }
  else {
    const refd = new Set(); for (const op of pt.answer.split('\n')) { let m; if ((m = /^(?:replace|delete|move) (\d+)(?:-(\d+))?/.exec(op))) for (let x = +m[1]; x <= +(m[2] || m[1]); x++) refd.add(x - 1); }
    for (const x of refd) if (!c.touched.has(x)) return fail('touched-outside');
    const keep = B.filter((_, i) => !c.touched.has(i)); let j = 0; for (const l of A) if (j < keep.length && l === keep[j]) j++; if (j !== keep.length) return fail('untouched-changed');
    if (c.kind === 'add' && A.length <= B.length - 0 && c.cls !== 'add_field') return fail('add-did-not-grow');
  }
  return { before: B0, after, answer: pt.answer };
}

function buildRow(c, g, rq, base) {
  const before = g.before, program = g.after;
  const meta = { style: 'c2', domain: base.id, sub: c.sub, tpl: rq.pool + ':' + rq.idx, skel: rq.skel, tokens: 0, language_commit: '4698991', origin: 'v4.1' };
  if (rq.typo) meta.typo = true; if (base.long) meta.long = true; if (c.family) meta.family = c.family; if (c.normalized) meta.normalized = true; if (c.noChange) meta.no_change = true;
  const numbered = before.replace(/\n$/, '').split('\n').map((x, i) => `${i + 1}| ${x}`).join('\n');
  return { id: 'c2-e-' + sha(rq.req + before + program + g.answer).slice(0, 10), task: 'edit', request: rq.req, program_before: before, before, program, answer: g.answer, source: 'v4:c2:' + c.cls, class: c.cls, user_text: `Edit request: ${rq.req}\n\nCurrent program:\n${before}`, user_text_numbered: `Edit request: ${rq.req}\n\nCurrent program:\n${numbered}`, meta };
}

const OLD = ['remove_one', 'reorder', 'rename_button', 'rename_field', 'add_option', 'setting_value', 'sections'];
const NEW = ['add_field', 'add_stat', 'add_chart', 'add_list', 'add_reminder'];
const POSKINDS = new Set(['add_option', 'rename_field', 'add_field']);
const ncSub = {};
function main() {
  const bases = loadBases();
  const long = bases.filter(b => b.long), short = bases.filter(b => !b.long);
  console.error('bases', bases.length, 'long', long.length, 'short', short.length);
  if (process.env.DIAG3) { let n1 = 0; for (const b of long) { const M = buildModel(b.program); if (!M) continue; const C = catalog(M); const cs = genAdd(M, C); const ch = M.nodes.filter(n => n.kind === 'call' && CHART.has(n.name) && describeNode(n)).length; const got = cs.filter(c => c.cls === 'add_chart').length; if (ch && !got && n1++ < 3) { console.log(ch, got, M.nodes.filter(n => n.kind === 'call' && CHART.has(n.name) && describeNode(n)).map(n => n.src + ' parent=' + (n.parent && n.parent.kind) + ' sib=' + (n.parent ? n.parent.children.length : 'top'))); } } process.exit(0); }
  if (process.env.DIAG2) { let tot = 0, desc = 0, pos = 0, rem = 0; const why = {}; for (const b of long) { const M = buildModel(b.program); if (!M) continue; const C = catalog(M); for (const n of M.nodes) if (n.kind === 'call' && CHART.has(n.name)) { tot++; const d = describeNode(n); if (!d) { const k = n.name + ':' + n.args.length; why[k] = (why[k] || 0) + 1; if ((why[k]) <= 2) console.log('NODESC', n.src); continue; } desc++; if (positionClauses(M, C, n).length) pos++; } } console.log({ tot, desc, pos }, why); process.exit(0); }
  if (process.env.DIAG) { const cc = {}, bb = {}; for (const b of long) { const M = buildModel(b.program); if (!M) continue; const seen = new Set(); for (const c of candidates(M)) { cc[c.cls] = (cc[c.cls] || 0) + 1; if (!seen.has(c.cls)) { seen.add(c.cls); bb[c.cls] = (bb[c.cls] || 0) + 1; } } } console.log('long cands', JSON.stringify(cc), 'bases with >=1', JSON.stringify(bb)); process.exit(0); }
  const OLDQ = +arg('oldq', 450), NEWQ = +arg('newq', 520), NCQ = +arg('ncq', 170), NEWLONG = Math.ceil(NEWQ * 0.36);
  const quota = {}; for (const k of OLD) quota[k] = OLDQ; for (const k of NEW) quota[k] = NEWQ; quota.no_change = NCQ;
  const count = Object.fromEntries(Object.keys(quota).map(k => [k, 0])), countLong = { ...count };
  const out = []; const seenReq = new Set(); const baseUsed = new Map();
  const ONLY = arg('only', null) ? arg('only', '').split(',') : null; const KEEP = arg('keep', null); let keptRows = []; const bias = {};
  if (KEEP) {
    const dropIds = new Set(['c2-e-908ad5545f', 'c2-e-d3d4c6a94f']); const badTpl = /^(add_field|add_chart|add_list|add_section):/;
    keptRows = rd(KEEP).filter(r => !ONLY.includes(r.class) && !dropIds.has(r.id) && !(r.class === 'no_change' && badTpl.test(r.meta.tpl || '')));
    for (const r of keptRows) { const bu = baseUsed.get(r.meta.domain) || { n: 0, per: {}, tpl: new Set(), bef: new Set() }; baseUsed.set(r.meta.domain, bu); bu.n++; bu.per[r.class] = (bu.per[r.class] || 0) + 1; bu.bef.add(r.program_before); seenReq.add(norm(r.request) + '|' + r.meta.domain); if (r.class === 'no_change') ncSub[r.meta.sub] = (ncSub[r.meta.sub] || 0) + 1; }
  }
  const process_ = (b, maxPer, kinds) => {
    stats.bases++;
    const M = buildModel(b.program); if (!M) return;
    let cs = candidates(M).filter(c => kinds.includes(c.cls)); stats.cand += cs.length;
    for (const c of cs) c.pos1 = c.touched && c.touched.size ? Math.min(...c.touched) + 1 : 99;
    const bu = baseUsed.get(b.id) || { n: 0, per: {}, tpl: new Set(), bef: new Set() }; baseUsed.set(b.id, bu);
    cs = R.shuffle(cs);
    while (bu.n < maxPer) {
      const room = kinds.filter(k => (bu.per[k] || 0) < 2 && count[k] < quota[k] && (!b.long || !NEW.includes(k) || countLong[k] < NEWLONG) && cs.some(c => c.cls === k)).sort((a, z) => (count[a] / quota[a]) - (count[z] / quota[z]));
      if (!room.length) break;
      const k = room[0]; let done = false;
      for (let ci = 0; ci < cs.length; ci++) {
        const c = cs[ci]; if (c.cls !== k) continue;
        if (POSKINDS.has(k)) {
          const st = (bias[k] ||= { t0: 0, t1: 0, t2: 0, f0: 0, tot: 0, late: 0 }); const t = st.tot + 1;
          if (c.ti != null) { const cap = k === 'add_field' ? [0.5, 0.45, 1] : [0.36, 0.38, 0.30]; if (c.ti === 0 && st.t0 + 1 > cap[0] * t) continue; if (c.ti === 1 && st.t1 + 1 > cap[1] * t) continue; if (c.fi === 0 && st.f0 + 1 > cap[2] * t) continue; }
          if (c.pos1 <= 2 && st.late < 0.65 * t) continue;
        }
        if (k === 'no_change' && c.sub === 'title' && (ncSub.title || 0) >= 0.2 * NCQ) { continue; }
        if (k === 'no_change' && (ncSub[c.sub] || 0) >= 0.3 * NCQ) { continue; }
        const rq = makeRequest(c, { usedTpl: bu.tpl }); if (!rq) { cs.splice(ci, 1); ci--; continue; }
        const key = norm(rq.req) + '|' + b.id; if (seenReq.has(key)) continue;
        if (c.beforeSrc && bu.bef.has(c.beforeSrc)) continue;
        const g = gate(M, c); if (!g) { cs.splice(ci, 1); ci--; continue; }
        const row = buildRow(c, g, rq, b); seenReq.add(key); if (c.beforeSrc) bu.bef.add(c.beforeSrc); bu.tpl.add(rq.pool + '|' + rq.idx);
        usage.set(rq.pool + '|' + rq.idx, (usage.get(rq.pool + '|' + rq.idx) || 0) + 1);
        row.meta.pos1 = c.pos1; if (c.ti != null) { row.meta.ti = c.ti; row.meta.fi = c.fi; row.meta.ntab = c.ntab; }
        out.push(row); count[k]++; if (b.long) countLong[k]++; bu.per[k] = (bu.per[k] || 0) + 1; bu.n++;
        if (POSKINDS.has(k)) { const st = bias[k]; st.tot++; if (c.pos1 >= 3) st.late++; if (c.ti != null) { st[c.ti === 0 ? 't0' : c.ti === 1 ? 't1' : 't2']++; if (c.fi === 0) st.f0++; } }
        if (k === 'no_change') ncSub[c.sub] = (ncSub[c.sub] || 0) + 1;
        cs.splice(ci, 1); done = true; break;
      }
      if (!done) bu.per[k] = 2;
    }
  };
  if (ONLY) {
    for (const b of long) process_(b, 4, ONLY);
    for (const b of short) { if (ONLY.every(k => count[k] >= quota[k])) break; process_(b, 4, ONLY); }
    out.unshift(...keptRows);
  } else {
    for (const b of long) process_(b, 4, NEW);
    for (const b of long) process_(b, 4, [...OLD, 'no_change']);
    const allK = Object.keys(quota);
    for (const b of short) { if (allK.every(k => count[k] >= quota[k])) break; process_(b, 4, allK); }
  }
  console.error('counts', JSON.stringify(count), 'long', JSON.stringify(countLong));
  const progs = out.flatMap(r => [r.program, r.program_before]); const tk = tokenCounts(progs);
  const kept = []; let tokDrop = 0;
  out.forEach((r, i) => { const a = tk[2 * i], b = tk[2 * i + 1]; const lim = r.meta.long ? 900 : 500; if (a > lim || b > lim) { tokDrop++; return; } r.meta.tokens = Math.max(a, b); kept.push(r); });
  stats.token_drop = tokDrop; stats.kept = kept.length;
  writeFileSync('out/c2_rows.jsonl', kept.map(r => JSON.stringify(r)).join('\n') + '\n');
  const per = {}; for (const r of kept) { const k = r.class + (r.meta.long ? '/long' : '/short'); per[k] = (per[k] || 0) + 1; }
  // histogram of the first changed line per kind
  const bucket = n => n <= 2 ? 'line2' : n === 3 ? 'line3' : n === 4 ? 'line4' : n <= 6 ? 'line5-6' : n <= 10 ? 'line7-10' : n <= 20 ? 'line11-20' : 'line21+';
  const hist = {}; for (const r of kept) { if (r.answer === 'none') continue; const m = /^(?:replace|delete|move|insert after) (\d+)/.exec(r.answer.split('\n')[0]); if (!m) continue; let n = +m[1]; if (r.answer.startsWith('insert after')) n += 1; const h = (hist[r.class] ||= {}); const b = bucket(n); h[b] = (h[b] || 0) + 1; }
  // wording: distinct composed skeletons and top-5 share per kind
  const skel = {}; for (const r of kept) { const m = (skel[r.class] ||= new Map()); m.set(r.meta.skel, (m.get(r.meta.skel) || 0) + 1); }
  const skelStat = {}; for (const [k, m] of Object.entries(skel)) { const n = [...m.values()].reduce((a, b) => a + b, 0); const top = [...m.values()].sort((a, b) => b - a).slice(0, 5).reduce((a, b) => a + b, 0); skelStat[k] = { rows: n, distinct: m.size, top5_share: +(top / n).toFixed(4) }; }
  const coreStat = {}; for (const [p, v] of Object.entries(TPL)) coreStat[p] = v.length;
  const tfStat = {}; for (const r of kept) if (r.meta.ti != null) { const st = (tfStat[r.class] ||= { n: 0, table_index: {}, field_index: {}, programs_with_3plus_tables: { n: 0, table_index: {} } }); const tb = r.meta.ti >= 2 ? '3rd+' : r.meta.ti === 1 ? '2nd' : '1st'; const fb = r.meta.fi >= 3 ? '4th+' : ['1st', '2nd', '3rd'][r.meta.fi]; st.n++; st.table_index[tb] = (st.table_index[tb] || 0) + 1; st.field_index[fb] = (st.field_index[fb] || 0) + 1; if (r.meta.ntab >= 3) { st.programs_with_3plus_tables.n++; st.programs_with_3plus_tables.table_index[tb] = (st.programs_with_3plus_tables.table_index[tb] || 0) + 1; } }
  writeFileSync('out/c2_report.json', JSON.stringify({ stats, per_class: per, quota, hist, skelStat, coreStat, tfStat }, null, 1));
  console.log(JSON.stringify({ rows: kept.length, per_class: per, stats, hist, skelStat }));
}
main();
