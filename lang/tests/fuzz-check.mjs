// Checker robustness fuzz: random token mutations of every valid program (examples, edits and
// the corpus). Counts (1) crashes: an exception or an E_INTERNAL error from check(); and
// (2) checker-accepts-but-GBNF-rejects: a program the checker passes whose canonical form
// (format(), which the decoding pipeline always applies) the GBNF does not accept.
// Usage: node lang/tests/fuzz-check.mjs [mutations=20000] [seed=12345]
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadGrammar } from '../grammar.mjs';
import { parseText } from '../engine.mjs';
import { check } from '../check.mjs';
import { format } from '../format.mjs';
import { GBNF_PATH } from '../gen-gbnf.mjs';

const LANG = join(dirname(fileURLToPath(import.meta.url)), '..');
export function programs() {
  const out = [];
  const add = d => { if (existsSync(d)) for (const f of readdirSync(d).filter(f => f.endsWith('.mo')).sort()) out.push(readFileSync(join(d, f), 'utf8')); };
  add(join(LANG, 'examples'));
  add(join(LANG, 'examples', 'demo15'));
  add(join(LANG, 'examples', 'lessons'));
  for (const d of readdirSync(join(LANG, 'examples', 'lesson-edits'))) add(join(LANG, 'examples', 'lesson-edits', d));
  for (const d of readdirSync(join(LANG, 'examples', 'edits'))) add(join(LANG, 'examples', 'edits', d));
  add(join(LANG, 'corpus'));
  return out;
}

export function runFuzz(N = 20000, seed = 12345) {
  const G = loadGrammar(readFileSync(GBNF_PATH, 'utf8'));
  const progs = programs();
  let s = seed;
  const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const ri = n => Math.floor(rnd() * n);
  const tok = p => p.match(/"(?:[^"\\]|\\.)*"|[A-Za-z_][A-Za-z0-9_]*|\d+(?:\.\d+)?|\s+|./g);
  const vocab = [...new Set(progs.slice(0, 80).flatMap(p => tok(p)).filter(t => t.trim()))];
  const mutate = p => {
    const t = tok(p); const nt = t.map((x, i) => i).filter(i => t[i].trim());
    const i = nt[ri(nt.length)]; const k = ri(6); const out = t.slice();
    if (k === 0) out.splice(i, 1);
    else if (k === 1) out.splice(i, 0, t[i], ' ');
    else if (k === 2) { const j = nt[Math.min(nt.indexOf(i) + 1, nt.length - 1)]; [out[i], out[j]] = [out[j], out[i]]; }
    else if (k === 3) out[i] = vocab[ri(vocab.length)];
    else if (k === 4) { const ls = p.split('\n'); ls.splice(ri(ls.length), 1); return ls.join('\n'); }
    else { const ls = p.split('\n'); const a = ri(ls.length); ls.splice(ri(ls.length), 0, ls[a]); return ls.join('\n'); }
    return out.join('');
  };
  const r = { mutations: 0, checkerOk: 0, crashes: [], okButGbnfRejects: [], internal: 0 };
  for (let n = 0; n < N; n++) {
    const m = mutate(progs[ri(progs.length)]);
    r.mutations++;
    let c;
    try { c = check(m); } catch (e) { r.crashes.push(String(e.stack).split('\n').slice(0, 2).join(' ')); continue; }
    if (c.errors.some(e => e.code === 'E_INTERNAL')) { r.internal++; r.crashes.push(c.errors.find(e => e.code === 'E_INTERNAL').msg + ' :: ' + m.slice(0, 200)); continue; }
    if (c.ok) {
      r.checkerOk++;
      const f = format(m);
      if (!parseText(f, ['root'], G).tree) r.okButGbnfRejects.push(f.slice(0, 300));
    }
  }
  return r;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const t0 = Date.now();
  const r = runFuzz(+(process.argv[2] || 20000), +(process.argv[3] || 12345));
  console.log(JSON.stringify({ mutations: r.mutations, checkerOk: r.checkerOk, crashes: r.crashes.length, okButGbnfRejects: r.okButGbnfRejects.length, crashSamples: [...new Set(r.crashes)].slice(0, 5), gbnfSamples: r.okButGbnfRejects.slice(0, 3), ms: Date.now() - t0 }, null, 1));
  process.exit(r.crashes.length || r.okButGbnfRejects.length ? 1 : 0);
}
