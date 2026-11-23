// Dynamic name constraint for decoding. The GBNF cannot know which names exist, so most name
// mistakes pass the grammar and only fail the checker. Given the program text so far, these
// functions say which NAMES may come next. Plain ES module (no Node APIs), like eval.mjs.
//
//   nameContext(textSoFar)  -> { mode: 'free' }                    any word (a new name is being declared,
//                                                                    or the cursor is not at a name position)
//                           -> { mode: 'names', names: [...] }      only these names (keywords are left to the GBNF)
//   allowedWords(textSoFar) -> the names allowed for the word being written, filtered by what is typed of it
//   tokenMask(textSoFar, vocab) -> a Set of vocab indices that keep the current word a prefix of an
//                                  allowed name or keyword (other tokens are left to the GBNF)
//
// How a llama.cpp sampler uses it (see README "Constrained decoding"): keep the GBNF sampler as is;
// at every step call tokenMask(text, vocab) and set the logits of tokens outside the mask to -inf
// before the GBNF sampler runs. The text is only re-scanned per step (lines are short), and the
// expensive part (checking the complete lines above) can be cached per line.
import { check } from './check.mjs';
import { KEYWORDS } from './engine.mjs';
import { ICONS } from './check.mjs';
import { stdDefs } from './expand.mjs';
import { lex } from './lex.mjs';

const PROBE = 'zprobeq';
const WORDCH = /[A-Za-z0-9_]/;

// the part of the program the checker can read: every complete line
function completeLines(text) {
  const i = text.lastIndexOf('\n');
  return { done: text.slice(0, i + 1), line: text.slice(i + 1) };
}

let cache = { key: null, value: null };
function envOf(done) {
  if (cache.key === done) return cache.value;
  const r = check(done || 'app "x"\n');
  const env = r.ast.env || { tables: new Map(), settings: new Map(), states: new Map(), lets: new Map(), screens: new Map(), options: new Set() };
  const defs = [...(r.defs || new Map()).keys()];
  const defMap = new Map([...(r.defs || new Map())].map(([k, v]) => [k, v.def]));
  const value = { env, defs, defMap, ast: r.ast };
  cache = { key: done, value };
  return value;
}

function closers(s) {
  let out = ''; const st = [];
  let inStr = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) { if (c === '\\') i++; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === '(' || c === '[') st.push(c === '(' ? ')' : ']');
    else if ((c === ')' || c === ']') && st.length) st.pop();
  }
  if (inStr) out += '"';
  return out + st.reverse().join('');
}

// Where is the cursor? `text` ends where the next name would start.
export function nameContext(text) {
  const { done, line } = completeLines(text);
  const E = envOf(done);
  const env = E.env;
  const tables = [...env.tables.keys()];
  const body = line.replace(/^ */, '');
  let toks = [];
  try { toks = lex(body); } catch { return { mode: 'free' }; }
  const last = toks[toks.length - 1];
  const prev = last ? last.v : null;
  const first = toks[0] ? toks[0].v : null;
  const fieldsOf = t => { const tb = env.tables.get(t); return tb ? [...tb.fields.keys()] : []; };
  const names = n => ({ mode: 'names', names: [...new Set(n)] });
  // the header line
  if (!done) return first === 'app' && toks.length === 2 ? names([...ICONS]) : { mode: 'free' };
  // nothing yet on the line: a component call, or a text line that starts with a dotted name
  // (it.name ...); statement keywords are left to the GBNF, which also decides what may follow
  if (!toks.length) {
    const probe = check(done + line + 'text ' + PROBE + '\n', { probe: PROBE }).ast.probe;
    const values = probe ? probe.values.concat(probe.tables) : [];
    return { mode: 'names', names: [...new Set([...E.defs, ...values])], groups: { component: [...E.defs], dotted: values } };
  }
  // the values of a component call: the parameter's kind decides
  if (E.defs.includes(first) && (prev === ',' || (toks.length === 1 && /\s$/.test(body)))) {
    const def = E.defMap.get(first);
    const parts = body.slice(first.length).split(',');
    const idx = parts.length - 1;
    const kind = def && def.params[idx] && def.params[idx].kind;
    if (kind === 'table') return names(tables);
    if (kind === 'name') {
      // a field name when an earlier value is a table (quick t, f, ...), else a state or setting
      const ti = def.params.findIndex(p => p.kind === 'table');
      if (ti >= 0 && ti < idx) return names(fieldsOf(parts[ti].trim()));
      return names([...env.states.keys(), ...env.settings.keys()]);
    }
  }
  // declarations: any new name
  if (['table', 'setting', 'state', 'let', 'def', 'screen', 'as', 'was'].includes(prev) && toks.length >= 1) return { mode: 'free' };
  if (first === 'table' && (prev === ',' || (toks.length === 2) || (toks.length === 3 && last.t === 'str'))) return { mode: 'free' };
  if ((first === 'def' || (first === 'let' && body.includes('('))) && (prev === ',' || prev === '(' || (first === 'def' && toks.length === 2))) return { mode: 'free' };
  if (first === 'table' || first === 'setting' || (first === 'state' && prev !== 'new')) {
    if (prev === 'ref') return names(tables);
    return { mode: 'free' }; // types and labels are keywords or texts
  }
  if (prev === 'ref' || prev === 'new' || prev === 'add' || prev === 'options') return names(tables);
  if (prev === 'icon') return names([...ICONS]);
  if (prev === 'go') return names([...env.screens.keys()]);
  if (prev === 'save') return names([...env.states].filter(([, t]) => t && t.t === 'draft').map(([k]) => k).concat(stateNamesInBlocks(E.ast, 'draft')));
  // the field names of an add: add T f = ..., g = ...
  const add = body.match(/\badd ([a-z][a-z0-9_]*)( [a-z][a-z0-9_]* = .*?,)*( |, )$/);
  if (add && (prev === add[1] || prev === ',')) return names([...fieldsOf(add[1]), 'at']);
  // everything else: ask the checker, with a probe name where the cursor is
  const probeLine = line + PROBE + closers(body + PROBE);
  const r = check(done + probeLine + '\n', { probe: PROBE });
  const p = r.ast.probe;
  if (!p) return { mode: 'free' };
  if (p.kind === 'part') {
    // each options T.f: only pick fields
    if (/\boptions [a-z][a-z0-9_]*\.$/.test(body)) { const t = body.match(/\boptions ([a-z][a-z0-9_]*)\.$/)[1]; const tb = env.tables.get(t); return names(tb ? [...tb.fields].filter(([, f]) => f.type.t === 'pick').map(([k]) => k) : []); }
    return names(p.parts);
  }
  // things that are changed or opened: your values (and tables for toggle), never option words
  if (['set', 'field', 'choice', 'slider', 'edit', 'remove'].includes(prev)) return names(p.values);
  if (prev === 'toggle') return names([...p.values, ...p.tables]);
  if (p.mode === 'rows') return names([...p.tables, ...p.values]);
  return names([...p.whereFields, ...p.values, ...p.tables, ...p.options]);
}

function fieldsOfAll(env) { const out = []; for (const tb of env.tables.values()) out.push(...tb.fields.keys()); return out; }

function stateNamesInBlocks(ast, kind) {
  const out = [];
  const walk = s => { if (s.kind === 'state' && (kind !== 'draft' || s.draft)) out.push(s.name); (s.children || []).forEach(walk); };
  (ast?.body || []).forEach(walk);
  return out;
}

// the allowed completions of the word being typed (text may end in the middle of a word)
export function allowedWords(text) {
  let i = text.length;
  while (i > 0 && WORDCH.test(text[i - 1])) i--;
  const partial = text.slice(i);
  if (/^[0-9]/.test(partial)) return { mode: 'free' };
  const ctx = nameContext(text.slice(0, i));
  if (ctx.mode === 'free') return ctx;
  return { mode: 'names', partial, names: ctx.names.filter(n => n.startsWith(partial)) };
}

// For a sampler: which vocabulary entries may come next? Tokens that continue (or start) a word
// must keep it a prefix of an allowed name or of a keyword; tokens that end the word are allowed
// only when the word so far is a complete allowed name or keyword. Other tokens pass (the GBNF
// decides). vocab: an array of token strings (as decoded text).
export function tokenMask(text, vocab) {
  const a = allowedWords(text);
  const all = new Set();
  if (a.mode === 'free') { vocab.forEach((_, i) => all.add(i)); return all; }
  const words = [...a.names, ...[...KEYWORDS].filter(k => k.startsWith(a.partial))];
  const complete = words.includes(a.partial);
  vocab.forEach((tok, i) => {
    const m = tok.match(/^[A-Za-z0-9_]*/)[0];
    if (!m) { if (complete || a.partial === '') all.add(i); return; }     // the token ends the word (or does not start one)
    const w = a.partial + m;
    if (m.length === tok.length) { if (words.some(x => x.startsWith(w))) all.add(i); }     // the word goes on
    else if (words.includes(w)) all.add(i);                                                  // the word ends inside the token
  });
  return all;
}

// Every name position in a program, with the name written there (for tests and data checks).
export function namePositions(src) {
  const out = [];
  const lines = src.split('\n');
  let before = '';
  for (const line of lines) {
    const re = /[a-z][a-z0-9_]*/g; let m;
    while ((m = re.exec(line))) {
      const pre = line.slice(0, m.index);
      if ((pre.split('"').length - 1) % 2 === 1) continue;     // inside a quoted text
      if (m.index > 0 && WORDCH.test(line[m.index - 1])) continue;
      out.push({ at: before.length + m.index, word: m[0], prefix: before + pre });
    }
    before += line + '\n';
  }
  return out;
}

export { PROBE };
