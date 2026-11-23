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
