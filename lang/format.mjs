// Canonical formatter: two spaces per indentation level, single spaces between tokens with
// fixed exceptions (see lex.mjs join), no blank lines, comments kept, one final newline.
// It also writes the ONE spelling of things that can be written two ways:
//   text "x" ...            ->  "x" ...           (a line starting with a text, formula or name is a text line,
//                                                 unless the name is a component: text list stays)
//   size huge bold          ->  big     size large bold -> head     size small color muted -> faint
//   = "Food" (a pick option) -> = Food  (option values are written bare, as in their declaration)
//   pick "Eating out"|...   ->  pick Eating_out|... (an underscore shows as a space)
//   setting goal num "Goal" ->  setting goal num   (a label that repeats the name is the default label)
// The output is exactly the text the GBNF accepts, and format(format(x)) === format(x).
import { splitLines, componentNames, STMT_WORDS } from './parse.mjs';
import { RESERVED } from './engine.mjs';
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

function rewrite(toks, opts, comps) {
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
  // a label that only repeats the name is the default label: drop it (setting goal ... "Goal")
  if (out[0] && out[0].t === 'word' && (out[0].v === 'setting' || out[0].v === 'table')) {
    const dflt = n => n.replace(/_/g, ' ').toLowerCase();
    let start = out[0].v === 'setting' ? 1 : 2; // where the first field starts
    if (out[0].v === 'table') { while (out[start] && (out[start].v === 'was' || out[start - 1].v === 'was')) start++; if (out[start] && out[start].t === 'str') start++; }
    for (let i = start, fieldName = out[start] && out[start].v; i < out.length; i++) {
      const t = out[i];
      if (t.v === ',' && t.t === 'p') { fieldName = out[i + 1] && out[i + 1].v; continue; }
      if (t.t === 'str' && i > start && !['unit', '=', '|', 'pick'].includes(out[i - 1].v) && !(out[i + 1] && out[i + 1].v === '|') && fieldName && JSON.parse(t.v).toLowerCase() === dflt(fieldName)) { out.splice(i, 1); i--; }
    }
  }
  // implicit text line
  if (out[0] && out[0].t === 'word' && out[0].v === 'text' && out[1] && (out[1].t === 'str' || out[1].t === 'num' || (out[1].t === 'func' && out[1].known) || out[1].v === '('
    || (out[1].t === 'word' && out[2] && out[2].v === '.')
    || (out[1].t === 'word' && /^[a-z][a-z0-9_]*$/.test(out[1].v) && (out[1].v === 'it' || !RESERVED.has(out[1].v)) && !STMT_WORDS.has(out[1].v) && !comps.has(out[1].v)))) out.shift();
  return out;
}

export function format(src) {
  const { lines } = splitLines(src);
  const opts = declaredOptions(lines);
  const comps = componentNames(src);
  const out = [];
  for (const ln of lines) {
    if (ln.comment) { out.push(ln.comment); continue; }
    let body;
    try { body = join(rewrite(lex(ln.body), opts, comps)); } catch { body = ln.body; }
    out.push('  '.repeat(ln.depth) + body);
  }
  return out.join('\n') + '\n';
}
