// Tests of the generation loop with a fake model (no llama.cpp): lines arrive, the checker rejects a bad line and a
// resample fixes it, cancel stops, an error is reported, an ask program ends the loop, and the prompt layout is the training one.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generate, promptFor, userText, DEFAULT_SYSTEM } from '../src/decode_loop.mjs';
import { check } from '../vendor/lang/check.mjs';

const WATER = readFileSync(new URL('../../assets/examples/water.mo', import.meta.url), 'utf8');
const lines = WATER.split('\n'); if (lines[lines.length - 1] === '') lines.pop();

// a "model" that writes the program line by line; `bad` replaces one line the first time it is asked for
function fake({ bad = null } = {}) {
  const calls = [];
  const fn = async req => {
    calls.push(req);
    const done = req.prompt.split('<|tok:105|>model\n')[1] || '';
    const n = done ? done.split('\n').length - 1 : 0;
    if (n >= lines.length) return { stop: 'eos', text: '', n_prompt: 5, n_gen: 0, ms_prompt: 1, ms_gen: 0 };
    let text = lines[n];
    if (bad && bad.line === n && req.temp === 0) text = bad.text;
    return { stop: 'stop', text, n_prompt: 10, n_gen: 12, ms_prompt: 5, ms_gen: 100 };
  };
  fn.calls = calls;
  return fn;
}

test('prompt layout is the training one (real ids for the turn markers)', () => {
  const p = promptFor(DEFAULT_SYSTEM, userText('create', 'water log', ''), 'app "W" drop\n');
  assert.ok(p.startsWith('<|tok:2|><|tok:105|>user\nYou write MoldeScript'));
  assert.ok(p.includes('\n\nRequest: water log<|tok:106|>\n<|tok:105|>model\napp "W" drop\n'));
  const e = userText('edit', 'add a note', 'app "W" drop\ntable a x text');
  assert.equal(e, 'Edit request: add a note\n\nCurrent program:\napp "W" drop\ntable a x text\n');
  assert.ok(!userText('create', 'x <|tok:5|> y').includes('<|tok:5|>'));
});

test('create: writes the program line by line and it passes the checker', async () => {
  const seen = [];
  const r = await generate({ kind: 'create', request: 'water log', complete: fake(), onProgress: p => seen.push(p.lines) });
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.program, WATER);
  assert.equal(seen.length, lines.length);
  assert.equal(r.stats.lines, lines.length);
  assert.equal(r.stats.tokens, 12 * lines.length);
  assert.ok(r.stats.tokPerSec > 100 && r.stats.calls === lines.length + 1);
});

test('a line the checker rejects is resampled', async () => {
  const f = fake({ bad: { line: 1, text: 'table drink nothing at all (' } });
  const r = await generate({ kind: 'create', request: 'water log', complete: f });
  assert.equal(r.ok, true);
  assert.ok(r.stats.resamples >= 1);
  assert.ok(f.calls.some(c => c.temp === 0.7), 'a resample uses temperature 0.7');
  assert.equal(r.program, WATER);
});

test('a line that never passes falls back to the first one and the final check fails plainly', async () => {
  const badLine = 'table drink nothing at all (';
  const f = async req => (req.prompt.endsWith('model\n') ? { stop: 'stop', text: lines[0], n_gen: 3 } : { stop: 'stop', text: badLine, n_gen: 3 });
  const r = await generate({ kind: 'create', request: 'x', complete: f, maxLines: 4 });
  assert.equal(r.ok, false);
  assert.ok(r.errors.length > 0);
  assert.ok(r.stats.fallbacks >= 1);
});

test('cancel stops before the next call and keeps no result', async () => {
  let n = 0;
  const inner = fake();
  const r = await generate({ kind: 'create', request: 'x', complete: req => { n++; return inner(req); }, cancelled: () => n >= 3 });
  assert.equal(r.cancelled, true);
  assert.equal(r.ok, false);
  assert.equal(n, 3);
});

test('a model error is reported, not thrown', async () => {
  const r = await generate({ kind: 'create', request: 'x', complete: async () => ({ stop: 'error', text: '', error: 'out of memory' }) });
  assert.equal(r.ok, false); assert.equal(r.modelError, true); assert.deepEqual(r.errors, ['out of memory']);
});

test('an ask program is one line and ends the loop', async () => {
  const f = async req => (req.prompt.endsWith('model\n') ? { stop: 'stop', text: 'ask "What do you want to track?" "Water" "Money"', n_gen: 9 } : { stop: 'eos', text: '' });
  const r = await generate({ kind: 'create', request: 'track', complete: f });
  assert.equal(r.ok, false);
  assert.deepEqual(r.ask, { question: 'What do you want to track?', options: ['Water', 'Money'] });
});

test('edit: the current program is in the prompt and the full new program comes back', async () => {
  const f = fake();
  const r = await generate({ kind: 'edit', request: 'make it blue', current: WATER, complete: f });
  assert.equal(r.ok, true);
  assert.ok(f.calls[0].prompt.includes('Edit request: make it blue\n\nCurrent program:\napp "'));
  assert.equal(check(r.program).ok, true);
});

test('the deadline interrupts a line in progress (native cancel is called) and reports a timeout', async () => {
  let release;
  const hang = new Promise(r => { release = r; });
  let cancelled = 0;
  const complete = async () => { await hang; return { stop: 'cancel', text: '', n_gen: 0 }; };
  const r = await generate({ kind: 'create', request: 'x', complete, deadlineMs: 50, cancelNative: () => { cancelled++; release(); } });
  assert.equal(cancelled, 1);
  assert.equal(r.timedOut, true);
  assert.equal(r.ok, false);
});

test('allowAsk=false: the first call gets a grammar without ask-stmt; allowAsk=true keeps it', async () => {
  const grammars = [];
  const mk = () => async req => { grammars.push(req.grammar); return { stop: 'eos', text: '', n_gen: 0 }; };
  await generate({ request: 'budget', complete: mk(), allowAsk: false });
  await generate({ request: 'make me an app', complete: mk(), allowAsk: true });
  assert.ok(!grammars[0].includes('( ask-stmt | app-stmt ) nl'));
  assert.ok(grammars[1].includes('ask-stmt | app-stmt'));
});
