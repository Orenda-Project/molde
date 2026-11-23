// A small parser that runs the grammar in lang/grammar/moldescript.grammar directly.
// It explores every alternative (memoised per rule and position), keeps the first tree for each
// end position, and prefers longer repetitions and present optionals. A line parses when some
// tree ends exactly at the end of the line.
import { loadGrammar, keywords } from './grammar.mjs';

const G = loadGrammar();
export const KEYWORDS = keywords(G);
const IDCH = /[A-Za-z0-9_]/;

// Terminals matched by regex. Same character sets as the grammar file, plus:
// ident is never a keyword; nothing runs into a following letter or digit.
const TERMINALS = {
  ident: /[a-z][a-z0-9_]*/y,
  word: /[A-Za-z][A-Za-z0-9_]*/y,
  number: /[0-9]+(?:\.[0-9]+)?/y,
  string: /"(?:[^"\\\x00-\x1F]|\\["\\n])*"/y,
  time: /[0-9][0-9]?:[0-5][0-9]/y,
  dur: /[0-9]+[smhd]/y,
};

function term(name, text, pos) {
  const re = TERMINALS[name];
  re.lastIndex = pos;
  const m = re.exec(text);
  if (!m) return null;
  const end = pos + m[0].length;
  if (name !== 'string' && end < text.length && IDCH.test(text[end])) return null;
  if (name === 'ident' && KEYWORDS.has(m[0])) return null;
  return { r: name, s: pos, e: end, v: m[0] };
}

const SILENT = new Set(['sp']);

export function parseText(text, startNames, g = G) {
  const memo = new Map();
  let far = 0;
  const expected = new Set();
  const fail = (pos, what) => {
    if (pos > far) { far = pos; expected.clear(); }
    if (pos === far) expected.add(what);
  };

  function dedupe(list) {
    const seen = new Set(); const out = [];
    for (const x of list) if (!seen.has(x.end)) { seen.add(x.end); out.push(x); }
    return out;
  }

  function m(node, pos) {
    switch (node.t) {
      case 'lit': {
        if (text.startsWith(node.s, pos)) {
          const end = pos + node.s.length;
          if (IDCH.test(node.s[node.s.length - 1]) && end < text.length && IDCH.test(text[end])) { fail(pos, JSON.stringify(node.s)); return []; }
          return [{ end, kids: node.s === ' ' ? [] : [{ lit: node.s, s: pos, e: end }] }];
        }
        fail(pos, JSON.stringify(node.s));
        return [];
      }
      case 'cls': {
        if (pos >= text.length) { fail(pos, 'a character'); return []; }
        const cp = text.codePointAt(pos);
        let hit = node.ranges.some(([lo, hi]) => cp >= lo && cp <= hi);
        if (node.neg) hit = !hit;
        if (!hit) { fail(pos, 'a character'); return []; }
        return [{ end: pos + (cp > 0xffff ? 2 : 1), kids: [] }];
      }
      case 'ref': return ref(node.name, pos);
      case 'seq': {
        let cur = [{ end: pos, kids: [] }];
        for (const it of node.items) {
          const next = [];
          for (const c of cur) for (const x of m(it, c.end)) next.push({ end: x.end, kids: c.kids.concat(x.kids) });
          cur = dedupe(next);
          if (!cur.length) return [];
        }
        return cur;
      }
      case 'alt': {
        const all = [];
        for (const it of node.items) all.push(...m(it, pos));
        return dedupe(all);
      }
      case 'rep': {
        const levels = [];
        if (node.min === 0) levels.push([{ end: pos, kids: [] }]);
        let cur = [{ end: pos, kids: [] }];
        for (let n = 1; n <= node.max; n++) {
          const next = [];
          for (const c of cur) for (const x of m(node.item, c.end)) if (x.end > c.end) next.push({ end: x.end, kids: c.kids.concat(x.kids) });
          cur = dedupe(next);
          if (!cur.length) break;
          if (n >= node.min) levels.push(cur);
        }
        return dedupe(levels.reverse().flat());
      }
    }
    throw new Error('bad node ' + node.t);
  }

  function ref(name, pos) {
    const key = name + '@' + pos;
    if (memo.has(key)) return memo.get(key);
    let res;
    if (TERMINALS[name]) {
      const t = term(name, text, pos);
      if (!t) fail(pos, name === 'ident' ? 'a name' : name);
      res = t ? [{ end: t.e, kids: [t] }] : [];
    } else {
      memo.set(key, []); // guards accidental left recursion
      const inner = m(g.map.get(name), pos);
      res = SILENT.has(name) ? inner : inner.map(x => ({ end: x.end, kids: [{ r: name, s: pos, e: x.end, k: x.kids }] }));
    }
    memo.set(key, res);
    return res;
  }

  for (const start of startNames) {
    const hit = ref(start, 0).find(x => x.end === text.length);
    if (hit) return { tree: hit.kids[0] };
  }
  return { tree: null, far, expected: [...expected] };
}

// ---- tree helpers ----
export const kids = n => n.k || [];
export function child(n, r) { return kids(n).find(k => k.r === r); }
export function children(n, r) { return kids(n).filter(k => k.r === r); }
export function hasLit(n, s) { return kids(n).some(k => k.lit === s); }
export function firstLit(n) { const k = kids(n).find(k => k.lit !== undefined); return k ? k.lit : undefined; }
export function lits(n) { return kids(n).filter(k => k.lit !== undefined).map(k => k.lit); }
export function textOf(n, src) { return src.slice(n.s, n.e); }
