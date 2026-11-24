// The on-device generation loop: line-stepped decoding with a per-line name grammar, checker on the prefix
// and up to 3 resamples (arm D, or arm E with the type filters). A port of decode/run.mjs `armLines`
// (phase-2-decode) with the model call abstracted: `complete(req)` is llama.cpp on the phone (or a fake in tests).
import { buildLineGrammar, prefixErrors } from '../vendor/decode/linegram.mjs';
import { check } from '../vendor/lang/check.mjs';

// Training prompt of the r1 model (train/data/out/dataset_card.json). A new model may bring its own
// (models/<file>.json: {"system": "..."}).
export const DEFAULT_SYSTEM = 'You write MoldeScript, a tiny language for small phone apps. Reply with the complete program only, no explanation. For an edit request you get the current program: reply with the full updated program.';

const clean = s => String(s).replace(/<\|tok:/g, '<| tok:');   // the native side reads <|tok:ID|> as a special token

export function userText(kind, request, current) {
  if (kind === 'edit') {
    const cur = String(current || '').replace(/\n*$/, '\n');
    return `Edit request: ${clean(request)}\n\nCurrent program:\n${clean(cur)}`;
  }
  return `Request: ${clean(request)}`;
}

// <bos>=2, <start_of_turn>=105, <end_of_turn>=106 as real ids, exactly like training (the GGUF would
// otherwise read the turn markers as plain text; see decode/REPORT.md finding 3).
export function promptFor(system, user, accepted) {
  return `<|tok:2|><|tok:105|>user\n${clean(system)}\n\n${user}<|tok:106|>\n<|tok:105|>model\n${accepted}`;
}

const hashOf = s => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

/**
 * generate({ kind: 'create'|'edit', request, current, system, arm: 'D'|'E', complete, onProgress, cancelled, deadlineMs, maxLines })
 *   complete({prompt, grammar, nPredict, temp, seed, stopNl}) -> Promise<{stop, text, n_prompt, n_gen, ms_prompt, ms_gen}>
 * returns { ok, program, errors, ask, cancelled, timedOut, stats }
 */
export async function generate(o) {
  const { kind = 'create', request, current = '', system = DEFAULT_SYSTEM, arm = 'E', complete, onProgress = () => {}, cancelled = () => false, deadlineMs = 6 * 60 * 1000, maxLines = 70 } = o;
  const types = arm === 'E';
  const user = userText(kind, request, current);
  const seedBase = hashOf(request);
  const t0 = Date.now();
  const st = { calls: 0, genTok: 0, genMs: 0, promptTok: 0, promptMs: 0, cacheTok: 0, rejected: 0, fallbacks: 0, gramMs: 0, gramFail: 0, lines: 0 };
  let prefix = '', stoppedBy = null, errorText = null;
  const log = [];
  for (let n = 0; n < maxLines; n++) {
    if (cancelled()) { stoppedBy = 'cancel'; break; }
    if (Date.now() - t0 > deadlineMs) { stoppedBy = 'timeout'; break; }
    let g;
    const tg = performance.now();
    try { g = buildLineGrammar(prefix, { names: true, types }).grammar; } catch (e) { st.gramFail++; g = buildLineGrammar(prefix, { names: false }).grammar; }
    st.gramMs += performance.now() - tg;
    const lineNo = prefix ? prefix.split('\n').length : 1;
    let first = null, accepted = null, ended = false;
    for (let k = 0; k < 4; k++) {
      if (cancelled()) { stoppedBy = 'cancel'; break; }
      const req = { prompt: promptFor(system, user, prefix), grammar: g, nPredict: 200, stopNl: true, temp: k === 0 ? 0 : 0.7, seed: k === 0 ? 1 : (seedBase + k * 7919 + n) | 0 };
      const x = await complete(req);
      if (x.stop === 'error') { errorText = x.error || 'the model stopped with an error'; stoppedBy = 'error'; break; }
      if (x.stop === 'cancel') { stoppedBy = 'cancel'; break; }
      st.calls++; st.genTok += x.n_gen || 0; st.genMs += x.ms_gen || 0; st.promptTok += x.n_prompt || 0; st.promptMs += x.ms_prompt || 0; st.cacheTok += x.n_cache || 0;
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
    onProgress({ lines: st.lines, program: prefix, rejected: st.rejected });
    if (/^ask /.test(prefix) && prefix.split('\n').filter(Boolean).length === 1) break;   // an ask program is one line
    const ls = prefix.split('\n').filter(Boolean);
    if (ls.length > 10 && new Set(ls.slice(-6)).size === 1) break;                           // degenerate repetition
  }
  const seconds = (Date.now() - t0) / 1000;
  const stats = { seconds: +seconds.toFixed(2), tokens: st.genTok, tokPerSec: st.genMs ? +(st.genTok / (st.genMs / 1000)).toFixed(1) : 0, calls: st.calls, resamples: st.rejected, fallbacks: st.fallbacks, lines: st.lines, promptTokens: st.promptTok, cachedTokens: st.cacheTok, grammarMs: Math.round(st.gramMs), grammarFailures: st.gramFail, arm };
  if (stoppedBy === 'cancel') return { ok: false, cancelled: true, program: prefix, errors: [], stats, log };
  if (stoppedBy === 'timeout') return { ok: false, timedOut: true, program: prefix, errors: ['it took too long'], stats, log };
  if (stoppedBy === 'error') return { ok: false, program: prefix, errors: [errorText], modelError: true, stats, log };
  if (!prefix.trim()) return { ok: false, program: '', errors: ['the model wrote nothing'], stats, log };
  const c = check(prefix);
  const ask = c.ast && c.ast.header && c.ast.header.kind === 'ask' ? { question: c.ast.header.question, options: c.ast.header.options } : null;
  if (ask) return { ok: false, ask, program: prefix, errors: [], stats, log };
  return { ok: c.ok, program: prefix, errors: c.ok ? [] : c.errors.map(String), stats, log };
}
