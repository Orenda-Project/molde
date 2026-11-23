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
//   target slot. Pick options are never dropped: a removed option stays selectable.
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
function assign(slots, decls, what, ctx) {
  const claims = new Map(); // decl -> key
  const problems = [];
  const fresh = [];
  for (const d of decls) {
    let k = null;
    if (d.was && d.was !== d.name) {
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
      if (r) k = r.key;
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
  const old = ever.versions.findIndex(x => x.src === src);
  if (opts.restore !== false && old >= 0 && old < ever.versions.length - 1) return restoreVersion(ever, old, m);
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
  for (const [d, k] of ta.claims) {
    const s = E.tables[k];
    if (s.visible !== d.name) changes.push(s.visible ? `renames table ${s.visible} to ${d.name} (its rows move with it)` : `shows table ${d.name} again (its old rows come back)`);
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
      if (st.t === 'pick' && ty.t === 'pick') {
        const ren = d.f.type.renames || {};
        const ever0 = st.options;
        const olds = Object.values(ren);
        const dupOld = olds.find((o, i) => olds.indexOf(o) !== i);
        if (dupOld) { refused.push(`${t.name}.${d.name}: two options say they were ${dupOld}; only one can.`); continue; }
        const map = {};
        let bad = false;
        for (const [nw, ol] of Object.entries(ren)) {
          if (!ever0.includes(ol)) {
            if (ever0.includes(nw)) continue; // rename already done
            refused.push(`${t.name}.${d.name}: option ${nw} says it was ${ol}, but there never was an option ${ol}.`); bad = true; continue;
          }
          if (ever0.includes(nw) && !olds.includes(nw)) { refused.push(`${t.name}.${d.name}: option ${nw} was ${ol} would merge ${ol} into the existing option ${nw}; rename ${nw} too or pick another name.`); bad = true; continue; }
          map[ol] = nw;
        }
        if (bad) continue;
        if (Object.keys(map).length) {
          moves.push({ table: k, field: fk, map });
          for (const [ol, nw] of Object.entries(map)) changes.push(`renames option ${ol} of ${t.name}.${d.name} to ${nw} (rows move with it)`);
        }
        const mapped = ever0.map(o => map[o] || o);
        const added = ty.options.filter(o => !mapped.includes(o));
        if (added.length) changes.push(`adds options ${added.join(', ')} to ${t.name}.${d.name}`);
        for (const o of mapped) if (!ty.options.includes(o)) notes.push(`${t.name}.${d.name}: option ${o} is no longer listed, but rows keep it and it stays selectable and filterable. To rename it write "NEW was ${o}".`);
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
      T.fields[fk] = { ...s, type: newType, visible: d.name, seen: { ...s.seen, [d.name]: V }, decl: { t: d.f.type.t, optional: !!d.f.optional, range: d.f.range ?? null } };
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
      G[k] = { ...s, type: widens(s.type, d.type) && s.type.t !== d.type.t ? d.type : s.type, visible: d.name, seen: { ...s.seen, [d.name]: V }, label: d.s.label ?? null };
    }
    const lost = unreachable(G);
    if (lost.length) refused.push(`this would leave the saved value of ${what} ${lost.map(x => lastName(G[x])).join(', ')} with no name to bring it back. Pick another name.`);
  }

  if (refused.length) return { verdict: 'refused', changes, refused, notes, ever, moves: [] };
  E.versions = [...(ever.versions || []), { src, map: mapOf(E) }];
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
  const changes = [`restores version ${i + 1} of ${ever.versions.length} (data entered since stays; fields it does not know are hidden)`];
  for (const [k, s] of Object.entries(E.tables)) {
    const name = Object.keys(map.tables).find(n => map.tables[n] === k) ?? null;
    if (s.visible !== null && name === null) changes.push(`hides table ${s.visible}`);
    s.visible = name; if (name) s.seen[name] = E.v;
    for (const [fk, f] of Object.entries(s.fields)) {
      const fn = name ? (Object.keys(map.fields[k] || {}).find(n => map.fields[k][n] === fk) ?? null) : null;
      if (f.visible !== null && fn === null && name) changes.push(`hides field ${name}.${f.visible}`);
      f.visible = fn; if (fn) f.seen[fn] = E.v;
    }
  }
  for (const g of ['settings', 'states']) for (const [k, s] of Object.entries(E[g])) {
    const n = Object.keys(map[g]).find(x => map[g][x] === k) ?? null;
    s.visible = n; if (n) s.seen[n] = E.v;
  }
  E.versions = [...ever.versions, { src: ever.versions[i].src, map }];
  return { verdict: 'restore', changes, refused: [], notes: [], ever: E, moves: [], restoredFrom: i };
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
  for (const h of history) { const r = evolve(ever, h); if (r.verdict === 'safe' || r.verdict === 'restore') { ever = r.ever; used.push(true); } else used.push(false); }
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
  if ((r.verdict === 'safe' || r.verdict === 'restore') && A && A.ast.header && A.ast.header.kind === 'app' && B.ok) {
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
