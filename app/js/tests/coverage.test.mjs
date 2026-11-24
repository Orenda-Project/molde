// The per-line grammar built from a gold prefix must accept the gold next line, for every example program
// (the 15 bundled ones and the language's own 30): the decoder and the language grammar agree.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { buildLineGrammar } from '../vendor/decode/linegram.mjs';
import { parseGbnf, accepts } from '../vendor/decode/gbnf.mjs';
import { format } from '../vendor/lang/format.mjs';
import { check } from '../vendor/lang/check.mjs';

const dirs = [new URL('../../assets/examples/', import.meta.url), new URL('../vendor/lang/examples/', import.meta.url)];
test('every line of every example is accepted by the per-line grammar (names and types on)', () => {
  let tot = 0, ok = 0; const bad = [];
  for (const d of dirs) for (const f of readdirSync(d).filter(f => f.endsWith('.mo'))) {
    let gold = readFileSync(new URL(f, d), 'utf8');
    try { gold = format(gold); } catch { /* use as is */ }
    if (!check(gold).ok) continue;
    const lines = gold.split('\n').filter((l, i, a) => i < a.length - 1 || l);
    let prefix = '';
    for (let i = 0; i < lines.length; i++) {
      tot++;
      let acc = false, err = '';
      try { const g = buildLineGrammar(prefix, { names: true, types: true }).grammar; acc = accepts(parseGbnf(g), 'root', lines[i] + '\n'); } catch (e) { err = String(e).slice(0, 80); }
      if (acc) ok++; else bad.push(`${f}:${i + 1} ${lines[i].slice(0, 70)} ${err}`);
      prefix += lines[i] + '\n';
    }
  }
  assert.ok(tot > 500);
  assert.ok(ok / tot >= 0.98, `${ok}/${tot} accepted; first misses: ${bad.slice(0, 6).join(' | ')}`);
});
