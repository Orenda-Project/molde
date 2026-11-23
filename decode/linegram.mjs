// Per-line GBNF builder for line-stepped decoding.
//   buildLineGrammar(prefix, { names: true|false }) -> { grammar, info }
// The grammar accepts exactly ONE more program line (with its newline) or the empty string (= end of program).
// names:false  uses the static grammar rules unchanged (arm B).
// names:true   replaces the open "any name" rules in REFERENCE positions with the finite name sets valid
//              at this point (arm C/D). Declaration positions (new table / field / state / let / def names) stay open.
// Needs only: the static lang/moldescript.gbnf text and the checker's symbol table (via constrain_x.mjs).
import { readFileSync } from 'node:fs';
import { check } from '../lang/check.mjs';
import { ICONS } from '../lang/check.mjs';
import { envOf, scopeAt, fieldsOf, fieldType, partsOf, step, tname, PROBE } from './constrain_x.mjs';

const GBNF = readFileSync(new URL('../lang/moldescript.gbnf', import.meta.url), 'utf8');
const STATIC = new Map();
for (const l of GBNF.split('\n')) {
  const m = l.match(/^([a-z0-9-]+) ::= (.*)$/);
  if (m) STATIC.set(m[1], m[2]);
}
export const STATIC_RULES = STATIC;

const q = s => '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
const alt = names => [...new Set(names)].filter(Boolean).map(q).join(' | ');
const BLOCK_WORDS = new Set(['def', 'screen', 'each', 'if', 'else', 'stack', 'row', 'box', 'scroll', 'grid', 'draw', 'plot', 'poly']);
const ROWISH = new Set(['rows', 'group']);
const MAXD = 4;

// ---- which indents may the next line use? ----
function allowedIndents(prefix, defs) {
  const lines = prefix.split('\n').filter(l => l.trim());
  if (lines.length <= 1) return [0]; // after the app line (or ask line)
  const last = lines[lines.length - 1];
  const d = last.match(/^ */)[0].length;
  const first = last.trim().split(/[ (]/)[0];
  const isBlock = BLOCK_WORDS.has(first) || defs.includes(first);
  const out = [];
  for (let k = 0; k <= d; k += 2) out.push(k);
  if (isBlock && d + 2 <= 16) out.push(d + 2);
  return out;
}

// ---- name sets for one scope ----
function scopeNames(done, indent) {
  const E = envOf(done, indent);
  const env = E.env;
  const sc = scopeAt(done, indent);
  const tables = [...env.tables.keys()];
  const values = Object.keys(sc.types).filter(k => k !== PROBE);
  const allFields = new Set(['at', 'id']);
  for (const [, tb] of env.tables) for (const f of tb.fields.keys()) allFields.add(f);
  return { E, env, sc, tables, values, allFields: [...allFields] };
}

// typed paths: rules for ".part" continuations, memoised per (type, depth, filter)
function makePathBuilder(S, extra) {
  const { env } = S;
  const rules = extra; // name -> body (collected)
  const memo = new Map();
  let n = 0;
  const anyParts = [...S.allFields, ...S.tables, 'key'];
  const rowish = ty => ty === 'any' || ROWISH.has(tname(ty));
  const partsFor = ty => ty === 'any' ? anyParts : partsOf(env, ty);
  const stepFor = (ty, p) => ty === 'any' ? 'any' : step(env, ty, p);
  function cont(ty, depth, filter, sfx) { // returns rule name for "." parts, or null
    if (ty == null) ty = 'any';
    if (ty === 'any') { if (!rules['pany']) rules['pany'] = `"." ( ${alt(anyParts)} ) ( pany )?`; return 'pany'; }
    if (depth >= MAXD) return null;
    const key = sfx + JSON.stringify([ty, depth, filter]);
    if (memo.has(key)) return memo.get(key);
    memo.set(key, null); // cycle guard
    const alts = [];
    for (const p of new Set(partsFor(ty))) {
      const nt = stepFor(ty, p);
      if (nt == null) continue;
      const sub = cont(nt, depth + 1, filter, sfx);
      if (!filter || rowish(nt)) alts.push(sub ? `${q(p)} ( ${sub} )?` : q(p));
      else if (sub) alts.push(`${q(p)} ${sub}`);
    }
    if (!alts.length) { return null; }
    const name = `pt${sfx}-${n++}`;
    rules[name] = `"." ( ${alts.join(' | ')} )`;
    memo.set(key, name);
    return name;
  }
  // a path whose first word is one of `heads` [{name, type}]
  function path(heads, filter, sfx) {
    const alts = [];
    for (const h of heads) {
      const ty = h.type == null ? 'any' : h.type;
      const sub = cont(ty, 0, filter, sfx);
      if (!filter || rowish(ty)) alts.push(sub ? `${q(h.name)} ( ${sub} )?` : q(h.name));
      else if (sub) alts.push(`${q(h.name)} ${sub}`);
    }
    return alts;
  }
  return { path, cont };
}

function headList(S, withFields) {
  const { env, sc } = S;
  const heads = [];
  const seen = new Set();
  const add = (name, type) => { if (!seen.has(name)) { seen.add(name); heads.push({ name, type }); } };
  for (const v of S.values) add(v, sc.types[v]);
  for (const t of S.tables) add(t, { t: 'rows', table: t });
  if (sc.itType) add('it', sc.itType); else add('it', null);
  for (const o of sc.options || []) add(o, 'text');
  for (const o of env.options || []) add(o, 'text');
  if (withFields) {
    for (const f of S.allFields) {
      let ty = null;
      for (const t of S.tables) { const ft = f === 'at' || f === 'id' ? fieldType(env, t, f) : (fieldsOf(env, t).has(f) ? fieldType(env, t, f) : null); if (ft) { ty = ft; break; } }
      add(f, ty);
    }
  }
  return heads;
}

// the scope-dependent override rules for one scope; every rule name gets suffix sfx
function overrides(S, sfx) {
  const R = {}; // name (without suffix) -> body
  const P = makePathBuilder(S, R);
  const { env } = S;
  const tableAlts = alt(S.tables);
  R['tableref'] = tableAlts || null;
  R['iconname'] = alt([...ICONS]);
  const heads = headList(S, true), lheads = headList(S, false);
  const pathAlts = P.path(heads, false, 'p');
  R['path'] = pathAlts.join(' | ');
  R['lpath'] = P.path(lheads, false, 'p').join(' | ');
  R['qpath'] = P.path(heads, true, 'q').join(' | ');
  // pick-field paths for "each options t.f"
  const optAlts = [];
  for (const t of S.tables) for (const [f, fd] of fieldsOf(env, t)) if (fd.type.t === 'pick') optAlts.push(`${q(t)} "." ${q(f)}`);
  R['optpath'] = optAlts.join(' | ');
  R['optword'] = alt([...(env.options || [])].filter(o => /^[A-Z]/.test(o)));
  R['wname'] = alt(S.values);
  R['fnname'] = alt([...env.lets.keys()]);
  const comps = S.E.defs.filter(d => d !== 'slot');
  R['compname'] = alt(S.E.defs);
  R['screenname'] = alt([...env.screens.keys()]);
  R['draftname'] = alt(S.E.drafts);
  R['namew'] = alt([...S.allFields, ...env.states.keys(), ...env.settings.keys(), ...env.lets.keys()]);
  // add T f = e, g = e : per table, only that table's fields
  const adds = [];
  for (const t of S.tables) {
    const fs = [...fieldsOf(env, t).keys(), 'at'];
    const an = 'assign-' + adds.length;
    adds.push(`"add" sp ${q(t)} ( sp ${an} ( "," sp ${an} )* )?`);
    R[an] = `( ${alt(fs)} ) sp "=" sp expr`;
  }
  R['addact'] = adds.join(' | ');
  // component calls, parameter kinds decide the argument rule
  const calls = [];
  for (const [name, def] of S.E.defMap) {
    if (name === 'slot') continue;
    const ps = def.params || [];
    const argOf = p => ({ table: 'tableref', src: 'source', name: 'namew', win: 'window', act: 'actions', icon: 'iconname' }[p.kind] || 'expr');
    if (!R['tableref'] && ps.some(p => p.kind === 'table')) continue;
    let body = q(name);
    const req = ps.filter(p => p.dflt == null).length;
    if (ps.length) {
      let tail = '';
      for (let i = ps.length - 1; i >= 0; i--) {
        const a = argOf(ps[i]);
        const sep = i === 0 ? ' sp ' : ' "," sp ';
        if (i >= req) tail = tail ? `( ${sep}${a} ${tail} )?` : `( ${sep}${a} )?`;
        else tail = `${sep}${a} ${tail}`;
      }
      body += tail;
    }
    calls.push(body);
  }
  R['callbody'] = calls.join(' | ');
  return R;
}

// Replace rule bodies in the static rule table (a fresh copy) for names mode.
function patchedStatic(R) {
  const S = new Map(STATIC);
  const rep = (rule, from, to) => {
    const b = S.get(rule);
    if (!b || !b.includes(from)) throw new Error(`gbnf changed: ${rule} lacks ${from}`);
    S.set(rule, b.replace(from, to));
  };
  const has = n => !!R[n];
  // header + screen icons
  rep('app-stmt', '(sp ident)?', '(sp iconname)?');
  rep('screen-stmt', '(sp ident)?', '(sp iconname)?');
  // table refs
  if (has('tableref')) { rep('type', '"ref" sp ident', '"ref" sp tableref'); rep('state-type', '"new" sp ident', '"new" sp tableref'); rep('param', '(pkind | ident)', '(pkind | tableref)'); }
  else { rep('type', ' | "ref" sp ident', ''); rep('state-type', ' | "new" sp ident', ''); rep('param', '(pkind | ident)', 'pkind'); }
  // paths
  rep('source', '"options" sp path', has('optpath') ? '"options" sp optpath' : '"days" sp window');
  rep('query', 'path (sp window)?', 'qpath (sp window)?');
  rep('window', '| ident', has('wname') ? '| wname' : '');
  rep('icon-stmt', '"icon" sp primary', '"icon" sp (iconname | primary)');
  rep('primary', '| cword', has('optword') ? '| optword' : '');
  rep('func', '| ident "(" expr ("," sp expr)* ")"', has('fnname') ? '| fnname "(" expr ("," sp expr)* ")"' : '');
  rep('lead-unary', '("it" | ident) ("." ident)+ | "it" | lead-ident', 'lpath');
  rep('call-stmt', 'ident (sp arg ("," sp arg)*)?', 'callbody');
  rep('action', '"add" sp ident (sp assign ("," sp assign)*)?', has('addact') ? 'addact' : '"remove" sp expr');
  rep('action', '"go" sp ident', has('screenname') ? '"go" sp screenname' : '"go" sp ident');
  rep('action', '"save" sp ident', has('draftname') ? '"save" sp draftname' : '"save" sp ident');
  rep('action', '| ident', has('compname') ? '| compname' : '');
  S.delete('lead-ident');
  for (const k of [...S.keys()]) if (/^lead-ident-/.test(k)) S.delete(k);
  return S;
}

// Rules reachable from `start`
function reachable(rules, start) {
  const seen = new Set();
  const stack = [start];
  while (stack.length) {
    const n = stack.pop();
    if (seen.has(n) || !rules.has(n)) continue;
    seen.add(n);
    for (const m of rules.get(n).replace(/"(?:[^"\\]|\\.)*"|\[[^\]]*\]/g, ' ').matchAll(/[a-z][a-z0-9-]*/g)) stack.push(m[0]);
  }
  return seen;
}

export function buildLineGrammar(prefix, { names = false } = {}) {
  const t0 = performance.now();
  // header line
  if (!prefix) {
    if (!names) return { grammar: 'root ::= ( ask-stmt | app-stmt ) nl\n' + ruleText(STATIC, ['root'], 'root'), info: { groups: 1 } };
    const R = {}; R['iconname'] = alt([...ICONS]);
    const S = new Map(STATIC);
    S.set('app-stmt', S.get('app-stmt').replace('(sp ident)?', '(sp iconname)?'));
    S.set('iconname', R['iconname']);
    S.set('root', '( ask-stmt | app-stmt ) nl');
    return { grammar: ruleText(S, null, 'root'), info: { groups: 1 } };
  }
  const done = prefix;
  const E0 = envOf(done, '');
  const indents = allowedIndents(prefix, E0.defs);
  const lineStart = '( block-stmt | leaf-stmt ) nl';
  if (!names) {
    const alts = indents.map(k => (k ? q(' '.repeat(k)) + ' ' : '') + lineStart);
    const S = new Map(STATIC);
    S.set('root', alts.join(' | ') + ' | ""');
    return { grammar: ruleText(S, null, 'root'), info: { groups: 1, indents } };
  }
  // names mode: one rule set per distinct scope (loop variables differ between indents)
  const groups = new Map(); // key -> {indents, R}
  for (const k of indents) {
    const sp = ' '.repeat(k);
    const S = scopeNames(done, sp);
    const key = JSON.stringify([Object.keys(S.sc.types).sort(), S.sc.itType, S.sc.options]);
    if (!groups.has(key)) groups.set(key, { indents: [], S });
    groups.get(key).indents.push(k);
  }
  const out = new Map();
  let gi = 0;
  const rootAlts = [];
  // dependents: static rules that reach an overridden rule
  const base = new Map();
  for (const [gk, g] of groups) {
    const sfx = '-g' + gi++;
    const R = overrides(g.S, sfx);
    const P = patchedStatic(R);
    // add the generated rules
    for (const [n, b] of Object.entries(R)) if (b) P.set(n, b);
    // which rules to rename (those that depend on a scope-specific rule)
    const dep = new Set(Object.keys(R).filter(n => R[n]));
    let changed = true;
    while (changed) {
      changed = false;
      for (const [n, b] of P) {
        if (dep.has(n)) continue;
        const toks = b.replace(/"(?:[^"\\]|\\.)*"|\[[^\]]*\]/g, ' ').match(/[a-z][a-z0-9-]*/g) || [];
        if (toks.some(t => dep.has(t))) { dep.add(n); changed = true; }
      }
    }
    // generated bodies already carry the suffix for names they reference via sfxRef; others (static refs) use bare names
    const ren = b => b.replace(/("(?:[^"\\]|\\.)*"|\[[^\]]*\])|([a-z][a-z0-9-]*)/g, (m, lit, id) => lit ? lit : (dep.has(id) ? id + sfx : id));
    const stmt = `( block-stmt${sfx} | leaf-stmt${sfx} ) nl`;
    for (const k of g.indents) rootAlts.push((k ? q(' '.repeat(k)) + ' ' : '') + stmt);
    for (const n of dep) out.set(n + sfx, ren(P.get(n)));
    for (const [n, b] of P) if (!dep.has(n) && !base.has(n)) base.set(n, b);
  }
  for (const [n, b] of base) out.set(n, b);
  out.set('root', rootAlts.join(' | ') + ' | ""');
  const missing = new Set();
  const grammar = ruleText(out, null, 'root', missing);
  return { grammar, info: { groups: groups.size, indents, ms: +(performance.now() - t0).toFixed(1), missing: [...missing] } };
}

// text of the reachable rules only (smaller grammar to compile)
function ruleText(rules, _unused, start, missing) {
  const keep = reachable(rules, start);
  const lines = [];
  for (const [n, b] of rules) if (keep.has(n) && b != null && b !== '') lines.push(`${n} ::= ${b}`);
  if (missing) for (const n of rules.keys()) { /* placeholder */ }
  if (missing) {
    const known = new Set([...rules.keys()]);
    for (const n of keep) for (const m of rules.get(n).replace(/"(?:[^"\\]|\\.)*"|\[[^\]]*\]/g, ' ').matchAll(/[a-z][a-z0-9-]*/g)) if (!known.has(m[0])) missing.add(m[0]);
  }
  // make `root` first
  lines.sort((a, b) => (a.startsWith('root ::=') ? -1 : b.startsWith('root ::=') ? 1 : 0));
  return lines.join('\n') + '\n';
}

// ---- prefix-valid check ----
// errors on the lines from `fromLine` (1-based) on; earlier lines were judged when they were accepted.
export function prefixErrors(text, fromLine) {
  const r = check(text);
  return r.errors.filter(e => e.line >= fromLine);
}
