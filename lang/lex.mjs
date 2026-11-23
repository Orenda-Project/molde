// Splits one line into tokens and joins them back with canonical spacing.
// The canonical text is what the grammar (and the GBNF) expects, so format = lex + join.
import { loadGrammar, literals, keywords } from './grammar.mjs';

const G = loadGrammar();
const LITS = new Set(literals(G));
const HARD = keywords(G);
const TYPE_WORDS = new Set(['num', 'money', 'dur']); // a minus after these starts a range like -5..5
const FUNCS = new Set([...LITS].filter(l => l.endsWith('(') && l.length > 1));
const VALUE_WORDS = new Set(['today', 'now', 'yes', 'no', 'it', 'index', 'accent', 'ink', 'muted', 'soft', 'good', 'warn', 'bad', 'bg', 'surface', 'edge']);
const PUNCT = ['..', '!=', '<=', '>=', '=', '<', '>', '+', '-', '*', '/', '%', '(', ')', '[', ']', ',', '.', '|', '?'];

export class LexError extends Error {
  constructor(msg, col) { super(msg); this.col = col; }
}

export function lex(line) {
  const toks = [];
  let i = 0;
  while (i < line.length) {
    const c = line[i];
    if (c === ' ' || c === '\t') { i++; continue; }
    const rest = line.slice(i);
    let m;
    if (c === '"') {
      m = rest.match(/^"(?:[^"\\\x00-\x1F]|\\["\\n])*"/);
      if (!m) throw new LexError('a text in quotes is not closed (or has a bad \\ escape)', i);
      toks.push({ t: 'str', v: m[0] }); i += m[0].length; continue;
    }
    if ((m = rest.match(/^[0-9][0-9]?:[0-5][0-9](?![0-9A-Za-z_])/))) { toks.push({ t: 'time', v: m[0] }); i += m[0].length; continue; }
    if ((m = rest.match(/^[0-9]+[smhd](?![0-9A-Za-z_])/))) { toks.push({ t: 'dur', v: m[0] }); i += m[0].length; continue; }
    if ((m = rest.match(/^[0-9]+(?:\.[0-9]+)?/))) { toks.push({ t: 'num', v: m[0] }); i += m[0].length; continue; }
    if ((m = rest.match(/^[A-Za-z][A-Za-z0-9_]*/))) {
      const w = m[0];
      if (line[i + w.length] === '(' && FUNCS.has(w + '(')) { toks.push({ t: 'func', v: w + '(' }); i += w.length + 1; continue; }
      toks.push({ t: 'word', v: w }); i += w.length; continue;
    }
    const p = PUNCT.find(p => rest.startsWith(p));
    if (!p) throw new LexError(`the character "${c}" is not part of MoldeScript`, i);
    toks.push({ t: 'p', v: p }); i += p.length;
  }
  // mark unary minus
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k];
    if (t.t !== 'p' || t.v !== '-') continue;
    const prev = toks[k - 1];
    const prevIsValue = prev && (['str', 'time', 'dur', 'num'].includes(prev.t) || (prev.t === 'p' && (prev.v === ')' || prev.v === ']'))
      || (prev.t === 'word' && !TYPE_WORDS.has(prev.v) && (!HARD.has(prev.v) || VALUE_WORDS.has(prev.v))));
    t.unary = !prevIsValue;
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
      const tight = NO_SPACE_BEFORE.has(t.v) && t.t === 'p'
        || (a.t === 'p' && NO_SPACE_AFTER.has(a.v) && !(a.v === '..' && (t.v === '=' || t.t === 'str' || (t.t === 'word' && HARD.has(t.v) && !VALUE_WORDS.has(t.v))))) || a.t === 'func' || (a.t === 'p' && a.v === '-' && a.unary);
      if (!tight) out += ' ';
    }
    out += t.v;
  });
  return out;
}

export function canonical(line) { return join(lex(line)); }
