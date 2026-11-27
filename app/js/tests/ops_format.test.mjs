// The r5c format (models.json `format: "ops"`): edits are one plain completion on the numbered program and come back as operations
// text; creates start with a plan line that is kept in the prompt and never reaches the program.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generate, promptFor, userText, numbered, SYSTEM_OPS, DEFAULT_SYSTEM } from '../src/decode_loop.mjs';

const WATER = readFileSync(new URL('../../assets/examples/water.mo', import.meta.url), 'utf8');
const lines = WATER.split('\n'); if (lines[lines.length - 1] === '') lines.pop();
const real = JSON.parse(readFileSync(new URL('./fixtures/ops_prompts.json', import.meta.url), 'utf8'));

test('the edit prompt is exactly what the model was trained on (18 real prompts)', () => {
  for (const r of real) {
    assert.equal(r.messages[0].content, SYSTEM_OPS);
    const u = r.messages[1].content;
    const m = /^Edit request: ([\s\S]*?)\n\nCurrent program:\n([\s\S]*)$/.exec(u);
    const before = m[2].split('\n').map(l => l.replace(/^\d+\| ?/, '')).join('\n') + '\n';
    assert.equal(userText('edit', m[1], before, null, 'ops'), u, r.id);
  }
  assert.equal(numbered('a\nb\n'), '1| a\n2| b');
  assert.equal(numbered('a\n\n'), '1| a\n2| ');
});

test('the whole-program prompt is unchanged for the other models', () => {
  assert.equal(userText('edit', 'add a note', 'app "W" drop\n'), 'Edit request: add a note\n\nCurrent program:\napp "W" drop\n');
  assert.equal(userText('edit', 'add a note', 'app "W" drop\n', null, 'whole'), userText('edit', 'add a note', 'app "W" drop\n'));
});

test('ops edit: one plain call, numbered program, the system text of the ops training, answer returned as text', async () => {
  const calls = [];
  const complete = async req => { calls.push(req); return { stop: 'eos', text: 'replace 1\n+ app "Water" drop mint', n_prompt: 300, n_gen: 14, ms_gen: 280 }; };
  const r = await generate({ kind: 'edit', request: 'make it green', current: WATER, format: 'ops', complete, template: 'gemma' });
  assert.equal(r.ok, true);
  assert.equal(r.format, 'ops');
  assert.equal(r.ops, 'replace 1\n+ app "Water" drop mint');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].grammar, '');
  assert.equal(calls[0].stopNl, false);
  assert.equal(calls[0].temp, 0);
  assert.ok(calls[0].prompt.includes(SYSTEM_OPS));
  assert.ok(calls[0].prompt.includes('\n\nEdit request: make it green\n\nCurrent program:\n1| app "Water"'));
  assert.ok(calls[0].prompt.endsWith(`${lines.length}| ${lines[lines.length - 1]}<|tok:106|>\n<|tok:105|>model\n`));
  assert.ok(calls[0].nPredict > 0 && calls[0].nPredict <= 800);
  assert.equal(r.stats.tokens, 14);
});

test('ops edit: an answer cut off at the token limit is refused, never half-applied', async () => {
  const r = await generate({ kind: 'edit', request: 'x', current: WATER, format: 'ops', complete: async () => ({ stop: 'limit', text: 'replace 3\n+ setting goal num = 3' }) });
  assert.equal(r.ok, false);
  assert.equal(r.patchError, true);
  assert.equal(r.ops, undefined);
});

test('ops edit: empty answer, model error and cancel are reported, not applied', async () => {
  assert.equal((await generate({ kind: 'edit', request: 'x', current: WATER, format: 'ops', complete: async () => ({ stop: 'eos', text: '  \n' }) })).ok, false);
  const e = await generate({ kind: 'edit', request: 'x', current: WATER, format: 'ops', complete: async () => ({ stop: 'error', error: 'boom' }) });
  assert.equal(e.modelError, true);
  const c = await generate({ kind: 'edit', request: 'x', current: WATER, format: 'ops', complete: async () => ({ stop: 'cancel', text: '' }) });
  assert.equal(c.cancelled, true);
  const t = await generate({ kind: 'edit', request: 'x', current: WATER, format: 'ops', deadlineMs: 20, cancelNative: () => {}, complete: () => new Promise(res => setTimeout(() => res({ stop: 'cancel', text: '' }), 80)) });
  assert.equal(t.timedOut, true);
});

// a model that writes "# need: ..." when asked for the plan, then the program line by line after the plan
function planFake(plan) {
  const calls = [];
  const fn = async req => {
    calls.push(req);
    if (req.grammar.startsWith('root ::= "# need:"')) return { stop: 'stop', text: plan, n_gen: 20, ms_gen: 100 };
    const done = req.prompt.split('<|tok:105|>model\n')[1] || '';
    const body = done.startsWith('# need:') ? done.split('\n').slice(1).join('\n') : done;
    const n = body ? body.split('\n').length - 1 : 0;
    if (n >= lines.length) return { stop: 'eos', text: '', n_gen: 0 };
    return { stop: 'stop', text: lines[n], n_gen: 12, ms_gen: 100 };
  };
  fn.calls = calls;
  return fn;
}

test('plan-first create: the plan call comes first, stays in the prompt, and is dropped from the program', async () => {
  const f = planFake('# need: field drink, field ml, goal, chart, list');
  const r = await generate({ kind: 'create', request: 'water log', format: 'ops', complete: f });
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.program, WATER);
  assert.ok(!r.program.includes('# need'));
  assert.equal(r.plan, '# need: field drink, field ml, goal, chart, list');
  assert.equal(f.calls[0].grammar, 'root ::= "# need:" [^\\n]* "\\n"');
  assert.equal(f.calls[0].stopNl, true);
  assert.ok(f.calls[0].prompt.endsWith('<|tok:105|>model\n'), 'the plan is asked for with nothing written yet');
  assert.ok(f.calls[0].prompt.includes(DEFAULT_SYSTEM));
  for (const c of f.calls.slice(1)) assert.ok(c.prompt.includes('<|tok:105|>model\n# need: field drink, field ml, goal, chart, list\n'), 'every later call carries the plan');
  assert.equal(r.stats.lines, lines.length);
});

test('plan-first create: a model that writes no plan still builds the program', async () => {
  const f = planFake('app "x" drop');
  const r = await generate({ kind: 'create', request: 'water log', format: 'ops', complete: f });
  assert.equal(r.ok, true);
  assert.equal(r.plan, null);
  assert.equal(r.program, WATER);
});

test('other models: no plan call, whole-program edit loop as before', async () => {
  const f = planFake('# need: x');
  const r = await generate({ kind: 'create', request: 'water log', complete: f });
  assert.ok(!f.calls.some(c => c.grammar.startsWith('root ::= "# need:"')));
  assert.equal(r.program, WATER);
  assert.equal(r.plan, null);
  assert.ok(promptFor(DEFAULT_SYSTEM, 'u', '', 'gemma').length > 0);
});
