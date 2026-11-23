// Canonical formatter: two spaces per indentation level, single spaces between tokens with
// fixed exceptions (see lex.mjs join), no blank lines, comments kept, one final newline.
// It also writes the ONE spelling of things that can be written two ways:
//   text "x" ...            ->  "x" ...           (a line starting with a text, formula or dotted name is a text line)
//   size huge bold          ->  big     size large bold -> head     size small color muted -> faint
//   = "Food" (a pick option) -> = Food  (option values are written bare, as in their declaration)
//   pick "Eating out"|...   ->  pick Eating_out|... (an underscore shows as a space)
// The output is exactly the text the GBNF accepts, and format(format(x)) === format(x).
import { splitLines } from './parse.mjs';
import { lex, join } from './lex.mjs';

const WORD = /^[A-Za-z][A-Za-z0-9_]*$/;
const asWord = s => s.replace(/ /g, '_');

// option texts declared in the program (after `pick` and between `|`)
function declaredOptions(lines) {
  const opts = new Set();
  for (const ln of lines) {
    if (ln.comment) continue;
    let toks; try { toks = lex(ln.body); } catch { continue; }
    toks.forEach((t, i) => {
      const prev = toks[i - 1], next = toks[i + 1];
      const inPick = (prev && (prev.v === 'pick' || prev.v === '|')) || (next && next.v === '|');
      if (inPick && (t.t === 'str' || t.t === 'word')) {
        const v = t.t === 'str' ? JSON.parse(t.v) : t.v;
        if (WORD.test(asWord(v))) opts.add(v);
      }
    });
  }
  return opts;
}

function rewrite(toks, opts) {
  // option values: bare words in declarations and after = or !=
  toks = toks.map((t, i) => {
    if (t.t !== 'str') return t;
    const v = JSON.parse(t.v);
    if (!opts.has(v)) return t;
    const prev = toks[i - 1], next = toks[i + 1];
    const ctx = (prev && ['pick', '|', '=', '!='].includes(prev.v)) || (next && next.v === '|');
    return ctx ? { ...t, t: 'word', v: asWord(v) } : t;
  });
  // style roles
  const out = [];
  for (let i = 0; i < toks.length; i++) {
    const v = k => toks[i + k] && toks[i + k].t === 'word' ? toks[i + k].v : null;
    if (v(0) === 'size' && v(1) === 'huge' && v(2) === 'bold') { out.push({ ...toks[i], v: 'big' }); i += 2; continue; }
    if (v(0) === 'bold' && v(1) === 'size' && v(2) === 'huge') { out.push({ ...toks[i], v: 'big' }); i += 2; continue; }
    if (v(0) === 'size' && v(1) === 'large' && v(2) === 'bold') { out.push({ ...toks[i], v: 'head' }); i += 2; continue; }
    if (v(0) === 'bold' && v(1) === 'size' && v(2) === 'large') { out.push({ ...toks[i], v: 'head' }); i += 2; continue; }
    if (v(0) === 'size' && v(1) === 'small' && v(2) === 'color' && v(3) === 'muted') { out.push({ ...toks[i], v: 'faint' }); i += 3; continue; }
    if (v(0) === 'color' && v(1) === 'muted' && v(2) === 'size' && v(3) === 'small') { out.push({ ...toks[i], v: 'faint' }); i += 3; continue; }
    out.push(toks[i]);
  }
  // implicit text line
  if (out[0] && out[0].t === 'word' && out[0].v === 'text' && out[1] && (out[1].t === 'str' || out[1].t === 'num' || (out[1].t === 'func' && out[1].known) || out[1].v === '('
    || (out[1].t === 'word' && out[2] && out[2].v === '.'))) out.shift();
  return out;
}

export function format(src) {
  const { lines } = splitLines(src);
  const opts = declaredOptions(lines);
  const out = [];
  for (const ln of lines) {
    if (ln.comment) { out.push(ln.comment); continue; }
    let body;
    try { body = join(rewrite(lex(ln.body), opts)); } catch { body = ln.body; }
    out.push('  '.repeat(ln.depth) + body);
  }
  return out.join('\n') + '\n';
}
