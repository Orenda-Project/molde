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

import { nextOldPtr } from '../src/decode_loop.mjs';
test('draft pointer: copy advances, a jump resyncs, an insertion keeps the old line for the next position', () => {
  const old = ['app "A" x', 'table t a num', '"Today" head', 'form t', 'trend t, it.a'];
  assert.equal(nextOldPtr(old, 0, 'app "A" x'), 1);
  assert.equal(nextOldPtr(old, 1, '"Today" head'), 3);                 // the model dropped a line: jump past the one it matched
  assert.equal(nextOldPtr(old, 2, '"Brand new" faint'), 2);           // an insertion: offer the old line again
  assert.equal(nextOldPtr(old, 1, 'table t a num, note text'), 2);    // a rewritten line (same first word): old one used up
  assert.equal(nextOldPtr(old, 5, 'x'), 5);
});

test('edit requests offer the old line as a draft on the greedy call only; create requests never do', async () => {
  const seen = [];
  const complete = async req => { seen.push({ draft: req.draft, temp: req.temp }); return { stop: 'eos', text: '', n_gen: 0 }; };
  const cur = 'app "W" drop ocean\ntable d ml num\n';
  await generate({ kind: 'edit', request: 'make it blue', current: cur, complete });
  assert.equal(seen[0].draft, 'app "W" drop ocean');
  await generate({ kind: 'create', request: 'water', complete });
  assert.equal(seen[1].draft, undefined);
});

test('the limit follows progress: slow but steady lines are never cut off; a stall is', async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  // steady: 30 lines at 60 ms each (1.8 s in all) with a 250 ms stall limit
  const inner = fake();
  const steady = await generate({ kind: 'create', request: 'water log', complete: async req => { await sleep(60); return inner(req); }, stallMs: 250, firstLineMs: 250, hardCapMs: 60000 });
  assert.equal(steady.ok, true, JSON.stringify(steady.errors));
  assert.ok(steady.stats.seconds > 0.9);
  // stall: the model hangs on line 5
  let calls = 0, release;
  const hang = new Promise(r => { release = r; });
  const stalled = await generate({ kind: 'create', request: 'x', complete: async req => { calls++; if (calls === 5) { await hang; return { stop: 'cancel', text: '' }; } await sleep(30); return inner(req); }, stallMs: 200, firstLineMs: 200, hardCapMs: 60000, cancelNative: () => release() });
  assert.equal(stalled.timedOut, true);
  assert.ok(stalled.stats.lines >= 2);
  // the hard cap stops even a steady model
  const capped = await generate({ kind: 'create', request: 'x', complete: async req => { await sleep(60); return inner(req); }, stallMs: 5000, firstLineMs: 5000, hardCapMs: 300 });
  assert.equal(capped.timedOut, true);
});

test('progress events carry the line count and seconds', async () => {
  const seen = [];
  await generate({ kind: 'create', request: 'water log', complete: fake(), onProgress: p => seen.push(p) });
  assert.ok(seen.length > 3 && seen.every(p => typeof p.seconds === 'number'));
  assert.equal(seen[seen.length - 1].lines, seen.length);
});

import { readFileSync as rf } from 'node:fs';
test('the page forwards the seconds of every progress event to the app (0.5.0 sent "null s")', () => {
  const src = rf(new URL('../src/entry.mjs', import.meta.url), 'utf8');
  assert.match(src, /post\(\{ t: 'progress', lines: p\.lines, program: p\.program, rejected: p\.rejected, seconds: p\.seconds \}\)/);
  const bundle = rf(new URL('../../assets/web/molde.js', import.meta.url), 'utf8');
  assert.ok(/t:"progress",lines:\w+\.lines,program:\w+\.program,rejected:\w+\.rejected,seconds:\w+\.seconds/.test(bundle), 'the built bundle carries it too');
});

test('Qwen prompt is ChatML with an empty think block and no BOS; Gemma stays the same', () => {
  const q = promptFor('SYS', 'Request: water', 'app "W" drop\n', 'qwen');
  assert.equal(q, '<|tok:248045|>system\nSYS<|tok:248046|>\n<|tok:248045|>user\nRequest: water<|tok:248046|>\n<|tok:248045|>assistant\n<think>\n\n</think>\n\napp "W" drop\n');
  assert.ok(!q.includes('<|tok:2|>'));
  assert.equal(promptFor('SYS', 'U', '', 'gemma'), '<|tok:2|><|tok:105|>user\nSYS\n\nU<|tok:106|>\n<|tok:105|>model\n');
  assert.equal(promptFor('SYS', 'U', ''), promptFor('SYS', 'U', '', 'gemma'));
});
test('generate passes the template to the prompt', async () => {
  let seen = '';
  await generate({ kind: 'create', request: 'x', template: 'qwen', complete: async req => { seen = req.prompt; return { stop: 'eos', text: '' }; } });
  assert.ok(seen.startsWith('<|tok:248045|>system'));
});
