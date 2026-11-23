// UI fuzz (round 9): the app is driven only through tree() and dispatch(), plus chat edits,
// ticks and reloads. Oracles:
// - Undo: undo() restores exactly the stored data from before the last undo group (consecutive
//   changes to one input are one group; any other operation, undo included, ends a group).
// - Form drafts: what the person typed into the form is still shown after any safe edit (a rename,
//   a new field with a default, a dropped field, text widened to long), unless that field was dropped;
//   a new field shows its default.
// - Garbage: a change of any JS type that is not a value of the input's kind changes no stored data.
// - when: a condition that was already true does not notify again after a reload.
// - Ticks: rows written by `every` are their own undo steps.
// Usage: node lang/tests/fuzz-ui.mjs [chains=1000] [seed=3]
import { load } from '../eval.mjs';

export function runUiFuzz(chains = 1000, seed = 3, steps = 16) {
  let s = seed;
  const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const ri = n => Math.floor(rnd() * n);
  const stats = { chains: 0, steps: 0, changes: 0, taps: 0, undos: 0, edits: 0, refused: 0, ticks: 0, reloads: 0, garbage: 0, draftChecks: 0, whenChecks: 0, violations: [] };
  const GARBAGE = { num: [NaN, Infinity, {}, [], true, '  ', '1e999', 'abc', { o: '#x' }], text: [{}, [], true, { o: '#x' }], pick: [{}, [], true, 'Nope', { o: '#Home' }] };
  for (let c = 0; c < chains; c++) {
    stats.chains++;
    // the form's table: fields by slot (slot = first name), name moves
    let F = [{ slot: 't', name: 't', type: 'text', req: true }, { slot: 'n', name: 'n', type: 'num' }, { slot: 'w', name: 'w', type: 'text' }];
    let fresh = 0;
    const decl = (F, ren = {}) => F.map(f => `${f.name} ${f.type === 'pick' ? 'pick Home|Work' : f.type}${f.req || f.dflt !== undefined ? '' : '?'}${f.dflt !== undefined ? ' = ' + f.dflt : ''}${ren[f.slot] ? ' was ' + ren[f.slot] : ''}`).join(', ');
    const prog = (F, ren) => [
      'app "U"', `table s ${decl(F, ren)}`, 'table log x num', 'setting g num = 1', 'state q text = ""',
      'form s', 'field g', 'field q', '"rows" count(s)', '"logs" count(log)', '"g" g',
      'button "plus" tap add log x = 1', 'every 60s if g > 5 add log x = 2', 'when count(log) > 2 notify "many"',
      'each s', '  field it.t',
    ].join('\n') + '\n';
    let app = load(prog(F));
    const typed = {}; // slot -> what the person typed into the form (as shown)
    let stack = [], lastChange = null;
    const V = (st, why) => stats.violations.push({ c, st, why });
    const data = () => JSON.stringify(app.data);
    const push = d => { stack.push(d); if (stack.length > 50) stack.shift(); };
    let group = null; // the input whose change group is on top of the Undo stack
    // a change: consecutive changes to one input join its step (back to the start undoes the step);
    // any other change that alters data is a new step; a change that alters nothing records none
    const change = (n, v) => {
      const before = data(), joining = lastChange === n.id && group === n.id;
      app.dispatch(n.id, 'change', v);
      const after = data();
      if (joining) { if (after === stack[stack.length - 1]) { stack.pop(); group = null; } }
      else if (after !== before) { push(before); group = n.id; }
      else group = null;
      lastChange = n.id;
    };
    const other = fn => { const before = data(); fn(); if (data() !== before) push(before); group = null; lastChange = null; };
    const form = () => app.find(n => n.t === 'form');
    for (let st = 0; st < steps; st++) {
      stats.steps++;
      const op = ri(12);
      const tree = app.tree();
      if (op <= 3) { // a change on an input (form field, setting, text state, row field), sometimes the same one again
        const inputs = app.findAll(n => n.t === 'input' || (n.t === 'form' && false));
        const fm = form(); const all = [...inputs, ...(fm ? fm.fields : [])];
        let n = lastChange && rnd() < 0.5 ? all.find(x => x.id === lastChange) : null;
        n = n || all[ri(all.length)];
        if (!n) continue;
        const v = n.kind === 'num' ? (rnd() < 0.2 ? '' : 1 + ri(9)) : n.kind === 'pick' ? ['Home', 'Work'][ri(2)] : (rnd() < 0.2 ? '' : 'v' + ri(5));
        change(n, v); stats.changes++;
        if (fm && fm.fields.includes(n)) { const f = F.find(x => x.name === n.name); if (f) typed[f.slot] = form().fields.find(x => x.name === n.name).value; }
      } else if (op === 4) { // a tap
        const b = app.find(x => x.t === 'button' && (x.text === 'plus' || x.text === 'Add'));
        if (!b) continue;
        other(() => app.dispatch(b.id, 'tap')); stats.taps++;
        if (b.text === 'Add' && app.rows('s').length > 0) { const fm = form(); if (fm && !fm.error) for (const k of Object.keys(typed)) delete typed[k]; }
      } else if (op === 5) { // garbage of every JS type into one input
        const fm = form(); const all = [...app.findAll(n => n.t === 'input'), ...(fm ? fm.fields : [])];
        const n = all[ri(all.length)]; if (!n) continue;
        const list = GARBAGE[n.kind === 'long' ? 'text' : n.kind] || GARBAGE.num, g = list[ri(list.length)];
        {
          const before = data();
          change(n, g); stats.garbage++;
          if (data() !== before && !(n.kind === 'text' || n.kind === 'long') ) V(st, `garbage ${JSON.stringify(String(g))} into ${n.kind} input ${n.id} changed stored data`);
          if (data() !== before && (n.kind === 'text' || n.kind === 'long') && typeof g !== 'string' && typeof g !== 'number') V(st, `garbage of type ${typeof g} into a text input changed stored data`);
          if (data() !== before && (n.kind === 'text' || n.kind === 'long')) { const f = F.find(x => x.name === n.name); if (fm && f && fm.fields.includes(n)) typed[f.slot] = form().fields.find(x => x.name === n.name)?.value; }
        }
      } else if (op === 6) { // undo: exactly the data from before the last group
        stats.undos++;
        const want = stack.pop();
        const ok = app.undo();
        lastChange = null; group = null;
        if (!want) { if (ok) V(st, 'undo with no step did something'); continue; }
        if (!ok) { V(st, 'undo refused while a step exists'); continue; }
        const w = JSON.parse(want), got = app.data;
        if (JSON.stringify(got.tables) !== JSON.stringify(w.tables)) V(st, 'undo did not restore the rows');
        for (const k of Object.keys(w.settings)) if (JSON.stringify(got.settings[k]) !== JSON.stringify(w.settings[k])) V(st, `undo did not restore setting ${k}`);
        // a form draft is compared field by field: undo restores its values, then it is reconciled with the
        // current form (fields added by an edit since get their default), so compare the shared fields
        for (const k of Object.keys(w.state)) {
          const x = got.state[k], y = w.state[k];
          if (y && typeof y === 'object' && '_t' in y) { for (const f of Object.keys(y)) if (f !== '_missing' && f in x && JSON.stringify(x[f]) !== JSON.stringify(y[f])) V(st, `undo did not restore draft ${k}.${f}`); }
          else if (JSON.stringify(x) !== JSON.stringify(y)) V(st, `undo did not restore state ${k}`);
        }
        // what the form shows is what was in the restored draft
        const fm = form(); if (fm) for (const f of F) { const fd = fm.fields.find(x => x.name === f.name); if (fd) { if (fd.value === null || fd.value === undefined) delete typed[f.slot]; else typed[f.slot] = fd.value; } }
      } else if (op === 7) { // tick one minute: an every write is its own step
        stats.ticks++;
        other(() => app.tick(60000)); // a tick is one step
      } else if (op <= 9) { // a safe edit of the form's table
        const N = F.map(f => ({ ...f })), ren = {};
        const k = ri(4);
        if (k === 0) { const f = N[1 + ri(N.length - 1)]; ren[f.slot] = f.name; f.name = 'f' + (fresh++); }
        else if (k === 1) { const sl = 'p' + (fresh++); N.push(rnd() < 0.5 ? { slot: sl, name: sl, type: 'pick', dflt: 'Home' } : { slot: sl, name: sl, type: 'num', dflt: 3 }); }
        else if (k === 2 && N.length > 2) { const i = 1 + ri(N.length - 1); N.splice(i, 1); }
        else { const f = N.find(x => x.type === 'text' && !x.req); if (f) f.type = 'long'; else continue; }
        const r = app.applyEdit(prog(N, ren)); stats.edits++; lastChange = null; group = null;
        if (r.verdict === 'refused') { stats.refused++; if (process.env.UIDEBUG) console.error(r.refused[0]); continue; }
        const dropped = F.filter(f => !N.some(x => x.slot === f.slot)).map(f => f.slot);
        for (const sl of dropped) delete typed[sl];
        F = N;
        // the draft follows: what was typed is still there under the field's current name; new fields show their default
        stats.draftChecks++;
        const fm = form();
        for (const f of F) {
          const fd = fm && fm.fields.find(x => x.name === f.name);
          if (!fd) { V(st, `form has no field ${f.name}`); continue; }
          if (typed[f.slot] !== undefined && JSON.stringify(fd.value) !== JSON.stringify(typed[f.slot])) V(st, `form field ${f.name} shows ${JSON.stringify(fd.value)} but ${JSON.stringify(typed[f.slot])} was typed`);
          if (typed[f.slot] === undefined && f.dflt !== undefined && k === 1 && f === F[F.length - 1] && JSON.stringify(fd.value) !== JSON.stringify(f.dflt)) V(st, `new field ${f.name} shows ${JSON.stringify(fd.value)}, not its default ${f.dflt}`);
        }
      } else if (op === 10) { // reload: a condition already true does not notify again
        stats.reloads++;
        const was = app.find(x => x.text === 'logs')?.text;
        const condTrue = app.rows('log').length > 2;
        app = load(app.source, { data: app.snapshot() });
        stack = []; lastChange = null; group = null; // data Undo does not survive a restart
        app.tick(1);
        stats.whenChecks++;
        if (condTrue && app.log.some(e => e.kind === 'notify')) V(st, 'a when that was already true notified again after a reload');
        void was;
      } else { // set g so the every runs or stops (through the setting's input)
        const n = app.find(x => x.t === 'input' && x.label === 'g');
        if (!n) continue;
        change(n, rnd() < 0.5 ? 9 : 1); stats.changes++;
      }
      if (process.env.UICHAIN == c) console.error(st, op, 'model', stack.length, 'app', app.undoStack.length);
      void tree;
    }
  }
  return stats;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const t0 = Date.now();
  const r = runUiFuzz(+(process.argv[2] || 1000), +(process.argv[3] || 3));
  console.log(JSON.stringify({ ...r, violations: r.violations.length, firstViolations: r.violations.slice(0, 4), ms: Date.now() - t0 }));
  process.exit(r.violations.length ? 1 : 0);
}
