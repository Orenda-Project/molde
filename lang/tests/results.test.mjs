// Wrong-result fixes (round 3): day-level date comparisons, time - time past midnight, due(),
// rounding, sums over non-numbers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from '../eval.mjs';
import { check } from '../check.mjs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LANG } from './lib.mjs';

const texts = a => a.findAll(n => ['text', 'button', 'label'].includes(n.t)).map(n => n.text);

test('a date compared with a date and time compares whole days: at <= today includes today', () => {
  const a = load('app "D"\ntable s n num\nbutton "add" tap add s n = 5\n"upto" sum(s.n where at <= today) "on" count(s where at = today) "after" count(s where at > today)\n', { now: '2026-11-23T18:00:00Z' });
  a.dispatch(a.find(n => n.t === 'button').id, 'tap');
  assert.deepEqual(texts(a).slice(1), ['upto 5 on 1 after 0']);
});

test('examples 04 and 08: the spending line counts today\'s spending on today', () => {
  for (const f of ['04-budget', '08-budget-plus']) {
    const a = load(readFileSync(join(LANG, 'examples', f + '.mo'), 'utf8'), { now: '2026-11-23T20:00:00Z' });
    const form = a.find(n => n.t === 'form');
    a.dispatch(form.id + ':amount', 'change', 40000);
    if (f === '04-budget') a.dispatch(form.id + ':what', 'change', 'Rent'), a.dispatch(form.id + ':category', 'change', 'Bills');
    a.dispatch(a.findAll(n => n.t === 'button').find(n => /^Add/.test(n.text)).id, 'tap');
    const poly = a.find(n => n.t === 'poly');
    const day23 = poly.points[22]; // the 23rd of November
    assert.equal(day23[1], 50 - 50 * 40000 / 80000, `${f}: ${JSON.stringify(day23)}`);
  }
});

test('time - time wraps past midnight; the sleep example is short', () => {
  const a = load('app "S"\nstate b time = 23:00\nstate w time = 7:00\nstate x time = 9:00\ntext w - b x - w\n');
  assert.deepEqual(texts(a), ['8:00 2:00']);
  const src = readFileSync(join(LANG, 'examples', '17-sleep-log.mo'), 'utf8');
  assert.ok(!src.includes('24h'));
});

test('date - when gives whole days', () => {
  const a = load('app "A"\ntable s n num\nbutton "add" tap add s n = 1\n"ago" today - last(s.at)\n', { now: '2026-11-23T10:00:00Z' });
  a.dispatch(a.find(n => n.t === 'button').id, 'tap');
  a.tick(3 * 86400000);
  assert.ok(texts(a).includes('ago 3'));
});

test('due(): never done or N days since; since() of nothing stays empty', () => {
  const src = 'app "P"\ntable water\n"due" due(water, 3) "since" since(water)\nbutton "w" tap add water\n';
  const a = load(src);
  assert.ok(texts(a).includes('due Yes since'));
  a.dispatch(a.find(n => n.t === 'button').id, 'tap');
  assert.ok(texts(a).includes('due No since 0'));
  a.tick(3 * 86400000);
  assert.ok(texts(a).includes('due Yes since 3'));
});

test('rounding is half away from zero; % of a negative number is never negative', () => {
  const a = load('app "R"\nround(2.5) round(-2.5) round(-2.4) -7 % 3\n');
  assert.deepEqual(texts(a), ['3 -3 -2 2']);
});

test('sum or avg of a time or text column is an error with a hint', () => {
  const e = check('app "x"\ntable night slept time\nsum(night.slept)\n').errors[0];
  assert.equal(e.code, 'E_TYPE');
  assert.match(String(e), /times of day cannot be added up/);
  assert.match(String(check('app "x"\ntable t name text\navg(t.name)\n').errors[0]), /use count\(t\) for how many/);
});

test('charts over a table go oldest to newest (time left to right), whatever the list order', () => {
  const a = load('app "W" scale mint\ntable w kg num\ntrend w, it.kg\nbars w, it.kg\nlist w\n');
  for (const [kg, d] of [[70, 0], [72, 1], [75, 2]]) a.addRow('w', { kg }, Date.parse('2026-11-20T08:00:00Z') + d * 86400000);
  assert.deepEqual(a.find(n => n.t === 'poly').points, [[0, 70], [1, 72], [2, 75]]);
  assert.deepEqual(a.findAll(n => n.t === 'plot')[1].children.map(r => r.h), [70, 72, 75]);
  assert.deepEqual(texts(a), ['75', '72', '70']); // the list stays newest first
});

test('money keeps full precision in formulas and rounds only when shown', () => {
  const a = load('app "M" coin mint\nstate m money = 1\nstate p money = 0.1\nstate q money = 0.2\ntext m / 3 * 3 (p + q) * 1000000\n');
  assert.deepEqual(texts(a), ['1 300,000']);
});

test('empty values sort last, also with desc', () => {
  const a = load('app "S" list mint\ntable t n num?\neach t sort n desc\n  text it.n\n');
  a.addRow('t', { n: 1 }); a.addRow('t', {}); a.addRow('t', { n: 3 });
  assert.deepEqual(texts(a), ['3', '1', '–']);
});

test('in a chain, each after is measured from the previous step and delays what follows', () => {
  const a = load('app "D" timer ink\nstate s num = 0\ntext s\nbutton "go" tap set s = 1 then after 2s set s = 2 then set s = 3 then after 2s set s = 4\n');
  a.dispatch(a.find(n => n.t === 'button').id, 'tap');
  assert.equal(texts(a)[0], '1');
  a.tick(2000); assert.equal(texts(a)[0], '3');
  a.tick(1000); assert.equal(texts(a)[0], '3');
  a.tick(1000); assert.equal(texts(a)[0], '4');
});
