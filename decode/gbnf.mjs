// A small GBNF recognizer (Earley, character level) used ONLY to test grammars offline:
// does the per-line grammar accept the reference program's next line? (no llama.cpp needed)
//   const g = parseGbnf(text);  accepts(g, 'root', 'app "x"\n')  -> true/false
export function parseGbnf(text) {
  const rules = new Map(); // name -> alternatives: array of symbol arrays; symbol = {t:'nt',n} | {t:'cc',neg,ranges}
  let aux = 0;
  const lines = text.split('\n').filter(l => l.trim() && !l.startsWith('#'));
  for (const l of lines) {
    const m = l.match(/^([A-Za-z0-9-]+) ::= (.*)$/);
    if (!m) throw new Error('bad rule line: ' + l.slice(0, 80));
    const toks = lex(m[2]);
    let p = 0;
    const newAux = () => 'aux' + (aux++);
    const parseAlt = () => { const alts = [parseSeq()]; while (toks[p] && toks[p].k === '|') { p++; alts.push(parseSeq()); } return alts; };
    const parseSeq = () => {
      const seq = [];
      while (p < toks.length && toks[p].k !== '|' && toks[p].k !== ')') {
        let sym = parseAtom();
        while (toks[p] && (toks[p].k === '?' || toks[p].k === '*' || toks[p].k === '+')) {
          const op = toks[p++].k, n = newAux();
          if (op === '?') rules.set(n, [[sym], []]);
          else if (op === '*') rules.set(n, [[sym, { t: 'nt', n }], []]);
          else rules.set(n, [[sym, { t: 'nt', n }], [sym]]);
          sym = { t: 'nt', n };
        }
        seq.push(sym);
      }
      return seq;
    };
    const parseAtom = () => {
      const t = toks[p++];
      if (t.k === 'lit') { const n = newAux(); rules.set(n, [[...t.v].map(ch => ({ t: 'cc', neg: false, ranges: [[ch, ch]] }))]); return { t: 'nt', n }; }
      if (t.k === 'cc') return { t: 'cc', neg: t.neg, ranges: t.ranges };
      if (t.k === 'name') return { t: 'nt', n: t.v };
      if (t.k === '(') { const alts = parseAlt(); if (toks[p++].k !== ')') throw new Error('missing )'); const n = newAux(); rules.set(n, alts); return { t: 'nt', n }; }
      throw new Error('unexpected token ' + JSON.stringify(t) + ' in ' + l.slice(0, 80));
    };
    const alts = parseAlt();
    if (p !== toks.length) throw new Error('trailing tokens in ' + l.slice(0, 80));
    rules.set(m[1], alts);
  }
  // a literal like "" is an empty sequence
  return rules;
}
function unesc(s, i) { // returns [char, newIndex]
  if (s[i] !== '\\') return [s[i], i + 1];
  const c = s[i + 1];
  if (c === 'x') return [String.fromCharCode(parseInt(s.slice(i + 2, i + 4), 16)), i + 4];
  if (c === 'n') return ['\n', i + 2];
  if (c === 't') return ['\t', i + 2];
  if (c === 'r') return ['\r', i + 2];
  return [c, i + 2];
}
function lex(s) {
  const out = []; let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === ' ') { i++; continue; }
    if (c === '"') { let v = ''; i++; while (s[i] !== '"') { const [ch, j] = unesc(s, i); v += ch; i = j; } i++; out.push({ k: 'lit', v }); continue; }
    if (c === '[') {
      i++; let neg = false; if (s[i] === '^') { neg = true; i++; }
      const ranges = [];
      while (s[i] !== ']') { const [a, j] = unesc(s, i); i = j; if (s[i] === '-' && s[i + 1] !== ']') { const [b, j2] = unesc(s, i + 1); i = j2; ranges.push([a, b]); } else ranges.push([a, a]); }
      i++; out.push({ k: 'cc', neg, ranges }); continue;
    }
    if ('()|?*+'.includes(c)) { out.push({ k: c }); i++; continue; }
    const m = s.slice(i).match(/^[A-Za-z0-9-]+/);
    if (!m) throw new Error('lex error at ' + s.slice(i, i + 20));
    out.push({ k: 'name', v: m[0] }); i += m[0].length;
  }
  return out;
}
const inCc = (sym, ch) => { const hit = sym.ranges.some(([a, b]) => ch >= a && ch <= b); return sym.neg ? !hit : hit; };

// nullable set
function nullables(rules) {
  const nul = new Set(); let ch = true;
  while (ch) { ch = false; for (const [n, alts] of rules) { if (nul.has(n)) continue; if (alts.some(a => a.every(s => s.t === 'nt' && nul.has(s.n)))) { nul.add(n); ch = true; } } }
  return nul;
}
const NUL = new WeakMap();
export function accepts(rules, start, str) {
  if (!NUL.has(rules)) NUL.set(rules, nullables(rules));
  const nul = NUL.get(rules);
  // items: [rule, altIndex, dot, origin]; chart[i] = Map key -> item
  const N = str.length;
  const chart = Array.from({ length: N + 1 }, () => new Map());
  const queue = Array.from({ length: N + 1 }, () => []);
  const add = (i, it) => { const k = it[0] + '|' + it[1] + '|' + it[2] + '|' + it[3]; if (!chart[i].has(k)) { chart[i].set(k, it); queue[i].push(it); } };
  const completedAt = Array.from({ length: N + 1 }, () => new Map()); // nt -> origins completed at i
  for (let a = 0; a < rules.get(start).length; a++) add(0, [start, a, 0, 0]);
  for (let i = 0; i <= N; i++) {
    const waiting = new Map(); // nt -> items waiting at position i for nt
    for (let qi = 0; qi < queue[i].length; qi++) {
      const [r, a, d, o] = queue[i][qi];
      const alt = rules.get(r)[a];
      if (d === alt.length) {
        // complete
        if (!completedAt[i].has(r)) completedAt[i].set(r, new Set());
        completedAt[i].get(r).add(o);
        for (const w of chart[o].values()) { const al = rules.get(w[0])[w[1]]; const s = al[w[2]]; if (s && s.t === 'nt' && s.n === r) add(i, [w[0], w[1], w[2] + 1, w[3]]); }
        continue;
      }
      const s = alt[d];
      if (s.t === 'nt') {
        if (!rules.has(s.n)) throw new Error('undefined rule ' + s.n);
        for (let b = 0; b < rules.get(s.n).length; b++) add(i, [s.n, b, 0, i]);
        // nullable shortcut / already-completed at this position
        if (nul.has(s.n) || (completedAt[i].get(s.n) || new Set()).has(i)) add(i, [r, a, d + 1, o]);
      } else if (i < N && inCc(s, str[i])) add(i + 1, [r, a, d + 1, o]);
    }
  }
  for (const it of chart[N].values()) if (it[0] === start && it[2] === rules.get(start)[it[1]].length && it[3] === 0) return true;
  return false;
}
