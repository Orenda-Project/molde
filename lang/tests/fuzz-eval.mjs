// Evaluator edit-chain fuzz: real rows are stored, then a random chain of edits (renames with and
// without was, hide, re-add, retype, swaps, option renames, settings) and chat Undo (revert) is
// applied with app.applyEdit / app.revert. Invariant: every value stored before is still in its
// storage slot, unchanged (except option renames written with was, which move it), the slot is still
// in the schema with a type the value widens to, and some name (current or hidden) still reaches it.
// Usage: node lang/tests/fuzz-eval.mjs [chains=2000] [seed=3]
import { load } from '../eval.mjs';
import { resolve } from '../diff.mjs';

const WIDE = { text: ['long'], pick: ['text', 'long'], num: ['money'], money: ['num'], date: ['when'] };
const widens = (a, b) => a.t === b.t ? (a.t !== 'ref' || a.table === b.table) : !!(WIDE[a.t] || []).includes(b.t);

export function runEvalFuzz(chains = 2000, seed = 3, steps = 6) {
  let s = seed;
  const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const ri = n => Math.floor(rnd() * n);
  const one = xs => xs[ri(xs.length)];
  const TYPES = ['text', 'long', 'num', 'money', 'date', 'when', 'bool', 'time', 'dur', 'pick'];
  const fld = f => `${f.name} ${f.type === 'pick' ? 'pick ' + f.options.map(o => o.was ? `${o.v} was ${o.was}` : o.v).join('|') : f.type}?${f.was ? ' was ' + f.was : ''}`;
  const prog = m => 'app "E"\n' + m.tables.map(t => `table ${t.name}${t.was ? ' was ' + t.was : ''} ${t.fields.map(fld).join(', ')}`).join('\n') + '\n'
    + m.settings.map(x => `setting ${x.name} ${x.type}${x.was ? ' was ' + x.was : ''}`).join('\n') + '\n' + m.tables.map(t => `list ${t.name}`).join('\n') + '\n';
  const clean = m => JSON.parse(JSON.stringify({ tables: m.tables.map(t => ({ name: t.name, fields: t.fields.map(f => ({ name: f.name, type: f.type, options: f.options && f.options.map(o => ({ v: o.v })) })) })), settings: m.settings.map(x => ({ name: x.name, type: x.type })) }));
  const val = (f) => ({ text: 'x' + ri(9), long: 'long ' + ri(9), num: ri(100), money: ri(1000) / 4, date: '2026-11-0' + (1 + ri(9)), when: Date.parse('2026-11-20T08:00:00Z') + ri(5) * 3600000, bool: rnd() < 0.5, time: '0' + ri(9) + ':30', dur: ri(5000), pick: one(f.options || [{ v: 'A' }]).v }[f.type]);
  const stats = { chains: 0, edits: 0, applied: 0, refused: 0, reverts: 0, values: 0, violations: [] };
  for (let c = 0; c < chains; c++) {
    stats.chains++;
    let m = { tables: [{ name: 'a', fields: [{ name: 'x', type: 'num' }, { name: 'y', type: 'pick', options: [{ v: 'A' }, { v: 'B' }] }] }, { name: 'b', fields: [{ name: 'z', type: 'text' }] }], settings: [{ name: 'g', type: 'num' }] };
    const app = load(prog(m));
    const kept = []; // {tk, fk, id, raw, type}
    let n = 0;
    const write = () => {
      for (const t of m.tables) for (let i = 0; i < 2; i++) {
        const vals = {};
        for (const f of t.fields) vals[f.name] = app.fromInput(val(f), f.type === 'pick' ? { t: 'pick' } : { t: f.type });
        const r = app.addRow(t.name, vals);
        if (!r) continue;
        const tk = app.tk(t.name);
        for (const f of t.fields) { const fk = app.fk(t.name, f.name); if (r[fk] !== null && r[fk] !== undefined) { kept.push({ tk, fk, id: r.id, raw: r[fk], type: { t: f.type } }); stats.values++; } }
      }
    };
    write();
    for (let st = 0; st < steps; st++) {
      let r;
      if (ri(6) === 0 && st > 0) {
        r = app.revert(); stats.reverts++;
        if (r.verdict === 'refused') stats.violations.push({ c, st, why: 'revert refused' });
        for (const mv of r.moves || []) for (const k of kept) if (k.tk === mv.table && k.fk === mv.field && k.raw in mv.map) k.raw = mv.map[k.raw]; // a restore moves rows back to older option names
      }
      else {
        const nm = clean(m);
        const t = one(nm.tables);
        const op = ri(9);
        if (op === 0) t.fields.push({ name: 'f' + (n++), type: one(TYPES), options: [{ v: 'A' }, { v: 'C' }] });
        else if (op === 1 && t.fields.length > 1) t.fields.splice(ri(t.fields.length), 1);
        else if (op === 2) { const f = one(t.fields); f.was = f.name; f.name = 'f' + (n++); }
        else if (op === 3) { const f = one(t.fields); f.type = one(TYPES); f.options = [{ v: 'A' }, { v: 'B' }]; }
        else if (op === 4) { t.was = t.name; t.name = 't' + (n++); }
        else if (op === 5 && t.fields.length > 1) { const [p, q] = t.fields; [p.was, q.was] = [p.name, q.name]; [p.name, q.name] = [q.name, p.name]; }
        else if (op === 6) { const f = t.fields.find(f => f.type === 'pick'); if (f) { const o = one(f.options); o.was = o.v; o.v = 'O' + (n++); } }
        else if (op === 7) { const x = one(nm.settings); x.was = x.name; x.name = 'g' + (n++); }
        else if (op === 8) { const f = one(t.fields); f.name = 'f' + (n++); } // rename without was: refused or a new field
        r = app.applyEdit(prog(nm));
        stats.edits++;
        if (r.verdict === 'refused') { stats.refused++; continue; }
        stats.applied++;
        m = nm;
        for (const mv of r.moves || []) for (const k of kept) if (k.tk === mv.table && k.fk === mv.field && k.raw in mv.map) k.raw = mv.map[k.raw];
      }
      // re-derive the model from the running program (a revert changes it)
      m = clean({ tables: app.prog.body.filter(x => x.kind === 'table').map(x => ({ name: x.name, fields: x.fields.map(f => ({ name: f.name, type: f.type.t, options: f.type.options && f.type.options.map(v => ({ v })) })) })), settings: app.prog.body.filter(x => x.kind === 'setting').map(x => ({ name: x.name, type: x.type.t })) });
      for (const k of kept) {
        const row = (app.data.tables[k.tk] || []).find(r => r.id === k.id);
        const slot = app.ever.tables[k.tk]?.fields[k.fk];
        if (!row) { stats.violations.push({ c, st, why: `row ${k.id} of ${k.tk} is gone` }); continue; }
        if (JSON.stringify(row[k.fk]) !== JSON.stringify(k.raw)) stats.violations.push({ c, st, why: `${k.tk}.${k.fk} changed from ${JSON.stringify(k.raw)} to ${JSON.stringify(row[k.fk])}` });
        if (!slot) { stats.violations.push({ c, st, why: `slot ${k.tk}.${k.fk} is gone` }); continue; }
        if (!widens(k.type, slot.type)) stats.violations.push({ c, st, why: `${k.tk}.${k.fk} holds ${k.type.t} but its slot is ${slot.type.t}` });
        if (!Object.keys(slot.seen).some(nm => resolve(app.ever.tables[k.tk].fields, nm)?.key === k.fk)) stats.violations.push({ c, st, why: `${k.tk}.${k.fk} has no name that reaches it` });
        // a visible field must be readable by the running program
        const vis = slot.visible && app.prog.body.find(x => x.kind === 'table' && app.tk(x.name) === k.tk);
        if (vis) { const fd = vis.fields.find(f => f.name === slot.visible); try { app.wrap(row[k.fk], fd.type); } catch (e) { stats.violations.push({ c, st, why: `reading ${k.tk}.${k.fk} threw ${e.message}` }); } }
      }
      write();
    }
  }
  return stats;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const t0 = Date.now();
  const r = runEvalFuzz(+(process.argv[2] || 2000), +(process.argv[3] || 3));
  console.log(JSON.stringify({ ...r, violations: r.violations.length, firstViolations: r.violations.slice(0, 3), ms: Date.now() - t0 }));
  process.exit(r.violations.length ? 1 : 0);
}
