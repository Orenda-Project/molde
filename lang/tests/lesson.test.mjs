// Lessons (LESSON.md): the content contract, the read-only lesson tables, the std lesson
// components in use, and the learner's answers and notes surviving UI edits.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { load } from '../eval.mjs';
import { check } from '../check.mjs';
import { validateLesson, lessonRows } from '../lesson.mjs';
import { LANG, read } from './lib.mjs';

const LESSON_FILES = { g3: 'g3-maths-halves-quarters', g6: 'g6-science-water-cycle', tt: 'teacher-checking-understanding' };
const lessonOf = name => JSON.parse(read(join(LANG, 'lessons', LESSON_FILES[name.slice(0, 2)] + '.json')));
export const lessonPrograms = () => readdirSync(join(LANG, 'examples', 'lessons')).filter(f => f.endsWith('.mo')).sort().map(f => ({ name: f, src: read(join(LANG, 'examples', 'lessons', f)), lesson: lessonOf(f) }));
const edits = () => readdirSync(join(LANG, 'examples', 'lesson-edits')).sort().map(d => { const p = join(LANG, 'examples', 'lesson-edits', d); return { name: d, before: read(join(p, 'before.mo')), after: read(join(p, 'after.mo')), request: read(join(p, 'request.txt')) }; });
const nodes = (t, p) => { const out = []; const w = n => { if (!n || typeof n !== 'object') return; if (p(n)) out.push(n); (n.children || []).forEach(w); }; w(t); return out; };
const texts = t => nodes(t, n => typeof n.text === 'string').map(n => n.text);
const tap = (a, text) => { const b = nodes(a.tree(), n => (n.t === 'button' || n.tap) && n.text === text)[0]; assert.ok(b, `no button "${text}" in ${JSON.stringify(texts(a.tree()).slice(0, 30))}`); assert.ok(a.dispatch(b.id, 'tap')); };

test('the three example lessons follow the contract', () => {
  for (const f of Object.values(LESSON_FILES)) {
    const L = JSON.parse(read(join(LANG, 'lessons', f + '.json')));
    assert.deepEqual(validateLesson(L), [], f);
    const T = lessonRows(L);
    assert.equal(T.section.length, L.sections.length);
    assert.equal(T.question.length, L.questions.length);
  }
});

test('a lesson that breaks the contract is refused with plain reasons and shows nothing of it', () => {
  const L = lessonOf('g3');
  const bad = JSON.parse(JSON.stringify(L));
  delete bad.title; bad.questions[0].answer = 9; bad.sections[1].id = bad.sections[0].id; bad.extra = 1;
  const probs = validateLesson(bad);
  for (const want of ['title:', 'questions[0].answer', 'is used twice', 'extra: not part']) assert.ok(probs.some(p => p.includes(want)), want + ' in ' + probs.join(' | '));
  const a = load('app "L"\nlesson\nreader\n', { lesson: bad });
  assert.ok(a.lessonProblems.length > 0);
  assert.ok(!texts(a.tree()).includes(L.sections[0].title));
  assert.deepEqual(validateLesson('x'), ['the lesson is not a JSON object.']);
});

test('the 12 example programs check, stay under 20 lines and show their lesson without error nodes', () => {
  const progs = lessonPrograms();
  assert.equal(progs.length, 12);
  for (const p of progs) {
    assert.deepEqual(check(p.src).errors.map(String), [], p.name);
    assert.ok(p.src.trim().split('\n').length < 20, p.name);
    const a = load(p.src, { lesson: p.lesson });
    assert.deepEqual(a.lessonProblems, []);
    const t = a.tree();
    assert.deepEqual(nodes(t, n => n.t === 'error'), [], p.name);
    const all = JSON.stringify(t);
    const shown = [p.lesson.title, ...p.lesson.sections.map(s => s.title), ...(p.lesson.terms || []).map(x => x.term), ...(p.lesson.questions || []).map(q => q.prompt)].filter(x => all.includes(JSON.stringify(x).slice(1, -1)));
    assert.ok(shown.length >= 2, `${p.name} shows almost nothing of its lesson`);
  }
});

test('the lesson tables are read-only; the learner tables are not', () => {
  const H = 'app "L"\nlesson\n';
  for (const line of ['button "x" tap add section title = "a", n = 1', 'each section\n  button "x" tap set it.title = "b"', 'each section\n  button "x" tap remove it', 'each term as s\n  button "x" tap edit s', 'button "x" tap remove all question', 'state d new term', 'toggle option all', 'button "x" tap set all option.right = yes']) {
    const r = check(H + line + '\n');
    assert.ok(r.errors.some(e => e.code === 'E_READONLY'), `${line}: ${r.errors.map(String)}`);
  }
  for (const line of ['each section\n  button "x" tap add note section = it, body = "hi"', 'button "x" tap remove all answer', 'each section as s\n  toggle seen all where section = s']) assert.deepEqual(check(H + line + '\n').errors.map(String), [], line);
  assert.equal(check('app "L"\nlesson\ntable note body text\n').ok, false); // the learner tables' names are taken
  assert.ok(check('app "L"\ntable lesson title text\neach lesson\n  text it.title\n').ok); // without a lesson line, lesson is an ordinary name
});

test('content keeps its own order, block kinds and the right option', () => {
  const a = load('app "L"\nlesson\neach section\n  text it.n it.title\neach option where right\n  text it.label\n', { lesson: lessonOf('g6') });
  const t = texts(a.tree());
  assert.deepEqual(t.slice(0, 4), ['1 Water keeps moving', '2 Evaporation', '3 Condensation', '4 Precipitation and collection']);
  assert.ok(t.includes('Heat from the sun') && t.includes('True') && !t.includes('Smoke'));
});

test('quiz: one question at a time, feedback with the explanation, a score at the end, start again', () => {
  const L = lessonOf('g6');
  const a = load(read(join(LANG, 'examples', 'lessons', 'g6-quiz-only.mo')), { lesson: L });
  tap(a, 'Heat from the sun');
  assert.ok(texts(a.tree()).includes('Right!'));
  assert.ok(texts(a.tree()).includes(L.questions[0].explanation));
  tap(a, 'Next question');
  tap(a, 'Smoke');
  assert.ok(texts(a.tree()).includes('Not quite.'));
  tap(a, 'Next question');
  tap(a, 'True'); tap(a, 'Next question');
  const inp = nodes(a.tree(), n => n.t === 'input')[0];
  assert.ok(a.dispatch(inp.id, 'change', 'Condensation'));
  tap(a, 'Check');
  assert.ok(texts(a.tree()).includes('Right!'), 'a short answer is matched ignoring case');
  tap(a, 'Next question');
  tap(a, 'False');
  tap(a, 'See my score');
  assert.ok(texts(a.tree()).includes('4 of 5'), JSON.stringify(texts(a.tree())));
  tap(a, 'Start again');
  assert.equal(a.rows('answer').length, 0);
  assert.ok(texts(a.tree()).includes(L.questions[0].prompt));
});

test('stepper: Back and Next, a progress line, and the sections reached are kept', () => {
  const a = load(read(join(LANG, 'examples', 'lessons', 'g3-step-by-step.mo')), { lesson: lessonOf('g3') });
  assert.ok(texts(a.tree()).includes('Equal parts') && !texts(a.tree()).includes('One half'));
  tap(a, 'Next');
  assert.ok(texts(a.tree()).includes('One half'));
  tap(a, 'Back');
  assert.ok(texts(a.tree()).includes('Equal parts'));
  tap(a, 'Next'); tap(a, 'Next');
  assert.ok(texts(a.tree()).includes('One quarter'));
  assert.equal(a.rows('seen').length, 2);
});

test('flashcards turn over and move', () => {
  const a = load(read(join(LANG, 'examples', 'lessons', 'g3-flashcards.mo')), { lesson: lessonOf('g3') });
  const card = nodes(a.tree(), n => n.tap && (n.children || []).some(c => c.text === 'Whole'))[0];
  assert.ok(card);
  a.dispatch(card.id, 'tap');
  assert.ok(texts(a.tree()).includes('The complete thing before it is cut or shared.'));
  tap(a, 'Next');
  assert.ok(texts(a.tree()).includes('Half'));
});

test('reveal hides the answer until tapped', () => {
  const a = load(read(join(LANG, 'examples', 'lessons', 'g3-practice.mo')), { lesson: lessonOf('g3') });
  const L = lessonOf('g3');
  assert.ok(!JSON.stringify(a.tree()).includes(L.questions[0].explanation));
  tap(a, 'Show the answer');
  assert.ok(JSON.stringify(a.tree()).includes(L.questions[0].explanation));
});

test('the 10 lesson edits check, apply safely, and keep answers, notes and progress', () => {
  const es = edits();
  assert.equal(es.length, 10);
  for (const e of es) {
    assert.ok(e.request.trim().length > 0);
    const lesson = lessonOf(read(join(LANG, 'examples', 'lesson-edits', e.name, 'before.mo')).includes('Water cycle') ? 'g6' : read(join(LANG, 'examples', 'lesson-edits', e.name, 'before.mo')).includes('Checking') ? 'tt' : 'g3');
    const a = load(e.before, { lesson });
    // the learner did something: answered, wrote a note, finished a part
    const q = a.rows('question')[0], s = a.rows('section')[0];
    a.addRow('note', { section: rowOf(a, 'section', s), body: 'my note' });
    a.addRow('answer', { question: rowOf(a, 'question', q), right: true });
    a.addRow('seen', { section: rowOf(a, 'section', s) });
    const r = a.applyEdit(e.after);
    assert.ok(['safe', 'warn'].includes(r.verdict), `${e.name}: ${JSON.stringify(r.refused || r.warnings)}`);
    assert.deepEqual(nodes(a.tree(), n => n.t === 'error'), [], e.name);
    assert.deepEqual([a.rows('note').length, a.rows('answer').length, a.rows('seen').length], [1, 1, 1], e.name);
    assert.equal(a.cell('note', a.rows('note')[0], 'body'), 'my note');
    // and back
    a.revert();
    assert.deepEqual([a.rows('note').length, a.rows('answer').length, a.rows('seen').length], [1, 1, 1], e.name + ' (revert)');
  }
});

test('dropping the lesson line hides the learner data; adding it back brings it back', () => {
  const a = load('app "L"\nlesson\nreader\n', { lesson: lessonOf('tt') });
  a.addRow('note', { section: rowOf(a, 'section', a.rows('section')[1]), body: 'keep me' });
  assert.ok(['safe', 'warn'].includes(a.applyEdit('app "L"\ntext "nothing"\n').verdict));
  assert.ok(['safe', 'warn', 'restore'].includes(a.applyEdit('app "L"\nlesson\nreader\n  notes\n').verdict));
  assert.equal(a.rows('note').length, 1);
  assert.ok(texts(a.tree()).includes('keep me'));
});

test('answers point at the same question after the lesson is reloaded (ids come from the content)', () => {
  const L = lessonOf('g3');
  const a = load('app "L"\nlesson\nquiz\n', { lesson: L });
  tap(a, '5');
  const snap = a.snapshot();
  const b = load('app "L"\nlesson\nquiz\n', { lesson: L, data: snap });
  assert.ok(texts(b.tree()).includes('Right!'));
  assert.equal(b.rows('answer').length, 1);
});

test('the app line takes a text size; the tree carries it', () => {
  assert.equal(load('app "A" book blue large').tree().size, 'large');
  assert.equal(load('app "A" book blue dark huge').tree().size, 'huge');
  assert.equal(load('app "A" book').tree().size, null);
});

// a row as a value the evaluator accepts for a ref field
function rowOf(a, table, raw) { return a.wrap(raw.id, { t: 'ref', table }); }
