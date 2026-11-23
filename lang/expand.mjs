// Component expansion. A `def` is a typed macro: a call substitutes its arguments (by name,
// as text) into the def's lines, renames the def's own `state` names so two uses never share
// state, puts the call's indented lines where the def says `slot`, and parses the result.
// After expansion only level-1 statements remain; the checker then checks them.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parse, MoError } from './parse.mjs';
import { lex, join as joinToks } from './lex.mjs';

const here = dirname(fileURLToPath(import.meta.url));
export const STD_DIR = join(here, 'std');
export const VALUE_KINDS = new Set(['num', 'money', 'text', 'bool', 'date', 'time', 'dur', 'color', 'icon']);

// Re-create a def's body as text lines relative to the def.
function bodyLines(def) {
  const out = [];
  const walk = (n, d) => {
    out.push({ text: '  '.repeat(d) + n.src, line: n.line, node: n });
    for (const c of n.children || []) walk(c, d + 1);
  };
  for (const c of def.children) walk(c, 0);
  return out;
}

function docOf(src) {
  const docs = {};
  const lines = src.split('\n');
  lines.forEach((l, i) => {
    const m = l.match(/^def ([a-z][a-z0-9_]*)/);
    if (m) {
      const prev = lines[i - 1] || '';
      const d = prev.match(/^# describe: (.*)$/);
      if (d) docs[m[1]] = d[1];
    }
  });
  return docs;
}

let STD = null;
export function stdDefs() {
  if (STD) return STD;
  STD = new Map();
  for (const f of readdirSync(STD_DIR).filter(f => f.endsWith('.mo')).sort()) {
    const src = readFileSync(join(STD_DIR, f), 'utf8');
    const p = parse(src, { lib: true });
    if (p.errors.length) throw new Error(`std/${f}: ` + p.errors.map(String).join('; '));
    const docs = docOf(src);
    for (const d of p.body) if (d.kind === 'def') STD.set(d.name, { def: d, file: f, doc: docs[d.name] || null, std: true });
  }
  return STD;
}

function localStates(def) {
  const names = [];
  const walk = n => { if (n.kind === 'state') names.push(n.name); (n.children || []).forEach(walk); };
  def.children.forEach(walk);
  return names;
}

let counter = 0;

// Expand every call in a statement list. defs: Map name -> {def, doc, std}. Returns new list.
export function expandList(list, defs, errors, stack = []) {
  const out = [];
  for (const st of list) {
    if (st.kind === 'def') {
      if (defs.has(st.name)) errors.push(new MoError('E_DUP', st.line, `a component named "${st.name}" already exists${defs.get(st.name).std ? ' in the standard library' : ''}.`, 'use another name.'));
      else defs.set(st.name, { def: st, doc: null, std: false });
      out.push(st); // kept for describe; its body is checked when used
      continue;
    }
    if (st.kind === 'call') { const u = expandCall(st, defs, errors, stack); if (u) out.push(u); continue; }
    if (st.children) st.children = expandList(st.children, defs, errors, stack);
    out.push(st);
  }
  return out;
}

function expandCall(call, defs, errors, stack) {
  const err = (code, msg, hint) => { errors.push(new MoError(code, call.line, msg, hint)); return null; };
  const entry = defs.get(call.name);
  if (!entry) {
    const names = [...defs.keys()].join(', ');
    return err('E_UNKNOWN_COMPONENT', `there is no component (or statement) called "${call.name}".`, `use a statement from SPEC.md or one of: ${names}.`);
  }
  if (stack.includes(call.name)) return err('E_RECURSION', `component "${call.name}" uses itself.`, 'a component cannot contain itself; repeat with each instead.');
  if (stack.length >= 8) return err('E_RECURSION', 'components nest more than 8 deep.', 'flatten the components.');
  const { def } = entry;
  if (call.args.length > def.params.length) return err('E_ARGS', `"${call.name}" takes ${def.params.length} value(s) (${def.params.map(p => p.name).join(', ')}) but got ${call.args.length}.`, 'remove the extra values.');
  const subst = new Map();
  for (let i = 0; i < def.params.length; i++) {
    const p = def.params[i];
    let a = call.args[i];
    if (a === undefined) {
      if (p.dflt === null) return err('E_ARGS', `"${call.name}" needs a value for ${p.name} (${p.kind}).`, `write: ${call.name} ${def.params.map(q => q.name).join(', ')}`);
      a = p.dflt;
    }
    let toks = lex(a);
    if ((p.kind === 'table' || p.kind === 'name') && !(toks.length === 1 && toks[0].t === 'word')) return err('E_KIND', `"${call.name}" expects a ${p.kind === 'table' ? 'table' : 'name'} for ${p.name}, got "${a}".`, 'pass a single name.');
    if (VALUE_KINDS.has(p.kind) && toks.length > 1) toks = [{ t: 'p', v: '(' }, ...toks, { t: 'p', v: ')' }];
    subst.set(p.name, toks);
  }
  const n = ++counter;
  for (const s of localStates(def)) subst.set(s, [{ t: 'word', v: `${s}_${n}` }]);
  const lines = bodyLines(def);
  const text = ['app "x"'];
  for (const l of lines) {
    const ind = l.text.match(/^ */)[0];
    const toks = lex(l.text.trim()).flatMap(t => (t.t === 'word' && subst.has(t.v)) ? subst.get(t.v) : [t]);
    text.push(ind + joinToks(toks));
  }
  const frag = parse(text.join('\n') + '\n');
  for (const e of frag.errors) {
    const dl = lines[e.line - 2];
    errors.push(new MoError(e.code, call.line, `inside "${call.name}"${dl ? ` (its line "${dl.text.trim()}")` : ''}: ${e.msg}`, e.hint));
  }
  if (frag.errors.length) return null;
  const fill = list => list.flatMap(s => {
    if (s.kind === 'slot') return call.children || [];
    if (s.children) s.children = fill(s.children);
    return [s];
  });
  const setLine = s => { s.line = call.line; s.via = call.name; (s.children || []).forEach(setLine); };
  frag.body.forEach(setLine);
  let body = fill(frag.body);
  body = expandList(body, defs, errors, [...stack, call.name]);
  return { kind: 'use', name: call.name, args: call.args, line: call.line, src: call.src, std: entry.std, children: body };
}

export function expandProgram(prog) {
  counter = 0; // deterministic names per program
  const defs = new Map(stdDefs());
  const errors = [];
  prog.body = expandList(prog.body, defs, errors);
  return { defs, errors };
}
