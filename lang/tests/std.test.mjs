// Level 2 = MoldeScript: every standard component is written in MoldeScript (lang/std/*.mo),
// and every use of one expands to level-1 statements only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { check } from '../check.mjs';
import { stdDefs } from '../expand.mjs';
import { expandedText } from '../mo.mjs';

const LEVEL1 = new Set(['table', 'setting', 'state', 'let', 'remind', 'every', 'when', 'each', 'if', 'else', 'box', 'draw', 'plot', 'tick', 'poly', 'pt', 'shape',
  'text', 'button', 'icon', 'image', 'space', 'divider', 'field', 'toggle', 'choice', 'slider', 'screen', 'def']);

const HEAD = 'app "Std test"\ntable t n num, c pick A|B = A, note text?\nstate d date = today\n';
const SAMPLES = {
  stat: 'stat count(t today), "today"',
  goal: 'goal sum(t.n today), 10, "done", "kg"',
  daybars: 'daybars last 7 days, count(t on it)',
  bars: 'bars t by c, count(it), it.key',
  trend: 'trend t sort at, it.n',
  heat: 'heat last 28 days, count(t on it), 3',
  share: 'share t month by c, sum(it.n), it.key',
  list: 'list t today',
  log: 'log t where n > 0',
  form: 'form t, "Save"',
  quick: 'quick t, n, [1, 2, 5]',
  timer: 'timer 90s, "Rest", add t n = 1',
  calendar: 'calendar t, d',
  monthnav: 'monthnav d',
  topbar: 'topbar t, "+ Add", "Keep it"',
  goalbars: 'goalbars last 7 days, sum(t.n on it), 5, "Reached the goal"',
  daygrid: 'daygrid last 28 days, count(t on it), 2',
  statcard: 'statcard count(t today), "today", 5',
  section: 'section "Today", "note"',
  weekdots: 'weekdots count(t on it) > 0',
};
// the lesson components read the tables a `lesson` line declares
const LHEAD = 'app "Lesson test"\nlesson\n';
const LESSON_SAMPLES = {
  blocks: 'each section\n  blocks',
  reader: 'reader',
  stepper: 'stepper',
  flashcards: 'flashcards',
  quiz: 'quiz "Check yourself"',
  reveal: 'each question as x\n  reveal x.solution',
  notes: 'each section\n  notes',
};

test('every std component has a sample here and a describe line', () => {
  const defs = stdDefs();
  assert.deepEqual([...defs.keys()].sort(), [...Object.keys(SAMPLES), ...Object.keys(LESSON_SAMPLES)].sort());
  for (const [name, e] of defs) assert.ok(e.doc, `std ${name} has no "# describe:" line`);
});

for (const [name, line, head] of [...Object.entries(SAMPLES), ...Object.entries(LESSON_SAMPLES).map(([n, l]) => [n, l, LHEAD])]) {
  test(`std ${name} expands to level 1 only and the expansion checks on its own`, () => {
    const src = (head || HEAD) + line + '\n';
    const r = check(src);
    assert.deepEqual(r.errors.map(String), []);
    const kinds = new Set();
    const walk = s => { if (s.kind !== 'use') kinds.add(s.kind); (s.children || []).forEach(walk); };
    r.ast.body.forEach(walk);
    for (const k of kinds) assert.ok(LEVEL1.has(k), `non level-1 statement ${k}`);
    assert.ok(!kinds.has('call'));
    const ex = expandedText(src);
    const again = check(ex.text);
    assert.deepEqual(again.errors.map(String), [], ex.text);
    const walk2 = s => { assert.notEqual(s.kind, 'use', 'expanded text still uses a component'); (s.children || []).forEach(walk2); };
    again.ast.body.forEach(walk2);
  });
}

test('a program can define its own component with a slot', () => {
  const src = HEAD + 'def panel title text\n  stack card gap 1\n    text title head\n    slot\npanel "Today"\n  text count(t today) "entries"\n  goal count(t today), 5\n';
  const r = check(src);
  assert.deepEqual(r.errors.map(String), []);
  const use = r.ast.body.find(s => s.kind === 'use' && s.name === 'panel');
  assert.ok(use);
  const texts = [];
  const walk = s => { if (s.kind === 'text') texts.push(s.src); (s.children || []).forEach(walk); };
  walk(use);
  assert.ok(texts.includes('text count(t today) "entries"'), texts.join(' | '));
});

test('two uses of a component do not share state', () => {
  const r = check(HEAD + 'timer 60s\ntimer 30s\n');
  assert.ok(r.ok);
  const states = [];
  const walk = s => { if (s.kind === 'state') states.push(s.name); (s.children || []).forEach(walk); };
  r.ast.body.forEach(walk);
  assert.equal(new Set(states).size, states.length);
});
