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
        if (pr) P.push({ id: pr.id, n: pr[app.fk(S.P, S.n)], k: S.opts.find(o => o.name === pr[app.fk(S.P, S.k)]).id });
        if (P.length) { const parent = P[ri(P.length)]; const cr = app.addRow(S.C, { [S.v]: 1 + ri(9), [S.p]: parent.id }); if (cr) C.push({ id: cr.id, v: cr[app.fk(S.C, S.v)], p: parent.id }); }
      } else if (op === 3) { const v = 1 + ri(50); app.setField(S.set, null, v); gStored = v; }
      else if (op === 4) { app.dispatch(app.find(x => x.t === 'button' && x.text === 'inc').id, 'tap'); stVal++; }
      else if (op === 5 && hist.length) { // chat Undo
        const r = app.revert(); stats.reverts++;
        if (r.verdict === 'restore') { const h = hist.pop(); S = h.S; if (h.forcedFrom !== undefined) gStored = h.forcedFrom; }
      } else if (op === 6) {
        if (backup && rnd() < 0.5) { // restore an OLDER backup into this (newer) program: the data goes back, the schema history is merged
          const r = app.restore(backup.snap);
          if (!r.ok) stats.violations.push({ c, st, why: 'restore refused: ' + r.reason });
          P.length = 0; P.push(...JSON.parse(JSON.stringify(backup.P))); C.length = 0; C.push(...JSON.parse(JSON.stringify(backup.C)));
          gStored = backup.gStored; stVal = backup.stVal; stats.backups = (stats.backups || 0) + 1;
        } else { // reload from a snapshot into a new app
          const snap = JSON.parse(JSON.stringify(app.snapshot()));
          backup = { snap, P: JSON.parse(JSON.stringify(P)), C: JSON.parse(JSON.stringify(C)), gStored, stVal };
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

// Rename fuzz (round 5): swaps, rotations and renames back to an earlier name of fields, options
// and settings; re-submitting the current text; Undo and re-applying the undone edit; restoring
// any earlier backup at any point; and a reload from a snapshot after EVERY step. The model keeps
// values by slot (identity), so after every step each slot's value must show under the name the
// current program gives that slot, and re-submitted identical text must change nothing.
export function runRenameFuzz(chains = 1000, seed = 7, steps = 12) {
  let s = seed;
  const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const ri = n => Math.floor(rnd() * n);
  const stats = { chains: 0, steps: 0, edits: 0, refused: 0, resubmits: 0, reverts: 0, reapplies: 0, restores: 0, reloads: 0, checks: 0, violations: [] };
  const pickTwo = n => { const i = ri(n); let j = ri(n - 1); if (j >= i) j++; return [i, j]; };
  for (let c = 0; c < chains; c++) {
    stats.chains++;
    // structure: slot ids are fixed, names move; used = every name each group has had
    let S = { F: ['a', 'b', 'c'], O: ['A', 'B', 'C'], G: ['g', 'h'] };
    const used = { F: new Set(S.F), O: new Set(S.O), G: new Set(S.G) };
    let fresh = 0;
    const freshName = g => g === 'O' ? 'Q' + (fresh++) : (g === 'F' ? 'f' : 's') + (fresh++);
    const prog = (S, ren = { F: {}, O: {}, G: {} }) => {
      const w = (g, i) => ren[g][i] !== undefined ? ` was ${ren[g][i]}` : '';
      return ['app "M" list mint',
        `table p ${S.F.map((n, i) => `${n} num${w('F', i)}`).join(', ')}, k pick ${S.O.map((n, i) => n + w('O', i)).join('|')}`,
        ...S.G.map((n, i) => `setting ${n} num = 0${w('G', i)}`),
        ...S.F.map((n, i) => `"s${i}" sum(p.${n})`), ...S.O.map((n, i) => `"k${i}" count(p where k = ${n})`), ...S.G.map((n, i) => `"g${i}" ${n}`)].join('\n') + '\n';
    };
    // data by slot: rows {f: [n0, n1, n2], o: option slot}; settings by slot
    let rows = [], G = [0, 0];
    let app = load(prog(S));
    const hist = [], backups = [], trace = [];
    let lastEdit = null; // {N, ren} of the edit Undo just took back
    const expected = () => { const o = {}; S.F.forEach((_, i) => { o['s' + i] = rows.reduce((a, r) => a + r.f[i], 0); }); S.O.forEach((_, i) => { o['k' + i] = rows.filter(r => r.o === i).length; }); S.G.forEach((_, i) => { o['g' + i] = G[i]; }); return o; };
    const check = (st, what) => {
      stats.checks++;
      const got = Object.fromEntries(app.findAll(x => x.t === 'text').map(x => x.text.split(' ')).filter(x => x.length === 2));
      for (const [k, v] of Object.entries(expected())) if (String(got[k]) !== String(v)) { stats.violations.push({ c, st, what, why: `${k} shows ${got[k]} but the data says ${v}`, trace: trace.slice(-5) }); return; }
    };
    const apply = (N, ren, st) => {
      const r = app.applyEdit(prog(N, ren)); stats.edits++;
      if (r.verdict === 'refused') { stats.refused++; stats.violations.push({ c, st, why: 'a safe rename was refused', refused: r.refused, src: prog(N, ren) }); return false; }
      hist.push(S); S = N; for (const g of ['F', 'O', 'G']) N[g].forEach(n => used[g].add(n));
      return true;
    };
    for (let st = 0; st < steps; st++) {
      stats.steps++;
      const op = ri(10);
      if (op <= 1) { const r = { f: S.F.map(() => 1 + ri(9)), o: ri(3) }; if (app.addRow('p', { [S.F[0]]: r.f[0], [S.F[1]]: r.f[1], [S.F[2]]: r.f[2], k: S.O[r.o] })) rows.push(r); }
      else if (op === 2) { const i = ri(2), v = 1 + ri(50); app.setField(S.G[i], null, v); G[i] = v; }
      else if (op <= 5) { // a rename edit: swap, rotate, rename to a fresh name or back to an earlier one
        const g = ['F', 'O', 'G'][ri(3)], N = JSON.parse(JSON.stringify(S)), ren = { F: {}, O: {}, G: {} }, L = N[g];
        const kind = ri(3);
        if (kind === 0) { const [i, j] = pickTwo(L.length); [L[i], L[j]] = [L[j], L[i]]; ren[g][i] = S[g][i]; ren[g][j] = S[g][j]; }
        else if (kind === 1 && L.length >= 3) { const t = L[0]; L[0] = L[1]; L[1] = L[2]; L[2] = t; [0, 1, 2].forEach(i => { ren[g][i] = S[g][i]; }); }
        else { const i = ri(L.length); const back = [...used[g]].filter(n => !L.includes(n)); L[i] = back.length && rnd() < 0.5 ? back[ri(back.length)] : freshName(g); ren[g][i] = S[g][i]; }
        // a was clause that the current program already has means "already done" (that is what keeps
        // re-submitted text from moving values again), so a new rename that repeats one is written
        // after a clean edit without was, as a user would
        const has = new Set([...app.source.matchAll(/([A-Za-z0-9_]+)(?: num(?: = 0)?)? was ([A-Za-z0-9_]+)/g)].map(m => m[1] + '<' + m[2]));
        if (Object.entries(ren[g]).some(([i, o]) => has.has(L[i] + '<' + o))) { stats.cleans = (stats.cleans || 0) + 1; if (!apply(JSON.parse(JSON.stringify(S)), undefined, st)) continue; }
        if (apply(N, ren, st)) lastEdit = null;
      } else if (op === 6) { // re-submit the current text: nothing may change
        stats.resubmits++;
        const r = app.applyEdit(app.source);
        if (r.verdict !== 'safe' || r.changes.some(x => /renames/.test(x))) stats.violations.push({ c, st, why: 're-submitted text changed something', r: [r.verdict, r.changes, r.refused], src: app.source });
        else hist.push(S);
      } else if (op === 7 && hist.length) { // chat Undo, remembering the edit so it can be applied again
        stats.reverts++;
        const undone = app.source;
        const r = app.revert();
        if (r.verdict === 'restore') { const prev = hist.pop(); lastEdit = { src: undone, S }; S = prev; }
      } else if (op === 8 && lastEdit) { // apply the undone edit again (an earlier text, re-submitted)
        stats.reapplies++;
        const r = app.applyEdit(lastEdit.src);
        if (r.verdict === 'refused') stats.violations.push({ c, st, why: 're-applying an undone edit was refused', refused: r.refused });
        else { hist.push(S); S = lastEdit.S; }
        lastEdit = null;
      } else if (op === 9) { // a backup now, or restore any earlier backup into the current app
        if (backups.length && rnd() < 0.6) {
          const b = backups[ri(backups.length)];
          const r = app.restore(b.snap); stats.restores++;
          if (!r.ok) stats.violations.push({ c, st, why: 'restore refused: ' + r.reason });
          rows = JSON.parse(JSON.stringify(b.rows)); G = [...b.G];
        } else backups.push({ snap: app.snapshot(), rows: JSON.parse(JSON.stringify(rows)), G: [...G] });
      }
      trace.push(op + ': ' + app.source.split('\n')[1] + ' | ' + app.source.split('\n').filter(l => l.startsWith('setting')).join('; '));
      check(st, 'step ' + op);
      // reload after every step: the same program, from the snapshot alone
      const undo = app.versionsUndo; app = load(app.source, { data: app.snapshot() }); app.versionsUndo = undo; stats.reloads++;
      check(st, 'reload after step ' + op);
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
