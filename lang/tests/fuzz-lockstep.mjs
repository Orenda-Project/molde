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
  const ex = readdirSync(LANG + 'examples').filter(f => f.endsWith('.mo')).map(f => readFileSync(LANG + 'examples/' + f, 'utf8'))
    .concat(readdirSync(LANG + 'examples/demo15').filter(f => f.endsWith('.mo')).sort().map(f => readFileSync(LANG + 'examples/demo15/' + f, 'utf8')));
  const co = readdirSync(LANG + 'corpus').filter(f => f.endsWith('.mo')).sort().map(f => readFileSync(LANG + 'corpus/' + f, 'utf8'));
  const stateful = co.filter(s => /\bevery \d|\bwhen |\bafter \d|ref |timer /.test(s));
  // small programs that put the stateful statements next to each other (when that adds rows, every
  // counters, timers, state per row, links); every other chain uses one of them
  const SYN = [
    'app "Z"\ntable item n num\ntable log x num\ntimer 2m, "Tea", add log x = 1\ntimer 3m, "Rice", add log x = 2\nform item\nform log\neach item\n  state a num = 0\n  "a" a\n  button "a+" tap set a = a + 1\neach item\n  state b num = 0\n  "b" b\n  button "b+" tap set b = b + 1\nwhen count(log) >= 2 add item n = 9\nbutton "n" tap add item n = 1\n"logs" count(log)\n',
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
    const src0 = c % 3 === 1 ? progs[0] : c % 3 === 2 ? progs[1 + c % 6] : progs[c % progs.length]; // a third of the chains on the program with two timers, two forms, two eaches
    let a = load(src0, { now: '2026-11-23T10:00:00Z' });
    let heading = 0; // headings inserted by edits
    for (let st = 0; st < steps; st++) {
      stats.steps++;
      a.tree();
      const before = J(a.data), stepsBefore = a.undoStack.length;
      const op = ri(10);
      try {
        if (op <= 3) { // a tap on a button, a toggle, a chip, or a shape that takes taps
          const ns = a.findAll(n => n.tap && n.t !== 'more'); const n = ns[ri(ns.length)]; // more is view state (not saved)
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
        else if (op === 8 && rnd() < 0.6) { // an edit of whole statements: timers, forms, each blocks, whens
          const lines = a.source.replace(/\n$/, '').split('\n');
          const blocks = []; for (let i = 1; i < lines.length; i++) { if (!lines[i].startsWith(' ')) blocks.push([lines[i]]); else blocks[blocks.length - 1].push(lines[i]); }
          const movable = blocks.map((b, i) => i).filter(i => !/^(table|setting|state|let|def)\b/.test(blocks[i][0]));
          const k = ri(7); let kind = null;
          const pick = () => movable[ri(movable.length)];
          if (k === 0 && movable.length > 1) { const x = pick(), y = pick(); [blocks[x], blocks[y]] = [blocks[y], blocks[x]]; kind = 'swap'; }
          else if (k === 1 && movable.length > 2) { const [x, y, z] = [pick(), pick(), pick()]; if (new Set([x, y, z]).size === 3) { const t = blocks[x]; blocks[x] = blocks[y]; blocks[y] = blocks[z]; blocks[z] = t; kind = 'rotate'; } }
          else if (k === 2 && movable.length > 1) { blocks.splice(pick(), 1); kind = 'delete'; }
          else if (k === 3 && movable.length) { const x = pick(); blocks.splice(x + 1, 0, blocks[x].slice()); kind = 'duplicate'; }
          else if (k === 4) { const e = movable.filter(i => /^each \w+/.test(blocks[i][0])); if (e.length) { const x = e[ri(e.length)], h = blocks[x][0]; blocks[x] = [/ (sort|where|top) /.test(h) ? h.replace(/ (sort|where|top) .*$/, '') : h + [' sort n desc', ' where n > 0', ' top 5'][ri(3)], ...blocks[x].slice(1)]; kind = 'each modifier'; } }
          else if (k === 5) { const w = movable.filter(i => /^when /.test(blocks[i][0])); if (w.length) { const x = w[ri(w.length)]; blocks[x] = [rnd() < 0.5 ? blocks[x][0].replace(/>= (\d+)/, (m, d) => '>= ' + (+d + 1)) : blocks[x][0].replace(/n = (\d+)$/, (m, d) => 'n = ' + (+d + 1))]; kind = 'when reworded'; } }
          else if (k === 6 && /^table item /m.test(a.source)) { kind = 'table rename'; }
          let next = kind ? ['app' + lines[0].slice(3), ...blocks.flat()].join('\n') + '\n' : null;
          if (kind === 'table rename') next = a.source.replace(/^table item /m, 'table item2 was item ').replace(/\bitem\b(?! was)/g, (m, off, str) => str.slice(Math.max(0, off - 9), off) === 'item2 was ' ? m : 'item2').replace('table item2 was item2', 'table item2 was item');
          if (next) {
            const twin = load(a.source, { data: a.snapshot(), now: a.clock }); twin.tree();
            const notes = a.log.filter(e => e.kind === 'notify').length, tnotes = twin.log.filter(e => e.kind === 'notify').length;
            const r = a.applyEdit(next); stats.edits++;
            if (r.verdict === 'refused') stats.refused++;
            else {
              a.tree(); a.tick(0); a.tree(); twin.tick(0); twin.tree();
              stats.blockEdits = (stats.blockEdits || 0) + 1;
              // nothing ran because of the edit, and every surviving statement's state is as it was
              if (J(a.data.tables) !== J(twin.data.tables) || J(a.data.settings) !== J(twin.data.settings)) V(c, st, `a ${kind} edit ran an action`, a.source);
              for (const [key, v] of Object.entries(twin.data.state)) if (key in a.data.state && J(a.data.state[key]) !== J(v)) { V(c, st, `a ${kind} edit changed state ${key}`, a.source); break; }
              if (a.log.filter(e => e.kind === 'notify').length - notes !== twin.log.filter(e => e.kind === 'notify').length - tnotes) { /* the edit itself notified (the twin, without it, did not) */ if (process.env.LSDEBUG) console.error('BEFORE', twin.source, 'AFTER', a.source, JSON.stringify(twin.data.state), JSON.stringify(a.data.state), JSON.stringify(a.log.slice(-3)), new Date(a.clock).toISOString()); V(c, st, `a ${kind} edit notified`, a.source); }
              // what each statement shows is unchanged when statements only moved (or a table was renamed)
              const texts = x => J(x.findAll(n => n.t === 'text' || n.t === 'button' || (n.t === 'input' && n.value !== null)).map(n => n.t === 'input' ? n.label + '=' + n.value : n.text).sort());
              if ((kind === 'swap' || kind === 'rotate' || kind === 'table rename') && texts(a) !== texts(twin)) V(c, st, `a ${kind} edit changed what is shown: ${texts(twin)} -> ${texts(a)}`, a.source);
            }
          }
        } else if (op === 8) { // a safe edit: a line inserted at a random top-level place, or removed, or two text lines swapped
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
        const bd = JSON.parse(before); // states that a new statement made when it was first shown are not part of a step
        if (J(a.data.tables) !== J(bd.tables) || J(a.data.settings) !== J(bd.settings) || Object.keys(bd.state).some(k => J(a.data.state[k]) !== J(bd.state[k]))) V(c, st, `undo of step ${op} did not give back the data from before it`, a.source);
        a = u; // continue from the state after the step
      }
      // lockstep: a fresh app from a snapshot shows the same tree and holds the same data
      const t1 = J(a.tree()), d1 = J(a.data);
      const b = load(a.source, { data: a.snapshot(), now: a.clock });
      stats.reloadChecks++;
      if (!b.ok) { V(c, st, 'a snapshot does not load: ' + b.errors[0], a.source); break; }
      if (J(b.tree()) !== t1) { V(c, st, `after step ${op} a fresh load shows a different tree`, a.source); break; }
      if (J(b.data) !== d1) { if (process.env.LSDEBUG) { const x = JSON.parse(d1), y = b.data; for (const g of ['tables', 'settings', 'state']) for (const k of new Set([...Object.keys(x[g]), ...Object.keys(y[g])])) if (J(x[g][k]) !== J(y[g][k])) console.error(g, k, String(J(x[g][k])).slice(0, 200), '| fresh:', String(J(y[g][k])).slice(0, 200)); console.error(a.source); } V(c, st, `after step ${op} a fresh load holds different data`, a.source); break; }
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
