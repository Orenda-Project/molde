// MoldeScript v0 type checker. check(src) parses, expands components, and checks meaning.
// Every error has a code, a line number, a message and a fix hint, written so it can be pasted
// into a repair prompt as is.
import { parse, MoError } from './parse.mjs';
import { expandProgram } from './expand.mjs';

export const ICONS = new Set(('drop check wallet dumbbell book clock heart star moon sun leaf cart list calendar pill money user users bell timer '
  + 'calc home cup bed scale smile note pen gift tag package chart flame bolt target trophy coin bag phone pin flag music map car '
  + 'bus plane bike walk run baby paw plant tree cloud rain snow fire coffee food apple bread fish egg milk tooth eye brain '
  + 'mosque beads school pencil alarm hourglass dice cards ball game board shield key lock seat plus minus').split(' '));

const NUMERIC = new Set(['num', 'money']);
const TEXTUAL = new Set(['text', 'long', 'pick']);
const tname = t => typeof t === 'string' ? t : t.t;
const show = t => {
  const n = tname(t);
  if (n === 'row') return `a ${t.table} row`;
  if (n === 'rows') return t.field ? `the ${t.field} column of ${t.table}` : `the table ${t.table}`;
  if (n === 'ref') return `a link to ${t.table}`;
  if (n === 'pick') return 'a choice';
  if (n === 'draft') return `a new ${t.table} being filled in`;
  if (n === 'group') return `a group of ${t.table}`;
  return { num: 'a number', money: 'money', text: 'text', long: 'text', bool: 'yes/no', date: 'a date', time: 'a time of day', when: 'a date and time', dur: 'a duration', image: 'an image', color: 'a colour', icon: 'an icon', any: 'something' }[n] || n;
};
const isNum = t => NUMERIC.has(tname(t));
const family = t => {
  const n = tname(t);
  if (NUMERIC.has(n)) return 'num';
  if (TEXTUAL.has(n)) return 'text';
  if (n === 'date' || n === 'when') return 'date';
  if (n === 'ref' || n === 'row') return 'row:' + t.table;
  return n;
};
const ANY = { t: 'any' };
const isAny = t => tname(t) === 'any';

export function check(src, opts = {}) {
  const prog = parse(src, opts);
  const errors = [...prog.errors];
  if (!prog.header && !errors.length) errors.push(new MoError('E_HEADER', 1, 'the program is empty.', 'start with app "Name".'));
  let defs = new Map();
  if (prog.header && prog.header.kind === 'app') {
    const ex = expandProgram(prog);
    errors.push(...ex.errors);
    defs = ex.defs;
    const C = new Checker(errors);
    C.header(prog.header);
    C.list(prog.body, { top: true });
    prog.env = { tables: C.tables, settings: C.settings, states: C.states, screens: C.screens };
  }
  errors.sort((a, b) => a.line - b.line);
  return { ok: errors.length === 0, errors, ast: prog, defs };
}

class Checker {
  constructor(errors) {
    this.errors = errors;
    this.tables = new Map(); this.settings = new Map(); this.states = new Map(); this.screens = new Map(); this.lets = new Map(); this.readonly = new Set();
    this.scopes = []; // {it, names: Map, each: bool}
    this.line = 0; this.via = null;
  }
  err(code, msg, hint) {
    const pre = this.via ? `inside "${this.via}": ` : '';
    if (!this.errors.some(e => e.line === this.line && e.code === code && e.msg === pre + msg)) this.errors.push(new MoError(code, this.line, pre + msg, hint));
    return ANY;
  }
  taken(name) { return this.lets.has(name) || this.tables.has(name) || this.settings.has(name) || this.states.has(name) || this.screens.has(name); }

  header(h) {
    this.line = h.line;
    if (h.icon && !ICONS.has(h.icon)) this.err('E_ICON', `unknown icon "${h.icon}".`, `use one of: ${[...ICONS].slice(0, 30).join(', ')} ...`);
  }

  // ---------- statements ----------
  list(stmts, cx) {
    let prev = null;
    for (const s of stmts) {
      this.line = s.line; const oldVia = this.via; if (s.via) this.via = s.via;
      this.stmt(s, cx, prev);
      this.via = oldVia;
      prev = s;
    }
  }

  stmt(s, cx, prev) {
    const topOnly = () => { if (!cx.top) this.err('E_CONTEXT', `"${s.kind}" must be at the top level (not indented).`, 'move it to the start of a line with no indentation.'); };
    switch (s.kind) {
      case 'table': return topOnly(), this.table(s);
      case 'setting': {
        topOnly();
        if (this.taken(s.name)) return this.err('E_DUP', `the name "${s.name}" is already used.`, 'pick a different name.');
        this.fieldDecl(s, null);
        this.settings.set(s.name, this.fieldType(s.type));
        return;
      }
      case 'state': {
        let t;
        if (s.draft) {
          if (!this.tables.has(s.draft)) return this.err('E_UNKNOWN_TABLE', `there is no table "${s.draft}" (tables must be declared above).`, `add "table ${s.draft} ..." above this line.`);
          t = { t: 'draft', table: s.draft };
        } else t = this.fieldType(s.type);
        if (s.init && tname(t) === 'pick' && s.init.k === 'path' && !s.init.parts.length && t.options.includes(s.init.head)) s.init = { k: 'str', v: s.init.head, word: true };
        if (s.init) { const it = this.expr(s.init); this.assignable(t, it, `the start value of ${s.name}`, s.init); }
        if (cx.top) {
          if (this.taken(s.name)) return this.err('E_DUP', `the name "${s.name}" is already used.`, 'pick a different name.');
          this.states.set(s.name, t);
        } else this.scopes[this.scopes.length - 1].names.set(s.name, t);
        return;
      }
      case 'let': {
        const t = this.expr(s.e);
        if (['rows', 'draft', 'group'].includes(tname(t))) this.err('E_TYPE', `let names a value; ${show(t)} is not one.`, 'name a number, text, date or row.');
        if (cx.top) {
          if (this.taken(s.name)) return this.err('E_DUP', `the name "${s.name}" is already used.`, 'pick a different name.');
          this.lets.set(s.name, t);
        } else this.scopes[this.scopes.length - 1].names.set(s.name, t);
        this.readonly.add(s.name);
        return;
      }
      case 'def': if (!cx.top) this.err('E_CONTEXT', 'def must be at the top level.', 'move the def to column 1.'); return;
      case 'screen': {
        if (!cx.top) return this.err('E_CONTEXT', 'screen must be at the top level.', 'move it to column 1.');
        if (this.taken(s.name)) return this.err('E_DUP', `the name "${s.name}" is already used.`, 'pick a different name.');
        if (s.icon && !ICONS.has(s.icon)) this.err('E_ICON', `unknown icon "${s.icon}".`, 'use an icon name from SPEC.md.');
        this.screens.set(s.name, s);
        return this.block(s.children, { ...cx, top: false });
      }
      case 'remind': {
        topOnly();
        if (s.at) {
          const t = this.path(s.at, 'rows');
          if (!isAny(t) && !(tname(t) === 'rows' && t.field && ['time', 'date', 'when'].includes(tname(t.ftype))))
            this.err('E_TYPE', 'remind at needs times like 8:00 or a time/date column like med.time.', 'write remind "Text" at 8:00 or at table.field.');
        }
        if (s.cond) this.bool(s.cond, 'the remind condition');
        return;
      }
      case 'every': case 'when':
        if (s.cond) this.bool(s.cond, `the ${s.kind} condition`);
        return this.actions(s.actions);
      case 'each': {
        const item = this.source(s.source);
        const scope = { it: s.as ? this.curIt() : item, names: new Map(), each: true };
        if (s.as) { scope.names.set(s.as, item); this.readonly.add(s.as); }
        this.scopes.push(scope);
        this.list(s.children, { ...cx, top: false });
        this.scopes.pop();
        return;
      }
      case 'if': this.bool(s.cond, 'the if condition'); return this.block(s.children, { ...cx, top: false });
      case 'else':
        if (!prev || prev.kind !== 'if') this.err('E_CONTEXT', 'else must come right after an if block at the same indentation.', 'put else under the matching if.');
        return this.block(s.children, { ...cx, top: false });
      case 'box': this.mods(s.mods); return this.block(s.children, { ...cx, top: false });
      case 'use': return this.block(s.children, { ...cx, top: false });
      case 'draw':
        if (cx.draw) this.err('E_CONTEXT', 'a draw cannot be inside another draw.', 'close the first draw first.');
        this.mods(s.mods);
        return this.block(s.children, { ...cx, top: false, draw: s });
      case 'poly':
        if (!cx.draw) this.err('E_CONTEXT', 'poly is a drawing shape; it must be inside draw.', 'indent it under a draw W, H line.');
        this.mods(s.mods);
        return this.block(s.children, { ...cx, top: false, poly: true });
      case 'pt':
        if (!cx.poly) this.err('E_CONTEXT', 'pt is a point of a poly; it must be inside poly.', 'indent it under a poly line.');
        this.num(s.x, 'pt x'); this.num(s.y, 'pt y');
        return;
      case 'shape':
        if (!cx.draw) this.err('E_CONTEXT', `${s.shape} is a drawing shape; it must be inside draw.`, 'indent it under a draw W, H line.');
        s.args.forEach((a, i) => this.num(a, `${s.shape} value ${i + 1}`));
        if (s.parts) this.parts(s.parts);
        return this.mods(s.mods);
      case 'text': this.parts(s.parts); return this.mods(s.mods);
      case 'button':
        this.parts(s.parts); this.mods(s.mods);
        if (!s.mods.some(m => m.m === 'tap')) this.err('E_ACTION', 'a button needs tap and an action.', 'add: tap add/set/toggle/...');
        return;
      case 'icon': {
        const e = s.icon;
        if (e.k === 'path' && !e.parts.length && !this.lookup(e.head)) { if (!ICONS.has(e.head)) this.err('E_ICON', `unknown icon "${e.head}".`, 'use an icon name from SPEC.md.'); }
        else { const t = this.expr(e); if (!isAny(t) && !TEXTUAL.has(tname(t)) && tname(t) !== 'icon') this.err('E_TYPE', 'icon needs an icon name or a text holding one.', 'write icon heart.'); }
        return this.mods(s.mods);
      }
      case 'image': { const t = this.expr(s.e); if (!isAny(t) && tname(t) !== 'image') this.err('E_TYPE', `image needs an image field, got ${show(t)}.`, 'add a field of type image to the table.'); return this.mods(s.mods); }
      case 'space': case 'divider': case 'slot': return;
      case 'field': {
        const t = this.target(s.target, true);
        if (tname(t) === 'rows') this.err('E_TARGET', 'field edits a state, a setting, a new row (state d new t) or a row field; not a table.', 'use form or state d new table + field d.');
        return this.mods(s.mods);
      }
      case 'toggle': this.toggleT(s); return this.mods(s.mods);
      case 'choice': {
        const t = this.target(s.target);
        if (!isAny(t) && tname(t) !== 'pick' && tname(t) !== 'bool' && tname(t) !== 'ref') this.err('E_TYPE', `choice needs a pick, ref or yes/no value, got ${show(t)}.`, 'give the state or field a pick type.');
        return this.mods(s.mods);
      }
      case 'slider': {
        const t = this.target(s.target);
        if (!isAny(t) && !isNum(t) && tname(t) !== 'dur') this.err('E_TYPE', `slider needs a number, got ${show(t)}.`, 'use a num state or setting.');
        if (s.range.hi === null || s.range.hi <= s.range.lo) this.err('E_RANGE', 'a slider needs a range like 0..10 with the second number bigger.', 'write slider x 0..10.');
        return this.mods(s.mods);
      }
    }
    this.err('E_SYNTAX', `unexpected statement ${s.kind}.`, '');
  }

  mods(ms) {
    const seen = new Set();
    for (const m of ms) {
      if (seen.has(m.m)) this.err('E_DUP', `"${m.m}" appears twice on this line.`, 'keep one.');
      seen.add(m.m);
      if (m.m === 'tap' || m.m === 'swipe') this.actions(m.actions);
      else if (['color', 'fill', 'stroke'].includes(m.m)) { const t = this.expr(m.e); if (!isAny(t) && t !== 'color') this.err('E_TYPE', `${m.m} needs a colour (accent, ink, muted, soft, good, warn, bad, bg, surface, edge), got ${show(t)}.`, `write ${m.m} accent, or ${m.m} if(x > 0, good, bad).`); }
      else if (m.e) this.num(m.e, m.m);
    }
  }

  block(children, cx) { this.scopes.push({ it: this.curIt(), names: new Map(), each: this.inEach() }); this.list(children || [], cx); this.scopes.pop(); }
  curIt() { for (let i = this.scopes.length - 1; i >= 0; i--) if (this.scopes[i].it) return this.scopes[i].it; return null; }
  inEach() { return this.scopes.some(s => s.each); }

  table(s) {
    if (this.taken(s.name)) return this.err('E_DUP', `the name "${s.name}" is already used.`, 'pick a different table name.');
    const fields = new Map();
    for (const f of s.fields) {
      if (f.name === 'at' || f.name === 'id') this.err('E_RESERVED', `"${f.name}" is a built-in field of every row.`, 'every row already has at (when it was added); remove this field or rename it.');
      if (fields.has(f.name)) this.err('E_DUP', `field "${f.name}" appears twice in ${s.name}.`, 'remove one or rename it.');
      if (f.type.t === 'ref' && !this.tables.has(f.type.table) && f.type.table !== s.name) this.err('E_REF', `field ${f.name} links to table "${f.type.table}", which is not declared above.`, `declare table ${f.type.table} on an earlier line.`);
      this.fieldDecl(f, s.name);
      fields.set(f.name, f);
    }
    this.tables.set(s.name, { name: s.name, fields, decl: s });
  }

  fieldDecl(f, table) {
    const t = this.fieldType(f.type);
    if (f.type.t === 'pick') {
      const seen = new Set();
      for (const o of f.type.options) { if (seen.has(o)) this.err('E_DUP', `option "${o}" appears twice.`, 'remove the repeat.'); seen.add(o); }
    }
    if (f.range && !isNum(t) && tname(t) !== 'dur') this.err('E_RANGE', `a range like 1..10 only fits number fields, not ${show(t)}.`, 'remove the range.');
    if (f.range && f.range.hi !== null && f.range.hi < f.range.lo) this.err('E_RANGE', 'the range is backwards.', 'write the small number first, like 1..10.');
    if (f.dflt) {
      const d = f.dflt;
      if (f.type.t === 'pick') {
        const v = d.k === 'word' || d.k === 'str' ? d.v : null;
        if (v === null || !f.type.options.includes(v)) this.err('E_DEFAULT', `the default of ${f.name} must be one of its options (${f.type.options.join(', ')}).`, `write = ${f.type.options[0]}.`);
      } else {
        const lt = { num: 'num', str: 'text', time: 'time', dur: 'dur', bool: 'bool', today: 'date', now: 'when', word: 'text' }[d.k];
        if (!this.compatible(t, lt)) this.err('E_DEFAULT', `the default of ${f.name} is ${show(lt)} but the field is ${show(t)}.`, 'make the default match the type.');
        if (d.k === 'num' && f.range && (d.v < f.range.lo || (f.range.hi !== null && d.v > f.range.hi))) this.err('E_RANGE', `the default ${d.v} is outside ${f.range.lo}..${f.range.hi ?? ''}.`, 'pick a default inside the range.');
      }
    }
  }
  fieldType(type) { return type.t === 'pick' ? { t: 'pick', options: type.options } : type.t === 'ref' ? { t: 'ref', table: type.table } : type.t; }

  lookup(name) {
    for (let i = this.scopes.length - 1; i >= 0; i--) if (this.scopes[i].names.has(name)) return this.scopes[i].names.get(name);
    if (this.states.has(name)) return this.states.get(name);
    if (this.settings.has(name)) return this.settings.get(name);
    if (this.lets.has(name)) return this.lets.get(name);
    return null;
  }
  writable(name) {
    if (this.readonly.has(name) && !this.states.has(name) && !this.settings.has(name)) return false;
    for (let i = this.scopes.length - 1; i >= 0; i--) if (this.scopes[i].names.has(name)) return !this.scopes[i].each || true;
    return this.states.has(name) || this.settings.has(name);
  }

  // ---------- paths ----------
  // mode: 'value' (a value), 'rows' (a table query), 'target' (something to write)
  path(p, mode = 'value') {
    let t;
    if (p.head === 'it') {
      t = this.curIt();
      if (!t) return this.err('E_CONTEXT', '"it" only exists inside each (and inside fold functions such as maxof).', 'wrap this in each, or name the table instead.');
    } else if (this.whereTable && this.tables.get(this.whereTable).fields.has(p.head) || (this.whereTable && (p.head === 'at' || p.head === 'id'))) {
      t = this.rowField(this.whereTable, p.head);
    } else if (this.lookup(p.head)) t = this.lookup(p.head);
    else if (this.tables.has(p.head)) t = { t: 'rows', table: p.head };
    else {
      const known = [...this.tables.keys(), ...this.settings.keys(), ...this.states.keys(), ...this.lets.keys()];
      return this.err(mode === 'rows' ? 'E_UNKNOWN_TABLE' : 'E_UNKNOWN_NAME', `"${p.head}" is not a table, setting or state declared above${this.whereTable ? `, nor a field of ${this.whereTable}` : ''}.`, known.length ? `use one of: ${known.join(', ')}; or declare it first.` : 'declare it first (table, setting or state).');
    }
    for (const part of p.parts) {
      if (isAny(t)) return t;
      t = this.step(t, part);
    }
    return t;
  }

  rowField(table, f) {
    if (f === 'at') return 'when';
    if (f === 'id') return 'num';
    const fd = this.tables.get(table).fields.get(f);
    return this.fieldType(fd.type);
  }

  step(t, part) {
    const n = tname(t);
    if (n === 'row' || n === 'ref' || n === 'draft') {
      const tb = this.tables.get(t.table);
      if (tb.fields.has(part) || part === 'at' || part === 'id') return this.rowField(t.table, part);
      if (n !== 'draft') {
        const back = this.tables.get(part);
        if (back) {
          const refs = [...back.fields.values()].filter(f => f.type.t === 'ref' && f.type.table === t.table);
          if (refs.length === 1) return { t: 'rows', table: part, via: refs[0].name };
          if (refs.length > 1) return this.err('E_REF', `${part} has more than one link to ${t.table}, so it.${part} is unclear.`, `use: ${part} where ${refs[0].name} = it.`);
          return this.err('E_REF', `${part} has no ref field pointing at ${t.table}.`, `add a field like "${t.table} ref ${t.table}" to table ${part}.`);
        }
      }
      return this.err('E_UNKNOWN_FIELD', `${t.table} has no field "${part}".`, `fields of ${t.table}: ${[...tb.fields.keys(), 'at'].join(', ')}.`);
    }
    if (n === 'rows' && !t.field) {
      const tb = this.tables.get(t.table);
      if (tb.fields.has(part) || part === 'at') return { ...t, field: part, ftype: this.rowField(t.table, part) };
      return this.err('E_UNKNOWN_FIELD', `${t.table} has no field "${part}".`, `fields of ${t.table}: ${[...tb.fields.keys(), 'at'].join(', ')}.`);
    }
    if (n === 'group') {
      if (part === 'key') return t.key;
      const tb = this.tables.get(t.table);
      if (tb.fields.has(part) || part === 'at') return { t: 'rows', table: t.table, field: part, ftype: this.rowField(t.table, part) };
      return this.err('E_UNKNOWN_FIELD', `a group has .key and the columns of ${t.table}; "${part}" is neither.`, 'use g.key, count(g) or sum(g.field).');
    }
    return this.err('E_TYPE', `${show(t)} has no part "${part}".`, 'remove the .' + part + '.');
  }

  // ---------- queries, windows, sources ----------
  query(q, allowField = true) {
    let t = this.path(q.path, 'rows');
    if (isAny(t)) return t;
    if (tname(t) === 'group') t = { t: 'rows', table: t.table };
    if (tname(t) !== 'rows') return this.err('E_TYPE', `expected a table here, got ${show(t)}.`, 'name a table, like count(drink today).');
    if (t.field && !allowField) this.err('E_TYPE', 'expected a table, not a column.', `drop .${t.field}.`);
    if (q.win) this.window(q.win);
    if (q.where) { const o = this.whereTable; this.whereTable = t.table; this.bool(q.where, 'the where condition'); this.whereTable = o; }
    const tb = this.tables.get(t.table);
    if (q.by && !['day', 'week', 'month'].includes(q.by) && !tb.fields.has(q.by)) this.err('E_UNKNOWN_FIELD', `cannot group by "${q.by}": ${t.table} has no such field.`, `group by day, week, month or a field of ${t.table}.`);
    if (q.sort) {
      if (q.sort.parts.length || !(tb.fields.has(q.sort.head) || q.sort.head === 'at')) this.err('E_UNKNOWN_FIELD', `cannot sort by "${q.sort.head}": ${t.table} has no such field.`, `sort by a field of ${t.table} or at.`);
    }
    return t;
  }

  window(w) {
    if (w.k === 'on' || (w.k === 'period' && w.of)) {
      const t = this.expr(w.k === 'on' ? w.e : w.of);
      if (!isAny(t) && family(t) !== 'date') this.err('E_WINDOW', `a window like "on X" or "month of X" needs a date, got ${show(t)}.`, 'use a date state, today, or it inside each days.');
    } else if (w.k === 'param') this.err('E_WINDOW', `"${w.name}" is not a time window.`, 'use today, yesterday, week, month, year, all, prev month, last 7 days, on DATE or month of DATE.');
    else if (w.k === 'last' && (w.n < 1 || w.n > 366 || !Number.isInteger(w.n))) this.err('E_WINDOW', `last ${w.n} ${w.unit} is out of range.`, 'use a whole number from 1 to 366.');
  }

  source(s) {
    switch (s.k) {
      case 'days': this.window(s.win); if (s.win.k === 'all') this.err('E_WINDOW', 'each days all has no end.', 'use a bounded window like last 30 days or month.'); return 'date';
      case 'options': {
        const t = this.path(s.path, 'rows');
        const ft = tname(t) === 'rows' ? t.ftype : t;
        if (!isAny(t) && tname(ft) !== 'pick') return this.err('E_TYPE', 'each options needs a pick field like prayer.name.', 'point at a field of type pick.');
        return 'text';
      }
      case 'list': {
        const ts = s.items.map(l => ({ num: 'num', str: 'text', time: 'time', dur: 'dur', bool: 'bool', word: 'text', today: 'date', now: 'when' }[l.k]));
        if (ts.some(t => family(t) !== family(ts[0]))) this.err('E_TYPE', 'all items in a [list] must have the same type.', 'make them all numbers or all texts.');
        return ts[0];
      }
      case 'range': this.num(s.a, 'the range start'); this.num(s.b, 'the range end'); return 'num';
      case 'query': {
        const t = this.query(s.q, false);
        if (isAny(t)) return t;
        if (s.q.by) {
          const tb = this.tables.get(t.table);
          const key = ['day', 'week', 'month'].includes(s.q.by) ? 'date' : this.fieldType(tb.fields.get(s.q.by)?.type || { t: 'text' });
          return { t: 'group', table: t.table, key };
        }
        return { t: 'row', table: t.table };
      }
    }
    return ANY;
  }

  // ---------- targets and actions ----------
  target(p, allowDraftWhole = false) {
    const t = this.path(p, 'target');
    if (isAny(t)) return t;
    if (!p.parts.length && p.head !== 'it') {
      if (!this.writable(p.head) && !this.tables.has(p.head)) return this.err('E_TARGET', `"${p.head}" cannot be changed${this.readonly.has(p.head) ? ' (it is a let formula)' : ''}.`, 'change a state, a setting, or a row field like it.done.');
    } else {
      // row field or draft field are fine; a whole row is not
      const n = tname(t);
      if (n === 'row' || n === 'group') return this.err('E_TARGET', 'a whole row cannot be set; set one of its fields.', 'write it.field.');
    }
    if (tname(t) === 'draft' && !allowDraftWhole) return this.err('E_TARGET', 'only field can show a whole new row.', 'use field d, or field d.name.');
    return t;
  }

  toggleT(s) {
    const t = this.path(s.target, 'rows');
    if (isAny(t)) return;
    if (tname(t) === 'rows') {
      if (t.field) return this.err('E_TYPE', 'toggle on a table marks a day; it takes the table, not a column.', `write toggle ${t.table}.`);
      this.query({ path: s.target, win: s.win, where: s.where });
      if (s.win && ['all', 'last'].includes(s.win.k)) this.err('E_WINDOW', 'toggle marks one day; use today, yesterday or on DATE.', 'write toggle X today or toggle X on d.');
      if (s.where) this.whereEq(s.where, t.table);
      return;
    }
    if (s.win || s.where) return this.err('E_TYPE', 'only a table toggle takes a window or where.', 'remove them.');
    this.target(s.target);
    if (tname(t) !== 'bool') this.err('E_TYPE', `toggle needs a yes/no value or a table, got ${show(t)}.`, 'use a bool state, setting or field.');
  }
  whereEq(e, table) {
    // toggle where: only field = value (joined by and), so a new row can be filled in
    const ok = x => (x.k === 'bin' && x.op === 'and' && ok(x.a) && ok(x.b)) || (x.k === 'bin' && x.op === '=' && x.a.k === 'path' && !x.a.parts.length && this.tables.get(table).fields.has(x.a.head));
    if (!ok(e)) this.err('E_TYPE', 'a toggle where may only say field = value (joined with and).', 'write where name = it.');
  }

  actions(list) { for (const a of list) this.action(a); }
  action(a) {
    switch (a.a) {
      case 'add': {
        const tb = this.tables.get(a.table);
        if (!tb) return this.err('E_UNKNOWN_TABLE', `there is no table "${a.table}" declared above.`, `declare table ${a.table} first.`);
        const set = new Set();
        for (const s of a.assigns) {
          if (!tb.fields.has(s.name) && s.name !== 'at') { this.err('E_UNKNOWN_FIELD', `${a.table} has no field "${s.name}".`, `fields of ${a.table}: ${[...tb.fields.keys()].join(', ')}.`); continue; }
          set.add(s.name);
          this.assignable(this.rowField(a.table, s.name), this.expr(s.e), `${a.table}.${s.name}`, s.e);
        }
        for (const [n, f] of tb.fields) if (!f.optional && !f.dflt && f.type.t !== 'bool' && !set.has(n)) this.err('E_REQUIRED', `add ${a.table} must set ${n} (it is required and has no default).`, `add ${n} = ..., or mark the field optional with ? or give it = a default.`);
        return;
      }
      case 'set': { const t = this.target(a.target); this.assignable(t, this.expr(a.e), 'this set', a.e); return; }
      case 'toggle': return this.toggleT({ target: a.target, win: a.win, where: a.where });
      case 'edit': if (a.e.k === 'path' && !a.e.parts.length && a.e.head !== 'it' && (this.settings.has(a.e.head) || this.lookup(a.e.head))) { const t = this.lookup(a.e.head); if (tname(t) === 'row') return; return; } // falls through for rows
      // eslint-disable-next-line no-fallthrough
      case 'remove': { const t = this.expr(a.e); if (!isAny(t) && tname(t) !== 'row') this.err('E_TYPE', `${a.a} needs a row (like it), got ${show(t)}.`, `write ${a.a} it inside each.`); return; }
      case 'save': { const t = this.lookup(a.name); if (!t || tname(t) !== 'draft') this.err('E_TARGET', `save needs a state made with "state ${a.name} new TABLE".`, `add: state ${a.name} new TABLE.`); return; }
      case 'go': if (!this.screens.has(a.name)) this.err('E_UNKNOWN_NAME', `there is no screen "${a.name}" declared above.`, 'declare the screen first, or remove go (screens already get tabs).'); return;
      case 'notify': return this.parts(a.parts);
      case 'remind': { const t = this.expr(a.e); if (!isAny(t) && tname(t) !== 'dur') this.err('E_TYPE', 'remind ... in needs a duration like 10m.', 'write remind "Text" in 10m.'); return; }
      case 'param': return this.err('E_UNKNOWN_NAME', `"${a.name}" is not an action.`, 'use add, set, toggle, remove, edit, save, go, notify or remind.');
    }
  }

  assignable(target, val, what, e) {
    if (isAny(target) || isAny(val)) return;
    if (tname(target) === 'pick' && e && e.k === 'str' && !target.options.includes(e.v)) { this.err('E_OPTION', `"${e.v}" is not an option of ${what} (${target.options.join(', ')}).`, 'use one of the options.'); return; }
    if (tname(target) === 'draft') { this.err('E_TARGET', 'a new row cannot be set directly.', 'use field d or save d.'); return; }
    if (!this.compatible(target, val)) this.err('E_TYPE', `${what} is ${show(target)} but the value is ${show(val)}.`, 'give it a value of the same type.');
  }

  compatible(a, b) {
    if (isAny(a) || isAny(b)) return true;
    const fa = family(a), fb = family(b);
    if (fa === fb) return true;
    if (fa === 'date' && fb === 'date') return true;
    return false;
  }

  // ---------- expressions ----------
  bool(e, what) { const t = this.expr(e); if (!isAny(t) && tname(t) !== 'bool') this.err('E_TYPE', `${what} must be yes/no, got ${show(t)}.`, 'compare it, like x > 0 or name = "Fajr".'); }
  num(e, what) { const t = this.expr(e); if (!isAny(t) && !isNum(t)) this.err('E_TYPE', `${what} must be a number, got ${show(t)}.`, 'use a number or a formula that gives one.'); return t; }

  parts(ps) {
    for (const p of ps) {
      const t = this.expr(p);
      const n = tname(t);
      if (n === 'rows') this.err('E_TYPE', `a table cannot be shown as text; show a number from it.`, `use count(${t.table}) or each ${t.table}.`);
      if (n === 'draft' || n === 'color') this.err('E_TYPE', `${show(t)} cannot be shown as text.`, 'show one of its fields.');
    }
  }

  expr(e) {
    switch (e.k) {
      case 'num': return 'num';
      case 'str': return 'text';
      case 'time': return 'time';
      case 'dur': return 'dur';
      case 'bool': return 'bool';
      case 'today': return 'date';
      case 'now': return 'when';
      case 'color': return 'color';
      case 'index': if (!this.inEach()) this.err('E_CONTEXT', 'index only exists inside each.', 'use it inside an each block.'); return 'num';
      case 'paren': return this.expr(e.a);
      case 'path': {
        const t = this.path(e);
        return t;
      }
      case 'not': this.bool(e.a, 'not'); return 'bool';
      case 'neg': { const t = this.expr(e.a); if (!isAny(t) && !isNum(t) && tname(t) !== 'dur') this.err('E_TYPE', `cannot negate ${show(t)}.`, 'use a number.'); return t; }
      case 'bin': return this.bin(e);
      case 'agg': return this.agg(e);
      case 'fold': return this.fold(e);
      case 'fn': return this.fn(e);
    }
    return ANY;
  }

  bin(e) {
    const a = this.expr(e.a), b = this.expr(e.b);
    if (isAny(a) || isAny(b)) return ['and', 'or', '=', '!=', '<', '>', '<=', '>='].includes(e.op) ? 'bool' : ANY;
    const na = tname(a), nb = tname(b);
    const bad = () => this.err('E_TYPE', `cannot use ${e.op} between ${show(a)} and ${show(b)}.`, 'make both sides the same kind of value.');
    switch (e.op) {
      case 'and': case 'or':
        if (na !== 'bool' || nb !== 'bool') bad();
        return 'bool';
      case '=': case '!=': {
        const pick = na === 'pick' ? [a, e.b] : nb === 'pick' ? [b, e.a] : null;
        if (pick && pick[1].k === 'str' && !pick[0].options.includes(pick[1].v)) this.err('E_OPTION', `"${pick[1].v}" is not one of the options (${pick[0].options.join(', ')}).`, 'compare with one of the options, spelled the same.');
        if (!this.compatible(a, b)) bad();
        return 'bool';
      }
      case '<': case '>': case '<=': case '>=': {
        const fa = family(a);
        if (fa !== family(b) || !['num', 'dur', 'date', 'time', 'text'].includes(fa)) bad();
        return 'bool';
      }
      case '+': case '-': {
        if (isNum(a) && isNum(b)) return na === 'money' || nb === 'money' ? 'money' : 'num';
        if (na === 'dur' && nb === 'dur') return 'dur';
        if (family(a) === 'date' && isNum(b)) return a;
        if (e.op === '-' && na === 'date' && nb === 'date') return 'num';
        if (e.op === '-' && na === 'when' && nb === 'when') return 'dur';
        if (e.op === '-' && na === 'time' && nb === 'time') return 'dur';
        return bad();
      }
      case '*': {
        if (isNum(a) && isNum(b)) return na === 'money' || nb === 'money' ? 'money' : 'num';
        if (na === 'dur' && isNum(b)) return 'dur';
        if (isNum(a) && nb === 'dur') return 'dur';
        return bad();
      }
      case '/': {
        if (isNum(a) && isNum(b)) return na === 'money' && nb !== 'money' ? 'money' : 'num';
        if (na === 'dur' && isNum(b)) return 'dur';
        if (na === 'dur' && nb === 'dur') return 'num';
        return bad();
      }
      case '%': if (!(isNum(a) && isNum(b))) return bad(); return 'num';
    }
    return ANY;
  }

  agg(e) {
    const t = this.query(e.q, true);
    if (isAny(t)) return ['count', 'streak', 'best', 'since', 'gap'].includes(e.fn) ? 'num' : ANY;
    const f = e.fn;
    if (f === 'count' || f === 'streak' || f === 'best' || f === 'since' || f === 'gap') {
      if (f !== 'count' && t.field) this.err('E_TYPE', `${f}() counts days with rows; give it the table, not a column.`, `write ${f}(${t.table}).`);
      return 'num';
    }
    if (!t.field) {
      if (f === 'last' || f === 'first') return { t: 'row', table: t.table };
      return this.err('E_TYPE', `${f}() needs a number column like ${t.table}.amount.`, `write ${f}(${t.table}.FIELD ...).`);
    }
    if (f === 'last' || f === 'first') return t.ftype;
    if (!isNum(t.ftype) && tname(t.ftype) !== 'dur') return this.err('E_TYPE', `${f}() needs a number column; ${t.table}.${t.field} is ${show(t.ftype)}.`, 'use count() for non-numbers.');
    return t.ftype;
  }

  fold(e) {
    const item = this.source(e.src);
    this.scopes.push({ it: item, names: new Map(), each: true });
    const t = this.expr(e.e);
    this.scopes.pop();
    if (e.fn === 'countof') { if (!isAny(t) && tname(t) !== 'bool') this.err('E_TYPE', 'countof(source, condition) needs a yes/no condition.', 'write countof(habit, streak(it.check) > 3).'); return 'num'; }
    if (!isAny(t) && !isNum(t) && tname(t) !== 'dur') return this.err('E_TYPE', `${e.fn}() needs a number for each item, got ${show(t)}.`, 'give a formula that makes a number.');
    return t;
  }

  fn(e) {
    const A = e.args.map(a => this.expr(a));
    const need = (i, ok, what) => { if (!isAny(A[i]) && !ok(A[i])) this.err('E_TYPE', `${e.fn}() needs ${what} as value ${i + 1}, got ${show(A[i])}.`, `check ${e.fn}() in SPEC.md.`); };
    const isDate = t => family(t) === 'date';
    switch (e.fn) {
      case 'if':
        need(0, t => tname(t) === 'bool', 'a yes/no condition');
        if (!this.compatible(A[1], A[2])) this.err('E_TYPE', `if() gives ${show(A[1])} or ${show(A[2])}; both answers must be the same type.`, 'make both answers the same kind.');
        return isAny(A[1]) ? A[2] : A[1];
      case 'clamp': [0, 1, 2].forEach(i => need(i, isNum, 'a number')); return A[0];
      case 'round': case 'floor': case 'abs': need(0, t => isNum(t) || tname(t) === 'dur', 'a number'); return A[0];
      case 'len': need(0, t => TEXTUAL.has(tname(t)), 'text'); return 'num';
      case 'has': need(0, t => TEXTUAL.has(tname(t)), 'text'); need(1, t => TEXTUAL.has(tname(t)), 'text'); return 'bool';
      case 'weekday': case 'monthday': case 'monthdays': need(0, isDate, 'a date'); return 'num';
      case 'dayname': case 'monthname': need(0, isDate, 'a date'); return 'text';
      case 'hour': need(0, t => tname(t) === 'time' || tname(t) === 'when', 'a time'); return 'num';
      case 'addmonths': need(0, isDate, 'a date'); need(1, isNum, 'a number'); return 'date';
    }
    return ANY;
  }
}
