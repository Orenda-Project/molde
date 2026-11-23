// Storage contract, proven on real rows: data is keyed by storage slot, so edits from the chat
// (applyEdit) and chat Undo (revert) never lose or retype what the user entered.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from '../eval.mjs';
import { readFileSync } from 'node:fs';
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
  assert.equal(a.applyEdit('app "C"\ntable s cat pick Meals|Rent\neach s\n  it.cat\n').verdict, 'warn'); // round 6: dropping an option that rows still use is a warning
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
  // round 7: a backup is a whole app; it brings its own program, and the newer program is then an edit
  assert.equal(b.restore(a.snapshot()).ok, true);
  assert.equal(b.source, a.source);
  b.applyEdit('app "S"\ntable drink ml num\ntable food name text\nsetting goal num = 7\n"Goal" goal count(food)\n');
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

test('rename fuzz: 200 chains of swaps, rotations, renames back, repeated swaps, re-submits, Undo, restore to any version, restores of any backup, legacy and old-backup reloads', async () => {
  const { runRenameFuzz } = await import('./fuzz-model.mjs');
  const r = runRenameFuzz(200, 13);
  assert.equal(r.violations.length, 0, JSON.stringify(r.violations.slice(0, 2)));
  assert.ok(r.reloads >= 2000 && r.versionRestores > 20 && r.repeats > 10 && r.legacyReloads > 500);
});

// ---- round 5: a `was` already applied to the stored data is never applied again ----
import { diff } from '../diff.mjs';
import { strip } from '../format.mjs';
const swapCases = [
  ['field swap', 'table s a num, b num\n"x" sum(s.a) sum(s.b)', 'table s b num was a, a num was b\n"x" sum(s.a) sum(s.b)', a => a.addRow('s', { a: 1, b: 20 }), 'x 20 1'],
  ['field 3-cycle', 'table s a num, b num, c num\n"x" sum(s.a) sum(s.b) sum(s.c)', 'table s b num was a, c num was b, a num was c\n"x" sum(s.a) sum(s.b) sum(s.c)', a => a.addRow('s', { a: 1, b: 20, c: 300 }), 'x 300 1 20'],
  ['setting swap', 'setting g num = 0\nsetting h num = 0\n"x" g h', 'setting h num = 0 was g\nsetting g num = 0 was h\n"x" g h', a => { a.setField('g', null, 10); a.setField('h', null, 20); }, 'x 20 10'],
  ['option swap', 'table s c pick A|B\n"x" count(s where c = A) count(s where c = B)', 'table s c pick B was A|A was B\n"x" count(s where c = A) count(s where c = B)', a => { a.addRow('s', { c: 'A' }); a.addRow('s', { c: 'A' }); a.addRow('s', { c: 'B' }); }, 'x 1 2'],
];
for (const [name, b1, b2, fill, want] of swapCases) {
  test(`a ${name}: was acts once, the stored text has none; reload, re-submit and later edits keep it; writing it again swaps again`, () => {
    const S1 = `app "T"\n${b1}\n`, S2 = `app "T"\n${b2}\n`;
    const a = load(S1); fill(a);
    const before = texts(a);
    assert.equal(a.applyEdit(S2).verdict, 'safe');
    assert.deepEqual(texts(a), [want]);
    assert.equal(a.source, strip(S2), 'the stored program has no was');
    assert.deepEqual(texts(load(a.source, { data: a.snapshot() })), [want], 'reload with the snapshot');
    assert.deepEqual(texts(load(S2, { data: a.snapshot() })), [want], 'loading never renames, even given the was text');
    assert.deepEqual(texts(load(a.source, { data: a.snapshot(), history: [S1, S2] })), [want], 'reload with history too');
    const again = a.applyEdit(a.source);
    assert.deepEqual([again.verdict, again.changes, texts(a)], ['safe', [], [want]], 're-submitting the stored text');
    a.applyEdit(a.source + '"hi"\n');
    assert.deepEqual(texts(a), [want, 'hi'], 'a later unrelated edit');
    assert.deepEqual(diff([S1, S2], strip(S2)).changes.filter(c => /renames/.test(c)), [], 'diff of the stored text reports no rename');
    if (name !== 'field 3-cycle') { // a swap written again swaps back (a 3-cycle written again rotates on)
      const back = a.applyEdit(S2 + '"hi"\n');
      assert.ok(back.changes.some(c => /renames/.test(c)), 'the swap written again is a rename');
      assert.deepEqual(texts(a), [...before, 'hi'], 'swapped back');
    }
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

// ---- round 6: was acts once (the stored text has none), rows hold option slots, versions carry maps ----
const SW1 = 'app "T"\ntable s a num, b num\n"x" sum(s.a) sum(s.b)\n', SW2 = 'app "T"\ntable s b num was a, a num was b\n"x" sum(s.a) sum(s.b)\n';
test('round 6 S1: swap, Undo, restore forward to the swap, then an unrelated edit of the stored text: no flip', () => {
  const a = load(SW1); a.addRow('s', { a: 1, b: 20 });
  a.applyEdit(SW2); a.revert();
  assert.deepEqual(texts(a), ['x 1 20']);
  assert.equal(a.setProgram(strip(SW2), { restore: true, version: 1 }).verdict, 'restore');
  assert.deepEqual(texts(a), ['x 20 1']);
  a.applyEdit(a.source + '"hi"\n');
  assert.deepEqual(texts(a), ['x 20 1', 'hi']);
  assert.deepEqual(texts(load(a.source, { data: a.snapshot() })), ['x 20 1', 'hi']);
});

test('round 6 S1: an older-shaped backup (format, option slots, maps and round 5 bookkeeping removed) is rebuilt, no flip', () => {
  const a = load(SW1); a.addRow('s', { a: 1, b: 20 });
  a.applyEdit(SW2);
  const snap = a.snapshot();
  delete snap.ever.format; for (const v of snap.ever.versions) delete v.map;
  const b = load(a.source, { data: snap });
  assert.deepEqual(texts(b), ['x 20 1']);
  b.applyEdit(b.source + '"hi"\n');
  assert.deepEqual(texts(b), ['x 20 1', 'hi']);
  const bad = a.snapshot(); delete bad.ever.format; bad.ever.versions[1] = { v: 2 };
  const c = load(a.source, { data: bad });
  assert.equal(c.ok, false); assert.match(c.errors[0], /cannot be rebuilt|without its program text|has no program text/);
});

const O1 = 'app "T"\ntable s c pick A|X\n"x" count(s where c = A)\n', O2 = 'app "T"\ntable s c pick B was A|X\n"x" count(s where c = B)\n';
test('round 6 S2: an option rename moves no row; Undo and restore to any version read rows by option slot', () => {
  const a = load(O1); a.addRow('s', { c: 'A' }); a.addRow('s', { c: 'X' });
  const raw = () => a.rows('s').map(r => r[a.fk('s', 'c')]);
  const before = raw();
  a.applyEdit(O2);
  assert.deepEqual(raw(), before, 'rows untouched by the rename');
  assert.deepEqual([texts(a), a.cell('s', a.rows('s')[0], 'c')], [['x 1'], 'B']);
  a.setProgram(a.ever.versions[0].src, { restore: true, version: 0 });
  assert.deepEqual([texts(a), a.cell('s', a.rows('s')[0], 'c')], [['x 1'], 'A']);
  a.setProgram(a.ever.versions[1].src, { restore: true, version: 1 });
  assert.deepEqual(texts(a), ['x 1']);
});

test('round 6 S2: an old backup with the newest program; history is always used when given, even with a schema in the backup', () => {
  const O3 = 'app "T"\ntable s c pick B|X|Y\n"x" count(s where c = B)\n';
  const a = load(O1); a.addRow('s', { c: 'A' }); a.addRow('s', { c: 'A' });
  const old = a.snapshot();
  a.applyEdit(O2); a.applyEdit(O3);
  const withH = load(a.source, { data: old, history: [O1, O2, O3] });
  assert.deepEqual(texts(withH), ['x 2'], 'the skipped rename is replayed from history');
  const noH = load(a.source, { data: old });
  assert.equal(noH.ok, true, 'without history it still loads');
  assert.equal(noH.edit.verdict, 'warn');
});

test('round 6 S2: the same swap written again swaps again and says so', () => {
  const a = load(SW1); a.addRow('s', { a: 1, b: 20 });
  a.applyEdit(SW2);
  const r = a.applyEdit(SW2);
  assert.ok(r.changes.some(c => /renames/.test(c)));
  assert.deepEqual(texts(a), ['x 1 20']);
});

test('round 6 S3: a pick option renamed without was is a warning; a was that changes nothing says so', () => {
  const a = load(O1); a.addRow('s', { c: 'A' });
  const r = a.applyEdit('app "T"\ntable s c pick B|X\n"x" count(s where c = B)\n');
  assert.equal(r.verdict, 'warn');
  assert.match(r.warnings.join(' '), /option A is no longer listed/);
  assert.equal(a.cell('s', a.rows('s')[0], 'c'), 'A', 'the row keeps A');
  const n = diff([O1], 'app "T"\ntable s c pick A|X|Y was Q\n"x" count(s where c = A)\n');
  assert.match([...n.notes, ...(n.warnings || [])].join(' '), /Y was Q changes nothing/);
});

// ---- round 7: a backup is a whole app; setting and state picks have option slots; edges of load ----
test('round 7 S1: restoring a backup that is ahead brings its own program and map; new rows land in the right slots', () => {
  const V0 = 'app "T"\ntable s a num, b text\n"x" sum(s.a)\nlist s\n', V1 = 'app "T"\ntable s b num was a, a text was b\n"x" sum(s.b)\nlist s\n';
  const A = load(V0); A.addRow('s', { a: 1, b: 'x' }); const old = A.snapshot();
  A.applyEdit(V1); A.addRow('s', { b: 5, a: 'q' }); const ahead = A.snapshot();
  const B = load(V0, { data: old });
  assert.equal(B.restore(ahead).ok, true);
  assert.equal(B.source, A.source, 'the backup brings its program');
  B.addRow('s', { b: 7, a: 'n' });
  assert.deepEqual(B.rows('s').map(r => B.cell('s', r, 'b')), [1, 5, 7]);
  assert.deepEqual(texts(B)[0], 'x 13');
  // keeping the running program: only when it is one of the backup's versions, and then that version's map
  const C = load(V0, { data: old });
  const k = C.restore(ahead, { keepProgram: true });
  assert.equal(k.ok, true); assert.equal(C.source, strip(V0)); assert.deepEqual(texts(C)[0], 'x 6'); // V0's map: slot a holds 1 and the 5 written as b under V1
  const D = load(V0, { data: old }); D.applyEdit(V0.replace('"x"', '"y"'));
  const before = JSON.stringify(D.snapshot().data);
  const r = D.restore(ahead, { keepProgram: true });
  assert.equal(r.ok, false); assert.match(r.reason, /not one of the versions/); assert.equal(JSON.stringify(D.snapshot().data), before, 'data untouched');
  // a backup of another app is refused
  const other = load(V0); other.addRow('s', { a: 9, b: 'z' });
  const r2 = D.restore(other.snapshot());
  assert.equal(r2.ok, false); assert.match(r2.reason, /another app/);
});

test('round 7 S2a: an option rename onto the name of a dropped option is refused; listing it again without was brings it back', () => {
  const P = o => `app "T"\ntable s c pick ${o}\nlist s\n`;
  const a = load(P('Food|Fun|X')); a.addRow('s', { c: 'Fun' }); a.addRow('s', { c: 'Food' });
  assert.equal(a.applyEdit(P('Food|X')).verdict, 'warn');
  const r = a.applyEdit(P('Fun was Food|X'));
  assert.equal(r.verdict, 'refused'); assert.match(r.refused.join(' '), /earlier dropped option Fun/);
  assert.notEqual(a.applyEdit(P('Food|Fun|X')).verdict, 'refused');
  assert.deepEqual(a.rows('s').map(x => a.cell('s', x, 'c')), ['Fun', 'Food']);
});

test('round 7 S2b: setting and state picks have option slots: a rename keeps the stored choice, filter chips keep working', () => {
  const S1 = 'app "T"\ntable t k pick A|B|C\nsetting g pick A|B|C = A\nstate sel pick A|B|C = A\n"v" g sel\n"n" count(t where k = sel)\nbutton "gB" tap set g = B\nbutton "sB" tap set sel = B\n';
  const a = load(S1); a.addRow('t', { k: 'B' }); a.addRow('t', { k: 'A' });
  for (const b of a.findAll(n => n.t === 'button')) a.dispatch(b.id, 'tap');
  assert.deepEqual(texts(a).slice(0, 2), ['v B B', 'n 1']);
  const S2 = 'app "T"\ntable t k pick X was B|A|C\nsetting g pick X was B|A|C = A\nstate sel pick X was B|A|C = A\n"v" g sel\n"n" count(t where k = sel)\n';
  assert.equal(a.applyEdit(S2).verdict, 'safe');
  assert.deepEqual(texts(a), ['v X X', 'n 1']);
  assert.deepEqual(texts(load(a.source, { data: a.snapshot() })), ['v X X', 'n 1']);
  a.revert();
  assert.deepEqual(texts(a).slice(0, 2), ['v B B', 'n 1']);
});

test('round 7 S3: load never acts as an edit; history that contradicts the data is not used', () => {
  const a = load(SW1); a.addRow('s', { a: 1, b: 20 });
  const b = load(SW2, { data: a.snapshot() }); // a different program text: the stored program runs, with a warning
  assert.equal(b.source, strip(SW1)); assert.equal(b.edit.verdict, 'warn'); assert.deepEqual(texts(b), ['x 1 20']);
  const c = load(strip(SW1), { data: a.snapshot(), history: ['app "T"\ntable s z num\n"x" sum(s.z)\n'] });
  assert.deepEqual(texts(c), ['x 1 20']); assert.match(c.edit.warnings.join(' '), /history given does not contain/);
});

test('round 7 S3: text that starts with # stays text, also in a field widened from pick; a stale or unknown option name in a form', () => {
  const a = load('app "T"\ntable s c pick A|B, t text?\n"n" count(s where t = "#A")\n');
  a.addRow('s', { c: 'A', t: '#A' });
  assert.deepEqual(texts(a), ['n 1']);
  const w = load(a.source, { data: a.snapshot() }); w.applyEdit('app "T"\ntable s c text, t text?\n"n" count(s where c = "#A") count(s where c = "A")\n');
  assert.deepEqual(texts(w), ['n 0 1'], 'the widened field shows the option name, and # text is not taken for an option');
  const r = a.rows('s')[0];
  a.applyEdit('app "T"\ntable s c pick Z was A|B, t text?\n"n" count(s where c = Z)\n');
  assert.equal(a.setField({ table: 's', id: r.id }, 'c', 'A'), true, 'a stale name goes to the option last seen under it');
  assert.equal(a.cell('s', r, 'c'), 'Z');
  assert.equal(a.setField({ table: 's', id: r.id }, 'c', 'Nope'), false, 'a name no option ever had is rejected');
});

test('round 7 S3: a missing or wrong version map is refused with a plain reason', () => {
  const a = load(SW1); a.addRow('s', { a: 1, b: 20 }); a.applyEdit(SW2);
  for (const damage of [s => { delete s.ever.versions[1].map; }, s => { s.ever.versions[1].map.tables = { s: 'nope' }; }, s => { s.ever.versions[1].from = 7; }]) {
    const snap = a.snapshot(); damage(snap);
    const b = load(a.source, { data: snap });
    assert.equal(b.ok, false); assert.match(b.errors[0], /schema history|restores a version/); assert.ok(!/undefined|null|Cannot read/.test(b.errors[0]));
  }
});

// ---- round 8: the stored form never leaves the evaluator; foreign backups; Undo around restore and edits ----
import { boundaryLeak, echoChanges } from './fuzz-model.mjs';
test('round 8 S1: an app with only settings or states changed refuses another app\'s backup; touched is recorded, not inferred', () => {
  const src = readFileSync(new URL('../examples/29-zakat-tip.mo', import.meta.url), 'utf8');
  const a = load(src);
  assert.ok(!a.ever.touched);
  const inp = a.find(n => n.t === 'input');
  a.dispatch(inp.id, 'change', 12345);
  assert.equal(a.ever.touched, true);
  const other = load('app "To do" list ink\ntable task title text\nlist task\n'); other.addRow('task', { title: 'x' });
  const before = JSON.stringify(a.snapshot().data);
  const r = a.restore(other.snapshot());
  assert.equal(r.ok, false); assert.match(r.reason, /another app/);
  assert.equal(JSON.stringify(a.snapshot().data), before);
  const noId = other.snapshot(); delete noId.ever.app;
  assert.match(a.restore(noId).reason, /does not say which app/);
  const fresh = load(src); assert.equal(fresh.restore(noId).ok, true, 'an untouched install may adopt any backup');
});

test('round 8 S2a: option references never leave the evaluator; echoing a value changes nothing; objects and unknown names are rejected', () => {
  const S = 'app "T"\ntable s c pick a|b, n text?\nsetting sp pick p|q = p\nstate st pick x|y = x\n"v" st\nfield sp\nchoice st\nform s\neach s\n  choice it.c\n  field it.n\n';
  const a = load(S); a.addRow('s', { c: 'b', n: '#b' });
  assert.equal(boundaryLeak(a), null); assert.equal(echoChanges(a), null);
  for (const f of a.fields({ table: 's', id: 1 })) assert.ok(typeof f.value !== 'object' || f.value === null, JSON.stringify(f));
  assert.equal(a.cell('s', a.rows('s')[0], 'c'), 'b'); assert.deepEqual(a.cell('s', a.rows('s')[0], 'c', { raw: true }), { o: '#b' });
  const raw = JSON.stringify(a.data);
  assert.equal(a.setField({ table: 's', id: 1 }, 'c', { o: '#a' }), false);
  assert.equal(a.setField({ table: 's', id: 1 }, 'c', 'nope'), false);
  assert.equal(a.setField('sp', null, { o: '#q' }), false);
  assert.equal(a.addRow('s', { c: { o: '#a' } }), null);
  const ch = a.find(n => n.t === 'choice' && n.label !== undefined && n.value === 'x');
  if (ch) a.dispatch(ch.id, 'change', { o: '#y' });
  assert.equal(JSON.stringify(a.data), raw, 'nothing stored changed');
  // widened from pick to text: the old choice reads as its name, and echoing it changes nothing
  a.applyEdit('app "T"\ntable s c text, n text?\neach s\n  field it.c\n  it.c\n');
  assert.equal(boundaryLeak(a), null); assert.equal(echoChanges(a), null);
  assert.ok(a.findAll(n => n.t === 'text').some(n => n.text === 'b'));
});

test('round 8 S2b/S2c: restore clears data Undo; Undo after an edit that added a setting leaves the setting at its default', () => {
  const a = load('app "T"\ntable s n num\nbutton "add" tap add s n = 1\n"n" count(s)\n');
  const snap = a.snapshot();
  a.dispatch(a.find(n => n.t === 'button').id, 'tap'); a.dispatch(a.find(n => n.t === 'button').id, 'tap');
  const r = a.restore(snap);
  assert.deepEqual(r.replaced.before.rows, 2); assert.deepEqual(r.replaced.after.rows, 0);
  assert.equal(a.undo(), false, 'no data Undo across a restore');
  const b = load('app "T"\nstate n num = 0\nbutton "go" tap set n = n + 1\n"n" n\n');
  b.dispatch(b.find(x => x.t === 'button').id, 'tap');
  b.applyEdit('app "T"\nstate n num = 0\nsetting goal num = 100\nbutton "go" tap set n = n + 1\n"n" n\n"left" goal - n\n');
  b.undo();
  assert.deepEqual(texts(b).slice(1), ['n 0', 'left 100']);
});

test('round 8 S3: screen-level state picks have option slots; unknown slots in a map or row are refused plainly', () => {
  const S1 = 'app "T"\nscreen one "One"\n  state f pick a|b = a\n  button "b" tap set f = b\n  "f" f\n', S2 = 'app "T"\nscreen one "One"\n  state f pick a|z was b = a\n  button "b" tap set f = z\n  "f" f\n';
  const a = load(S1); a.dispatch(a.find(n => n.t === 'button').id, 'tap');
  a.applyEdit(S2);
  assert.ok(a.findAll(n => n.t === 'text').some(n => n.text === 'f z'));
  const snap = a.snapshot(); snap.data.state['|f'] = { o: '#nope' };
  const b = load(a.source, { data: snap });
  assert.equal(b.ok, false); assert.match(b.errors[0], /names an option the schema history does not have/);
});

// ---- round 9: Undo groups, drafts by slot, input validation, when across reloads, clock steps ----
test('round 9 S2a: a change group ends with any other operation, undo included', () => {
  const a = load('app "T"\ntable s t text\nsetting g num = 1\nfield g\nbutton "add" tap add s t = "r"\n"n" count(s)\n');
  const tapAdd = () => a.dispatch(a.find(n => n.t === 'button').id, 'tap');
  const g = () => a.find(n => n.t === 'input');
  tapAdd(); tapAdd();
  a.dispatch(g().id, 'change', 5);
  a.undo();
  assert.deepEqual([a.rows('s').length, a.data.settings.g], [2, 1]);
  a.dispatch(g().id, 'change', 9);
  a.undo();
  assert.deepEqual([a.rows('s').length, a.data.settings.g], [2, 1], 'the second change is its own step');
});

test('round 9 S2b: form drafts follow slots across edits; a refused Add says which field is missing', () => {
  const P = f => `app "T"\ntable s ${f}\nform s\n`;
  const a = load(P('title text, n num?'));
  const fld = name => a.find(n => n.t === 'form').fields.find(f => f.name === name);
  a.dispatch(fld('title').id, 'change', 'typed'); a.dispatch(fld('n').id, 'change', 3);
  a.applyEdit(P('name text was title, n num?, tag pick Home|Work = Home'));
  assert.deepEqual(['name', 'n', 'tag'].map(n => fld(n).value), ['typed', 3, 'Home']);
  a.dispatch(a.find(n => n.t === 'button').id, 'tap');
  assert.equal(a.rows('s').length, 1);
  assert.deepEqual([a.cell('s', a.rows('s')[0], 'name'), a.cell('s', a.rows('s')[0], 'tag')], ['typed', 'Home']);
  a.applyEdit(P('name text, tag pick Home|Work = Home'));
  a.dispatch(fld('name').id, 'change', ''); // the std form keeps its draft after Add; empty the name
  a.dispatch(a.find(n => n.t === 'button').id, 'tap'); // refused
  const f = a.find(n => n.t === 'form');
  assert.match(f.error, /Fill in name/); assert.equal(f.fields.find(x => x.name === 'name').error, 'needed');
});

test('round 9 S2c: an option rename compared with a text state warns and names it (27-tasbeeh)', () => {
  const src = readFileSync(new URL('../examples/27-tasbeeh.mo', import.meta.url), 'utf8');
  const a = load(src);
  const r = a.applyEdit(src.replace('pick SubhanAllah|', 'pick Tasbih was SubhanAllah|').replace('= SubhanAllah\n', '= Tasbih\n'));
  assert.equal(r.verdict, 'warn');
  assert.match(r.warnings.join(' '), /compares phrase with ph, which is text.*pick/);
});

test('round 9 S2d: touched is derived once for saves without the flag, then recorded', () => {
  const a = load('app "T"\nsetting g num = 1\nfield g\n"g" g\n');
  a.setField('g', null, 7);
  const snap = a.snapshot(); delete snap.ever.touched;
  const b = load(a.source, { data: snap });
  assert.equal(b.ever.touched, true);
  const c = load('app "T"\nsetting g num = 1\n"g" g\n'); const s2 = c.snapshot(); delete s2.ever.touched;
  assert.equal(load(c.source, { data: s2 }).ever.touched, false, 'a save with nothing changed stays untouched');
});

test('round 9 S3: setField and change reject what a form would: empty required, missing ref, garbage numbers', () => {
  const a = load('app "T"\ntable p name text\ntable s t text, n num?, m money?, d dur?, r ref p?\nstate q text = ""\nfield q\n');
  const p = a.addRow('p', { name: 'x' }); const r = a.addRow('s', { t: 'a', n: 1, m: 2, d: 3, r: p.id });
  const t = { table: 's', id: r.id };
  const before = JSON.stringify(a.data);
  assert.equal(a.setField(t, 't', ''), false); assert.equal(a.setField(t, 't', null), false);
  assert.equal(a.setField(t, 'r', 999), false);
  for (const g of ['abc', NaN, {}, [], true, '  ', '1e999', Infinity]) for (const f of ['n', 'm', 'd']) assert.equal(a.setField(t, f, g), false, `${f} ${String(g)}`);
  assert.equal(JSON.stringify(a.data), before);
  const q = a.find(n => n.t === 'input');
  a.dispatch(q.id, 'change', q.value);
  assert.equal(a.data.state['|q'], '', 'echo of an empty text stays empty text');
});

test('round 9 S3: a when already true does not notify after a reload; every writes are their own undo steps and touch the app', () => {
  const S = 'app "T"\ntable log x num\nsetting g num = 9\nevery 60s if g > 5 add log x = 1\nwhen count(log) > 1 notify "many"\nbutton "b" tap add log x = 5\n';
  const a = load(S);
  assert.ok(!a.ever.touched);
  a.tick(60000);
  assert.equal(a.ever.touched, true);
  a.dispatch(a.find(n => n.t === 'button').id, 'tap');
  a.tick(60000);
  assert.equal(a.log.filter(e => e.kind === 'notify').length, 1);
  assert.equal(a.rows('log').length, 3);
  a.undo();
  assert.equal(a.rows('log').length, 2, 'undo takes back only the tick write');
  const b = load(a.source, { data: a.snapshot() });
  b.tick(1);
  assert.equal(b.log.filter(e => e.kind === 'notify').length, 0);
});

test('UI fuzz: 200 chains through tree and dispatch only (undo groups, drafts across edits, garbage, reloads, ticks)', async () => {
  const { runUiFuzz } = await import('./fuzz-ui.mjs');
  const r = runUiFuzz(200, 5);
  assert.equal(r.violations.length, 0, JSON.stringify(r.violations.slice(0, 2)));
  assert.ok(r.undos > 50 && r.draftChecks > 100 && r.garbage > 50 && r.reloads > 50);
});

// ---- round 10: the host clock, block state by identity, at and dates, Undo deltas ----
test('round 10 S1: the clock belongs to the host: restore keeps it, load takes now, schedules catch up', () => {
  const S = 'app "T"\ntable log x num\nbutton "plus" tap add log x = 1\n"n" count(log today)\n';
  const a = load(S, { now: '2026-11-23T10:00:00Z' });
  const old = a.snapshot();
  const b = load(a.source, { data: old, now: '2026-11-28T10:00:00Z' });
  assert.equal(new Date(b.clock).toISOString(), '2026-11-28T10:00:00.000Z');
  b.restore(old);
  assert.equal(new Date(b.clock).toISOString(), '2026-11-28T10:00:00.000Z', 'restore never moves the clock');
  b.dispatch(b.find(n => n.t === 'button').id, 'tap');
  assert.equal(new Date(b.rows('log')[0].at).toISOString(), '2026-11-28T10:00:00.000Z');
  const E = 'app "T"\ntable log x num\nevery 1h add log x = 1\n';
  const c = load(E, { now: '2026-11-23T10:00:00Z' });
  const d = load(c.source, { data: c.snapshot(), now: '2026-11-23T15:30:00Z' });
  assert.equal(d.rows('log').length, 5, 'an hourly every caught up 5 times');
  assert.ok(d.rows('log').every(r => r.at <= d.clock));
});

test('round 10 S2a: state inside each keeps its value across safe edits (a heading above, an option rename)', () => {
  const P = (opts, head = '') => `app "T"\ntable cat c pick ${opts}\ntable s n num\n${head}each options cat.c\n  state base num = 0\n  row\n    "b" it base\n    button "inc" tap set base = base + 1\neach s\n  state open bool = no\n  toggle open\n`;
  const a = load(P('A|B'));
  const r = a.addRow('s', { n: 1 });
  a.dispatch(a.findAll(n => n.t === 'button')[1].id, 'tap'); // B's baseline 1
  a.dispatch(a.find(n => n.t === 'toggle').id, 'tap');
  const shown = () => [a.findAll(n => n.t === 'text').map(n => n.text).filter(t => t.startsWith('b ')), a.find(n => n.t === 'toggle').on];
  assert.deepEqual(shown(), [['b A 0', 'b B 1'], true]);
  a.applyEdit(P('A|B', '"Heading"\n'));
  assert.deepEqual(shown(), [['b A 0', 'b B 1'], true], 'a line above the each');
  a.applyEdit(P('A|Beta was B', '"Heading"\n'));
  assert.deepEqual(shown(), [['b A 0', 'b Beta 1'], true], 'an option renamed');
  assert.deepEqual(load(a.source, { data: a.snapshot() }).findAll(n => n.t === 'text').map(n => n.text).filter(t => t.startsWith('b ')), ['b A 0', 'b Beta 1']);
  void r;
});

test('round 10 S2a: block state saved by line position (before round 10) is migrated at load; state of gone rows is dropped', () => {
  const S = 'app "T"\ntable s n num\neach s\n  state open bool = no\n  toggle open\n';
  const a = load(S); const r1 = a.addRow('s', { n: 1 }); const r2 = a.addRow('s', { n: 2 });
  a.tree();
  const snap = a.snapshot();
  const keys = Object.keys(snap.data.state).filter(k => k.startsWith('/'));
  for (const k of keys) { const v = snap.data.state[k]; delete snap.data.state[k]; snap.data.state[k.replace(/^\/q:s@/, '/n.1@')] = k.includes('@r' + r1.id) ? true : v; }
  snap.data.state[`/n.1@r999|open`] = true; // a row that is gone
  const b = load(a.source, { data: snap });
  assert.deepEqual(b.findAll(n => n.t === 'toggle').map(n => n.on).sort(), [false, true]);
  assert.ok(!Object.keys(b.data.state).some(k => k.includes('r999')));
  void r2;
});

test('round 10 S2b: the added time and dates reject impossible values; the stored value stays', () => {
  const a = load('app "T"\ntable s d date?, w when?\nlist s\n'); const r = a.addRow('s', {});
  const t = { table: 's', id: r.id };
  for (const v of ['', null, NaN, Infinity, 1e20, 'abc']) assert.equal(a.setField(t, 'at', v), false, String(v));
  for (const v of ['2026-02-30', '2026-13-01', '0000-00-00', '10000-01-01']) assert.equal(a.setField(t, 'd', v), false, v);
  for (const v of [1e20, -8640000000000001, 'x']) assert.equal(a.setField(t, 'w', v), false, String(v));
  assert.equal(a.setField(t, 'd', '2026-02-28'), true);
  assert.equal(a.rows('s')[0].at, r.at);
});

test('round 10 S3: Undo clears the edge of a when that is false again; an operation that changes nothing records no step', () => {
  const a = load('app "T"\ntable log x num\nsetting g num 0..10 = 5\nbutton "b" tap add log x = 1\nwhen count(log) > 1 notify "many"\n');
  const tap = () => a.dispatch(a.find(n => n.t === 'button').id, 'tap');
  tap(); tap();
  assert.equal(a.log.filter(e => e.kind === 'notify').length, 1);
  a.undo(); tap();
  assert.equal(a.log.filter(e => e.kind === 'notify').length, 2, 'it may notify again after Undo made it false');
  const n = a.undoStack.length;
  a.setField('g', null, 5);
  assert.equal(a.undoStack.length, n, 'setting the same value records no step');
});

// ---- round 11: statement identity, caches by generation, exact catch-up ----
const tapT = (a, t) => a.dispatch(a.find(n => (n.t === 'button' && n.text === t) || (n.t === 'toggle')).id, 'tap');
test('round 11 A1: adding or removing an unrelated line never re-fires a true when (also after a restart)', () => {
  const S = h => `app "W"\ntable log x num\n${h}button "b" tap add log x = 1\nwhen count(log) > 0 add log x = 9 then notify "first"\n"n" count(log)\n`;
  const a = load(S('')); tapT(a, 'b');
  assert.equal(a.rows('log').length, 2);
  a.applyEdit(S('"Heading"\n')); a.tick(1000);
  a.applyEdit(S('"Heading"\n"Second"\n')); a.tick(1000);
  const b = load(a.source, { data: a.snapshot(), now: a.clock }); b.tick(1000);
  assert.deepEqual([a.rows('log').length, b.rows('log').length, a.log.filter(e => e.kind === 'notify').length], [2, 2, 1]);
});

test('round 11 A2: a running timer keeps running when another timer or a line is inserted above it', () => {
  const a = load('app "T"\ntimer 2m, "Two"\n');
  tapT(a, 'Start'); a.tick(30000);
  a.applyEdit('app "T"\ntimer 5m, "Five"\n"Heading"\ntimer 2m, "Two"\n'); a.tick(30000);
  assert.ok(a.findAll(n => n.t === 'text').some(n => n.text === '1:00'), JSON.stringify(a.findAll(n => n.t === 'text').map(n => n.text)));
});

test('round 11 A3: two each blocks over one table with a same-named state are two states; was inside one touches only it', () => {
  const P = n => `app "B"\ntable s x num\neach s\n  state ${n} num = 0\n  "A" ${n}\n  button "a" tap set ${n} = ${n} + 1\neach s\n  state n num = 0\n  "B" n\n  button "b" tap set n = n + 10\n`;
  const a = load(P('n')); a.addRow('s', { x: 1 });
  tapT(a, 'a'); tapT(a, 'b');
  const shown = () => a.findAll(n => n.t === 'text').map(n => n.text);
  assert.deepEqual(shown(), ['A 1', 'B 10']);
  a.applyEdit(P('m was n').replace(/"A" m was n/, '"A" m').replace(/set m was n = m was n \+ 1/, 'set m = m + 1'));
  assert.deepEqual(shown(), ['A 1', 'B 10']);
});

test('round 11 A4/A5: restore migrates old keys like load; an idle timer shows the length after an edit or a setting change', () => {
  const S = 'app "F"\nsetting work dur = 25m\ntimer work, "Focus"\n';
  const a = load(S);
  a.setField('work', null, 1800);
  assert.ok(a.findAll(n => n.t === 'text').some(n => n.text === '30:00'));
  a.applyEdit('app "F"\nsetting work dur = 25m\ntimer 10m, "Focus"\n');
  assert.ok(a.findAll(n => n.t === 'text').some(n => n.text === '10:00'));
  const T = 'app "T"\ntable s n num\neach s\n  state open bool = no\n  toggle open\n';
  const b = load(T); b.addRow('s', { n: 1 }); tapT(b, ''); const old = b.snapshot();
  const k = Object.keys(old.data.state).find(x => x.startsWith('/')); old.data.state['/n.1@r1|open'] = old.data.state[k]; delete old.data.state[k];
  b.addRow('s', { n: 2 });
  assert.equal(b.restore(old).ok, true);
  assert.equal(b.find(n => n.t === 'toggle').on, true, 'restore converts a key by line position, as load does');
});

test('round 11 B: caches follow the data generation; handlers hold ids; tap, undo, tap, tap with no tree in between', () => {
  const a = load('app "R"\ntable item q text, n num = 0\ntable ans item ref item\neach ans as r\n  r.item.q\n  r.item.n\n  button "inc" tap set r.item.n = r.item.n + 1\n', { freezeTree: true });
  const it = a.addRow('item', { q: 'one' }); a.addRow('ans', { item: it.id });
  const id = a.find(n => n.t === 'button').id;
  a.setField({ table: 'item', id: it.id }, 'q', 'two'); a.undo();
  assert.deepEqual(a.findAll(n => n.t === 'text').map(n => n.text), ['one', '0']);
  a.dispatch(id, 'tap'); a.undo(); a.dispatch(id, 'tap'); a.dispatch(id, 'tap');
  assert.equal(a.rows('item')[0].n, 2);
  const t = a.tree(); assert.throws(() => { t.children.push(1); }, TypeError, 'a frozen tree cannot be changed by a caller');
});

test('round 11 C: catch-up matches step-by-step ticks; Undo cancels an after; time-dependent every keeps firing', () => {
  const S = 'app "D"\ntable t n num\nevery 1h if count(t today) < 3 add t n = 1\n"n" count(t)\n';
  const x = load(S), y = load(S);
  x.tick(5 * 86400000); for (let i = 0; i < 120; i++) y.tick(3600000);
  assert.deepEqual([x.rows('t').length, JSON.stringify(x.data)], [y.rows('t').length, JSON.stringify(y.data)]);
  const a = load('app "A"\ntable log x num\nbutton "b" tap add log x = 1 then after 90s add log x = 2\n');
  tapT(a, 'b'); a.undo(); a.tick(120000);
  assert.equal(a.rows('log').length, 0, 'the after of an undone step does not run');
});

test('round 11 D: time, dur and moment checks; an invalid now; revert ends a change group', () => {
  const a = load('app "T"\ntable s t time?, d dur?\nlist s\n'); const r = a.addRow('s', {});
  for (const v of ['25:00', '12:60']) assert.equal(a.setField({ table: 's', id: r.id }, 't', v), false);
  for (const v of [-1, Infinity]) assert.equal(a.setField({ table: 's', id: r.id }, 'd', v), false);
  assert.equal(a.setField({ table: 's', id: r.id }, 'at', Date.parse('1900-01-01T00:00:00Z')), true);
  assert.equal(load('app "T"\n', { now: 'nope' }).ok, false);
  const b = load('app "G"\nsetting g num = 1\nfield g\n'); const g = () => b.find(n => n.t === 'input');
  b.dispatch(g().id, 'change', 2); b.revert(); b.dispatch(g().id, 'change', 3); b.undo();
  assert.equal(b.data.settings.g, 2, 'the change after a revert is its own step');
});

test('lockstep fuzz: 150 chains (reload, undo, twin and tick checks)', async () => {
  const { runLockstep } = await import('./fuzz-lockstep.mjs');
  const r = runLockstep(150, 3);
  assert.equal(r.violations.length, 0, JSON.stringify(r.violations.slice(0, 2)));
  assert.ok(r.programs >= 30 && r.twinChecks > 50 && r.tickChecks > 50);
});
