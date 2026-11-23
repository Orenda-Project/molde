// Features the 30 examples do not use, checked here so SPEC.md never promises something untested:
// images, choice on a pick state with a bare option word, scroll, span, icon from a formula,
// remind every/from/to with a condition, remind on weekdays, toggle as a tap action.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { check } from '../check.mjs';
import { format } from '../format.mjs';

const SPOT = `app "Spot" plant mint
table plant name text, photo image?, every_days num 1..60 = 7
table water plant ref plant
state view pick Grid|List = Grid
remind "Water the plants" every 2h from 9:00 to 21:00 if count(plant, since(it.water) >= it.every_days) > 0
choice view
if view = Grid
  grid 2 gap 1
    each plant as p
      stack card tap toggle p.water
        image p.photo height 80
        p.name bold
        "watered" since(p.water) "days ago" faint
        icon if(since(p.water) >= p.every_days, "drop", "check") color if(since(p.water) >= p.every_days, warn, good)
else
  scroll gap 1
    each plant sort name
      it.name span 2
remind "Check plants" at 8:00 on mon thu
form plant
`;

test('spec features outside the examples check and are canonical', () => {
  assert.deepEqual(check(SPOT).errors.map(String), []);
  assert.equal(format(SPOT), SPOT);
});
