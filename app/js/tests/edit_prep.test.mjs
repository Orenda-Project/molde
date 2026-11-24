import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prepareEdit } from '../src/edit_prep.mjs';
import { load } from '../vendor/lang/eval.mjs';
import { noAsk, userText } from '../src/decode_loop.mjs';
import { buildLineGrammar } from '../vendor/decode/linegram.mjs';

const WATER = readFileSync(new URL('../../assets/examples/water.mo', import.meta.url), 'utf8');

test('a changed setting default gets `set`, is named, and the stored value then really changes', () => {
  const edited = WATER.replace('setting goal num = 2000', 'setting goal num = 3000');
  const r = prepareEdit(WATER, edited);
  assert.deepEqual(r.settings.map(s => s.text), ['Goal is now 3000']);
  assert.match(r.source, /setting goal num = 3000 "Daily goal \(ml\)" set/);
  const a = load(WATER, { now: Date.now() });
  const verdict = a.applyEdit(r.source);
  assert.notEqual(verdict.verdict, 'refused');
  const snap = JSON.stringify(a.snapshot().data.settings);
  assert.match(snap, /3000/);
  // without the `set` the stored value would have stayed at 2000
  const b = load(WATER, { now: Date.now() });
  b.applyEdit(edited);
  assert.doesNotMatch(JSON.stringify(b.snapshot().data.settings), /3000/);
});

test('no setting change: the program is returned untouched', () => {
  const r = prepareEdit(WATER, WATER.replace('"Water"', '"Water log"'));
  assert.deepEqual(r.settings, []);
  assert.ok(!/ set\n/.test(r.source));
});

test('noAsk: the first-line grammar loses ask-stmt, in the static and the named form; later lines are untouched', () => {
  const g = buildLineGrammar('', { names: true, types: true }).grammar;
  assert.ok(g.includes('ask-stmt | app-stmt'));
  assert.ok(!noAsk(g).includes('( ask-stmt | app-stmt ) nl'));
  assert.match(noAsk(g), /root ::= app-stmt nl/);
  const g2 = buildLineGrammar('app "A" drop ocean\n', { names: true, types: true }).grammar;
  assert.equal(noAsk(g2), g2);
});

test('prompt after an ask has exactly the trained shape', () => {
  assert.equal(userText('create', 'budget', '', { question: 'For what?', answer: 'Home' }), 'Request: budget\nQuestion: For what?\nAnswer: Home');
  assert.equal(userText('edit', 'make it green', 'app "A" drop\n', { question: 'Which?', answer: 'All' }), 'Edit request: make it green\nQuestion: Which?\nAnswer: All\n\nCurrent program:\napp "A" drop\n');
  assert.equal(userText('create', 'budget', ''), 'Request: budget');
});
