import { test } from 'node:test';
import assert from 'node:assert/strict';
import { check } from '../check.mjs';
import { format } from '../format.mjs';
import { diff } from '../diff.mjs';
import { examples, edits, allPrograms } from './lib.mjs';

test('there are 30 examples and 20 edit pairs', () => {
  assert.equal(examples().length, 30);
  assert.equal(edits().length, 20);
});

for (const p of allPrograms()) {
  test(`valid: ${p.name} parses and type-checks`, () => {
    const r = check(p.src);
    assert.deepEqual(r.errors.map(String), []);
  });
  test(`format: ${p.name} is canonical and the formatter is idempotent`, () => {
    const once = format(p.src);
    assert.equal(once, p.src, 'file is not in canonical form (run mo.mjs format --write)');
    assert.equal(format(once), once);
  });
}

test('formatter canonicalises messy spacing and stays idempotent', () => {
  const messy = 'app   "W"  drop\ntable drink ml  num 1 .. 5000\n\ntext sum( drink.ml  today )  "ml"\n';
  const want = 'app "W" drop\ntable drink ml num 1..5000\ntext sum(drink.ml today) "ml"\n';
  assert.equal(format(messy), want);
  assert.equal(format(want), want);
  assert.ok(check(want).ok);
});

for (const e of edits()) {
  test(`edit ${e.name}: request is set, after differs, diff is safe and names a change`, () => {
    assert.ok(e.request.trim().length > 3);
    assert.notEqual(e.after, e.before);
    const r = diff(e.before, e.after);
    assert.equal(r.verdict, 'safe', JSON.stringify(r));
    assert.ok(r.changes.length > 0);
  });
}
