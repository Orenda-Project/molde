// Lockstep fuzz (round 11, the critic's method). Each chain drives one long-lived app through the tree
// (taps, toggles, changes), ticks, Undo and safe edits that insert, remove or reorder lines. After
// every step a fresh app is made from a snapshot (load + tree) and must show the same tree and hold
// the same stored data. Undo must give back exactly the stored data from before the step. One big
// tick must equal many one-second ticks. Trees are frozen, so nobody can change a reused one.
// Usage: node lang/tests/fuzz-lockstep.mjs [chains=1000] [seed=1]
import { readFileSync, readdirSync } from 'node:fs';
import { load } from '../eval.mjs';

globalThis.MOLDE_FREEZE_TREE = true;
const LANG = new URL('..', import.meta.url).pathname;
// programs with buttons, inputs, refs, timers, when and every rules (at least 30)
export function lockstepPrograms() {
  const ex = readdirSync(LANG + 'examples').filter(f => f.endsWith('.mo')).map(f => readFileSync(LANG + 'examples/' + f, 'utf8'));
  const co = readdirSync(LANG + 'corpus').filter(f => f.endsWith('.mo')).sort().map(f => readFileSync(LANG + 'corpus/' + f, 'utf8'));
  const stateful = co.filter(s => /\bevery \d|\bwhen |\bafter \d|ref |timer /.test(s));
  // small programs that put the stateful statements next to each other (when that adds rows, every
  // counters, timers, state per row, links); every other chain uses one of them
  const SYN = [
    'app "W"\ntable log x num\nbutton "b" tap add log x = 1\nwhen count(log) > 0 add log x = 9\n"n" count(log)\n',
    'app "E"\nstate n num = 0\nevery 60s set n = n + 1\n"n" n\nbutton "z" tap set n = 0\n',
    'app "T"\ntimer 2m, "Two"\ntimer 30s, "Short"\n',
    'app "R"\ntable item q text\ntable ans item ref item\nbutton "a" tap add item q = "A"\nbutton "l" tap add ans item = last(item)\neach ans as r\n  r.item.q\n  state open bool = no\n  toggle open\n',
    'app "A"\ntable log x num\nbutton "b" tap add log x = 1 then after 90s add log x = 2\n"n" count(log)\nwhen count(log) > 2 notify "three"\n',
    'app "D"\ntable t n num\nsetting on bool = yes\nevery 1m if on and count(t today) < 3 add t n = 1\n"n" count(t)\nfield on\n',
  ];
  return [...SYN, ...ex, ...stateful.slice(0, 30), ...co.filter((_, i) => i % 15 === 0)].filter(s => load(s).ok);
}

export function runLockstep(chains = 1000, seed = 1, steps = 14) {
  let s = seed;
  const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const ri = n => Math.floor(rnd() * n);
  const progs = lockstepPrograms();
  const stats = { programs: progs.length, chains: 0, steps: 0, taps: 0, changes: 0, ticks: 0, undos: 0, edits: 0, refused: 0, reloadChecks: 0, undoChecks: 0, tickChecks: 0, violations: [] };
  const J = x => JSON.stringify(x);
  const V = (c, st, why, src) => stats.violations.push({ c, st, why, prog: src.split('\n')[0] });
  for (let c = 0; c < chains; c++) {
    stats.chains++;
    const src0 = c % 2 ? progs[c % 6] : progs[c % progs.length];
    let a = load(src0, { now: '2026-11-23T10:00:00Z' });
    let heading = 0; // headings inserted by edits
    for (let st = 0; st < steps; st++) {
      stats.steps++;
      a.tree();
      const before = J(a.data), stepsBefore = a.undoStack.length;
      const op = ri(10);
      try {
        if (op <= 3) { // a tap on a button, a toggle, a chip, or a shape that takes taps
          const ns = a.findAll(n => n.tap); const n = ns[ri(ns.length)];
          if (n) { a.dispatch(n.id, 'tap'); stats.taps++; }
        } else if (op <= 5) { // a change of an input (form fields included) with a value of its kind
          const ins = [...a.findAll(n => n.t === 'input' || n.t === 'choice' || n.t === 'slider'), ...a.findAll(n => n.t === 'form').flatMap(f => f.fields)];
          const n = ins[ri(ins.length)];
          if (n) {
            const v = n.options && n.options.length ? n.options[ri(n.options.length)] : n.t === 'slider' ? (n.min ?? 0) + ri(5) : n.kind === 'num' || n.kind === 'money' ? ri(50) : n.kind === 'dur' ? 60 * ri(30) : n.kind === 'date' ? '2026-11-2' + ri(9) : n.kind === 'time' ? `${ri(24)}:${String(ri(60)).padStart(2, '0')}` : n.kind === 'bool' ? rnd() < 0.5 : 'v' + ri(9);
            a.dispatch(n.id, 'change', v); stats.changes++;
          }
        } else if (op === 6) { a.tick([1000, 60000, 3600000][ri(3)] * (1 + ri(5))); stats.ticks++; }
        else if (op === 7) { a.undo(); stats.undos++; }
        else if (op === 8) { // a safe edit: a line inserted at a random top-level place, or removed, or two text lines swapped
          const lines = a.source.split('\n');
          const top = lines.map((l, i) => i).filter(i => i > 0 && lines[i] && !lines[i].startsWith(' ') && !/^(table|setting|state|let|def)\b/.test(lines[i]));
          let next = null;
          if (heading && rnd() < 0.4) { const i = lines.findIndex(l => /^"Heading \d+"$/.test(l)); if (i > 0) { lines.splice(i, 1); heading--; next = lines.join('\n'); } }
          else if (top.length && rnd() < 0.7) { const at = top[ri(top.length)]; lines.splice(at, 0, `"Heading ${heading++}"`); next = lines.join('\n'); }
          else { const t = top.filter(i => /^"/.test(lines[i]) && top.includes(i + 1) && /^"/.test(lines[i + 1])); if (t.length) { const i = t[ri(t.length)]; [lines[i], lines[i + 1]] = [lines[i + 1], lines[i]]; next = lines.join('\n'); } }
          if (next) {
            // a twin that gets no edit: after the same time passes, both hold the same data (an unrelated
            // line never re-fires a when, resets a schedule or a timer, or loses block state)
            const twin = load(a.source, { data: a.snapshot(), now: a.clock });
            twin.tree();
            const r = a.applyEdit(next); stats.edits++;
            if (r.verdict === 'refused') stats.refused++;
            else if (!(a.pending || []).length) { // an `after` waits only while the app is open (SPEC), so a fresh twin has none
              const T = [0, 1000, 61000, 3600000][ri(4)];
              a.tree(); a.tick(T); twin.tick(T); a.tree(); twin.tree();
              stats.twinChecks = (stats.twinChecks || 0) + 1;
              if (J(a.data) !== J(twin.data)) V(c, st, `an edit that only moved or added a line changed the data (after ${T} ms)`, a.source);
            }
          }
        } else { // one big tick equals many one-second ticks (from the same saved state)
          const snap = a.snapshot(), T = 1000 * (1 + ri(300));
          const x = load(a.source, { data: snap, now: a.clock }), y = load(a.source, { data: snap, now: a.clock });
          x.tick(T); for (let k = 0; k < T / 1000; k++) y.tick(1000);
          stats.tickChecks++;
          if (J(x.tree()) !== J(y.tree()) || J(x.data) !== J(y.data)) V(c, st, `one ${T / 1000} s tick differs from ${T / 1000} one-second ticks`, a.source);
        }
      } catch (e) { V(c, st, 'threw: ' + e.message, a.source); break; }
      // Undo gives back exactly the data from before a step (checked on a copy, the chain goes on)
      if (a.undoStack.length > stepsBefore && rnd() < 0.5) {
        const u = load(a.source, { data: a.snapshot(), now: a.clock });
        a.undo(); a.tree(); stats.undoChecks++;
        if (J(a.data) !== before) V(c, st, `undo of step ${op} did not give back the data from before it`, a.source);
        a = u; // continue from the state after the step
      }
      // lockstep: a fresh app from a snapshot shows the same tree and holds the same data
      const t1 = J(a.tree()), d1 = J(a.data);
      const b = load(a.source, { data: a.snapshot(), now: a.clock });
      stats.reloadChecks++;
      if (!b.ok) { V(c, st, 'a snapshot does not load: ' + b.errors[0], a.source); break; }
      if (J(b.tree()) !== t1) { V(c, st, `after step ${op} a fresh load shows a different tree`, a.source); break; }
      if (J(b.data) !== d1) { V(c, st, `after step ${op} a fresh load holds different data`, a.source); break; }
    }
  }
  return stats;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const t0 = Date.now();
  const r = runLockstep(+(process.argv[2] || 1000), +(process.argv[3] || 1));
  console.log(JSON.stringify({ ...r, violations: r.violations.length, firstViolations: r.violations.slice(0, 5), ms: Date.now() - t0 }));
  process.exit(r.violations.length ? 1 : 0);
}
