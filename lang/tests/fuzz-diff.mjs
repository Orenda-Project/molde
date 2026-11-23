// Data-safety fuzz for diff.mjs. Random edit chains (add, drop, re-add with any type, retype,
// rename with and without `was`, table add/drop/rename, pick option add/drop/rename). Values are
// written into a simulated store after every accepted edit. Invariant: while the verdict says
// safe, no stored value ever becomes unreachable (its slot is kept in the schema history) and no
// stored value changes type (every stored value's type widens to the slot's type, and a visible
// field's declared type is reachable from what is stored).
// Usage: node lang/tests/fuzz-diff.mjs [chains=5000] [seed=7]
import { evolve, emptySchema } from '../diff.mjs';

// the fuzz's own copy of the widening rule (independent of diff.mjs, so a bug there cannot hide)
const WIDE = { text: ['long'], pick: ['text', 'long'], num: ['money'], money: ['num'], date: ['when'] };
const widens = (a, b) => a.t === b.t ? (a.t !== 'ref' || a.table === b.table) : !!(WIDE[a.t] || []).includes(b.t);

export function runFuzz(chains = 5000, seed = 7, steps = 6) {
  let s = seed;
  const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const ri = n => Math.floor(rnd() * n);
  const pickOne = xs => xs[ri(xs.length)];
  const TYPES = ['text', 'long', 'num', 'money', 'date', 'when', 'bool', 'time', 'dur', 'pick', 'ref'];
  const stats = { chains: 0, edits: 0, safe: 0, refused: 0, violations: [] };
  const prog = m => 'app "F"\n' + m.map(t => `table ${t.name}${t.was ? ' was ' + t.was : ''}${t.fields.length ? ' ' + t.fields.map(f => `${f.name} ${f.type === 'pick' ? 'pick ' + f.options.map(o => o.was ? `${o.v} was ${o.was}` : o.v).join('|') : f.type === 'ref' ? 'ref ' + f.ref : f.type}?${f.was ? ' was ' + f.was : ''}`).join(', ') : ''}`).join('\n') + '\n' + m.map(t => `list ${t.name}`).join('\n') + '\n';
  const strip = m => m.map(t => ({ name: t.name, fields: t.fields.map(f => ({ ...f, was: null, options: f.options && f.options.map(o => ({ v: o.v })) })) }));
  for (let c = 0; c < chains; c++) {
    stats.chains++;
    let ever = emptySchema();
    const store = {}; // key -> [type of each stored value]
    let model = [{ name: 'a', fields: [{ name: 'x', type: 'num' }, { name: 'y', type: 'pick', options: [{ v: 'A' }, { v: 'B' }] }] }, { name: 'b', fields: [{ name: 'z', type: 'text' }] }];
    let gone = []; // dropped fields {table, f}
    let n = 0;
    for (let st = 0; st < steps; st++) {
      const m = JSON.parse(JSON.stringify(strip(model)));
      const t = pickOne(m);
      const fresh = () => 'f' + (n++);
      const typ = () => pickOne(TYPES);
      const mk = (name, type, tIndex) => {
        const f = { name, type };
        if (type === 'pick') f.options = [{ v: 'A' }, { v: 'B' }, { v: 'C' }].slice(0, 2 + ri(2));
        if (type === 'ref') { const earlier = m.slice(0, m.indexOf(m[tIndex])).map(x => x.name); if (!earlier.length) f.type = 'text'; else f.ref = pickOne(earlier); }
        return f;
      };
      const op = ri(11);
      const ti = m.indexOf(t);
      if (op === 0) t.fields.push(mk(fresh(), typ(), ti));
      else if (op === 1 && t.fields.length) { const f = t.fields.splice(ri(t.fields.length), 1)[0]; gone.push({ table: t.name, f }); }
      else if (op === 2 && gone.length) { const g = pickOne(gone); const tt = m.find(x => x.name === g.table); if (tt && !tt.fields.some(f => f.name === g.f.name)) tt.fields.push(mk(g.f.name, rnd() < 0.5 ? g.f.type : typ(), m.indexOf(tt))); }
      else if (op === 3 && t.fields.length) { const i = ri(t.fields.length); t.fields[i] = mk(t.fields[i].name, typ(), ti); }
      else if (op === 4 && t.fields.length) { const f = pickOne(t.fields); f.was = f.name; f.name = fresh(); }
      else if (op === 5 && t.fields.length) { const f = pickOne(t.fields); f.name = fresh(); }
      else if (op === 6) { const old = t.name; t.was = rnd() < 0.7 ? old : null; t.name = 't' + (n++); for (const x of m) for (const f of x.fields) if (f.ref === old) f.ref = t.name; }
      else if (op === 7) m.push({ name: 't' + (n++), fields: [mk(fresh(), typ(), m.length)] });
      else if (op === 8 && m.length > 1) { const i = ri(m.length); const name = m[i].name; m.splice(i, 1); for (const x of m) x.fields = x.fields.filter(f => f.ref !== name); }
      else if (op === 9) { const f = t.fields.find(f => f.type === 'pick'); if (f) { const r = ri(3); if (r === 0) f.options.push({ v: 'O' + (n++) }); else if (r === 1 && f.options.length > 2) f.options.splice(ri(f.options.length), 1); else { const o = pickOne(f.options); o.was = o.v; o.v = 'O' + (n++); } } }
      else if (op === 10 && t.fields.length) { const f = pickOne(t.fields); f.type = typ(); if (f.type === 'pick') f.options = [{ v: 'A' }, { v: 'B' }]; if (f.type === 'ref') { const earlier = m.slice(0, ti).map(x => x.name); if (earlier.length) f.ref = pickOne(earlier); else f.type = 'num'; } }
      const src = prog(m);
      const r = evolve(ever, src);
      stats.edits++;
      if (r.verdict === 'refused') { stats.refused++; if (JSON.stringify(r.ever) !== JSON.stringify(ever)) stats.violations.push({ c, st, why: 'refused edit changed the schema' }); continue; }
      if (r.verdict !== 'safe') continue;
      stats.safe++;
      ever = r.ever;
      model = m;
      // invariants
      const seen = new Set();
      for (const [k, tb] of Object.entries(ever.tables)) for (const [fk, f] of Object.entries(tb.fields)) {
        const key = k + '/' + fk;
        for (const vt of store[key] || []) if (!widens(vt, f.type)) stats.violations.push({ c, st, why: `${key} holds ${vt.t} but its slot is ${f.type.t}`, src });
        if (f.visible !== null) { if (seen.has(key)) stats.violations.push({ c, st, why: 'two fields share a slot' }); seen.add(key); }
      }
      for (const key of Object.keys(store)) {
        const [k, fk] = key.split('/');
        if (!ever.tables[k] || !ever.tables[k].fields[fk]) stats.violations.push({ c, st, why: `${key} lost from the schema`, src });
      }
      // the program's declared types must be readable from storage
      for (const t2 of m) {
        const k = Object.keys(ever.tables).find(x => ever.tables[x].visible === t2.name);
        if (!k) { stats.violations.push({ c, st, why: `table ${t2.name} not mapped` }); continue; }
        for (const f of t2.fields) {
          const fk = Object.keys(ever.tables[k].fields).find(x => ever.tables[k].fields[x].visible === f.name);
          if (!fk) { stats.violations.push({ c, st, why: `field ${t2.name}.${f.name} not mapped` }); continue; }
          const declared = f.type === 'ref' ? { t: 'ref', table: Object.keys(ever.tables).find(x => ever.tables[x].visible === f.ref) } : { t: f.type };
          for (const vt of store[k + '/' + fk] || []) if (!widens(vt, declared)) stats.violations.push({ c, st, why: `${t2.name}.${f.name} declared ${declared.t} but holds ${vt.t}`, src });
          // write a value with the declared type
          (store[k + '/' + fk] ||= []).push(declared);
        }
      }
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
