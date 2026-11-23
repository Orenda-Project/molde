// diff(history, newSrc): what an edit changes, and whether it is safe for the user's data.
//
// Stored data is keyed by STORAGE SLOTS, not by program names. The "ever" schema keeps every
// slot that has ever held data (tables, fields, settings, persisted states), visible or hidden,
// with its stored type and EVERY name it has had (and the version each name was last seen).
//
// - A name resolves to the slot last seen under that name (newest first). Two slots last seen
//   under one name in the same version is ambiguous and is refused.
// - `was` (table, field, setting, state, pick option) moves a slot to a new name. Renames inside
//   one edit happen at once, so swaps and rotations are fine; one slot claimed twice is refused.
// - A slot that disappears is HIDDEN; re-adding its name (same or wider type) shows it again;
//   another type is REFUSED. A slot that disappears while a new one of the same shape appears
//   is refused as "looks like a rename" (write `was`).
// - No accepted edit may leave a slot that no name can reach (every slot keeps at least one name
//   that still resolves to it).
// - Stored types only widen: text->long, pick->text/long, num<->money, date->when; a ref keeps its
//   target slot. Pick option values are never dropped: rows keep a removed option (it is no longer offered).
// - RESTORE: going back to an earlier version (its exact program text) is always allowed: the
//   version's own name->slot map is used, data entered since stays, slots unknown to it are hidden,
//   and widened values stay readable (the evaluator reads them with the old declared type).
import { check } from './check.mjs';
import { typeWords } from './describe.mjs';

const clone = x => JSON.parse(JSON.stringify(x));
export const emptySchema = () => ({ v: 0, tables: {}, settings: {}, states: {}, versions: [] });

const WIDER = { text: ['long'], pick: ['text', 'long'], num: ['money'], money: ['num'], date: ['when'] };
// may values stored as `a` be read as `b`?
export function widens(a, b) {
  if (a.t === b.t) return a.t !== 'ref' || a.table === b.table;
  return !!WIDER[a.t]?.includes(b.t);
}
const tw = t => t.t === 'ref' ? `a link to ${String(t.table).replace(/~\d+$/, '')}` : t.t === 'pick' ? 'a choice' : typeWords(t);

function programModel(src) {
  const r = check(src);
  if (!r.ok) return { errors: r.errors };
  const h = r.ast.header;
  if (!h || h.kind !== 'app') return { ask: true };
  return {
    header: h,
    tables: r.ast.body.filter(s => s.kind === 'table'),
    settings: r.ast.body.filter(s => s.kind === 'setting'),
    states: r.ast.body.filter(s => s.kind === 'state' && !s.draft),
    ast: r.ast,
  };
}

// the slot a name points at: last seen under that name, newest first
export function resolve(slots, name) {
  let best = null, bestV = -1, tie = false;
  for (const [k, s] of Object.entries(slots)) {
    if (s.visible === name) return { key: k };
    const v = s.seen?.[name];
    if (v === undefined) continue;
    if (v > bestV) { best = k; bestV = v; tie = false; } else if (v === bestV) tie = true;
  }
  if (tie) return { ambiguous: true };
  return best ? { key: best } : null;
}

function newKey(slots, name) {
  if (!slots[name]) return name;
  let i = 2; while (slots[`${name}~${i}`]) i++;
  return `${name}~${i}`;
}

// Assign declarations to slots (one group: the tables, the fields of one table, the settings, or
// the states). decl: {name, was, type (stored form), shape (for tables)}. Returns claims or problems.
// A `was` that the stored data already went through: the slot now called NAME got that name by
// its last rename, from OLD. Decided from the recorded storage state (slot.renamed), never from
// the program text, so a program that still says `b was a` (reloaded, re-submitted, or edited
// elsewhere) does not move the values again; this matters for swaps and rotations.
export function appliedRename(slots, d) {
  for (const [k, s] of Object.entries(slots)) if (s.visible === d.name && s.renamed && s.renamed.from === d.was && s.renamed.to === d.name) return k;
  return null;
}
function assign(slots, decls, what, ctx) {
  const claims = new Map(); // decl -> key
  const problems = [];
  const fresh = [];
  const wasTaken = new Set();
  const done = new Map(); // decl -> slot, for renames already applied
  for (const d of decls) if (d.was && d.was !== d.name) { const a = appliedRename(slots, d); if (a) { done.set(d, a); wasTaken.add(a); } }
  for (const d of decls) if (d.was && d.was !== d.name && !done.has(d)) { const r = resolve(slots, d.was); if (r && r.key) wasTaken.add(r.key); }
  for (const d of decls) {
    let k = null;
    if (done.has(d)) k = done.get(d);
    else if (d.was && d.was !== d.name) {
      const r = resolve(slots, d.was);
      if (r && r.ambiguous) { problems.push(`${what} ${d.name} was ${d.was}: more than one earlier set of values was last called ${d.was}; it is unclear which to move.`); continue; }
      if (r) k = r.key;
      else {
        const self = resolve(slots, d.name);
        if (self && self.key && slots[self.key].visible === d.name) k = self.key; // rename already done earlier
        else { problems.push(`${what} ${d.name} says it was ${d.was}, but there never was ${what === 'option' ? 'an option' : 'a ' + what} called ${d.was}.`); continue; }
      }
    } else {
      const r = resolve(slots, d.name);
      if (r && r.ambiguous) { problems.push(`more than one earlier ${what} was last called ${d.name}; write "${d.name} ... was OLD" with the name it had before to say which one to show.`); continue; }
      if (r && !wasTaken.has(r.key)) k = r.key; // its old values moved to another name with was: this is a new one
    }
    if (k) claims.set(d, k); else fresh.push(d);
  }
  // one slot claimed twice
  const by = new Map();
  for (const [d, k] of claims) {
    if (!by.has(k)) { by.set(k, d); continue; }
    const a = by.get(k);
    const viaOld = [a, d].find(x => !x.was && slots[k].visible !== x.name && slots[k].visible !== null);
    if (viaOld) problems.push(`${viaOld.name} is an earlier name of the ${what} now called ${slots[k].visible}, so a new ${what} cannot use it; pick another name (for example ${viaOld.name}2).`);
    else problems.push(`${what}s ${a.name} and ${d.name} both claim the values last called ${slots[k].visible || lastName(slots[k])}; only one can.`);
  }
  return { claims, fresh, problems };
}
// option -> the option it was renamed from by its last rename, replaying the option log of one field
export function optionFrom(log, table, field) {
  let from = {};
  for (const x of (log || []).filter(x => x.table === table && x.field === field).sort((a, b) => a.v - b.v)) {
    const nx = { ...from };
    for (const ol of Object.keys(x.map)) delete nx[ol];
    for (const [ol, nw] of Object.entries(x.map)) nx[nw] = ol;
    from = nx;
  }
  return from;
}
const lastName = s => Object.entries(s.seen || {}).sort((a, b) => b[1] - a[1])[0]?.[0];

// every slot must keep a name that resolves to it
function unreachable(slots) {
  const out = [];
  for (const [k, s] of Object.entries(slots)) {
    const names = Object.keys(s.seen || {});
    if (!names.some(n => { const r = resolve(slots, n); return r && r.key === k; })) out.push(k);
  }
  return out;
}

const sigOf = fields => fields.map(f => f.name + ':' + f.type.t).sort().join(',');

export function evolve(ever, src, opts = {}) {
  const changes = [], refused = [], notes = [];
  const m = programModel(src);
  if (m.errors) return { verdict: 'refused', changes, refused: m.errors.map(e => `the new program does not check: ${e}`), notes, ever, moves: [] };
  if (m.ask) return { verdict: 'ask', changes: ['asks a question instead of building'], refused, notes, ever, moves: [] };
  ever = { ...emptySchema(), ...ever };
  // going back to an earlier version: use that version's own map
  // going back to an earlier version is an explicit restore (chat Undo), not an edit that happens to match
  if (opts.restore) {
    // the version to go back to is named by its index (chat Undo knows it); the text alone can match several versions
    const byIndex = Number.isInteger(opts.version) && ever.versions[opts.version]?.src === src ? opts.version : -1;
    const old = byIndex >= 0 ? byIndex : ever.versions.map(x => x.src).lastIndexOf(src);
    if (old >= 0) return restoreVersion(ever, old, m);
    return { verdict: 'refused', changes, refused: ['restore: this program text is not an earlier version.'], notes, ever, moves: [] };
  }
  const E = clone(ever);
  E.v = (E.v || 0) + 1;
  const V = E.v;
  const moves = [];
  const edit = !opts.restore;

  // ---- tables ----
  const tdecl = m.tables.map(t => ({ name: t.name, was: t.was, t }));
  const ta = assign(E.tables, tdecl, 'table');
  refused.push(...ta.problems);
  const tkey = new Map();
  for (const [d, k] of ta.claims) tkey.set(d.name, k);
  for (const d of ta.fresh) { const k = newKey(E.tables, d.name); E.tables[k] = { seen: {}, visible: null, fields: {} }; tkey.set(d.name, k); changes.push(`adds table ${d.name}`); }
  const keyOf = name => tkey.get(name) || resolve(E.tables, name)?.key || name;
  const stype = type => type.t === 'ref' ? { t: 'ref', table: keyOf(type.table) } : type.t === 'pick' ? { t: 'pick', options: [...type.options] } : { t: type.t };
  const claimedT = new Set(tkey.values());
  for (const [k, s] of Object.entries(E.tables)) {
    if (s.visible === null || claimedT.has(k)) continue;
    const twin = ta.fresh.find(d => sigOf(d.t.fields) === sigOf(Object.values(s.fields).filter(f => f.visible !== null).map(f => ({ name: f.visible, type: f.decl || f.type }))) && d.t.fields.length);
    if (twin && edit) refused.push(`table ${s.visible} disappears and table ${twin.name} with the same fields appears: this looks like a rename. Write "table ${twin.name} was ${s.visible}" to move the rows, or remove ${s.visible} in a separate change.`);
    else changes.push(`hides table ${s.visible} (its rows are kept and come back if it returns)`);
    s.visible = null;
  }
  const warnings = [];
  for (const [d, k] of ta.claims) {
    const s = E.tables[k];
    if (s.visible !== d.name) {
      changes.push(s.visible ? `renames table ${s.visible} to ${d.name} (its rows move with it)` : `shows table ${d.name} again (its old rows come back)`);
      if (!s.visible && !d.was) warnings.push(`table ${d.name} was removed earlier; its old rows come back with it. If this is a new table, give it another name.`);
      if (d.was && d.was !== d.name) s.renamed = { from: d.was, to: d.name, v: V };
    }
  }

  // ---- fields of each table ----
  for (const t of m.tables) {
    const k = tkey.get(t.name);
    if (!k) continue;
    const T = E.tables[k];
    const wasVisible = ever.tables[k] && ever.tables[k].visible !== null;
    const fdecl = t.fields.map(f => ({ name: f.name, was: f.was, f, type: stype(f.type) }));
    const fa = assign(T.fields, fdecl, 'field');
    refused.push(...fa.problems.map(p => `${t.name}: ${p}`));
    const claimed = new Set(fa.claims.values());
    for (const [fk, s] of Object.entries(T.fields)) {
      if (s.visible === null || claimed.has(fk)) continue;
      const twin = fa.fresh.find(d => d.type.t === s.type.t);
      if (twin && edit && wasVisible) refused.push(`${t.name}.${s.visible} disappears and ${t.name}.${twin.name} of the same type appears: this looks like a rename. Write "${twin.name} ${twin.f.type.t === 'ref' ? 'ref ' + twin.f.type.table : twin.f.type.t === 'pick' ? 'pick ...' : twin.f.type.t} was ${s.visible}" to move the values, or remove the old field in a separate change.`);
      else changes.push(`hides field ${t.name}.${s.visible} (values are kept, not deleted)`);
      s.visible = null;
    }
    for (const d of fa.fresh) {
      const fk = newKey(T.fields, d.name);
      T.fields[fk] = { seen: {}, visible: null, type: d.type };
      fa.claims.set(d, fk);
      if (wasVisible || ever.tables[k]) {
        changes.push(`adds field ${t.name}.${d.name} (${tw(d.type)})${d.f.dflt ? '; old rows get the default' : '; old rows have it empty'}`);
        if (!d.f.optional && !d.f.dflt && d.f.type.t !== 'bool') notes.push(`${t.name}.${d.name} is required but has no default: rows added before this change have it empty, and the editor asks for it the next time such a row is edited.`);
      }
    }
    for (const [d, fk] of fa.claims) {
      const s = T.fields[fk];
      const st = s.type, ty = d.type;
      const prevDecl = s.decl;
      if (s.visible !== null && s.visible !== d.name && !fa.fresh.includes(d)) changes.push(`renames ${t.name}.${s.visible} to ${d.name} (values move with it)`);
      else if (s.visible === null && Object.keys(s.seen).length && !fa.fresh.includes(d)) changes.push(`shows ${t.name}.${d.name} again (its old values come back)`);
      if (!widens(st, ty)) {
        if (edit) { refused.push(`${t.name}.${d.name} would change from ${tw(st)} to ${tw(ty)}${s.visible === null && Object.keys(s.seen).length ? ' (it was hidden, with values stored as ' + tw(st) + ')' : ''}; stored values could be lost. Add a field with a new name instead.`); continue; }
      } else if (st.t !== ty.t) changes.push(`widens ${t.name}.${d.name} from ${tw(st)} to ${tw(ty)}`);
      // pick options: renames and drops
      let newType = widens(st, ty) && st.t !== ty.t ? ty : st;
      const renamedNow = d.was && d.was !== d.name && s.visible !== d.name ? { from: d.was, to: d.name, v: V } : s.renamed;
      if (st.t === 'pick' && ty.t === 'pick') {
        const ren = d.f.type.renames || {};
        const ever0 = st.options;
        const olds = Object.values(ren);
        const dupOld = olds.find((o, i) => olds.indexOf(o) !== i);
        if (dupOld) { refused.push(`${t.name}.${d.name}: two options say they were ${dupOld}; only one can.`); continue; }
        const map = {};
        let bad = false;
        const from = optionFrom(E.optionLog, k, fk); // option -> the name it had before its last rename
        for (const [nw, ol] of Object.entries(ren)) {
          if (from[nw] === ol) continue; // this rename is already in the stored rows
          if (!ever0.includes(ol)) {
            if (ever0.includes(nw)) continue; // rename already done
            refused.push(`${t.name}.${d.name}: option ${nw} says it was ${ol}, but there never was an option ${ol}.`); bad = true; continue;
          }
          const declared = (s.decl && s.decl.options) || ever0;
          if (declared.includes(nw) && !olds.includes(nw)) { refused.push(`${t.name}.${d.name}: option ${nw} was ${ol} would merge ${ol} into the existing option ${nw}; rename ${nw} too or pick another name.`); bad = true; continue; }
          map[ol] = nw;
        }
        if (bad) continue;
        if (Object.keys(map).length) {
          moves.push({ table: k, field: fk, map });
          E.optionLog = [...(E.optionLog || []), { v: V, table: k, field: fk, map }];
          for (const [ol, nw] of Object.entries(map)) changes.push(`renames option ${ol} of ${t.name}.${d.name} to ${nw} (rows move with it)`);
        }
        const mapped = ever0.map(o => map[o] || o);
        const added = ty.options.filter(o => !mapped.includes(o));
        if (added.length) changes.push(`adds options ${added.join(', ')} to ${t.name}.${d.name}`);
        for (const o of mapped) if (!ty.options.includes(o)) notes.push(`${t.name}.${d.name}: option ${o} is no longer listed. Rows that have it keep it and still show it, but it is not offered for new rows and formulas cannot name it. To rename it write "NEW was ${o}"; to keep it, list it again.`);
        newType = { t: 'pick', options: [...new Set([...ty.options, ...mapped])] };
      }
      if (prevDecl && s.visible !== null) {
        if (prevDecl.optional && !d.f.optional) notes.push(`${t.name}.${d.name} is now required; old empty values stay empty.`);
        if (JSON.stringify(prevDecl.range) !== JSON.stringify(d.f.range ?? null)) {
          changes.push(`changes the allowed range of ${t.name}.${d.name}`);
          const r = d.f.range, p = prevDecl.range;
          if (r && (!p || r.lo > p.lo || (r.hi !== null && (p.hi === null || r.hi < p.hi)))) notes.push(`${t.name}.${d.name}: the range is narrower now; old values outside it are kept as they are.`);
        }
      }
      T.fields[fk] = { ...s, renamed: renamedNow, type: newType, visible: d.name, seen: { ...s.seen, [d.name]: V }, decl: { t: d.f.type.t, optional: !!d.f.optional, range: d.f.range ?? null, ...(d.f.type.t === 'pick' ? { options: [...d.f.type.options] } : {}) } };
    }
    if (T.visible !== t.name) T.seen = { ...T.seen };
    T.visible = t.name; T.seen[t.name] = V;
    const lost = unreachable(T.fields);
    if (lost.length) refused.push(`${t.name}: this would leave the old values of ${lost.map(x => lastName(T.fields[x])).join(', ')} with no name to bring them back (another field now owns that name). Pick another name, or bring the old field back first.`);
  }
  const lostT = unreachable(Object.fromEntries(Object.entries(E.tables).filter(([, s]) => Object.keys(s.seen).length)));
  if (lostT.length) refused.push(`this would leave the old rows of table ${lostT.map(x => lastName(E.tables[x])).join(', ')} with no name to bring them back. Pick another table name.`);

  // ---- settings and persisted states ----
  for (const [group, list, what] of [['settings', m.settings, 'setting'], ['states', m.states, 'state']]) {
    const G = E[group];
    const decl = list.map(s => ({ name: s.name, was: s.was, s, type: stype(s.type) }));
    const ga = assign(G, decl, what);
    refused.push(...ga.problems);
    const claimed = new Set(ga.claims.values());
    for (const [k, s] of Object.entries(G)) {
      if (s.visible === null || claimed.has(k)) continue;
      const twin = ga.fresh.find(d => d.type.t === s.type.t);
      if (twin && edit) refused.push(`${what} ${s.visible} disappears and ${what} ${twin.name} of the same type appears: this looks like a rename, and the saved value would be reset. Write "${what} ${twin.name} ... was ${s.visible}" to keep it, or remove ${s.visible} in a separate change.`);
      else changes.push(`hides ${what} ${s.visible} (its value is kept)`);
      s.visible = null;
    }
    for (const d of ga.fresh) { const k = newKey(G, d.name); G[k] = { seen: {}, visible: null, type: d.type }; ga.claims.set(d, k); changes.push(`adds ${what} ${d.name}`); }
    for (const [d, k] of ga.claims) {
      const s = G[k];
      if (!widens(s.type, d.type)) { if (edit) { refused.push(`${what} ${d.name} would change from ${tw(s.type)} to ${tw(d.type)}. Add a ${what} with a new name instead.`); continue; } }
      if (s.visible !== null && s.visible !== d.name && Object.keys(s.seen).length) changes.push(`renames ${what} ${s.visible} to ${d.name} (its value is kept)`);
      else if (s.visible === null && Object.keys(s.seen).length) changes.push(`shows ${what} ${d.name} again (its value comes back)`);
      if (what === 'setting' && s.visible === d.name && s.label !== undefined && (s.label ?? null) !== (d.s.label ?? null)) changes.push(`renames the label of setting ${d.name}`);
      if (what === 'setting' && d.s.force && JSON.stringify(s.force ?? null) !== JSON.stringify(d.s.dflt)) changes.push(`sets the saved value of setting ${d.name} to ${d.s.dflt.v} (written on purpose with "set"; undo brings the old value back)`);
      else if (what === 'setting' && !d.s.force && s.visible === d.name && JSON.stringify(s.dflt ?? null) !== JSON.stringify(d.s.dflt ?? null)) notes.push(`setting ${d.name}: a new starting value only fills an empty setting; a value the user saved is kept. Add "set" to change it.`);
      G[k] = { ...s, renamed: d.was && d.was !== d.name && s.visible !== d.name ? { from: d.was, to: d.name, v: V } : s.renamed, type: widens(s.type, d.type) && s.type.t !== d.type.t ? d.type : s.type, visible: d.name, seen: { ...s.seen, [d.name]: V }, label: d.s.label ?? null, dflt: d.s.dflt ?? null, force: d.s.force ? d.s.dflt : null };
    }
    const lost = unreachable(G);
    if (lost.length) refused.push(`this would leave the saved value of ${what} ${lost.map(x => lastName(G[x])).join(', ')} with no name to bring it back. Pick another name.`);
  }

  if (refused.length) return { verdict: 'refused', changes, refused, notes, ever, moves: [] };
  E.versions = [...(ever.versions || []), { src, map: mapOf(E), v: V }];
  if (warnings.length) return { verdict: 'warn', warnings, changes, refused, notes, ever: E, moves };
  return { verdict: 'safe', changes, refused, notes, ever: E, moves };
}

// name -> slot map of the current visible schema
export function mapOf(E) {
  const tables = {}, fields = {};
  for (const [k, s] of Object.entries(E.tables)) if (s.visible !== null) {
    tables[s.visible] = k;
    fields[k] = {};
    for (const [fk, f] of Object.entries(s.fields)) if (f.visible !== null) fields[k][f.visible] = fk;
  }
  const g = G => Object.fromEntries(Object.entries(G).filter(([, s]) => s.visible !== null).map(([k, s]) => [s.visible, k]));
  return { tables, fields, settings: g(E.settings), states: g(E.states) };
}

function restoreVersion(ever, i, m) {
  const E = clone(ever);
  E.v += 1;
  const map = ever.versions[i].map;
  // undo every option rename made since that version, newest first, so rows read under the old options
  const since = ever.versions[i].v ?? 0;
  const moves = [];
  const log = (ever.optionLog || []).filter(x => x.v > since).reverse();
  for (const x of log) {
    const inv = Object.fromEntries(Object.entries(x.map).map(([a, b]) => [b, a]));
    moves.push({ table: x.table, field: x.field, map: inv });
    const f = E.tables[x.table]?.fields[x.field];
    if (f && f.type.t === 'pick') {
      f.type.options = [...new Set([...f.type.options, ...Object.keys(x.map)])];
      // the restored version declared the old names, not the new ones
      if (f.decl) f.decl.options = [...new Set([...(f.decl.options || f.type.options).filter(o => !(o in inv)), ...Object.keys(x.map)])];
    }
  }
  if (log.length) E.optionLog = (ever.optionLog || []).filter(x => x.v <= since);
  const changes = [`restores version ${i + 1} of ${ever.versions.length} (data entered since stays; fields it does not know are hidden)`];
  for (const [k, s] of Object.entries(E.tables)) {
    const name = Object.keys(map.tables).find(n => map.tables[n] === k) ?? null;
    if (s.visible !== null && name === null) changes.push(`hides table ${s.visible}`);
    if (s.visible !== name) delete s.renamed; // going back undoes that rename: writing it again applies it again
    s.visible = name; if (name) s.seen[name] = E.v;
    for (const [fk, f] of Object.entries(s.fields)) {
      const fn = name ? (Object.keys(map.fields[k] || {}).find(n => map.fields[k][n] === fk) ?? null) : null;
      if (f.visible !== null && fn === null && name) changes.push(`hides field ${name}.${f.visible}`);
      if (f.visible !== fn) delete f.renamed;
      f.visible = fn; if (fn) f.seen[fn] = E.v;
    }
  }
  for (const g of ['settings', 'states']) for (const [k, s] of Object.entries(E[g])) {
    const n = Object.keys(map[g]).find(x => map[g][x] === k) ?? null;
    if (s.visible !== n) delete s.renamed;
    s.visible = n; if (n) s.seen[n] = E.v;
  }
  E.versions = [...ever.versions, { src: ever.versions[i].src, map, v: E.v }];
  if (moves.length) changes.push(`moves rows back to the option names of that version (${moves.map(mv => Object.entries(mv.map).map(([a, b]) => `${a} to ${b}`).join(', ')).join('; ')})`);
  return { verdict: 'restore', changes, refused: [], notes: [], ever: E, moves, restoredFrom: i };
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

// the ever-schema after a list of accepted programs (oldest first); refused ones are skipped
export function everOf(history) {
  let ever = emptySchema();
  const used = [];
  for (const h of history) { const r = evolve(ever, h); if (r.verdict === 'safe' || r.verdict === 'warn' || r.verdict === 'restore') { ever = r.ever; used.push(true); } else used.push(false); }
  return { ever, used };
}

// history: the previous program text, or the list of every earlier accepted program (oldest first).
export function diff(history, newSrc, opts = {}) {
  const list = Array.isArray(history) ? history : [history];
  const { ever, used } = everOf(list);
  const r = evolve(ever, newSrc, opts);
  r.historyUsed = used;
  const prev = list[list.length - 1];
  const A = prev ? check(prev) : null, B = check(newSrc);
  if ((r.verdict === 'safe' || r.verdict === 'warn' || r.verdict === 'restore') && A && A.ast.header && A.ast.header.kind === 'app' && B.ok) {
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
  for (const w of r.warnings || []) out.push(`! warning: ${w}`);
  for (const c of r.changes) out.push(`- ${c}`);
  for (const x of r.refused) out.push(`! refused: ${x}`);
  for (const n of r.notes) out.push(`note: ${n}`);
  return out.join('\n') + '\n';
}
