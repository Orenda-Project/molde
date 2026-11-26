// Failure hunt runner: the app's own generation loop (decode_loop.mjs, arm E) over the host copy of the phone core (molde_core.h b12144),
// plus the app's rules around it (rules.mjs = port of rules.dart): no-ask rule, direct edits, new-app question, 20% / unasked-removal guards,
// data-safety verdict. Resumable: one JSON line per finished case in OUT.
//   node hunt.mjs MODEL.gguf OUT.jsonl LABEL [gemma|qwen] [limit]
import { readFileSync, appendFileSync, existsSync } from 'node:fs';
import os from 'node:os';
const H = new URL('..', import.meta.url).pathname;
const APPJS = process.env.APPJS || H + 'app/js';
const { generate } = await import(`${APPJS}/src/${process.env.DECODE || 'decode_loop.mjs'}`);
const { startCoreWatched } = await import('./core_watch.mjs');
const { check } = await import(`${APPJS}/vendor/lang/check.mjs`);
const { load } = await import(`${APPJS}/vendor/lang/eval.mjs`);
const { evolve } = await import(`${APPJS}/vendor/lang/diff.mjs`);
const { prepareEdit } = await import(`${APPJS}/src/edit_prep.mjs`);
const R = await import('./rules.mjs');
const P = await import('./preds.mjs');
const [model, out, label, template = 'gemma', limit = '1e9'] = process.argv.slice(2);
const SERVER = process.env.SERVER || H + 'bin/core_server', LIBDIR = process.env.LIBDIR || `${process.env.HOME}/kamal/molde/llama-bin/llama-b12144`, THREADS = +(process.env.THREADS || 4);
const NOW = Date.UTC(2026, 10, 26, 9, 0, 0);
const cases = readFileSync(process.env.CASES || H + 'cases.jsonl', 'utf8').trim().split('\n').map(l => JSON.parse(l));
const done = new Set(existsSync(out) ? readFileSync(out, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l).id) : []);
const core = startCoreWatched({ model, threads: THREADS, server: SERVER, libdir: LIBDIR, hangLog: out.replace(/\.jsonl$/, '') + '.hangs.jsonl', tag: label });
let PROMPTS = null;
const complete = req => { if (PROMPTS) PROMPTS.push(req.prompt); return core.complete(req); };
import { createHash } from 'node:crypto';
const require_md5 = s => createHash('md5').update(s).digest('hex');
const errCode = e => (/E_[A-Z_]+/.exec(String(e || '')) || [''])[0];
const lineNo = e => (/^line (\d+)/.exec(String(e || '')) || [])[1];
const save = rec => appendFileSync(out, JSON.stringify(rec) + '\n');
const loads = src => { try { const a = load(src, { now: NOW, currency: 'Rs', tz: 'UTC' }); return { ok: !!a.ok, errors: (a.errors || []).map(String).slice(0, 2) }; } catch (e) { return { ok: false, errors: ['load threw: ' + String(e).slice(0, 120)] }; } };
const slim = r => ({ ok: !!r.ok, errors: (r.errors || []).slice(0, 3), first_err: errCode((r.errors || [])[0]), err_line: lineNo((r.errors || [])[0]), asked: !!r.ask, ask: r.ask || null, timedOut: !!r.timedOut, modelError: !!r.modelError, stats: r.stats, bad_lines: (r.log || []).slice(0, 6) });

async function runCreate(c) {
  const allowAsk = process.env.ALLOWASK ? true : !R.namesAThing(c.request);   // controller.dart: may = ask == null && !namesAThing(request)
  let r = await generate({ kind: 'create', request: c.request, complete, template, allowAsk, maxLines: 70 });
  const rec = { id: c.id, type: 'create', label, request: c.request, style: c.style, cat: c.cat, allowAsk, first: slim(r) };
  rec.asked = !!r.ask;
  if (r.ask) {   // the app shows the question; the user taps the first option (or types yes)
    const ans = (r.ask.options && r.ask.options[0]) || 'yes';
    rec.answer = ans;
    r = await generate({ kind: 'create', request: c.request, complete, template, allowAsk: false, ask: { question: r.ask.question, answer: ans }, maxLines: 70 });
    rec.after_answer = slim(r);
  }
  let program = r.program || '';
  if (r.ok) { const b = R.betterTitle(program, c.request); if (b) { program = R.withTitle(program, b); rec.title_replaced = b; } }
  rec.ok = !!r.ok; rec.program = program; rec.lines = R.programLines(program).length; rec.errors = (r.errors || []).slice(0, 3); rec.first_err = errCode((r.errors || [])[0]);
  rec.loads = r.ok ? loads(program) : { ok: false, errors: [] };
  rec.rep = P.repeats(program); rec.tokens = r.stats && r.stats.tokens; rec.seconds = r.stats && r.stats.seconds; rec.tok_s = r.stats && r.stats.tokPerSec;
  rec.resamples = r.stats && r.stats.resamples; rec.fallbacks = r.stats && r.stats.fallbacks;
  rec.needs = P.needHits(program, c.needs || []);
  return rec;
}

// one chat message on an open app, the way controller.dart send() + _afterGenerate() handle it
async function appEdit(app, request) {
  const src = app.source; const o = { request, route: 'model' };
  const finish = (program, extra) => Object.assign(o, extra, { program });
  let direct = false, de = R.appLineEdit(request, src), proposed = null;
  if (de) { direct = true; o.route = 'direct-appline'; if (de.unchanged) return finish(src, { outcome: 'already_that_way', raw: src }); proposed = de.program; }
  else { const se = R.settingEditProgram(request, src); if (se != null) { direct = true; o.route = 'direct-setting'; if (se === src) return finish(src, { outcome: 'already_that_way', raw: src }); proposed = se; } }
  if (!direct) {
    if (R.looksLikeNewApp(request, src)) o.intercepted_newapp = true;   // the app asks "new app or change?"; the user taps Change
    const r = await generate({ kind: 'edit', request, current: src, complete, template, allowAsk: !R.namesAThing(request), useDraft: true, maxLines: Math.max(70, R.programLines(src).length + 40) });
    o.gen = slim(r); o.tokens = r.stats && r.stats.tokens; o.seconds = r.stats && r.stats.seconds; o.tok_s = r.stats && r.stats.tokPerSec; o.draft = r.stats ? [r.stats.draftTried, r.stats.draftAccepted] : null; o.resamples = r.stats && r.stats.resamples;
    o.raw = r.program || '';
    if (r.timedOut) return finish(src, { outcome: 'timeout' });
    if (r.modelError) return finish(src, { outcome: 'model_error' });
    if (r.ask) return finish(src, { outcome: 'asked', ask: r.ask });
    if (!r.ok) return finish(src, { outcome: 'failed_checker' });
    proposed = r.program;
  } else o.raw = proposed;
  // data rules (entry.mjs evaluate)
  let prep, ev;
  try { prep = prepareEdit(app.source, proposed); ev = evolve(app.ever, prep.source); } catch (e) { return finish(src, { outcome: 'evaluate_threw', err: String(e).slice(0, 120) }); }
  o.verdict = ev.verdict; o.warnings = (ev.warnings || []).slice(0, 3); o.refused = (ev.refused || []).slice(0, 3);
  if (ev.verdict === 'refused') return finish(src, { outcome: 'refused_data' });
  const gone = R.removedLines(src, proposed), total = R.programLines(src).length;
  if (!direct && total > 0 && gone.length > total * 0.2 && !R.kRemovalWords.test(request)) return finish(src, { outcome: 'blocked_20pct', gone: gone.length, total });
  if (!direct && R.programLines(proposed).join('\n') === R.programLines(src).join('\n')) return finish(src, { outcome: 'noop_unchanged' });
  const extra = direct ? [] : R.dropsUnasked(request, src, proposed);
  if (extra.length) { o.unasked_drops = extra.slice(0, 6); return finish(src, { outcome: 'blocked_unasked_drop' }); }
  const rr = app.applyEdit(prep.source);
  if (rr.verdict === 'refused') return finish(src, { outcome: 'refused_apply' });
  return finish(app.source, { outcome: ev.verdict === 'warn' || (ev.warnings || []).length ? 'applied_after_warning' : 'applied' });
}

async function runChain(c, createdByLabel) {
  let P0;
  if (c.seed.long_file) P0 = readFileSync(H + c.seed.long_file, 'utf8');
  else { const s = createdByLabel.get(c.seed.from_create); if (!s || !s.ok) return { id: c.id, type: 'chain', label, seed_failed: true, seed: c.seed }; P0 = s.program; }
  let app; try { app = load(P0, { now: NOW, currency: 'Rs', tz: 'UTC' }); } catch (e) { return { id: c.id, type: 'chain', label, seed_failed: true, seed: c.seed, why: 'load threw' }; }
  if (!app.ok) return { id: c.id, type: 'chain', label, seed_failed: true, seed: c.seed, why: 'load failed' };
  const rec = { id: c.id, type: 'chain', label, long: !!c.long, seed: c.seed, start: P0, steps: [] };
  const versions = [app.source];   // sources after every applied change (for "undo that")
  for (const st0 of c.steps) {
    const before = app.source;
    const st = P.resolveStep(st0, before);
    if (st.na) { rec.steps.push({ k: st.k, request: st.request, na: st.na }); continue; }
    if (st.k === 'undo') { if (versions.length < 2) { rec.steps.push({ k: 'undo', request: st.request, na: 'nothing to undo yet' }); continue; } st.target = versions[versions.length - 2]; }
    let o; try { o = await appEdit(app, st.request); } catch (e) { o = { request: st.request, outcome: 'harness_error', err: String(e && e.stack || e).slice(0, 300), program: before, raw: before }; }
    const after = app.source;
    const applied = after !== before;
    if (applied) versions.push(after);
    const d = P.diffStats(before, o.raw || before);
    rec.steps.push({ k: st.k, request: st.request, args: { color: st.color, to: st.to, word: st.word, what: st.what, a: st.a, b: st.b, n: st.n, old: st.old }, route: o.route, intercepted_newapp: !!o.intercepted_newapp, outcome: o.outcome, applied,
      did_final: P.did(st, before, after), did_raw: o.raw ? P.did(st, before, o.raw) : null, diff_raw: d, diff_final: P.diffStats(before, after), verdict: o.verdict, warnings: o.warnings, refused: o.refused, unasked_drops: o.unasked_drops, gone: o.gone,
      gen: o.gen, tokens: o.tokens, seconds: o.seconds, tok_s: o.tok_s, draft: o.draft, resamples: o.resamples, rep: o.raw ? P.repeats(o.raw) : null, raw: o.raw, before: before.length < 6000 ? undefined : undefined });
    rec.steps[rec.steps.length - 1].after = after;
  }
  rec.end = app.source; rec.load_avg = os.loadavg()[0];
  return rec;
}

// single edit steps replayed from a saved program (controls): { type:'edit1', id, before, step }
async function runEdit1(c) {
  if (process.env.FRESH) await core.restart();
  PROMPTS = [];
  const app = load(c.before, { now: NOW, currency: 'Rs', tz: 'UTC' });
  const st = { ...c.step };
  const o = await appEdit(app, st.request);
  const after = app.source;
  const first = PROMPTS[0] || ''; const prompt_ok = first.includes('Edit request: ' + st.request);
  return { id: c.id, type: 'edit1', label, fresh: !!process.env.FRESH, prompt_has_request: prompt_ok, prompt_first_md5: require_md5(first), prompt_tail: first.slice(-120), n_prompts: PROMPTS.length, k: st.k, request: st.request, outcome: o.outcome, applied: after !== c.before, did_final: P.did(st, c.before, after), did_raw: o.raw ? P.did(st, c.before, o.raw) : null, noop: !!(o.raw && P.diffStats(c.before, o.raw).noop), seconds: o.seconds, raw: o.raw };
}
const createdByLabel = new Map();
// creates first (chains reuse the create result of their seed), then chains
const todo = cases.filter(c => c.type === 'create').slice(0, +limit);
for (const c of todo) {
  if (done.has(c.id)) { continue; }
  const t0 = Date.now();
  let rec; try { rec = await runCreate(c); } catch (e) { rec = { id: c.id, type: 'create', label, request: c.request, harness_error: String(e && e.stack || e).slice(0, 400), ok: false }; }
  rec.wall_s = +((Date.now() - t0) / 1000).toFixed(1); rec.load_avg = os.loadavg()[0];
  save(rec); console.log(c.id, rec.ok, rec.wall_s, c.request.slice(0, 50));
}
if (existsSync(out)) for (const l of readFileSync(out, 'utf8').trim().split('\n').filter(Boolean)) { const r = JSON.parse(l); if (r.type === 'create') createdByLabel.set(r.id, r); }
for (const c of cases.filter(c => c.type === 'edit1')) {
  if (done.has(c.id)) continue;
  let rec; try { rec = await runEdit1(c); } catch (e) { rec = { id: c.id, type: 'edit1', label, harness_error: String(e && e.stack || e).slice(0, 300) }; }
  save(rec); console.log(c.id, rec.outcome, rec.did_final);
}
for (const c of cases.filter(c => c.type === 'chain').slice(0, +limit)) {
  if (done.has(c.id)) continue;
  const t0 = Date.now(); let rec;
  try { rec = await runChain(c, createdByLabel); } catch (e) { rec = { id: c.id, type: 'chain', label, harness_error: String(e && e.stack || e).slice(0, 400) }; }
  rec.wall_s = +((Date.now() - t0) / 1000).toFixed(1);
  save(rec); console.log(c.id, rec.seed_failed ? 'SEED-FAILED' : rec.steps.map(s => s.na ? 'na' : (s.did_final ? 'Y' : 'n')).join(''), rec.wall_s);
}
core.close();
