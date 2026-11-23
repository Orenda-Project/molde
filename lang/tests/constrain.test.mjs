// The dynamic name constraint (constrain.mjs):
// (a) it never blocks a valid program: at every name position in the examples and corpus, the
//     name actually written is in the allowed set;
// (a) over all 30 examples and all 300 corpus programs: zero false refusals;
// (b) decoding random choices under it always passes the checker's name rules: each program is
//     re-written left to right, and at every name position a random allowed name is chosen given
//     the text so far (earlier choices included), as a sampler would.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { nameContext, namePositions, tokenMask } from '../constrain.mjs';
import { check } from '../check.mjs';
import { KEYWORDS } from '../engine.mjs';
import { LANG } from './lib.mjs';
import { decodeRandom } from './constrain-lib.mjs';

const NAME_CODES = new Set(['E_UNKNOWN_TABLE', 'E_UNKNOWN_FIELD', 'E_UNKNOWN_NAME', 'E_UNKNOWN_COMPONENT', 'E_REF']);
const progs = (n = 300) => [
  ...readdirSync(join(LANG, 'examples')).filter(f => f.endsWith('.mo')).sort().map(f => ({ f, src: readFileSync(join(LANG, 'examples', f), 'utf8') })),
  ...readdirSync(join(LANG, 'corpus')).filter(f => f.endsWith('.mo')).sort().filter((_, i) => i % Math.ceil(300 / n) === 0).map(f => ({ f: 'corpus/' + f, src: readFileSync(join(LANG, 'corpus', f), 'utf8') })),
];

test('the constraint never blocks the names a valid program uses', () => {
  let n = 0;
  const miss = [];
  for (const { f, src } of progs()) {
    for (const p of namePositions(src)) {
      const ctx = nameContext(src.slice(0, p.at));
      if (ctx.mode !== 'names') continue;
      if (KEYWORDS.has(p.word) && !ctx.names.includes(p.word) && !(src[p.at - 1] === '.' && src[p.at - 2] !== '.')) continue; // used as a keyword here
      n++;
      if (!ctx.names.includes(p.word)) miss.push(`${f}: "${p.word}" not in [${ctx.names.slice(0, 8).join(', ')}] at ${JSON.stringify(src.slice(Math.max(0, p.at - 30), p.at))}`);
    }
  }
  assert.deepEqual(miss.slice(0, 5), []);
  assert.ok(n > 6000, `only ${n} name positions`);
  console.log(`# false refusals: ${miss.length} over ${n} name positions`);
});

test('random decoding under GBNF + the name constraint passes the checker\'s name rules', () => {
  let changed = 0, programs = 0;
  const bad = [];
  for (const { f, src } of progs()) for (const seed of [1]) {
    const r = decodeRandom(src, seed);
    const errs = check(r.out).errors.filter(e => NAME_CODES.has(e.code));
    programs++; changed += r.changed;
    if (errs.length) bad.push(`${f} seed ${seed}: ${errs[0]}`);
  }
  assert.deepEqual(bad.slice(0, 5), []);
  assert.ok(changed > 2000, `only ${changed} names changed over ${programs} programs`);
  console.log(`# random decode: ${programs - bad.length}/${programs} name-clean, ${changed} names changed`);
});

test('tokenMask keeps tokens that continue an allowed name or keyword', () => {
  const vocab = ['ha', 'bit', 'name', 'q', 'zz', ' (', '.', ' +', 'habitx'];
  const m = [...tokenMask('app "H"\ntable habit name text\nstate q num = 1\ntext q + ', vocab)].map(i => vocab[i]);
  assert.ok(m.includes('ha') && m.includes('q') && !m.includes('zz') && !m.includes('habitx'), JSON.stringify(m));
  const m2 = [...tokenMask('app "H"\ntable habit name text\nstate q num = 1\ntext q + ha', vocab)].map(i => vocab[i]);
  assert.ok(m2.includes('bit') && !m2.includes('zz') && !m2.includes(' +'), JSON.stringify(m2));
});

test('a token with a leading space or a word-start marker is masked like the word', () => {
  const src = 'app "N"\ntable note body text\nstate ml num = 0\ntext ';
  const vocab = ['ml', ' ml', 'Ġml', '▁ml', 'zzz', ' zzz', 'Ġzzz', '▁zzz', 'note', ' note', ',', '\n', ' +'];
  const after = t => [...tokenMask(t, vocab)].map(i => vocab[i]);
  const a = after(src); // after a space: no second space, no unknown word
  assert.ok(a.includes('ml') && !a.includes(' ml') && !a.includes('Ġml') && !a.includes('zzz') && !a.includes(' zzz'), JSON.stringify(a));
  const b = after(src.trimEnd()); // no space yet: the boundary token carries it, still checked
  assert.ok(b.includes(' ml') && b.includes('Ġml') && b.includes('▁ml') && !b.includes(' zzz') && !b.includes('Ġzzz') && !b.includes('▁zzz'), JSON.stringify(b));
});

test('tokenMask timing in a decoding loop (151k-token vocabulary)', () => {
  let r = 1; const rnd = () => (r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const al = 'abcdefghijklmnopqrstuvwxyz', vocab = [];
  for (let i = 0; i < 151000; i++) { let w = rnd() < 0.4 ? ' ' : ''; for (let j = 0, n = 1 + Math.floor(rnd() * 7); j < n; j++) w += al[Math.floor(rnd() * 26)]; vocab.push(w); }
  tokenMask('app "x"\n', vocab); // prepareVocab runs once per vocabulary
  const ts = [];
  for (const { src } of progs().filter((_, i) => i % 30 === 0)) {
    for (let at = 3; at < src.length; at += 3) { const t0 = performance.now(); tokenMask(src.slice(0, at), vocab); ts.push(performance.now() - t0); }
  }
  ts.sort((a, b) => a - b);
  const q = x => ts[Math.floor(ts.length * x)].toFixed(2);
  console.log(`# tokenMask per decoding step: n ${ts.length}, median ${q(0.5)} ms, p90 ${q(0.9)} ms, p99 ${q(0.99)} ms`);
  assert.ok(+q(0.5) < 5, 'median step too slow');
});
