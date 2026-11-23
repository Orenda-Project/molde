// Storage contract, proven on real rows: data is keyed by storage slot, so edits from the chat
// (applyEdit) and chat Undo (revert) never lose or retype what the user entered.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from '../eval.mjs';
import { runEvalFuzz } from './fuzz-eval.mjs';

const texts = a => a.findAll(n => ['text', 'button', 'label'].includes(n.t)).map(n => n.text);
const tapText = (a, t) => assert.ok(a.dispatch(a.find(n => n.text === t).id, 'tap'));

test('table and field rename with was: rows move, the total is unchanged', () => {
  const a = load('app "W"\ntable drink ml num\nquick drink, ml, [250]\n"Total" sum(drink.ml)\n');
  tapText(a, '250'); tapText(a, '250');
  assert.ok(texts(a).includes('Total 500'));
  const r = a.applyEdit('app "W"\ntable drinks was drink amount num was ml\nquick drinks, amount, [250]\n"Total" sum(drinks.amount)\n');
  assert.equal(r.verdict, 'safe');
  assert.ok(texts(a).includes('Total 500'), JSON.stringify(texts(a)));
});

test('hide a field, add it back: its data returns', () => {
  const a = load('app "N"\ntable item name text, note text?\nbutton "add" tap add item name = "a", note = "keep me"\neach item\n  it.name it.note\n');
  tapText(a, 'add');
  assert.ok(texts(a).includes('a keep me'));
  assert.equal(a.applyEdit('app "N"\ntable item name text\nbutton "add" tap add item name = "b"\neach item\n  it.name\n').verdict, 'safe');
  assert.ok(texts(a).includes('a'));
  assert.equal(a.applyEdit('app "N"\ntable item name text, note text?\neach item\n  it.name it.note\n').verdict, 'safe');
  assert.ok(texts(a).includes('a keep me'), JSON.stringify(texts(a)));
});

test('widen a number to money: old values stay readable', () => {
  const a = load('app "M"\ntable s n num\nbutton "add" tap add s n = 12.5\n"Sum" sum(s.n)\n');
  tapText(a, 'add');
  a.applyEdit('app "M"\ntable s n money\n"Sum" sum(s.n)\n');
  assert.ok(texts(a).includes('Sum 12.50'), JSON.stringify(texts(a)));
});

test('pick option rename with was moves the rows; a dropped option stays readable', () => {
  const a = load('app "C"\ntable s cat pick Food|Bills\nbutton "f" tap add s cat = Food\nbutton "b" tap add s cat = Bills\n"Meals" count(s where cat = Food)\n');
  tapText(a, 'f'); tapText(a, 'f'); tapText(a, 'b');
  assert.equal(a.applyEdit('app "C"\ntable s cat pick Meals was Food|Bills\n"Meals" count(s where cat = Meals)\n').verdict, 'safe');
  assert.ok(texts(a).includes('Meals 2'), JSON.stringify(texts(a)));
  assert.equal(a.applyEdit('app "C"\ntable s cat pick Meals|Rent\neach s\n  it.cat\n').verdict, 'safe');
  assert.ok(texts(a).includes('Bills'));
});

test('a refused edit keeps the running version and its data', () => {
  const a = load('app "R"\ntable s n num\nbutton "add" tap add s n = 3\n"Sum" sum(s.n)\n');
  tapText(a, 'add');
  const r = a.applyEdit('app "R"\ntable s n text\n"x" count(s)\n');
  assert.equal(r.verdict, 'refused');
  assert.ok(texts(a).includes('Sum 3'));
});

test('chat Undo (revert): restore the previous program, keep data entered since', () => {
  const v1 = 'app "U"\ntable s n num\nbutton "add" tap add s n = 1\n"Sum" sum(s.n)\n';
  const a = load(v1);
  tapText(a, 'add');
  a.applyEdit('app "U"\ntable s n money, note text?\nbutton "add2" tap add s n = 2.25, note = "new"\n"Sum" sum(s.n)\n');
  tapText(a, 'add2');
  const r = a.revert();
  assert.equal(r.verdict, 'restore');
  assert.equal(a.source, v1);
  assert.ok(texts(a).includes('Sum 3.25'), JSON.stringify(texts(a))); // the money value stays readable as a number
  // going forward again (re-applying the newer program) brings the hidden note back
  assert.notEqual(a.applyEdit('app "U"\ntable s n money, note text?\neach s\n  it.n it.note\n').verdict, 'refused');
  assert.ok(texts(a).includes('2.25 new'), JSON.stringify(texts(a)));
});

test('snapshot carries the schema history; loading a renamed program with old data keeps it', () => {
  const a = load('app "S"\ntable drink ml num\nquick drink, ml, [250]\n"Total" sum(drink.ml)\n');
  tapText(a, '250');
  const snap = a.snapshot();
  const b = load('app "S"\ntable drinks was drink amount num was ml\n"Total" sum(drinks.amount)\n', { data: snap });
  assert.ok(texts(b).includes('Total 250'), JSON.stringify(texts(b)));
});

test('restore() adds tables and settings the program declares but the snapshot lacks', () => {
  const a = load('app "S"\ntable drink ml num\n');
  const b = load('app "S"\ntable drink ml num\ntable food name text\nsetting goal num = 7\n"Goal" goal count(food)\n');
  b.restore(a.snapshot());
  assert.ok(texts(b).includes('Goal 7 0'), JSON.stringify(texts(b)));
});

test('setting and state renames with was keep the saved value', () => {
  const a = load('app "G"\nsetting g num = 5\nstate tab text = "a"\n"v" g tab\nbutton "set" tap set g = 9 then set tab = "b"\n');
  tapText(a, 'set');
  assert.equal(a.applyEdit('app "G"\nsetting goal num = 5 was g\nstate page text = "a" was tab\n"v" goal page\n').verdict, 'safe');
  assert.ok(texts(a).includes('v 9 b'), JSON.stringify(texts(a)));
});

test('evaluator edit-chain fuzz: 150 chains, every value stays readable with its type', () => {
  const r = runEvalFuzz(150, 5);
  assert.equal(r.violations.length, 0, JSON.stringify(r.violations.slice(0, 2)));
  assert.ok(r.values > 500, JSON.stringify(r));
});

test('undo after an option rename: rows read under the old option; renaming again moves all rows', () => {
  const v1 = 'app "C"\ntable s cat pick Food|Bills\nbutton "f" tap add s cat = Food\n"food" count(s where cat = Food)\n';
  const a = load(v1);
  tapText(a, 'f'); tapText(a, 'f');
  a.applyEdit('app "C"\ntable s cat pick Meals was Food|Bills\nbutton "m" tap add s cat = Meals\n"meals" count(s where cat = Meals)\n');
  tapText(a, 'm');
  assert.ok(texts(a).includes('meals 3'));
  assert.equal(a.revert().verdict, 'restore');
  assert.ok(texts(a).includes('food 3'), JSON.stringify(texts(a)));
  assert.equal(a.applyEdit('app "C"\ntable s cat pick Meals was Food|Bills\n"meals" count(s where cat = Meals) "all" count(s)\n').verdict, 'safe');
  assert.ok(texts(a).includes('meals 3 all 3'), JSON.stringify(texts(a)));
});

test('restore an older backup into a newer app, then edit: rows still shown', () => {
  const a = load('app "T"\ntable t a num\n"n" count(t)\n');
  a.addRow('t', { a: 1 }); a.addRow('t', { a: 2 });
  const old = a.snapshot();
  a.applyEdit('app "T"\ntable t b num was a\n"n" count(t)\n');
  a.restore(old);
  assert.equal(a.applyEdit('app "T"\ntable t b num was a, c text?\n"n" count(t) sum(t.b)\n').verdict, 'safe');
  assert.ok(texts(a).includes('n 2 3'), JSON.stringify(texts(a)));
});

test('load never throws on a damaged history; the data is left untouched', () => {
  for (const d of [{ ever: {} }, { ever: 'x' }, { data: { tables: null } }, { data: { tables: { t: [{ id: 1, at: 1, a: 1 }] } }, ever: { tables: {}, versions: [] } }, 'nonsense']) {
    const copy = JSON.stringify(d);
    const a = load('app "T"\ntable t a num\nlist t\n', { data: d });
    assert.equal(a.ok, false);
    assert.match(a.errors[0], /cannot be read safely/);
    assert.equal(JSON.stringify(d), copy);
  }
});

test('a table renamed with was and a new table with its old name in the same edit', () => {
  const a = load('app "T"\ntable drink ml num\n"n" count(drink)\n');
  a.addRow('drink', { ml: 5 });
  assert.equal(a.applyEdit('app "T"\ntable drinks was drink ml num\ntable drink cc text\n"n" count(drinks) count(drink)\n').verdict, 'safe');
  assert.ok(texts(a).includes('n 1 0'));
});

test('revert at the first version says there is nothing to undo; state was works before =', () => {
  const a = load('app "T"\nstate m num = 0\n"m" m\nbutton "i" tap set m = m + 1\n');
  assert.equal(a.revert().verdict, 'none');
  tapText(a, 'i');
  assert.equal(a.applyEdit('app "T"\nstate month num was m = 0\n"m" month\n').verdict, 'safe');
  assert.ok(texts(a).includes('m 1'));
});

test('program-level model fuzz: 150 chains, what the program shows matches the data', async () => {
  const { runModelFuzz } = await import('./fuzz-model.mjs');
  const r = runModelFuzz(150, 9);
  assert.equal(r.violations.length, 0, JSON.stringify(r.violations.slice(0, 2)));
});

// ---- round 5: a `was` already applied to the stored data is never applied again ----
import { diff } from '../diff.mjs';
const swapCases = [
  ['field swap', 'table s a num, b num\n"x" sum(s.a) sum(s.b)', 'table s b num was a, a num was b\n"x" sum(s.a) sum(s.b)', a => a.addRow('s', { a: 1, b: 20 }), 'x 20 1'],
  ['field 3-cycle', 'table s a num, b num, c num\n"x" sum(s.a) sum(s.b) sum(s.c)', 'table s b num was a, c num was b, a num was c\n"x" sum(s.a) sum(s.b) sum(s.c)', a => a.addRow('s', { a: 1, b: 20, c: 300 }), 'x 300 1 20'],
  ['setting swap', 'setting g num = 0\nsetting h num = 0\n"x" g h', 'setting h num = 0 was g\nsetting g num = 0 was h\n"x" g h', a => { a.setField('g', null, 10); a.setField('h', null, 20); }, 'x 20 10'],
  ['option swap', 'table s c pick A|B\n"x" count(s where c = A) count(s where c = B)', 'table s c pick B was A|A was B\n"x" count(s where c = A) count(s where c = B)', a => { a.addRow('s', { c: 'A' }); a.addRow('s', { c: 'A' }); a.addRow('s', { c: 'B' }); }, 'x 1 2'],
];
for (const [name, b1, b2, fill, want] of swapCases) {
  test(`a ${name} is applied once: reload, re-submit, a later edit and diff leave it`, () => {
    const S1 = `app "T"\n${b1}\n`, S2 = `app "T"\n${b2}\n`;
    const a = load(S1); fill(a);
    assert.equal(a.applyEdit(S2).verdict, 'safe');
    assert.deepEqual(texts(a), [want]);
    assert.deepEqual(texts(load(S2, { data: a.snapshot() })), [want], 'reload with the snapshot');
    assert.deepEqual(texts(load(S2, { data: a.snapshot(), history: [S1, S2] })), [want], 'reload with history too');
    const again = a.applyEdit(S2);
    assert.deepEqual([again.verdict, again.changes.filter(c => /renames/.test(c)), texts(a)], ['safe', [], [want]], 're-submit');
    a.applyEdit(S2 + '"hi"\n');
    assert.deepEqual(texts(a), [want, 'hi'], 'a later unrelated edit');
    const d = diff([S1, S2], S2);
    assert.deepEqual(d.changes.filter(c => /renames/.test(c)), [], 'diff reports no rename');
  });
}

test('restore of an older backup after an option rename brings its rows to the new name', () => {
  const S1 = 'app "T"\ntable s c pick A|X\n"x" count(s where c = A)\n', S2 = 'app "T"\ntable s c pick B was A|X\n"x" count(s where c = B)\n';
  const a = load(S1); a.addRow('s', { c: 'A' }); a.addRow('s', { c: 'A' });
  const old = a.snapshot();
  a.applyEdit(S2);
  assert.deepEqual(texts(a), ['x 2']);
  a.addRow('s', { c: 'X' });
  assert.ok(a.restore(old).ok);
  assert.deepEqual(texts(a), ['x 2'], 'restored rows read under B');
  const noEver = { data: old.data, seq: old.seq };
  assert.deepEqual(texts(load(S2, { data: noEver, history: [S1, S2] })), ['x 2'], 'data saved without its schema history');
});

test('Undo goes back by version, not by text: rename, edit back to the old text, undo twice', () => {
  const S1 = 'app "T"\ntable s c pick A|X\n"x" count(s where c = A)\n', S2 = 'app "T"\ntable s c pick B was A|X\n"x" count(s where c = B)\n';
  const a = load(S1); a.addRow('s', { c: 'A' }); a.addRow('s', { c: 'A' });
  a.applyEdit(S2); a.applyEdit(S1);
  a.revert(); a.revert();
  assert.equal(a.source, S1);
  assert.deepEqual(texts(a), ['x 2'], 'rows are A again');
});

test('a table name used again after it was removed is a warning, not plain safe', () => {
  const a = load('app "T"\ntable t n num\nlist t\n'); a.addRow('t', { n: 1 });
  a.applyEdit('app "T"\n"none"\n');
  const r = a.applyEdit('app "T"\ntable t name text\nlist t\n');
  assert.equal(r.verdict, 'warn');
  assert.match(r.warnings[0], /removed earlier; its old rows come back/);
});

test('a damaged option log is refused at load with a message, data untouched', () => {
  const a = load('app "T"\ntable s c pick A|B\nlist s\n'); a.addRow('s', { c: 'A' });
  for (const bad of ['x', [{ v: 'q', map: 5 }], [{ v: 9, table: 's', field: 'c', map: null }]]) {
    const snap = a.snapshot(); snap.ever.optionLog = bad;
    const b = load('app "T"\ntable s c pick A|B\nlist s\n', { data: snap });
    assert.equal(b.ok, false); assert.match(b.errors[0], /option rename log/); assert.equal(b.rawData, snap);
  }
});
