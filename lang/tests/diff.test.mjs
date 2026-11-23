import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diff } from '../diff.mjs';

const A = 'app "W"\ntable drink ml num, kind pick Water|Tea\nsetting goal num = 2000\ntext sum(drink.ml today)\n';
const cases = [
  ['add a field: safe, old rows empty', A.replace('kind pick Water|Tea', 'kind pick Water|Tea, note text?'), 'safe', /adds field drink.note/],
  ['remove a field: hidden, not dropped', A.replace(', kind pick Water|Tea', ''), 'safe', /hides field drink.kind \(values are kept/],
  ['remove a table: hidden', 'app "W"\nsetting goal num = 2000\n', 'safe', /hides table drink/],
  ['change a field type: refused', A.replace('ml num', 'ml text').replace('text sum(drink.ml today)\n', ''), 'refused', /would change from number to text/],
  ['change a ref target: refused', 'app "W"\ntable a n text\ntable b n text\ntable c x ref a\n', 'refused', null, 'app "W"\ntable a n text\ntable b n text\ntable c x ref b\n'],
  ['widen num to money: safe', A.replace('ml num', 'ml money'), 'safe', /widens drink.ml/],
  ['widen text to long: safe', A.replace('kind pick Water|Tea', 'kind pick Water|Tea, note text?'), 'safe', /adds field/],
  ['add pick options: safe', A.replace('Water|Tea', 'Water|Tea|Juice'), 'safe', /adds options to drink.kind/],
  ['remove a pick option: safe, rows keep it', A.replace('Water|Tea', 'Water|Juice'), 'safe', /rows that used a removed option keep it/],
  ['change a setting type: refused', A.replace('goal num = 2000', 'goal text = "a"').replace('text sum(drink.ml today)', 'text goal'), 'refused', /setting goal/],
  ['new program does not check: refused', A + 'text nope\n', 'refused', /does not check/],
  ['rename looks like rename: safe with a note', A.replace('ml num', 'litres num').replace('drink.ml', 'drink.litres'), 'safe', /hides field drink.ml/],
  ['add a view: safe', A + 'daybars last 7 days, sum(drink.ml on it)\n', 'safe', /adds: daybars/],
  ['theme change', A.replace('app "W"', 'app "W" drop ocean'), 'safe', /changes the theme to ocean/],
];

for (const [name, after, verdict, re, before] of cases) {
  test(`diff: ${name}`, () => {
    const r = diff(before || A, after);
    assert.equal(r.verdict, verdict, JSON.stringify(r));
    if (re) assert.ok([...r.changes, ...r.refused, ...r.notes].some(x => re.test(x)), JSON.stringify(r));
  });
}

test('diff: a rename is reported as hide + add with a note, never as a move', () => {
  const r = diff(A, A.replace('ml num', 'litres num').replace('drink.ml', 'drink.litres'));
  assert.ok(r.notes.some(n => /looks like a rename/.test(n)));
});
