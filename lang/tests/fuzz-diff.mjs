// Data-safety fuzz for diff.mjs. Random edit chains: add, drop, re-add with any type, retype,
// rename with and without `was`, rename back, swaps, table add/drop/rename, pick option
// add/drop/rename, setting renames, and restores of earlier versions. Values are written into a
// simulated slot store after every accepted edit. Invariants while the verdict is safe (or restore):
//   1. no stored value is lost: every slot that holds values is still in the schema;
//   2. no stored value changes type: every value's type widens to its slot's type;
//   3. reachability: every slot keeps a name that resolves to it (so it can be brought back);
//   4. a restore of an earlier version is never refused;
//   5. a refused edit leaves the schema unchanged.
// Usage: node lang/tests/fuzz-diff.mjs [chains=5000] [seed=7]
import { evolve, emptySchema, resolve } from '../diff.mjs';

// the fuzz's own copy of the widening rule (independent of diff.mjs, so a bug there cannot hide)
const WIDE = { text: ['long'], pick: ['text', 'long'], num: ['money'], money: ['num'], date: ['when'] };
const widens = (a, b) => a.t === b.t ? (a.t !== 'ref' || a.table === b.table) : !!(WIDE[a.t] || []).includes(b.t);
const reachable = slots => Object.entries(slots).every(([k, s]) => Object.keys(s.seen || {}).some(n => resolve(slots, n)?.key === k));

export function runFuzz(chains = 5000, seed = 7, steps = 8) {
  let s = seed;
  const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const ri = n => Math.floor(rnd() * n);
  const pickOne = xs => xs[ri(xs.length)];
  const TYPES = ['text', 'long', 'num', 'money', 'date', 'when', 'bool', 'time', 'dur', 'pick', 'ref'];
  const stats = { chains: 0, edits: 0, safe: 0, restore: 0, refused: 0, violations: [] };
  const fld = f => `${f.name} ${f.type === 'pick' ? 'pick ' + f.options.map(o => o.was ? `${o.v} was ${o.was}` : o.v).join('|') : f.type === 'ref' ? 'ref ' + f.ref : f.type}?${f.was ? ' was ' + f.was : ''}`;
  const prog = m => 'app "F"\n' + m.tables.map(t => `table ${t.name}${t.was ? ' was ' + t.was : ''}${t.fields.length ? ' ' + t.fields.map(fld).join(', ') : ''}`).join('\n') + '\n'
    + m.settings.map(x => `setting ${x.name} ${x.type}${x.was ? ' was ' + x.was : ''}`).join('\n') + (m.settings.length ? '\n' : '')
    + m.tables.map(t => `list ${t.name}`).join('\n') + '\n';
  const strip = m => ({ tables: m.tables.map(t => ({ name: t.name, fields: t.fields.map(f => ({ ...f, was: null, options: f.options && f.options.map(o => ({ v: o.v })) })) })), settings: m.settings.map(x => ({ name: x.name, type: x.type })) });
  for (let c = 0; c < chains; c++) {
    stats.chains++;
    let ever = emptySchema();
    const store = {}; // slot path -> [type of each stored value]
    let model = { tables: [{ name: 'a', fields: [{ name: 'x', type: 'num' }, { name: 'y', type: 'pick', options: [{ v: 'A' }, { v: 'B' }] }] }, { name: 'b', fields: [{ name: 'z', type: 'text' }] }], settings: [{ name: 'g', type: 'num' }] };
    const history = [];
    let gone = [];
    let n = 0;
    for (let st = 0; st < steps; st++) {
      let m = JSON.parse(JSON.stringify(strip(model)));
      let src;
      const op = ri(16);
      if (op === 15 && history.length > 1) { const h = pickOne(history.slice(0, -1)); m = h.model; src = h.src; }
      else {
        const t = pickOne(m.tables);
        const ti = m.tables.indexOf(t);
        const fresh = () => 'f' + (n++);
        const typ = () => pickOne(TYPES);
        const mk = (name, type) => {
          const f = { name, type };
          if (type === 'pick') f.options = [{ v: 'A' }, { v: 'B' }, { v: 'C' }].slice(0, 2 + ri(2));
          if (type === 'ref') { const earlier = m.tables.slice(0, ti).map(x => x.name); if (!earlier.length) f.type = 'text'; else f.ref = pickOne(earlier); }
          return f;
        };
        const someName = () => pickOne([...gone.map(g => g.f.name), ...t.fields.map(f => f.name), 'x', 'y', 'z']);
        if (op === 0) t.fields.push(mk(fresh(), typ()));
        else if (op === 1 && t.fields.length) { const f = t.fields.splice(ri(t.fields.length), 1)[0]; gone.push({ table: t.name, f }); }
        else if (op === 2 && gone.length) { const g = pickOne(gone); const tt = m.tables.find(x => x.name === g.table); if (tt && !tt.fields.some(f => f.name === g.f.name)) tt.fields.push(mk(g.f.name, rnd() < 0.5 ? g.f.type : typ())); }
        else if (op === 3 && t.fields.length) { const i = ri(t.fields.length); t.fields[i] = mk(t.fields[i].name, typ()); }
        else if (op === 4 && t.fields.length) { const f = pickOne(t.fields); f.was = f.name; f.name = rnd() < 0.3 ? someName() : fresh(); }
        else if (op === 5 && t.fields.length) { const f = pickOne(t.fields); f.name = fresh(); }
        else if (op === 6) { const old = t.name; t.was = rnd() < 0.8 ? old : null; t.name = rnd() < 0.3 ? pickOne(['a', 'b', 'c']) : 't' + (n++); for (const x of m.tables) for (const f of x.fields) if (f.ref === old) f.ref = t.name; }
        else if (op === 7) m.tables.push({ name: 't' + (n++), fields: [mk(fresh(), typ())] });
        else if (op === 8 && m.tables.length > 1) { const i = ri(m.tables.length); const name = m.tables[i].name; m.tables.splice(i, 1); for (const x of m.tables) x.fields = x.fields.filter(f => f.ref !== name); }
        else if (op === 9) { const f = t.fields.find(f => f.type === 'pick'); if (f) { const r = ri(3); if (r === 0) f.options.push({ v: 'O' + (n++) }); else if (r === 1 && f.options.length > 2) f.options.splice(ri(f.options.length), 1); else { const o = pickOne(f.options); o.was = o.v; o.v = rnd() < 0.3 ? pickOne(['A', 'B', 'C']) : 'O' + (n++); } } }
        else if (op === 10 && t.fields.length) { const f = pickOne(t.fields); f.type = typ(); if (f.type === 'pick') f.options = [{ v: 'A' }, { v: 'B' }]; if (f.type === 'ref') { const earlier = m.tables.slice(0, ti).map(x => x.name); if (earlier.length) f.ref = pickOne(earlier); else f.type = 'num'; } }
        else if (op === 11 && t.fields.length > 1) { const [f1, f2] = [t.fields[0], t.fields[1]]; [f1.was, f2.was] = [f1.name, f2.name]; [f1.name, f2.name] = [f2.name, f1.name]; } // swap
        else if (op === 12 && t.fields.length) { const f = pickOne(t.fields); const back = gone.find(g => g.table === t.name); if (back && !t.fields.some(x => x.name === back.f.name)) { f.was = f.name; f.name = back.f.name; } } // rename onto an old name
        else if (op === 13 && m.settings.length) { const x = pickOne(m.settings); if (rnd() < 0.6) { x.was = x.name; } x.name = 'g' + (n++); }
        else if (op === 14) m.settings.push({ name: 'g' + (n++), type: pickOne(['num', 'text', 'money']) });
        src = prog(m);
      }
      const r = evolve(ever, src);
      stats.edits++;
      if (op === 15 && history.length > 1 && r.verdict !== 'restore') stats.violations.push({ c, st, why: `a restore was ${r.verdict}`, refused: r.refused });
      if (r.verdict === 'refused') { stats.refused++; if (JSON.stringify(r.ever) !== JSON.stringify(ever)) stats.violations.push({ c, st, why: 'refused edit changed the schema' }); continue; }
      if (r.verdict === 'restore') stats.restore++; else if (r.verdict === 'safe') stats.safe++; else continue;
      ever = r.ever;
      model = m;
      history.push({ src, model: JSON.parse(JSON.stringify(strip(m))) });
      // 1 + 2: every stored value keeps its slot and its type
      for (const key of Object.keys(store)) {
        const [kind, k, fk] = key.split('/');
        const slot = kind === 't' ? ever.tables[k]?.fields[fk] : ever.settings[k];
        if (!slot) { stats.violations.push({ c, st, why: `${key} lost from the schema`, src }); continue; }
        for (const vt of store[key]) if (!widens(vt, slot.type)) stats.violations.push({ c, st, why: `${key} holds ${vt.t} but its slot is ${slot.type.t}`, src });
      }
      // 3: reachability
      if (!reachable(ever.tables)) stats.violations.push({ c, st, why: 'a table slot has no name that reaches it', src });
      for (const T of Object.values(ever.tables)) if (!reachable(T.fields)) stats.violations.push({ c, st, why: 'a field slot has no name that reaches it', src });
      if (!reachable(ever.settings)) stats.violations.push({ c, st, why: 'a setting slot has no name that reaches it', src });
      // write values with the declared types (restores read old types; skip writing on restore)
      if (r.verdict !== 'safe') continue;
      const map = ever.versions[ever.versions.length - 1].map;
      for (const t2 of m.tables) {
        const k = map.tables[t2.name];
        for (const f of t2.fields) {
          const fk = map.fields[k][f.name];
          const declared = f.type === 'ref' ? { t: 'ref', table: map.tables[f.ref] } : { t: f.type };
          (store[`t/${k}/${fk}`] ||= []).push(declared);
        }
      }
      for (const x of m.settings) (store[`s/${map.settings[x.name]}`] ||= []).push({ t: x.type });
    }
  }
  return stats;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const t0 = Date.now();
  const r = runFuzz(+(process.argv[2] || 5000), +(process.argv[3] || 7));
  console.log(JSON.stringify({ ...r, violations: r.violations.length, firstViolations: r.violations.slice(0, 3), ms: Date.now() - t0 }));
  process.exit(r.violations.length ? 1 : 0);
}
