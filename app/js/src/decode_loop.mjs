// The on-device generation loop: line-stepped decoding with a per-line name grammar, checker on the prefix
// and up to 3 resamples (arm D, or arm E with the type filters). A port of decode/run.mjs `armLines`
// (phase-2-decode) with the model call abstracted: `complete(req)` is llama.cpp on the phone (or a fake in tests).
import { buildLineGrammar, prefixErrors } from '../vendor/decode/linegram.mjs';
import { check } from '../vendor/lang/check.mjs';

// Training prompt of the r1 model (train/data/out/dataset_card.json). A new model may bring its own
// (models/<file>.json: {"system": "..."}).
export const DEFAULT_SYSTEM = 'You write MoldeScript, a tiny language for small phone apps. Reply with the complete program only, no explanation. For an edit request you get the current program: reply with the full updated program.';

const clean = s => String(s).replace(/<\|tok:/g, '<| tok:');   // the native side reads <|tok:ID|> as a special token

// After an ask: the original request, the question and the answer (the format the model is trained on).
// An edit puts the same three lines where its request goes.
export function userText(kind, request, current, ask) {
  const qa = ask && ask.question != null ? `\nQuestion: ${clean(ask.question)}\nAnswer: ${clean(ask.answer)}` : '';
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

// <bos>=2, <start_of_turn>=105, <end_of_turn>=106 as real ids, exactly like training (the GGUF would
// otherwise read the turn markers as plain text; see decode/REPORT.md finding 3).
export function promptFor(system, user, accepted) {
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
  let { kind = 'create', request, current = '', system = DEFAULT_SYSTEM, arm = 'E', complete, onProgress = () => {}, cancelled = () => false, deadlineMs = null, stallMs = 150 * 1000, firstLineMs = 300 * 1000, hardCapMs = 30 * 60 * 1000, maxLines = 70, useDraft = true, allowAsk = true, ask: askCtx = null, cancelNative = null } = o;
  const types = arm === 'E';
  // edits mostly re-emit the old program: offer the old line we expect next as a draft the native side can verify in one batch
  const oldLines = kind === 'edit' ? String(current || '').split('\n').filter((l, i, a) => i < a.length - 1 || l) : [];
  let oldPtr = 0;
  const user = userText(kind, request, current, askCtx);
  const seedBase = hashOf(request);
  const t0 = Date.now();
  const st = { calls: 0, genTok: 0, genMs: 0, promptTok: 0, promptMs: 0, cacheTok: 0, rejected: 0, fallbacks: 0, gramMs: 0, gramFail: 0, lines: 0, draftTry: 0, draftOk: 0 };
  let prefix = '', stoppedBy = null, errorText = null;
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
      const req = { prompt: promptFor(system, user, prefix), grammar: g, nPredict: 200, stopNl: true, temp: k === 0 ? 0 : 0.7, seed: k === 0 ? 1 : (seedBase + k * 7919 + n) | 0 };
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
  if (stoppedBy === 'cancel') return { ok: false, cancelled: true, program: prefix, errors: [], stats, log };
  if (stoppedBy === 'timeout') return { ok: false, timedOut: true, program: prefix, errors: ['it took too long'], stats, log };
  if (stoppedBy === 'error') return { ok: false, program: prefix, errors: [errorText], modelError: true, stats, log };
  if (!prefix.trim()) return { ok: false, program: '', errors: ['the model wrote nothing'], stats, log };
  const c = check(prefix);
  const ask = c.ast && c.ast.header && c.ast.header.kind === 'ask' ? { question: c.ast.header.question, options: c.ast.header.options } : null;
  if (ask) return { ok: false, ask, program: prefix, errors: [], stats, log };
  return { ok: c.ok, program: prefix, errors: c.ok ? [] : c.errors.map(String), stats, log };
}
