// 0.6.2 (critic round 6): the standard form empties itself after Add (it used to keep the typed text, so the second entry was
// typed on top of the first), and an empty list does not claim "Add one to see it here" under other tables' rows.
// build.mjs patches the vendored std library; this test fails if that patch is missing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from '../vendor/lang/eval.mjs';

const SRC = 'app "T" school ocean\ntable student name text, fee money\ntable paid student ref student, amount money\nform student, "Add student"\nlist student\nlist paid\n';

test('the form is empty again after Add', () => {
  const a = load(SRC);
  assert.ok(a.ok, a.errors.join('; '));
  const f = a.find(n => n.t === 'form');
  a.dispatch(f.id + ':name', 'change', 'Ali');
  a.dispatch(f.id + ':fee', 'change', 500);
  assert.ok(a.dispatch(a.find(n => n.t === 'button' && n.text === 'Add student').id, 'tap'));
  const g = a.find(n => n.t === 'form');
  assert.deepEqual(g.fields.map(x => x.value), [null, null]);
  // a second entry is its own row, not the first one with more text
  a.dispatch(g.id + ':name', 'change', 'Sara');
  a.dispatch(g.id + ':fee', 'change', 700);
  assert.ok(a.dispatch(a.find(n => n.t === 'button' && n.text === 'Add student').id, 'tap'));
  const rows = a.findAll(n => n.t === 'text').map(n => n.text);
  assert.ok(rows.some(t => /^Ali/.test(t)) && rows.some(t => /^Sara/.test(t)), JSON.stringify(rows));
});

test('an empty list says it is this list that is empty', () => {
  const a = load(SRC);
  const t = a.findAll(n => n.t === 'text').map(n => n.text).join('|');
  assert.ok(/Nothing in this list yet\./.test(t), t);
  assert.ok(!/Add one to see it here/.test(t), t);
});
