// The 300 coverage programs written by other agents from SPEC.md (migrated with mo.mjs migrate)
// are a regression corpus: each must check, be canonical and GBNF-valid, and run in the
// evaluator without error nodes while its first tappable nodes are tapped and the clock moves.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { check } from '../check.mjs';
import { format } from '../format.mjs';
import { load } from '../eval.mjs';
import { loadGrammar } from '../grammar.mjs';
import { parseText } from '../engine.mjs';
import { GBNF_PATH } from '../gen-gbnf.mjs';
import { LANG } from './lib.mjs';

const D = join(LANG, 'corpus');
const files = readdirSync(D).filter(f => f.endsWith('.mo')).sort();
const G = loadGrammar(readFileSync(GBNF_PATH, 'utf8'));

test('the corpus has 300 programs', () => assert.equal(files.length, 300));

test('every corpus program checks, is canonical and GBNF-valid', () => {
  const bad = [];
  for (const f of files) {
    const src = readFileSync(join(D, f), 'utf8');
    const r = check(src);
    if (!r.ok) bad.push(`${f}: ${r.errors[0]}`);
    else if (format(src) !== src) bad.push(`${f}: not canonical`);
    else if (!parseText(src, ['root'], G).tree) bad.push(`${f}: GBNF rejects`);
  }
  assert.deepEqual(bad, []);
});

test('every corpus program runs in the evaluator (taps and ticks) without error nodes', () => {
  const bad = [];
  for (const f of files) {
    try {
      const a = load(readFileSync(join(D, f), 'utf8'));
      for (let i = 0; i < 8; i++) { const n = a.findAll(x => x.tap)[i]; if (n) a.dispatch(n.id, 'tap'); }
      a.tick(65000);
      const errs = a.findAll(x => x.t === 'error');
      const logErr = a.log.filter(l => l.kind === 'error' && !/needs |no tap on/.test(l.text));
      if (errs.length || logErr.length) bad.push(`${f}: ${JSON.stringify(errs[0] || logErr[0])}`);
    } catch (e) { bad.push(`${f}: threw ${e.message}`); }
  }
  assert.deepEqual(bad, []);
});
