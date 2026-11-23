// MoldeScript v0 parser: text -> typed AST with line numbers.
// Each line is lexed, joined with canonical spacing, and matched against the grammar file by
// engine.mjs. Indentation gives the tree. Errors carry a code, line, message and fix hint.
import { parseText, child, children, kids, lits, KEYWORDS } from './engine.mjs';
import { lex, join, LexError } from './lex.mjs';

export const MAX_DEPTH = 8;
export const BLOCK = new Set(['def', 'screen', 'each', 'if', 'else', 'box', 'draw', 'poly', 'call']);

export class MoError {
  constructor(code, line, msg, hint) { this.code = code; this.line = line; this.msg = msg; this.hint = hint; }
  toString() { return `line ${this.line}: ${this.code}: ${this.msg}${this.hint ? ' Fix: ' + this.hint : ''}`; }
}

// Split source into logical lines with depth. Comments (#) and blank lines are kept aside.
export function splitLines(src) {
  const raw = src.replace(/\r\n?/g, '\n').split('\n');
  const out = []; const errors = [];
  const stack = [0];
  raw.forEach((text, i) => {
    const no = i + 1;
    if (!text.trim()) return;
    const ind = text.match(/^[ \t]*/)[0].replace(/\t/g, '  ').length;
    const body = text.trim();
    if (body.startsWith('#')) { out.push({ no, comment: body, indent: ind }); return; }
    let popped = false;
    while (ind < stack[stack.length - 1]) { stack.pop(); popped = true; }
    if (ind > stack[stack.length - 1]) {
      if (popped) errors.push(new MoError('E_INDENT', no, 'this line is indented to a level no earlier line uses.', 'line it up with its parent or with a sibling above.'));
      stack.push(ind);
    }
    else if (ind !== stack[stack.length - 1]) errors.push(new MoError('E_INDENT', no, 'this line is indented to a level no earlier line uses.', 'indent children by exactly two spaces more than their parent.'));
    out.push({ no, depth: stack.length - 1, body });
  });
  return { lines: out, errors };
}

function syntaxError(no, text, r) {
  const col = r.far;
  const near = text.slice(col).split(' ')[0] || '(end of line)';
  const decl = text.match(/^(?:table|setting|state|def|screen) ([a-z]+)\b/) || text.match(/^table [a-z][a-z0-9_]*(?: "[^"]*")? (?:.*, )?([a-z]+) /);
  if (decl && KEYWORDS.has(decl[1])) {
    return new MoError('E_RESERVED', no, `"${decl[1]}" is a keyword and cannot be used as a name.`, `pick another name, for example "${decl[1]}s" or "my_${decl[1]}".`);
  }
  const callKw = /^[a-z][a-z0-9_]* /.test(text) && !KEYWORDS.has(text.split(' ')[0]) && text.split(' ')[0] !== 'text'
    ? text.slice(text.indexOf(' ') + 1).split(', ').find(a => KEYWORDS.has(a)) : null;
  if (callKw) return new MoError('E_RESERVED', no, `"${callKw}" is a keyword and cannot be used as a name.`, `rename the table or field "${callKw}", for example "${callKw}s".`);
  const word = text.slice(col).match(/^[a-z]+/)?.[0];
  if (word && KEYWORDS.has(word)) {
    return new MoError('E_RESERVED', no, `"${word}" is a keyword and cannot be used as a name here.`, `pick another name, for example "${word}s" or "my_${word}".`);
  }
  const exp = r.expected.filter(x => x !== 'a character').slice(0, 6).join(', ');
  return new MoError('E_SYNTAX', no, `cannot read the line from "${near}" (column ${col + 1}).`, exp ? `expected ${exp}.` : 'check the statement form in SPEC.md.');
}

export function parse(src, { lib = false } = {}) {
  const { lines, errors } = splitLines(src);
  const prog = { kind: 'program', header: null, body: [], comments: [], errors };
  const stack = [{ node: prog, depth: -1, block: true }];
  let first = true;
  const skip = ln => { // a line that failed still owns its indented children, so they do not cascade
    while (stack.length > 1 && stack[stack.length - 1].depth >= ln.depth) stack.pop();
    stack.push({ node: { kind: 'error', children: [] }, depth: ln.depth, block: true, dead: true });
  };
  for (const ln of lines) {
    if (ln.comment) { prog.comments.push(ln); continue; }
    let canon;
    try { canon = join(lex(ln.body)); }
    catch (e) {
      if (e instanceof LexError) { errors.push(new MoError('E_SYNTAX', ln.no, e.message + '.', 'remove or quote the character.')); first = false; skip(ln); continue; }
      throw e;
    }
    ln.canon = canon;
    const starts = first ? [lib ? 'lib-first' : 'first-stmt'] : ['leaf-stmt', 'block-stmt'];
    const r = parseText(canon, starts);
    if (!r.tree) {
      if (first && !/^(app|ask|lib)\b/.test(canon)) errors.push(new MoError('E_HEADER', ln.no, lib ? 'a library starts with lib "name".' : 'a program starts with app "Name" (or is a single ask line).', lib ? 'add lib "name" as line 1.' : 'add app "My app" as line 1.'));
      else errors.push(syntaxError(ln.no, canon, r));
      first = false;
      skip(ln);
      continue;
    }
    let st;
    try { st = build(r.tree, canon); }
    catch (e) { errors.push(new MoError('E_SYNTAX', ln.no, String(e.message || e), '')); first = false; skip(ln); continue; }
    st.line = ln.no; st.src = canon;
    if (first) {
      first = false;
      if (ln.depth !== 0) errors.push(new MoError('E_INDENT', ln.no, 'the first line cannot be indented.', 'remove the leading spaces.'));
      prog.header = st;
      continue;
    }
    if (prog.header && prog.header.kind === 'ask') {
      errors.push(new MoError('E_ASK', ln.no, 'an ask program is a single line; nothing may follow it.', 'either ask, or build the app, not both.'));
      continue;
    }
    if (ln.depth > MAX_DEPTH) { errors.push(new MoError('E_INDENT', ln.no, `nesting deeper than ${MAX_DEPTH} levels.`, 'flatten the layout or move a part into a def.')); continue; }
    while (stack[stack.length - 1].depth >= ln.depth) stack.pop();
    const parent = stack[stack.length - 1];
    if (parent.dead) { skip(ln); continue; }
    if (parent.depth !== ln.depth - 1) {
      errors.push(new MoError('E_INDENT', ln.no, 'this line is indented more than one level below the line above.', 'indent by exactly two spaces per level.'));
      continue;
    }
    if (!parent.block) {
      errors.push(new MoError('E_CHILD', ln.no, `"${parent.node.kind}" cannot have indented lines under it.`, 'un-indent this line, or put both inside a stack/row/box.'));
      continue;
    }
    st.depth = ln.depth;
    (parent.node.children || parent.node.body).push(st);
    if (BLOCK.has(st.kind)) st.children = [];
    stack.push({ node: st, depth: ln.depth, block: BLOCK.has(st.kind) });
  }
  return prog;
}

// ---------------- tree -> AST ----------------
const only = n => kids(n).filter(k => k.r || k.lit !== undefined);
const str = n => JSON.parse(n.v);
const id = n => n.v;

function build(tree, src) {
  const n = tree.r === 'first-stmt' || tree.r === 'block-stmt' || tree.r === 'leaf-stmt' ? kids(tree)[0] : tree;
  const B = BUILD[n.r];
  if (!B) throw new Error('no builder for ' + n.r);
  return B(n, src);
}

const BUILD = {
  'lib-first': n => ({ kind: 'lib', name: str(child(n, 'string')) }),
  'app-stmt': n => {
    const o = { kind: 'app', name: str(child(n, 'string')), icon: child(n, 'ident') ? id(child(n, 'ident')) : null, theme: null };
    if (child(n, 'theme')) o.theme = lits(child(n, 'theme'))[0];
    return o;
  },
  'ask-stmt': n => {
    const s = children(n, 'string').map(str);
    return { kind: 'ask', question: s[0], options: s.slice(1) };
  },
  'table-stmt': n => ({ kind: 'table', name: id(child(n, 'ident')), label: child(n, 'string') ? str(child(n, 'string')) : null, fields: children(n, 'field').map(field) }),
  'setting-stmt': n => ({ kind: 'setting', ...field(child(n, 'field')) }),
  'state-stmt': n => {
    const st = child(n, 'state-type');
    const o = { kind: 'state', name: id(child(n, 'ident')), type: null, draft: null, init: child(n, 'expr') ? expr(child(n, 'expr')) : child(n, 'word') ? { k: 'str', v: child(n, 'word').v, word: true } : null, keep: lits(n).includes('keep') };
    if (child(st, 'type')) o.type = type(child(st, 'type')); else o.draft = id(child(st, 'ident'));
    return o;
  },
  'let-stmt': n => ({ kind: 'let', name: id(child(n, 'ident')), e: expr(child(n, 'expr')) }),
  'def-stmt': (n, src) => ({ kind: 'def', name: id(child(n, 'ident')), params: children(n, 'param').map(p => ({ name: id(child(p, 'ident')), kind: lits(child(p, 'pkind'))[0], dflt: child(p, 'arg') ? src.slice(child(p, 'arg').s, child(p, 'arg').e) : null })) }),
  'call-stmt': (n, src) => ({ kind: 'call', name: id(child(n, 'ident')), args: children(n, 'arg').map(a => src.slice(a.s, a.e)) }),
  'slot-stmt': () => ({ kind: 'slot' }),
  'screen-stmt': n => {
    const ids = children(n, 'ident');
    return { kind: 'screen', name: id(ids[0]), label: str(child(n, 'string')), icon: ids[1] ? id(ids[1]) : null };
  },
  'remind-stmt': n => {
    const w = child(n, 'remind-when');
    const o = { kind: 'remind', text: str(child(n, 'string')), cond: child(n, 'expr') ? expr(child(n, 'expr')) : null };
    if (lits(w)[0] === 'at') {
      o.at = child(w, 'path') ? path(child(w, 'path')) : null;
      o.times = children(w, 'time').map(t => t.v);
      o.days = children(w, 'dayname').map(d => lits(d)[0]);
    } else {
      o.every = durSec(child(w, 'dur').v);
      const ts = children(w, 'time').map(t => t.v);
      o.from = ts[0] || null; o.to = ts[1] || null;
    }
    return o;
  },
  'every-stmt': n => ({ kind: 'every', every: durSec(child(n, 'dur').v), cond: child(n, 'expr') ? expr(child(n, 'expr')) : null, actions: actions(child(n, 'actions')) }),
  'when-stmt': n => ({ kind: 'when', cond: expr(child(n, 'expr')), actions: actions(child(n, 'actions')) }),
  'each-stmt': n => ({ kind: 'each', source: source(child(n, 'source')), as: child(n, 'ident') ? id(child(n, 'ident')) : null }),
  'if-stmt': n => ({ kind: 'if', cond: expr(child(n, 'expr')) }),
  'else-stmt': () => ({ kind: 'else' }),
  'box-stmt': n => ({ kind: 'box', box: lits(n)[0], cols: child(n, 'number') ? +child(n, 'number').v : null, mods: mods(n) }),
  'draw-stmt': n => { const ns = children(n, 'number'); return { kind: 'draw', w: ns[0] ? +ns[0].v : 100, h: ns[1] ? +ns[1].v : 100, mods: mods(n) }; },
  'poly-stmt': n => ({ kind: 'poly', mods: mods(n) }),
  'pt-stmt': n => { const es = children(n, 'expr'); return { kind: 'pt', x: expr(es[0]), y: expr(es[1]) }; },
  'shape-stmt': n => {
    const shape = lits(n)[0];
    const o = { kind: 'shape', shape, args: [], mods: mods(n) };
    const ek = child(n, 'e3') || child(n, 'e4') || child(n, 'e5');
    if (ek) o.args = flatE(ek).map(expr);
    if (shape === 'path') o.d = str(child(n, 'string'));
    if (shape === 'label') { o.args = children(n, 'expr').map(expr); o.parts = tparts(child(n, 'tparts')); }
    return o;
  },
  'text-stmt': n => ({ kind: 'text', parts: tparts(child(n, 'tparts')), mods: mods(n) }),
  'button-stmt': n => ({ kind: 'button', parts: tparts(child(n, 'tparts')), mods: mods(n) }),
  'icon-stmt': n => ({ kind: 'icon', icon: primary(child(n, 'primary')), mods: mods(n) }),
  'image-stmt': n => ({ kind: 'image', e: expr(child(n, 'expr')), mods: mods(n) }),
  'space-stmt': n => ({ kind: 'space', size: child(n, 'number') ? +child(n, 'number').v : 1 }),
  'divider-stmt': () => ({ kind: 'divider' }),
  'field-stmt': n => ({ kind: 'field', target: path(child(n, 'path')), label: child(n, 'string') ? str(child(n, 'string')) : null, mods: mods(n) }),
  'toggle-stmt': n => ({ kind: 'toggle', target: path(child(n, 'path')), win: child(n, 'window') ? windowN(child(n, 'window')) : null, where: child(n, 'expr') ? expr(child(n, 'expr')) : null, mods: mods(n) }),
  'choice-stmt': n => ({ kind: 'choice', target: path(child(n, 'path')), mods: mods(n) }),
  'slider-stmt': n => ({ kind: 'slider', target: path(child(n, 'path')), range: rangeLit(child(n, 'range-lit')), mods: mods(n) }),
};

function flatE(n) {
  const out = [];
  for (const k of kids(n)) { if (k.r === 'expr') out.push(k); else if (k.r === 'e3' || k.r === 'e4') out.push(...flatE(k)); }
  return out;
}

const DUR = { s: 1, m: 60, h: 3600, d: 86400 };
export const durSec = v => +v.slice(0, -1) * DUR[v.slice(-1)];

function field(n) {
  const o = { name: id(child(n, 'ident')), type: type(child(n, 'type')), optional: lits(n).includes('?'), range: null, dflt: null, label: null, unit: null };
  for (const fm of children(n, 'fmod')) {
    const l = lits(fm)[0];
    if (child(fm, 'range-lit')) o.range = rangeLit(child(fm, 'range-lit'));
    else if (l === '=') o.dflt = lit(child(fm, 'lit'));
    else if (l === 'unit') o.unit = str(child(fm, 'string'));
    else o.label = str(child(fm, 'string'));
  }
  return o;
}

function type(n) {
  const l = lits(n)[0];
  if (l === 'pick') return { t: 'pick', options: children(n, 'option').map(o => child(o, 'string') ? str(child(o, 'string')) : child(o, 'word').v) };
  if (l === 'ref') return { t: 'ref', table: id(child(n, 'ident')) };
  return { t: l };
}

function snum(n) { return (lits(n).includes('-') ? -1 : 1) * +child(n, 'number').v; }
function rangeLit(n) { const s = children(n, 'snum'); return { lo: snum(s[0]), hi: s[1] ? snum(s[1]) : null }; }

function lit(n) {
  const k = only(n)[0];
  if (k.lit === 'yes' || k.lit === 'no') return { k: 'bool', v: k.lit === 'yes' };
  if (k.lit === 'today' || k.lit === 'now') return { k: k.lit };
  if (k.r === 'snum') return { k: 'num', v: snum(k) };
  if (k.r === 'string') return { k: 'str', v: str(k) };
  if (k.r === 'time') return { k: 'time', v: k.v };
  if (k.r === 'dur') return { k: 'dur', v: durSec(k.v) };
  if (k.r === 'word') return { k: 'word', v: k.v };
  throw new Error('bad literal');
}

function tparts(n) { return children(n, 'tpart').map(p => child(p, 'string') ? { k: 'str', v: str(child(p, 'string')) } : expr(child(p, 'expr'))); }

function mods(n) {
  return children(n, 'mod').map(m => {
    const l = lits(m)[0];
    const o = { m: l };
    if (l === 'size') o.v = lits(child(m, 'size'))[0];
    else if (l === 'align') o.v = lits(child(m, 'align'))[0];
    else if (['pad', 'gap', 'span'].includes(l)) o.v = +child(m, 'number').v;
    else if (l === 'tap' || l === 'swipe') o.actions = actions(child(m, 'actions'));
    else if (child(m, 'expr')) o.e = expr(child(m, 'expr'));
    return o;
  });
}

function actions(n) { return children(n, 'action').map(action); }
function action(n) {
  const l = lits(n)[0];
  switch (l) {
    case 'add': return { a: 'add', table: id(child(n, 'ident')), assigns: children(n, 'assign').map(s => ({ name: id(child(s, 'ident')), e: expr(child(s, 'expr')) })) };
    case 'set': return { a: 'set', target: path(child(n, 'path')), e: expr(child(n, 'expr')) };
    case 'toggle': return { a: 'toggle', target: path(child(n, 'path')), win: child(n, 'window') ? windowN(child(n, 'window')) : null, where: child(n, 'expr') ? expr(child(n, 'expr')) : null };
    case 'remove': case 'edit': return { a: l, e: expr(child(n, 'expr')) };
    case 'save': case 'go': return { a: l, name: id(child(n, 'ident')) };
    case 'notify': return { a: 'notify', parts: tparts(child(n, 'tparts')) };
    case 'remind': return { a: 'remind', text: str(child(n, 'string')), e: expr(child(n, 'expr')) };
    default: return { a: 'param', name: id(child(n, 'ident')) };
  }
}

function source(n) {
  const k = only(n)[0];
  if (k.lit === 'days') return { k: 'days', win: windowN(child(n, 'window')) };
  if (k.lit === 'options') return { k: 'options', path: path(child(n, 'path')) };
  if (k.r === 'list') return { k: 'list', items: children(k, 'lit').map(lit) };
  if (k.r === 'range') { const s = children(k, 'sum-expr'); return { k: 'range', a: expr(s[0]), b: expr(s[1]) }; }
  if (k.r === 'query') return { k: 'query', q: query(k) };
  throw new Error('bad source');
}

function query(n) {
  const q = { path: path(child(n, 'path')), win: child(n, 'window') ? windowN(child(n, 'window')) : null, where: child(n, 'expr') ? expr(child(n, 'expr')) : null, by: null, sort: null, desc: false, top: null };
  if (child(n, 'group')) { const g = child(n, 'group'); q.by = child(g, 'ident') ? id(child(g, 'ident')) : lits(g)[0]; }
  const ps = children(n, 'path');
  if (ps[1]) { q.sort = path(ps[1]); q.desc = lits(n).includes('desc'); }
  if (child(n, 'number')) q.top = +child(n, 'number').v;
  return q;
}

function windowN(n) {
  const ls = lits(n);
  const l = ls[0];
  if (l === 'today' || l === 'yesterday' || l === 'all') return { k: l };
  if (l === 'prev') return { k: 'prev', p: lits(child(n, 'period'))[0] };
  if (l === 'last') return { k: 'last', n: +child(n, 'number').v, unit: lits(child(n, 'periods'))[0] };
  if (l === 'on') return { k: 'on', e: primary(child(n, 'primary')) };
  if (child(n, 'period')) return { k: 'period', p: lits(child(n, 'period'))[0], of: child(n, 'primary') ? primary(child(n, 'primary')) : null };
  return { k: 'param', name: id(child(n, 'ident')) };
}

function path(n) {
  const ids = children(n, 'ident').map(id);
  const it = lits(n)[0] === 'it';
  return it ? { k: 'path', head: 'it', parts: ids } : { k: 'path', head: ids[0], parts: ids.slice(1) };
}

// ---- expressions ----
function expr(n) {
  switch (n.r) {
    case 'expr': return chain(n, 'and-expr', 'or');
    case 'and-expr': return chain(n, 'not-expr', 'and');
    case 'not-expr': return child(n, 'not-expr') ? { k: 'not', a: expr(child(n, 'not-expr')) } : expr(child(n, 'cmp-expr'));
    case 'cmp-expr': {
      const s = children(n, 'sum-expr');
      if (s.length === 1) return expr(s[0]);
      return { k: 'bin', op: lits(child(n, 'cmp-op'))[0], a: expr(s[0]), b: expr(s[1]) };
    }
    case 'sum-expr': return opchain(n, 'prod-expr', 'add-op');
    case 'prod-expr': return opchain(n, 'unary', 'mul-op');
    case 'unary': return child(n, 'unary') ? { k: 'neg', a: expr(child(n, 'unary')) } : primary(child(n, 'primary'));
    case 'primary': return primary(n);
  }
  throw new Error('bad expr ' + n.r);
}
function chain(n, sub, op) {
  const xs = children(n, sub).map(expr);
  return xs.reduce((a, b) => ({ k: 'bin', op, a, b }));
}
function opchain(n, sub, opRule) {
  const parts = only(n).filter(k => k.r === sub || k.r === opRule);
  let acc = expr(parts[0]);
  for (let j = 1; j < parts.length; j += 2) acc = { k: 'bin', op: lits(parts[j])[0], a: acc, b: expr(parts[j + 1]) };
  return acc;
}
const COLORS = new Set(['accent', 'ink', 'muted', 'soft', 'good', 'warn', 'bad', 'bg', 'surface', 'edge']);
function primary(n) {
  const k = only(n)[0];
  if (k.lit === 'yes' || k.lit === 'no') return { k: 'bool', v: k.lit === 'yes' };
  if (k.lit === 'today' || k.lit === 'now' || k.lit === 'index') return { k: k.lit };
  if (k.lit === '(') return { k: 'paren', a: expr(child(n, 'expr')) };
  if (k.r === 'color') return { k: 'color', v: lits(k)[0] };
  if (k.r === 'number') return { k: 'num', v: +k.v };
  if (k.r === 'string') return { k: 'str', v: str(k) };
  if (k.r === 'time') return { k: 'time', v: k.v };
  if (k.r === 'dur') return { k: 'dur', v: durSec(k.v) };
  if (k.r === 'path') return path(k);
  if (k.r === 'func') return func(k);
  throw new Error('bad primary');
}
function func(n) {
  const f = only(n)[0];
  if (f.r === 'agg') return { k: 'agg', fn: lits(f)[0].slice(0, -1), q: query(child(n, 'query')) };
  if (f.r === 'fold') return { k: 'fold', fn: lits(f)[0].slice(0, -1), src: source(child(n, 'source')), e: expr(child(n, 'expr')) };
  const name = f.r === 'fn1' || f.r === 'fn2' ? lits(f)[0] : f.lit;
  return { k: 'fn', fn: name.slice(0, -1), args: children(n, 'expr').map(expr) };
}

// Parse a component argument (as written in a call) into {kind, ast}; used by describe.
export function parseArg(text) {
  let canon;
  try { canon = join(lex(text)); } catch { return null; }
  for (const [rule, kind, f] of [['expr', 'expr', expr], ['window', 'window', windowN], ['source', 'source', source], ['actions', 'actions', actions]]) {
    const r = parseText(canon, [rule]);
    if (r.tree) { try { return { kind, ast: f(r.tree) }; } catch { /* try next */ } }
  }
  return null;
}
