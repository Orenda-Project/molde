// diff(history, newSrc): what an edit changes, and whether it is safe for the user's data.
//
// The verdict is computed against the FULL schema history ("ever" schema), not only the previous
// version: every table and field that has ever stored data keeps a storage slot with its stored
// type, visible or hidden. Rules:
// - a new table or field gets a new slot (old rows have it empty, or the default);
// - a table, field or setting that disappears is HIDDEN, never dropped; re-adding it with the
//   same (or a wider) type shows the old data again; re-adding it with another type is REFUSED;
// - renames must be written: `table drinks was drink`, `amount num was ml`, `pick Meals was Food|...`;
//   they move the data. A table or field that disappears while a new one with the same shape
//   appears in the same edit is REFUSED as "looks like a rename";
// - a stored type may only widen: text->long, pick->text/long, num<->money, date->when; a ref keeps
//   its target table (renames of the target follow automatically);
// - a pick option that disappears stays available (rows keep it and it stays selectable and
//   filterable); `New was Old` moves rows from Old to New.
import { check } from './check.mjs';
import { typeWords } from './describe.mjs';

const clone = x => JSON.parse(JSON.stringify(x));
export const emptySchema = () => ({ tables: {}, settings: {} });

// stored type of a declared type, with ref targets as storage keys
function stype(type, tableKey) {
  if (type.t === 'ref') return { t: 'ref', table: tableKey(type.table) };
  if (type.t === 'pick') return { t: 'pick', options: [...type.options] };
  return { t: type.t };
}
const WIDER = { text: ['long'], pick: ['text', 'long'], num: ['money'], money: ['num'], date: ['when'] };
// may values stored as `a` be read as `b`?
export function widens(a, b) {
  if (a.t === b.t) return a.t !== 'ref' || a.table === b.table;
  return !!WIDER[a.t]?.includes(b.t);
}
const tw = t => t.t === 'ref' ? `a link to ${t.table}` : t.t === 'pick' ? 'a choice' : typeWords(t);
const sameShape = (a, b) => {
  const sig = fs => fs.map(f => f.name + ':' + f.type.t).sort().join(',');
  return sig(a) === sig(b) && a.length > 0;
};

function programModel(src) {
  const r = check(src);
  if (!r.ok) return { errors: r.errors };
  const h = r.ast.header;
  if (!h || h.kind !== 'app') return { ask: true };
  return { header: h, tables: r.ast.body.filter(s => s.kind === 'table'), settings: r.ast.body.filter(s => s.kind === 'setting'), ast: r.ast };
}

// Apply a new program to the ever-schema. Returns the verdict and the next ever-schema.
export function evolve(ever, src) {
  const changes = [], refused = [], notes = [];
  const m = programModel(src);
  if (m.errors) return { verdict: 'refused', changes, refused: m.errors.map(e => `the new program does not check: ${e}`), notes, ever };
  if (m.ask) return { verdict: 'ask', changes: ['asks a question instead of building'], refused, notes, ever };
  const E = clone(ever);
  const visibleT = name => Object.keys(E.tables).find(k => E.tables[k].visible === name);
  const hiddenT = name => Object.keys(E.tables).find(k => E.tables[k].visible === null && E.tables[k].last === name);

  // 1. tables -> storage keys
  const tkey = new Map(); // program table name -> storage key
  const fresh = [];
  for (const t of m.tables) {
    let k = null;
    if (t.was && !visibleT(t.was) && !hiddenT(t.was) && visibleT(t.name)) k = visibleT(t.name); // rename already done earlier
    else if (t.was) {
      k = visibleT(t.was) || hiddenT(t.was);
      if (!k) { refused.push(`table ${t.name} says it was ${t.was}, but there was no table ${t.was}.`); continue; }
      if (k === visibleT(t.name)) { refused.push(`table ${t.name} cannot be renamed from ${t.was} because ${t.name} already exists.`); continue; }
      changes.push(`renames table ${t.was} to ${t.name} (its rows move with it)`);
    } else if (visibleT(t.name)) k = visibleT(t.name);
    else if (hiddenT(t.name)) { k = hiddenT(t.name); changes.push(`shows table ${t.name} again (its old rows come back)`); }
    else { k = E.tables[t.name] ? `${t.name}~${Object.keys(E.tables).length}` : t.name; fresh.push(t); }
    if ([...tkey.values()].includes(k)) { refused.push(`two tables would use the same stored data (${t.name}).`); continue; }
    tkey.set(t.name, k);
  }
  const keyOf = name => tkey.get(name) || visibleT(name) || name;
  const goneT = Object.keys(E.tables).filter(k => E.tables[k].visible !== null && ![...tkey.values()].includes(k));
  for (const k of goneT) {
    const old = E.tables[k];
    const twin = fresh.find(t => sameShape(t.fields.map(f => ({ name: f.name, type: f.type })), Object.entries(old.fields).filter(([, f]) => f.visible !== null).map(([, f]) => ({ name: f.visible, type: f.type }))));
    if (twin) refused.push(`table ${old.visible} disappears and table ${twin.name} with the same fields appears: this looks like a rename. Write "table ${twin.name} was ${old.visible}" to move the rows, or remove ${old.visible} in a separate change.`);
    else changes.push(`hides table ${old.visible} (its rows are kept and come back if it returns)`);
  }
  for (const t of fresh) changes.push(`adds table ${t.name}`);

  // 2. fields of each table
  const nextTables = {};
  for (const t of m.tables) {
    const k = tkey.get(t.name);
    if (!k) continue;
    const old = E.tables[k] || { fields: {}, visible: null, last: t.name };
    const F = clone(old.fields);
    const visF = name => Object.keys(F).find(x => F[x].visible === name);
    const hidF = name => Object.keys(F).find(x => F[x].visible === null && F[x].last === name);
    const used = new Set();
    const freshF = [];
    const placed = [];
    for (const f of t.fields) {
      const ty = stype(f.type, keyOf);
      let fk = null;
      if (f.was && !visF(f.was) && !hidF(f.was) && visF(f.name)) fk = visF(f.name); // rename already done
      else if (f.was) {
        fk = visF(f.was) || hidF(f.was);
        if (!fk) { refused.push(`${t.name}.${f.name} says it was ${f.was}, but ${t.name} had no field ${f.was}.`); continue; }
        changes.push(`renames ${t.name}.${f.was} to ${f.name} (values move with it)`);
      } else if (visF(f.name)) fk = visF(f.name);
      else if (hidF(f.name)) { fk = hidF(f.name); if (widens(F[fk].type, ty)) changes.push(`shows ${t.name}.${f.name} again (its old values come back)`); }
      if (fk && used.has(fk)) { refused.push(`two fields of ${t.name} would use the same stored values.`); continue; }
      if (fk) {
        const st = F[fk].type;
        if (!widens(st, ty)) { refused.push(`${t.name}.${f.name} would change from ${tw(st)} to ${tw(ty)}${F[fk].visible === null ? ' (it was hidden, with values stored as ' + tw(st) + ')' : ''}; stored values could be lost. Add a field with a new name instead.`); continue; }
        if (st.t !== ty.t) changes.push(`widens ${t.name}.${f.name} from ${tw(st)} to ${tw(ty)}`);
        if (st.t === 'pick' && ty.t === 'pick') {
          const renames = f.type.renames || {};
          for (const [nw, ol] of Object.entries(renames)) if (st.options.includes(ol)) changes.push(`renames option ${ol} of ${t.name}.${f.name} to ${nw} (rows move with it)`);
          const before = new Set(st.options.filter(o => !Object.values(renames).includes(o)));
          const added = ty.options.filter(o => !st.options.includes(o) && !renames[o]);
          const dropped = [...before].filter(o => !ty.options.includes(o));
          if (added.length) changes.push(`adds options ${added.join(', ')} to ${t.name}.${f.name}`);
          for (const o of dropped) notes.push(`${t.name}.${f.name}: option ${o} is no longer listed, but rows keep it and it stays selectable and filterable. To rename it write "NEW was ${o}".`);
          ty.options = [...new Set([...ty.options, ...dropped])];
        }
      } else {
        fk = F[f.name] ? `${f.name}~${Object.keys(F).length}` : f.name;
        freshF.push(f);
        F[fk] = { type: ty, visible: null, last: f.name };
      }
      used.add(fk);
      placed.push([f, fk, ty]);
    }
    const goneF = Object.keys(F).filter(x => old.fields[x] && old.fields[x].visible !== null && !used.has(x));
    for (const x of goneF) {
      const twin = freshF.find(f => stype(f.type, keyOf).t === F[x].type.t);
      if (twin && old.visible !== null) refused.push(`${t.name}.${F[x].visible} disappears and ${t.name}.${twin.name} of the same type appears: this looks like a rename. Write "${twin.name} ${twin.type.t === 'ref' ? 'ref ' + twin.type.table : twin.type.t} was ${F[x].visible}" to move the values, or remove the old field in a separate change.`);
      else changes.push(`hides field ${t.name}.${F[x].visible} (values are kept, not deleted)`);
      F[x].visible = null;
    }
    for (const [f, fk, ty] of placed) {
      const isNew = freshF.includes(f);
      if (isNew && old.visible !== null) {
        changes.push(`adds field ${t.name}.${f.name} (${tw(ty)})${f.dflt ? '; old rows get the default' : '; old rows have it empty'}`);
        if (!f.optional && !f.dflt && f.type.t !== 'bool') notes.push(`${t.name}.${f.name} is required but has no default: rows added before this change have it empty, and the editor asks for it the next time such a row is edited.`);
      }
      const prev = old.fields[fk];
      if (prev && prev.visible !== null && !isNew) {
        const pf = prev.decl || {};
        if (pf.optional && !f.optional) notes.push(`${t.name}.${f.name} is now required; old empty values stay empty.`);
        if (!pf.optional && f.optional) changes.push(`makes ${t.name}.${f.name} optional`);
        if (JSON.stringify(pf.range) !== JSON.stringify(f.range ?? null)) {
          changes.push(`changes the allowed range of ${t.name}.${f.name}`);
          if (f.range && (!pf.range || f.range.lo > pf.range.lo || (f.range.hi !== null && (pf.range.hi === null || f.range.hi < pf.range.hi)))) notes.push(`${t.name}.${f.name}: the range is narrower now; old values outside it are kept as they are.`);
        }
        if ((pf.label ?? null) !== (f.label ?? null) || (pf.unit ?? null) !== (f.unit ?? null)) changes.push(`renames the label or unit of ${t.name}.${f.name}`);
      }
      // the stored type only ever widens
      const st = F[fk].type;
      F[fk] = { type: st.t === ty.t ? (ty.t === 'pick' ? { t: 'pick', options: [...new Set([...st.options, ...ty.options])] } : st) : ty, visible: f.name, last: f.name, decl: { optional: f.optional, range: f.range ?? null, label: f.label ?? null, unit: f.unit ?? null } };
    }
    nextTables[k] = { fields: F, visible: t.name, last: t.name };
  }
  for (const k of Object.keys(E.tables)) if (!nextTables[k]) {
    const old = E.tables[k];
    nextTables[k] = { ...old, visible: null };
    for (const f of Object.values(nextTables[k].fields)) f.visible = f.visible === null ? null : f.visible; // field slots stay
  }

  // 3. settings (one value each)
  const S = clone(E.settings);
  const usedS = new Set();
  for (const s of m.settings) {
    const ty = stype(s.type, keyOf);
    let k = s.was ? (Object.keys(S).find(x => S[x].last === s.was) || Object.keys(S).find(x => S[x].visible === s.name)) : (Object.keys(S).find(x => S[x].visible === s.name) || Object.keys(S).find(x => S[x].visible === null && S[x].last === s.name));
    if (s.was && !k) { refused.push(`setting ${s.name} says it was ${s.was}, but there was no setting ${s.was}.`); continue; }
    if (k) {
      if (!widens(S[k].type, ty)) { refused.push(`setting ${s.name} would change from ${tw(S[k].type)} to ${tw(ty)}. Add a setting with a new name instead.`); continue; }
      if (S[k].visible === null) changes.push(`shows setting ${s.name} again (its value comes back)`);
      if (s.was) changes.push(`renames setting ${s.was} to ${s.name}`);
      if ((S[k].label ?? null) !== (s.label ?? null) && S[k].visible !== null) changes.push(`renames the label of setting ${s.name}`);
      if (JSON.stringify(S[k].dflt ?? null) !== JSON.stringify(s.dflt ?? null) && S[k].visible !== null) changes.push(`changes the starting value of setting ${s.name} (a value the user already set is kept)`);
    } else { k = S[s.name] ? `${s.name}~${Object.keys(S).length}` : s.name; changes.push(`adds setting ${s.name}`); }
    usedS.add(k);
    S[k] = { type: S[k] && S[k].type.t === ty.t ? S[k].type : ty, visible: s.name, last: s.name, label: s.label ?? null, dflt: s.dflt ?? null };
  }
  for (const k of Object.keys(S)) if (!usedS.has(k) && S[k].visible !== null) { changes.push(`hides setting ${S[k].visible} (its value is kept)`); S[k].visible = null; }

  const next = { tables: nextTables, settings: S };
  return { verdict: refused.length ? 'refused' : 'safe', changes, refused, notes, ever: refused.length ? ever : next };
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

// history: the previous program text, or the list of every earlier accepted program (oldest first).
export function diff(history, newSrc) {
  const list = Array.isArray(history) ? history : [history];
  let ever = emptySchema();
  for (const h of list) { const r = evolve(ever, h); if (r.verdict === 'safe') ever = r.ever; }
  const r = evolve(ever, newSrc);
  const prev = list[list.length - 1];
  const A = prev ? check(prev) : null, B = check(newSrc);
  if (r.verdict === 'safe' && A && A.ast.header && A.ast.header.kind === 'app' && B.ok) {
    const ha = A.ast.header, hb = B.ast.header;
    const head = [];
    if (ha.name !== hb.name) head.push(`renames the app from "${ha.name}" to "${hb.name}"`);
    if (ha.icon !== hb.icon) head.push(`changes the icon to ${hb.icon ?? 'none'}`);
    if (ha.theme !== hb.theme) head.push(`changes the theme to ${hb.theme ?? 'default'}`);
    const la = uiLines(A.ast), lb = uiLines(B.ast);
    const count = xs => xs.reduce((m, x) => m.set(x, (m.get(x) || 0) + 1), new Map());
    const ca = count(la), cb = count(lb);
    const ui = [];
    for (const [l, n] of cb) for (let i = (ca.get(l) || 0); i < n; i++) ui.push(`adds: ${l.trim()}`);
    for (const [l, n] of ca) for (let i = (cb.get(l) || 0); i < n; i++) ui.push(`removes from the screen: ${l.trim()}`);
    r.changes = [...head, ...r.changes, ...ui];
  }
  return r;
}

export function diffText(r) {
  const out = [`verdict: ${r.verdict}`];
  for (const c of r.changes) out.push(`- ${c}`);
  for (const x of r.refused) out.push(`! refused: ${x}`);
  for (const n of r.notes) out.push(`note: ${n}`);
  return out.join('\n') + '\n';
}
