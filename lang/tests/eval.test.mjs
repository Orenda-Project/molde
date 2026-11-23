// Behaviour tests: every example is loaded by the reference evaluator, driven like a user would
// (taps, inputs, clock ticks), and its UI tree is checked. The clock is fixed at
// 2026-11-23 10:00 UTC (a Monday) unless a test moves it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { load } from '../eval.mjs';
import { LANG } from './lib.mjs';

const EX = join(LANG, 'examples');
const L = (n, o) => load(readFileSync(join(EX, n + '.mo'), 'utf8'), o);
const node = (a, pred) => { const n = a.find(pred); assert.ok(n, 'node not found'); return n; };
const tap = (a, pred) => assert.ok(a.dispatch(node(a, pred).id, 'tap'));
const btn = (a, text) => tap(a, n => n.t === 'button' && n.text === text);
const texts = a => a.findAll(n => n.t === 'text' || n.t === 'label' || n.t === 'button').map(n => n.text);
const has = (a, re) => assert.ok(texts(a).some(t => re.test(t)), `no text matching ${re} in ${JSON.stringify(texts(a))}`);
const fill = (a, values) => { // fill the first form on screen and press its button
  const f = node(a, n => n.t === 'form');
  for (const [k, v] of Object.entries(values)) assert.ok(a.dispatch(`${f.id}:${k}`, 'change', v));
};
const DAYMS = 86400000;

test('every example renders a tree with no error nodes and valid unique ids', () => {
  for (const f of readdirSync(EX).filter(f => f.endsWith('.mo'))) {
    const a = load(readFileSync(join(EX, f), 'utf8'));
    assert.ok(a.ok, f + ': ' + a.errors.join('; '));
    const all = a.findAll(() => true);
    assert.equal(a.findAll(n => n.t === 'error').length, 0, f);
    const ids = all.map(n => n.id);
    assert.equal(new Set(ids).size, ids.length, f + ': duplicate ids');
    assert.deepEqual(JSON.parse(JSON.stringify(a.tree())), a.tree(), f + ': tree is not plain JSON');
  }
});

test('01 water: two quick adds sum and fill the glass', () => {
  const a = L('01-water');
  btn(a, '250'); btn(a, '500');
  has(a, /^750 ml$/);
  const r = node(a, n => n.t === 'rect');
  assert.equal(r.h, 37.5); // 750 / 2000 of 100
  assert.equal(r.y, 104 - 37.5);
  a.undo();
  has(a, /^250 ml$/);
});

test('02 habits: add a habit, tick it, count and streak update', () => {
  const a = L('02-habits');
  has(a, /0 of 0 done today/);
  fill(a, { name: 'Read' }); btn(a, 'Add');
  tap(a, n => n.t === 'toggle');
  has(a, /^1 of 1 done today$/);
  has(a, /^1 day streak, 3% in 30 days$/);
  assert.equal(node(a, n => n.t === 'toggle').on, true);
});

test('03 exercise: repeat last set, rest timer counts down and notifies', () => {
  const a = L('03-exercise');
  fill(a, { exercise: 'Squat', kg: 60, reps: 5 }); btn(a, 'Add');
  btn(a, 'Repeat last set');
  has(a, /^2 sets today, 600 kg moved$/);
  btn(a, 'Start'); a.tick(10000);
  has(a, /^1:20$/);
  a.tick(80000);
  assert.equal(a.log.filter(l => l.kind === 'notify').length, 1);
  has(a, /^1:30$/);
});

test('04 budget: spending reduces what is left; category tap filters the list', () => {
  const a = L('04-budget');
  fill(a, { what: 'Lunch', amount: 1200, category: 'Food' }); btn(a, 'Add');
  fill(a, { what: 'Power', amount: 5000, category: 'Bills' }); btn(a, 'Add');
  has(a, /^Left to spend 73,800$/);
  tap(a, n => n.tap && n.t === 'stack' && JSON.stringify(n).includes('"Food"'));
  assert.ok(texts(a).some(t => t.includes('Lunch')));
  assert.ok(!texts(a).some(t => t.includes('Power')));
});

test('05 journal: pick a mood, save, streak and search', () => {
  const a = L('05-journal');
  btn(a, 'good');
  assert.ok(a.dispatch(node(a, n => n.t === 'input' && n.label === 'What is on your mind?').id, 'change', 'Long walk'));
  btn(a, 'Save entry');
  has(a, /^1 day streak, 1 entries in 7 days$/);
  assert.ok(a.dispatch(node(a, n => n.t === 'input' && n.label === 'Search entries').id, 'change', 'nothing'));
  has(a, /Nothing here yet/);
});

test('06 habits plus: ring and week strip follow a tick on an earlier day', () => {
  const a = L('06-habits-plus');
  fill(a, { name: 'Walk' }); btn(a, 'Add');
  tap(a, n => n.t === 'toggle');
  has(a, /^All done today$/);
  const arcs = a.findAll(n => n.t === 'arc');
  assert.equal(arcs[0].to, 360);
});

test('07 exercise plus: a new record is listed', () => {
  const a = L('07-exercise-plus');
  fill(a, { exercise: 'Bench', kg: 50, reps: 5 }); btn(a, 'Add');
  fill(a, { exercise: 'Bench', kg: 55, reps: 5 }); btn(a, 'Add');
  has(a, /^Bench 55 kg$/);
});

test('08 budget plus: pace line has a point per day of the month', () => {
  const a = L('08-budget-plus');
  fill(a, { amount: 3000 }); btn(a, 'Add expense');
  const poly = node(a, n => n.t === 'poly');
  assert.equal(poly.points.length, 30);
  has(a, /^3,000$/);
});

test('09 journal plus: days written strip and streak text', () => {
  const a = L('09-journal-plus');
  a.dispatch(node(a, n => n.t === 'input' && n.label === 'What is on your mind?').id, 'change', 'ok');
  tap(a, n => n.t === 'stack' && n.tap);
  btn(a, 'Save entry');
  has(a, /day streak, including today/);
});

test('10 prayers: ticking options counts prayers for today', () => {
  const a = L('10-prayer-log');
  const toggles = a.findAll(n => n.t === 'toggle');
  assert.equal(toggles.length, 5);
  a.dispatch(toggles[0].id, 'tap'); a.dispatch(toggles[1].id, 'tap');
  has(a, /^2 of 5 prayed today$/);
  assert.equal(a.reminders().length, 1);
});

test('11 medicine: a dose toggle counts and the reminder follows the time column', () => {
  const a = L('11-medicine');
  fill(a, { name: 'Iron', time: '08:30' }); btn(a, 'Add medicine');
  tap(a, n => n.t === 'toggle');
  has(a, /^1 of 1 doses taken today$/);
  assert.deepEqual(a.reminders().map(r => r.daily), ['08:30']);
});

test('12 study: today shows Monday lessons in time order', () => {
  const a = L('12-study-timetable');
  fill(a, { subject: 'Maths', day: 'Mon', start: '09:00' }); btn(a, 'Add');
  fill(a, { subject: 'Art', day: 'Mon', start: '08:00' }); btn(a, 'Add');
  const t = texts(a);
  assert.ok(t.indexOf('08:00 Art') < t.indexOf('09:00 Maths'), JSON.stringify(t));
});

test('13 reading: Finished moves a book to Done', () => {
  const a = L('13-reading-list');
  fill(a, { title: 'Dune', status: 'Reading' }); btn(a, 'Add');
  btn(a, 'Finished');
  has(a, /^1$/);
});

test('14 stock: minus button lowers the count and warns when low', () => {
  const a = L('14-shop-stock');
  fill(a, { name: 'Rice', qty: 6 }); btn(a, 'Add');
  has(a, /^0 items running low$/);
  btn(a, '-');
  has(a, /^1 items running low$/);
  btn(a, '-'); btn(a, '-'); btn(a, '-'); btn(a, '-'); btn(a, '-'); btn(a, '-');
  has(a, /^0$/); // the range 0.. keeps it from going below zero
});

test('15 khata: balance per person', () => {
  const a = L('15-khata');
  const forms = a.findAll(n => n.t === 'form');
  a.dispatch(forms[0].id + ':name', 'change', 'Ali'); btn(a, 'Add person');
  const f2 = a.findAll(n => n.t === 'form')[1];
  a.dispatch(f2.id + ':person', 'change', 1); a.dispatch(f2.id + ':amount', 'change', 500); a.dispatch(f2.id + ':kind', 'change', 'Gave');
  btn(a, 'Add entry');
  has(a, /^owes you 500$/);
});

test('16 split: equal shares', () => {
  const a = L('16-expense-split');
  for (const n of ['A', 'B']) { a.dispatch(a.findAll(x => x.t === 'form')[0].id + ':name', 'change', n); btn(a, 'Add friend'); }
  const f = a.findAll(x => x.t === 'form')[1];
  a.dispatch(f.id + ':what', 'change', 'Pizza'); a.dispatch(f.id + ':amount', 'change', 1000); a.dispatch(f.id + ':paid', 'change', 1);
  btn(a, 'Add cost');
  has(a, /^gets back 500$/); has(a, /^owes 500$/);
});

test('17 sleep: overnight duration crosses midnight', () => {
  const a = L('17-sleep-log');
  fill(a, { slept: '23:00', woke: '07:00' }); btn(a, 'Add');
  has(a, /^8:00$/);
});

test('18 weight: kg to target', () => {
  const a = L('18-weight');
  fill(a, { kg: 75 }); btn(a, 'Add');
  has(a, /^5 kg to target, 0 kg in 30 days$/);
});

test('19 cricket: runs, wickets, overs and undo', () => {
  const a = L('19-cricket-score');
  btn(a, '4'); btn(a, '6'); btn(a, 'Wide'); btn(a, 'Out');
  has(a, /^11 \/ 1$|^11\/1$/);
  btn(a, 'Undo');
  has(a, /^11\/0$|^11 \/ 0$/);
});

test('20 quiz: score after answering', () => {
  const a = L('20-quiz');
  fill(a, { question: '2+2?', a: '3', b: '4', c: '5', right: 'B' }); btn(a, 'Add question');
  btn(a, '4');
  has(a, /^1 of 1 right$/); has(a, /^Right$/);
});

test('21 grocery: ticking moves an item to the cart', () => {
  const a = L('21-grocery');
  fill(a, { name: 'Milk' }); btn(a, 'Add');
  has(a, /^1 to buy$/);
  tap(a, n => n.t === 'toggle');
  has(a, /^0 to buy$/);
});

test('22 todo: an overdue task is counted late', () => {
  const a = L('22-todo');
  fill(a, { title: 'Pay bill', due: '2026-11-20' }); btn(a, 'Add');
  has(a, /^1 open, 1 late$/);
});

test('23 quran: juz grid fills', () => {
  const a = L('23-quran-progress');
  fill(a, { juz: 3, pages: 20 }); btn(a, 'Add');
  const juz = a.findAll(n => n.t === 'box' && n.children && n.children.length);
  assert.equal(juz.length, 30);
  assert.equal(juz.filter(n => n.style.fill === 'accent').length, 3);
});

test('24 savings: quick deposit raises the thermometer', () => {
  const a = L('24-savings-thermometer');
  btn(a, '5,000');
  has(a, /^5% of 100,000$/);
});

test('25 period: day of cycle after a start', () => {
  const a = L('25-period', { now: '2026-11-01T10:00:00Z' });
  btn(a, 'Period started today');
  a.tick(3 * DAYMS);
  has(a, /^Day 4 of your cycle$/);
});

test('26 tic-tac-toe: a row of three wins', () => {
  const a = L('26-tictactoe');
  for (const c of [1, 4, 2, 5, 3]) tap(a, n => n.t === 'box' && n.tap && n.id.includes(`@${c}.`));
  has(a, /^X wins!$/);
  btn(a, 'New game');
  has(a, /^X to play$/);
});

test('27 tasbeeh: 33 taps make round 2 and one notice', () => {
  const a = L('27-tasbeeh');
  for (let i = 0; i < 33; i++) tap(a, n => n.t === 'draw' && n.tap);
  has(a, /^Round 2$/);
  assert.equal(a.log.filter(l => l.kind === 'notify').length, 1);
});

test('28 pomodoro: the focus timer logs a session when it ends', () => {
  const a = L('28-pomodoro');
  btn(a, 'Start');
  a.tick(25 * 60 * 1000);
  has(a, /^1 focus sessions today$/);
  assert.ok(a.log.some(l => l.text === 'Take a short break'));
});

test('29 zakat and tip: calculators', () => {
  const a = L('29-zakat-tip');
  const ins = a.findAll(n => n.t === 'input');
  a.dispatch(ins.find(n => n.label === 'Cash and bank').id, 'change', 200000);
  a.dispatch(ins.find(n => n.label === 'Silver price per gram').id, 'change', 100);
  has(a, /^5,000$/); // 2.5% of 200,000 (above nisab 61,236)
  assert.deepEqual(a.tree().screens.map(s => s.name), ['zakat', 'split']);
  assert.ok(a.dispatch('tab:split', 'tap'));
  a.dispatch(node(a, n => n.t === 'input' && n.label === 'Bill').id, 'change', 1000);
  has(a, /^Each pays 1,100$/);
});

test('30 attendance: tap marks absent for the chosen day', () => {
  const a = L('30-attendance');
  fill(a, { name: 'Sara' }); btn(a, 'Add student');
  has(a, /^1 of 1 present$/);
  tap(a, n => n.t === 'stack' && n.tap);
  has(a, /^0 of 1 present$/);
  btn(a, '<');
  has(a, /^1 of 1 present$/);
});

test('snapshot and restore keep data; undo restores a removed row', () => {
  const a = L('21-grocery');
  fill(a, { name: 'Eggs' }); btn(a, 'Add');
  const snap = a.snapshot();
  const b = L('21-grocery'); b.restore(snap);
  assert.ok(b.findAll(n => n.t === 'text').some(n => n.text === 'Eggs'), JSON.stringify(texts(b)));
  b.dispatch(node(b, n => n.swipe).id, 'swipe');
  assert.ok(!b.findAll(n => n.t === 'text').some(n => n.text === 'Eggs'));
  b.undo();
  assert.ok(b.findAll(n => n.t === 'text').some(n => n.text === 'Eggs'));
});

test('eval.mjs and its imports use no Node-only APIs (runs in a browser)', () => {
  const seen = new Set();
  const visit = f => {
    if (seen.has(f)) return; seen.add(f);
    const src = readFileSync(join(LANG, f), 'utf8');
    assert.ok(!/from 'node:|require\(|process\.|import\.meta\.url/.test(src), `${f} uses a Node-only API`);
    for (const m of src.matchAll(/from '\.\/([^']+)'/g)) visit(m[1]);
  };
  visit('eval.mjs');
  assert.ok(seen.has('check.mjs') && seen.has('sources.gen.mjs'));
});
