#!/usr/bin/env node
// Novel-request generation: one model x quant x arm over eval-novel/items.json.
//   node eval-novel/gen.mjs --model r1|r2 --quant Q4_K_M|Q8_0 --arm P|E [--port 8241] [--only create|change] [--limit N]
// P = plain: whole program in one call, static grammar (lang/moldescript.gbnf), prompt with the real turn-token ids.
// E = the phone app's decoder (decode/ arm E): line-stepped, per-line name grammar, checker resample, type filters.
// Change requests use this run's own create output (stored form, mo.mjs strip) as the current program when it
// passes the checker; otherwise the reference program for the base item (refs/refs.json). Resumable: rows already
// in the output file are kept.
import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
import os from 'node:os';
import { buildLineGrammar, prefixErrors } from '../decode/linegram.mjs';
import { check } from '../lang/check.mjs';
import { strip } from '../lang/format.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const MODEL = arg('model', 'r1'), QUANT = arg('quant', 'Q4_K_M'), ARM = arg('arm', 'E'), ONLY = arg('only', ''), LIMIT = +arg('limit', 0);
const PORT = arg('port', '8241');
const HERE = new URL('.', import.meta.url).pathname;
const LANG = new URL('../lang', import.meta.url).pathname;
const STATIC_GBNF = readFileSync(`${LANG}/moldescript.gbnf`, 'utf8');
const SYSTEM = 'You write MoldeScript, a tiny language for small phone apps. Reply with the complete program only, no explanation. For an edit request you get the current program: reply with the full updated program.';
const items = JSON.parse(readFileSync(`${HERE}/items.json`, 'utf8'));
const refs = existsSync(`${HERE}/refs/refs.json`) ? JSON.parse(readFileSync(`${HERE}/refs/refs.json`, 'utf8')) : {};
const TAG = `${MODEL}_${QUANT}_${ARM}`;
const OUT = `${HERE}/runs/${TAG}.jsonl`;
const done = new Map();
if (existsSync(OUT)) for (const l of readFileSync(OUT, 'utf8').split('\n').filter(Boolean)) { const r = JSON.parse(l); done.set(r.id, r); }

class Timeout extends Error {}
const post = async (path, body) => {
  const ms = body.stop ? 30000 : 90000; // client-side caps: a grammar blow-up can run at <1 tok/s for many minutes
  let r;
  try { r = await fetch(`http://127.0.0.1:${PORT}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(ms) }); }
  catch (e) { if (e.name === 'TimeoutError') throw new Timeout(`generation over ${ms / 1000} s`); throw e; }
  if (!r.ok) throw new Error(`${path} ${r.status} ${(await r.text()).slice(0, 300)}`);
  return r.json();
};
const userText = r => r.task === 'edit' ? `Edit request: ${r.request}\n\nCurrent program:\n${r.before}` : `Request: ${r.request}`;
const promptFor = (r, accepted) => [2, 105, `user\n${SYSTEM}\n\n${userText(r)}`, 106, '\n', 105, 'model\n' + accepted];

async function complete(r, accepted, grammar, { seed = 1, temp = 0, stopNl = true, nPredict = 600, cache = true } = {}) {
  const body = { prompt: promptFor(r, accepted), grammar, temperature: temp, seed, n_predict: nPredict, cache_prompt: cache, t_max_predict_ms: stopNl ? 30000 : 90000 }; // time caps: a grammar blow-up can drop to <1 tok/s
  if (stopNl) body.stop = ['\n'];
  if (temp > 0) { body.top_k = 40; body.top_p = 0.95; }
  const d = await post('/completion', body);
  const tm = d.timings || {};
  return { content: d.content, stop: d.stop_type, truncated: d.truncated, predicted_n: tm.predicted_n ?? d.tokens_predicted, predicted_ms: tm.predicted_ms ?? 0, prompt_n: tm.prompt_n ?? 0, prompt_ms: tm.prompt_ms ?? 0 };
}

async function armPlain(r) {
  const t0 = performance.now();
  const x = await complete(r, '', STATIC_GBNF, { stopNl: false, cache: false, nPredict: 700 });
  return { output: x.content, calls: 1, gen_tokens: x.predicted_n, gen_ms: x.predicted_ms, prompt_tokens: x.prompt_n, prompt_ms: x.prompt_ms, wall_s: (performance.now() - t0) / 1000, rejected: 0, fallbacks: 0, truncated: !!x.truncated || x.stop === 'limit', capped: (performance.now() - t0) > 89000 };
}

const MAXLINES = 70;
async function armLines(r) { // identical logic to decode/run.mjs arm E
  const t0 = performance.now();
  let prefix = '', calls = 0, genTok = 0, genMs = 0, promptTok = 0, promptMs = 0, rejected = 0, fallbacks = 0, gramMs = 0, gramFail = 0;
  const hashSeed = [...r.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  for (let n = 0; n < MAXLINES; n++) {
    let g, t1 = performance.now();
    try { g = buildLineGrammar(prefix, { names: true, types: true }).grammar; } catch (e) { gramFail++; g = buildLineGrammar(prefix, { names: false }).grammar; }
    gramMs += performance.now() - t1;
    const lineNo = prefix ? prefix.split('\n').length : 1;
    let first = null, accepted = null, ended = false;
    for (let k = 0; k < 4; k++) {
      const x = await complete(r, prefix, g, k === 0 ? { seed: 1, temp: 0, nPredict: 200 } : { seed: hashSeed + k * 7919 + n, temp: 0.7, nPredict: 200 });
      calls++; genTok += x.predicted_n || 0; genMs += x.predicted_ms || 0; promptTok += x.prompt_n || 0; promptMs += x.prompt_ms || 0;
      if (x.stop === 'eos' && !x.content) { ended = true; break; }
      if (x.truncated || x.stop === 'limit') { rejected++; continue; }
      const line = x.content.replace(/\n$/, '') + '\n';
      if (first == null) first = line;
      const errs = prefixErrors(prefix + line, lineNo);
      if (!errs.length) { accepted = line; break; }
      rejected++;
    }
    if (ended) break;
    if (accepted == null) { if (first == null) break; accepted = first; fallbacks++; }
    prefix += accepted;
    if (/^ask /.test(prefix) && prefix.split('\n').filter(Boolean).length === 1) break;
    const ls = prefix.split('\n').filter(Boolean);
    if (ls.length > 10 && new Set(ls.slice(-6)).size === 1) break;
  }
  return { output: prefix, calls, gen_tokens: genTok, gen_ms: genMs, prompt_tokens: promptTok, prompt_ms: promptMs, wall_s: (performance.now() - t0) / 1000, rejected, fallbacks, gram_ms: Math.round(gramMs), gram_fail: gramFail, hit_maxlines: prefix.split('\n').filter(Boolean).length >= MAXLINES };
}

const storedOf = src => { const c = check(src); return c.ok ? strip(src) : null; };
const SUBSET = arg('subset', '') ? new Set(JSON.parse(readFileSync(arg('subset', ''), 'utf8'))) : null;
let list = items.filter(it => !done.has(it.id) && (!SUBSET || SUBSET.has(it.id)) && (!ONLY || (ONLY === 'change') === (it.category === 'change')));
// creates first, changes after (they need the create output)
list.sort((a, b) => (a.category === 'change') - (b.category === 'change'));
if (LIMIT) list = list.slice(0, LIMIT);
let n = 0;
for (const it of list) {
  let r = { id: it.id, task: 'create', request: it.request };
  let before_from = null;
  if (it.category === 'change') {
    const own = done.get(it.base);
    let st = own && own.output ? storedOf(own.output) : null;
    before_from = 'own';
    if (!st) { const ref = refs[it.base]; if (!ref || !ref.program) { console.error('skip change (no base yet)', it.id); continue; } st = strip(ref.program); before_from = 'reference'; }
    r = { id: it.id, task: 'edit', request: it.request, before: st };
  }
  const l0 = os.loadavg()[0];
  let res;
  try { res = ARM === 'P' ? await armPlain(r) : await armLines(r); }
  catch (e) {
    if (e instanceof Timeout) { // counted as a failed generation (empty output); the server is restarted so the slot is free
      appendFileSync(OUT, JSON.stringify({ id: it.id, model: MODEL, quant: QUANT, arm: ARM, task: r.task, before: r.before ?? null, before_from, output: '', timeout: true, error_detail: e.message, calls: 0, wall_s: null, load_start: +l0.toFixed(2) }) + '\n');
      console.error('TIMEOUT on', it.id); process.exit(3);
    }
    // the server is gone: llama-server crashed on this input (or was killed). Check whether it is still up.
    let up = false; try { up = (await fetch(`http://127.0.0.1:${PORT}/health`)).ok; } catch {}
    if (!up) { // record the crash as this item's (empty) result and exit 3 so the chain restarts the server and goes on
      appendFileSync(OUT, JSON.stringify({ id: it.id, model: MODEL, quant: QUANT, arm: ARM, task: r.task, before: r.before ?? null, before_from, output: '', server_crash: true, error_detail: String(e).slice(0, 200), calls: 0, wall_s: null, load_start: +l0.toFixed(2) }) + '\n');
      console.error('SERVER CRASH on', it.id); process.exit(3);
    }
    res = { output: '', error: String(e).slice(0, 300), calls: 0, wall_s: 0, gen_tokens: 0, gen_ms: 0 };
  }
  const row = { id: it.id, model: MODEL, quant: QUANT, arm: ARM, task: r.task, before: r.before ?? null, before_from, ...res, tok_s: res.gen_ms > 0 ? +(res.gen_tokens / (res.gen_ms / 1000)).toFixed(1) : null, load_start: +l0.toFixed(2), load_end: +os.loadavg()[0].toFixed(2) };
  appendFileSync(OUT, JSON.stringify(row) + '\n');
  done.set(it.id, row);
  if (++n % 10 === 0) console.error(`[${TAG}] ${n}/${list.length} wall ${res.wall_s?.toFixed(1)}s load ${row.load_end}`);
}
console.error(`[${TAG}] done ${n}`);
