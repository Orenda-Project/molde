// Splits one line into tokens and joins them back with canonical spacing.
// The canonical text is what the grammar (and the GBNF) expects, so format = lex + join.
import { loadGrammar, literals } from './grammar.mjs';

const G = loadGrammar();
const LITS = new Set(literals(G));
const FUNCS = new Set([...LITS].filter(l => l.endsWith('(') && l.length > 1));
const PUNCT = ['..', '!=', '<=', '>=', '=', '<', '>', '+', '-', '*', '/', '%', '(', ')', '[', ']', ',', '.', '|', '?'];

export class LexError extends Error {
  constructor(msg, col) { super(msg); this.col = col; }
}

export function lex(line) {
  const toks = [];
  let i = 0;
  let spaced = true;
  const push = t => { t.sp = spaced; spaced = false; toks.push(t); };
  while (i < line.length) {
    const c = line[i];
    if (c === ' ' || c === '\t') { i++; spaced = true; continue; }
    const rest = line.slice(i);
    let m;
    if (c === '"') {
      m = rest.match(/^"(?:[^"\\\x00-\x1F]|\\["\\n])*"/);
      if (!m) throw new LexError('a text in quotes is not closed (or has a bad \\ escape)', i);
      push({ t: 'str', v: m[0] }); i += m[0].length; continue;
    }
    if ((m = rest.match(/^[0-9]{4}-[0-1][0-9]-[0-3][0-9](?![0-9A-Za-z_])/))) { push({ t: 'date', v: m[0] }); i += m[0].length; continue; }
    if ((m = rest.match(/^[0-9][0-9]?:[0-5][0-9](?![0-9A-Za-z_])/))) { push({ t: 'time', v: m[0] }); i += m[0].length; continue; }
    if ((m = rest.match(/^[0-9]+[smhd](?![0-9A-Za-z_])/))) { push({ t: 'dur', v: m[0] }); i += m[0].length; continue; }
    if ((m = rest.match(/^[0-9]+(?:\.[0-9]+)?/))) { push({ t: 'num', v: m[0] }); i += m[0].length; continue; }
    if ((m = rest.match(/^[A-Za-z][A-Za-z0-9_]*/))) {
      const w = m[0];
      if (line[i + w.length] === '(') { push({ t: 'func', v: w + '(', known: FUNCS.has(w + '(') }); i += w.length + 1; continue; }
      push({ t: 'word', v: w }); i += w.length; continue;
    }
    const p = PUNCT.find(p => rest.startsWith(p));
    if (!p) throw new LexError(`the character "${c}" is not part of MoldeScript`, i);
    push({ t: 'p', v: p }); i += p.length;
  }
  for (let k = 0; k < toks.length; k++) toks[k].spAfter = k + 1 < toks.length ? toks[k + 1].sp : false;
  // A minus is a sign (unary) when it is glued to what follows and stands where a value starts:
  // at the start, after an operator or bracket, or after a space (`a -1` is two parts; `a - 1` and
  // `a-1` are subtraction). The canonical form keeps that reading.
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k];
    if (t.t !== 'p' || t.v !== '-') continue;
    const prev = toks[k - 1];
    const glued = !t.spAfter && k + 1 < toks.length;
    const afterOp = !prev || (prev.t === 'p' && !(prev.v === ')' || prev.v === ']')) || prev.t === 'func';
    t.unary = glued && (afterOp || t.sp);
  }
  return toks;
}

const NO_SPACE_BEFORE = new Set([')', ']', ',', '?', '.', '..', '|']);
const NO_SPACE_AFTER = new Set(['(', '[', '.', '..', '|']);

export function join(toks) {
  let out = '';
  toks.forEach((t, k) => {
    if (k > 0) {
      const a = toks[k - 1];
      // `0..` followed by a space is an open range (`kg num 0.. = 0`); `1..9` is closed.
      const tight = (NO_SPACE_BEFORE.has(t.v) && t.t === 'p')
        || (a.t === 'p' && NO_SPACE_AFTER.has(a.v) && !(a.v === '..' && (t.v === '=' || t.t === 'str' || (t.t === 'word' && (t.v === 'unit' || t.v === 'was'))))) || a.t === 'func' || (a.t === 'p' && a.v === '-' && a.unary);
      if (!tight) out += ' ';
    }
    out += t.v;
  });
  return out;
}

export function canonical(line) { return join(lex(line)); }
