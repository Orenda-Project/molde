// Gold-coverage test: for each line of each reference program, does the per-line grammar (built from the gold prefix) accept the gold line?
import { readFileSync } from 'node:fs';
import { buildLineGrammar, STATIC_RULES } from './linegram.mjs';
import { parseGbnf, accepts } from './gbnf.mjs';
import { format } from '../lang/format.mjs';
import { check } from '../lang/check.mjs';
const DATA = '/tmp/molde-p2/train/data/out-r1'; const rd = s => s.startsWith('/') ? s : DATA + '/' + s + '.jsonl';
const sets = process.argv.slice(2).length ? process.argv.slice(2) : ['test_refs', 'templ_refs'];
const names = process.env.NAMES !== '0';
let tot = 0, ok = 0, progs = 0, fullOk = 0; const bad = [];
for (const s of sets) {
  const refs = readFileSync(rd(s), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
  for (const r of refs) {
    let gold; try { gold = format(r.ref); } catch { gold = r.ref; }
    if (!gold.endsWith('\n')) gold += '\n';
    if (!check(gold).ok) continue; // only programs the checker accepts
    progs++;
    const lines = gold.split('\n').slice(0, -1);
    let prefix = '', all = true;
    for (let i = 0; i < lines.length; i++) {
      tot++;
      let g, acc = false, err = '';
      try { g = buildLineGrammar(prefix, { names, types: process.env.TYPES === '1' }).grammar; acc = accepts(parseGbnf(g), 'root', lines[i] + '\n'); } catch (e) { err = String(e).slice(0, 100); }
      if (acc) ok++; else { all = false; bad.push({ id: r.id, n: i + 1, line: lines[i], err }); }
      prefix += lines[i] + '\n';
    }
    if (all) fullOk++;
  }
}
console.log(`names=${names} programs ${progs}, fully accepted ${fullOk}; lines ${ok}/${tot} accepted (${(100 * ok / tot).toFixed(1)}%)`);
for (const b of bad.slice(0, +process.env.SHOW || 25)) console.log(b.id, b.n, JSON.stringify(b.line).slice(0, 150), b.err);
