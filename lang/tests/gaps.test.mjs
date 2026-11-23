// The level-1 features added for the coverage gaps, checked by meaning in the evaluator.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from '../eval.mjs';
import { check } from '../check.mjs';
import { format } from '../format.mjs';

const run = (src, o) => { assert.equal(format(src), src, 'not canonical'); const a = load(src, o); assert.ok(a.ok, a.errors.join('\n')); return a; };
const texts = a => a.findAll(n => ['text', 'button', 'label'].includes(n.t)).map(n => n.text);
const form = (a, values, button = 'Add') => {
  const f = a.find(n => n.t === 'form');
  for (const [k, v] of Object.entries(values)) a.dispatch(`${f.id}:${k}`, 'change', v);
  a.dispatch(a.find(n => n.t === 'button' && n.text === button).id, 'tap');
};

test('remind before a date field, at a time; monthly reminders', () => {
  const a = run('app "Bills" wallet slate\ntable bill name text, due date\nremind "Bill due soon" at bill.due - 3d at 9:00\nremind "Pay rent" monthly on 1, 15 at 10:00\nform bill\n');
  form(a, { name: 'Power', due: '2026-12-10' });
  const r = a.reminders();
  assert.equal(r.find(x => x.text === 'Bill due soon').once, '2026-12-07T09:00:00.000Z');
  assert.deepEqual(r.find(x => x.text === 'Pay rent').monthly, [1, 15]);
});

test('sort by a formula, including an aggregate over linked rows', () => {
  const a = run('app "Team" users ocean\ntable player name text\ntable goal player ref player\neach player sort count(it.goal) desc\n  it.name count(it.goal)\nform player\nbutton "Goal for B" tap add goal player = last(player)\n');
  form(a, { name: 'A' }); form(a, { name: 'B' });
  a.dispatch(a.find(n => n.text === 'Goal for B').id, 'tap');
  assert.deepEqual(texts(a).slice(0, 2), ['B 1', 'A 0']);
});

test('group by a field reached through a link', () => {
  const a = run('app "Meals" food mint\ntable dish name text, cuisine pick Desi|Chinese\ntable meal dish ref dish\neach meal by dish.cuisine\n  it.key count(it)\nstate d new dish\nfield d\nbutton "Save" tap save d\nbutton "Eat" tap add meal dish = last(dish)\n');
  const f = a.find(n => n.t === 'form');
  a.dispatch(f.id + ':name', 'change', 'Daal'); a.dispatch(f.id + ':cuisine', 'change', 'Desi');
  a.dispatch(a.find(n => n.text === 'Save').id, 'tap');
  a.dispatch(a.find(n => n.text === 'Eat').id, 'tap'); a.dispatch(a.find(n => n.text === 'Eat').id, 'tap');
  assert.ok(texts(a).includes('Desi 2'), JSON.stringify(texts(a)));
});

test('time parts, durations, date setting', () => {
  const a = run('app "Clock" clock ink\nsetting start date = today "Start"\nhour(now) ":" minute(now) month(today) year(today)\ntext today - start "days"\nminute(90m) second(75s)\n', { now: '2026-11-23T10:05:00Z' });
  assert.deepEqual(texts(a), ['10: 5 11 2026', '0 days', '30 15']);
});

test('random only inside actions, seeded', () => {
  assert.equal(check('app "x"\ntext random(6)\n').errors[0].code, 'E_CONTEXT');
  const a = run('app "Dice" dice plum\nstate roll num = 0\ntext roll big\nbutton "Roll" tap set roll = random(6)\n', { seed: 3 });
  a.dispatch(a.find(n => n.t === 'button').id, 'tap');
  const v = +texts(a)[0];
  assert.ok(v >= 1 && v <= 6);
});

test('sin, cos and pi place things on a circle; hue and named colours', () => {
  const a = run('app "Clock face" clock ink\ndraw\n  each 1..12\n    circle 50 + 40 * sin(it * 30), 50 - 40 * cos(it * 30), 3 fill hue(it * 30)\n  circle 4 fill red\nround(pi * 100)\n');
  const dots = a.findAll(n => n.t === 'circle');
  assert.equal(dots.length, 13);
  assert.deepEqual([dots[2].cx, dots[2].cy], [90, 50]); // item 3 is 90 degrees: straight right of the centre
  assert.equal(dots[2].style.fill, 'hue:90');
  assert.deepEqual([dots[12].cx, dots[12].cy, dots[12].style.fill], [50, 50, 'red']);
  assert.ok(texts(a).includes('314'));
});

test('set all and remove all, each with one undo', () => {
  const a = run('app "List" list mint\ntable item name text, got bool\ncount(item where got = yes) "got"\nbutton "Got all" tap set all item.got = yes\nbutton "Clear done" tap remove all item where got = yes\nform item\n');
  form(a, { name: 'a' }); form(a, { name: 'b' });
  a.dispatch(a.find(n => n.text === 'Got all').id, 'tap');
  assert.equal(texts(a)[0], '2 got');
  a.dispatch(a.find(n => n.text === 'Clear done').id, 'tap');
  assert.equal(texts(a)[0], '0 got');
  a.undo();
  assert.equal(texts(a)[0], '2 got');
});

test('arc with fill is a wedge; short circle and arc sit at the centre', () => {
  const a = run('app "Pie" chart ink\ndraw 200, 100\n  arc 40, 0, 120 fill accent\n  circle 10\n');
  const arc = a.find(n => n.t === 'arc');
  assert.deepEqual([arc.cx, arc.cy, arc.r, arc.from, arc.to, arc.style.fill], [100, 50, 40, 0, 120, 'accent']);
});

test('a formula with values (let f(x) = ...) and scalar min/max', () => {
  const a = run('app "F" calc slate\nlet sq(x num) = x * x\nlet hyp(a num, b num) = sq(a) + sq(b)\nhyp(3, 4) max(2, 7) min(2, 7)\n');
  assert.deepEqual(texts(a), ['25 7 2']);
  assert.equal(check('app "F"\nlet sq(x num) = x * x\nsq(1, 2)\n').errors[0].code, 'E_ARGS');
});

test('std captions default to a plain reading of the value', () => {
  const a = run('app "W" drop ocean\ntable drink ml num\nstat sum(drink.ml today)\n');
  assert.deepEqual(texts(a), ['0', 'total ml of drink today']);
});

test('since() of a table with no rows is empty, not 0', () => {
  const a = run('app "P" plant mint\ntable water\n"Watered" since(water) "days ago"\nsince(water)\nif since(water) >= 3\n  "Water me"\n');
  assert.deepEqual(texts(a), ['Watered days ago', '–']);
});
