// Data safety: the verdict uses the whole schema history; slots keep every name they had.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diff, evolve, emptySchema } from '../diff.mjs';
import { runFuzz } from './fuzz-diff.mjs';

const P = (tables, ui = 'list drink') => `app "A" drop ocean\n${tables}\n${ui}\n`;
const Q = body => `app "T"\n${body}\nlist a\n`;
const has = (r, re) => assert.ok([...r.changes, ...r.refused, ...r.notes].some(x => re.test(x)), JSON.stringify(r, null, 1));

const a = P('table drink ml num 1..5000');
const cases = [
  // round 1 and 2 cases
  ['drop a field: hidden, not dropped', [a], P('table drink note text?'), 'safe', /hides field drink.ml \(values are kept/],
  ['drop then re-add with another type: refused', [a, P('table drink note text?')], P('table drink ml text?'), 'refused', /drink.ml would change from number to text \(it was hidden/],
  ['drop then re-add as a pick: refused', [a, P('table drink note text?')], P('table drink ml pick a|b'), 'refused', /would change from number to a choice/],
  ['drop then re-add with the same type: data comes back', [a, P('table drink note text?')], P('table drink ml num 1..5000, note text?'), 'safe', /shows drink.ml again/],
  ['field rename without was: refused as a rename', [a], P('table drink amount num 1..5000'), 'refused', /looks like a rename.*amount num was ml/],
  ['field rename with was: moves the values', [a], P('table drink amount num 1..5000 was ml'), 'safe', /renames drink.ml to amount/],
  ['table rename without was: refused as a rename', [a], P('table drinks ml num 1..5000', 'list drinks'), 'refused', /looks like a rename.*table drinks was drink/],
  ['table rename with was: moves the rows', [a], P('table drinks was drink ml num 1..5000', 'list drinks'), 'safe', /renames table drink to drinks/],
  ['a kept was is a no-op later', [a, P('table drinks was drink ml num 1..5000', 'list drinks')], P('table drinks was drink ml num 1..5000, note text?', 'list drinks'), 'safe', /adds field drinks.note/],
  ['ref to another table: refused', ['app "B"\ntable x name text, n num\ntable y xr ref x\nlist y\n'], 'app "B"\ntable x name text, n num\ntable z name text\ntable y xr ref z\nlist y\n', 'refused', /from a link to x to a link to z/],
  ['ref follows a renamed target', ['app "B"\ntable x name text\ntable y xr ref x\nlist y\n'], 'app "B"\ntable w was x name text\ntable y xr ref w\nlist y\n', 'safe', /renames table x to w/],
  ['pick option renamed without was: old option stays on its rows', ['app "C"\ntable s cat pick Food|Bills|Travel\nlist s\n'], 'app "C"\ntable s cat pick Meals|Bills|Travel\nlist s\n', 'safe', /option Food is no longer listed. Rows that have it keep it and still show it, but it is not offered for new rows and formulas cannot name it/],
  ['pick option renamed with was: rows move', ['app "C"\ntable s cat pick Food|Bills|Travel\nlist s\n'], 'app "C"\ntable s cat pick Meals was Food|Bills|Travel\nlist s\n', 'safe', /renames option Food of s.cat to Meals/],
  ['pick to text and num to money: widen', ['app "D"\ntable s cat pick Food|Bills = Food, n num\nlist s\n'], 'app "D"\ntable s cat text, n money\nlist s\n', 'safe', /widens s.cat from a choice to text/],
  ['narrower range: safe with a note', ['app "E"\ntable s name text, qty num 0..\nlist s\n'], 'app "E"\ntable s name text, qty num 0..10\nlist s\n', 'safe', /range is narrower now/],
  ['new required field without default: note', ['app "E"\ntable s name text, qty num 0..\nlist s\n'], 'app "E"\ntable s name text, qty num 0.., extra text\nlist s\n', 'safe', /extra is required but has no default/],
  ['text to ref: refused', ['app "F"\ntable s a text\ntable t b text\nlist s\n'], 'app "F"\ntable t b text\ntable s a ref t\nlist s\n', 'refused', /s.a would change from text to a link to t/],
  ['reorder tables: nothing changes', ['app "F"\ntable s a text\ntable t b text\nlist s\n'], 'app "F"\ntable t b text\ntable s a text\nlist s\n', 'safe', null],
  ['table hidden then re-added with another field type: refused', ['app "G"\ntable x n num\nlist x\n', 'app "G"\ntable y m num\nlist y\n'], 'app "G"\ntable x n text\nlist x\n', 'refused', /x.n would change from number to text/],
  ['option added then removed: stays available', ['app "I"\ntable s cat pick A|B|C\nlist s\n', 'app "I"\ntable s cat pick A|B|C|D\nlist s\n'], 'app "I"\ntable s cat pick A|B|D\nlist s\n', 'safe', /option C is no longer listed/],
  ['num and money swap: both widen', ['app "J"\ntable s n num 0..10, m money\nlist s\n'], 'app "J"\ntable s n money 0..10, m num\nlist s\n', 'safe', /widens s.n from number to money/],
  ['setting retyped: refused', ['app "K"\nsetting goal num = 3\n'], 'app "K"\nsetting goal text = "a"\n', 'refused', /setting goal would change/],
  ['setting hidden then back: value returns', ['app "K"\nsetting goal num = 3\n', 'app "K"\n'], 'app "K"\nsetting goal num = 3, \n'.replace(', \n', '\n') + 'text goal\n', 'safe', /shows setting goal again/],
  ['new program does not check: refused', [a], a + 'text nope\n', 'refused', /does not check/],
  // round 3: slots keep every name (the critic's slot.mjs and slot2.mjs chains)
  ['slot.mjs: renaming y onto the hidden name x is refused (x would become unreachable)', [Q('table a x num, y num'), Q('table a y num')], Q('table a x num was y'), 'refused', /no name to bring them back/],
  ['slot2.mjs: was resolves to the slot last seen under that name', [Q('table a x num, y num'), Q('table a y num'), Q('table a z text'), Q('table a x num')], Q('table a x num, w num was y'), 'safe', /shows a.w|renames a.y to w|w/],
  ['slot2.mjs: was naming a visible field without its own was is refused', [Q('table a x num, y num')], Q('table a x num, w num was x'), 'refused', /still a field/],
  ['swap two fields with was: simultaneous', [Q('table a x num, y num')], Q('table a x num was y, y num was x'), 'safe', /renames a.x to y/],
  ['swap two tables with was', ['app "T"\ntable p n text\ntable q n text\ntable c who ref p\nlist c\n'], 'app "T"\ntable q was p n text\ntable p was q n text\ntable c who ref q\nlist c\n', 'safe', /renames table p to q/],
  ['two fields claiming one was: refused', [Q('table a x num')], Q('table a p num was x, q num was x'), 'refused', /two fields say they were x/],
  ['was naming a field that never existed: refused', [Q('table a x num')], Q('table a p num was zzz'), 'refused', /never was a field called zzz/],
  ['a new field cannot take an earlier name of another field', [Q('table a x num'), Q('table a y num was x')], Q('table a y num, x text'), 'refused', /x is an earlier name of the field now called y/],
  ['option swap with was is simultaneous', [Q('table a k pick Food|Bills')], Q('table a k pick Food was Bills|Bills was Food'), 'safe', /renames option Food of a.k to Bills/],
  ['two options claiming one was: refused', [Q('table a k pick Food|Bills')], Q('table a k pick Meals was Food|Snacks was Food|Bills'), 'refused', /two options say they were Food/],
  ['option was naming an option that never existed: refused', [Q('table a k pick Food|Bills')], Q('table a k pick Meals was Fod|Bills'), 'refused', /never was an option Fod/],
  ['option rename that would merge into an existing option: refused', [Q('table a k pick Food|Bills')], Q('table a k pick Bills was Food|Rent'), 'refused', /merge Food into the existing option Bills/],
  ['setting rename without was: refused (the saved value would reset)', ['app "K"\nsetting g num = 5\ntext g\n'], 'app "K"\nsetting goal num = 5\ntext goal\n', 'refused', /setting g disappears.*was g/],
  ['setting rename with was keeps the value', ['app "K"\nsetting g num = 5\ntext g\n'], 'app "K"\nsetting goal num = 5 was g\ntext goal\n', 'safe', /renames setting g to goal/],
  ['state rename without was: refused', ['app "K"\nstate tab text = "a"\ntext tab\n'], 'app "K"\nstate page text = "a"\ntext page\n', 'refused', /state tab disappears/],
  ['state rename with was keeps the value', ['app "K"\nstate tab text = "a"\ntext tab\n'], 'app "K"\nstate page text = "a" was tab\ntext page\n', 'safe', /renames state tab to page/],
  // round 3: restore is never refused
  ['restore of an earlier version after a widening', [Q('table a k text'), Q('table a k long')], Q('table a k text'), 'restore', /restores version 1/],
  ['restore after a rename and an added field', [Q('table a x num'), Q('table a y num was x, z text')], Q('table a x num'), 'restore', /hides field a.z/],
];

for (const [name, hist, next, verdict, re] of cases) {
  test(`diff: ${name}`, () => {
    const r = diff(hist, next, verdict === 'restore' ? { restore: true } : {});
    assert.equal(r.verdict, verdict, JSON.stringify(r, null, 1));
    if (re) has(r, re);
  });
}

test('diff: a restore maps names back to the same slots (data stays)', () => {
  let ever = emptySchema();
  for (const s of [Q('table a x num'), Q('table a y num was x, z text')]) ever = evolve(ever, s).ever;
  const r = evolve(ever, Q('table a x num'), { restore: true });
  assert.equal(r.verdict, 'restore');
  const map = r.ever.versions.at(-1).map;
  assert.equal(map.fields[map.tables.a].x, 'x');
  assert.equal(r.ever.tables.a.fields.z.visible, null);
});

test('diff: an edit equal to an older text is judged as an edit (only an explicit restore is a restore)', () => {
  const r = diff([Q('table a k text'), Q('table a k long')], Q('table a k text'));
  assert.equal(r.verdict, 'refused');
  assert.equal(diff([Q('table a x num'), Q('table a y num was x')], Q('table a x num was y')).verdict, 'safe');
});

test('diff: a restore undoes later option renames', () => {
  const r = diff([Q('table a k pick Food|Bills'), Q('table a k pick Meals was Food|Bills')], Q('table a k pick Food|Bills'), { restore: true });
  assert.equal(r.verdict, 'restore');
  assert.deepEqual(r.moves[0].map, { Meals: 'Food' });
});

test('diff: setting defaults never overwrite a saved value; "set" does, and says so', () => {
  const h = ['app "K"\nsetting g num = 5\ntext g\n'];
  const r1 = diff(h, 'app "K"\nsetting g num = 9\ntext g\n');
  assert.equal(r1.verdict, 'safe'); assert.ok(r1.notes.some(n => /only fills an empty setting/.test(n)));
  const r2 = diff(h, 'app "K"\nsetting g num = 9 set\ntext g\n');
  assert.ok(r2.changes.some(c => /sets the saved value of setting g to 9/.test(c)));
});

test('diff: a refused edit leaves the schema history unchanged', () => {
  const r = diff([a], P('table drink ml text'));
  assert.equal(r.verdict, 'refused');
  assert.deepEqual(r.ever.tables.drink.fields.ml.type, { t: 'num' });
});

test('diff fuzz: 200 random edit chains keep every stored value reachable and typed', () => {
  const r = runFuzz(200, 11);
  assert.equal(r.violations.length, 0, JSON.stringify(r.violations.slice(0, 2)));
  assert.ok(r.safe > 400 && r.refused > 50 && r.restore > 20, JSON.stringify(r));
});
