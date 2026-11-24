// Page logic inside the Android WebView: the evaluator and renderer for the app on screen, plus the
// generation loop. Flutter talks to it with Molde.rpc(id, method, args); events go back through the
// `MoldeHost` JavaScript channel.
import { load } from '../vendor/lang/eval.mjs';
import { mount } from '../vendor/render/render.mjs';
import { evolve } from '../vendor/lang/diff.mjs';
import { describe } from '../vendor/lang/describe.mjs';
import { check } from '../vendor/lang/check.mjs';
import { format } from '../vendor/lang/format.mjs';
import { generate, DEFAULT_SYSTEM } from './decode_loop.mjs';

const RUNTIME = { currency: 'Rs', locale: 'en-US', tz: 'local' };
const INSET = 88;                       // strip at the bottom that the host's chat button uses
const S = { app: null, renderer: null, id: null, mode: 'light', lastKey: '', timer: null, flushTimer: null, cancel: false, pending: new Map(), seq: 0 };
const root = () => document.getElementById('root');
const post = o => { try { window.MoldeHost.postMessage(JSON.stringify(o)); } catch (e) { /* page opened outside the app (tests) */ } };
const log = m => post({ t: 'log', msg: String(m) });

// ---- native model calls (Dart answers with Molde.nativeReply) ----
function native(method, args) {
  return new Promise(res => { const id = ++S.seq; S.pending.set(id, res); post({ t: 'native', id, method, args }); });
}

// ---- the app on screen ----
function stop() {
  clearInterval(S.timer); clearInterval(S.flushTimer); S.timer = S.flushTimer = null;
  if (S.renderer) { try { S.renderer.destroy(); } catch (e) { /* already gone */ } }
  S.renderer = null;
}
function mountApp() {
  if (S.renderer) { try { S.renderer.destroy(); } catch (e) { /* ok */ } }
  S.renderer = mount(root(), S.app, { mode: S.mode, insetBottom: INSET, currency: RUNTIME.currency, locale: RUNTIME.locale, autoTick: false, onChange: () => snapshot(false), onAsk: a => post({ t: 'ask', answer: a }) });
}
// the host's clock: the evaluator moves with real time, also after a long pause in the background
function tickClock() {
  const a = S.app; if (!a || !S.renderer) return;
  const d = Date.now() - a.clock;
  if (d >= 900) { a.tick(d); S.renderer.afterChange(false); }
}
function keyOf(p) { const { clock, ...rest } = p.snapshot; return JSON.stringify([p.source, rest, p.undo]); }
function snapshot(force) {
  const a = S.app; if (!a || !a.ok) return;
  const payload = { id: S.id, source: a.source, snapshot: a.snapshot(), undo: (a.versionsUndo || []).slice(-30) };
  const key = keyOf(payload);
  if (!force && key === S.lastKey) return;
  S.lastKey = key;
  post({ t: 'snapshot', payload });
}
function nameOf(a) { const h = a.prog && a.prog.header; return h && h.name ? h.name : 'App'; }

const methods = {
  ping: () => ({ ok: true }),
  async open({ id, source, snapshot: snap, undo, nowMs, mode, theme }) {
    stop();
    S.id = id; S.mode = mode || S.mode;
    const opts = { now: nowMs || Date.now(), currency: RUNTIME.currency, tz: RUNTIME.tz };
    if (snap) opts.data = snap;
    const a = load(source, opts);
    if (!a.ok) return { ok: false, errors: (a.errors || []).map(String) };
    a.versionsUndo = Array.isArray(undo) ? undo.slice() : [];
    S.app = a; S.lastKey = '';
    mountApp();
    S.timer = setInterval(tickClock, 1000);
    S.flushTimer = setInterval(() => snapshot(false), 3000);
    snapshot(true);
    return { ok: true, name: nameOf(a), warnings: a.edit && a.edit.warnings ? a.edit.warnings : [] };
  },
  close() { stop(); S.app = null; root().textContent = ''; return { ok: true }; },
  setMode({ mode }) { S.mode = mode; if (S.renderer) S.renderer.setMode(mode); return { ok: true }; },
  resume({ nowMs }) { tickClock(); return { ok: true }; },
  flush() { snapshot(true); return { ok: true }; },
  // what a program would do as an edit of the running app, without applying it
  evaluate({ source }) {
    if (!S.app) return { verdict: 'refused', refused: ['no app is open'], changes: [], warnings: [] };
    const c = check(source);
    if (!c.ok) return { verdict: 'refused', refused: c.errors.map(String), changes: [], warnings: [] };
    const r = evolve(S.app.ever, source);
    const ui = uiChanges(S.app.source, source);
    return { verdict: r.verdict, warnings: r.warnings || [], changes: [...(r.changes || []), ...ui], refused: r.refused || [], notes: r.notes || [] };
  },
  applyEdit({ source }) {
    const r = S.app.applyEdit(source);
    if (r.verdict !== 'refused') { mountApp(); snapshot(true); }
    return { verdict: r.verdict, warnings: r.warnings || [], changes: r.changes || [], refused: r.refused || [], name: nameOf(S.app), canUndo: (S.app.versionsUndo || []).length };
  },
  undoEdit() {
    const r = S.app.revert();
    if (r.verdict !== 'none') { mountApp(); snapshot(true); }
    return { verdict: r.verdict, changes: r.changes || [], warnings: r.warnings || [], name: nameOf(S.app), canUndo: (S.app.versionsUndo || []).length };
  },
  canUndo: () => ({ n: S.app ? (S.app.versionsUndo || []).length : 0 }),
  describe({ source }) { try { return { text: describe(source) }; } catch (e) { return { text: '' }; } },
  check({ source }) { const c = check(source); return { ok: c.ok, errors: c.errors.map(String) }; },
  format({ source }) { try { return { text: format(source) }; } catch (e) { return { text: source }; } },
  async generate({ kind, request, current, system, arm, deadlineMs }) {
    S.cancel = false;
    const r = await generate({
      kind, request, current, system: system || DEFAULT_SYSTEM, arm: arm || 'E', deadlineMs,
      complete: req => native('complete', req),
      cancelled: () => S.cancel,
      onProgress: p => post({ t: 'progress', lines: p.lines, program: p.program, rejected: p.rejected }),
    });
    return r;
  },
  cancel() { S.cancel = true; native('cancel', {}); return { ok: true }; },
  version() { return { versions: window.MOLDE_VERSIONS || '' }; },
  // a debug hook for tests: the number of nodes the renderer drew
  state() { return { open: !!S.app, id: S.id, name: S.app ? nameOf(S.app) : null }; },
};

// edits to what is drawn (not tables or settings, which the data diff already names), as plain lines
function uiChanges(oldSrc, newSrc) {
  const lines = s => format(s).split('\n').filter(l => l.trim() && !/^(table|setting)\b/.test(l.trim()));
  const count = xs => xs.reduce((m, x) => m.set(x, (m.get(x) || 0) + 1), new Map());
  let a, b;
  try { a = count(lines(oldSrc)); b = count(lines(newSrc)); } catch (e) { return []; }
  const out = [];
  for (const [l, n] of b) for (let i = a.get(l) || 0; i < n; i++) out.push(`adds: ${l.trim()}`);
  for (const [l, n] of a) for (let i = b.get(l) || 0; i < n; i++) out.push(`removes from the screen: ${l.trim()}`);
  return out.slice(0, 40);
}

window.Molde = {
  // Flutter -> page: one call, one reply event
  rpc(id, method, args) {
    Promise.resolve().then(() => { const f = methods[method]; if (!f) throw new Error('unknown method ' + method); return f(args || {}); })
      .then(v => post({ t: 'reply', id, ok: true, value: v }), e => post({ t: 'reply', id, ok: false, error: String(e && e.stack || e) }));
  },
  nativeReply(id, json) { const r = S.pending.get(id); if (r) { S.pending.delete(id); let v; try { v = JSON.parse(json); } catch (e) { v = { stop: 'error', text: '', error: 'bad reply from the model' }; } r(v); } },
};
window.addEventListener('error', e => log('page error: ' + (e.message || e)));
window.addEventListener('unhandledrejection', e => log('page rejection: ' + (e.reason && e.reason.message || e.reason)));
post({ t: 'ready' });
