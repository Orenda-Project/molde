// MoldeScript v0 parser: text -> typed AST with line numbers.
// Each line is lexed, joined with canonical spacing, and matched against the grammar file by
// engine.mjs. Indentation gives the tree. Errors carry a code, line, message and fix hint.
import { parseText, child, children, kids, lits, KEYWORDS, RESERVED } from './engine.mjs';
import { loadGrammar } from './grammar.mjs';
import { STD_SOURCES } from './sources.gen.mjs';

// std component signatures, for "separate the values with commas" hints
export const STD_SIGS = new Map();
for (const src of Object.values(STD_SOURCES)) for (const m of src.matchAll(/^def ([a-z][a-z0-9_]*) ?(.*)$/gm)) STD_SIGS.set(m[1], m[2].split(', ').map(p => p.split(' ')[0]).filter(Boolean));
const SHAPES = { rect: ['X', 'Y', 'W', 'H'], line: ['X1', 'Y1', 'X2', 'Y2'], circle: ['CX', 'CY', 'R'], arc: ['CX', 'CY', 'R', 'FROM', 'TO'], label: ['X', 'Y', 'TEXT'], pt: ['X', 'Y'] };

const GR = loadGrammar();
const altNames = r => (GR.map.get(r).items || [GR.map.get(r)]).map(n => n.name);
// statements other than a component call, and the words that start them
export const NONCALL = [...altNames('leaf-stmt').filter(n => n !== 'itext-stmt'), ...altNames('block-stmt').filter(n => n !== 'call-stmt')]; // and not a text line
export const STMT_WORDS = new Set(['table', 'setting', 'state', 'let', 'remind', 'every', 'when', 'text', 'icon', 'image', 'space', 'divider', 'field', 'toggle', 'choice', 'slider', 'button', 'rect', 'line', 'circle', 'arc', 'path', 'label', 'pt', 'slot', 'def', 'screen', 'each', 'if', 'else', 'stack', 'row', 'box', 'scroll', 'grid', 'draw', 'poly', 'app', 'ask', 'lib']);
import { lex, join, LexError } from './lex.mjs';

export const MAX_DEPTH = 8;

// Parsing one line is the expensive part; the same line text always parses the same way, so
// results are cached (decoding re-checks a growing program line by line).
const LINE_CACHE = new Map();
function parseCached(canon, starts) {
  const key = starts.join(',') + '\u0000' + canon;
  let r = LINE_CACHE.get(key);
  if (!r) { r = parseText(canon, starts); if (LINE_CACHE.size > 20000) LINE_CACHE.clear(); LINE_CACHE.set(key, r); }
  return r;
}
export const BLOCK = new Set(['def', 'screen', 'each', 'if', 'else', 'box', 'draw', 'plot', 'poly', 'call']);

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

const THEMES = ['ocean', 'mint', 'slate', 'ink', 'plum'];
const WINDOW_RE = /\b(today|yesterday|week|month|year|prev \w+|last \d+ \w+|on \w+)\)?$/;

// Is the line a valid text line once "text " is put in front? (a line that starts with a bare name)
export function asTextLine(text) {
  const r = parseText('text ' + text, ['text-stmt']);
  return r.tree ? r.tree : null;
}

// Slips from other languages, with the MoldeScript way to write them.
export function slip(text, hardOnly = false) {
  let m;
  if (/^else if\b/.test(text)) return ['"else if" is not one line here: else stands alone.', 'write else on its own line and put the if under it, two spaces in (or write a second if with the opposite condition).'];
  if (/&&/.test(text)) return ['MoldeScript writes "and", not &&.', 'write: a > 1 and b < 9.'];
  if (/\|\|/.test(text)) return ['MoldeScript writes "or", not ||.', 'write: a = 1 or b = 2.'];
  if (/==/.test(text)) return ['= already compares; there is no ==.', 'write a single =, for example if count(t) = 3.'];
  if (/!(?!=)/.test(text)) return ['MoldeScript writes "not", not !.', 'write: not done, or a != b.'];
  if ((m = text.match(/\bset ([a-z][a-z0-9_.]*) ?([-+*\/])= ?(.+?)$/))) return [`there is no ${m[2]}=.`, `write set ${m[1]} = ${m[1]} ${m[2]} ${m[3]}.`];
  if ((m = text.match(/\b([a-z][a-z0-9_.]*) ?(\+\+|--)/))) return [`there is no ${m[2]}.`, `write set ${m[1]} = ${m[1]} ${m[2][0]} 1.`];
  if ((m = text.match(/^for ([a-z][a-z0-9_]*) in (.+)$/))) return ['there is no for loop; each repeats its lines for every item.', `write each ${m[2]} as ${m[1]}.`];
  if (/^(while|loop|repeat) /.test(text)) return [`there is no ${text.split(' ')[0]}; lines repeat with each, and actions repeat with every.`, 'write each SOURCE (a table, 1..n, days last 7 days) or every 1s if CONDITION ACTION.'];
  if (hardOnly) return null; // the slips below can also be valid MoldeScript
  if (/"[^"]*" \+ |\+ "[^"]*"/.test(text)) return ['texts are not joined with +.', 'write the parts side by side: "Total:" amount "rupees" (or join(a, b) to join without a space).'];
  if (/\b\d{1,2}\/\d{1,2}\/\d{4}\b|\b\d{4}\/\d{1,2}\/\d{1,2}\b/.test(text)) return ['a date is written year-month-day.', 'write 2026-11-30.'];
  if (/^button\b/.test(text) && !/ tap /.test(text)) return ['a button needs tap and an action.', 'write button "Add" tap add drink ml = 250 (or set, toggle, go, remove ...).'];
  return null;
}

function syntaxError(no, text, r) {
  const sl = slip(text);
  if (sl) return new MoError('E_SYNTAX', no, sl[0], sl[1]);
  const col = r.far;
  const near = text.slice(col).split(' ')[0] || '(end of line)';
  const E = (msg, hint, code = 'E_SYNTAX') => new MoError(code, no, msg, hint);
  const first = text.split(' ')[0];
  // names start with a small letter
  const up = text.match(/^(?:table|setting|state|let|def|screen) ([A-Z][A-Za-z0-9_]*)/) || text.match(/\bref ([A-Z][A-Za-z0-9_]*)/);
  if (up) return E(`"${up[1]}" starts with a capital letter; names are written in small letters.`, `write ${up[0].replace(up[1], up[1].toLowerCase())}.`);
  // a line that starts with a bare name and is a fine text line
  if (/^[a-z][a-z0-9_]*\b/.test(first) && !STMT_WORDS.has(first) && !STD_SIGS.has(first) && asTextLine(text)) return E(`a line that starts with a name is read as a component call, and there is no component "${first}".`, `to show the value, start the line with text: text ${text}`);
  // shapes: values separated by commas, the right number of them
  if (SHAPES[first]) {
    const want = SHAPES[first];
    const rest = text.slice(first.length + 1).replace(/ (fill|stroke|thick|opacity|radius|tap|swipe|size|bold|big|head|faint|color)\b.*$/, '');
    const n = rest.split(', ').length;
    if (!rest.includes(',') && rest.split(' ').length > 1) return E(`the values of ${first} must be separated by commas.`, `write ${first} ${want.join(', ')}, for example ${first} ${want.map((w, i) => w === 'TEXT' ? '"Hi"' : [10, 20, 30, 40, 50][i]).join(', ')}.`);
    if (!(first === 'circle' && n === 1) && !(first === 'arc' && n === 3) && n !== want.length) return E(`${first} needs ${want.length} values (${want.join(', ')}) but has ${n}.`, `write ${first} ${want.join(', ')}${first === 'circle' ? ' (or circle R, centred)' : first === 'arc' ? ' (or arc R, FROM, TO, centred)' : ''}.`);
  }
  // component calls: values separated by commas
  if (STD_SIGS.has(first)) {
    const sig = STD_SIGS.get(first);
    return E(`cannot read the values of ${first}; they are separated by commas.`, `write ${first} ${sig.join(', ')}${sig.length ? '' : ''} (for example: ${first === 'daybars' ? 'daybars last 7 days, sum(drink.ml on it)' : first + ' ' + sig.join(', ')}).`);
  }
  // if() needs three values
  if (/\bif\([^,()]*\)/.test(text)) return E('if() needs three values separated by commas.', 'write if(condition, value when yes, value when no), for example if(n > 0, good, bad).');
  const decl = text.match(/^(?:table|setting|state|def|screen|let) ([a-z]+)\b/) || text.match(/^table [a-z][a-z0-9_]*(?: "[^"]*")? (?:.*, )?([a-z]+) /);
  if (decl && RESERVED.has(decl[1])) return E(`"${decl[1]}" is one of the 12 reserved words (${[...RESERVED].join(', ')}) and cannot be a name.`, `use another word, for example "${decl[1]}_value".`, 'E_RESERVED');
  const word = text.slice(col).match(/^[a-z]+/)?.[0];
  if (word && RESERVED.has(word) && /^(table|setting|state|let|def|screen|each .* as)\b/.test(text)) return E(`"${word}" is one of the 12 reserved words and cannot be a name.`, `use another word, for example "${word}_value".`, 'E_RESERVED');
  // the third word of app must be a theme
  const app = text.match(/^app "(?:[^"\\]|\\.)*" ([a-z][a-z0-9_]*) ([a-z]+)$/);
  if (app && !THEMES.includes(app[2])) return E(`"${app[2]}" is not a theme.`, `the third word of app is a theme: ${THEMES.join(', ')} (colours like ${app[2]} go on lines, for example fill ${app[2]}).`);
  // ? goes right after the type
  if (/\b(num|money|text|long|date|time|when|dur|bool|image)\b[^,]*?(\.\.\??|\d|") ?\?/.test(text) || /\.\.\?/.test(text)) return E('the optional mark ? is in the wrong place.', 'put ? right after the type, for example: seat num? 1..10.');
  // a window after where
  const inside = text.match(/\b(count|sum|avg|min|max|last|first|streak|best|since|gap)\(([^()]*)\)/g) || [];
  for (const call of inside) {
    const body = call.slice(call.indexOf('(') + 1, -1);
    const w = body.indexOf(' where ');
    if (w >= 0 && WINDOW_RE.test(body.slice(w))) return E('the time window comes after where.', 'put the window first, then where: sum(t.amount last 30 days where kind = Food).');
  }
  if (/ where .* (today|yesterday|this week|last \d+ \w+)$/.test(text) && /^each /.test(text)) return E('the time window comes after where.', 'put the window first: each t last 7 days where ....');
  // text parts inside if()
  if (/\bif\([^()]*"[^"]*" [^,)]/.test(text) || /\bif\([^()]*[a-z0-9)] "[^"]*"/.test(text)) return E('if() gives one value, so it cannot join words and numbers inside its brackets.', 'write the parts outside: "Left" if(x > 0, x, 0) "days", or use if/else lines.');
  // a field without a type
  if (/^table /.test(text)) {
    const fields = text.replace(/^table [a-z][a-z0-9_]*( was [a-z][a-z0-9_]*)?( "[^"]*")? ?/, '').split(', ');
    const bad = fields.find(f => f && /^[a-z][a-z0-9_]*$/.test(f.trim()));
    if (bad) return E(`field "${bad.trim()}" has no type.`, `${fields[0] === bad ? 'the first word after table is the table name, then fields. ' : ''}every field is NAME TYPE, for example "${bad.trim()} text" or "${bad.trim()} date"; types: text long num money bool date time when dur image pick ref.`);
  }
  if (/^(min|max)\(/.test(text.slice(col)) || /\b(min|max)\([^()]*,/.test(text)) return E('min() and max() take one table column (min(t.price)) or two numbers (min(a, b)).', 'check the brackets and the comma.');
  const exp = r.expected.filter(x => x !== 'a character').slice(0, 6).join(', ');
  return E(`cannot read the line from "${near}" (column ${col + 1}).`, exp ? `expected ${exp}.` : 'check the statement form in SPEC.md.');
}

// the component names a program can call: the std library plus its own defs
export function componentNames(src, extra) {
  const c = new Set(STD_SIGS.keys());
  for (const m of src.matchAll(/^\s*def ([a-z][a-z0-9_]*)/gm)) c.add(m[1]);
  if (extra) for (const n of extra) c.add(n);
  return c;
}

export function parse(src, { lib = false, comps = null } = {}) {
  const { lines, errors } = splitLines(src);
  const COMPS = componentNames(src, comps);
  const prog = { kind: 'program', header: null, body: [], comments: [], errors };
  const stack = [{ node: prog, depth: -1, block: true }];
  let first = true;
  prog.failed = new Map(); // name -> line, for declarations whose line failed (to report follow-on uses once)
  const noteFailed = (ln, text) => {
    const m = (text || '').match(/^(?:table|setting|state|let|def|screen)\s+([a-z][a-z0-9_]*)/);
    if (m && !prog.failed.has(m[1])) prog.failed.set(m[1], ln.no);
  };
  const skip = ln => { // a line that failed still owns its indented children, so they do not cascade
    noteFailed(ln, ln.canon || ln.body);
    while (stack.length > 1 && stack[stack.length - 1].depth >= ln.depth) stack.pop();
    stack.push({ node: { kind: 'error', children: [] }, depth: ln.depth, block: true, dead: true });
  };
  for (const ln of lines) {
    if (ln.comment) { prog.comments.push(ln); continue; }
    const hard = slip(ln.body.replace(/"(?:[^"\\]|\\.)*"/g, '""'), true); // never valid: else if, &&, ||, ==, +=, ++, for x in, while
    if (hard) { errors.push(new MoError('E_SYNTAX', ln.no, hard[0], hard[1])); first = false; skip(ln); continue; }
    let canon;
    try { canon = join(lex(ln.body)); }
    catch (e) {
      if (e instanceof LexError) { const sl = slip(ln.body); errors.push(sl ? new MoError('E_SYNTAX', ln.no, sl[0], sl[1]) : new MoError('E_SYNTAX', ln.no, e.message + '.', 'remove or quote the character.')); first = false; skip(ln); continue; }
      throw e;
    }
    ln.canon = canon;
    const starts = first ? [lib ? 'lib-first' : 'first-stmt'] : ['leaf-stmt', 'block-stmt'];
    // a line that starts with a bare name: a component call when the name is a component, else a text line
    const w0 = !first && canon.match(/^[a-z][a-z0-9_]*(?![a-z0-9_(])/);
    let r = null;
    if (w0) r = parseCached(canon, STMT_WORDS.has(w0[0]) ? NONCALL : [COMPS.has(w0[0]) ? 'call-stmt' : 'itext-stmt']);
    if (!r || !r.tree) r = parseCached(canon, starts);
    if (!r.tree) {
      if (first && !/^(app|ask|lib)\b/.test(canon)) errors.push(new MoError('E_HEADER', ln.no, lib ? 'a library starts with lib "name".' : 'a program starts with app "Name" (or is a single ask line).', lib ? 'add lib "name" as line 1.' : 'add app "My app" as line 1.'));
      else errors.push(syntaxError(ln.no, canon, r));
      first = false;
      skip(ln);
      continue;
    }
    const top = kids(r.tree)[0];
    const lead = top && top.r === 'itext-stmt' && canon.match(/^[a-z][a-z0-9_]*(?![a-z0-9_(])/);
    if ((top && top.r === 'call-stmt' && STMT_WORDS.has(child(top, 'ident').v)) || (lead && STMT_WORDS.has(lead[0]))) {
      // `table drink ml` is a broken table line, not a component called "table"
      const rn = parseText(canon, NONCALL);
      errors.push(syntaxError(ln.no, canon, rn.tree ? { far: 0, expected: [] } : rn));
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
  'table-stmt': n => { const ids = children(n, 'ident'); return { kind: 'table', name: id(ids[0]), was: lits(n).includes('was') ? id(ids[1]) : null, label: child(n, 'string') ? str(child(n, 'string')) : null, fields: children(n, 'field').map(field) }; },
  'setting-stmt': n => ({ kind: 'setting', ...field(child(n, 'field')), force: lits(n).includes('set') }),
  'state-stmt': n => {
    const st = child(n, 'state-type');
    const o = { kind: 'state', name: id(child(n, 'ident')), type: null, draft: null, init: child(n, 'expr') ? expr(child(n, 'expr')) : child(n, 'word') ? { k: 'str', v: child(n, 'word').v, word: true } : null, keep: lits(n).includes('keep'), was: lits(n).includes('was') ? id(children(n, 'ident')[children(n, 'ident').length - 1]) : null };
    if (child(st, 'type')) o.type = type(child(st, 'type')); else o.draft = id(child(st, 'ident'));
    return o;
  },
  'let-stmt': n => ({ kind: 'let', name: id(child(n, 'ident')), params: children(n, 'param').length ? children(n, 'param').map(paramOf) : null, e: expr(child(n, 'expr')) }),
  'def-stmt': (n, src) => ({ kind: 'def', name: id(child(n, 'ident')), params: children(n, 'param').map(p => ({ ...paramOf(p), dflt: child(p, 'arg') ? src.slice(child(p, 'arg').s, child(p, 'arg').e) : null })) }),
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
      if (o.at) { o.offset = child(w, 'dur') ? (lits(child(w, 'add-op'))[0] === '-' ? -1 : 1) * durSec(child(w, 'dur').v) : 0; o.time = o.times[0] || null; o.times = []; }
      o.days = children(w, 'dayname').map(d => lits(d)[0]);
    } else if (lits(w)[0] === 'monthly') {
      o.monthly = children(w, 'number').map(x => +x.v);
      o.times = children(w, 'time').map(t => t.v);
    } else {
      o.every = durSec(child(w, 'dur').v);
      const ts = children(w, 'time').map(t => t.v);
      o.from = ts[0] || null; o.to = ts[1] || null;
    }
    return o;
  },
  'every-stmt': n => ({ kind: 'every', every: durSec(child(n, 'dur').v), cond: child(n, 'expr') ? expr(child(n, 'expr')) : null, actions: actions(child(n, 'actions')) }),
  'when-stmt': n => ({ kind: 'when', cond: expr(child(n, 'expr')), actions: actions(child(n, 'actions')) }),
  'each-stmt': n => ({ kind: 'each', source: source(child(n, 'source')), as: child(n, 'ident') ? id(child(n, 'ident')) : null, empty: child(n, 'string') ? str(child(n, 'string')) : null }),
  'plot-stmt': n => { const r = children(n, 'range').map(x => children(x, 'sum-expr').map(expr)); return { kind: 'plot', x: r[0], y: r[1], mods: mods(n) }; },
  'tick-stmt': n => ({ kind: 'tick', axis: lits(n).includes('ytick') ? 'y' : 'x', x: expr(child(n, 'expr')), parts: tparts(child(n, 'tparts')) }),
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
    else if ((shape === 'circle') && child(n, 'expr')) o.args = [expr(child(n, 'expr'))];
    if (shape === 'path') o.d = str(child(n, 'string'));
    if (shape === 'label') { o.args = children(n, 'expr').map(expr); o.parts = tparts(child(n, 'tparts')); }
    return o;
  },
  'text-stmt': n => ({ kind: 'text', parts: tparts(child(n, 'tparts')), mods: mods(n) }),
  'itext-stmt': n => ({ kind: 'text', implicit: true, parts: [child(n, 'string') ? { k: 'str', v: str(child(n, 'string')) } : expr(child(n, 'lead-expr')), ...children(n, 'tpart').map(p => child(p, 'string') ? { k: 'str', v: str(child(p, 'string')) } : expr(child(p, 'expr')))], mods: mods(n) }),
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

// a parameter: `x num`, or `r item` (a row of table item)
function paramOf(p) {
  const ids = children(p, 'ident');
  return child(p, 'pkind') ? { name: id(ids[0]), kind: lits(child(p, 'pkind'))[0] } : { name: id(ids[0]), kind: 'row', table: id(ids[1]) };
}

function flatE(n) {
  const out = [];
  for (const k of kids(n)) { if (k.r === 'expr') out.push(k); else if (k.r === 'e3' || k.r === 'e4') out.push(...flatE(k)); }
  return out;
}

const DUR = { s: 1, m: 60, h: 3600, d: 86400 };
export const durSec = v => +v.slice(0, -1) * DUR[v.slice(-1)];

function field(n) {
  const o = { name: id(child(n, 'ident')), type: type(child(n, 'type')), optional: lits(n).includes('?'), range: null, dflt: null, label: null, unit: null, was: null };
  for (const fm of children(n, 'fmod')) {
    const l = lits(fm)[0];
    if (child(fm, 'range-lit')) o.range = rangeLit(child(fm, 'range-lit'));
    else if (l === '=') o.dflt = lit(child(fm, 'lit'));
    else if (l === 'unit') o.unit = str(child(fm, 'string'));
    else if (l === 'was') o.was = id(child(fm, 'ident'));
    else o.label = str(child(fm, 'string'));
  }
  return o;
}

function type(n) {
  const l = lits(n)[0];
  if (l === 'pick') {
    const opts = children(n, 'option');
    const words = o => children(o, 'word').map(w => w.v);
    const renames = {};
    const options = opts.map(o => {
      const v = child(o, 'string') ? str(child(o, 'string')) : words(o)[0];
      if (lits(o).includes('was')) renames[v] = words(o)[child(o, 'string') ? 0 : 1];
      return v;
    });
    return { t: 'pick', options, renames };
  }
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
  if (k.r === 'datelit') return { k: 'date', v: k.v };
  if (k.r === 'dur') return { k: 'dur', v: durSec(k.v) };
  if (k.r === 'word') return { k: 'word', v: k.v };
  throw new Error('bad literal');
}

function tparts(n) { return children(n, 'tpart').map(p => child(p, 'string') ? { k: 'str', v: str(child(p, 'string')) } : expr(child(p, 'expr'))); }

function mods(n) {
  return children(n, 'mod').map(m => {
    if (child(m, 'size')) return { m: 'size', v: lits(child(m, 'size'))[0] }; // tiny, small, large, huge
    const l = lits(m)[0];
    const o = { m: l };
    if (l === 'alt') o.v = str(child(m, 'string'));
    else if (l === 'bar') o.v = true;
    else if (l === 'align') o.v = lits(child(m, 'align'))[0];
    else if (['pad', 'gap', 'span'].includes(l)) o.v = +child(m, 'number').v;
    else if (['axes', 'gridlines', 'middle', 'full'].includes(l)) o.v = true;
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
    case 'set':
      if (lits(n)[1] === 'all') { const es = children(n, 'expr'); return { a: 'setall', target: path(child(n, 'path')), e: expr(es[0]), where: es[1] ? expr(es[1]) : null }; }
      return { a: 'set', target: path(child(n, 'path')), e: expr(child(n, 'expr')) };
    case 'toggle': return { a: 'toggle', target: path(child(n, 'path')), win: child(n, 'window') ? windowN(child(n, 'window')) : null, where: child(n, 'expr') ? expr(child(n, 'expr')) : null };
    case 'remove': if (child(n, 'query')) return { a: 'removeall', q: query(child(n, 'query')) }; return { a: 'remove', e: expr(child(n, 'expr')) };
    case 'edit': return { a: l, e: expr(child(n, 'expr')) };
    case 'save': case 'go': return { a: l, name: id(child(n, 'ident')) };
    case 'notify': return { a: 'notify', parts: tparts(child(n, 'tparts')) };
    case 'after': return { a: 'after', every: durSec(child(n, 'dur').v), act: action(child(n, 'action')) };
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
  const ls = lits(n);
  const es = children(n, 'expr');
  const q = { path: path(child(n, 'path')), win: child(n, 'window') ? windowN(child(n, 'window')) : null, where: ls.includes('where') ? expr(es[0]) : null, by: null, sort: null, desc: false, top: null };
  if (child(n, 'group')) { const g = child(n, 'group'); q.by = child(g, 'path') ? path(child(g, 'path')) : lits(g)[0]; if (q.by.k === 'path' && !q.by.parts.length && q.by.head !== 'it') q.by = q.by.head; }
  if (ls.includes('sort')) { q.sort = expr(es[ls.includes('where') ? 1 : 0]); q.desc = ls.includes('desc'); }
  if (ls.includes('shuffle')) q.shuffle = true;
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
    case 'lead-expr': return opchain(n, 'lead-prod', 'add-op', 'prod-expr');
    case 'lead-prod': return opchain(n, 'lead-unary', 'mul-op', 'unary');
    case 'lead-unary': {
      const k = only(n)[0];
      if (k.lit === '-') return { k: 'neg', a: expr(child(n, 'unary')) };
      if (k.lit === '(') return { k: 'paren', a: expr(child(n, 'expr')) };
      if (k.r === 'number') return { k: 'num', v: +k.v };
      if (k.r === 'lead-ident') return { k: 'path', head: child(k, 'ident').v, parts: [] };
      if (k.r === 'ident' || k.lit === 'it') { const ids = children(n, 'ident').map(id); return k.lit === 'it' ? { k: 'path', head: 'it', parts: ids } : { k: 'path', head: ids[0], parts: ids.slice(1) }; }
      return func(k);
    }
  }
  throw new Error('bad expr ' + n.r);
}
function chain(n, sub, op) {
  const xs = children(n, sub).map(expr);
  return xs.reduce((a, b) => ({ k: 'bin', op, a, b }));
}
function opchain(n, sub, opRule, sub2) {
  const parts = only(n).filter(k => k.r === sub || k.r === opRule || k.r === sub2);
  let acc = expr(parts[0]);
  for (let j = 1; j < parts.length; j += 2) acc = { k: 'bin', op: lits(parts[j])[0], a: acc, b: expr(parts[j + 1]) };
  return acc;
}
const COLORS = new Set(['accent', 'ink', 'muted', 'soft', 'good', 'warn', 'bad', 'bg', 'surface', 'edge']);
function primary(n) {
  const k = only(n)[0];
  if (k.lit === 'yes' || k.lit === 'no') return { k: 'bool', v: k.lit === 'yes' };
  if (k.lit === 'today' || k.lit === 'now' || k.lit === 'index' || k.lit === 'pi') return { k: k.lit };
  if (k.r === 'cword') return { k: 'word', v: k.v };
  if (k.lit === '(') return { k: 'paren', a: expr(child(n, 'expr')) };
  if (k.r === 'color') return { k: 'color', v: lits(k)[0] };
  if (k.r === 'number') return { k: 'num', v: +k.v };
  if (k.r === 'string') return { k: 'str', v: str(k) };
  if (k.r === 'time') return { k: 'time', v: k.v };
  if (k.r === 'datelit') return { k: 'date', v: k.v };
  if (k.r === 'dur') return { k: 'dur', v: durSec(k.v) };
  if (k.r === 'path') return path(k);
  if (k.r === 'func') { const f = func(k); const parts = children(n, 'ident').map(id); return parts.length ? { k: 'member', e: f, parts } : f; } // last(t).name
  throw new Error('bad primary');
}
const FOLD = { 'count(': 'countof', 'sum(': 'sumof', 'min(': 'minof', 'max(': 'maxof' };
function func(n) {
  const f = only(n)[0];
  if (f.r === 'agg') return { k: 'agg', fn: lits(f)[0].slice(0, -1), q: query(child(n, 'query')) };
  if (f.r === 'fold') {
    const o = { k: 'fold', fn: FOLD[lits(f)[0]], src: source(child(n, 'source')), e: expr(child(n, 'expr')) };
    // min(a, b) / max(a, b) of two values reads the same as a fold over a table a: the checker decides by a's type
    const q = o.src.k === 'query' && o.src.q;
    if ((o.fn === 'minof' || o.fn === 'maxof') && q && !q.win && !q.where && !q.by && !q.sort && !q.top && !q.shuffle) o.pair = { k: 'fn', fn: o.fn.slice(0, 3), args: [q.path, o.e] };
    return o;
  }
  if (f.r === 'ident') return { k: 'ucall', name: f.v, args: children(n, 'expr').map(expr) };
  if (f.lit === 'due(' || f.lit === 'nth(') return { k: 'qfn', fn: f.lit.slice(0, -1), q: query(child(n, 'query')), e: expr(child(n, 'expr')) };
  if (f.lit === 'random(' && child(n, 'query')) return { k: 'qfn', fn: 'anyrow', q: query(child(n, 'query')) };
  if (f.lit === 'join(') return { k: 'join', parts: children(n, 'tpart').map(p => child(p, 'string') ? { k: 'str', v: str(child(p, 'string')) } : expr(child(p, 'expr'))) };
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
