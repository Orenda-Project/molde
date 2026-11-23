// MoldeScript v0 type checker. check(src) parses, expands components and formulas (let with
// parameters), and checks meaning. Every error has a code, a line number, a message and a fix
// hint, written so it can be pasted into a repair prompt as is. The checker never throws: an
// internal failure becomes one E_INTERNAL error (the fuzz tests count those as crashes).
import { parse, MoError } from './parse.mjs';
import { expandProgram } from './expand.mjs';

export const ICONS = new Set(('drop check wallet dumbbell book clock heart star moon sun leaf cart list calendar pill money user users bell timer '
  + 'calc home cup bed scale smile note pen gift tag package chart flame bolt target trophy coin bag phone pin flag music map car '
  + 'bus plane bike walk run baby paw plant tree cloud rain snow fire coffee food apple bread fish egg milk tooth eye brain '
  + 'mosque beads school pencil alarm hourglass dice cards ball game board shield key lock seat plus minus tool box grid').split(' '));
export const THEMES = ['ocean', 'mint', 'slate', 'ink', 'plum'];
// the closest icon name, for "unknown icon" hints
export function nearestIcon(w) {
  const d = (a, b) => { const m = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) m[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return m[a.length][b.length]; };
  const pre = a => { let i = 0; while (i < a.length && a[i] === w[i]) i++; return i; };
  return [...ICONS].sort((a, b) => d(w, a) - d(w, b) || pre(b) - pre(a) || a.localeCompare(b))[0];
}
const iconHint = w => `use a known icon; the closest is ${nearestIcon(w)}. All icons are listed in SPEC.md section 8.4.`;
export const COLORS = ['accent', 'ink', 'muted', 'soft', 'good', 'warn', 'bad', 'bg', 'surface', 'edge', 'red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink', 'grey', 'black', 'white'];

const NUMERIC = new Set(['num', 'money']);
const TEXTUAL = new Set(['text', 'long', 'pick']);
export const tname = t => typeof t === 'string' ? t : t.t;
export const show = t => {
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
export const family = t => {
  const n = tname(t);
  if (NUMERIC.has(n)) return 'num';
  if (TEXTUAL.has(n)) return 'text';
  if (n === 'date' || n === 'when') return 'date';
  if (n === 'ref' || n === 'row') return 'row:' + t.table;
  return n;
};
const ANY = { t: 'any' };
const isAny = t => !t || tname(t) === 'any';
const AGG_NUM = ['count', 'streak', 'best', 'since', 'gap'];
const PKIND_TYPE = { num: 'num', money: 'money', text: 'text', bool: 'bool', date: 'date', time: 'time', dur: 'dur', color: 'color', icon: 'text' };

export function check(src, opts = {}) {
  let prog, errors, defs = new Map();
  try {
    prog = parse(src, opts);
    errors = [...prog.errors];
    if (!prog.header && !errors.length) errors.push(new MoError('E_HEADER', 1, 'the program is empty.', 'start with app "Name".'));
    if (prog.header && prog.header.kind === 'app') {
      const ex = expandProgram(prog);
      errors.push(...ex.errors);
      defs = ex.defs;
      const C = new Checker(errors, prog);
      C.header(prog.header);
      C.list(prog.body, { top: true });
      prog.env = { tables: C.tables, settings: C.settings, states: C.states, screens: C.screens, lets: C.lets, options: C.options };
      // never show internal names made by component expansion (d_3 -> d)
      for (const e of errors) for (const [inner, outer] of ex.renamed) {
        const re = new RegExp(`\\b${inner}\\b`, 'g');
        e.msg = e.msg.replace(re, outer); e.hint = (e.hint || '').replace(re, outer);
      }
    }
  } catch (e) {
    errors = errors || [];
    errors.push(new MoError('E_INTERNAL', 0, `the checker failed: ${e && e.message}`, 'please report this program.'));
    prog = prog || { header: null, body: [] };
  }
  errors.sort((a, b) => a.line - b.line);
  return { ok: errors.length === 0, errors, ast: prog, defs };
}

class Checker {
  constructor(errors, prog) {
    this.errors = errors;
    this.failed = prog.failed || new Map();
    this.reportedFailed = new Set();
    this.tables = new Map(); this.settings = new Map(); this.states = new Map(); this.screens = new Map(); this.lets = new Map(); this.readonly = new Set();
    this.options = new Set(); // every pick option word, so a bare option word reads as that option
    this.scopes = []; // {it, names: Map, each: bool, asName}
    this.line = 0; this.via = null; this.inAction = 0;
    this.whereTable = null;
  }
  err(code, msg, hint) {
    const pre = this.via ? `inside "${this.via}": ` : '';
    if (!this.errors.some(e => e.line === this.line && e.code === code && e.msg === pre + msg)) this.errors.push(new MoError(code, this.line, pre + msg, hint));
    return ANY;
  }
  // A name whose declaring line failed: say so once, then stay quiet.
  followOn(name) {
    if (!this.failed.has(name)) return false;
    if (!this.reportedFailed.has(name)) {
      this.reportedFailed.add(name);
      const l = this.failed.get(name);
      this.err('E_UNKNOWN_NAME', `"${name}" is unknown because line ${l}, which declares it, failed.`, `fix line ${l} first; later uses of ${name} are not reported again.`);
    }
    return true;
  }
  taken(name) { return this.lets.has(name) || this.tables.has(name) || this.settings.has(name) || this.states.has(name) || this.screens.has(name); }
  tb(name) { return this.tables.get(name) || null; }

  header(h) {
    this.line = h.line;
    if (h.icon && !ICONS.has(h.icon)) this.err('E_ICON', `unknown icon "${h.icon}".`, iconHint(h.icon));
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

  declare(name, t, cx) {
    if (this.options.has(name)) this.err('E_OPTION', `"${name}" is already an option of a pick field, so a bare ${name} would be ambiguous.`, `rename this (for example chosen_${name}) or write the option with a capital letter.`);
    if (cx.top) {
      if (this.taken(name)) { this.err('E_DUP', `the name "${name}" is already used (tables, settings, states, lets and screens share one set of names).`, 'pick a different name.'); return false; }
      return true;
    }
    this.scopes[this.scopes.length - 1].names.set(name, t);
    return false;
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
          if (!this.tb(s.draft)) {
            if (!this.followOn(s.draft)) this.err('E_UNKNOWN_TABLE', `there is no table "${s.draft}" (tables must be declared above).`, `add "table ${s.draft} ..." above this line.`);
            t = ANY; // keep the name so its uses do not cascade
          } else t = { t: 'draft', table: s.draft };
        } else t = this.fieldType(s.type);
        if (s.init && tname(t) === 'pick' && s.init.k === 'path' && !s.init.parts.length && t.options.includes(s.init.head)) s.init = { k: 'word', v: s.init.head };
        if (s.init) { const it = this.expr(s.init); this.assignable(t, it, `the start value of ${s.name}`, s.init); }
        if (this.declare(s.name, t, cx)) this.states.set(s.name, t);
        return;
      }
      case 'let': {
        if (s.params) {
          // a formula with values: check its body with the parameters' types
          this.scopes.push({ it: null, names: new Map(s.params.map(p => [p.name, PKIND_TYPE[p.kind] || ANY])), each: false });
          const t = this.expr(s.e);
          this.scopes.pop();
          if (!cx.top) return this.err('E_CONTEXT', 'a let with values (a formula you call) must be at the top level.', 'move it to column 1.');
          if (this.taken(s.name)) return this.err('E_DUP', `the name "${s.name}" is already used.`, 'pick a different name.');
          this.lets.set(s.name, { t: 'fn', ret: t });
          this.readonly.add(s.name);
          return;
        }
        const t = this.expr(s.e);
        if (['rows', 'draft', 'group'].includes(tname(t))) this.err('E_TYPE', `let names a value; ${show(t)} is not one.`, 'name a number, text, date or row.');
        if (this.declare(s.name, t, cx)) this.lets.set(s.name, t);
        this.readonly.add(s.name);
        return;
      }
      case 'def': if (!cx.top) this.err('E_CONTEXT', 'def must be at the top level.', 'move the def to column 1.'); return;
      case 'screen': {
        if (!cx.top) return this.err('E_CONTEXT', 'screen must be at the top level.', 'move it to column 1.');
        if (this.taken(s.name)) return this.err('E_DUP', `the name "${s.name}" is already used (screens share names with tables, settings and states).`, 'pick a different screen name.');
        if (s.icon && !ICONS.has(s.icon)) this.err('E_ICON', `unknown icon "${s.icon}".`, iconHint(s.icon));
        this.screens.set(s.name, s);
        return this.block(s.children, { ...cx, top: false });
      }
      case 'remind': {
        topOnly();
        if (s.at) {
          const t = this.path(s.at, 'rows');
          if (!isAny(t) && !(tname(t) === 'rows' && t.field && ['time', 'date', 'when'].includes(tname(t.ftype))))
            this.err('E_TYPE', 'remind at needs times like 8:00 or a time/date column like med.time.', 'write remind "Text" at 8:00 or at table.field.');
          else if (!isAny(t) && s.time && tname(t.ftype) === 'time') this.err('E_TYPE', `${t.table}.${t.field} is already a time; "at TIME" after it is for date columns.`, 'remove the second at.');
        }
        if (s.monthly && s.monthly.some(d => d < 1 || d > 31)) this.err('E_RANGE', 'monthly days must be 1 to 31 (31 means the last day in short months).', 'write monthly on 1 at 9:00.');
        if (s.cond) this.bool(s.cond, 'the remind condition');
        return;
      }
      case 'every': case 'when':
        if (s.cond) this.bool(s.cond, `the ${s.kind} condition`);
        return this.actions(s.actions);
      case 'each': {
        const item = this.source(s.source);
        const scope = { it: s.as ? this.curIt() : item, names: new Map(), each: true, asName: s.as || null, asItem: item };
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
        if (!cx.draw) this.err('E_CONTEXT', 'poly is a drawing shape; it must be inside draw.', 'indent it under a draw line.');
        this.mods(s.mods);
        return this.block(s.children, { ...cx, top: false, poly: true });
      case 'pt':
        if (!cx.poly) this.err('E_CONTEXT', 'pt is a point of a poly; it must be inside poly.', 'indent it under a poly line.');
        this.num(s.x, 'pt x'); this.num(s.y, 'pt y');
        return;
      case 'shape':
        if (!cx.draw) this.err('E_CONTEXT', `${s.shape} is a drawing shape; it must be inside draw.`, 'indent it under a draw line.');
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
        if (e.k === 'path' && !e.parts.length && !this.lookup(e.head)) { if (!ICONS.has(e.head)) this.err('E_ICON', `unknown icon "${e.head}".`, iconHint(e.head)); }
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
        if (!isAny(t) && tname(t) !== 'pick' && tname(t) !== 'bool' && tname(t) !== 'ref') this.err('E_TYPE', `choice needs a pick, ref or yes/no value, got ${show(t)}.`, 'give the state a pick type: state x pick A|B = A.');
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
      else if (['color', 'fill', 'stroke'].includes(m.m)) { const t = this.expr(m.e); if (!isAny(t) && t !== 'color') this.err('E_TYPE', `${m.m} needs a colour (${COLORS.join(', ')} or hue(0..360)), got ${show(t)}.`, `write ${m.m} accent, or ${m.m} if(x > 0, good, bad).`); }
      else if (m.e) this.num(m.e, m.m);
    }
  }

  block(children, cx) { this.scopes.push({ it: this.curIt(), names: new Map(), each: this.inEach() }); this.list(children || [], cx); this.scopes.pop(); }
  curIt() { for (let i = this.scopes.length - 1; i >= 0; i--) if (this.scopes[i].it) return this.scopes[i].it; return null; }
  inEach() { return this.scopes.some(s => s.each); }
  asNames() { return this.scopes.filter(s => s.asName).map(s => s.asName); }

  table(s) {
    if (this.taken(s.name)) return this.err('E_DUP', `the name "${s.name}" is already used.`, 'pick a different table name.');
    if (s.was && s.was === s.name) this.err('E_DUP', `table ${s.name} cannot be renamed from itself.`, 'remove "was".');
    if (s.was && this.tables.has(s.was) && !this.tables.get(s.was).decl.was) this.err('E_DUP', `table ${s.name} says it was ${s.was}, but ${s.was} is still declared (and not renamed itself).`, `remove "table ${s.was}" or the "was ${s.was}"; to swap two names, give both tables a was.`);
    const fields = new Map();
    const was = new Set();
    for (const f of s.fields) {
      if (f.name === 'at' || f.name === 'id') this.err('E_RESERVED', `"${f.name}" is a built-in field of every row.`, 'every row already has at (when it was added); remove this field or rename it.');
      if (fields.has(f.name)) this.err('E_DUP', `field "${f.name}" appears twice in ${s.name}.`, 'remove one or rename it.');
      if (f.was && was.has(f.was)) this.err('E_DUP', `two fields say they were ${f.was}; only one can take its values.`, 'keep one was.');
      else if (f.was && s.fields.some(g => g.name === f.was && !g.was)) this.err('E_DUP', `field ${f.name} says it was ${f.was}, but ${f.was} is still a field (and not renamed itself).`, `remove the field ${f.was} or the "was"; to swap two names, give both fields a was.`);
      if (f.was) was.add(f.was);
      if (f.type.t === 'ref' && !this.tables.has(f.type.table) && f.type.table !== s.name) {
        this.failed.set(`${s.name}.${f.name}`, this.failed.get(f.type.table) || this.line);
        this.reportedFailed.add(`${s.name}.${f.name}`);
        if (!this.followOn(f.type.table)) this.err('E_REF', `field ${f.name} links to table "${f.type.table}", which is not declared above.`, `declare table ${f.type.table} on an earlier line.`);
        continue; // a broken link is left out so later lines do not trip on it
      }
      this.fieldDecl(f, s.name);
      fields.set(f.name, f);
    }
    this.tables.set(s.name, { name: s.name, fields, decl: s });
  }

  fieldDecl(f, table) {
    const t = this.fieldType(f.type);
    if (f.type.t === 'pick') {
      const seen = new Set();
      for (const o of f.type.options) {
        if (seen.has(o)) this.err('E_DUP', `option "${o}" appears twice.`, 'remove the repeat.');
        seen.add(o); this.options.add(o);
        if (COLORS.includes(o)) this.err('E_OPTION', `option "${o}" is also a colour word, so ${f.name} = ${o} would read as the colour.`, `write the option with a capital letter: ${o[0].toUpperCase() + o.slice(1)}.`);
        else if (this.lookup(o) || this.tables.has(o)) this.err('E_OPTION', `option "${o}" has the same name as your ${this.tables.has(o) ? 'table' : 'state, setting or let'} ${o}, so a bare ${o} would mean that.`, `write the option with a capital letter (${o[0].toUpperCase() + o.slice(1)}) or rename the ${this.tables.has(o) ? 'table' : 'value'}.`);
      }
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
  fieldType(type) {
    if (!type) return ANY;
    if (type.t === 'pick') { type.options.forEach(o => this.options.add(o)); return { t: 'pick', options: type.options }; }
    return type.t === 'ref' ? { t: 'ref', table: type.table } : type.t;
  }

  lookup(name) {
    for (let i = this.scopes.length - 1; i >= 0; i--) if (this.scopes[i].names.has(name)) return this.scopes[i].names.get(name);
    if (this.states.has(name)) return this.states.get(name);
    if (this.settings.has(name)) return this.settings.get(name);
    if (this.lets.has(name)) return this.lets.get(name);
    return null;
  }
  writable(name) {
    for (let i = this.scopes.length - 1; i >= 0; i--) if (this.scopes[i].names.has(name)) return !this.readonly.has(name) || this.states.has(name);
    if (this.lets.has(name)) return false;
    return this.states.has(name) || this.settings.has(name);
  }

  // ---------- paths ----------
  itHint() {
    const as = this.asNames();
    if (this.via) return `inside "${this.via}", "it" means that component's own item (for example each day of a chart). To use the item of an outer each, write "each X as NAME" and pass NAME.field (for example: each habit as h, then ${this.via} ..., count(h.check on it)).`;
    if (as.length) return `this each names its item "${as[as.length - 1]}"; write ${as[as.length - 1]}.field (with "as", "it" stays the outer item).`;
    return 'wrap this in each, or name the table instead.';
  }

  // mode: 'value' (a value), 'rows' (a table query), 'target' (something to write)
  path(p, mode = 'value') {
    let t;
    if (p.head === 'it') {
      t = this.curIt();
      if (!t && this.failed.has('it')) { this.followOn('it'); return ANY; }
      if (!t) return this.err('E_CONTEXT', '"it" only exists inside each (and inside folds such as maxof).', this.itHint());
    } else {
      const wt = this.whereTable && this.tb(this.whereTable);
      const isField = wt && (wt.fields.has(p.head) || p.head === 'at' || p.head === 'id');
      if (isField) t = this.rowField(this.whereTable, p.head);
      else if (this.lookup(p.head)) t = this.lookup(p.head);
      else if (this.tables.has(p.head)) t = { t: 'rows', table: p.head };
      else if (!p.parts.length && this.options.has(p.head) && mode === 'value') return 'text'; // a bare pick option word
      else {
        if (this.followOn(p.head)) return ANY;
        const known = [...this.tables.keys(), ...this.settings.keys(), ...this.states.keys(), ...this.lets.keys()];
        return this.err(mode === 'rows' ? 'E_UNKNOWN_TABLE' : 'E_UNKNOWN_NAME', `"${p.head}" is not a table, setting, state or let declared above${this.whereTable ? `, nor a field of ${this.whereTable}` : ''}.`, known.length ? `use one of: ${known.join(', ')}; or declare it first.` : 'declare it first (table, setting or state).');
      }
      if (tname(t) === 'fn') return this.err('E_TYPE', `${p.head} is a formula with values; call it like ${p.head}(...).`, `write ${p.head}(value, ...).`);
    }
    for (const part of p.parts) {
      if (isAny(t)) return t;
      t = this.step(t, part, p);
    }
    return t;
  }

  rowField(table, f) {
    if (f === 'at') return 'when';
    if (f === 'id') return 'num';
    const tb = this.tb(table);
    const fd = tb && tb.fields.get(f);
    return fd ? this.fieldType(fd.type) : ANY;
  }

  step(t, part, p) {
    const n = tname(t);
    const itNote = p && p.head === 'it' && (this.via || this.asNames().length) ? ' ' + this.itHint() : '';
    if (n === 'row' || n === 'ref' || n === 'draft') {
      const tb = this.tb(t.table);
      if (!tb) return ANY;
      if (this.failed.has(`${t.table}.${part}`)) return ANY; // that field's line failed; already reported
      if (tb.fields.has(part) || part === 'at' || part === 'id') return this.rowField(t.table, part);
      if (n !== 'draft') {
        const back = this.tb(part);
        if (back) {
          const refs = [...back.fields.values()].filter(f => f.type.t === 'ref' && f.type.table === t.table);
          if (refs.length === 1) return { t: 'rows', table: part, via: refs[0].name };
          if (refs.length > 1) return this.err('E_REF', `${part} has more than one link to ${t.table}, so .${part} is unclear.`, `use: ${part} where ${refs[0].name} = it.`);
          return this.err('E_REF', `${part} has no ref field pointing at ${t.table}${p && p.head === 'it' ? ` (here "it" is a ${t.table})` : ''}.`, (itNote.trim() || `add a field like "${t.table} ref ${t.table}" to table ${part}.`));
        }
      }
      return this.err('E_UNKNOWN_FIELD', `${t.table} has no field "${part}"${p && p.head === 'it' ? ` (here "it" is a ${t.table})` : ''}.`, `fields of ${t.table}: ${[...tb.fields.keys(), 'at'].join(', ')}.${itNote}`);
    }
    if (n === 'rows' && !t.field) {
      const tb = this.tb(t.table);
      if (!tb) return ANY;
      if (tb.fields.has(part) || part === 'at') return { ...t, field: part, ftype: this.rowField(t.table, part) };
      return this.err('E_UNKNOWN_FIELD', `${t.table} has no field "${part}".`, `fields of ${t.table}: ${[...tb.fields.keys(), 'at'].join(', ')}.`);
    }
    if (n === 'rows' && t.field && tname(t.ftype) === 'ref') {
      // a column of links followed further: drink.kind.name -> the name column of the linked rows
      const tb = this.tb(t.ftype.table);
      if (tb && (tb.fields.has(part) || part === 'at')) return { t: 'rows', table: t.table, field: t.field + '.' + part, ftype: this.rowField(t.ftype.table, part) };
    }
    if (n === 'group') {
      if (part === 'key') return t.key;
      const tb = this.tb(t.table);
      if (tb && (tb.fields.has(part) || part === 'at')) return { t: 'rows', table: t.table, field: part, ftype: this.rowField(t.table, part) };
      return this.err('E_UNKNOWN_FIELD', `a group has .key and the columns of ${t.table}; "${part}" is neither.`, 'use g.key, count(g) or sum(g.field).');
    }
    return this.err('E_TYPE', `${show(t)} has no part "${part}"${p && p.head === 'it' ? ' (here "it" is ' + show(t) + ')' : ''}.`, itNote.trim() || 'remove the .' + part + '.');
  }

  // ---------- queries, windows, sources ----------
  query(q, allowField = true) {
    let t = this.path(q.path, 'rows');
    if (isAny(t)) return t;
    if (tname(t) === 'group') t = { t: 'rows', table: t.table };
    if (tname(t) !== 'rows') {
      const shadow = q.path.parts.length && this.tb(q.path.parts[q.path.parts.length - 1]);
      return this.err('E_TYPE', `expected a table here, got ${show(t)}.`, shadow ? `"${q.path.parts[q.path.parts.length - 1]}" is read as a field, which hides the table of the same name; rename the field.` : 'name a table, like count(drink today).');
    }
    if (t.field && !allowField) this.err('E_TYPE', 'expected a table, not a column.', `drop .${t.field}.`);
    if (q.win) this.window(q.win);
    const tb = this.tb(t.table);
    if (q.where) this.inWhere(t.table, () => this.bool(q.where, 'the where condition'));
    if (q.by && tb) {
      if (typeof q.by === 'string') {
        if (!['day', 'week', 'month'].includes(q.by) && !tb.fields.has(q.by)) this.err('E_UNKNOWN_FIELD', `cannot group by "${q.by}": ${t.table} has no such field.`, `group by day, week, month or a field of ${t.table}.`);
      } else this.byPath(t.table, q.by);
    }
    if (q.sort) this.inWhere(t.table, () => {
      this.scopes.push({ it: { t: 'row', table: t.table }, names: new Map(), each: true });
      const st = this.expr(q.sort);
      this.scopes.pop();
      if (!isAny(st) && !['num', 'text', 'date', 'time', 'dur', 'bool'].includes(family(st))) this.err('E_TYPE', `cannot sort by ${show(st)}.`, `sort by a field of ${t.table}, at, or a formula of it.`);
    });
    return t;
  }

  inWhere(table, f) { const o = this.whereTable; this.whereTable = table; try { f(); } finally { this.whereTable = o; } }

  // by a field reached through links: by dish.cuisine
  byPath(table, p) {
    let cur = table; let ft = null;
    for (const part of [p.head, ...p.parts]) {
      const tb = this.tb(cur);
      const f = tb && tb.fields.get(part);
      if (!f) { this.err('E_UNKNOWN_FIELD', `cannot group by ${[p.head, ...p.parts].join('.')}: ${cur} has no field "${part}".`, `group by a field of ${cur}, or follow a ref field with a dot.`); return ANY; }
      ft = this.fieldType(f.type);
      if (f.type.t === 'ref') cur = f.type.table;
    }
    return ft;
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
          const tb = this.tb(t.table);
          let key;
          if (typeof s.q.by !== 'string') key = this.byPath(t.table, s.q.by);
          else key = ['day', 'week', 'month'].includes(s.q.by) ? 'date' : this.fieldType(tb?.fields.get(s.q.by)?.type || { t: 'text' });
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
      if (!this.writable(p.head) && !this.tables.has(p.head)) return this.err('E_TARGET', `"${p.head}" cannot be changed${this.lets.has(p.head) || this.readonly.has(p.head) ? ' (it is a let formula or an each item name)' : ''}.`, 'change a state, a setting, or a row field like it.done.');
    } else {
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
      if (s.win && ['all', 'last'].includes(s.win.k)) this.err('E_WINDOW', 'toggle marks one day; use today, yesterday, on DATE (or week/month for a once-a-period mark).', 'write toggle X today or toggle X on d.');
      if (s.where) this.whereEq(s.where, t.table);
      return;
    }
    if (s.win || s.where) return this.err('E_TYPE', 'only a table toggle takes a window or where.', 'remove them.');
    this.target(s.target);
    if (tname(t) !== 'bool') this.err('E_TYPE', `toggle needs a yes/no value or a table, got ${show(t)}.`, 'use a bool state, setting or field.');
  }
  whereEq(e, table) {
    const tb = this.tb(table);
    const ok = x => (x.k === 'bin' && x.op === 'and' && ok(x.a) && ok(x.b)) || (x.k === 'bin' && x.op === '=' && x.a.k === 'path' && !x.a.parts.length && tb && tb.fields.has(x.a.head));
    if (!ok(e)) this.err('E_TYPE', 'a toggle where may only say field = value (joined with and).', 'write where name = it.');
  }

  actions(list) { this.inAction++; try { for (const a of list) this.action(a); } finally { this.inAction--; } }
  action(a) {
    switch (a.a) {
      case 'add': {
        const tb = this.tb(a.table);
        if (!tb) { if (this.followOn(a.table)) return; return this.err('E_UNKNOWN_TABLE', `there is no table "${a.table}" declared above.`, `declare table ${a.table} first.`); }
        const set = new Set();
        for (const s of a.assigns) {
          if (!tb.fields.has(s.name) && s.name !== 'at' && this.failed.has(`${a.table}.${s.name}`)) continue;
          if (!tb.fields.has(s.name) && s.name !== 'at') { this.err('E_UNKNOWN_FIELD', `${a.table} has no field "${s.name}".`, `fields of ${a.table}: ${[...tb.fields.keys()].join(', ')}.`); continue; }
          set.add(s.name);
          this.assignable(this.rowField(a.table, s.name), this.expr(s.e), `${a.table}.${s.name}`, s.e);
        }
        for (const [n, f] of tb.fields) if (!f.optional && !f.dflt && f.type.t !== 'bool' && !set.has(n)) this.err('E_REQUIRED', `add ${a.table} must set ${n} (it is required and has no default).`, `add ${n} = ..., or mark the field optional with ? or give it = a default.`);
        return;
      }
      case 'set': { const t = this.target(a.target); this.assignable(t, this.expr(a.e), 'this set', a.e); return; }
      case 'setall': {
        const t = this.path(a.target, 'rows');
        if (isAny(t)) return;
        if (tname(t) !== 'rows' || !t.field || t.field.includes('.')) return this.err('E_TARGET', 'set all needs a column like item.got.', 'write set all item.got = no.');
        this.scopes.push({ it: { t: 'row', table: t.table }, names: new Map(), each: true });
        this.inWhere(t.table, () => { this.assignable(t.ftype, this.expr(a.e), `${t.table}.${t.field}`, a.e); if (a.where) this.bool(a.where, 'the where condition'); });
        this.scopes.pop();
        return;
      }
      case 'removeall': this.query(a.q, false); return;
      case 'toggle': return this.toggleT({ target: a.target, win: a.win, where: a.where });
      case 'edit': {
        if (a.e.k === 'path' && !a.e.parts.length && a.e.head !== 'it') {
          const t = this.lookup(a.e.head);
          if (t && tname(t) === 'row') return;
          if (this.settings.has(a.e.head) || (t && this.writable(a.e.head))) return;
        }
        const t = this.expr(a.e);
        if (!isAny(t) && tname(t) !== 'row') this.err('E_TYPE', `edit needs a row (like it), a setting or a state, got ${show(t)}.`, 'write edit it inside each, or edit goal.');
        return;
      }
      case 'remove': { const t = this.expr(a.e); if (!isAny(t) && tname(t) !== 'row') this.err('E_TYPE', `remove needs a row (like it), got ${show(t)}.`, 'write remove it inside each, or remove all TABLE where ....'); return; }
      case 'save': { const t = this.lookup(a.name); if (isAny(t) && t) return; if (!t || tname(t) !== 'draft') { if (this.followOn(a.name)) return; this.err('E_TARGET', `save needs a state made with "state ${a.name} new TABLE".`, `add: state ${a.name} new TABLE.`); } return; }
      case 'go': if (!this.screens.has(a.name)) this.err('E_UNKNOWN_NAME', `there is no screen "${a.name}" declared above.`, 'declare the screen first, or remove go (screens already get tabs).'); return;
      case 'notify': return this.parts(a.parts);
      case 'remind': { const t = this.expr(a.e); if (!isAny(t) && tname(t) !== 'dur') this.err('E_TYPE', 'remind ... in needs a duration like 10m.', 'write remind "Text" in 10m.'); return; }
      case 'param': return this.err('E_UNKNOWN_NAME', `"${a.name}" is not an action.`, 'use add, set, toggle, remove, edit, save, go, notify or remind.');
    }
  }

  optionOf(e) {
    if (!e) return null;
    if (e.k === 'str' || e.k === 'word') return e.v;
    if (e.k === 'path' && !e.parts.length && !this.lookup(e.head) && !this.tables.has(e.head) && this.options.has(e.head)) return e.head;
    return null;
  }

  assignable(target, val, what, e) {
    if (isAny(target) || isAny(val)) return;
    const o = this.optionOf(e);
    if (tname(target) === 'pick' && o !== null && !target.options.includes(o)) { this.err('E_OPTION', `"${o}" is not an option of ${what} (${target.options.join(', ')}).`, 'use one of the options, spelled the same.'); return; }
    if (tname(target) === 'draft') { this.err('E_TARGET', 'a new row cannot be set directly.', 'use field d or save d.'); return; }
    if (!this.compatible(target, val)) this.err('E_TYPE', `${what} is ${show(target)} but the value is ${show(val)}.`, 'give it a value of the same type.');
  }

  compatible(a, b) {
    if (isAny(a) || isAny(b)) return true;
    return family(a) === family(b);
  }

  // ---------- expressions ----------
  bool(e, what) { const t = this.expr(e); if (!isAny(t) && tname(t) !== 'bool') this.err('E_TYPE', `${what} must be yes/no, got ${show(t)}.`, 'compare it, like x > 0 or name = Fajr.'); }
  num(e, what) { const t = this.expr(e); if (!isAny(t) && !isNum(t)) this.err('E_TYPE', `${what} must be a number, got ${show(t)}.`, 'use a number or a formula that gives one.'); return t; }

  parts(ps) {
    for (const p of ps) {
      const t = this.expr(p);
      const n = tname(t);
      if (n === 'rows') this.err('E_TYPE', `a table cannot be shown as text; show a number from it.`, `use count(${t.table}) or each ${t.table}.`);
      if (n === 'draft' || n === 'color' || n === 'fn') this.err('E_TYPE', `${show(t)} cannot be shown as text.`, 'show one of its fields or call it.');
    }
  }

  expr(e) {
    if (!e) return ANY;
    switch (e.k) {
      case 'num': return 'num';
      case 'pi': return 'num';
      case 'str': case 'word': return 'text';
      case 'time': return 'time';
      case 'dur': return 'dur';
      case 'bool': return 'bool';
      case 'today': return 'date';
      case 'now': return 'when';
      case 'color': {
        // your own names win over colour words
        if (this.lookup(e.v)) return this.path({ k: 'path', head: e.v, parts: [] });
        return 'color';
      }
      case 'index': if (!this.inEach()) this.err('E_CONTEXT', 'index only exists inside each.', 'use it inside an each block.'); return 'num';
      case 'paren': return this.expr(e.a);
      case 'path': return this.path(e);
      case 'not': this.bool(e.a, 'not'); return 'bool';
      case 'neg': { const t = this.expr(e.a); if (!isAny(t) && !isNum(t) && tname(t) !== 'dur') this.err('E_TYPE', `cannot negate ${show(t)}.`, 'use a number.'); return t; }
      case 'bin': return this.bin(e);
      case 'agg': return this.agg(e);
      case 'fold': return this.fold(e);
      case 'fn': return this.fn(e);
      case 'qfn': {
        const t = this.query(e.q, false);
        if (e.fn === 'due') { const n = this.expr(e.e); if (!isAny(n) && !isNum(n)) this.err('E_TYPE', 'due(table, days) needs a number of days.', 'write due(water, 3).'); return 'bool'; }
        if (e.fn === 'nth') { this.num(e.e, 'nth position'); return isAny(t) ? ANY : { t: 'row', table: t.table }; }
        if (e.fn === 'anyrow') { if (!this.inAction) this.err('E_CONTEXT', 'random(table) picks a row, so it can only be used inside an action (tap, every, when).', 'store it: tap set pick = random(card).'); return isAny(t) ? ANY : { t: 'row', table: t.table }; }
        return ANY;
      }
      case 'ucall': {
        const ARITY = { if: 'three values: if(condition, value when yes, value when no)', clamp: 'three values: clamp(x, low, high)', min: 'one column (min(t.price)) or two numbers (min(a, b))', max: 'one column (max(t.price)) or two numbers (max(a, b))', has: 'two values: has(text, part)', pow: 'two values: pow(base, power)', addmonths: 'two values: addmonths(date, months)', plural: 'two values: plural(n, "day")', fixed: 'two values: fixed(x, decimals)', round: 'one value: round(x)', floor: 'one value', abs: 'one value', len: 'one value', due: 'a table and a number of days: due(water, 3)', nth: 'a table and a position: nth(card, 1)' };
        if (ARITY[e.name]) return this.err('E_ARGS', `${e.name}() has the wrong number of values.`, `${e.name}() needs ${ARITY[e.name]}.`);
        return this.err('E_UNKNOWN_NAME', `there is no formula "${e.name}(...)" declared above.`, `declare it first: let ${e.name}(x num) = ...`);
      }
    }
    return ANY;
  }

  selfCompare(e) {
    // where team = team: the field hides a state/setting/let of the same name
    if (!this.whereTable || e.a.k !== 'path' || e.b.k !== 'path' || e.a.parts.length || e.b.parts.length || e.a.head !== e.b.head || e.a.head === 'it') return false;
    const tb = this.tb(this.whereTable);
    if (!tb || !tb.fields.has(e.a.head)) return false;
    const hidden = this.lookup(e.a.head);
    this.err('E_SELF_COMPARE', `"${e.a.head} ${e.op} ${e.b.head}" compares the field ${e.a.head} of ${this.whereTable} with itself${hidden ? `; inside where, the field hides your ${this.states.has(e.a.head) ? 'state' : this.settings.has(e.a.head) ? 'setting' : 'name'} ${e.a.head}` : ''}.`, hidden ? `rename the ${this.states.has(e.a.head) ? 'state' : 'setting'} (for example "chosen_${e.a.head}") and compare with that.` : 'compare the field with a value or a state.');
    return true;
  }

  bin(e) {
    if (['=', '!=', '<', '>', '<=', '>='].includes(e.op) && this.selfCompare(e)) return 'bool';
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
        const o = pick && this.optionOf(pick[1]);
        if (pick && o !== null && !pick[0].options.includes(o)) this.err('E_OPTION', `"${o}" is not one of the options (${pick[0].options.join(', ')}).`, 'compare with one of the options, spelled the same.');
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
        if (family(a) === 'date' && nb === 'dur') return 'when';
        if (na === 'time' && nb === 'dur') return 'time';
        if (e.op === '-' && family(a) === 'date' && family(b) === 'date' && (na === 'date' || nb === 'date')) return 'num'; // whole days between
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
    if (isAny(t)) return AGG_NUM.includes(e.fn) ? 'num' : ANY;
    const f = e.fn;
    if (AGG_NUM.includes(f)) {
      if (f !== 'count' && t.field) this.err('E_TYPE', `${f}() counts days with rows; give it the table, not a column.`, `write ${f}(${t.table}).`);
      return 'num';
    }
    if (!t.field) {
      if (f === 'last' || f === 'first') return { t: 'row', table: t.table };
      return this.err('E_TYPE', `${f}() needs a number column like ${t.table}.amount (or two numbers: ${f}(a, b)).`, `write ${f}(${t.table}.FIELD ...).`);
    }
    if (f === 'last' || f === 'first') return t.ftype;
    if (!isNum(t.ftype) && tname(t.ftype) !== 'dur') return this.err('E_TYPE', `${f}() needs a number column; ${t.table}.${t.field} is ${show(t.ftype)}.`, tname(t.ftype) === 'time' ? `times of day cannot be added up; store a duration (dur) or a number, or use count() / last(${t.table}.${t.field}).` : `use count(${t.table}) for how many, or last(${t.table}.${t.field}) for the latest value.`);
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
    const timeLike = t => ['time', 'when', 'dur'].includes(tname(t));
    switch (e.fn) {
      case 'if':
        need(0, t => tname(t) === 'bool', 'a yes/no condition');
        if (!this.compatible(A[1], A[2])) this.err('E_TYPE', `if() gives ${show(A[1])} or ${show(A[2])}; both answers must be the same type.`, 'if() gives one value; to mix words and numbers write two text parts, or use if/else lines.');
        return isAny(A[1]) ? A[2] : A[1];
      case 'min': case 'max': [0, 1].forEach(i => need(i, t => isNum(t) || tname(t) === 'dur' || isDate(t), 'a number')); return A[0];
      case 'clamp': [0, 1, 2].forEach(i => need(i, isNum, 'a number')); return A[0];
      case 'round': case 'floor': case 'abs': need(0, t => isNum(t) || tname(t) === 'dur', 'a number'); return A[0];
      case 'sin': case 'cos': need(0, isNum, 'a number of degrees'); return 'num';
      case 'hue': need(0, isNum, 'a number from 0 to 360'); return 'color';
      case 'random':
        need(0, isNum, 'a whole number');
        if (!this.inAction) this.err('E_CONTEXT', 'random() can only be used inside an action (tap, every, when), so the screen does not change by itself.', 'store it: tap set roll = random(6), then show roll.');
        return 'num';
      case 'words': return 'text';
      case 'len': need(0, t => TEXTUAL.has(tname(t)), 'text'); return 'num';
      case 'has': need(0, t => TEXTUAL.has(tname(t)), 'text'); need(1, t => TEXTUAL.has(tname(t)), 'text'); return 'bool';
      case 'weekday': case 'monthday': case 'monthdays': case 'month': case 'year': need(0, isDate, 'a date'); return 'num';
      case 'dayname': case 'monthname': need(0, isDate, 'a date'); return 'text';
      case 'hour': case 'minute': case 'second': need(0, timeLike, 'a time, date and time, or duration'); return 'num';
      case 'addmonths': need(0, isDate, 'a date'); need(1, isNum, 'a number'); return A[0];
    }
    return ANY;
  }
}
