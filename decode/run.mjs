#!/usr/bin/env node
// Runs one arm on one request set against a llama-server on :8201 (started with decode/serve.sh QUANT).
//   node run.mjs --arm A|Atok|B|C|D --set real|templ [--limit N] [--out DIR] [--tag NAME]
// A     whole program in one call, static grammar, chat endpoint (the r1 report's setup)
// Atok  same, but the prompt is built with the REAL special-token ids (see REPORT: the GGUF tokenises <start_of_turn> as text)
// B     line-stepped, static grammar, checker resample
// C     line-stepped, per-line name grammar, no resample
// D     C + checker resample
// Env: PROMPT=text|tok (prompt route for B/C/D, default tok), PORT, MOLDE_REFS (dir with test_refs.jsonl / templ_refs.jsonl)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import { buildLineGrammar, prefixErrors } from './linegram.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const ARM = arg('arm', 'A'), SET = arg('set', 'real'), LIMIT = +arg('limit', 0), OUT = arg('out', new URL('./results', import.meta.url).pathname);
const PORT = process.env.PORT || '8201';
const ROUTE = process.env.PROMPT || 'tok';
const DATA = process.env.MOLDE_REFS || '/tmp/molde-p2/train/data/out-r1';
const LANG = new URL('../lang', import.meta.url).pathname;
const QUANT = arg('quant', 'Q8_0');
const TAG = arg('tag', `${ARM}_${QUANT}_${SET}`);
const STATIC_GBNF = readFileSync(`${LANG}/moldescript.gbnf`, 'utf8');
const SYSTEM = JSON.parse(readFileSync(`${DATA}/dataset_card.json`, 'utf8')).system_prompt;
const refs = readFileSync(`${DATA}/${SET === 'real' ? 'test_refs' : 'templ_refs'}.jsonl`, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
if (LIMIT) refs.length = Math.min(refs.length, LIMIT);

const post = async (path, body) => {
  const r = await fetch(`http://127.0.0.1:${PORT}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${path} ${r.status} ${(await r.text()).slice(0, 300)}`);
  return r.json();
};
const userText = r => r.task === 'edit' ? `Edit request: ${r.request}\n\nCurrent program:\n${r.before}` : `Request: ${r.request}`;
const messages = r => [{ role: 'system', content: SYSTEM }, { role: 'user', content: userText(r) }];
// prompt for /completion: text route = the server's own chat template (special tokens come out as plain text in this GGUF);
// tok route = <bos> <start_of_turn>=105 ... <end_of_turn>=106 as real ids, like training
let TEMPLATE_CACHE = new Map();
async function promptFor(r, accepted) {
  if (ROUTE === 'text') {
    if (!TEMPLATE_CACHE.has(r.id)) TEMPLATE_CACHE.set(r.id, (await post('/apply-template', { messages: messages(r) })).prompt);
    return TEMPLATE_CACHE.get(r.id) + accepted;
  }
  return [2, 105, `user\n${SYSTEM}\n\n${userText(r)}`, 106, '\n', 105, 'model\n' + accepted];
}
const promptWhole = async r => ROUTE === 'text' || ARM === 'A' ? (await promptFor(r, '')) : promptFor(r, '');

async function complete(r, accepted, grammar, { seed = 1, temp = 0, stopNl = true, nPredict = 600, cache = true } = {}) {
  const body = { prompt: await promptFor(r, accepted), grammar, temperature: temp, seed, n_predict: nPredict, cache_prompt: cache };
  if (stopNl) body.stop = ['\n'];
  if (temp > 0) { body.top_k = 40; body.top_p = 0.95; }
  const t0 = performance.now();
  const d = await post('/completion', body);
  const tm = d.timings || {};
  return { content: d.content, stop: d.stop_type, truncated: d.truncated, predicted_n: tm.predicted_n ?? d.tokens_predicted, predicted_ms: tm.predicted_ms ?? 0, prompt_n: tm.prompt_n ?? 0, prompt_ms: tm.prompt_ms ?? 0, cache_n: tm.cache_n ?? 0, wall_ms: performance.now() - t0 };
}

async function armWhole(r) { // A and Atok
  const t0 = performance.now();
  let d;
  if (ARM === 'A') {
    const x = await post('/v1/chat/completions', { messages: messages(r), temperature: 0, max_tokens: 600, cache_prompt: false, grammar: STATIC_GBNF });
    const tm = x.timings || {};
    d = { content: x.choices[0].message.content, predicted_n: tm.predicted_n, predicted_ms: tm.predicted_ms, prompt_n: tm.prompt_n };
  } else {
    const x = await complete(r, '', STATIC_GBNF, { stopNl: false, cache: false });
    d = { content: x.content, predicted_n: x.predicted_n, predicted_ms: x.predicted_ms, prompt_n: x.prompt_n };
  }
  return { output: d.content, calls: 1, gen_tokens: d.predicted_n, gen_ms: d.predicted_ms, prompt_tokens: d.prompt_n, wall_s: (performance.now() - t0) / 1000, rejected: 0, fallbacks: 0 };
}

const NAMES = ARM === 'C' || ARM === 'D' || ARM === 'E';
const TYPES = ARM === 'E';
const RESAMPLE = ARM === 'B' || ARM === 'D' || ARM === 'E';
const MAXLINES = 70;
async function armLines(r) {
  const t0 = performance.now();
  let prefix = '', calls = 0, genTok = 0, genMs = 0, promptTok = 0, promptMs = 0, rejected = 0, fallbacks = 0, gramMs = 0, gramFail = 0;
  const log = [];
  const hashSeed = [...r.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  for (let n = 0; n < MAXLINES; n++) {
    let g, t1 = performance.now();
    try { g = buildLineGrammar(prefix, { names: NAMES, types: TYPES }).grammar; } catch (e) { gramFail++; g = buildLineGrammar(prefix, { names: false }).grammar; }
    gramMs += performance.now() - t1;
    const lineNo = prefix ? prefix.split('\n').length : 1; // 1-based number of the line being written
    let first = null, accepted = null, ended = false;
    const tries = RESAMPLE ? 4 : 1;
    for (let k = 0; k < tries; k++) {
      const x = await complete(r, prefix, g, k === 0 ? { seed: 1, temp: 0, nPredict: 200 } : { seed: hashSeed + k * 7919 + n, temp: 0.7, nPredict: 200 });
      calls++; genTok += x.predicted_n || 0; genMs += x.predicted_ms || 0; promptTok += x.prompt_n || 0; promptMs += x.prompt_ms || 0;
      if (x.stop === 'eos' && !x.content) { ended = true; break; }
      if (x.truncated || x.stop === 'limit') { if (first == null) first = null; rejected++; continue; }
      const line = x.content.replace(/\n$/, '') + '\n';
      if (first == null) first = line;
      if (!RESAMPLE) { accepted = line; break; }
      const errs = prefixErrors(prefix + line, lineNo);
      if (!errs.length) { accepted = line; break; }
      rejected++;
      log.push({ line: lineNo, bad: line.trim(), err: String(errs[0]).slice(0, 160), try: k });
    }
    if (ended) break;
    if (accepted == null) { if (first == null) break; accepted = first; fallbacks++; }
    prefix += accepted;
    if (/^ask /.test(prefix) && prefix.split('\n').filter(Boolean).length === 1) break; // an ask program is one line
    // degenerate repetition guard
    const ls = prefix.split('\n').filter(Boolean);
    if (ls.length > 10 && new Set(ls.slice(-6)).size === 1) break;
  }
  return { output: prefix, calls, gen_tokens: genTok, gen_ms: genMs, prompt_tokens: promptTok, prompt_ms: promptMs, wall_s: (performance.now() - t0) / 1000, rejected, fallbacks, gram_ms: gramMs, gram_fail: gramFail, log };
}

mkdirSync(OUT, { recursive: true });
const load0 = os.loadavg()[0];
const rows = [];
let i = 0;
for (const r of refs) {
  let res;
  try { res = (ARM === 'A' || ARM === 'Atok') ? await armWhole(r) : await armLines(r); }
  catch (e) { console.error('ERROR', r.id, String(e).slice(0, 200)); res = { output: '', error: String(e).slice(0, 300), calls: 0, wall_s: 0, gen_tokens: 0, gen_ms: 0 }; }
  rows.push({ id: r.id, task: r.task, request: r.request, ref: r.ref, ...res });
  i++;
  if (i % 10 === 0) console.error(`[${TAG}] ${i}/${refs.length} last wall ${res.wall_s.toFixed(1)}s calls ${res.calls}`);
}
const load1 = os.loadavg()[0];
const gen = `${OUT}/${TAG}.gen.jsonl`;
writeFileSync(gen, rows.map(x => JSON.stringify(x)).join('\n') + '\n');
// score with the trainer's scorer
const sc = execFileSync('node', [new URL('./score.mjs', import.meta.url).pathname, gen], { env: { ...process.env, MOLDE_LANG: LANG }, maxBuffer: 1 << 28 }).toString();
const scored = sc.split('\n').filter(Boolean).map(l => JSON.parse(l));
writeFileSync(`${OUT}/${TAG}.scored.jsonl`, scored.map(x => JSON.stringify(x)).join('\n') + '\n');
const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0; };
const mean = a => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const errClass = {};
for (const x of scored) if (!x.pass_raw) { const c = x.err_code || 'E_PARSE'; errClass[c] = (errClass[c] || 0) + 1; }
const summary = {
  tag: TAG, arm: ARM, quant: QUANT, set: SET, route: ARM === 'A' ? 'chat-template(text)' : ROUTE, n: scored.length,
  pass: +mean(scored.map(x => +x.pass_raw)).toFixed(3), intent_score: +mean(scored.map(x => x.score || 0)).toFixed(3), intent_auto: +mean(scored.map(x => +!!x.intent_auto)).toFixed(3),
  median_s_per_app: +med(rows.map(x => x.wall_s)).toFixed(2),
  median_tok_s: +med(rows.filter(x => x.gen_ms > 0).map(x => x.gen_tokens / (x.gen_ms / 1000))).toFixed(1),
  median_calls: med(rows.map(x => x.calls)), mean_calls: +mean(rows.map(x => x.calls)).toFixed(1),
  median_lines: med(scored.map(x => x.lines)), median_ref_lines: med(scored.map(x => (x.ref || '').trim().split('\n').length)),
  median_gen_tokens: med(rows.map(x => x.gen_tokens)), rejected_total: rows.reduce((a, x) => a + (x.rejected || 0), 0), fallbacks_total: rows.reduce((a, x) => a + (x.fallbacks || 0), 0),
  median_grammar_ms_per_app: +med(rows.map(x => x.gram_ms || 0)).toFixed(0), gram_fail: rows.reduce((a, x) => a + (x.gram_fail || 0), 0),
  one_line_programs: scored.filter(x => x.lines <= 1).length, errors_first: errClass, loadavg_start: +load0.toFixed(2), loadavg_end: +load1.toFixed(2), threads: process.env.THREADS || '6',
};
writeFileSync(`${OUT}/${TAG}.summary.json`, JSON.stringify(summary, null, 1));
console.log(JSON.stringify(summary));
