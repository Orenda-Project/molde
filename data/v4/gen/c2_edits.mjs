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
    const move = (X, p) => { const blk = M.lines.slice(X.start, X.end + 1); const rest = M.lines.filter((_, i) => i < X.start || i > X.end); const pp = p > X.start ? p - blk.length : p; return [...rest.slice(0, pp), ...blk, ...rest.slice(pp)]; };
    const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
    const touchedOf = X => { const s = new Set(); for (let i = X.start; i <= X.end; i++) s.add(i); return s; };
    const mk = (X, Y, dir, p, noChange) => {
      const after = noChange ? M.lines.slice() : move(X, p);
      if (!noChange && same(after, M.lines)) return;
      const slots = { X: X.nps }; if (Y) slots.Y = Y.nps;
      out.push(mkCand('reorder', 'reorder', { sub: dir, after, touched: touchedOf(X), pools: [dir], slots, noChange }));
    };
    for (const X of units) {
      const idx = units.indexOf(X);
      if (idx === 0) mk(X, null, 'first', 0, true); else mk(X, null, 'first', units[0].start);
      if (idx === units.length - 1) mk(X, null, 'last', 0, true); else mk(X, null, 'last', units[units.length - 1].end + 1);
      for (const Y of units) {
        if (X === Y) continue;
        if (X.start < Y.start) { mk(X, Y, 'above', 0, true); mk(X, Y, 'below', Y.end + 1); } else { mk(X, Y, 'above', Y.start); mk(X, Y, 'below', 0, true); }
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
  const asc = s => /^[\x20-\x7e]+$/.test(s) && !/["\\]/.test(s) && s.length <= 24;
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
      out.push(mkCand('rename_field', 'rename_field', { sub: 'field', after, touched, pools: ['rename_field'], slots: { o: /^(what|who|name|kind|item|done|paid|cost|note|part|side|spot|work|time|code|word|body|title|text|total|level|class|size|plan|ready|fixed|given|sent|out|flat|bed|unit|plate|grade|role|tag|job|fee|rate)$/.test(f.name) || R() < 0.25 ? [`"${hum(f.name)}"`] : [hum(f.name)], n: R() < 0.25 ? [`"${hum(nw)}"`] : [hum(nw)] } }));
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
    const have = d.opts.map(normOpt);
    const fullsize = FAMILIES.find(f => f.id === fam.family.id);
    if (fullsize.members.size <= 14 && have.filter(o => fullsize.members.has(o)).length >= 0.85 * fullsize.members.size) continue;
    const mkLine = (tg, nw) => {
      const key = keyOf(d); const last = d.opts[d.opts.length - 1]; let list = d.opts.slice(); if (/^(Other|Others|Misc|Else|Anything)$/.test(last) && !/^(Other|Others|Misc)$/.test(nw)) list.splice(list.length - 1, 0, nw); else list.push(nw);
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
      out.push(mkCand('add_option', 'add_option', { sub: d.kind, after, touched, pools: ['add_option'], slots: { ...slots, O: [hum(nw)] }, family: fam.family.id, require: decls.length > 1 ? 'F' : null }));
    }
    // no change: the option is already there
    if (fam.exist.length) out.push(mkCand('add_option', 'no_change', { sub: 'option', after: M.lines.slice(), touched: new Set(), pools: ['add_option'], slots: { ...slots, O: [hum(R.pick(fam.exist))] }, noChange: true, family: fam.family.id, require: decls.length > 1 ? 'F' : null }));
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

const GENS = [genRemove, genReorder, genRename, genRenameField, genOption, genNumber, genSections];
function candidates(M) { const C = catalog(M); const out = []; for (const g of GENS) { try { out.push(...g(M, C)); } catch (e) { if (process.env.DEBUG) console.error(g.name, e.message); } } return out; }

// ---------------------------------------------------------------- requests
const usage = new Map(); // pool|index -> uses
const rows_ = [];
function fill(tpl, slots, r) {
  return tpl.replace(/\{([A-Za-z])\}/g, (_, k) => { const v = slots[k]; if (!v) throw new Error('slot ' + k); const x = r.pick(v); return typeof x === 'string' ? x : x.t; });
}
function lowerCasual(s, r) { return s; }
const taken = new Set(); // requests already used with a given before
function makeRequest(c, baseKey) {
  // which templates need which slots
  const need = tpl => [...tpl.matchAll(/\{([A-Za-z])\}/g)].every(m => c.slots[m[1]]) && (!c.require || tpl.includes('{' + c.require + '}'));
  const all = []; for (const p of c.pools) TPL[p].forEach((tpl, i) => { if (need(tpl)) all.push({ p, i, tpl }); });
  if (!all.length) return null;
  const used = baseKey.usedTpl;
  all.sort((a, b) => (usage.get(a.p + '|' + a.i) || 0) - (usage.get(b.p + '|' + b.i) || 0) || R() - 0.5);
  const minU = usage.get(all[0].p + '|' + all[0].i) || 0;
  const pool = all.filter(x => (usage.get(x.p + '|' + x.i) || 0) <= minU + 1 && !used.has(x.p + '|' + x.i));
  for (const t of (pool.length ? pool : all)) {
    if (used.has(t.p + '|' + t.i)) continue;
    let text; let typod = false;
    try {
      // mix of label-based and role-based naming: shuffle the np list so both appear
      const slots = { ...c.slots }; if (slots.X) slots.X = R.shuffle(slots.X); if (slots.Y) slots.Y = R.shuffle(slots.Y);
      let tp = t.tpl; if (R() < 0.05) { const t2 = typo(tp, R); if (t2 !== tp) { tp = t2; typod = true; } }
      text = fill(tp, slots, R);
    } catch { continue; }
    let req = text;
    const st = R(); const endP = /[?!.]$/.test(req);
    if (st < 0.3) req = cap1(req); else if (st < 0.4 && !endP) req = cap1(req) + '.'; else if (st < 0.45 && !endP) req = req + '!';
    if (/[^\x20-\x7e]/.test(req) || req.length < 3 || req.length > 300) continue;
    if (leaky(req)) continue;
    return { req, pool: t.p, idx: t.i, typo: typod };
  }
  return null;
}

// ---------------------------------------------------------------- gates + selection
const stats = { bases: 0, cand: 0, gate_fail: {}, kept: 0 };
const fail = w => { stats.gate_fail[w] = (stats.gate_fail[w] || 0) + 1; return null; };
function gate(M, c) {
  if (c.noChange) return { after: M.src, answer: 'none' };
  const a0 = c.after.join('\n') + '\n';
  const k = canon(a0); if (!k.ok) return fail('check:' + (k.errors[0].match(/E_[A-Z_]+/) || ['?'])[0]);
  const after = k.text; if (after === M.src) return fail('no-op');
  const v = verify(after, [M.src]); if (!v.ok) return fail('verify:' + v.why.slice(0, 30));
  const d = diff([M.src], after); if (d.verdict === 'refused') return fail('diff-refused');
  const pt = derivePatch(M.src, after); if (!pt) return fail('patch');
  let ok = false; try { ok = applyOps(M.src, pt.answer) === after; } catch { }
  if (!ok) return fail('roundtrip');
  // only the intended lines change
  const B = M.src.replace(/\n$/, '').split('\n'), A = after.replace(/\n$/, '').split('\n');
  if (c.kind === 'reorder') { if ([...B].sort().join('\n') !== [...A].sort().join('\n')) return fail('not-a-permutation'); }
  else {
    const refd = new Set(); for (const op of pt.answer.split('\n')) { let m; if ((m = /^(?:replace|delete|move) (\d+)(?:-(\d+))?/.exec(op))) for (let x = +m[1]; x <= +(m[2] || m[1]); x++) refd.add(x - 1); }
    for (const x of refd) if (!c.touched.has(x)) return fail('touched-outside');
    // untouched lines must survive in order
    const keep = B.filter((_, i) => !c.touched.has(i)); let j = 0; for (const l of A) if (j < keep.length && l === keep[j]) j++; if (j !== keep.length) return fail('untouched-changed');
  }
  return { after, answer: pt.answer };
}

const isLong = p => nl(p) >= 25;
function buildRow(M, c, g, rq, base) {
  const before = M.src, program = g.after;
  const meta = { style: 'c2', domain: base.id, sub: c.sub, tpl: rq.pool + ':' + rq.idx, tokens: 0, language_commit: '4698991', origin: 'v4.1' };
  if (rq.typo) meta.typo = true; if (base.long) meta.long = true; if (c.family) meta.family = c.family; if (c.noChange) meta.no_change = true;
  const numbered = before.replace(/\n$/, '').split('\n').map((x, i) => `${i + 1}| ${x}`).join('\n');
  return { id: 'c2-e-' + sha(rq.req + before + program + g.answer).slice(0, 10), task: 'edit', request: rq.req, program_before: before, before, program, answer: g.answer, source: 'v4:c2:' + c.cls, class: c.cls, user_text: `Edit request: ${rq.req}\n\nCurrent program:\n${before}`, user_text_numbered: `Edit request: ${rq.req}\n\nCurrent program:\n${numbered}`, meta };
}

function main() {
  const bases = loadBases();
  const long = bases.filter(b => b.long), short = bases.filter(b => !b.long);
  console.error('bases', bases.length, 'long', long.length, 'short', short.length);
  const KINDS = ['remove_one', 'reorder', 'rename_button', 'rename_field', 'add_option', 'setting_value', 'sections'];
  const noKind = Math.round(TARGET * 0.03); const perKind = Math.round((TARGET - noKind) / KINDS.length);
  const quota = Object.fromEntries(KINDS.map(k => [k, perKind])); quota.no_change = noKind;
  const longQuota = Object.fromEntries(Object.entries(quota).map(([k, v]) => [k, Math.ceil(v * 0.4)]));
  const count = Object.fromEntries(Object.keys(quota).map(k => [k, 0])), countLong = { ...count };
  const out = [];
  const seenReq = new Set();
  const process_ = (b, maxPer) => {
    stats.bases++;
    const M = buildModel(b.program); if (!M) return;
    let cs = candidates(M); stats.cand += cs.length;
    const baseKey = { usedTpl: new Set() }; const perKindUsed = {}; let n = 0;
    cs = R.shuffle(cs);
    while (n < maxPer) {
      // the kind furthest below its quota (long bases count against the long quota too)
      const room = Object.keys(quota).filter(k => (perKindUsed[k] || 0) < 2 && count[k] < quota[k] && cs.some(c => c.cls === k)).sort((a, z) => (count[a] / quota[a]) - (count[z] / quota[z]));
      if (!room.length) break;
      // no_change is rationed: only when its ratio is below the others
      const k = room[0];
      let done = false;
      for (let ci = 0; ci < cs.length; ci++) {
        const c = cs[ci]; if (c.cls !== k) continue;
        const rq = makeRequest(c, baseKey); if (!rq) { cs.splice(ci, 1); ci--; continue; }
        const key = norm(rq.req) + '|' + b.id; if (seenReq.has(key)) { continue; }
        const g = gate(M, c); if (!g) { cs.splice(ci, 1); ci--; continue; }
        const row = buildRow(M, c, g, rq, b); seenReq.add(key); baseKey.usedTpl.add(rq.pool + '|' + rq.idx);
        usage.set(rq.pool + '|' + rq.idx, (usage.get(rq.pool + '|' + rq.idx) || 0) + 1);
        out.push(row); count[k]++; if (b.long) countLong[k]++; perKindUsed[k] = (perKindUsed[k] || 0) + 1; n++; cs.splice(ci, 1); done = true; break;
      }
      if (!done) { perKindUsed[k] = 2; }
    }
  };
  for (const b of long) process_(b, 4);
  for (const b of short) { if (Object.keys(quota).every(k => count[k] >= quota[k])) break; process_(b, 4); }
  console.error('counts', JSON.stringify(count), 'long', JSON.stringify(countLong));
  // token gate (batch)
  const progs = out.flatMap(r => [r.program, r.program_before]); const tk = tokenCounts(progs);
  const kept = []; let tokDrop = 0;
  out.forEach((r, i) => { const a = tk[2 * i], b = tk[2 * i + 1]; const lim = r.meta.long ? 900 : 500; if (a > lim || b > lim) { tokDrop++; return; } r.meta.tokens = a; kept.push(r); });
  stats.token_drop = tokDrop; stats.kept = kept.length;
  writeFileSync('out/c2_rows.jsonl', kept.map(r => JSON.stringify(r)).join('\n') + '\n');
  const per = {}; for (const r of kept) { const k = r.class + (r.meta.long ? '/long' : '/short'); per[k] = (per[k] || 0) + 1; }
  const tplUse = {}; for (const [k, v] of usage) { const p = k.split('|')[0]; (tplUse[p] ||= []).push(v); }
  const tplSummary = Object.fromEntries(Object.entries(tplUse).map(([p, v]) => [p, { templates: TPL[p].length, used: v.length, min: Math.min(...v), max: Math.max(...v) }]));
  writeFileSync('out/c2_report.json', JSON.stringify({ stats, per_class: per, quota, tplSummary }, null, 1));
  console.log(JSON.stringify({ rows: kept.length, per_class: per, stats }));
}
main();
