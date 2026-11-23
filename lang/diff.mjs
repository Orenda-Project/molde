// diff(oldSrc, newSrc): what an edit changes, and whether it is safe for the user's data.
// Rules: a new table or field is fine (old rows get the default or stay empty); a table, field
// or setting that disappears is HIDDEN, never dropped (its data stays and comes back if the
// field returns); a field whose stored type changes is REFUSED, except the widenings below.
import { check } from './check.mjs';
import { typeWords } from './describe.mjs';

// Changes of stored type that keep every old value valid.
function widening(a, b) {
  if (a.t === b.t) {
    if (a.t === 'pick') return b.options.length >= a.options.length && a.options.every(o => b.options.includes(o)) ? 'same' : 'options-removed';
    if (a.t === 'ref') return a.table === b.table ? 'same' : null;
    return 'same';
  }
  const ok = { text: ['long'], pick: ['text', 'long'], num: ['money'], money: ['num'], date: ['when'] };
  return ok[a.t]?.includes(b.t) ? 'widen' : null;
}

function model(prog) {
  const tables = new Map(); const settings = new Map();
  for (const s of prog.body) {
    if (s.kind === 'table') tables.set(s.name, s);
    if (s.kind === 'setting') settings.set(s.name, s);
  }
  return { tables, settings };
}

function uiLines(prog) {
  const out = [];
  const walk = (s, d) => {
    if (['table', 'setting'].includes(s.kind)) return;
    out.push('  '.repeat(d) + s.src);
    if (s.kind !== 'use') (s.children || []).forEach(c => walk(c, d + 1)); // a component counts as its one call line
  };
  prog.body.forEach(s => walk(s, 0));
  return out;
}

export function diff(oldSrc, newSrc) {
  const A = check(oldSrc), B = check(newSrc);
  const changes = []; const refused = []; const notes = [];
  if (!B.ok) {
    return { verdict: 'refused', changes, refused: B.errors.map(e => `the new program does not check: ${e}`), notes };
  }
  if (!A.ast.header || A.ast.header.kind !== 'app' || B.ast.header.kind !== 'app') {
    return { verdict: B.ast.header.kind === 'ask' ? 'ask' : 'safe', changes: ['new program'], refused, notes };
  }
  const ha = A.ast.header, hb = B.ast.header;
  if (ha.name !== hb.name) changes.push(`renames the app from "${ha.name}" to "${hb.name}"`);
  if (ha.icon !== hb.icon) changes.push(`changes the icon to ${hb.icon ?? 'none'}`);
  if (ha.theme !== hb.theme) changes.push(`changes the theme to ${hb.theme ?? 'default'}`);

  const ma = model(A.ast), mb = model(B.ast);
  for (const [name, t] of mb.tables) if (!ma.tables.has(name)) changes.push(`adds table ${name}`);
  for (const [name, t] of ma.tables) {
    const n = mb.tables.get(name);
    if (!n) { changes.push(`hides table ${name} (its rows are kept and come back if it returns)`); continue; }
    const fa = new Map(t.fields.map(f => [f.name, f])), fb = new Map(n.fields.map(f => [f.name, f]));
    const added = [...fb.keys()].filter(k => !fa.has(k)), gone = [...fa.keys()].filter(k => !fb.has(k));
    for (const k of added) {
      const f = fb.get(k);
      changes.push(`adds field ${name}.${k} (${typeWords(f.type)})${f.dflt ? '; old rows get the default' : '; old rows have it empty'}`);
    }
    for (const k of gone) changes.push(`hides field ${name}.${k} (values are kept, not deleted)`);
    if (added.length && gone.length) for (const g of gone) for (const a of added) if (fa.get(g).type.t === fb.get(a).type.t) notes.push(`${name}.${g} -> ${name}.${a} looks like a rename; old values stay under ${g} (hidden) and are not moved`);
    for (const [k, f] of fa) {
      const g = fb.get(k); if (!g) continue;
      const w = widening(f.type, g.type);
      if (w === null) refused.push(`${name}.${k} would change from ${typeWords(f.type)} to ${typeWords(g.type)}; stored values could be lost. Add a new field instead.`);
      else if (w === 'widen') changes.push(`widens ${name}.${k} from ${typeWords(f.type)} to ${typeWords(g.type)}`);
      else if (w === 'options-removed') changes.push(`changes the options of ${name}.${k}; rows that used a removed option keep it`);
      else if (f.type.t === 'pick' && g.type.options.length > f.type.options.length) changes.push(`adds options to ${name}.${k}`);
      if (f.optional && !g.optional) notes.push(`${name}.${k} is now required; old empty values stay empty`);
      if (!f.optional && g.optional) changes.push(`makes ${name}.${k} optional`);
      if (JSON.stringify(f.range) !== JSON.stringify(g.range)) changes.push(`changes the allowed range of ${name}.${k}${g.range ? '' : ' (no limit now)'}; old values are kept even if outside it`);
      if (f.label !== g.label || f.unit !== g.unit) changes.push(`renames the label or unit of ${name}.${k}`);
    }
  }
  for (const [name, s] of mb.settings) if (!ma.settings.has(name)) changes.push(`adds setting ${name}`);
  for (const [name, s] of ma.settings) {
    const n = mb.settings.get(name);
    if (!n) { changes.push(`hides setting ${name} (its value is kept)`); continue; }
    if (widening(s.type, n.type) === null) refused.push(`setting ${name} would change from ${typeWords(s.type)} to ${typeWords(n.type)}. Add a new setting instead.`);
    if (s.label !== n.label) changes.push(`renames the label of setting ${name}`);
    if (JSON.stringify(s.dflt) !== JSON.stringify(n.dflt)) changes.push(`changes the starting value of setting ${name} (a value the user already set is kept)`);
  }

  // UI: lines added or removed (as a multiset of indented canonical lines)
  const la = uiLines(A.ast), lb = uiLines(B.ast);
  const count = xs => xs.reduce((m, x) => m.set(x, (m.get(x) || 0) + 1), new Map());
  const ca = count(la), cb = count(lb);
  for (const [l, n] of cb) for (let i = (ca.get(l) || 0); i < n; i++) changes.push(`adds: ${l.trim()}`);
  for (const [l, n] of ca) for (let i = (cb.get(l) || 0); i < n; i++) changes.push(`removes from the screen: ${l.trim()}`);

  return { verdict: refused.length ? 'refused' : 'safe', changes, refused, notes };
}

export function diffText(r) {
  const out = [`verdict: ${r.verdict}`];
  for (const c of r.changes) out.push(`- ${c}`);
  for (const x of r.refused) out.push(`! refused: ${x}`);
  for (const n of r.notes) out.push(`note: ${n}`);
  return out.join('\n') + '\n';
}
