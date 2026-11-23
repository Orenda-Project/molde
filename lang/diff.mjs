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
import { strip } from './format.mjs';
export const FORMAT = 6; // round 6: stored text without was, option slots, maps per version

const clone = x => JSON.parse(JSON.stringify(x));
export const emptySchema = () => ({ format: FORMAT, v: 0, tables: {}, settings: {}, states: {}, versions: [] });

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

// Assign declarations to slots (one group: the tables, the fields of one table, the options of one
// pick field, the settings, or the states). decl: {name, was}. `was` is an instruction of THIS edit
// only: `X was Y` takes the slot the previous program calls Y (all clauses at once, so swaps and
// rotations work). A Y the previous program does not have makes the clause a no-op. Names without
// `was` resolve to the slot last seen under that name (a hidden slot comes back).
function assign(slots, decls, what, lenient = false) {
  const claims = new Map(); // decl -> key
  const problems = [], fresh = [], noop = [];
  const wasKey = new Map();
  for (const d of decls) if (d.was && d.was !== d.name) {
    const k = Object.keys(slots).find(x => slots[x].visible === d.was);
    if (k) wasKey.set(d, k); else noop.push(d);
  }
  const wasTaken = new Set(wasKey.values());
  for (const d of decls) {
    let k = null;
    if (wasKey.has(d)) k = wasKey.get(d);
    else {
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
    if (lenient) { const x = [a, d].find(y => slots[k].visible !== y.name) || d; claims.delete(x); fresh.push(x); if (x === a) by.set(k, d); continue; } // loading: the other one starts empty
    const viaOld = [a, d].find(x => !wasKey.has(x) && slots[k].visible !== x.name && slots[k].visible !== null);
    if (viaOld) problems.push(`${viaOld.name} is an earlier name of the ${what} now called ${slots[k].visible}, so a new ${what} cannot use it; pick another name (for example ${viaOld.name}2).`);
    else problems.push(`${what}s ${a.name} and ${d.name} both claim the values last called ${slots[k].visible || lastName(slots[k])}; only one can.`);
  }
  return { claims, fresh, problems, noop };
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
  const loadOpt = opts.load;
  const changes = [], refused = [], notes = [], warnings = [];
  const m = programModel(src);
  if (m.errors) return { verdict: 'refused', changes, refused: m.errors.map(e => `the new program does not check: ${e}`), notes, ever, moves: [] };
  if (m.ask) return { verdict: 'ask', changes: ['asks a question instead of building'], refused, notes, ever, moves: [] };
  ever = { ...emptySchema(), ...ever, format: FORMAT };
  const stored = strip(src);
  // going back (or forward) to a recorded version: that version's own text and map; nothing is recomputed
  if (opts.restore) {
    const byIndex = Number.isInteger(opts.version) && ever.versions[opts.version]?.src === stored ? opts.version : -1;
    const old = byIndex >= 0 ? byIndex : ever.versions.map(x => x.src).lastIndexOf(stored);
    if (old >= 0) return restoreVersion(ever, old);
    return { verdict: 'refused', changes, refused: ['restore: this program text is not a recorded version.'], notes, ever, moves: [] };
  }
  // the stored text again (a reload, a re-submit): nothing changes
  const cur = ever.versions[ever.versions.length - 1];
  if (cur && cur.src === src) return { verdict: 'safe', changes, refused, notes, ever, moves: [] };
  const E = clone(ever);
  E.v = (E.v || 0) + 1;
  const V = E.v;
  const edit = !opts.replay && !opts.load; // replaying history or loading a newer program into an old backup never refuses a rename-like change
  const unsure = (what, a, b) => { if (opts.load) warnings.push(`${what} ${a} is gone and ${b} is new; without the edit that made this change it is not known whether ${b} is ${a} renamed, so ${b} starts empty and ${a}'s values are kept hidden.`); };
  const noopNote = (what, d, fresh) => (fresh ? warnings : notes).push(`${what} ${d.name} was ${d.was} changes nothing: the program before this edit has no ${what} ${d.was}${fresh ? `, so ${d.name} starts empty` : ''}.`);

  // ---- tables ----
  const tdecl = m.tables.map(t => ({ name: t.name, was: t.was, t }));
  const ta = assign(E.tables, tdecl, 'table', !!opts.load);
  refused.push(...ta.problems);
  for (const d of ta.noop) noopNote('table', d, ta.fresh.includes(d));
  const tkey = new Map();
  for (const [d, k] of ta.claims) tkey.set(d.name, k);
  for (const d of ta.fresh) { const k = newKey(E.tables, d.name); E.tables[k] = { seen: {}, visible: null, fields: {} }; tkey.set(d.name, k); changes.push(`adds table ${d.name}`); }
  const keyOf = name => tkey.get(name) || resolve(E.tables, name)?.key || name;
  const stype = type => type.t === 'ref' ? { t: 'ref', table: keyOf(type.table) } : type.t === 'pick' ? { t: 'pick' } : { t: type.t };
  const claimedT = new Set(tkey.values());
  for (const [k, s] of Object.entries(E.tables)) {
    if (s.visible === null || claimedT.has(k)) continue;
    const twin = ta.fresh.find(d => sigOf(d.t.fields) === sigOf(Object.values(s.fields).filter(f => f.visible !== null).map(f => ({ name: f.visible, type: f.decl || f.type }))) && d.t.fields.length);
    if (twin && edit) refused.push(`table ${s.visible} disappears and table ${twin.name} with the same fields appears: this looks like a rename. Write "table ${twin.name} was ${s.visible}" to move the rows, or remove ${s.visible} in a separate change.`);
    else { if (twin) unsure('table', s.visible, twin.name); changes.push(`hides table ${s.visible} (its rows are kept and come back if it returns)`); }
    s.visible = null;
  }
  for (const [d, k] of ta.claims) {
    const s = E.tables[k];
    if (s.visible !== d.name) {
      changes.push(s.visible ? `renames table ${s.visible} to ${d.name} (its rows move with it)` : `shows table ${d.name} again (its old rows come back)`);
      if (!s.visible) warnings.push(`table ${d.name} was removed earlier; its old rows come back with it. If this is a new table, give it another name.`);
    }
  }

  // ---- fields of each table ----
  for (const t of m.tables) {
    const k = tkey.get(t.name);
    if (!k) continue;
    const T = E.tables[k];
    const wasVisible = ever.tables[k] && ever.tables[k].visible !== null;
    const fdecl = t.fields.map(f => ({ name: f.name, was: f.was, f, type: stype(f.type) }));
    const fa = assign(T.fields, fdecl, 'field', !!opts.load);
    refused.push(...fa.problems.map(p => `${t.name}: ${p}`));
    for (const d of fa.noop) noopNote('field', { ...d, name: `${t.name}.${d.name}`, was: `${t.name}.${d.was}` }, fa.fresh.includes(d));
    const claimed = new Set(fa.claims.values());
    for (const [fk, s] of Object.entries(T.fields)) {
      if (s.visible === null || claimed.has(fk)) continue;
      const twin = fa.fresh.find(d => d.type.t === s.type.t);
      if (twin && edit && wasVisible) refused.push(`${t.name}.${s.visible} disappears and ${t.name}.${twin.name} of the same type appears: this looks like a rename. Write "${twin.name} ${twin.f.type.t === 'ref' ? 'ref ' + twin.f.type.table : twin.f.type.t === 'pick' ? 'pick ...' : twin.f.type.t} was ${s.visible}" to move the values, or remove the old field in a separate change.`);
      else { if (twin) unsure('field', `${t.name}.${s.visible}`, `${t.name}.${twin.name}`); changes.push(`hides field ${t.name}.${s.visible} (values are kept, not deleted)`); }
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
      const newType = widens(st, ty) && st.t !== ty.t ? ty : st;
      // pick options are slots too: rows store the option's slot id, so a rename moves no row
      let opts = s.opts ? clone(s.opts) : undefined;
      if (d.f.type.t === 'pick') {
        opts = opts || {};
        const ren = d.f.type.renames || {};
        const oa = assign(opts, d.f.type.options.map(o => ({ name: o, was: ren[o] })), 'option', !!loadOpt);
        refused.push(...oa.problems.map(p => `${t.name}.${d.name}: ${p}`));
        // a rename onto a name another listed option still has would mix two options under one name
        const renamedTo = new Set([...oa.claims].filter(([od, ok]) => opts[ok].visible !== od.name && opts[ok].visible !== null).map(([od]) => od.name));
        for (const [od, ok] of oa.claims) if (renamedTo.has(od.name)) { const other = Object.entries(opts).find(([k2, o]) => k2 !== ok && o.visible === od.name && ![...oa.claims.values()].includes(k2)); if (other) refused.push(`${t.name}.${d.name}: option ${od.name} was ${opts[ok].visible} would merge ${opts[ok].visible} into the existing option ${od.name}; rename ${od.name} too or pick another name.`); }
        for (const od of oa.noop) noopNote('option', { name: od.name, was: od.was }, oa.fresh.includes(od));
        const oclaimed = new Set(oa.claims.values());
        for (const [ok, os] of Object.entries(opts)) {
          if (os.visible === null || oclaimed.has(ok)) continue;
          warnings.push(`${t.name}.${d.name}: option ${os.visible} is no longer listed. Rows that have it keep it and still show it, but it is not offered for new rows and formulas cannot name it. To rename it write "NEW was ${os.visible}"; to keep it, list it again.`);
          os.visible = null;
        }
        for (const od of oa.fresh) { const ok = '#' + newKey(Object.fromEntries(Object.keys(opts).map(x => [x.slice(1), 1])), od.name); opts[ok] = { seen: {}, visible: null }; oa.claims.set(od, ok); if (wasVisible || ever.tables[k]) changes.push(`adds option ${od.name} to ${t.name}.${d.name}`); }
        for (const [od, ok] of oa.claims) {
          const os = opts[ok];
          if (os.visible !== null && os.visible !== od.name) changes.push(`renames option ${os.visible} of ${t.name}.${d.name} to ${od.name} (rows keep their choice)`);
          else if (os.visible === null && Object.keys(os.seen).length) changes.push(`lists option ${od.name} of ${t.name}.${d.name} again`);
          opts[ok] = { ...os, visible: od.name, seen: { ...os.seen, [od.name]: V } };
        }
      }
      if (prevDecl && s.visible !== null) {
        if (prevDecl.optional && !d.f.optional) notes.push(`${t.name}.${d.name} is now required; old empty values stay empty.`);
        if (JSON.stringify(prevDecl.range) !== JSON.stringify(d.f.range ?? null)) {
          changes.push(`changes the allowed range of ${t.name}.${d.name}`);
          const r = d.f.range, p = prevDecl.range;
          if (r && (!p || r.lo > p.lo || (r.hi !== null && (p.hi === null || r.hi < p.hi)))) notes.push(`${t.name}.${d.name}: the range is narrower now; old values outside it are kept as they are.`);
        }
      }
      T.fields[fk] = { ...s, ...(opts ? { opts } : {}), type: newType, visible: d.name, seen: { ...s.seen, [d.name]: V }, decl: { t: d.f.type.t, optional: !!d.f.optional, range: d.f.range ?? null } };
    }
    T.visible = t.name; T.seen = { ...T.seen, [t.name]: V };
    const lost = unreachable(T.fields);
    if (lost.length) refused.push(`${t.name}: this would leave the old values of ${lost.map(x => lastName(T.fields[x])).join(', ')} with no name to bring them back (another field now owns that name). Pick another name, or bring the old field back first.`);
  }
  const lostT = unreachable(Object.fromEntries(Object.entries(E.tables).filter(([, s]) => Object.keys(s.seen).length)));
  if (lostT.length) refused.push(`this would leave the old rows of table ${lostT.map(x => lastName(E.tables[x])).join(', ')} with no name to bring them back. Pick another table name.`);

  // ---- settings and persisted states ----
  for (const [group, list, what] of [['settings', m.settings, 'setting'], ['states', m.states, 'state']]) {
    const G = E[group];
    const decl = list.map(s => ({ name: s.name, was: s.was, s, type: stype(s.type) }));
    const ga = assign(G, decl, what, !!opts.load);
    refused.push(...ga.problems);
    for (const d of ga.noop) noopNote(what, d, ga.fresh.includes(d));
    const claimed = new Set(ga.claims.values());
    for (const [k, s] of Object.entries(G)) {
      if (s.visible === null || claimed.has(k)) continue;
      const twin = ga.fresh.find(d => d.type.t === s.type.t);
      if (twin && edit) refused.push(`${what} ${s.visible} disappears and ${what} ${twin.name} of the same type appears: this looks like a rename, and the saved value would be reset. Write "${what} ${twin.name} ... was ${s.visible}" to keep it, or remove ${s.visible} in a separate change.`);
      else { if (twin) unsure(what, s.visible, twin.name); changes.push(`hides ${what} ${s.visible} (its value is kept)`); }
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
      G[k] = { ...s, type: widens(s.type, d.type) && s.type.t !== d.type.t ? d.type : s.type, visible: d.name, seen: { ...s.seen, [d.name]: V }, label: d.s.label ?? null, dflt: d.s.dflt ?? null, force: d.s.force ? d.s.dflt : null };
    }
    const lost = unreachable(G);
    if (lost.length) refused.push(`this would leave the saved value of ${what} ${lost.map(x => lastName(G[x])).join(', ')} with no name to bring it back. Pick another name.`);
  }

  if (refused.length) return { verdict: 'refused', changes, refused, notes, ever, moves: [] };
  // the text as written is kept too (edit), so an older-shaped backup can be rebuilt by replaying it
  E.versions = [...(ever.versions || []), { src: stored, ...(src !== stored ? { edit: src } : {}), map: mapOf(E), v: V }];
  if (warnings.length) return { verdict: 'warn', warnings, changes, refused, notes, ever: E, moves: [], stored };
  return { verdict: 'safe', changes, refused, notes, ever: E, moves: [], stored };
}

// name -> slot map of the current visible schema (options: name -> option slot, per field)
export function mapOf(E) {
  const tables = {}, fields = {}, options = {};
  for (const [k, s] of Object.entries(E.tables)) if (s.visible !== null) {
    tables[s.visible] = k;
    fields[k] = {};
    for (const [fk, f] of Object.entries(s.fields)) if (f.visible !== null) {
      fields[k][f.visible] = fk;
      if (f.opts) (options[k] ||= {})[fk] = Object.fromEntries(Object.entries(f.opts).filter(([, o]) => o.visible !== null).map(([ok, o]) => [o.visible, ok]));
    }
  }
  const g = G => Object.fromEntries(Object.entries(G).filter(([, s]) => s.visible !== null).map(([k, s]) => [s.visible, k]));
  return { tables, fields, options, settings: g(E.settings), states: g(E.states) };
}

// Undo / restore-to-version: that version's text and its name -> slot map, as recorded
function restoreVersion(ever, i) {
  const E = clone(ever);
  E.v += 1;
  const map = ever.versions[i].map;
  const changes = [`restores version ${i + 1} of ${ever.versions.length} (data entered since stays; what it does not name is hidden)`];
  const nameIn = (m, key) => Object.keys(m || {}).find(n => m[n] === key) ?? null;
  for (const [k, s] of Object.entries(E.tables)) {
    const name = nameIn(map.tables, k);
    if (s.visible !== null && name === null) changes.push(`hides table ${s.visible}`);
    s.visible = name; if (name) s.seen[name] = E.v;
    for (const [fk, f] of Object.entries(s.fields)) {
      const fn = name ? nameIn(map.fields[k], fk) : null;
      if (f.visible !== null && fn === null && name) changes.push(`hides field ${name}.${f.visible}`);
      f.visible = fn; if (fn) f.seen[fn] = E.v;
      if (f.opts) for (const [ok, o] of Object.entries(f.opts)) {
        const on = fn ? nameIn(map.options?.[k]?.[fk], ok) : null;
        o.visible = on; if (on) o.seen[on] = E.v;
      }
    }
  }
  for (const g of ['settings', 'states']) for (const [k, s] of Object.entries(E[g])) {
    const n = nameIn(map[g], k);
    s.visible = n; if (n) s.seen[n] = E.v;
  }
  E.versions = [...ever.versions, { src: ever.versions[i].src, map, v: E.v, from: i }];
  return { verdict: 'restore', changes, refused: [], notes: [], ever: E, moves: [], restoredFrom: i };
}

// The schema history of a list of programs, oldest first, each applied as an edit of the one before
// (rule 1). Refused ones are skipped. Used to rebuild a backup that has no maps, and for diff.
export function everOf(history) {
  let ever = emptySchema();
  const used = [];
  for (const h of history) { const r = evolve(ever, h); if (r.verdict === 'safe' || r.verdict === 'warn' || r.verdict === 'restore') { ever = r.ever; used.push(true); } else used.push(false); }
  return { ever, used };
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
