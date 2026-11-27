// The on-device generation loop: line-stepped decoding with a per-line name grammar, checker on the prefix
// and up to 3 resamples (arm D, or arm E with the type filters). A port of decode/run.mjs `armLines`
// (phase-2-decode) with the model call abstracted: `complete(req)` is llama.cpp on the phone (or a fake in tests).
import { buildLineGrammar, prefixErrors } from '../vendor/decode/linegram.mjs';
import { check } from '../vendor/lang/check.mjs';

// Training prompt of the r1 model (train/data/out/dataset_card.json). A new model may bring its own
// (models/<file>.json: {"system": "..."}).
export const DEFAULT_SYSTEM = 'You write MoldeScript, a tiny language for small phone apps. Reply with the complete program only, no explanation. For an edit request you get the current program: reply with the full updated program.';

// The r5c model writes edits as patch operations on the numbered program, and creates with a plan line first (models.json
// `format: "ops"`). The edit system prompt below is the exact text it was trained with (molde-model/failhunt/tools/patch_ops_ref.mjs).
export const SYSTEM_OPS = 'You write MoldeScript, a tiny language for small phone apps. Reply with the complete program only, no explanation. For an edit request you get the current program with numbered lines: reply only with the changes, as operations on those line numbers (insert after N, replace N or N-M, delete N or N-M, move N or N-M after K); each line to write follows its operation and starts with "+ ".';
const splitLines = s => (s.endsWith('\n') ? s.slice(0, -1) : s).split('\n');
export const numbered = prog => splitLines(prog).map((x, i) => `${i + 1}| ${x}`).join('\n');

const clean = s => String(s).replace(/<\|tok:/g, '<| tok:');   // the native side reads <|tok:ID|> as a special token

// After an ask: the original request, the question and the answer (the format the model is trained on).
// An edit puts the same three lines where its request goes.
export function userText(kind, request, current, ask, format = 'whole') {
  const qa = ask && ask.question != null ? `\nQuestion: ${clean(ask.question)}\nAnswer: ${clean(ask.answer)}` : '';
  if (kind === 'edit' && format === 'ops') return `Edit request: ${clean(request)}${qa}\n\nCurrent program:\n${clean(numbered(String(current || '')))}`;   // no trailing newline, as trained
  if (kind === 'edit') {
    const cur = String(current || '').replace(/\n*$/, '\n');
    return `Edit request: ${clean(request)}${qa}\n\nCurrent program:\n${clean(cur)}`;
  }
  return `Request: ${clean(request)}${qa}`;
}

// The first line may be an ask only when allowed: with allowAsk=false the grammar offers only the app line.
// (The decoder still accepts a model that asks; only the grammar changes.)
export function noAsk(grammar) {
  return grammar.includes('( ask-stmt | app-stmt ) nl') ? grammar.replace('( ask-stmt | app-stmt ) nl', 'app-stmt nl') : grammar;
}

// Gemma: <bos>=2, <start_of_turn>=105, <end_of_turn>=106 as real ids, exactly like training (the GGUF would otherwise read the
// turn markers as plain text; see decode/REPORT.md finding 3). Qwen3.5 (template 'qwen'): ChatML with the empty think block,
// <|im_start|>=248045 and <|im_end|>=248046, no BOS (the format the r4 Qwen training uses).
export const TEMPLATES = ['gemma', 'qwen'];
export function promptFor(system, user, accepted, template = 'gemma') {
  if (template === 'qwen') {
    return `<|tok:248045|>system\n${clean(system)}<|tok:248046|>\n<|tok:248045|>user\n${user}<|tok:248046|>\n<|tok:248045|>assistant\n<think>\n\n</think>\n\n${accepted}`;
  }
  return `<|tok:2|><|tok:105|>user\n${clean(system)}\n\n${user}<|tok:106|>\n<|tok:105|>model\n${accepted}`;
}


// Where the old program goes on after an accepted line: past the line it copied, past a later old line it jumped to,
// and unchanged when the line is new (an insertion) so the old line is offered again for the next position.
export function nextOldPtr(old, p, line) {
  if (p < old.length && old[p] === line) return p + 1;
  for (let j = p + 1; j < Math.min(old.length, p + 12); j++) if (old[j] === line) return j + 1;
  if (p < old.length && sameKind(old[p], line)) return p + 1;   // a rewritten line: the old one is used up
  return p;
}
const sameKind = (a, b) => (a.trim().split(/\s+/)[0] || '') === (b.trim().split(/\s+/)[0] || '');

const hashOf = s => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

/**
 * generate({ kind: 'create'|'edit', request, current, system, arm: 'D'|'E', complete, onProgress, cancelled, deadlineMs, maxLines })
 *   complete({prompt, grammar, nPredict, temp, seed, stopNl}) -> Promise<{stop, text, n_prompt, n_gen, ms_prompt, ms_gen}>
 * returns { ok, program, errors, ask, cancelled, timedOut, stats }
 */
export async function generate(o) {
  let { kind = 'create', request, current = '', system = DEFAULT_SYSTEM, arm = 'E', complete, onProgress = () => {}, cancelled = () => false, deadlineMs = null, stallMs = 150 * 1000, firstLineMs = 300 * 1000, hardCapMs = 30 * 60 * 1000, maxLines = 70, useDraft = true, allowAsk = true, ask: askCtx = null, cancelNative = null, template = 'gemma', format = 'whole' } = o;
  const ops = format === 'ops';
  if (ops && kind === 'edit') return generateOps(o);
  const types = arm === 'E';
  // edits mostly re-emit the old program: offer the old line we expect next as a draft the native side can verify in one batch
  const oldLines = kind === 'edit' ? String(current || '').split('\n').filter((l, i, a) => i < a.length - 1 || l) : [];
  let oldPtr = 0;
  const user = userText(kind, request, current, askCtx, format);
  const seedBase = hashOf(request);
  const t0 = Date.now();
  const st = { calls: 0, genTok: 0, genMs: 0, promptTok: 0, promptMs: 0, cacheTok: 0, rejected: 0, fallbacks: 0, gramMs: 0, gramFail: 0, lines: 0, draftTry: 0, draftOk: 0 };
  let prefix = '', stoppedBy = null, errorText = null;
  // Plan first (format "ops", creates): the model writes one "# need: ..." line from the request (what the app must have). It stays in
  // the prompt as the start of the answer and is never part of the program, so it cannot reach the checker or the app.
  let planPre = '', plan = null;
  if (ops && kind === 'create') {
    try {
      const px = await complete({ prompt: promptFor(system, user, '', template), grammar: 'root ::= "# need:" [^\\n]* "\\n"', nPredict: 160, stopNl: true, temp: 0, seed: 1 });
      if (px && px.stop !== 'error' && px.stop !== 'cancel' && px.text && /^# need:/.test(px.text)) { plan = px.text.replace(/\n$/, ''); planPre = plan + '\n'; }
    } catch (e) { /* no plan: the program is still written */ }
  }
  // the deadline also interrupts a line in progress: the native side checks its cancel flag after every token
  // The limit depends on progress: keep going while lines still arrive, stop only after `stallMs` with no new line
  // (`firstLineMs` before the first one: the prompt has to be read), or at the hard cap. `deadlineMs` sets all three (tests).
  if (deadlineMs != null) { stallMs = firstLineMs = hardCapMs = deadlineMs; }
  let timedOut = false, lastLineAt = Date.now();
  const stop = () => { if (timedOut) return; timedOut = true; if (cancelNative) try { cancelNative(); } catch (e) { /* ignore */ } };
  const timer = setInterval(() => {
    const now = Date.now();
    if (now - t0 > hardCapMs || now - lastLineAt > (st.lines === 0 ? firstLineMs : stallMs)) stop();
  }, Math.max(10, Math.min(1000, stallMs / 4)));
  const log = [];
  for (let n = 0; n < maxLines; n++) {
    if (timedOut) { stoppedBy = 'timeout'; break; }
    if (cancelled()) { stoppedBy = 'cancel'; break; }
    let g;
    const tg = performance.now();
    try { g = buildLineGrammar(prefix, { names: true, types }).grammar; } catch (e) { st.gramFail++; g = buildLineGrammar(prefix, { names: false }).grammar; }
    if (!allowAsk && !prefix) g = noAsk(g);
    st.gramMs += performance.now() - tg;
    const lineNo = prefix ? prefix.split('\n').length : 1;
    let first = null, accepted = null, ended = false;
    for (let k = 0; k < 4; k++) {
      if (timedOut) { stoppedBy = 'timeout'; break; }
      if (cancelled()) { stoppedBy = 'cancel'; break; }
      const req = { prompt: promptFor(system, user, planPre + prefix, template), grammar: g, nPredict: 200, stopNl: true, temp: k === 0 ? 0 : 0.7, seed: k === 0 ? 1 : (seedBase + k * 7919 + n) | 0 };
      if (k === 0 && useDraft && oldPtr < oldLines.length) req.draft = oldLines[oldPtr];
      const x = await complete(req);
      if (x.stop === 'error') { errorText = x.error || 'the model stopped with an error'; stoppedBy = 'error'; break; }
      if (x.stop === 'cancel') { stoppedBy = timedOut ? 'timeout' : 'cancel'; break; }
      st.calls++; st.genTok += x.n_gen || 0; st.genMs += x.ms_gen || 0; st.promptTok += x.n_prompt || 0; st.promptMs += x.ms_prompt || 0; st.cacheTok += x.n_cache || 0; st.draftTry += x.n_draft_try || 0; st.draftOk += x.n_draft_ok || 0;
      if (x.stop === 'eos' && !x.text) { ended = true; break; }
      if (x.stop === 'limit') { st.rejected++; continue; }
      const line = x.text.replace(/\n$/, '') + '\n';
      if (first == null) first = line;
      const errs = prefixErrors(prefix + line, lineNo);
      if (!errs.length) { accepted = line; break; }
      st.rejected++;
      log.push({ line: lineNo, bad: line.trim(), err: String(errs[0]).slice(0, 160), try: k });
    }
    if (stoppedBy) break;
    if (ended) break;
    if (accepted == null) { if (first == null) break; accepted = first; st.fallbacks++; }
    prefix += accepted;
    st.lines++;
    lastLineAt = Date.now();
    oldPtr = nextOldPtr(oldLines, oldPtr, accepted.replace(/\n$/, ''));
    onProgress({ lines: st.lines, program: prefix, rejected: st.rejected, seconds: Math.round((Date.now() - t0) / 1000) });
    if (/^ask /.test(prefix) && prefix.split('\n').filter(Boolean).length === 1) break;   // an ask program is one line
    const ls = prefix.split('\n').filter(Boolean);
    if (ls.length > 10 && new Set(ls.slice(-6)).size === 1) break;                           // degenerate repetition
  }
  clearInterval(timer);
  const seconds = (Date.now() - t0) / 1000;
  const stats = { seconds: +seconds.toFixed(2), tokens: st.genTok, tokPerSec: st.genMs ? +(st.genTok / (st.genMs / 1000)).toFixed(1) : 0, calls: st.calls, resamples: st.rejected, fallbacks: st.fallbacks, lines: st.lines, promptTokens: st.promptTok, cachedTokens: st.cacheTok, grammarMs: Math.round(st.gramMs), grammarFailures: st.gramFail, draftTried: st.draftTry, draftAccepted: st.draftOk, arm };
  if (stoppedBy === 'cancel') return { ok: false, cancelled: true, program: prefix, errors: [], stats, log, plan };
  if (stoppedBy === 'timeout') return { ok: false, timedOut: true, program: prefix, errors: ['it took too long'], stats, log, plan };
  if (stoppedBy === 'error') return { ok: false, program: prefix, errors: [errorText], modelError: true, stats, log, plan };
  if (!prefix.trim()) return { ok: false, program: '', errors: ['the model wrote nothing'], stats, log, plan };
  const c = check(prefix);
  const ask = c.ast && c.ast.header && c.ast.header.kind === 'ask' ? { question: c.ast.header.question, options: c.ast.header.options } : null;
  if (ask) return { ok: false, ask, program: prefix, errors: [], stats, log, plan };
  return { ok: c.ok, program: prefix, errors: c.ok ? [] : c.errors.map(String), stats, log, plan };
}

/**
 * An edit by a model that writes patch operations (format "ops"): one plain completion (no grammar, no line stepping), the numbered
 * program in the prompt. Returns { ok: true, format: 'ops', ops, stats } for the app to apply (lib/src/patch_ops.dart) and check, or
 * { ok: false, ... } when nothing usable came back. An answer cut off at the token limit is refused: a half-written operation must
 * never be applied.
 */
export async function generateOps(o) {
  const { request, current = '', system = SYSTEM_OPS, complete, cancelled = () => false, deadlineMs = null, hardCapMs: cap = 30 * 60 * 1000, cancelNative = null, template = 'gemma', ask: askCtx = null, ctx = 4096 } = o;
  const hardCapMs = deadlineMs != null ? deadlineMs : cap;
  const user = userText('edit', request, current, askCtx, 'ops');
  const prompt = promptFor(SYSTEM_OPS, user, '', template);
  const t0 = Date.now();
  let timedOut = false;
  const stop = () => { if (timedOut) return; timedOut = true; if (cancelNative) try { cancelNative(); } catch (e) { /* ignore */ } };
  const timer = setTimeout(stop, hardCapMs);
  // the context is 4096 tokens: leave the answer what the prompt does not use (3 characters a token is pessimistic for code), at most 800
  const nPredict = Math.max(96, Math.min(800, ctx - Math.ceil(prompt.length / 3) - 32));
  let x;
  try {
    if (cancelled()) return { ok: false, cancelled: true, program: '', errors: [], stats: { seconds: 0, lines: 0, arm: 'ops' } };
    x = await complete({ prompt, grammar: '', nPredict, stopNl: false, temp: 0, seed: 1 });
  } finally { clearTimeout(timer); }
  const seconds = (Date.now() - t0) / 1000;
  const stats = { seconds: +seconds.toFixed(2), tokens: x.n_gen || 0, tokPerSec: x.ms_gen ? +((x.n_gen || 0) / (x.ms_gen / 1000)).toFixed(1) : 0, calls: 1, resamples: 0, fallbacks: 0, lines: 0, promptTokens: x.n_prompt || 0, cachedTokens: x.n_cache || 0, grammarMs: 0, grammarFailures: 0, draftTried: 0, draftAccepted: 0, arm: 'ops' };
  if (x.stop === 'error') return { ok: false, program: '', errors: [x.error || 'the model stopped with an error'], modelError: true, stats };
  if (x.stop === 'cancel') return timedOut ? { ok: false, timedOut: true, program: '', errors: ['it took too long'], stats } : { ok: false, cancelled: true, program: '', errors: [], stats };
  if (timedOut) return { ok: false, timedOut: true, program: '', errors: ['it took too long'], stats };
  const text = String(x.text || '');
  if (!text.trim()) return { ok: false, program: '', errors: ['the model wrote nothing'], stats };
  if (x.stop === 'limit') return { ok: false, program: '', errors: ['the model\'s change instructions were cut off before the end'], patchError: true, stats };
  return { ok: true, format: 'ops', ops: text, stats };
}
