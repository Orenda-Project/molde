// Scores model outputs. Usage: node score.mjs IN.jsonl > OUT.jsonl
// Each input line: {id, ref, output, ...}. Adds: pass_raw, pass_fmt, err_code, err_first, tokens(words), intent features.
// Copied from molde-model/phase2a/score.mjs (the Phase 2a scorer). Language dir: $MOLDE_LANG or ../lang next to this file.
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const LANG = process.env.MOLDE_LANG || resolve(dirname(fileURLToPath(import.meta.url)), '../lang');
const { check } = await import(pathToFileURL(resolve(LANG, 'check.mjs')).href);
const { format } = await import(pathToFileURL(resolve(LANG, 'format.mjs')).href);

const GROUP = { list: 'list', log: 'list', each: 'list', calendar: 'list', form: 'input', field: 'input', quick: 'input', button: 'input', toggle: 'input', choice: 'input', slider: 'input',
  daybars: 'chart', bars: 'chart', trend: 'chart', heat: 'chart', share: 'chart', ring: 'chart', draw: 'chart', poly: 'chart', goal: 'stat', stat: 'stat', remind: 'remind', every: 'event', when: 'event', timer: 'event',
  screen: 'screen', setting: 'setting', ask: 'ask' };
const AGG = ['count', 'sum', 'avg', 'min', 'max', 'last', 'first', 'streak', 'best', 'since', 'gap', 'sumof', 'countof', 'maxof', 'minof'];

function features(src) {
  const r = check(src);
  const ast = r.ast;
  const tables = [];
  const kinds = new Set();
  const walk = s => {
    if (s.kind === 'table') tables.push(s);
    const k = s.kind === 'use' ? s.name : s.kind;
    if (GROUP[k]) kinds.add(GROUP[k]);
    if (s.kind === 'use') return; // do not descend into std expansions
    (s.children || []).forEach(walk);
  };
  (ast?.body || []).forEach(walk);
  const aggs = new Set();
  const text = src.split('\n').filter(l => !/^\s*(def|table|app)\b/.test(l)).join('\n');
  for (const a of AGG) if (new RegExp('\\b' + a + '\\(').test(text)) aggs.add(a.replace(/of$/, ''));
  const ftypes = [], fnames = new Set();
  for (const t of tables) for (const f of t.fields || []) { ftypes.push(typeof f.type === 'string' ? f.type : f.type.t); fnames.add(f.name); }
  return { r, ntables: tables.length, tnames: new Set(tables.map(t => t.name)), ftypes, fnames, kinds, aggs };
}
const jac = (a, b) => { if (!a.size && !b.size) return 1; let i = 0; for (const x of a) if (b.has(x)) i++; return i / (a.size + b.size - i); };
function f1(a, b) { // multiset F1
  if (!a.length && !b.length) return 1; if (!a.length || !b.length) return 0;
  const m = new Map(); for (const x of b) m.set(x, (m.get(x) || 0) + 1);
  let tp = 0; for (const x of a) if (m.get(x) > 0) { tp++; m.set(x, m.get(x) - 1); }
  const p = tp / a.length, r = tp / b.length; return p + r ? 2 * p * r / (p + r) : 0;
}
const safe = f => { try { return f(); } catch (e) { return null; } };

for (const line of readFileSync(process.argv[2], 'utf8').split('\n')) {
  if (!line.trim()) continue;
  const o = JSON.parse(line);
  const out = (o.output || '').replace(/\r/g, '');
  const res = { ...o };
  const fo = safe(() => features(out));
  res.pass_raw = !!(fo && fo.r.ok && out.trim().length > 0);
  res.err_code = fo && !fo.r.ok ? (fo.r.errors[0]?.code || 'E_PARSE') : (fo ? null : 'E_CRASH');
  res.err_first = fo && !fo.r.ok ? String(fo.r.errors[0]).slice(0, 300) : null;
  res.errs = fo && !fo.r.ok ? fo.r.errors.slice(0, 3).map(e => String(e).slice(0, 300)) : [];
  res.n_errors = fo ? fo.r.errors.length : null;
  let fmt = safe(() => format(out));
  const ff = fmt != null ? safe(() => features(fmt)) : null;
  res.pass_fmt = !!(ff && ff.r.ok && fmt.trim().length > 0);
  res.lines = out.trim() ? out.trim().split('\n').length : 0;
  if (o.ref) {
    const fr = features(o.ref);
    const use = res.pass_fmt ? ff : fo; // features of the best-parsing form
    if (use) {
      res.field_f1 = +f1(use.ftypes, fr.ftypes).toFixed(3);
      res.name_jac = +jac(use.fnames, fr.fnames).toFixed(3);
      res.ntab_diff = Math.abs(use.ntables - fr.ntables);
      res.node_jac = +jac(use.kinds, fr.kinds).toFixed(3);
      res.agg_jac = +jac(use.aggs, fr.aggs).toFixed(3);
      res.score = +((res.field_f1 + res.node_jac + res.agg_jac) / 3).toFixed(3);
    } else { res.field_f1 = res.name_jac = res.node_jac = res.agg_jac = res.score = 0; res.ntab_diff = 9; }
    const body = res.field_f1 >= 0.6 && res.ntab_diff <= 1 && res.node_jac >= 0.5 && res.agg_jac >= 0.5;
    res.intent_auto = !!(res.pass_raw && body);
    res.intent_auto_fmt = !!(res.pass_fmt && body);
  }
  console.log(JSON.stringify(res));
}
