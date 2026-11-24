// Canonical formatter: two spaces per indentation level, single spaces between tokens with
// fixed exceptions (see lex.mjs join), no blank lines, comments kept, one final newline.
// It also writes the ONE spelling of things that can be written two ways:
//   text "x" ...            ->  "x" ...           (a line starting with a text, formula or name is a text line,
//                                                 unless the name is a component: text list stays)
//   sumof(t, x) -> sum(t, x)   countof -> count   maxof -> max   minof -> min
//   size tiny -> tiny (sizes are bare words)   huge bold -> big   large bold -> head   small color muted -> faint
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
  // folds are written with the aggregate's name: sumof( -> sum(, countof( -> count(, maxof( -> max(, minof( -> min(
  const FOLD = { 'sumof(': 'sum(', 'countof(': 'count(', 'maxof(': 'max(', 'minof(': 'min(' };
  toks = toks.map(t => t.t === 'func' && FOLD[t.v] ? { ...t, v: FOLD[t.v], known: true } : t);
  // numbers are formatted by the phone: compact(x) and grouped(x) are just (x); monthshort( is monthname(
  toks = toks.map(t => t.t !== 'func' ? t : t.v === 'compact(' || t.v === 'grouped(' ? { t: 'p', v: '(' } : t.v === 'monthshort(' ? { ...t, v: 'monthname(', known: true } : t);
  // style: `size X` is written X; the three roles replace their spelled-out forms
  const SIZES = new Set(['tiny', 'small', 'large', 'huge']);
  toks = toks.filter((t, i) => !(t.t === 'word' && t.v === 'size' && toks[i + 1] && SIZES.has(toks[i + 1].v)));
  const out = [];
  for (let i = 0; i < toks.length; i++) {
    const v = k => toks[i + k] && toks[i + k].t === 'word' ? toks[i + k].v : null;
    const role = (a, b, r) => { if ((v(0) === a && v(1) === b) || (v(0) === b && v(1) === a)) { out.push({ ...toks[i], v: r }); i += 1; return true; } return false; };
    if (role('huge', 'bold', 'big') || role('large', 'bold', 'head')) continue;
    if ((v(0) === 'small' && v(1) === 'color' && v(2) === 'muted') || (v(0) === 'color' && v(1) === 'muted' && v(2) === 'small')) { out.push({ ...toks[i], v: 'faint' }); i += 2; continue; }
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
  // ring was the round goal: one way to show a goal. log SRC is list SRC by day.
  if (out[0] && out[0].t === 'word' && !comps.own.has(out[0].v) && (out[1] && out[1].t !== 'p')) {
    if (out[0].v === 'ring') out[0] = { ...out[0], v: 'goal' };
    else if (out[0].v === 'log') {
      out[0] = { ...out[0], v: 'list' };
      let d = 0;
      let j = out.findIndex((t, i) => { if (t.t === 'func' || t.v === '(' || t.v === '[') d++; else if (t.v === ')' || t.v === ']') d--; return i > 0 && d === 0 && ((t.t === 'p' && t.v === ',') || (t.t === 'word' && ['sort', 'top', 'shuffle', 'tap', 'swipe'].includes(t.v))); });
      if (j < 0) j = out.length;
      out.splice(j, 0, { t: 'word', v: 'by' }, { t: 'word', v: 'day' });
    }
  }
  // implicit text line
  if (out[0] && out[0].t === 'word' && out[0].v === 'text' && out[1] && (out[1].t === 'str' || out[1].t === 'num' || (out[1].t === 'func' && out[1].known) || out[1].v === '('
    || (out[1].t === 'word' && out[2] && out[2].v === '.' && !STMT_WORDS.has(out[1].v)) // text lesson.title keeps its text: lesson starts a statement
    || (out[1].t === 'word' && /^[a-z][a-z0-9_]*$/.test(out[1].v) && (out[1].v === 'it' || !RESERVED.has(out[1].v)) && !STMT_WORDS.has(out[1].v) && !comps.has(out[1].v)))) out.shift();
  return out;
}

export function format(src) {
  const { lines } = splitLines(src);
  const opts = declaredOptions(lines);
  const comps = componentNames(src);
  comps.own = new Set([...src.matchAll(/^\s*def ([a-z][a-z0-9_]*)/gm)].map(m => m[1])); // the program's own defs win over these rewrites
  const out = [];
  for (const ln of lines) {
    if (ln.comment) { out.push(ln.comment); continue; }
    let body;
    try { body = join(rewrite(lex(ln.body), opts, comps)); } catch { body = ln.body; }
    out.push('  '.repeat(ln.depth) + body);
  }
  return out.join('\n') + '\n';
}

// The stored form of a program: canonical, with every `was OLD` removed. `was` is an instruction
// for one edit only (rename the slot the previous program calls OLD); once applied, the stored text
// and every later version are written without it, so nothing is ever renamed twice.
export function strip(src) {
  const { lines } = splitLines(src);
  const out = [];
  for (const ln of lines) {
    if (ln.comment) { out.push('  '.repeat(ln.depth || 0) + ln.comment); continue; }
    let toks; try { toks = lex(ln.body); } catch { out.push('  '.repeat(ln.depth) + ln.body); continue; }
    const kept = toks.filter((t, i) => !(t.t === 'word' && t.v === 'was' && toks[i + 1] && toks[i + 1].t === 'word') && !(i > 0 && toks[i - 1].t === 'word' && toks[i - 1].v === 'was' && t.t === 'word'));
    out.push('  '.repeat(ln.depth) + join(kept));
  }
  return format(out.join('\n') + '\n');
}
