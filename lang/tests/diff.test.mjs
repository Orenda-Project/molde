// Data safety: the verdict uses the whole schema history (hidden fields included).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diff } from '../diff.mjs';
import { runFuzz } from './fuzz-diff.mjs';

const P = (tables, ui = 'list drink') => `app "A" drop ocean\n${tables}\n${ui}\n`;
const has = (r, re) => assert.ok([...r.changes, ...r.refused, ...r.notes].some(x => re.test(x)), JSON.stringify(r, null, 1));

// the critic's cases (/tmp/molde-crit-p0/ds), written out so the test stands alone
const a = P('table drink ml num 1..5000');
const cases = [
  ['drop a field: hidden, not dropped', [a], P('table drink note text?'), 'safe', /hides field drink.ml \(values are kept/],
  ['drop then re-add with another type: refused', [a, P('table drink note text?')], P('table drink ml text?'), 'refused', /drink.ml would change from number to text \(it was hidden/],
  ['drop then re-add as a pick: refused', [a, P('table drink note text?')], P('table drink ml pick a|b'), 'refused', /would change from number to a choice/],
  ['drop then re-add with the same type: data comes back', [a, P('table drink note text?')], a, 'safe', /shows drink.ml again/],
  ['field rename without was: refused as a rename', [a], P('table drink amount num 1..5000'), 'refused', /looks like a rename.*amount num was ml/],
  ['field rename with was: moves the values', [a], P('table drink amount num 1..5000 was ml'), 'safe', /renames drink.ml to amount/],
  ['table rename without was: refused as a rename', [a], P('table drinks ml num 1..5000', 'list drinks'), 'refused', /looks like a rename.*table drinks was drink/],
  ['table rename with was: moves the rows', [a], P('table drinks was drink ml num 1..5000', 'list drinks'), 'safe', /renames table drink to drinks/],
  ['a kept was is a no-op later', [a, P('table drinks was drink ml num 1..5000', 'list drinks')], P('table drinks was drink ml num 1..5000, note text?', 'list drinks'), 'safe', /adds field drinks.note/],
  ['ref to another table: refused', ['app "B" drop ocean\ntable x name text, n num\ntable y xr ref x\nlist y\n'], 'app "B" drop ocean\ntable x name text, n num\ntable z name text\ntable y xr ref z\nlist y\n', 'refused', /from a link to x to a link to z/],
  ['ref follows a renamed target', ['app "B"\ntable x name text\ntable y xr ref x\nlist y\n'], 'app "B"\ntable w was x name text\ntable y xr ref w\nlist y\n', 'safe', /renames table x to w/],
  ['pick option renamed without was: old option stays available', ['app "C"\ntable s cat pick Food|Bills|Travel\nlist s\n'], 'app "C"\ntable s cat pick Meals|Bills|Travel\nlist s\n', 'safe', /option Food is no longer listed, but rows keep it and it stays selectable/],
  ['pick option renamed with was: rows move', ['app "C"\ntable s cat pick Food|Bills|Travel\nlist s\n'], 'app "C"\ntable s cat pick Meals was Food|Bills|Travel\nlist s\n', 'safe', /renames option Food of s.cat to Meals/],
  ['pick to text and num to money: widen', ['app "D"\ntable s cat pick Food|Bills = Food, n num\nlist s\n'], 'app "D"\ntable s cat text, n money\nlist s\n', 'safe', /widens s.cat from a choice to text/],
  ['narrower range: safe with a note', ['app "E"\ntable s name text, qty num 0..\nlist s\n'], 'app "E"\ntable s name text, qty num 0..10\nlist s\n', 'safe', /range is narrower now; old values outside it are kept/],
  ['new required field without default: note', ['app "E"\ntable s name text, qty num 0..\nlist s\n'], 'app "E"\ntable s name text, qty num 0.., extra text\nlist s\n', 'safe', /extra is required but has no default/],
  ['text to ref: refused', ['app "F"\ntable s a text\ntable t b text\nlist s\n'], 'app "F"\ntable t b text\ntable s a ref t\nlist s\n', 'refused', /s.a would change from text to a link to t/],
  ['reorder tables: nothing changes', ['app "F"\ntable s a text\ntable t b text\nlist s\n'], 'app "F"\ntable t b text\ntable s a text\nlist s\n', 'safe', null],
  ['table hidden then re-added with another field type: refused', ['app "G"\ntable x n num\nlist x\n', 'app "G"\ntable y m num\nlist y\n'], 'app "G"\ntable x n text\nlist x\n', 'refused', /x.n would change from number to text/],
  ['ref field becomes text: refused', ['app "H"\ntable x n num\ntable y xr ref x\nlist y\n'], 'app "H"\ntable y xr text\nlist y\n', 'refused', /y.xr would change from a link to x to text/],
  ['option added then removed: stays available', ['app "I"\ntable s cat pick A|B|C\nlist s\n', 'app "I"\ntable s cat pick A|B|C|D\nlist s\n'], 'app "I"\ntable s cat pick A|B|D\nlist s\n', 'safe', /option C is no longer listed/],
  ['num and money swap: both widen', ['app "J"\ntable s n num 0..10, m money\nlist s\n'], 'app "J"\ntable s n money 0..10, m num\nlist s\n', 'safe', /widens s.n from number to money/],
  ['setting retyped: refused', ['app "K"\nsetting goal num = 3\n'], 'app "K"\nsetting goal text = "a"\n', 'refused', /setting goal would change/],
  ['setting hidden then back: value returns', ['app "K"\nsetting goal num = 3\n', 'app "K"\n'], 'app "K"\nsetting goal num = 3\n', 'safe', /shows setting goal again/],
  ['new program does not check: refused', [a], a + 'text nope\n', 'refused', /does not check/],
  ['add a view: safe', [a], a + 'daybars last 7 days, sum(drink.ml on it)\n', 'safe', /adds: daybars/],
  ['theme change', [a], a.replace('drop ocean', 'drop mint'), 'safe', /changes the theme to mint/],
];

for (const [name, hist, next, verdict, re] of cases) {
  test(`diff: ${name}`, () => {
    const r = diff(hist, next);
    assert.equal(r.verdict, verdict, JSON.stringify(r, null, 1));
    if (re) has(r, re);
  });
}

test('diff: a refused edit leaves the schema history unchanged', () => {
  const r = diff([a], P('table drink ml text'));
  assert.equal(r.verdict, 'refused');
  assert.deepEqual(r.ever.tables.drink.fields.ml.type, { t: 'num' });
});

test('diff fuzz: 300 random edit chains never lose or retype a stored value while the verdict is safe', () => {
  const r = runFuzz(300, 11);
  assert.equal(r.violations.length, 0, JSON.stringify(r.violations.slice(0, 2)));
  assert.ok(r.safe > 500 && r.refused > 50, JSON.stringify(r));
});
