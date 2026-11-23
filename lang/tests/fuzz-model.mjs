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

if (import.meta.url === `file://${process.argv[1]}`) {
  const t0 = Date.now();
  const r = runModelFuzz(+(process.argv[2] || 1000), +(process.argv[3] || 5));
  console.log(JSON.stringify({ ...r, violations: r.violations.length, firstViolations: r.violations.slice(0, 3), ms: Date.now() - t0 }));
  process.exit(r.violations.length ? 1 : 0);
}
