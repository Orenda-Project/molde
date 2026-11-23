// Program-level data-safety fuzz: an independent model of the user's data is kept next to the
// evaluator, and after every step what the PROGRAM SHOWS (counts, filtered counts, sums, a sum
// through a link, a setting, a state) must equal what the model computes. Steps: add rows, link
// rows, user-set a setting, change a state, rename tables, fields, options, settings and states with
// was, add options and fields, change a setting default (the user's value must stay) or force it
// with `set`, chat Undo (revert), and reload from a snapshot into a new app.
// Usage: node lang/tests/fuzz-model.mjs [chains=1000] [seed=5]
import { load } from '../eval.mjs';

export function runModelFuzz(chains = 1000, seed = 5, steps = 10) {
  let s = seed;
  const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const ri = n => Math.floor(rnd() * n);
  const stats = { chains: 0, steps: 0, edits: 0, refused: 0, reverts: 0, reloads: 0, checks: 0, violations: [] };
  for (let c = 0; c < chains; c++) {
    stats.chains++;
    let n = 0;
    const fresh = p => p + (n++);
    // the structure (names only; identity is the object)
    let S = { P: 'p', n: 'n', k: 'k', opts: [{ id: 0, name: 'A' }, { id: 1, name: 'B' }], C: 'c', v: 'v', p: 'pr', set: 'g', dflt: 5, force: false, st: 'st', extra: [] };
    const hist = [];
    // the data (logical)
    const P = [], C = []; // {id, n, k(option id)} / {id, v, p (P row id)}
    let gStored = null, stVal = 0, backup = null;
    const prog = (S, renames = {}) => {
      const w = (key, name) => renames[key] ? `${name} was ${renames[key]}` : name;
      const opt = S.opts.map(o => renames['o' + o.id] ? `${o.name} was ${renames['o' + o.id]}` : o.name).join('|');
      const lines = [
        'app "M" list mint',
        `table ${S.P}${renames.P ? ' was ' + renames.P : ''} ${w('n', S.n)} num${renames.n ? '' : ''}, ${S.k} pick ${opt}${renames.k ? ' was ' + renames.k : ''}${S.extra.map(e => `, ${e} text?`).join('')}`.replace(`${S.n} was ${renames.n} num`, `${S.n} num was ${renames.n}`),
        `table ${S.C}${renames.C ? ' was ' + renames.C : ''} ${S.v} num, ${S.p} ref ${S.P}`,
        `setting ${S.set} num = ${S.dflt}${renames.set ? ' was ' + renames.set : ''}${S.force ? ' set' : ''}`,
        `state ${S.st} num${renames.st ? ' was ' + renames.st : ''} = 0`,
        `"cP" count(${S.P})`, `"sN" sum(${S.P}.${S.n})`,
        ...S.opts.map(o => `"k${o.id}" count(${S.P} where ${S.k} = ${o.name})`),
        `"cC" count(${S.C})`, `"sV" sum(${S.C}.${S.v})`, `"rp" sum(${S.C}, it.${S.p}.${S.n})`,
        `"g" ${S.set}`, `"st" ${S.st}`, `button "inc" tap set ${S.st} = ${S.st} + 1`,
      ];
      return lines.join('\n') + '\n';
    };
    let app = load(prog(S));
    if (!app.ok) { stats.violations.push({ c, why: 'v1 does not load', err: app.errors[0] }); continue; }
    const expected = () => {
      const out = { cP: P.length, sN: P.reduce((a, r) => a + r.n, 0), cC: C.length, sV: C.reduce((a, r) => a + r.v, 0), rp: C.reduce((a, r) => a + (P.find(x => x.id === r.p)?.n ?? 0), 0), g: gStored ?? S.dflt0, st: stVal };
      for (const o of S.opts) out['k' + o.id] = P.filter(r => r.k === o.id).length;
      return out;
    };
    S.dflt0 = S.dflt; // the stored value is set from the first default and then only by the user or `set`
    const check = (st) => {
      stats.checks++;
      { const leak = boundaryLeak(app); if (leak) stats.violations.push({ c, st, why: 'a stored form left the evaluator: ' + leak }); const echo = echoChanges(app); if (echo) stats.violations.push({ c, st, why: 'echo changed data: ' + echo }); }
      const texts = app.findAll(x => x.t === 'text').map(x => x.text);
      const got = Object.fromEntries(texts.map(t => t.split(' ')).filter(x => x.length >= 2).map(([k, ...v]) => [k, v.join(' ')]));
      for (const [k, v] of Object.entries(expected())) if (String(got[k]) !== String(v)) stats.violations.push({ c, st, why: `${k} shows ${got[k]} but the data says ${v}`, src: app.source });
    };
    check(-1);
    for (let st = 0; st < steps; st++) {
      stats.steps++;
      const op = ri(13);
      if (op <= 2) { // add rows
        const pr = app.addRow(S.P, { [S.n]: 1 + ri(9), [S.k]: S.opts[ri(S.opts.length)].name });
        if (pr) P.push({ id: pr.id, n: pr[app.fk(S.P, S.n)], k: S.opts.find(o => o.name === app.cell(S.P, pr, S.k)).id });
        if (P.length) { const parent = P[ri(P.length)]; const cr = app.addRow(S.C, { [S.v]: 1 + ri(9), [S.p]: parent.id }); if (cr) C.push({ id: cr.id, v: cr[app.fk(S.C, S.v)], p: parent.id }); }
      } else if (op === 3) { const v = 1 + ri(50); app.setField(S.set, null, v); gStored = v; }
      else if (op === 4) { app.dispatch(app.find(x => x.t === 'button' && x.text === 'inc').id, 'tap'); stVal++; }
      else if (op === 5 && hist.length) { // chat Undo
        const r = app.revert(); stats.reverts++;
        if (r.verdict === 'restore') { const h = hist.pop(); S = h.S; if (h.forcedFrom !== undefined) gStored = h.forcedFrom; }
      } else if (op === 6) {
        if (backup && rnd() < 0.5) { // restore an older backup: a backup is a whole app, its program comes back with its data (round 7)
          const r = app.restore(backup.snap);
          if (!r.ok) stats.violations.push({ c, st, why: 'restore refused: ' + r.reason });
          P.length = 0; P.push(...JSON.parse(JSON.stringify(backup.P))); C.length = 0; C.push(...JSON.parse(JSON.stringify(backup.C)));
          gStored = backup.gStored; stVal = backup.stVal; S = backup.S; hist.length = 0; stats.backups = (stats.backups || 0) + 1;
        } else { // reload from a snapshot into a new app
          const snap = JSON.parse(JSON.stringify(app.snapshot()));
          backup = { snap, P: JSON.parse(JSON.stringify(P)), C: JSON.parse(JSON.stringify(C)), gStored, stVal, S };
          const undo = app.versionsUndo; app = load(app.source, { data: snap }); app.versionsUndo = undo; stats.reloads++;
        }
      } else { // an edit
        const N = JSON.parse(JSON.stringify(S));
        const ren = {};
        let forcedFrom;
        if (op === 7) { ren.P = N.P; N.P = fresh('t'); }
        else if (op === 8) { ren.n = N.n; N.n = fresh('f'); }
        else if (op === 9) { const o = N.opts[ri(N.opts.length)]; ren['o' + o.id] = o.name; o.name = fresh('O'); }
        else if (op === 10) { if (rnd() < 0.5) { ren.set = N.set; N.set = fresh('s'); } else { ren.st = N.st; N.st = fresh('x'); } }
        else if (op === 11) { if (rnd() < 0.5) N.opts.push({ id: N.opts.length, name: fresh('O') }); else N.extra.push(fresh('e')); }
        else { N.dflt = 1 + ri(50); N.force = rnd() < 0.4; }
        const r = app.applyEdit(prog(N, ren));
        stats.edits++;
        if (r.verdict === 'refused') { stats.refused++; stats.violations.push({ c, st, why: 'a safe edit was refused', refused: r.refused, src: prog(N, ren) }); }
        else {
          if (N.force && (!S.force || S.dflt !== N.dflt)) { forcedFrom = gStored; gStored = N.dflt; }
          hist.push({ S, forcedFrom });
          S = { ...N, force: N.force };
        }
      }
      check(st);
    }
  }
  return stats;
}

// The boundary (round 8): nothing that leaves the evaluator is an option reference {o} or the text
// "[object Object]": the tree, fields() of every row and setting, cell(). And sending an input or
// a choice its own current value never changes stored data.
export function boundaryLeak(A) {
  const bad = v => (v && typeof v === 'object' && !Array.isArray(v) && 'o' in v) || v === '[object Object]';
  const walk = (x, path) => {
    if (bad(x)) return path;
    if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) { const r = walk(v, path + '.' + k); if (r) return r; }
    return null;
  };
  const t = walk(A.tree(), 'tree'); if (t) return t;
  for (const [tn] of A.env.tables || []) for (const r of A.rows(tn)) { const f = walk(A.fields({ table: tn, id: r.id }), `fields(${tn}:${r.id})`); if (f) return f; }
  for (const st of A.prog.body) if (st.kind === 'setting') { const f = walk(A.fields(st.name), `fields(${st.name})`); if (f) return f; }
  return null;
}
export function echoChanges(A) {
  const nodes = A.findAll(n => (n.t === 'input' || n.t === 'choice') && n.value !== undefined).slice(0, 4);
  for (const n of nodes) {
    const before = JSON.stringify(A.data);
    A.dispatch(n.id, 'change', n.value);
    A.undoStack.pop();
    if (JSON.stringify(A.data) !== before) return `${n.id} (${JSON.stringify(n.value)})`;
  }
  return null;
}

// Rename fuzz (rounds 6-7). The oracle is a reference model that keeps values by slot: three number
// fields, a pick field (O), a text field holding texts that start with #, a pick setting (M), a pick
// state (Z) and two number settings. Names move; options can also be dropped (a dropped option keeps
// its rows and shows its last name) and listed again. Steps: add rows, set settings and the state;
// rename edits (swap, 3-cycle, rename to a fresh or an earlier name, drop or re-list an option; a
// rename onto a dropped option's name must be refused); the same edit written again; re-submitting
// the stored text; Undo; restore to any version; backups taken at any point and restored later
// (ahead, behind or diverged), whole or keeping the running program; an old backup loaded with the
// newer program, with and without history; and after every step a reload, every other one from a
// legacy-shaped snapshot. After every step every slot's value must show under the name the program
// gives that slot.
export function runRenameFuzz(chains = 1000, seed = 7, steps = 12) {
  let s = seed;
  const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const ri = n => Math.floor(rnd() * n);
  const stats = { chains: 0, steps: 0, edits: 0, refused: 0, refusedAsExpected: 0, repeats: 0, resubmits: 0, reverts: 0, versionRestores: 0, backupRestores: 0, keepRestores: 0, keepRefused: 0, drops: 0, relists: 0, reloads: 0, legacyReloads: 0, oldWithHistory: 0, oldWithout: 0, checks: 0, violations: [] };
  const pickTwo = n => { const i = ri(n); let j = ri(n - 1); if (j >= i) j++; return [i, j]; };
  const GROUPS = ['F', 'O', 'G', 'M', 'Z'], OPT = new Set(['O', 'M', 'Z']);
  const cp = x => JSON.parse(JSON.stringify(x));
  for (let c = 0; c < chains; c++) {
    stats.chains++;
    // per group: names by slot, and for option groups whether each slot is listed
    let S = { F: ['a', 'b', 'c'], O: ['A', 'B', 'C'], G: ['g', 'h'], M: ['P', 'R', 'T'], Z: ['U', 'V', 'W'], L: { O: [1, 1, 1], M: [1, 1, 1], Z: [1, 1, 1] } };
    const used = Object.fromEntries(GROUPS.map(g => [g, new Set(S[g])]));
    let fresh = 0;
    const freshName = g => (OPT.has(g) ? g + 'q' : g === 'F' ? 'f' : 's') + (fresh++);
    const listed = (S, g, i) => !OPT.has(g) || S.L[g][i];
    const prog = (S, ren = {}) => {
      const w = (g, i) => ren[g] && ren[g][i] !== undefined ? ` was ${ren[g][i]}` : '';
      const opts = g => S[g].map((n, i) => listed(S, g, i) ? n + w(g, i) : null).filter(Boolean).join('|');
      const first = g => S[g].find((n, i) => listed(S, g, i));
      return ['app "M" list mint',
        `table p ${S.F.map((n, i) => `${n} num${w('F', i)}`).join(', ')}, k pick ${opts('O')}, t text?`,
        ...S.G.map((n, i) => `setting ${n} num = 0${w('G', i)}`),
        `setting m pick ${opts('M')} = ${first('M')}`,
        `state z pick ${opts('Z')} = ${first('Z')}`,
        ...S.F.map((n, i) => `"s${i}" sum(p.${n})`), ...S.O.map((n, i) => listed(S, 'O', i) ? `"k${i}" count(p where k = ${n})` : null).filter(Boolean),
        ...S.G.map((n, i) => `"g${i}" ${n}`), '"m" m', '"z" z', '"h" count(p where t = "#A")',
        ...S.Z.map((n, i) => listed(S, 'Z', i) ? `button "z${i}" tap set z = ${n}` : null).filter(Boolean),
        'field m', 'choice z', 'each p', '  choice it.k', '  field it.t'].join('\n') + '\n';
    };
    let D = { rows: [], G: [0, 0], m: 0, z: 0 }; // the data, by slot
    let app = load(prog(S));
    let verS = [S]; // the structure of each recorded version
    let texts0 = [prog(S)], restored = false, lastEdit = null;
    const backups = [], trace = [];
    const sync = () => { while (verS.length < app.ever.versions.length) verS.push(S); };
    const expected = (S, D) => {
      const o = {};
      S.F.forEach((_, i) => { o['s' + i] = D.rows.reduce((a, r) => a + r.f[i], 0); });
      S.O.forEach((_, i) => { if (listed(S, 'O', i)) o['k' + i] = D.rows.filter(r => r.o === i).length; });
      S.G.forEach((_, i) => { o['g' + i] = D.G[i]; });
      o.m = S.M[D.m]; o.z = S.Z[D.z]; o.h = D.rows.filter(r => r.t === '#A').length;
      return o;
    };
    const check = (A, S, D, st, what) => {
      stats.checks++;
      if (!A.ok) { stats.violations.push({ c, st, what, why: 'not ok: ' + A.errors[0], trace: trace.slice(-5) }); return; }
      const leak = boundaryLeak(A);
      if (leak) { stats.violations.push({ c, st, what, why: 'a stored form left the evaluator: ' + leak }); return; }
      const echo = echoChanges(A);
      if (echo) { stats.violations.push({ c, st, what, why: 'sending a node its own value changed data: ' + echo }); return; }
      const got = Object.fromEntries(A.findAll(x => x.t === 'text').map(x => x.text.split(' ')).filter(x => x.length === 2));
      for (const [k, v] of Object.entries(expected(S, D))) if (String(got[k]) !== String(v)) { stats.violations.push({ c, st, what, why: `${k} shows ${got[k]} but the data says ${v}`, trace: trace.slice(-5) }); return; }
    };
    const applyClauses = (S, cl) => { const N = cp(S); for (const g of GROUPS) N[g] = S[g].map((n, i) => listed(S, g, i) && cl[g] && cl[g][n] !== undefined ? cl[g][n] : n); return N; };
    // a rename onto the last name of a dropped option of the same pick is refused
    const mergesDropped = (S, N, g) => OPT.has(g) && N[g].some((n, i) => n !== S[g][i] && S[g].some((m, j) => j !== i && !S.L[g][j] && m === n));
    const edit = (text, N, st, g) => {
      const r = app.applyEdit(text); stats.edits++;
      const expectRefuse = g && mergesDropped(S, N, g);
      if (r.verdict === 'refused') {
        if (expectRefuse) { stats.refusedAsExpected++; return false; }
        stats.refused++; stats.violations.push({ c, st, why: 'a safe rename was refused', refused: r.refused, text }); return false;
      }
      if (expectRefuse) { stats.violations.push({ c, st, why: 'a rename onto a dropped option was not refused', text }); }
      S = N; for (const g of GROUPS) N[g].forEach(n => used[g].add(n)); sync(); texts0.push(text);
      return true;
    };
    for (let st = 0; st < steps; st++) {
      stats.steps++;
      const op = ri(14);
      if (op <= 1) {
        const oi = [0, 1, 2].filter(i => S.L.O[i]); const r = { f: S.F.map(() => 1 + ri(9)), o: oi[ri(oi.length)], t: ['#A', '#B', 'x', '#' + S.O[0]][ri(4)] };
        if (app.addRow('p', { [S.F[0]]: r.f[0], [S.F[1]]: r.f[1], [S.F[2]]: r.f[2], k: S.O[r.o], t: r.t })) D.rows.push(r);
      } else if (op === 2) {
        const w = ri(3);
        if (w < 2) { const v = 1 + ri(50); app.setField(S.G[w], null, v); D.G[w] = v; }
        else { const mi = [0, 1, 2].filter(i => S.L.M[i]); const i = mi[ri(mi.length)]; app.setField('m', null, S.M[i]); D.m = i; }
      } else if (op === 3) { // tap a state button
        const zi = [0, 1, 2].filter(i => S.L.Z[i]); const i = zi[ri(zi.length)];
        const b = app.find(n => n.t === 'button' && n.text === 'z' + i); if (b) { app.dispatch(b.id, 'tap'); D.z = i; }
      } else if (op <= 6) { // a rename edit
        const g = GROUPS[ri(GROUPS.length)], N = cp(S), ren = {}, L = N[g], cl = {};
        ren[g] = {}; cl[g] = {};
        const live = L.map((_, i) => i).filter(i => listed(S, g, i));
        const kind = Math.min(3, ri(OPT.has(g) ? 6 : 3));
        if (kind === 0 && live.length >= 2) { const [x, y] = pickTwo(live.length); const i = live[x], j = live[y]; [L[i], L[j]] = [L[j], L[i]]; ren[g][i] = S[g][i]; ren[g][j] = S[g][j]; }
        else if (kind === 1 && live.length >= 3) { const [i, j, k] = live; const t = L[i]; L[i] = L[j]; L[j] = L[k]; L[k] = t; [i, j, k].forEach(x => { ren[g][x] = S[g][x]; }); }
        else if (kind === 3) { // drop a listed option (not the last one, not the default holder of m/z) or list a dropped one again
          const hidden = L.map((_, i) => i).filter(i => !S.L[g][i]);
          if (hidden.length && rnd() < 0.5) { const i = hidden[ri(hidden.length)]; if (!L.some((n, j) => j !== i && S.L[g][j] && n === L[i])) { N.L[g][i] = 1; stats.relists++; } }
          else if (live.length >= 3) { const i = live[ri(live.length)]; if (!(g === 'M' && D.m === i) && !(g === 'Z' && D.z === i)) { N.L[g][i] = 0; stats.drops++; } } // a stored setting or state value keeps an option listed
        } else if (live.length) { const i = live[ri(live.length)]; const back = [...used[g]].filter(n => !L.some((m, j) => S.L[g] ? S.L[g][j] && m === n : m === n)); L[i] = back.length && rnd() < 0.5 ? back[ri(back.length)] : freshName(g); ren[g][i] = S[g][i]; }
        for (const [i, o] of Object.entries(ren[g])) cl[g][o] = L[i];
        if (JSON.stringify(N) === JSON.stringify(S)) continue;
        if (OPT.has(g) && L.some((n, i) => N.L[g][i] && L.some((m, j) => j !== i && N.L[g][j] && m === n))) continue; // two listed options with one name: not a program
        const text = prog(N, ren);
        if (edit(text, N, st, g)) lastEdit = { cl };
      } else if (op === 7 && lastEdit) { // the same clauses written again: they act again
        stats.repeats++;
        const N = applyClauses(S, lastEdit.cl), ren = {};
        for (const g of GROUPS) S[g].forEach((n, i) => { if (listed(S, g, i) && lastEdit.cl[g] && lastEdit.cl[g][n] !== undefined) (ren[g] ||= {})[i] = n; });
        const same = g => [...N[g].filter((n, i) => listed(N, g, i))].sort().join() === [...S[g].filter((n, i) => listed(S, g, i))].sort().join();
        if (GROUPS.every(same)) edit(prog(N, ren), N, st);
      } else if (op === 8) { // re-submit the stored text: nothing may change
        stats.resubmits++;
        const r = app.applyEdit(app.source);
        if (r.verdict !== 'safe' || r.changes.length) stats.violations.push({ c, st, why: 're-submitted stored text changed something', r: [r.verdict, r.changes] });
        sync();
      } else if (op === 9) { const r = app.revert(); if (r.verdict === 'restore') { stats.reverts++; restored = true; S = verS[r.restoredFrom]; sync(); } }
      else if (op === 10) { // restore to any recorded version
        const i = ri(app.ever.versions.length);
        const r = app.setProgram(app.ever.versions[i].src, { restore: true, version: i });
        if (r.verdict !== 'restore') stats.violations.push({ c, st, why: 'restore to version ' + i + ' was ' + r.verdict });
        else { stats.versionRestores++; restored = true; S = verS[i]; sync(); }
      } else if (op === 11) { // take a backup, or restore one taken at any point (whole, or keeping the running program)
        if (backups.length && rnd() < 0.6) {
          const b = backups[ri(backups.length)];
          if (rnd() < 0.4) {
            const at = b.snap.ever.versions.map(v => v.src).lastIndexOf(app.source);
            const r = app.restore(b.snap, { keepProgram: true });
            if (at < 0) { if (r.ok) stats.violations.push({ c, st, why: 'keepProgram restore should be refused' }); else stats.keepRefused++; }
            else if (!r.ok) stats.violations.push({ c, st, why: 'keepProgram restore refused: ' + r.reason });
            else { stats.keepRestores++; D = cp(b.D); verS = [...b.verS]; S = verS[at]; sync(); restored = true; texts0 = [...b.texts]; lastEdit = null; }
          } else {
            const r = app.restore(b.snap); stats.backupRestores++;
            if (!r.ok) stats.violations.push({ c, st, why: 'restore refused: ' + r.reason });
            else { D = cp(b.D); verS = [...b.verS]; S = b.S; restored = b.restored; texts0 = [...b.texts]; lastEdit = null; }
          }
        } else backups.push({ snap: app.snapshot(), D: cp(D), S, verS: [...verS], texts: [...texts0], restored });
      } else if (op === 12 && backups.length) { // an old backup with the newer program
        const b = backups[ri(backups.length)];
        if (!restored && !b.restored) { // with history: the backup's maps, then the steps it missed
          const A = load(app.source, { data: b.snap, history: texts0 }); stats.oldWithHistory++;
          check(A, S, { ...b.D, z: b.D.z }, st, 'old backup + newer program + history');
        }
        const A2 = load(app.source, { data: b.snap }); stats.oldWithout++; // without history: the backup's own program, with a warning
        if (app.source !== b.snap.ever.versions.at(-1).src && A2.edit.verdict !== 'warn') stats.violations.push({ c, st, why: 'old backup + other program without history gave no warning' });
        check(A2, b.S, b.D, st, 'old backup + newer program without history');
      } else if (op === 13) { // a backup of another app is refused
        const other = load(prog(S)); other.addRow('p', { [S.F[0]]: 1, [S.F[1]]: 1, [S.F[2]]: 1, k: S.O[S.L.O.indexOf(1)] });
        if (app.ever.touched) { if (app.restore(other.snapshot()).ok) stats.violations.push({ c, st, why: 'a backup of another app was restored' }); } // a new empty install may adopt any backup
      }
      trace.push(op + ': ' + app.source.split('\n').slice(1, 5).join(' / '));
      check(app, S, D, st, 'step ' + op);
      const snap = app.snapshot();
      if (st % 2) { // legacy-shaped: no format, no option slots, no maps; stored choices hold option names
        stats.legacyReloads++;
        const nameOf = (slot, v) => v && typeof v === 'object' && slot.opts && slot.opts[v.o] ? (slot.opts[v.o].visible ?? Object.entries(slot.opts[v.o].seen).sort((a, b) => b[1] - a[1])[0][0]) : v;
        for (const [tk, t] of Object.entries(snap.ever.tables)) for (const [fk, f] of Object.entries(t.fields)) if (f.opts) { for (const row of snap.data.tables[tk] || []) row[fk] = nameOf(f, row[fk]); delete f.opts; }
        for (const [k, sl] of Object.entries(snap.ever.settings)) if (sl.opts) { snap.data.settings[k] = nameOf(sl, snap.data.settings[k]); delete sl.opts; }
        for (const [k, sl] of Object.entries(snap.ever.states)) if (sl.opts) { if (`|${k}` in snap.data.state) snap.data.state[`|${k}`] = nameOf(sl, snap.data.state[`|${k}`]); delete sl.opts; }
        delete snap.ever.format; for (const v of snap.ever.versions) delete v.map;
      }
      const undo = app.versionsUndo; const verLen = app.ever.versions.length;
      app = load(app.source, { data: snap }); app.versionsUndo = undo; stats.reloads++;
      if (app.ever.versions.length !== verLen) stats.violations.push({ c, st, why: `reload changed the number of versions ${verLen} -> ${app.ever.versions.length}`, trace: trace.slice(-3) });
      check(app, S, D, st, (st % 2 ? 'legacy ' : '') + 'reload after step ' + op);
    }
  }
  return stats;
}

if (process.argv[2] === 'rename') {
  const t0 = Date.now();
  const r = runRenameFuzz(+(process.argv[3] || 2000), +(process.argv[4] || 7));
  console.log(JSON.stringify({ ...r, violations: r.violations.length, firstViolations: r.violations.slice(0, 3), ms: Date.now() - t0 }));
  process.exit(r.violations.length ? 1 : 0);
} else if (import.meta.url === `file://${process.argv[1]}`) {
  const t0 = Date.now();
  const r = runModelFuzz(+(process.argv[2] || 1000), +(process.argv[3] || 5));
  console.log(JSON.stringify({ ...r, violations: r.violations.length, firstViolations: r.violations.slice(0, 3), ms: Date.now() - t0 }));
  process.exit(r.violations.length ? 1 : 0);
}
