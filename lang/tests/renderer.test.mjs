// Round 3 part 5: what the renderer asked for, and the generic holes, checked in the evaluator.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from '../eval.mjs';
import { check } from '../check.mjs';
import { format } from '../format.mjs';

const run = (src, o) => { assert.equal(format(src), src, 'not canonical'); const a = load(src, o); assert.ok(a.ok, a.errors.join('\n')); return a; };
const texts = a => a.findAll(n => ['text', 'button', 'label'].includes(n.t)).map(n => n.text);
const tapText = (a, t) => assert.ok(a.dispatch(a.find(n => n.text === t).id, 'tap'));

test('plot: data coordinates, x ticks from tick lines, y ticks from the range', () => {
  const a = run('app "C" chart ink\nplot 0..3, 0..100 axes gridlines\n  rect 0.2, 0, 0.6, 40 fill accent\n  tick 0.5, "Mon"\n');
  const p = a.find(n => n.t === 'plot');
  assert.deepEqual([p.x, p.y, p.axes, p.gridlines], [[0, 3], [0, 100], true, true]);
  assert.deepEqual(p.ticks.x, [{ v: 0.5, label: 'Mon' }]);
  assert.deepEqual(p.ticks.y.map(t => t.v), [0, 25, 50, 75, 100]);
  assert.deepEqual(p.children.map(c => [c.t, c.x, c.y, c.w, c.h]), [['rect', 0.2, 0, 0.6, 40]]);
});

test('std daybars is a plot with axes, a bar and a day label per day', () => {
  const a = run('app "W" drop ocean\ntable drink ml num\nquick drink, ml, [250]\ndaybars last 7 days, sum(drink.ml on it)\n');
  tapText(a, '250');
  const p = a.find(n => n.t === 'plot');
  assert.equal(p.axes, true);
  assert.equal(p.children.length, 7);
  assert.equal(p.ticks.x.length, 7);
  assert.equal(p.children[6].h, 250);
  assert.equal(p.y[1], 250);
});

test('joining and number formatting', () => {
  const a = run('app "F" calc slate\nstate r num = 120\nstate w num = 3\njoin(r, "/", w) fixed(2.5, 2) compact(81500) grouped(1234) plural(1, "day") plural(3, "day") monthshort(today) pow(2, 10)\n');
  assert.deepEqual(texts(a), ['120/3 2.50 81.5k 1,234 1 day 3 days Nov 1024']);
});

test('currency comes from the locale option; cents show 2 decimals; other years show the year', () => {
  const a = run('app "M" coin mint\nstate m money = 1200\nstate c money = 2.5\nstate d date = today\nbutton "old" tap set d = addmonths(d, -12)\ntext m c d\n', { currency: 'Rs' });
  assert.deepEqual(texts(a).slice(1), ['Rs 1200 Rs 2.50 Mon 23 Nov']);
  tapText(a, 'old');
  assert.ok(texts(a)[1].endsWith('Sun 23 Nov 2025'), texts(a)[1]);
});

test('each ... empty shows a message when there is nothing; std list uses it', () => {
  const a = run('app "L" list mint\ntable item name text\nlist item\neach item empty "No items"\n  it.name\n');
  assert.deepEqual(texts(a), ['Nothing here yet. Add one to see it here.', 'No items']);
});

test('layout: ratio, middle and full on blocks', () => {
  const a = run('app "B" grid ink\nstack middle full\n  box ratio 1 fill soft\n');
  const st = a.find(n => n.t === 'stack').style;
  assert.deepEqual([st.middle, st.full], [true, true]);
  assert.equal(a.find(n => n.t === 'box').style.ratio, 1);
});

test('tree: toggles and choices carry a label; buttons say what they do', () => {
  const a = run('app "P" mosque mint\ntable prayer name pick Fajr|Zuhr\nstate view pick Grid|List = Grid\neach options prayer.name\n  toggle prayer today where name = it\nchoice view\nbutton "Add" tap add prayer name = Fajr\n');
  assert.deepEqual(a.findAll(n => n.t === 'toggle').map(n => n.label), ['Fajr', 'Zuhr']);
  assert.equal(a.find(n => n.t === 'choice').label, 'view');
  assert.equal(a.find(n => n.t === 'button').action, 'add');
});

test('editor API: fields() and setField(), one undo per field edit', () => {
  const a = run('app "E" list mint\ntable item name text, qty num 0..10\nsetting goal num = 3 "Goal"\nbutton "add" tap add item name = "a", qty = 1\n');
  tapText(a, 'add');
  const row = a.data.tables.item[0];
  const fs = a.fields({ table: 'item', id: row.id });
  assert.deepEqual(fs.map(f => [f.name, f.kind, f.value]).slice(0, 2), [['name', 'text', 'a'], ['qty', 'num', 1]]);
  a.setField({ table: 'item', id: row.id }, 'qty', 99);
  assert.equal(a.data.tables.item[0].qty, 10); // kept inside its range
  a.setField('goal', null, 8);
  assert.equal(a.fields('goal')[0].value, 8);
  a.undo();
  assert.equal(a.fields('goal')[0].value, 3);
  // typing: many change events on one input are one undo step
  const b = run('app "T" pen ink\nstate q text = ""\nfield q "Search"\n');
  const id = b.find(n => n.t === 'input').id;
  for (const v of ['a', 'ab', 'abc']) b.dispatch(id, 'change', v);
  b.undo();
  assert.equal(b.find(n => n.t === 'input').value, '');
});

test('an edit that changes a setting\'s starting value sets it ("count to 100"); a restore does not', () => {
  const v1 = 'app "T" beads mint\nsetting target num = 33 "Count to"\ntext target\n';
  const a = run(v1);
  a.setField('target', null, 50);
  assert.equal(a.applyEdit('app "T" beads mint\nsetting target num = 100 "Count to"\ntext target\n').verdict, 'safe');
  assert.deepEqual(texts(a), ['100']);
  a.applyEdit('app "T" beads mint\nsetting target num = 100 "Count to"\n"Target" target\n');
  assert.deepEqual(texts(a), ['Target 100']);
});

test('nth row, a random row in an action, shuffle keeps a stable order', () => {
  const a = run('app "Cards" cards plum\ntable card front text\nstate pick text = ""\nbutton "add" tap add card front = "x"\nnth(card sort front, 1)\nbutton "draw" tap set pick = random(card).front\neach card shuffle\n  it.front\n', { seed: 2 });
  for (let i = 0; i < 3; i++) tapText(a, 'add');
  tapText(a, 'draw');
  const order1 = a.findAll(n => n.t === 'text').map(n => n.id).join();
  const order2 = a.findAll(n => n.t === 'text').map(n => n.id).join();
  assert.equal(order1, order2);
  assert.equal(check('app "x"\ntable card front text\ntext random(card).front\n').errors[0].code, 'E_CONTEXT');
});

test('after DUR runs an action later', () => {
  const a = run('app "D" timer ink\nstate flash bool = no\ntext flash\nbutton "go" tap set flash = yes then after 2s set flash = no\n');
  tapText(a, 'go');
  assert.equal(texts(a)[0], 'Yes');
  a.tick(1000);
  assert.equal(texts(a)[0], 'Yes');
  a.tick(1500);
  assert.equal(texts(a)[0], 'No');
});

test('a let formula can take a row', () => {
  const a = run('app "S" package slate\ntable item name text, qty num, price money\nlet value(r item) = r.qty * r.price\nbutton "add" tap add item name = "a", qty = 3, price = 2.5\neach item as i\n  text value(i)\n"Last" value(last(item))\n');
  tapText(a, 'add');
  assert.deepEqual(texts(a).slice(1), ['7.50', 'Last 7.50']);
});

test('reminders skip times in the past; local time option', () => {
  const a = run('app "R" bell ink\ntable due name text, on date\nremind "Soon" at due.on\nbutton "a" tap add due name = "old", on = today - 3\nbutton "b" tap add due name = "new", on = today + 3\n');
  tapText(a, 'a'); tapText(a, 'b');
  assert.equal(a.reminders().length, 1);
  const b = run('app "Z" clock ink\nhour(now)\n', { now: '2026-11-23T22:00:00Z', tz: 300 });
  assert.deepEqual(texts(b), ['3']); // 22:00 UTC is 03:00 the next day at +5:00
});
