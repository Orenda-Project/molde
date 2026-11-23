// Loads lang/grammar/moldescript.grammar (GBNF syntax) into rule trees.
// Used by gen-gbnf.mjs (to write moldescript.gbnf) and engine.mjs (to parse lines).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
export const GRAMMAR_PATH = join(here, 'grammar', 'moldescript.grammar');

// Join continuation lines; drop comments and blanks. Returns [{name, body}] in file order.
export function readRules(src = readFileSync(GRAMMAR_PATH, 'utf8')) {
  const out = [];
  for (const raw of src.split('\n')) {
    if (/^\s*#/.test(raw) || !raw.trim()) continue;
    if (/^\s/.test(raw)) {
      if (!out.length) throw new Error('continuation line before any rule');
      out[out.length - 1].body += ' ' + raw.trim();
      continue;
    }
    const m = raw.match(/^([a-zA-Z0-9-]+)\s*::=\s*(.*)$/);
    if (!m) throw new Error('bad grammar line: ' + raw);
    out.push({ name: m[1], body: m[2].trim() });
  }
  return out;
}

// Parse a rule body into a node tree.
// node: {t:'alt',items} {t:'seq',items} {t:'lit',s} {t:'cls',neg,ranges:[[lo,hi]]} {t:'ref',name} {t:'rep',item,min,max}
export function parseBody(body) {
  let i = 0;
  const ws = () => { while (i < body.length && body[i] === ' ') i++; };
  function esc() {
    const c = body[i++];
    if (c !== '\\') return c;
    const d = body[i++];
    if (d === 'n') return '\n';
    if (d === 't') return '\t';
    if (d === 'r') return '\r';
    if (d === 'x') { const h = body.slice(i, i + 2); i += 2; return String.fromCharCode(parseInt(h, 16)); }
    if (d === 'u') { const h = body.slice(i, i + 4); i += 4; return String.fromCharCode(parseInt(h, 16)); }
    return d;
  }
  function alt() {
    const items = [seq()];
    ws();
    while (body[i] === '|') { i++; items.push(seq()); ws(); }
    return items.length === 1 ? items[0] : { t: 'alt', items };
  }
  function seq() {
    const items = [];
    for (;;) {
      ws();
      if (i >= body.length || body[i] === '|' || body[i] === ')') break;
      let a = atom();
      for (;;) {
        const c = body[i];
        if (c === '?') { i++; a = { t: 'rep', item: a, min: 0, max: 1 }; }
        else if (c === '*') { i++; a = { t: 'rep', item: a, min: 0, max: Infinity }; }
        else if (c === '+') { i++; a = { t: 'rep', item: a, min: 1, max: Infinity }; }
        else break;
      }
      items.push(a);
    }
    return items.length === 1 ? items[0] : { t: 'seq', items };
  }
  function atom() {
    const c = body[i];
    if (c === '"') {
      i++; let s = '';
      while (body[i] !== '"') { if (i >= body.length) throw new Error('unterminated literal in ' + body); s += esc(); }
      i++;
      return { t: 'lit', s };
    }
    if (c === '[') {
      i++; let neg = false; const ranges = [];
      if (body[i] === '^') { neg = true; i++; }
      while (body[i] !== ']') {
        const lo = esc();
        if (body[i] === '-' && body[i + 1] !== ']') { i++; const hi = esc(); ranges.push([lo.codePointAt(0), hi.codePointAt(0)]); }
        else ranges.push([lo.codePointAt(0), lo.codePointAt(0)]);
      }
      i++;
      return { t: 'cls', neg, ranges };
    }
    if (c === '(') { i++; const a = alt(); ws(); if (body[i] !== ')') throw new Error('missing ) in ' + body); i++; return a; }
    const m = body.slice(i).match(/^[a-zA-Z0-9-]+/);
    if (!m) throw new Error(`bad atom at ${i} in: ${body}`);
    i += m[0].length;
    return { t: 'ref', name: m[0] };
  }
  const n = alt();
  ws();
  if (i !== body.length) throw new Error(`trailing text at ${i} in: ${body}`);
  return n;
}

export function loadGrammar(src) {
  const rules = readRules(src);
  const map = new Map();
  for (const r of rules) {
    if (map.has(r.name)) throw new Error('duplicate rule ' + r.name);
    map.set(r.name, parseBody(r.body));
  }
  for (const [name, node] of map) walk(node, n => { if (n.t === 'ref' && !map.has(n.name)) throw new Error(`rule ${name} uses undefined ${n.name}`); });
  return { rules, map };
}

export function walk(n, f) {
  f(n);
  if (n.items) n.items.forEach(x => walk(x, f));
  if (n.item) walk(n.item, f);
}

// Every literal in the grammar = the planned single tokens (keywords, operators, punctuation).
export function literals(g) {
  const set = new Set();
  for (const [name, node] of g.map) {
    if (['string', 'time', 'dur', 'number', 'ident', 'word', 'snum', 'sp'].includes(name)) continue;
    walk(node, n => { if (n.t === 'lit') set.add(n.s); });
  }
  return [...set];
}

// Soft keywords: words that only appear where a name cannot, so names may reuse them
// (a field can be called `name`, `date` or `max`). Function words like `sum(` carry their
// bracket, so `sum` alone stays free too.
export const SOFT = new Set(['long', 'num', 'money', 'bool', 'date', 'time', 'when', 'dur',
  'pick', 'ref', 'name', 'src', 'win', 'act',
  'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun', 'tiny', 'small', 'large', 'huge', 'start', 'center', 'end', 'day', 'at']);

// Hard keywords: an ident may never be one of these.
export function keywords(g) {
  const ks = new Set();
  for (const l of literals(g)) if (/^[a-z]+$/.test(l) && !SOFT.has(l)) ks.add(l);
  return ks;
}
