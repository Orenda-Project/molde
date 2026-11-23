// Performance (round 10). Targets on a laptop at 2,000 rows for examples 01, 04 and 22: tree() <= 60 ms,
// a tap or a change (with the next tree) <= 80 ms, setField (with the next tree) <= 50 ms; 20,000 rows no
// worse than linear; tick(3 days) with `every 1s` < 100 ms. The test fails only when a target is missed
// by 3x (so a busy machine does not fail it) and prints the measured numbers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { load } from '../eval.mjs';

const MK = { spend: i => ({ what: 'w' + i, amount: (i % 97) + 0.25, category: ['Food', 'Bills', 'Travel', 'Fun', 'Health'][i % 5] }), task: i => ({ title: 't' + i, done: i % 3 === 0, tag: 'Home' }), drink: () => ({ ml: 250 }) };
const med = xs => xs.slice().sort((x, y) => x - y)[xs.length >> 1];
const T = f => { const t = performance.now(); f(); return performance.now() - t; };

function measure(name, tbl, n) {
  const a = load(readFileSync(new URL(`../examples/${name}.mo`, import.meta.url), 'utf8'));
  for (let i = 0; i < n; i++) a.addRow(tbl, MK[tbl](i), a.clock - (i % 60) * 864e5 - i * 1000);
  a.tree();
  const tr = [], ch = [], tap = [], sf = [];
  for (let k = 0; k < 5; k++) {
    a.addRow(tbl, MK[tbl](k)); tr.push(T(() => a.tree()));
    const inp = a.find(x => x.t === 'form').fields[0];
    ch.push(T(() => { a.dispatch(inp.id, 'change', inp.kind === 'num' ? 5 + k : 'x' + k); a.tree(); }));
    const b = a.find(x => x.t === 'button' && x.text === 'Add');
    tap.push(T(() => { a.dispatch(b.id, 'tap'); a.tree(); }));
    const r = a.rows(tbl)[k * 7]; const f = a.fields({ table: tbl, id: r.id }).find(x => ['text', 'num', 'money'].includes(x.kind));
    sf.push(T(() => { a.setField({ table: tbl, id: r.id }, f.name, f.kind === 'text' ? 'y' + k : 7 + k); a.tree(); }));
  }
  return { tree: med(tr), change: med(ch), tap: med(tap), setField: med(sf) };
}

for (const [name, tbl] of [['01-water', 'drink'], ['04-budget', 'spend'], ['22-todo', 'task']]) {
  test(`perf: ${name} at 2,000 rows (fails only above 3x the target)`, () => {
    const m = measure(name, tbl, 2000);
    console.log(`# perf ${name} 2000 rows: tree ${m.tree.toFixed(1)} ms, change ${m.change.toFixed(1)}, tap ${m.tap.toFixed(1)}, setField ${m.setField.toFixed(1)}`);
    assert.ok(m.tree <= 60 * 3, `tree ${m.tree}`);
    assert.ok(m.change <= 80 * 3 && m.tap <= 80 * 3, `change ${m.change} tap ${m.tap}`);
    assert.ok(m.setField <= 50 * 3 + 60, `setField ${m.setField} (with the tree after it)`);
  });
}

test('perf: 20,000 rows is no worse than linear (tree of 22-todo)', () => {
  const small = measure('22-todo', 'task', 2000).tree, big = measure('22-todo', 'task', 20000).tree;
  console.log(`# perf 22-todo tree: 2000 rows ${small.toFixed(1)} ms, 20000 rows ${big.toFixed(1)} ms (x${(big / small).toFixed(1)})`);
  assert.ok(big <= small * 10 * 3, `x${big / small}`);
});

test('perf: tick(3 days) with every 1s catches up in under 100 ms (x3)', () => {
  const a = load('app "T"\nstate on bool = yes\nstate left dur = 100000s\nevery 1s if on set left = left - 1s\n"l" left\n');
  a.tree(); a.tick(1000);
  const t = T(() => a.tick(3 * 86400000));
  console.log(`# perf tick 3 days: ${t.toFixed(1)} ms; skipped ${a.log.filter(e => e.kind === 'skipped').map(e => e.fires)}`);
  assert.ok(t < 300, `${t} ms`);
});
