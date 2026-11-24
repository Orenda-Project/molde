#!/usr/bin/env node
// Layers a-c for ONE program: valid (checker), runs (load + tree, no error nodes / undefined / NaN), works (generic driver).
//   node drive.mjs PROGRAM_FILE OUT_JSON   (writes {valid, runs, works, ..., snap_shot} ; snap_shot = data to render for the screenshot)
// The driver knows nothing about the app: it only reads tree() and calls dispatch().
//  phase 1 (on every screen): fill every input of every form and every free input with a plausible typed value, tap every
//          save button; twice, with different values (so ref fields can point at rows added in the first pass).
//  phase 2 (on every screen): tap every tappable node once (buttons, tappable text, drawings, shapes, toggles), set every
//          choice to another option, move every slider; then tick the clock 61 s (timers, every, when).
//  checks: no exception, no error node / log error, no 'undefined' / 'NaN' text; rows stored; the visible content (everything
//          except input widgets) changed; reload from snapshot gives the same tree.
import { readFileSync, writeFileSync } from 'node:fs';
import { check } from '../lang/check.mjs';
import { load } from '../lang/eval.mjs';

const [file, outFile] = process.argv.slice(2);
const src = readFileSync(file, 'utf8');
const NOW = '2026-11-26T10:30:00Z';
const res = { valid: false, runs: false, works: false, notes: [] };
const out = () => { writeFileSync(outFile, JSON.stringify(res)); process.exit(0); };

const c = check(src);
res.valid = !!c.ok;
res.first_error = c.ok ? null : String(c.errors[0]);
res.err_code = c.ok ? null : ((String(c.errors[0]).match(/E_[A-Z_]+/) || ['E_PARSE'])[0]);
res.lines = src.trim().split('\n').length;
res.is_ask = /^ask /.test(src.trim()) && src.trim().split('\n').length === 1;
if (!res.valid) out();

function walk(n, f, inForm = false) { if (!n || typeof n !== 'object') return; f(n, inForm); const kids = n.t === 'form' ? n.fields : n.children; if (Array.isArray(kids)) for (const k of kids) walk(k, f, inForm || n.t === 'form'); }
function badText(tree) {
  const bad = [];
  walk(tree, n => {
    if (n.t === 'error') bad.push('error node: ' + (n.text || '').slice(0, 100));
    for (const k of ['text', 'label', 'a11y']) if (typeof n[k] === 'string' && /\bundefined\b|\bNaN\b|Infinity/.test(n[k])) bad.push(`${k}: ${n[k].slice(0, 80)}`);
  });
  return bad;
}
// what the user sees, minus input widgets (their own echo would count as a change)
function visible(tree) {
  const parts = [];
  walk(tree, (n, inForm) => {
    if (inForm || n.t === 'input' || n.t === 'form') return;
    const { id, children, fields, ...rest } = n;
    if (n.t === 'toggle' || n.t === 'choice' || n.t === 'slider') { parts.push(n.t + ':' + JSON.stringify(n.on ?? n.value)); return; }
    parts.push(JSON.stringify(rest));
  });
  return parts.join('\n');
}
const rowsOf = app => { const t = app.snapshot().data.tables; let n = 0; for (const k in t) n += t[k].length; return n; };
const tablesOf = app => Object.keys(app.snapshot().data.tables).length;

function valueFor(inp, pass) {
  const lo = inp.min ?? null, hi = inp.max ?? null;
  switch (inp.kind) {
    case 'text': return `${pass ? 'Second' : 'Sample'} ${String(inp.label || 'item').slice(0, 20)}`;
    case 'long': return pass ? 'Another longer note' : 'A short note for testing';
    case 'num': case 'money': {
      const a = lo ?? 0, b = hi ?? (a + (inp.kind === 'money' ? 1000 : 20));
      let v = a + (b - a) * (pass ? 0.5 : 0.25); v = b - a > 4 ? Math.round(v) : Math.round(v * 10) / 10; if (v === a && b > a) v = Math.min(b, a + 1);
      return v;
    }
    case 'bool': return pass ? false : true;
    case 'date': return pass ? '2026-11-28' : '2026-11-26';
    case 'time': return pass ? '18:15' : '09:30';
    case 'when': return pass ? '2026-11-26T08:00:00.000Z' : '2026-11-26T10:00:00.000Z';
    case 'dur': return pass ? 2700 : 1500;
    case 'pick': return inp.options && inp.options.length ? inp.options[pass % inp.options.length] : undefined;
    case 'ref': return inp.options && inp.options.length ? inp.options[0] : undefined;
    default: return undefined; // image
  }
}
const screensOf = app => (app.tree().screens || []).map(s => s.id);
function onScreens(app, f) { const sc = screensOf(app); if (!sc.length) return f(); for (const s of sc) { try { app.dispatch(s, 'tap'); } catch (e) { res.notes.push('screen tap: ' + e.message); } f(); } }
const errs = [];
const guard = (what, fn) => { try { return fn(); } catch (e) { errs.push(`${what}: ${String(e.message || e).slice(0, 160)}`); } };

let app;
try { app = load(src, { now: NOW, seed: 1 }); } catch (e) { res.load_error = String(e.message || e).slice(0, 200); out(); }
let t0;
try { t0 = app.tree(); } catch (e) { res.load_error = 'tree: ' + String(e.message || e).slice(0, 200); out(); }
const bad0 = badText(t0);
res.runs = bad0.length === 0 && !app.log.some(l => l.kind === 'error');
res.run_problems = bad0.slice(0, 5);
res.screens = (t0.screens || []).length;
res.tables = tablesOf(app);
const vis0 = (() => { let v = ''; onScreens(app, () => { v += visible(app.tree()); }); return v; })();
let nForms = 0, nInputs = 0, nSaves = 0, saveOk = 0;
// phase 1
for (const pass of [0, 1]) onScreens(app, () => guard('phase1', () => {
  const tr = app.tree();
  const inputs = []; const saves = [];
  walk(tr, (n) => { if (n.t === 'input') inputs.push(n); if (n.t === 'form') nForms += pass === 0 ? 1 : 0; if (n.t === 'button' && n.action === 'save') saves.push(n.id); });
  for (const inp of inputs) { const v = valueFor(inp, pass); if (v === undefined) continue; nInputs++; guard('change ' + inp.kind, () => app.dispatch(inp.id, 'change', v)); }
  for (const s of saves) { nSaves++; const r0 = rowsOf(app); guard('save', () => app.dispatch(s, 'tap')); if (rowsOf(app) > r0) saveOk++; }
}));
res.forms = nForms; res.inputs_filled = nInputs; res.save_taps = nSaves; res.save_added = saveOk;
res.rows_after_forms = rowsOf(app);
const snapForms = app.snapshot();
const vis1 = (() => { let v = ''; onScreens(app, () => { v += visible(app.tree()); }); return v; })();
// phase 2
let taps = 0, tapOk = 0;
let midChanged = false;
onScreens(app, () => guard('phase2', () => {
  const visNow0 = visible(app.tree());
  const ids = []; const ch = []; const sl = [];
  walk(app.tree(), n => { if (n.tap && n.t !== 'app' && n.t !== 'more') ids.push(n.id); if (n.t === 'choice') ch.push(n); if (n.t === 'slider') sl.push(n); });
  const scr = new Set(screensOf(app));
  for (const id of ids) {
    if (scr.has(id)) continue;
    let live = false; walk(app.tree(), n => { if (n.id === id && n.tap) live = true; });
    if (!live) continue; // the node went away after an earlier tap (rows removed, screen changed)
    taps++; const r = guard('tap', () => app.dispatch(id, 'tap')); if (r) tapOk++;
    guard('tick1', () => app.tick(1000));
    if (!midChanged && visible(app.tree()) !== visNow0) midChanged = true;
  }
  for (const n of ch) { const o = (n.options || []).find(x => x !== n.value); if (o !== undefined) guard('choice', () => app.dispatch(n.id, 'change', o)); }
  for (const n of sl) guard('slider', () => app.dispatch(n.id, 'change', Math.round(((n.min ?? 0) + (n.max ?? 10)) / 2)));
}));
guard('tick', () => app.tick(61000));
// timer pass: the std timer starts with a Start button; start each one and let an hour pass so its end action runs
onScreens(app, () => guard('timers', () => {
  const st = []; walk(app.tree(), n => { if (n.t === 'button' && /^(start|begin|play)\b/i.test(n.text || '')) st.push(n.id); });
  for (const id of st) { guard('start', () => app.dispatch(id, 'tap')); guard('tick60', () => app.tick(60 * 60000)); }
}));
res.taps = taps; res.taps_taken = tapOk;
res.rows_final = rowsOf(app);
const vis2 = (() => { let v = ''; onScreens(app, () => { v += visible(app.tree()); }); return v; })();
const badEnd = (() => { let b = []; onScreens(app, () => { b = b.concat(badText(app.tree())); }); return b; })();
const logAll = app.log.filter(l => l.kind === 'error').map(l => String(l.text).slice(0, 120));
// the evaluator logs refusals as kind 'error': a save missing a required field, a value outside a field. They are the app
// working as written (validation), not crashes; counted separately. 'no tap on' cannot happen (live ids only).
const logErr = logAll.filter(t => !/ needs |not a value of this field/.test(t));
res.refusals = logAll.length - logErr.length;
res.driver_errors = errs.slice(0, 6); res.end_problems = badEnd.slice(0, 5); res.log_errors = logErr.slice(0, 5);
res.changed_forms = vis1 !== vis0; res.changed_any = vis2 !== vis0 || vis1 !== vis0 || midChanged;
res.stored = res.rows_final > 0 || res.rows_after_forms > 0;
// reload: snapshot -> fresh load -> same tree (on the first screen)
guard('reload', () => {
  const sc = screensOf(app); if (sc.length) app.dispatch(sc[0], 'tap');
  const snap = app.snapshot();
  const b = load(src, { now: snap.clock, seed: 1, data: snap });
  const sc2 = screensOf(b); if (sc2.length) b.dispatch(sc2[0], 'tap');
  res.reload_same = JSON.stringify(app.tree()) === JSON.stringify(b.tree());
  res.reload_visible_same = visible(app.tree()) === visible(b.tree()); // inputs excluded: the evaluator drops custom field labels on restore (reported bug)
});
res.clean = errs.length === 0 && badEnd.length === 0 && logErr.length === 0;
res.interactive = nInputs + taps > 0;
res.works = res.runs && res.clean && !!res.reload_visible_same && (res.tables > 0 ? res.stored && res.changed_any : res.changed_any);
res.add_and_see = res.tables > 0 && res.stored && res.changed_any;
// data for the screenshot: after the forms when they added rows, else the final state
res.snap_shot = res.rows_after_forms > 0 ? snapForms : app.snapshot();
out();
