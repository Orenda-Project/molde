// Model-facing errors: each common slip gets one specific message and fix (never a list of
// operators), so a tiny model can repair it in one try.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { check } from '../check.mjs';
import { format } from '../format.mjs';

const HEAD = 'app "x"\ntable t n num\nsetting goal num = 3\nstate n num = 1\nstate x num = 1\nstate tab text = "a"\nstate w time = 7:00\nstate b time = 23:00\n';
const CASES = [
  ['a std name used as a value with a style', 'goal faint', 'E_SYNTAX', /start the line with text: text goal faint/],
  ['shape values without commas', 'draw\n  rect 0 0 10 10', 'E_SYNTAX', /values of rect must be separated by commas/],
  ['a shape with a missing value', 'draw\n  rect 0, 0, 10', 'E_SYNTAX', /rect needs 4 values \(X, Y, W, H\) but has 3/],
  ['a std call without commas', 'daybars last 7 days sum(t.n on it)', 'E_SYNTAX', /values of daybars.*separated by commas/],
  ['a std call with a missing value', 'goal 3', 'E_ARGS', /needs a value for target/],
  ['an unknown icon', 'icon hart', 'E_ICON', /closest is heart/],
  ['an uppercase table name', 'table Drinks ml num', 'E_SYNTAX', /small letters.*table drinks/],
  ['a one-value if()', '"a" if(n > 1)', 'E_ARGS', /if\(\) needs three values/],
  ['an option that is a colour word', 'table c cat pick red|Blue', 'E_OPTION', /colour word.*Red/],
  ['an option that is a state name', 'table c cat pick Red|tab', 'E_OPTION', /same name as your state.*Tab/],
  ['a state named like an option', 'table c cat pick Low|high\nstate high num = 1', 'E_OPTION', /already an option/],
];
for (const [name, line, code, re] of CASES) {
  test(`hint: ${name}`, () => {
    const e = check(HEAD + line + '\n').errors;
    const hit = e.find(x => x.code === code);
    assert.ok(hit, `wanted ${code}, got ${e.map(String).join(' | ')}`);
    assert.match(String(hit), re);
    assert.ok(!/expected "\*"|expected "-", "yes"/.test(String(hit)), 'a list of operators is not a hint');
  });
}

test('tabs and uneven indentation are normalised by the formatter', () => {
  const messy = 'app "x"\nrow\n\ttext "a"\n\trow\n\t\t"b"\nstack\n   "c"\n';
  const f = format(messy);
  assert.equal(f, 'app "x"\nrow\n  "a"\n  row\n    "b"\nstack\n  "c"\n');
  assert.ok(check(messy).ok && check(f).ok);
});
