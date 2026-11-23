// MoldeScript v0 reference evaluator (headless, no rendering). Plain ES module with no Node-only
// APIs, so the same code runs in a browser. It loads a program, keeps tables, settings and state
// in memory, evaluates every formula against a fixed clock, performs actions (with undo), runs
// every/when events on tick, records notify/remind/edit in a log, and builds the UI TREE: plain
// JSON of level-1 nodes with resolved values and stable ids (see UITREE.md).
import { check } from './check.mjs';
import { ex as words } from './describe.mjs';
import { evolve, emptySchema, everOf, FORMAT } from './diff.mjs';
import { strip } from './format.mjs';

const DAY = 86400000;
const pad2 = n => String(n).padStart(2, '0');
const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// ---------- values ----------
export class Money { constructor(v) { this.v = v; } } // full precision in formulas; rounded to cents when shown or stored
export class DateV { constructor(s) { this.s = s; } }            // 'YYYY-MM-DD' (UTC)
export class When { constructor(ms) { this.ms = ms; } }          // ms since epoch (UTC)
export class TimeV { constructor(sec) { this.sec = ((sec % 86400) + 86400) % 86400; } } // seconds of the day
export class Dur { constructor(sec) { this.sec = sec; } }
export class Color { constructor(c) { this.c = c; } }
class Row { constructor(table, r) { this.table = table; this.r = r; } }
class RowSet { constructor(table, rows) { this.table = table; this.rows = rows; } }
class Column { constructor(set, path) { this.set = set; this.path = path; } }
class Group { constructor(table, key, rows) { this.table = table; this.key = key; this.rows = rows; } }
class Draft { constructor(table, key) { this.table = table; this.key = key; } }

// All calendar maths uses UTC fields of a shifted moment, so local time is one number: the
// offset (minutes east of UTC) set per app (load(src, {tz: 'local'}) or {tz: 300}).
let OFF = 0;
const shift = ms => ms + OFF * 60000;
// dateOf runs for every row of many queries: the day number is arithmetic, its text is remembered
const DAY_TEXT = new Map();
const dateOf = ms => { const n = Math.floor((ms + OFF * 60000) / 86400000); let d = DAY_TEXT.get(n); if (d === undefined) { d = new Date(n * 86400000).toISOString().slice(0, 10); DAY_TEXT.set(n, d); } return d; };
const msOfLocal = s => Date.parse(s + 'T00:00:00Z') - OFF * 60000; // the moment local midnight of s happens
const msOf = s => Date.parse(s + 'T00:00:00Z');
const addDays = (s, n) => dateOf(msOf(s) + n * DAY);
const weekdayOf = s => ((new Date(msOf(s)).getUTCDay() + 6) % 7) + 1; // Mon = 1
const monthDays = s => { const d = new Date(msOf(s)); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate(); };
const addMonths = (s, n) => {
  const d = new Date(msOf(s)); const y = d.getUTCFullYear(), m = d.getUTCMonth() + n, day = d.getUTCDate();
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return dateOf(Date.UTC(y, m, Math.min(day, last)));
};
const parseTime = t => { const [h, m] = t.split(':').map(Number); return h * 3600 + m * 60; };
const num = v => v === null || v === undefined ? null : v instanceof Money ? v.v : v instanceof Dur ? v.sec : typeof v === 'number' ? v : typeof v === 'boolean' ? (v ? 1 : 0) : null;

function cmpVal(a, b) {
  // a date against a date and time compares whole days (at <= today includes all of today)
  if (a instanceof DateV || b instanceof DateV) { const x = a instanceof DateV ? a.s : a instanceof When ? dateOf(a.ms) : null, y = b instanceof DateV ? b.s : b instanceof When ? dateOf(b.ms) : null; return x < y ? -1 : x > y ? 1 : 0; }
  if (a instanceof When) return a.ms - (b instanceof When ? b.ms : NaN);
  if (a instanceof TimeV) return a.sec - b.sec;
  if (typeof a === 'string') return a < b ? -1 : a > b ? 1 : 0;
  return num(a) - num(b);
}
function eq(a, b) {
  if (a === null || b === null || a === undefined || b === undefined) return false;
  if (a instanceof Row || b instanceof Row) return (a instanceof Row ? a.r.id : a) === (b instanceof Row ? b.r.id : b);
  if (a instanceof DateV || a instanceof When) { const da = a instanceof DateV ? a.s : dateOf(a.ms), db = b instanceof DateV ? b.s : b instanceof When ? dateOf(b.ms) : null; return da === db; }
  if (typeof a === 'string' || typeof b === 'string') return String(a) === String(b);
  return cmpVal(a, b) === 0;
}

// ---------- formatting (what a text part shows) ----------
// thousands separators from 10,000 up, so years and small amounts read naturally (2026, 2000 ml, 80,000)
const fmtNum = n => { const r = Math.round(n * 100) / 100; return Math.abs(r) >= 10000 ? r.toLocaleString('en-US', { maximumFractionDigits: 2 }) : String(r); };
export function fmt(v, ev) {
  if (v === null || v === undefined || (typeof v === 'number' && !isFinite(v))) return '–';
  if (typeof v === 'number') return fmtNum(v);
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'string') return ev && ev.env.options && ev.env.options.has(v) ? v.replace(/_/g, ' ') : v;
  if (v instanceof Money && ev && ev.currency) return ev.currency + ' ' + fmt(v, null);
  if (v instanceof Money) { const c = Math.round(v.v * 100) / 100; return Number.isInteger(c) ? fmtNum(c) : (Math.abs(c) >= 10000 ? c.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : c.toFixed(2)); } // rounded to cents only when shown
  if (v instanceof DateV) { const d = new Date(msOf(v.s)); const yr = ev && v.s.slice(0, 4) !== dateOf(ev.clock).slice(0, 4) ? ' ' + v.s.slice(0, 4) : ''; return `${WD[weekdayOf(v.s) - 1]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)}${yr}`; }
  if (v instanceof When) { const d = new Date(shift(v.ms)); return `${fmt(new DateV(dateOf(v.ms)), ev)} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`; }
  if (v instanceof TimeV) return `${pad2(Math.floor(v.sec / 3600))}:${pad2(Math.floor(v.sec % 3600 / 60))}`;
  if (v instanceof Dur) { const s = Math.round(Math.abs(v.sec)); const sg = v.sec < 0 ? '-' : ''; return s >= 3600 ? `${sg}${Math.floor(s / 3600)}:${pad2(Math.floor(s % 3600 / 60))}` : `${sg}${Math.floor(s / 60)}:${pad2(s % 60)}`; }
  if (v instanceof Row) return ev ? ev.summary(v) : `#${v.r.id}`;
  if (v instanceof Group) return fmt(v.key, ev);
  if (v instanceof Color) return v.c;
  return String(v);
}
// text parts join with one space; none before , . ; : ! ? % ) / and none after ( / #
export function joinParts(ps) {
  let out = '';
  for (const p of ps) {
    if (p === '') continue;
    if (out && !/^[,.;:!?%)\/]/.test(p) && !/[(\/#]$/.test(out)) out += ' ';
    out += p;
  }
  return out;
}

// ---------- the app ----------
export function load(source, opts = {}) {
  return new App(source, opts);
}

class App {
  constructor(source, opts) {
    this.currency = opts.currency || '';
    this.off = opts.tz === 'local' ? -new Date().getTimezoneOffset() : (typeof opts.tz === 'number' ? opts.tz : 0);
    OFF = this.off;
    // the host's clock: `now` when given; else (tests, a host without a clock) the time the data was saved; else a fixed day
    const taken = opts.data && typeof opts.data.clock === 'number' ? opts.data.clock : null;
    this.clock = opts.now !== undefined ? (typeof opts.now === 'number' ? opts.now : Date.parse(opts.now)) : taken ?? Date.parse('2026-11-23T10:00:00Z');
    this.log = [];
    this.undoStack = [];
    this.seq = 0;
    this.data = { tables: {}, settings: {}, state: {} };
    this.lastWhen = new Map();
    this.screen = null;
    this.random = mulberry(opts.seed || 1);
    // saved data with a damaged schema history is never touched: the app reports why and stops
    let bad = opts.data !== undefined ? badSnapshot(opts.data) : null;
    const up = !bad && opts.data ? upgradeSnapshot(opts.data) : null;
    if (up && up.error) bad = up.error;
    if (bad) {
      this.source = source; this.ok = false; this.errors = [`the saved data cannot be read safely: ${bad}. It was left untouched.`];
      this.rawData = opts.data; this.prog = { header: null, body: [] }; this.env = { tables: new Map(), settings: new Map() };
      this.map = { tables: {}, fields: {}, settings: {}, states: {} }; this.ever = emptySchema();
      return;
    }
    try {
      // the schema history: the snapshot's own (rebuilt if older-shaped), or a list of earlier programs, or new.
      // Rows that hold option names (older backups) get option references, read with the data's own history.
      if (opts.data) { this.restore(opts.data, true); if (up.ever) convertOptionRows(this.data, up.ever); }
      const loadWarnings = [];
      let ever = up && up.ever && up.ever.versions.length ? up.ever : null;
      if (opts.history) {
        if (!ever) ever = everOf(opts.history).ever;
        else { // the snapshot's maps win; the history only adds the steps after the snapshot's program
          const last = ever.versions[ever.versions.length - 1].src;
          const j = opts.history.map(h => strip(h)).lastIndexOf(last);
          if (j < 0) loadWarnings.push('the history given does not contain the program of this data, so it was not used.');
          else for (const h of opts.history.slice(j + 1)) {
            const r = evolve(ever, h);
            if (r.verdict === 'refused') { loadWarnings.push(`a later program of the history does not apply to this data (${r.refused[0]}); the steps from there on were not used.`); break; }
            if (r.verdict !== 'ask') ever = r.ever;
            if (r.warnings) loadWarnings.push(...r.warnings);
          }
        }
      }
      this.ever = ever || emptySchema();
      if (!this.ever.app) this.ever = { ...this.ever, app: opts.appId || newAppId() };
      // loading never acts as an edit and never renames: the stored program of the data is what runs
      const last = this.ever.versions[this.ever.versions.length - 1];
      let r;
      if (last && strip(source) !== last.src) {
        r = this.setProgram(last.src);
        r = { ...r, verdict: 'warn', warnings: ['the program given is not the stored program of this data; the stored program was loaded. Send the new program as an edit to change it.', ...loadWarnings] };
      } else {
        r = this.setProgram(last ? last.src : source);
        if (loadWarnings.length) r = { ...r, verdict: 'warn', warnings: loadWarnings };
      }
      convertOptionRows(this.data, this.ever);
      this.annotateOptions();
      this.migrateBlockState();
      this.deriveTouched();
      if (taken !== null && taken < this.clock) { this.catchUp(taken); this.undoStack = []; }
      this.edit = r;
    } catch (e) {
      this.ok = false; this.errors = ['the saved data could not be read (an unexpected shape); it was left untouched.'];
      this.rawData = opts.data; this.internalError = String(e && e.stack || e);
      this.prog = this.prog || { header: null, body: [] }; this.env = this.env || { tables: new Map(), settings: new Map() };
    }
  }

  // Load a program against the schema history: data stays keyed by storage slot.
  setProgram(source, opts = {}) {
    OFF = this.off;
    this.lastChange = null; this.undoGroup = null;
    const c = check(source);
    if (!c.ok) {
      if (!this.prog) { this.source = source; this.ok = false; this.errors = c.errors.map(String); this.prog = c.ast; this.env = { tables: new Map(), settings: new Map() }; this.map = { tables: {}, fields: {}, settings: {}, states: {} }; }
      return { verdict: 'refused', refused: c.errors.map(String), changes: [], notes: [] };
    }
    const r = evolve(this.ever, source, opts);
    if (r.verdict === 'refused' && this.prog) return r; // an unsafe edit: keep running the old version
    const oldForce = this.prog && this.prog.body ? new Map(this.prog.body.filter(x => x.kind === 'setting' && x.force).map(x => [this.map?.settings[x.name] ?? x.name, x.dflt ?? null])) : null;
    this.source = source;
    this.ok = c.ok && r.verdict !== 'refused'; this.errors = [...c.errors.map(String), ...(r.verdict === 'refused' ? r.refused : [])];
    this.prog = c.ast; this.env = c.ast.env || { tables: new Map(), settings: new Map() };
    if (r.verdict !== 'refused') this.ever = r.ever;
    if (r.verdict !== 'refused' && !opts.restore) this.renameBlockStates(c.ast);
    this.map = this.ever.versions.length ? this.ever.versions[this.ever.versions.length - 1].map : { tables: {}, fields: {}, settings: {}, states: {} };
    // the stored program is the recorded version's text: canonical, with no was (rule 2)
    if (r.verdict !== 'refused' && this.ever.versions.length) { this.source = this.ever.versions[this.ever.versions.length - 1].src; r.stored = this.source; }
    this.annotateOptions();
    // the stored value of a setting always wins over its default; only `setting x ... = v set` in an
    // edit writes it on purpose (once: when the marker or its value is new), and revert undoes that
    r.settingWrites = {};
    if ((r.verdict === 'safe' || r.verdict === 'warn') && oldForce) for (const sd of c.ast.body.filter(x => x.kind === 'setting' && x.force && x.dflt)) { // only an edit writes; loading never does
      const key = this.map.settings[sd.name];
      const was = oldForce && oldForce.get(key);
      if (was !== undefined && JSON.stringify(was) === JSON.stringify(sd.dflt)) continue;
      r.settingWrites[key] = key in this.data.settings ? this.data.settings[key] : null;
      this.data.settings[key] = this.litValue(sd.dflt, sd.type);
    }
    this.hasWhen = JSON.stringify(this.prog.body).includes('"kind":"when"');
    this.initData();
    // conditions that are already true stay known across edits and reloads, so they do not fire twice
    return r;
  }
  // tables and settings the program declares but the data lacks get their empty/default values
  initData() {
    if (!this.prog.header || this.prog.header.kind !== 'app') return;
    for (const [name] of this.env.tables) this.data.tables[this.tk(name)] ||= [];
    for (const s of this.prog.body) if (s.kind === 'setting' && !(this.sk(s.name) in this.data.settings)) this.data.settings[this.sk(s.name)] = s.dflt ? this.litValue(s.dflt, s.type) : this.emptyOf(s.type);
  }
  // name -> storage slot
  tk(table) { return this.map.tables[table] ?? table; }
  fk(table, f) { return this.map.fields[this.tk(table)]?.[f] ?? f; }
  sk(name) { return this.map.settings[name] ?? name; }
  stk(name) { return this.map.states[name] ?? name; }

  // An edit from the chat: a new program. Safe edits and restores of earlier versions apply and
  // keep all data; refused edits change nothing. Returns the diff result.
  applyEdit(source) {
    OFF = this.off;
    const before = this.source, ver = this.ever.versions.length - 1; // the version Undo goes back to, by index (texts can repeat)
    const r = this.setProgram(source);
    if (r.verdict !== 'refused') { this.versionsUndo = [...(this.versionsUndo || []), { src: before, ver, settings: r.settingWrites || {} }]; this.screen = null; if (r.changes && r.changes.length) this.touch(); }
    return r;
  }
  // Chat undo: go back to the previous program; data entered since stays.
  revert() {
    const prev = (this.versionsUndo || []).pop();
    if (!prev) return { verdict: 'none', changes: ['nothing to undo: this is the first version'], refused: [], notes: [] };
    const r = this.setProgram(prev.src || prev, { restore: true, version: prev.ver });
    // settings that the undone edit wrote on purpose (setting ... set) get their earlier value back
    if (prev.settings) for (const [k, v] of Object.entries(prev.settings)) this.data.settings[k] = v;
    this.screen = null;
    return r;
  }

  // ----- data -----
  snapshot() { return JSON.parse(JSON.stringify({ data: this.data, seq: this.seq, clock: this.clock, ever: this.ever, when: [...this.lastWhen].filter(([, v]) => v) })); } // when: conditions already true (they do not notify again after a reload)
  // Load a backup into this app. Its schema history is MERGED with the app's (never replaced by an
  // older one), so the next edit still knows every slot the program uses.
  // Load a backup. A backup is a whole app: by default it brings its own stored program, map and
  // versions with its data. {keepProgram: true} keeps the running program, allowed only when that
  // program is one of the backup's versions (then that version's map is used). A backup of another
  // app is refused. Refusals leave everything as it was.
  restore(snap, early, opts = {}) {
    this.lastChange = null; this.undoGroup = null;
    if (early && typeof early === 'object') { opts = early; early = false; }
    const bad = badSnapshot(snap);
    if (bad) return { ok: false, reason: bad };
    let bE = null, keepAt = -1;
    if (!early) {
      const up = upgradeSnapshot(snap);
      if (up.error) return { ok: false, reason: up.error };
      bE = up.ever && up.ever.versions.length ? JSON.parse(JSON.stringify(up.ever)) : null;
      // a new install (no stored value ever changed by a person, no edit applied) may adopt any backup;
      // otherwise the backup must carry this app's id
      if (bE && this.ever.touched && bE.app !== this.ever.app) return { ok: false, reason: bE.app ? 'this backup belongs to another app' : 'this backup does not say which app it belongs to, and this app already has data' };
      if (bE && opts.keepProgram) {
        keepAt = bE.versions.map(v => v.src).lastIndexOf(this.source);
        if (keepAt < 0) return { ok: false, reason: 'the running program is not one of the versions in this backup, so its names cannot be matched to the backup\'s data; restore the backup with its own program instead' };
      }
    }
    const s = JSON.parse(JSON.stringify(snap));
    const count = d => ({ rows: Object.values(d.tables || {}).reduce((a, t) => a + t.filter(r => !r.deleted).length, 0), settings: Object.keys(d.settings || {}).length, states: Object.keys(d.state || {}).length });
    const before = count(this.data);
    this.data = { tables: {}, settings: {}, state: {}, ...s.data };
    this.seq = Math.max(s.seq ?? 0, ...Object.values(this.data.tables).flat().map(r => r.id || 0), this.seq || 0);
    // the clock belongs to the host: a snapshot's clock only says when it was taken (see catchUp)
    if (Array.isArray(s.when)) this.lastWhen = new Map(s.when.filter(x => Array.isArray(x) && typeof x[0] === 'string').map(([k]) => [k, true]));
    if (!early) {
      if (bE) { // the backup's history, program and map come with it; slots are the identity
        convertOptionRows(this.data, bE);
        this.ever = { ...bE, app: bE.app || this.ever.app };
        this.prog = null; // the next setProgram is a load, not an edit
        if (keepAt >= 0) this.setProgram(this.source, { restore: true, version: keepAt });
        else this.setProgram(bE.versions[bE.versions.length - 1].src);
        this.versionsUndo = []; // Undo steps belonged to the program that was running
        this.ever = { ...this.ever, touched: true };
      } else { convertOptionRows(this.data, this.ever); if (this.ever.touched === undefined) this.deriveTouched(); } // data only: read with the running program's history
      this.annotateOptions();
      this.initData();
      this.screen = null;
      this.undoStack = []; // data Undo steps belonged to the data that was replaced
      if (typeof s.clock === 'number' && s.clock < this.clock) { this.catchUp(s.clock); this.undoStack = []; } // schedules catch up from when the backup was taken
    }
    return { ok: true, program: this.source, replaced: { before, after: count(this.data) } };
  }
  // pick fields: rows store option slot ids; the program's types learn id -> name (shown) and name -> id
  annotateOptions() {
    const learn = (type, slot) => {
      if (!type || !slot || !slot.opts) return;
      type.ids = {}; type.oid = {}; type.seenOid = {};
      for (const [ok, o] of Object.entries(slot.opts)) {
        type.ids[ok] = o.visible ?? lastSeen(o);
        if (o.visible !== null) type.oid[o.visible] = ok;
        for (const [n, v] of Object.entries(o.seen || {})) if (!type.seenOid[n] || type.seenOid[n].v < v) type.seenOid[n] = { ok, v };
      }
    };
    for (const [tn, td] of this.env.tables || []) for (const [fn, f] of td.fields || []) learn(f.type, this.ever.tables[this.tk(tn)]?.fields[this.fk(tn, fn)]);
    const body = this.prog.body || [];
    for (const st of [...body, ...body.filter(x => x.kind === 'screen').flatMap(x => x.children || [])]) {
      if (st.kind === 'setting') learn(st.type, this.ever.settings[this.sk(st.name)]);
      if (st.kind === 'state' && !st.draft) learn(st.type, this.ever.states[this.stk(st.name)]);
    }
  }
  // ---- data Undo: each step stores a DELTA (the cells, rows, settings and states it changed, as they
  // were), not a copy of all data. An operation that leaves the data as it was records no step.
  // step(fn, group): run fn as one step; with the same group key as the step on top (consecutive
  // changes to one input), it joins that step instead.
  step(fn, group = null) {
    const joining = group !== null && this.undoGroup === group && this.undoStack.length && this.undoStack[this.undoStack.length - 1].group === group;
    const base = joining ? this.undoStack[this.undoStack.length - 1].base : JSON.stringify({ data: this.data, seq: this.seq });
    const before = joining ? null : base;
    const out = fn();
    const now = JSON.stringify({ data: this.data, seq: this.seq });
    let open = false; // is the step on top this group's, so the next change of the same input may join it
    if (joining) { // the group's delta grows from the group's start
      const top = this.undoStack[this.undoStack.length - 1];
      top.delta = makeDelta(JSON.parse(base), this);
      if (now === base) this.undoStack.pop(); else open = true;
    } else if (now !== before) {
      this.undoStack.push({ delta: makeDelta(JSON.parse(before), this), group, base: group !== null ? before : undefined });
      if (this.undoStack.length > 50) this.undoStack.shift();
      open = true;
    }
    if (now !== (joining ? base : before)) this.touch();
    this.undoGroup = open ? group : null;
    return out;
  }
  undo() { this.lastChange = null; this.undoGroup = null; const s = this.undoStack.pop(); if (!s) return false; applyDelta(this, s.delta); this.initData(); this.undoEdges(); this.log.push({ kind: 'undo', at: this.clock }); return true; } // settings the program declares since get their starting value
  // saves made before the flag existed: derive it ONCE from the data (any row, any setting or literal
  // state off its default, or more than one version) and record it; from then on it is recorded
  deriveTouched() {
    if (this.ever.touched !== undefined) return;
    let t = this.ever.versions.length > 1 || Object.values(this.data.tables).some(rows => rows.some(r => !r.deleted));
    const body = this.prog && this.prog.body || [];
    for (const st of [...body, ...body.filter(x => x.kind === 'screen').flatMap(x => x.children || [])]) {
      if (t) break;
      if (st.kind === 'setting') { const k = this.sk(st.name); if (k in this.data.settings && JSON.stringify(this.data.settings[k]) !== JSON.stringify(st.dflt ? this.litValue(st.dflt, st.type) : this.emptyOf(st.type))) t = true; }
      if (st.kind === 'state' && !st.draft) { const k = `|${this.stk(st.name)}`; if (k in this.data.state) { const lit = st.init && ['num', 'str', 'word', 'bool'].includes(st.init.k) ? this.unwrap(st.init.k === 'bool' ? st.init.v : st.init.v, st.type) : st.init ? undefined : (st.type.t === 'bool' ? false : null); if (lit === undefined || JSON.stringify(lit) !== JSON.stringify(this.data.state[k])) t = true; } }
    }
    this.ever = { ...this.ever, touched: !!t };
  }
  // an app whose stored values a person (or an edit) has changed is no longer a new install
  touch() { if (this.ever && !this.ever.touched) this.ever = { ...this.ever, touched: true }; }
  rows(table) { return (this.data.tables[this.tk(table)] || []).filter(r => !r.deleted); }
  // THE boundary out: a stored option reference leaves the evaluator as the option's name, never as {o}
  ext(raw, type) { return isOptRef(raw) ? (type && type.ids && raw.o in type.ids ? type.ids[raw.o] : raw.o.slice(1)) : raw; }
  // a stored cell as the program reads it; {raw: true} gives the stored form
  cell(table, row, f, opts = {}) { const fd = this.fieldDef(table, f); const v = row[this.fk(table, f)]; return opts.raw ? v : this.ext(v, fd && fd.type); }
  // a row by id, through an index kept per stored table (rebuilt when the table array or its length changes)
  rowById(tk, id) {
    const arr = this.data.tables[tk]; if (!arr) return null;
    const ix = (this._ids ||= new Map()).get(tk);
    let m = ix && ix.arr === arr && ix.len === arr.length ? ix.m : null;
    if (!m) { m = new Map(arr.map(r => [r.id, r])); this._ids.set(tk, { arr, len: arr.length, m }); }
    return m.get(id) || null;
  }
  fieldDef(table, f) { return this.env.tables.get(table)?.fields.get(f) || null; }
  emptyOf(type) { return type && type.t === 'bool' ? false : null; }

  // stored (JSON) -> value
  wrap(raw, type) {
    if (raw === null || raw === undefined) return type && type.t === 'bool' ? false : null;
    if (isOptRef(raw)) raw = type && type.ids && raw.o in type.ids ? type.ids[raw.o] : raw.o.slice(1); // an option reference {o: slot} reads as its name
    switch (type && type.t) {
      case 'money': return new Money(raw);
      case 'date': return new DateV(typeof raw === 'number' ? dateOf(raw) : raw);
      case 'when': return new When(typeof raw === 'string' ? msOfLocal(raw) + 12 * 3600000 : raw);
      case 'time': return new TimeV(raw);
      case 'dur': return new Dur(raw);
      case 'ref': { const r = this.rowById(this.tk(type.table), raw); return r && !r.deleted ? new Row(type.table, r) : null; }
      default: return raw;
    }
  }
  // value -> stored (JSON), coerced to the field type
  // value -> stored. THE boundary in: a plain object (an option reference included) never enters, and a
  // name that is no option of a pick is rejected; REJECT means "leave the stored value as it is".
  unwrap(v, type) {
    if (v === null || v === undefined) return null;
    if (v === REJECT || Array.isArray(v) || (typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype)) return REJECT;
    if (type && type.t === 'pick' && type.oid) { // a name is stored as a reference to its option slot; a stale name to the slot last seen under it
      const n = String(v), ok = type.oid[n] ?? type.seenOid?.[n]?.ok;
      return ok ? { o: ok } : REJECT;
    }
    switch (type && type.t) {
      case 'num': { const n = num(v); return n === null ? null : n; }
      case 'money': { const n = num(v); return n === null ? null : Math.round(n * 100) / 100; }
      case 'date': return v instanceof DateV ? v.s : v instanceof When ? dateOf(v.ms) : typeof v === 'string' ? v : null;
      case 'when': return v instanceof When ? v.ms : v instanceof DateV ? msOfLocal(v.s) + 12 * 3600000 : typeof v === 'number' ? v : null;
      case 'time': return v instanceof TimeV ? v.sec : typeof v === 'string' && /:/.test(v) ? parseTime(v) : num(v);
      case 'dur': return v instanceof Dur ? v.sec : num(v);
      case 'bool': return !!v;
      case 'ref': { const id = v instanceof Row ? v.r.id : typeof v === 'number' ? v : null; return id !== null && (this.data.tables[this.tk(type.table)] || []).some(x => x.id === id && !x.deleted) ? id : REJECT; } // a link must point at a row that exists
      default: return v instanceof Row ? this.summary(v) : typeof v === 'string' ? v : fmt(v, this);
    }
  }
  clampTo(stored, f) {
    if (f && f.range && typeof stored === 'number') {
      if (stored < f.range.lo) return f.range.lo;
      if (f.range.hi !== null && stored > f.range.hi) return f.range.hi;
    }
    return stored;
  }
  litValue(l, type) {
    switch (l.k) {
      case 'num': return type && type.t === 'money' ? l.v : l.v;
      case 'str': case 'word': { if (!(type && type.t === 'pick' && type.oid)) return l.v; const u = this.unwrap(l.v, type); return u === REJECT ? null : u; }
      case 'bool': return l.v;
      case 'time': return parseTime(l.v);
      case 'date': return type && type.t === 'when' ? msOfLocal(l.v) : l.v;
      case 'dur': return l.v;
      case 'today': return type && type.t === 'when' ? this.clock : dateOf(this.clock);
      case 'now': return type && type.t === 'date' ? dateOf(this.clock) : this.clock;
    }
    return null;
  }
  summary(row) {
    const tb = this.env.tables.get(row.table);
    const parts = [];
    for (const [name, f] of tb ? tb.fields : []) {
      const v = this.wrap(row.r[this.fk(row.table, name)], f.type);
      if (v === null || v === '' || f.type.t === 'image' || (f.type.t === 'bool' && !v)) continue;
      parts.push(f.type.t === 'bool' ? (f.label || name) : f.type.t === 'ref' ? this.summary(v).split(' · ')[0] : fmt(v, this) + (f.unit ? ' ' + f.unit : ''));
    }
    return parts.length ? parts.join(' · ') : fmt(new When(row.r.at), this);
  }

  addRow(table, values, atMs) {
    this.lastChange = null; this.undoGroup = null;
    const tb = this.env.tables.get(table);
    if (!tb) return null;
    const r = { id: this.seq + 1, at: atMs ?? this.clock, _rnd: Math.round(this.random() * 1e6) / 1e6 };
    for (const [name, f] of tb.fields) {
      let v = values[name];
      if (v === undefined && f.dflt) v = this.wrap(this.litValue(f.dflt, f.type), f.type);
      const u = v === undefined ? (f.type.t === 'bool' ? false : null) : this.unwrap(v, f.type);
      if (u === REJECT) { this.log.push({ kind: 'error', text: `${table}.${name}: not a value of this field`, at: this.clock }); return null; }
      r[this.fk(table, name)] = this.clampTo(u, f);
    }
    if (values.at !== undefined) r.at = this.unwrap(values.at, { t: 'when' });
    const missing = [...tb.fields].filter(([n, f]) => !f.optional && f.type.t !== 'bool' && (r[this.fk(table, n)] === null || r[this.fk(table, n)] === '')).map(([n]) => n);
    if (missing.length) { this.log.push({ kind: 'error', text: `${table} needs ${missing.join(', ')}`, at: this.clock }); return null; }
    this.seq = r.id; (this.data.tables[this.tk(table)] ||= []).push(r); this.touch(); // an id is used only when the row is stored
    return r;
  }

  // ----- clock and events -----
  today() { return dateOf(this.clock); }
  // time passed between a save and now: schedules catch up (P2) as if the clock had run from `from`
  catchUp(from) { const now = this.clock; this.clock = from; this.tick(now - from); this.clock = now; }
  // A tick moves the host clock and is ONE undo step (if it changed data). Schedules catch up without
  // stepping second by second: each `every` fires as many times as its period fits into the interval,
  // at most CATCH_UP times per tick (the rest are skipped and noted in the log); `after` actions run
  // in due order; `when` conditions are evaluated once at the end.
  tick(ms) {
    this.lastChange = null;
    if (!(ms > 0)) { this.step(() => this.runWhen()); return; }
    this.step(() => {
      const end = this.clock + ms;
      const { handlers } = this.build();
      // after: run in due order, with the clock at each due time
      for (const p of (this.pending || []).filter(p => p.due <= end).sort((a, b) => a.due - b.due)) {
        this.pending = this.pending.filter(x => x !== p);
        this.clock = Math.max(this.clock, p.due); this.act(p.act, p.env);
      }
      const start = this.clock;
      for (const h of handlers.every) {
        const acc0 = this.everyAcc.get(h.key) || 0;
        const all = Math.floor((acc0 + ms) / h.period);
        this.everyAcc.set(h.key, (acc0 + ms) % h.period);
        const skip = Math.max(0, all - CATCH_UP);
        if (skip) this.log.push({ kind: 'skipped', every: h.key, fires: skip, at: end });
        for (let i = skip; i < all; i++) { // the latest fires run, each at its own time
          this.clock = start + (i + 1) * h.period - acc0;
          if (h.cond && !this.truthy(h.cond())) continue;
          this.run(h.actions, h.env, false);
        }
        this.clock = start;
      }
      this.clock = end;
      this.runWhen();
    });
  }
  // actions scheduled with `after DUR` run when the clock reaches them
  runPending() {
    const due = (this.pending || []).filter(p => p.due <= this.clock);
    this.pending = (this.pending || []).filter(p => p.due > this.clock);
    for (const p of due) this.act(p.act, p.env);
  }
  get everyAcc() { return this._ea || (this._ea = new Map()); }
  runWhen() {
    if (!this.hasWhen) return;
    for (let guard = 0; guard < 5; guard++) {
      const { handlers } = this.build();
      let fired = false;
      for (const h of handlers.when) {
        const v = this.truthy(h.cond());
        const was = this.lastWhen.get(h.key) || false;
        this.lastWhen.set(h.key, v);
        if (v && !was) { this.run(h.actions, h.env, false); fired = true; }
      }
      if (!fired) return;
    }
  }
  truthy(v) { return v === true; }
  // after Undo a condition that is no longer true may fire again
  undoEdges() { if (!this.hasWhen) return; for (const h of this.build().handlers.when) if (!this.truthy(h.cond())) this.lastWhen.set(h.key, false); }

  // ----- UI -----
  tree() { return this.build().tree; }
  dispatch(id, event = 'tap', payload) {
    const { handlers } = this.build();
    const h = handlers.nodes.get(id);
    if (!h || !h[event]) { this.log.push({ kind: 'error', text: `no ${event} on ${id}`, at: this.clock }); return false; }
    // typing into one input is one undo step: consecutive changes of the same node share it
    const group = event === 'change' && this.lastChange === id ? id : event === 'change' ? id : null;
    if (!(event === 'change' && this.lastChange === id)) this.undoGroup = null;
    this.lastChange = event === 'change' ? id : null;
    this.step(() => { h[event](payload); this.runWhen(); }, group);
    return true;
  }
  find(pred, node = this.tree()) {
    if (pred(node)) return node;
    for (const c of node.children || []) { const f = this.find(pred, c); if (f) return f; }
    return null;
  }
  findAll(pred, node = this.tree(), out = []) {
    if (pred(node)) out.push(node);
    for (const c of node.children || []) this.findAll(pred, c, out);
    return out;
  }
  reminders() {
    OFF = this.off;
    const out = [];
    for (const s of this.prog.body || []) if (s.kind === 'remind') {
      const base = { text: s.text, cond: s.cond ? this.truthy(this.evalIn(s.cond, this.rootEnv())) : true };
      if (s.at) {
        const tbn = s.at.head; const field = s.at.parts[0]; const f = this.fieldDef(tbn, field);
        for (const r of this.rows(tbn)) {
          const v = this.wrap(r[this.fk(tbn, field)], f?.type);
          if (v instanceof TimeV) out.push({ ...base, daily: fmt(v) });
          else if (v instanceof DateV || v instanceof When) {
            const ms = (v instanceof DateV ? msOfLocal(v.s) + (s.time ? parseTime(s.time) * 1000 : 9 * 3600000) : v.ms) + (s.offset || 0) * 1000;
            if (ms < this.clock) continue; // reminders in the past are skipped
            out.push({ ...base, once: new Date(ms).toISOString() });
          }
        }
      } else if (s.monthly) { // a day past the month's end (on 31 in November) fires on its last day
        const [y0, m0] = dateOf(this.clock).split('-').map(Number);
        let next = null;
        for (let k = 0; k < 3 && next === null; k++) {
          const y = y0 + Math.floor((m0 - 1 + k) / 12), m = (m0 - 1 + k) % 12 + 1, last = new Date(Date.UTC(y, m, 0)).getUTCDate();
          const cands = s.monthly.flatMap(d => s.times.map(t => msOfLocal(`${y}-${String(m).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`) + parseTime(t) * 1000)).filter(ms => ms >= this.clock).sort((a, b) => a - b);
          if (cands.length) next = new Date(cands[0]).toISOString();
        }
        out.push({ ...base, monthly: s.monthly, times: s.times, next });
      }
      else if (s.every !== undefined) out.push({ ...base, every: s.every, from: s.from, to: s.to });
      else out.push({ ...base, times: s.times, days: s.days || [] });
    }
    return out;
  }

  rootEnv() { return { vars: new Map(), it: null, index: null, scope: '', where: null, parent: null, draw: null }; }
  child(env, o) { return { ...env, vars: new Map(), parent: env, ...o }; }

  // build() renders the tree and its handlers. The result is reused while the program, the clock,
  // the screen and the stored data are the same (a render can be most of the cost of a tap).
  build() {
    OFF = this.off;
    const bk = this._bk;
    if (bk && bk.prog === this.prog && bk.clock === this.clock && bk.screen === this.screen) {
      const key = JSON.stringify(this.data);
      if (key === bk.data) { this.H = bk.res.handlers; return bk.res; }
    }
    const res = this.buildNow();
    this._bk = { prog: this.prog, clock: this.clock, screen: this.screen, data: JSON.stringify(this.data), res };
    return res;
  }
  buildNow() {
    const handlers = { nodes: new Map(), every: [], when: [] };
    this.H = handlers;
    const h = this.prog.header || {};
    const root = { id: 'app', t: 'app', name: h.name || '', icon: h.icon || null, theme: h.theme || null, screens: [], children: [] };
    if (!h || h.kind !== 'app') return { tree: root, handlers };
    const env = this.rootEnv();
    const screens = this.prog.body.filter(s => s.kind === 'screen');
    if (screens.length) {
      const hasMain = this.prog.body.some(s => !['screen', 'table', 'setting', 'state', 'let', 'remind', 'def', 'every', 'when'].includes(s.kind));
      root.screens = [...(hasMain ? [{ name: '_main', label: h.name }] : []), ...screens.map(s => ({ name: s.name, label: s.label, icon: s.icon || null }))];
      if (!this.screen) this.screen = root.screens[0].name;
      root.screen = this.screen;
      for (const sc of root.screens) { const id = 'tab:' + sc.name; handlers.nodes.set(id, { tap: () => { this.screen = sc.name; } }); sc.id = id; }
    }
    root.children = this.render(this.prog.body, env, 'n', { top: true, main: !screens.length || this.screen === '_main' });
    return { tree: root, handlers };
  }

  render(list, env, pid, cx) {
    const out = [];
    let lastIf = null;
    list.forEach((s, i) => {
      const id = `${pid}.${i}`;
      try {
        const got = this.node(s, env, id, cx, lastIf);
        if (s.kind === 'if') lastIf = got.taken;
        else if (s.kind !== 'else') lastIf = null;
        if (!(cx.top && cx.main === false && s.kind !== 'screen')) out.push(...(got.nodes || []));
      } catch (e) {
        out.push({ id, t: 'error', text: String(e && e.message || e), line: s.line });
      }
    });
    return out;
  }

  style(mods, env) {
    const st = {};
    for (const m of mods || []) {
      switch (m.m) {
        case 'big': case 'head': case 'faint': st.role = m.m; break;
        case 'bold': case 'card': case 'grow': case 'middle': case 'full': case 'axes': case 'gridlines': st[m.m] = true; break;
        case 'size': case 'align': st[m.m] = m.v; break;
        case 'pad': case 'gap': case 'span': st[m.m] = m.v; break;
        case 'color': case 'fill': case 'stroke': { const v = this.evalIn(m.e, env); st[m.m] = v instanceof Color ? v.c : v === null ? null : String(v); break; }
        case 'tap': case 'swipe': case 'alt': case 'bar': break; // see events(): a11y and bar are node properties
        default: { const v = num(this.evalIn(m.e, env)); st[m.m] = v; }
      }
    }
    return st;
  }
  events(mods, env, id, node) {
    const alt = (mods || []).find(m => m.m === 'alt');
    if (alt) node.a11y = alt.v; // the accessible name the author gave; nodes with their own text use that text
    if ((mods || []).some(m => m.m === 'bar')) node.bar = true;
    const tap = (mods || []).find(m => m.m === 'tap'), swipe = (mods || []).find(m => m.m === 'swipe');
    if (!tap && !swipe) return;
    const h = this.H.nodes.get(id) || {};
    if (tap) { h.tap = () => this.run(tap.actions, env, true); node.tap = true; node.action = tap.actions[0] && (tap.actions[0].a === 'param' ? 'other' : tap.actions[0].a); }
    if (swipe) { h.swipe = () => this.run(swipe.actions, env, true); node.swipe = true; }
    this.H.nodes.set(id, h);
  }

  // what an each goes over, independent of where the each is written: a table (its slot), a link
  // path, the options of a pick (its slot), days, or a list
  eachSig(src) {
    if (src.k === 'query') { const p = src.q.path; return 'q:' + (p.head !== 'it' && this.env.tables.has(p.head) ? this.tk(p.head) : p.head) + (p.parts.length ? '.' + p.parts.join('.') : ''); }
    if (src.k === 'options') return 'o:' + (src.path.parts.length ? `${this.tk(src.path.head)}.${this.fk(src.path.head, src.path.parts[0])}` : src.path.head);
    if (src.k === 'days') return 'd';
    return 'l';
  }
  // keys of state inside an each made before round 10 (by line position: /n.4.1@r12|open) become
  // keys by what the each goes over; state of rows that are gone is dropped
  migrateBlockState() {
    const st = this.data.state || {};
    for (const k of Object.keys(st)) {
      if (!k.startsWith('/')) continue;
      const bar = k.lastIndexOf('|'), segs = k.slice(1, bar).split('/'), name = k.slice(bar + 1);
      let nk = '', ok = true;
      for (const seg of segs) {
        const at = seg.lastIndexOf('@'); if (at < 0) { ok = false; break; }
        const id = seg.slice(0, at), item = seg.slice(at + 1);
        if (/^[a-z]:|^[dl]$/.test(id)) { nk += '/' + seg; continue; } // already the new form
        const path = id.replace(/@[^.]*/g, '').split('.').slice(1).map(Number);
        let node = null, list = this.prog.body;
        for (const ix of path) { node = list && list[ix]; list = node && node.children; }
        if (!node || node.kind !== 'each') { ok = false; break; }
        const sig = this.eachSig(node.source);
        const it2 = node.source.k === 'options' ? (this.sourceItems(node.source, this.rootEnv()).find(x => x.v === item)?.key ?? item) : item;
        nk += `/${sig}@${it2}`;
      }
      const v = st[k]; delete st[k];
      if (ok) st[`${nk}|${name}`] = v;
    }
    // state of rows that no longer exist goes
    for (const k of Object.keys(st)) {
      if (!k.startsWith('/')) continue;
      const m = /\/q:([^/@.]+)@r(\d+)[^/]*$/.exec(k.slice(0, k.lastIndexOf('|')));
      if (m && this.data.tables[m[1]] && !this.rowById(m[1], +m[2])) delete st[k];
    }
  }
  // `state NEW ... was OLD` inside an each: the per-item values move to the new name (once: the
  // stored program has no was)
  renameBlockStates(ast) {
    const walk = (list, inEach) => { for (const s of list || []) {
      if (s.kind === 'state' && s.was && inEach) for (const k of Object.keys(this.data.state || {})) if (k.startsWith('/') && k.endsWith('|' + s.was)) { this.data.state[k.slice(0, -s.was.length) + s.name] = this.data.state[k]; delete this.data.state[k]; }
      walk(s.children, inEach || s.kind === 'each');
    } };
    walk(ast.body, false);
  }
  stateKey(env, name) { return env.scope === '' ? `|${this.stk(name)}` : `${env.scope}|${name}`; }
  declareState(s, env) {
    const key = this.stateKey(env, s.name);
    if (!(key in this.data.state)) {
      if (s.draft) this.data.state[key] = this.newDraft(s.draft);
      else { const u = s.init ? this.unwrap(this.evalIn(s.init, env), s.type) : (s.type.t === 'bool' ? false : null); this.data.state[key] = u === REJECT ? null : u; }
    }
    else if (s.draft) this.data.state[key] = this.reconcileDraft(this.data.state[key], s.draft);
    env.vars.set(s.name, { state: key, type: s.draft ? { t: 'draft', table: s.draft } : s.type, keep: s.keep });
  }
  newDraft(table) {
    const d = {};
    const tb = this.env.tables.get(table);
    // a draft is keyed by field SLOT (and records its table slot), so it follows renames
    d._t = this.tk(table);
    for (const [n, f] of tb ? tb.fields : []) d[this.fk(table, n)] = this.draftDefault(f);
    return d;
  }
  draftDefault(f) { if (f.dflt) { const v = this.litValue(f.dflt, f.type); return v === REJECT ? null : v; } return f.type.t === 'bool' ? false : null; }
  // bring a draft in line with the form's current fields: renamed fields keep their value (same slot),
  // new fields get their default, dropped fields go, a value the field's type cannot hold is reset
  reconcileDraft(d, table) {
    const tb = this.env.tables.get(table);
    if (!tb || !d || typeof d !== 'object') return d;
    const out = { _t: this.tk(table), ...(d._missing ? { _missing: d._missing } : {}) };
    const legacy = d._t === undefined; // drafts saved before round 9 were keyed by field name
    for (const [n, f] of tb.fields) {
      const fk = this.fk(table, n);
      const v = legacy ? d[n] : d[fk];
      if (v === undefined) { out[fk] = this.draftDefault(f); continue; }
      out[fk] = v === null || this.fits(v, f.type) ? v : this.draftDefault(f);
    }
    if (out._missing) out._missing = out._missing.filter(k => k in out && (out[k] === null || out[k] === '')); // field slots: a renamed field keeps its message
    return out;
  }
  // can a stored value be read as this type?
  fits(v, type) {
    switch (type.t) {
      case 'num': case 'money': case 'dur': case 'time': case 'when': return typeof v === 'number';
      case 'date': return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
      case 'bool': return typeof v === 'boolean';
      case 'pick': return isOptRef(v) && !!type.ids && v.o in type.ids;
      case 'ref': return typeof v === 'number';
      default: return typeof v === 'string' || isOptRef(v);
    }
  }

  node(s, env, id, cx, lastIf) {
    const N = (o) => { if (o.a11y === undefined && (o.label !== undefined || o.t === 'icon')) o.a11y = o.t === 'icon' ? o.name : o.label; return { nodes: [o] }; }; // a11y: the accessible name
    switch (s.kind) {
      case 'table': case 'setting': case 'remind': case 'def': return { nodes: [] };
      case 'state': this.declareState(s, env); return { nodes: [] };
      case 'let': if (!s.params) env.vars.set(s.name, { let: s.e, env }); return { nodes: [] };
      case 'every': this.H.every.push({ key: id, period: s.every * 1000, cond: s.cond ? () => this.evalIn(s.cond, env) : null, actions: s.actions, env }); return { nodes: [] };
      case 'when': this.H.when.push({ key: id, cond: () => this.evalIn(s.cond, env), actions: s.actions, env }); return { nodes: [] };
      case 'screen': {
        const visible = this.screen === s.name;
        const kids = this.render(s.children, this.child(env, {}), id, { top: false }); // hidden screens still run their states and events
        return visible ? N({ id, t: 'screen', name: s.name, label: s.label, children: kids }) : { nodes: [] };
      }
      case 'use': return { nodes: this.render(s.children, this.child(env, {}), id, cx) };
      case 'if': {
        const taken = this.truthy(this.evalIn(s.cond, env));
        return { taken, nodes: taken ? this.render(s.children, this.child(env, {}), id, cx) : [] };
      }
      case 'else': return { nodes: lastIf === false ? this.render(s.children, this.child(env, {}), id, cx) : [] };
      case 'each': {
        const items = this.sourceItems(s.source, env);
        const sig = this.eachSig(s.source);
        const out = [];
        items.forEach((item, i) => {
          const key = item.key;
          // state inside an each is kept per (what the each goes over, the item): not by line position, so edits above it keep it
          const scope = `${env.scope}/${sig}@${key}`;
          const e2 = this.child(env, s.as ? { index: i, scope } : { it: item.v, index: i, scope });
          if (s.as) e2.vars.set(s.as, { value: item.v });
          out.push(...this.render(s.children, e2, `${id}@${key}`, cx));
        });
        if (!items.length && s.empty) out.push({ id: id + ':empty', t: 'text', text: s.empty, style: { role: 'faint' }, empty: true });
        return { nodes: out };
      }
      case 'box': {
        const node = { id, t: s.box, ...(s.cols ? { cols: s.cols } : {}), style: this.style(s.mods, env), children: this.render(s.children, this.child(env, {}), id, cx) };
        this.events(s.mods, env, id, node);
        return N(node);
      }
      case 'draw': {
        const node = { id, t: 'draw', w: s.w, h: s.h, style: this.style(s.mods, env) };
        this.events(s.mods, env, id, node);
        node.children = this.render(s.children, this.child(env, { draw: { w: s.w, h: s.h } }), id, cx);
        return N(node);
      }
      case 'plot': {
        const rng = r => { let lo = num(this.evalIn(r[0], env)) ?? 0, hi = num(this.evalIn(r[1], env)) ?? 1; if (!(hi > lo)) hi = lo + 1; return [lo, hi]; };
        const x = rng(s.x), y = rng(s.y);
        const st = this.style(s.mods, env);
        const node = { id, t: 'plot', x, y, axes: !!st.axes, gridlines: !!st.gridlines, style: st };
        delete st.axes; delete st.gridlines;
        this.events(s.mods, env, id, node);
        const kids = this.render(s.children, this.child(env, { draw: { w: x[1] - x[0], h: y[1] - y[0], cx: (x[0] + x[1]) / 2, cy: (y[0] + y[1]) / 2 }, oldestFirst: true }), id, cx);
        const xt = kids.filter(k => k.t === 'tick' && k.axis !== 'y').map(k => ({ v: k.x, label: k.text }));
        const yt = kids.filter(k => k.t === 'tick' && k.axis === 'y').map(k => ({ v: k.x, label: k.text }));
        node.children = kids.filter(k => k.t !== 'tick');
        node.ticks = { x: xt.length ? xt : (node.axes ? niceTicks(x[0], x[1]).map(v => ({ v, label: fmt(v) })) : []), y: yt.length ? yt : node.axes || node.gridlines ? niceTicks(y[0], y[1]).map(v => ({ v, label: fmt(v) })) : [] };
        return N(node);
      }
      case 'tick': return N({ id, t: 'tick', axis: s.axis, x: num(this.evalIn(s.x, env)), text: this.textOf(s.parts, env) });
      case 'poly': {
        const pts = [];
        const collect = (list, e) => {
          let li = null;
          for (const c of list) {
            if (c.kind === 'pt') pts.push([num(this.evalIn(c.x, e)), num(this.evalIn(c.y, e))]);
            else if (c.kind === 'each') this.sourceItems(c.source, e).forEach((it, i) => { const e2 = this.child(e, c.as ? { index: i } : { it: it.v, index: i }); if (c.as) e2.vars.set(c.as, { value: it.v }); collect(c.children, e2); });
            else if (c.kind === 'if') { li = this.truthy(this.evalIn(c.cond, e)); if (li) collect(c.children, e); }
            else if (c.kind === 'else') { if (li === false) collect(c.children, e); }
            else if (c.kind === 'let') e.vars.set(c.name, { let: c.e, env: e });
          }
        };
        collect(s.children || [], this.child(env, {}));
        return N({ id, t: 'poly', points: pts, style: this.style(s.mods, env) });
      }
      case 'pt': return { nodes: [] };
      case 'shape': {
        const a = s.args.map(x => num(this.evalIn(x, env)));
        const d = env.draw || { w: 100, h: 100 };
        const node = { id, t: s.shape, style: this.style(s.mods, env) };
        if (s.shape === 'rect') Object.assign(node, { x: a[0], y: a[1], w: a[2], h: a[3] });
        if (s.shape === 'line') Object.assign(node, { x1: a[0], y1: a[1], x2: a[2], y2: a[3] });
        const ccx = d.cx ?? d.w / 2, ccy = d.cy ?? d.h / 2;
        if (s.shape === 'circle') Object.assign(node, a.length === 1 ? { cx: ccx, cy: ccy, r: a[0] } : { cx: a[0], cy: a[1], r: a[2] });
        if (s.shape === 'arc') Object.assign(node, a.length === 3 ? { cx: ccx, cy: ccy, r: a[0], from: a[1], to: a[2] } : { cx: a[0], cy: a[1], r: a[2], from: a[3], to: a[4] });
        if (s.shape === 'path') node.d = s.d;
        if (s.shape === 'label') Object.assign(node, { x: a[0], y: a[1], text: this.textOf(s.parts, env) });
        this.events(s.mods, env, id, node);
        return N(node);
      }
      case 'text': case 'button': {
        const node = { id, t: s.kind, text: this.textOf(s.parts, env), style: this.style(s.mods, env) };
        const typed = this.typedParts(s.parts, env);
        if (typed.some(p => p.t !== 'text')) node.parts = typed;
        node.a11y = node.text;
        this.events(s.mods, env, id, node);
        return N(node);
      }
      case 'icon': {
        const e = s.icon;
        const name = e.k === 'path' && !e.parts.length && !this.lookup(e.head, env) ? e.head : fmt(this.evalIn(e, env), this);
        const node = { id, t: 'icon', name, style: this.style(s.mods, env) };
        this.events(s.mods, env, id, node);
        return N(node);
      }
      case 'image': return N({ id, t: 'image', src: this.evalIn(s.e, env), style: this.style(s.mods, env) });
      case 'space': return N({ id, t: 'space', size: s.size });
      case 'divider': return N({ id, t: 'divider' });
      case 'field': return N(this.fieldNode(s, env, id));
      case 'choice': {
        const ref = this.target(s.target, env);
        const type = ref.type;
        const options = type.t === 'pick' ? type.options : type.t === 'bool' ? [true, false] : type.t === 'ref' ? this.rows(type.table).map(r => r.id) : [];
        const labels = type.t === 'ref' ? options.map(i => this.summary(new Row(type.table, this.rowById(this.tk(type.table), i)))) : options.map(o => fmt(o));
        this.H.nodes.set(id, { change: v => { if (v === ref.raw()) return; ref.set(this.fromInput(v, type)); } });
        return N({ id, t: 'choice', label: (ref.label || s.target.parts[s.target.parts.length - 1] || s.target.head).replace(/_/g, ' '), value: ref.raw(), options, labels, style: this.style(s.mods, env) });
      }
      case 'slider': {
        const ref = this.target(s.target, env);
        this.H.nodes.set(id, { change: v => { if (v === ref.raw()) return; const x = this.fromInput(v, ref.type); if (x !== null) ref.set(x); } }); // a slider always has a value
        return N({ id, t: 'slider', value: ref.raw(), min: s.range.lo, max: s.range.hi, style: this.style(s.mods, env) });
      }
      case 'toggle': {
        const node = { id, t: 'toggle', label: this.toggleLabel(s, env), style: this.style(s.mods, env) };
        const t = this.evalPathRaw(s.target, env);
        if (t instanceof RowSet) {
          node.on = this.matchToggle(s.target, s.win, s.where, env).length > 0;
          this.H.nodes.set(id, { tap: () => this.doToggle(s.target, s.win, s.where, env) });
        } else {
          const ref = this.target(s.target, env);
          node.on = ref.raw() === true;
          this.H.nodes.set(id, { tap: () => ref.set(!(ref.raw() === true)) });
        }
        node.tap = true;
        return N(node);
      }
    }
    return { nodes: [] };
  }

  // an accessible name for a tick box: the value it shows (where name = it), else its target in words
  toggleLabel(s, env) {
    if (s.where && s.where.k === 'bin' && s.where.op === '=') { const v = this.evalIn(s.where.b, env); if (v !== null && typeof v !== 'object') return fmt(v, this); }
    const words = [s.target.head === 'it' ? null : s.target.head, ...s.target.parts].filter(Boolean).map(x => x.replace(/_/g, ' ')).join(' ');
    const it = this.nearestIt(env);
    return (it instanceof Row ? this.summary(it).split(' · ')[0] + ' ' : '') + words + (s.win ? '' : '');
  }

  // ---- the editor API (what an editor sheet needs) ----
  // fields({table, id}) or fields('settingName') -> [{name, label, kind, value, options, min, max, required}]
  fields(target) {
    OFF = this.off;
    if (typeof target === 'string') {
      const sd = this.prog.body.find(x => x.kind === 'setting' && x.name === target);
      if (!sd) return [];
      return [this.inputDesc(target, sd.label || target, { ...sd, optional: true }, this.data.settings[this.sk(target)])].map(d => ({ ...d, name: target }));
    }
    const tb = this.env.tables.get(target.table);
    const row = (this.data.tables[this.tk(target.table)] || []).find(r => r.id === target.id);
    if (!tb || !row) return [];
    return [...tb.fields].map(([n, f]) => ({ ...this.inputDesc(`${target.table}:${target.id}:${n}`, f.label || n, f, row[this.fk(target.table, n)]), name: n })).concat([{ id: `${target.table}:${target.id}:at`, t: 'input', kind: 'when', label: 'added', value: row.at, name: 'at' }]);
  }
  // setField({table, id}, field, value) or setField('settingName', null, value); one undo step per call
  setField(target, field, value) {
    OFF = this.off;
    this.lastChange = null; this.undoGroup = null; // any other operation ends a group of changes to one input
    return this.step(() => {
      if (typeof target === 'string') {
        const sd = this.prog.body.find(x => x.kind === 'setting' && x.name === target);
        if (!sd) return false;
        const key = this.sk(target);
        if (value === this.ext(this.data.settings[key], sd.type)) return true; // its own value back: nothing changes
        const v = this.unwrap(this.fromInput(value, sd.type), sd.type);
        if (v === REJECT) return false;
        this.data.settings[key] = this.clampTo(v, sd);
      } else {
        const row = (this.data.tables[this.tk(target.table)] || []).find(r => r.id === target.id);
        const f = field === 'at' ? { type: { t: 'when' } } : this.fieldDef(target.table, field);
        if (!row || !f) return false;
        const key = field === 'at' ? 'at' : this.fk(target.table, field);
        if (value === this.ext(row[key], f.type)) return true;
        const v = this.unwrap(this.fromInput(value, f.type), f.type);
        if (v === REJECT || (v === null && !f.optional && f.type.t !== 'bool') || (field === 'at' && !okMoment(v))) return false; // not a value of the field, a required field emptied, or an impossible added time
        row[key] = this.clampTo(v, f);
      }
      this.runWhen();
      return true;
    });
  }

  fieldNode(s, env, id) {
    const ref = this.target(s.target, env);
    if (ref.type.t === 'draft') {
      const tb = this.env.tables.get(ref.type.table);
      const fields = [];
      for (const [n, f] of tb ? tb.fields : []) {
        const fid = `${id}:${n}`;
        const sub = this.target({ k: 'path', head: s.target.head, parts: [...s.target.parts, n] }, env);
        this.H.nodes.set(fid, { change: v => { if (v === sub.raw()) return; sub.set(this.fromInput(v, f.type)); } });
        fields.push({ ...this.inputDesc(fid, f.label || n, { ...f, optional: !!f.optional || f.type.t === 'bool' || !!f.dflt }, sub.raw()), name: n });
      }
      const miss = this.data.state[ref.state ?? '']?._missing || (this.lookup(s.target.head, env)?.state && this.data.state[this.lookup(s.target.head, env).state]?._missing) || [];
      const missN = [...(tb ? tb.fields : [])].filter(([n]) => miss.includes(this.fk(ref.type.table, n))).map(([n, f]) => [n, f]);
      for (const fd of fields) if (missN.some(([n]) => n === fd.name)) fd.error = 'needed';
      return { id, t: 'form', table: ref.type.table, fields, style: this.style(s.mods, env), ...(missN.length ? { error: `Fill in ${missN.map(([n, f]) => (f.label || n).replace(/_/g, ' ')).join(', ')} first.` } : {}) };
    }
    this.H.nodes.set(id, { change: v => { if (v === ref.raw()) return; ref.set(this.fromInput(v, ref.type)); } });
    return { ...this.inputDesc(id, s.label || ref.label || s.target.parts[s.target.parts.length - 1] || s.target.head, { type: ref.type, range: ref.range, optional: true }, ref.raw()), style: this.style(s.mods, env) };
  }
  inputDesc(id, label, f, raw) {
    const t = f.type.t;
    const o = { id, t: 'input', kind: t, label: label.replace(/_/g, ' '), value: this.ext(raw, f.type) ?? null };
    if (t === 'pick') o.options = f.type.options;
    if (t === 'ref') { o.options = this.rows(f.type.table).map(r => r.id); o.labels = o.options.map(i => this.summary(new Row(f.type.table, this.rowById(this.tk(f.type.table), i)))); }
    if (f.range) { o.min = f.range.lo; if (f.range.hi !== null) o.max = f.range.hi; }
    if (f.unit) o.unit = f.unit;
    if (f.optional === false) o.required = true;
    return o;
  }
  // a renderer sends plain JSON; turn it into a value of the field's type
  // anything that is not a value of the type is REJECTed (the stored value stays as it was)
  fromInput(v, type) {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'object' || typeof v === 'function' || typeof v === 'symbol') return REJECT;
    const number = () => { if (typeof v === 'number') return isFinite(v) ? v : REJECT; if (typeof v === 'string' && v.trim() !== '' && isFinite(+v)) return +v; return REJECT; };
    switch (type.t) {
      case 'num': return number();
      case 'money': { const n = number(); return n === REJECT ? n : new Money(n); }
      case 'dur': { const n = number(); return n === REJECT ? n : new Dur(n); }
      case 'date': return typeof v === 'string' && realDate(v.slice(0, 10)) ? new DateV(v.slice(0, 10)) : REJECT;
      case 'when': { const ms = typeof v === 'number' ? v : typeof v === 'string' ? Date.parse(v) : NaN; return okMoment(ms) && (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(v) || realDate(v.slice(0, 10))) ? new When(ms) : REJECT; }
      case 'time': return typeof v === 'number' && isFinite(v) ? new TimeV(v) : typeof v === 'string' && /^\d{1,2}:\d{2}$/.test(v.trim()) ? new TimeV(parseTime(v.trim())) : REJECT;
      case 'bool': return typeof v === 'boolean' ? v : REJECT;
      case 'ref': { const id = typeof v === 'number' ? v : typeof v === 'string' && /^\d+$/.test(v) ? +v : NaN; const r = this.rows(type.table).find(x => x.id === id); return r ? new Row(type.table, r) : REJECT; }
      default: return typeof v === 'string' || typeof v === 'number' ? String(v) : REJECT;
    }
  }

  // the parts of a text as typed values, so a renderer can format numbers, money and dates for the
  // phone's locale: {t: text|num|year|money|date|when|time|dur|bool, v, text}
  typedParts(parts, env) {
    return parts.map(p => {
      if (p.k === 'str') return { t: 'text', v: p.v, text: p.v };
      const v = this.evalIn(p, env), text = v === null || v === undefined ? '' : fmt(v, this);
      if (typeof v === 'number') return { t: p.k === 'fn' && p.fn === 'year' ? 'year' : 'num', v, text };
      if (typeof v === 'boolean') return { t: 'bool', v, text };
      if (v instanceof Money) return { t: 'money', v: v.v, text };
      if (v instanceof DateV) return { t: 'date', v: v.s, text };
      if (v instanceof When) return { t: 'when', v: new Date(v.ms).toISOString(), text };
      if (v instanceof TimeV) return { t: 'time', v: fmt(v), text };
      if (v instanceof Dur) return { t: 'dur', v: v.sec, text };
      return { t: 'text', v: text, text };
    });
  }
  // an empty value is left out of a text with other parts, and shows as – when it is alone
  textOf(parts, env) {
    const vals = parts.map(p => p.k === 'str' ? p.v : this.evalIn(p, env));
    if (vals.length === 1) return typeof vals[0] === 'string' && parts[0].k === 'str' ? vals[0] : fmt(vals[0], this);
    return joinParts(vals.map((v, i) => parts[i].k === 'str' ? v : v === null || v === undefined ? '' : fmt(v, this)));
  }

  // ----- names -----
  lookup(name, env) {
    for (let e = env; e; e = e.parent) if (e.vars.has(name)) return e.vars.get(name);
    if (this.data.state && `|${this.stk(name)}` in this.data.state && this.topStateType(name)) return { state: `|${this.stk(name)}`, type: this.topStateType(name) };
    return null;
  }
  topStateType(name) {
    const s = this.prog.body.find(x => x.kind === 'state' && x.name === name);
    return s ? (s.draft ? { t: 'draft', table: s.draft } : s.type) : null;
  }
  varValue(v, env) {
    if ('value' in v) return v.value;
    if (v.let) return this.evalIn(v.let, v.env);
    if (v.state) {
      const raw = this.data.state[v.state];
      if (v.type && v.type.t === 'draft') return new Draft(v.type.table, v.state);
      return this.wrap(raw, v.type);
    }
    return null;
  }

  // a writable place: state, setting, draft field or row field
  target(p, env) {
    const self = this;
    if (!p.parts.length && p.head !== 'it') {
      const v = this.lookup(p.head, env);
      if (v && v.state) return { type: v.type || { t: 'text' }, raw: () => self.ext(self.data.state[v.state], v.type), set: x => { if (x === self.ext(self.data.state[v.state], v.type)) return; const u = self.unwrap(x, v.type); if (u !== REJECT) self.data.state[v.state] = u; } };
      const sd = this.prog.body.find(x => x.kind === 'setting' && x.name === p.head);
      if (sd) {
        const key = this.sk(p.head);
        return { type: sd.type, label: sd.label, range: sd.range, raw: () => self.ext(self.data.settings[key], sd.type), set: x => { if (x === self.ext(self.data.settings[key], sd.type)) return; const u = self.unwrap(x, sd.type); if (u !== REJECT) self.data.settings[key] = self.clampTo(u, sd); } };
      }
      throw new Error(`cannot change ${p.head}`);
    }
    const base = this.evalPathRaw({ ...p, parts: p.parts.slice(0, -1) }, env);
    const f = p.parts[p.parts.length - 1];
    if (base instanceof Draft) {
      const fd = this.fieldDef(base.table, f), dk = this.fk(base.table, f);
      return { type: fd.type, label: fd.label, range: fd.range, raw: () => self.ext(self.data.state[base.key][dk], fd.type), set: x => { const d = self.data.state[base.key]; if (x === self.ext(d[dk], fd.type)) return; const u = self.unwrap(x, fd.type); if (u === REJECT) return; d[dk] = self.clampTo(u, fd); if (d._missing) d._missing = d._missing.filter(k => k !== dk); } };
    }
    if (base instanceof Row) {
      const fd = this.fieldDef(base.table, f) || (f === 'at' ? { type: { t: 'when' } } : null);
      const row = base.r; // the stored row itself (a render's rows are the stored objects); no search per row
      const key = f === 'at' ? 'at' : this.fk(base.table, f);
      return { type: fd.type, label: fd.label, range: fd.range, raw: () => self.ext(row[key], fd.type), set: x => { if (x === self.ext(row[key], fd.type)) return; // its own value back changes nothing
        const u = self.unwrap(x, fd.type); if (u === REJECT) return; if (u === null && !fd.optional && fd.type.t !== 'bool') return; /* a required field is never emptied */ row[key] = self.clampTo(u, fd); } };
    }
    throw new Error(`cannot change ${p.head}.${p.parts.join('.')}`);
  }

  // ----- actions -----
  // a chain runs in order; each `after` is measured from the previous step, and everything after it
  // in the chain waits with it (tap A then after 2s B then C: B and C come 2s later)
  run(actions, env, user) {
    let delay = 0;
    for (const a of actions) {
      if (a.a === 'after') { delay += a.every; (this.pending ||= []).push({ due: this.clock + delay * 1000, act: a.act, env }); continue; }
      if (delay > 0) (this.pending ||= []).push({ due: this.clock + delay * 1000, act: a, env });
      else this.act(a, env);
    }
  }
  act(a, env) {
    switch (a.a) {
      case 'add': {
        const vals = {};
        for (const s of a.assigns) vals[s.name] = this.evalIn(s.e, env, true);
        this.addRow(a.table, vals);
        return;
      }
      case 'set': this.target(a.target, env).set(this.evalIn(a.e, env, true)); return;
      case 'setall': {
        const table = a.target.head, f = a.target.parts[0], fd = this.fieldDef(table, f);
        for (const r of this.rows(table)) {
          const e2 = this.child(env, { it: new Row(table, r), where: { table, row: r } });
          if (a.where && !this.truthy(this.evalIn(a.where, e2))) continue;
          const u = this.unwrap(this.evalIn(a.e, e2, true), fd.type); if (u !== REJECT) r[this.fk(table, f)] = this.clampTo(u, fd);
        }
        return;
      }
      case 'removeall': for (const r of this.queryRows(a.q, env).rows) r.deleted = true; return;
      case 'toggle': this.doToggle(a.target, a.win, a.where, env); return;
      case 'remove': { const v = this.evalIn(a.e, env); if (v instanceof Row) { const r = this.data.tables[this.tk(v.table)].find(x => x.id === v.r.id); if (r) r.deleted = true; this.log.push({ kind: 'removed', table: v.table, id: v.r.id, at: this.clock }); } return; }
      case 'edit': { const v = a.e.k === 'path' && !a.e.parts.length && a.e.head !== 'it' && !(this.lookup(a.e.head, env)?.value instanceof Row) ? a.e.head : this.evalIn(a.e, env); this.log.push({ kind: 'edit', target: v instanceof Row ? { table: v.table, id: v.r.id } : v, at: this.clock }); return; }
      case 'save': {
        const v = this.lookup(a.name, env);
        const d = this.data.state[v.state];
        const tb = this.env.tables.get(v.type.table);
        const vals = {};
        for (const [n, f] of tb.fields) vals[n] = this.wrap(d[this.fk(v.type.table, n)], f.type);
        const r = this.addRow(v.type.table, vals);
        if (r) { if (!v.keep) this.data.state[v.state] = this.newDraft(v.type.table); else delete d._missing; }
        else d._missing = [...tb.fields].filter(([, f]) => !f.optional && f.type.t !== 'bool' && !f.dflt).filter(([n]) => vals[n] === null || vals[n] === undefined || vals[n] === '').map(([n]) => this.fk(v.type.table, n)); // field slots, shown on the form
        return;
      }
      case 'go': this.screen = a.name; return;
      case 'after': (this.pending ||= []).push({ due: this.clock + a.every * 1000, act: a.act, env }); return;
      case 'notify': this.log.push({ kind: 'notify', text: this.textOf(a.parts, env), at: this.clock }); return;
      case 'remind': { const d = this.evalIn(a.e, env); this.log.push({ kind: 'remind', text: a.text, due: this.clock + num(d) * 1000, at: this.clock }); return; }
    }
  }

  // which rows a table toggle matches; at of a new row: now if the day is today, else noon of that day
  toggleDay(win, env) {
    if (!win || win.k === 'today' || win.k === 'all') return this.today(); // all: a mark for good (a favourite); a new row is added now
    if (win.k === 'yesterday') return addDays(this.today(), -1);
    if (win.k === 'on') { const v = this.evalIn(win.e, env); return v instanceof DateV ? v.s : v instanceof When ? dateOf(v.ms) : this.today(); }
    const [a] = this.windowRange(win, env); return a;
  }
  matchToggle(target, win, where, env) {
    const set = this.evalPathRaw(target, env);
    const rows = set.rows.filter(r => this.inWindow(r, win || { k: 'today' }, env));
    return where ? rows.filter(r => this.truthy(this.evalIn(where, this.child(env, { where: { table: set.table, row: r } })))) : rows;
  }
  doToggle(target, win, where, env) {
    const set = this.evalPathRaw(target, env);
    const hit = this.matchToggle(target, win, where, env);
    if (hit.length) { for (const r of hit) r.deleted = true; return; }
    const vals = {};
    if (set.via) vals[set.via] = set.viaRow;
    const eqs = x => { if (!x) return; if (x.k === 'bin' && x.op === 'and') { eqs(x.a); eqs(x.b); } else if (x.k === 'bin' && x.op === '=' && x.a.k === 'path') vals[x.a.head] = this.evalIn(x.b, env); };
    eqs(where);
    const day = this.toggleDay(win, env);
    const at = day === this.today() ? this.clock : msOfLocal(day) + 12 * 3600000;
    this.addRow(set.table, vals, at);
  }

  // ----- formulas -----
  evalIn(e, env, inAction = false) { return this.ev(e, env, inAction); }

  evalPathRaw(p, env) {
    let v;
    if (p.head === 'it') v = env.it ?? this.nearestIt(env);
    else {
      const w = this.whereOf(env);
      if (w && (this.fieldDef(w.table, p.head) || p.head === 'at' || p.head === 'id')) v = this.fieldOf(new Row(w.table, w.row), p.head);
      else {
        const vr = this.lookup(p.head, env);
        if (vr) v = this.varValue(vr, env);
        else if (this.prog.body.some(x => x.kind === 'setting' && x.name === p.head)) { const s = this.prog.body.find(x => x.kind === 'setting' && x.name === p.head); v = this.wrap(this.data.settings[this.sk(p.head)], s.type); }
        else if (this.env.tables.has(p.head)) v = new RowSet(p.head, this.rows(p.head));
        else if (this.env.options && this.env.options.has(p.head) && !p.parts.length) return p.head;
        else v = null;
      }
    }
    for (const part of p.parts) v = this.stepVal(v, part);
    return v;
  }
  inPlot(env) { for (let e = env; e; e = e.parent) if (e.oldestFirst) return true; return false; }
  nearestIt(env) { for (let e = env; e; e = e.parent) if (e.it !== undefined && e.it !== null) return e.it; return null; }
  whereOf(env) { for (let e = env; e; e = e.parent) if (e.where) return e.where; return null; }
  fieldOf(row, f) {
    if (f === 'at') return new When(row.r.at);
    if (f === 'id') return row.r.id;
    const fd = this.fieldDef(row.table, f);
    return this.wrap(row.r[this.fk(row.table, f)], fd?.type);
  }
  stepVal(v, part) {
    if (v === null || v === undefined) return null;
    if (v instanceof Row) {
      if (this.fieldDef(v.table, part) || part === 'at' || part === 'id') return this.fieldOf(v, part);
      const back = this.env.tables.get(part);
      if (back) {
        const ref = [...back.fields.values()].find(f => f.type.t === 'ref' && f.type.table === v.table);
        const set = new RowSet(part, this.rows(part).filter(r => r[this.fk(part, ref.name)] === v.r.id));
        set.via = ref.name; set.viaRow = v;
        return set;
      }
      return null;
    }
    if (v instanceof Draft) { const fd = this.fieldDef(v.table, part); return this.wrap(this.data.state[v.key][this.fk(v.table, part)], fd?.type); }
    if (v instanceof RowSet) return new Column(v, [part]);
    if (v instanceof Column) return new Column(v.set, [...v.path, part]);
    if (v instanceof Group) { if (part === 'key') return v.key; return new Column(new RowSet(v.table, v.rows), [part]); }
    return null;
  }
  columnValues(col) {
    return col.set.rows.map(r => { let x = new Row(col.set.table, r); for (const p of col.path) x = this.stepVal(x, p); return x; });
  }

  windowRange(w, env) {
    const t = this.today();
    switch (w.k) {
      case 'today': return [t, t];
      case 'yesterday': return [addDays(t, -1), addDays(t, -1)];
      case 'all': return [null, null];
      case 'prev': { const [a] = this.period(w.p, t); const pe = addDays(a, -1); return this.period(w.p, pe); }
      case 'last': {
        if (w.unit === 'days') return [addDays(t, -(w.n - 1)), t];
        if (w.unit === 'weeks') return [addDays(t, -(w.n * 7 - 1)), t];
        return [addDays(addMonths(t, -w.n), 1), t];
      }
      case 'on': { const v = this.ev(w.e, env); const d = v instanceof DateV ? v.s : v instanceof When ? dateOf(v.ms) : null; return [d, d]; }
      case 'period': { const v = w.of ? this.ev(w.of, env) : new DateV(t); const d = v instanceof DateV ? v.s : v instanceof When ? dateOf(v.ms) : t; return this.period(w.p, d); }
    }
    return [null, null];
  }
  period(p, d) {
    if (p === 'week') { const a = addDays(d, -(weekdayOf(d) - 1)); return [a, addDays(a, 6)]; }
    if (p === 'month') { const a = d.slice(0, 8) + '01'; return [a, d.slice(0, 8) + pad2(monthDays(d))]; }
    return [d.slice(0, 4) + '-01-01', d.slice(0, 4) + '-12-31'];
  }
  inWindow(r, w, env) {
    if (!w || w.k === 'all') return true;
    const [a, b] = this.windowRange(w, env);
    if (a === null && b === null) return w.k === 'all';
    const d = dateOf(r.at);
    return (a === null || d >= a) && (b === null || d <= b);
  }

  queryRows(q, env) {
    let base = this.evalPathRaw(q.path, env);
    if (base instanceof Group) base = new RowSet(base.table, base.rows);
    if (base instanceof Column) base = base.set;
    if (!(base instanceof RowSet)) return new RowSet(null, []);
    let rows = base.rows;
    if (q.win && q.win.k !== 'all') { // the window once per query, then a number compare per row
      const [a, b] = this.windowRange(q.win, env);
      if (a === null && b === null) rows = [];
      else { const lo = a === null ? -Infinity : msOfLocal(a), hi = b === null ? Infinity : msOfLocal(b) + DAY; rows = rows.filter(r => r.at >= lo && r.at < hi); }
    }
    if (q.where) { const we = this.child(env, { where: null }); rows = rows.filter(r => { we.where = { table: base.table, row: r }; return this.truthy(this.ev(q.where, we)); }); } // one scope per query, the row changes
    rows = rows.slice().sort((x, y) => y.at - x.at || y.id - x.id); // newest first
    if (q.shuffle) { // a fixed random order per row (chosen when the row was added), so the screen does not jump
      const key = r => r._rnd ?? ((r.id * 2654435761) % 1000003) / 1000003;
      rows = rows.slice().sort((x, y) => key(x) - key(y));
    }
    if (q.sort) {
      const se = this.child(env, { it: null, where: null });
      const key = r => { se.it = new Row(base.table, r); se.where = { table: base.table, row: r }; return this.ev(q.sort, se); };
      const keyed = rows.map(r => [key(r), r]);
      keyed.sort((x, y) => { if (x[0] === null) return 1; if (y[0] === null) return -1; const c = cmpVal(x[0], y[0]); return q.desc ? -c : c; });
      rows = keyed.map(k => k[1]);
    }
    if (q.top) rows = rows.slice(0, q.top);
    const out = new RowSet(base.table, rows);
    out.via = base.via; out.viaRow = base.viaRow;
    return out;
  }
  groups(set, by) {
    const m = new Map();
    for (const r of set.rows) {
      let key;
      if (by === 'day') key = new DateV(dateOf(r.at));
      else if (by === 'week') key = new DateV(this.period('week', dateOf(r.at))[0]);
      else if (by === 'month') key = new DateV(this.period('month', dateOf(r.at))[0]);
      else { let x = new Row(set.table, r); for (const p of typeof by === 'string' ? [by] : [by.head, ...by.parts]) x = this.stepVal(x, p); key = x; }
      const k = key instanceof DateV ? key.s : key instanceof Row ? 'r' + key.r.id : fmt(key, this);
      if (!m.has(k)) m.set(k, { key, rows: [] });
      m.get(k).rows.push(r);
    }
    return [...m.entries()].map(([k, g]) => ({ k, g: new Group(set.table, g.key, g.rows) }));
  }
  sourceItems(s, env) {
    switch (s.k) {
      case 'days': {
        const [a, b] = this.windowRange(s.win, env);
        const out = [];
        if (!a || !b) return out;
        for (let d = a, n = 0; d <= b && n < 400; d = addDays(d, 1), n++) out.push({ key: d, v: new DateV(d) });
        return out;
      }
      case 'options': {
        const fd = s.path.parts.length ? this.fieldDef(s.path.head, s.path.parts[0]) : null;
        const st = !fd && !s.path.parts.length ? this.prog.body.find(x => (x.kind === 'setting' || x.kind === 'state') && x.name === s.path.head) : null; // the options of a pick setting or state
        const ty = (fd || st)?.type;
        return (ty?.options || []).map(o => ({ key: ty.oid?.[o] ?? o, v: o })); // an option item is known by its option slot (follows renames)
      }
      case 'list': return s.items.map((l, i) => ({ key: i, v: this.wrap(this.litValue(l), { t: { time: 'time', dur: 'dur', today: 'date', now: 'when' }[l.k] }) }));
      case 'range': {
        const a = Math.ceil(num(this.ev(s.a, env)) ?? 0), b = Math.floor(num(this.ev(s.b, env)) ?? -1);
        const out = [];
        for (let i = a; i <= b && out.length < 1000; i++) out.push({ key: i, v: i });
        return out;
      }
      case 'query': {
        const set = this.queryRows(s.q, env);
        // inside a plot (and in folds used by one) rows go oldest first, so time runs left to right
        let rows = set.rows;
        if (!s.q.sort && !s.q.shuffle && this.inPlot(env)) rows = rows.slice().reverse();
        if (s.q.by) { const gs = this.groups(new RowSet(set.table, rows), s.q.by); return gs.map(({ k, g }) => ({ key: k, v: g })); }
        return rows.map(r => ({ key: 'r' + r.id, v: new Row(set.table, r) }));
      }
    }
    return [];
  }

  dayList(rows) { return [...new Set(rows.map(r => dateOf(r.at)))].sort(); }

  agg(e, env) {
    const raw = this.evalPathRaw(e.q.path, env);
    const isCol = raw instanceof Column;
    const set = this.queryRows(e.q, env);
    const col = isCol ? new Column(set, raw.path) : null;
    const vals = col ? this.columnValues(col).filter(v => v !== null && v !== undefined) : [];
    switch (e.fn) {
      case 'count': return col ? vals.length : set.rows.length;
      case 'sum': { const s = vals.reduce((a, v) => a + num(v), 0); return vals.length ? this.like(vals[0], s) : this.colZero(col); }
      case 'avg': return vals.length ? this.like(vals[0], vals.reduce((a, v) => a + num(v), 0) / vals.length) : null;
      case 'min': case 'max': {
        if (!vals.length) return null;
        let best = vals[0];
        for (const v of vals) if (e.fn === 'min' ? cmpVal(v, best) < 0 : cmpVal(v, best) > 0) best = v;
        return best;
      }
      case 'last': case 'first': {
        const rows = set.rows.slice().sort((x, y) => x.at - y.at || x.id - y.id);
        const r = e.fn === 'last' ? rows[rows.length - 1] : rows[0];
        if (!r) return null;
        if (!col) return new Row(set.table, r);
        let x = new Row(set.table, r); for (const p of col.path) x = this.stepVal(x, p); return x;
      }
      case 'streak': case 'best': {
        const days = new Set(this.dayList(set.rows));
        if (e.fn === 'streak') {
          let d = this.today(); if (!days.has(d)) d = addDays(d, -1);
          let n = 0; while (days.has(d)) { n++; d = addDays(d, -1); }
          return n;
        }
        let best = 0, run = 0, prev = null;
        for (const d of [...days].sort()) { run = prev && addDays(prev, 1) === d ? run + 1 : 1; best = Math.max(best, run); prev = d; }
        return best;
      }
      case 'since': {
        const days = this.dayList(set.rows);
        if (!days.length) return null; // never happened: empty, not 0
        return Math.round((msOf(this.today()) - msOf(days[days.length - 1])) / DAY);
      }
      case 'gap': {
        const days = this.dayList(set.rows);
        if (days.length < 2) return null;
        return Math.round((msOf(days[days.length - 1]) - msOf(days[0])) / DAY / (days.length - 1) * 100) / 100;
      }
    }
    return null;
  }
  // the sum of no values keeps the column's type: Rs 0 for money, 0:00 for a duration
  colZero(col) {
    if (!col) return 0;
    let table = col.set.table, f = null;
    for (const p of col.path) { f = this.fieldDef(table, p); if (!f) return 0; if (f.type.t === 'ref') table = f.type.table; }
    return f && f.type.t === 'money' ? new Money(0) : f && f.type.t === 'dur' ? new Dur(0) : 0;
  }
  like(sample, n) { return sample instanceof Money ? new Money(n) : sample instanceof Dur ? new Dur(n) : n; }

  fold(e, env) {
    const items = this.sourceItems(e.src, env);
    const fe = this.child(env, { it: null, index: 0 });
    const vals = items.map((it, i) => { fe.it = it.v; fe.index = i; return this.ev(e.e, fe); });
    if (e.fn === 'countof') return vals.filter(v => v === true).length;
    const ns = vals.filter(v => v !== null && v !== undefined);
    if (e.fn === 'sumof') return this.like(ns[0], ns.reduce((a, v) => a + num(v), 0));
    if (!ns.length) return null;
    let best = ns[0];
    for (const v of ns) if (e.fn === 'minof' ? cmpVal(v, best) < 0 : cmpVal(v, best) > 0) best = v;
    return best;
  }

  arith(op, a, b) {
    if (a === null || a === undefined || b === null || b === undefined) return null;
    const isD = x => x instanceof DateV || x instanceof When;
    if (op === '+' || op === '-') {
      const sg = op === '+' ? 1 : -1;
      if (a instanceof DateV && typeof b === 'number') return new DateV(addDays(a.s, sg * Math.round(b)));
      if (a instanceof When && typeof b === 'number') return new When(a.ms + sg * b * DAY);
      if (a instanceof DateV && b instanceof Dur) return new When(msOfLocal(a.s) + sg * b.sec * 1000);
      if (a instanceof When && b instanceof Dur) return new When(a.ms + sg * b.sec * 1000);
      if (a instanceof TimeV && b instanceof Dur) return new TimeV(a.sec + sg * b.sec);
      // date - date and date - (date and time) are whole days between the two dates
      if (op === '-' && isD(a) && isD(b) && (a instanceof DateV || b instanceof DateV)) return Math.round((msOf(a instanceof DateV ? a.s : dateOf(a.ms)) - msOf(b instanceof DateV ? b.s : dateOf(b.ms))) / DAY);
      if (op === '-' && a instanceof When && b instanceof When) return new Dur((a.ms - b.ms) / 1000);
      // time - time is the forward duration from b to a, wrapping past midnight (bed 23:00 to wake 07:00 is 8:00)
      if (op === '-' && a instanceof TimeV && b instanceof TimeV) return new Dur(((a.sec - b.sec) % 86400 + 86400) % 86400);
      if (a instanceof Dur && b instanceof Dur) return new Dur(a.sec + sg * b.sec);
      const r = num(a) + sg * num(b);
      return a instanceof Money || b instanceof Money ? new Money(r) : r;
    }
    if (op === '*') {
      if (a instanceof Dur) return new Dur(a.sec * num(b));
      if (b instanceof Dur) return new Dur(b.sec * num(a));
      const r = num(a) * num(b); return a instanceof Money || b instanceof Money ? new Money(r) : r;
    }
    if (op === '/') {
      if (a instanceof Dur && b instanceof Dur) return b.sec === 0 ? 0 : a.sec / b.sec;
      if (a instanceof Dur) return num(b) === 0 ? new Dur(0) : new Dur(a.sec / num(b));
      const d = num(b); const r = d === 0 ? 0 : num(a) / d;
      return a instanceof Money && !(b instanceof Money) ? new Money(r) : r;
    }
    if (op === '%') { const d = num(b); return d === 0 ? 0 : ((num(a) % d) + d) % d; }
    return null;
  }

  ev(e, env, inAction = false) {
    if (!e) return null;
    switch (e.k) {
      case 'num': return e.v;
      case 'pi': return Math.PI;
      case 'str': case 'word': return e.v;
      case 'time': return new TimeV(parseTime(e.v));
      case 'date': return new DateV(e.v);
      case 'dur': return new Dur(e.v);
      case 'bool': return e.v;
      case 'today': return new DateV(this.today());
      case 'now': return new When(this.clock);
      case 'index': for (let x = env; x; x = x.parent) if (x.index !== undefined && x.index !== null) return x.index; return 0;
      case 'color': { const vr = this.lookup(e.v, env); return vr ? this.varValue(vr, env) : new Color(e.v); }
      case 'paren': return this.ev(e.a, env, inAction);
      case 'path': return this.evalPathRaw(e, env);
      case 'not': return !(this.ev(e.a, env, inAction) === true);
      case 'neg': { const v = this.ev(e.a, env, inAction); return v === null ? null : v instanceof Money ? new Money(-v.v) : v instanceof Dur ? new Dur(-v.sec) : -num(v); }
      case 'bin': {
        if (e.op === 'and') return this.ev(e.a, env, inAction) === true && this.ev(e.b, env, inAction) === true;
        if (e.op === 'or') return this.ev(e.a, env, inAction) === true || this.ev(e.b, env, inAction) === true;
        const a = this.ev(e.a, env, inAction), b = this.ev(e.b, env, inAction);
        switch (e.op) {
          case '=': return eq(a, b);
          case '!=': return a === null || b === null ? (a === null) !== (b === null) || false : !eq(a, b);
          case '<': return a !== null && b !== null && cmpVal(a, b) < 0;
          case '>': return a !== null && b !== null && cmpVal(a, b) > 0;
          case '<=': return a !== null && b !== null && cmpVal(a, b) <= 0;
          case '>=': return a !== null && b !== null && cmpVal(a, b) >= 0;
        }
        return this.arith(e.op, a, b);
      }
      case 'agg': return this.agg(e, env);
      case 'fold': return this.fold(e, env);
      case 'fn': return this.fn(e, env, inAction);
      case 'member': { let v = this.ev(e.e, env, inAction); for (const p of e.parts) v = this.stepVal(v, p); return v; }
      case 'join': return e.parts.map(p => p.k === 'str' ? p.v : fmt(this.ev(p, env, inAction), this)).join('');
      case 'qfn': {
        if (e.fn === 'due') { // never done, or at least n days since the last row
          const n = num(this.ev(e.e, env, inAction));
          const since = this.agg({ fn: 'since', q: e.q }, env);
          return since === null || (n !== null && since >= n);
        }
        const rows = this.queryRows(e.q, env);
        if (e.fn === 'nth') { const i = Math.round(num(this.ev(e.e, env, inAction)) ?? 0); const r = rows.rows[i - 1]; return r ? new Row(rows.table, r) : null; }
        if (e.fn === 'anyrow') { if (!rows.rows.length) return null; return new Row(rows.table, rows.rows[Math.floor(this.random() * rows.rows.length)]); }
        return null;
      }
    }
    return null;
  }

  fn(e, env, inAction) {
    if (e.fn === 'words') return words(e.args[0]).replace(/^the /, '');
    const A = e.args.map(a => this.ev(a, env, inAction));
    const d = v => v instanceof DateV ? v.s : v instanceof When ? dateOf(v.ms) : null;
    switch (e.fn) {
      case 'if': return A[0] === true ? A[1] : A[2];
      case 'min': case 'max': if (A[0] === null) return A[1]; if (A[1] === null) return A[0]; return (e.fn === 'min' ? cmpVal(A[0], A[1]) <= 0 : cmpVal(A[0], A[1]) >= 0) ? A[0] : A[1];
      case 'clamp': { if (A[0] === null) return null; const v = Math.min(Math.max(num(A[0]), num(A[1])), num(A[2])); return this.like(A[0], v); }
      case 'round': return A[0] === null ? null : this.like(A[0], Math.sign(num(A[0])) * Math.round(Math.abs(num(A[0])))); // half away from zero: -2.5 -> -3
      case 'floor': return A[0] === null ? null : this.like(A[0], Math.floor(num(A[0])));
      case 'abs': return A[0] === null ? null : this.like(A[0], Math.abs(num(A[0])));
      case 'pow': return A[0] === null || A[1] === null ? null : this.like(A[0], Math.pow(num(A[0]), num(A[1])));
      case 'plural': { const n = num(A[0]); if (n === null) return null; const w = String(A[1] ?? ''); return `${fmtNum(n)} ${n === 1 ? w : (/(s|x|ch|sh)$/.test(w) ? w + 'es' : /[^aeiou]y$/.test(w) ? w.slice(0, -1) + 'ies' : w + 's')}`; }
      case 'fixed': { if (A[0] === null) return null; const d = Math.max(0, Math.min(6, Math.round(num(A[1]) ?? 0))); return num(A[0]).toFixed(d); }
      case 'compact': { const n = num(A[0]); if (n === null) return null; const a = Math.abs(n); const f = (v, u) => `${Math.round(v * 10) / 10}${u}`; return a >= 1e9 ? f(n / 1e9, 'B') : a >= 1e6 ? f(n / 1e6, 'M') : a >= 1e3 ? f(n / 1e3, 'k') : fmtNum(n); }
      case 'grouped': { const n = num(A[0]); return n === null ? null : (Math.round(n * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 }); }
      case 'monthshort': return d(A[0]) ? MONTHS[+d(A[0]).slice(5, 7) - 1].slice(0, 3) : null;
      case 'sin': return A[0] === null ? null : Math.round(Math.sin(num(A[0]) * Math.PI / 180) * 1e9) / 1e9;
      case 'cos': return A[0] === null ? null : Math.round(Math.cos(num(A[0]) * Math.PI / 180) * 1e9) / 1e9;
      case 'hue': return new Color('hue:' + Math.round(((num(A[0]) % 360) + 360) % 360));
      case 'random': { if (A[0] instanceof RowSet) { const rs = A[0].rows; return rs.length ? new Row(A[0].table, rs[Math.floor(this.random() * rs.length)]) : null; } const n = Math.max(1, Math.floor(num(A[0]) || 1)); return 1 + Math.floor(this.random() * n); }
      case 'len': return A[0] === null ? 0 : String(A[0]).length;
      case 'has': return A[0] !== null && String(A[0]).toLowerCase().includes(String(A[1] ?? '').toLowerCase());
      case 'weekday': return d(A[0]) ? weekdayOf(d(A[0])) : null;
      case 'monthday': return d(A[0]) ? +d(A[0]).slice(8) : null;
      case 'monthdays': return d(A[0]) ? monthDays(d(A[0])) : null;
      case 'month': return d(A[0]) ? +d(A[0]).slice(5, 7) : null;
      case 'year': return d(A[0]) ? +d(A[0]).slice(0, 4) : null;
      case 'dayname': return d(A[0]) ? WD[weekdayOf(d(A[0])) - 1] : null;
      case 'monthname': { const s = d(A[0]); return s ? `${MONTHS[+s.slice(5, 7) - 1]} ${s.slice(0, 4)}` : null; }
      case 'addmonths': { const s = d(A[0]); if (!s) return null; const r = addMonths(s, Math.round(num(A[1]))); return A[0] instanceof When ? new When(msOfLocal(r) + (shift(A[0].ms) % DAY)) : new DateV(r); }
      case 'hour': case 'minute': case 'second': {
        const v = A[0]; if (v === null) return null;
        const sec = v instanceof TimeV ? v.sec : v instanceof When ? Math.floor((((shift(v.ms) % DAY) + DAY) % DAY) / 1000) : v instanceof Dur ? v.sec : 0;
        if (v instanceof Dur) return e.fn === 'hour' ? Math.floor(sec / 3600) : e.fn === 'minute' ? Math.floor(sec % 3600 / 60) : Math.floor(sec % 60);
        return e.fn === 'hour' ? Math.floor(sec / 3600) : e.fn === 'minute' ? Math.floor(sec % 3600 / 60) : sec % 60;
      }
    }
    return null;
  }
}

// about 4 round tick values covering [lo, hi]
function niceTicks(lo, hi) {
  const span = hi - lo; if (!(span > 0)) return [lo];
  const raw = span / 4, mag = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / mag;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag;
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(Math.round(v * 1e9) / 1e9);
  return out;
}

// Is a snapshot safe to read? (null when it is)
function badSnapshot(d) {
  if (!d || typeof d !== 'object') return 'it is not an object';
  if (d.data === undefined || typeof d.data !== 'object' || d.data === null) return 'data is missing';
  if (d.data && d.data.tables !== undefined && (typeof d.data.tables !== 'object' || d.data.tables === null || Array.isArray(d.data.tables))) return 'data.tables is not a set of tables';
  if (d.data && d.data.tables) for (const [k, v] of Object.entries(d.data.tables)) { if (!Array.isArray(v)) return `table ${k} is not a list of rows`; if (v.some(r => !r || typeof r !== 'object' || Array.isArray(r))) return `table ${k} has a row that is not a record`; }
  if (d.data && d.data.settings !== undefined && (typeof d.data.settings !== 'object' || d.data.settings === null)) return 'data.settings is not a set of values';
  if (d.ever !== undefined) {
    const e = d.ever;
    if (!e || typeof e !== 'object' || Array.isArray(e)) return 'the schema history is not an object';
    if (typeof e.tables !== 'object' || e.tables === null) return 'the schema history has no tables';
    if (!Array.isArray(e.versions)) return 'the schema history has no versions';
    for (const [k, t] of Object.entries(e.tables)) if (!t || typeof t.fields !== 'object' || t.fields === null) return `the schema history of table ${k} is damaged`;
    const slotOk = s => s && typeof s === 'object' && s.seen && typeof s.seen === 'object' && (s.type === undefined || (s.type && typeof s.type === 'object' && typeof s.type.t === 'string' && (s.type.options === undefined || (Array.isArray(s.type.options) && s.type.options.every(o => typeof o === 'string'))))) && (s.opts === undefined || (s.opts && typeof s.opts === 'object' && Object.values(s.opts).every(o => o && typeof o.seen === 'object' && o.seen)));
    for (const [k, t] of Object.entries(e.tables)) { if (!slotOk(t)) return `the schema history of table ${k} is damaged`; for (const [fk, f] of Object.entries(t.fields)) if (!slotOk(f) || !f.type) return `the schema history of field ${k}.${fk} is damaged`; }
    for (const g of ['settings', 'states']) if (e[g] !== undefined) { if (!e[g] || typeof e[g] !== 'object') return `the schema history of ${g} is damaged`; for (const [k, s] of Object.entries(e[g])) if (!slotOk(s)) return `the schema history of ${k} is damaged`; }
    if (e.optionLog !== undefined) {
      if (!Array.isArray(e.optionLog)) return 'the option rename log is not a list';
      for (const x of e.optionLog) if (!x || typeof x !== 'object' || typeof x.v !== 'number' || typeof x.table !== 'string' || typeof x.field !== 'string' || !x.map || typeof x.map !== 'object' || Object.values(x.map).some(v => typeof v !== 'string')) return 'an entry of the option rename log is damaged';
    }
    for (const [i, v] of e.versions.entries()) {
      if (!v || typeof v !== 'object' || typeof v.src !== 'string') return `version ${i + 1} of the schema history has no program text`;
      if (e.format !== undefined) { // a current-shape history must carry a usable map in every version
        const m = v.map;
        if (!m || typeof m !== 'object' || !m.tables || typeof m.tables !== 'object' || !m.fields || typeof m.fields !== 'object' || (m.settings !== undefined && typeof m.settings !== 'object')) return `version ${i + 1} of the schema history has no usable name map`;
        for (const [n, k] of Object.entries(m.tables)) if (!e.tables[k]) return `version ${i + 1} names a table ${n} that the schema history does not have`;
        for (const [tk, fm] of Object.entries(m.fields)) { if (!e.tables[tk] || !fm || typeof fm !== 'object') return `version ${i + 1} maps fields of a table the schema history does not have`; for (const [n, fk] of Object.entries(fm)) if (!e.tables[tk].fields[fk]) return `version ${i + 1} names a field ${n} that the schema history does not have`; }
        if (!m.options || typeof m.options !== 'object') return `version ${i + 1} has no option map`;
        for (const [tk, of] of Object.entries(m.options)) for (const [fk, om] of Object.entries(of || {})) { const f = e.tables[tk]?.fields[fk]; if (!f || !f.opts || !om || typeof om !== 'object') return `version ${i + 1} maps options of a field the schema history does not have`; for (const [n, ok] of Object.entries(om)) if (!f.opts[ok]) return `version ${i + 1} names an option ${n} that the schema history does not have`; }
        for (const [g, og] of [['settings', 'settingOptions'], ['states', 'stateOptions']]) {
          if (m[g] !== undefined) for (const [n, k] of Object.entries(m[g])) { const sl = e[g]?.[k]; if (!sl) return `version ${i + 1} names a ${g === 'settings' ? 'setting' : 'state'} ${n} that the schema history does not have`; if (sl.opts && !(m[og] && m[og][k])) return `version ${i + 1} has no option map for ${n}`; }
          if (m[og] !== undefined) for (const [k, om] of Object.entries(m[og] || {})) { const sl = e[g]?.[k]; if (!sl || !sl.opts || !om || typeof om !== 'object') return `version ${i + 1} maps options the schema history does not have`; for (const [n, ok] of Object.entries(om)) if (!sl.opts[ok]) return `version ${i + 1} names an option ${n} that the schema history does not have`; }
        }
        if (v.from !== undefined && !(Number.isInteger(v.from) && v.from >= 0 && v.from < i)) return `version ${i + 1} says it restores a version that does not exist`;
      }
    }
    const used = Object.keys(d.data?.tables || {}).filter(k => (d.data.tables[k] || []).length);
    if (e.format !== undefined && e.format !== FORMAT) return 'it was saved by a newer version of the app';
    if (e.format !== undefined) for (const [g, key] of [['settings', k => k], ['states', k => `|${k}`]]) for (const [k, sl] of Object.entries(e[g] || {})) {
      const v = g === 'settings' ? d.data?.settings?.[key(k)] : d.data?.state?.[key(k)];
      if (isOptRef(v) && !(sl.opts && sl.opts[v.o])) return `the saved value of ${k} names an option the schema history does not have`;
      if (v && typeof v === 'object' && !isOptRef(v) && !(sl.type && sl.type.t === 'draft')) return `the saved value of ${k} has an unknown shape`;
    }
    if (e.format !== undefined) for (const [tk, rows] of Object.entries(d.data?.tables || {})) {
      const t = e.tables[tk]; if (!t) continue;
      for (const r of rows) for (const [k, v] of Object.entries(r)) {
        if (['id', 'at', '_rnd', 'deleted'].includes(k)) continue;
        if (!t.fields[k]) return `a row of ${tk} has a value for ${k}, which the schema history does not have`;
        if (isOptRef(v) && !(t.fields[k].opts && t.fields[k].opts[v.o])) return `a row of ${tk} names an option the schema history does not have`;
        if (v && typeof v === 'object' && !isOptRef(v)) return `a row of ${tk} holds a value of an unknown shape in ${k}`;
      }
    }
    if (used.length && !e.versions.length) return 'the schema history has no versions but there are rows';
    for (const k of used) if (!e.tables[k]) return `rows of ${k} have no entry in the schema history`;
  }
  return null;
}

// merge two schema histories of the same app: every slot of both, each with all its names
export function newAppId() { return 'app-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8); }

export function mergeEver(a, b) {
  if (!b || !b.tables) return a;
  const base = (b.v || 0) > (a.v || 0) ? b : a, other = base === a ? b : a;
  const E = JSON.parse(JSON.stringify(base));
  const mergeSlot = (x, y) => {
    for (const [n, v] of Object.entries(y.seen || {})) if (!(n in x.seen) || x.seen[n] < v) x.seen[n] = v;
    if (y.opts) { x.opts ||= {}; for (const [ok, o] of Object.entries(y.opts)) { if (!x.opts[ok]) x.opts[ok] = { ...JSON.parse(JSON.stringify(o)), visible: null }; else for (const [n, v] of Object.entries(o.seen || {})) if (!(n in x.opts[ok].seen) || x.opts[ok].seen[n] < v) x.opts[ok].seen[n] = v; } }
  };
  for (const [k, t] of Object.entries(other.tables || {})) {
    if (!E.tables[k]) { E.tables[k] = { ...JSON.parse(JSON.stringify(t)), visible: null }; for (const f of Object.values(E.tables[k].fields)) f.visible = null; continue; }
    mergeSlot(E.tables[k], t);
    for (const [fk, f] of Object.entries(t.fields || {})) { if (!E.tables[k].fields[fk]) E.tables[k].fields[fk] = { ...JSON.parse(JSON.stringify(f)), visible: null }; else mergeSlot(E.tables[k].fields[fk], f); }
  }
  for (const g of ['settings', 'states']) for (const [k, x] of Object.entries(other[g] || {})) { E[g] ||= {}; if (!E[g][k]) E[g][k] = { ...JSON.parse(JSON.stringify(x)), visible: null }; else mergeSlot(E[g][k], x); }
  E.format = FORMAT;
  return E;
}

const lastSeen = o => Object.entries(o.seen || {}).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

// Rule 5: a backup in an older shape (no format, no option slots) is rebuilt by replaying its
// recorded program texts in order, each as an edit of the one before (the same text twice in a row
// is one version: older builds recorded every reload). If that fails the backup is not loaded.
export function upgradeSnapshot(snap) {
  const e = snap && snap.ever;
  if (!e) return { ever: null };
  if (e.format === FORMAT) return { ever: e };
  let E = emptySchema(), prev = null;
  const at = []; // original version index -> rebuilt index
  for (const v of e.versions || []) {
    if (!v || typeof v.src !== 'string') return { error: 'an older backup has a version without its program text, so its history cannot be rebuilt' };
    if (v.src === prev && v.edit === undefined && v.from === undefined) { at.push(E.versions.length - 1); continue; } // older builds recorded every reload
    const from = Number.isInteger(v.from) ? at[v.from] : undefined;
    const r = from !== undefined ? evolve(E, E.versions[from].src, { restore: true, version: from }) : evolve(E, v.edit ?? v.src, { replay: true });
    if (r.verdict === 'refused') return { error: `an older backup cannot be rebuilt: version "${v.src.split('\n')[0]}" does not apply (${r.refused[0]})` };
    if (r.verdict !== 'ask') E = r.ever;
    at.push(E.versions.length - 1);
    prev = v.src;
  }
  if (e.app) E.app = e.app;
  if (e.touched) E.touched = true;
  for (const k of Object.keys(snap.data?.tables || {})) if ((snap.data.tables[k] || []).length && !E.tables[k]) return { error: `an older backup cannot be rebuilt: rows of ${k} belong to no table of its history` };
  return { ever: E };
}

// rows that hold option names (older backups, data without history) get option slot ids: the name
// the history shows now, else the option last seen under that name. Ids start with #, so this is
// idempotent.
export function convertOptionRows(data, ever) {
  const conv = (slot, get, set) => {
    if (!slot || !slot.opts || (slot.type && slot.type.t !== 'pick')) return; // a field widened to text keeps its text as typed
    const byName = {};
    for (const [ok, o] of Object.entries(slot.opts)) for (const [n, v] of Object.entries(o.seen || {})) if (!(n in byName) || byName[n].v < v) byName[n] = { ok, v };
    for (const [ok, o] of Object.entries(slot.opts)) if (o.visible !== null) byName[o.visible] = { ok, v: Infinity };
    const v = get();
    if (typeof v !== 'string') return;
    if (v.startsWith('#') && slot.opts[v]) set({ o: v }); // round 6 stored the bare id
    else if (byName[v]) set({ o: byName[v].ok });
  };
  for (const [tk, t] of Object.entries(ever.tables || {})) for (const [fk, f] of Object.entries(t.fields || {})) for (const row of data.tables?.[tk] || []) conv(f, () => row[fk], x => { row[fk] = x; });
  for (const [k, sl] of Object.entries(ever.settings || {})) if (data.settings && k in data.settings) conv(sl, () => data.settings[k], x => { data.settings[k] = x; });
  for (const [k, sl] of Object.entries(ever.states || {})) if (data.state && `|${k}` in data.state) conv(sl, () => data.state[`|${k}`], x => { data.state[`|${k}`] = x; });
}
// a stored reference to a pick option: an object, so no typed text can ever look like one
const REJECT = Symbol('reject');
export const CATCH_UP = 600; // an every fires at most this many times per tick (a resume after a long sleep: 10 minutes of a 1s timer); the rest are skipped and logged
// a moment that can be an added time: a finite number of ms between the years 1900 and 3000
// a calendar date that exists (no 2026-02-30), between the years 1900 and 2999
const realDate = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s); if (!m) return false; const y = +m[1], mo = +m[2], d = +m[3]; return y >= 1900 && y < 3000 && mo >= 1 && mo <= 12 && d >= 1 && d <= new Date(Date.UTC(y, mo, 0)).getUTCDate(); };
const okMoment = v => typeof v === 'number' && isFinite(v) && v > -2208988800000 && v < 32503680000000;
// the delta of one undo step: what the tables (row by row), settings, states and seq were before it
export function makeDelta(b, app) {
  const d = { tables: {}, settings: {}, state: {}, seq: b.seq };
  const cur = app.data;
  for (const tk of new Set([...Object.keys(b.data.tables || {}), ...Object.keys(cur.tables || {})])) {
    const ba = b.data.tables[tk], aa = cur.tables[tk];
    if (!ba) { d.tables[tk] = { absent: true }; continue; }
    const rows = [];
    for (let i = 0; i < Math.max(ba.length, aa ? aa.length : 0); i++) if (i >= ba.length || !aa || i >= aa.length || JSON.stringify(ba[i]) !== JSON.stringify(aa[i])) rows.push([i, i < ba.length ? ba[i] : null]);
    if (rows.length || !aa || aa.length !== ba.length) d.tables[tk] = { len: ba.length, rows };
  }
  for (const g of ['settings', 'state']) for (const k of new Set([...Object.keys(b.data[g] || {}), ...Object.keys(cur[g] || {})])) {
    const x = (b.data[g] || {})[k], y = (cur[g] || {})[k];
    if (JSON.stringify(x) !== JSON.stringify(y)) d[g][k] = x === undefined ? { absent: true } : { v: x };
  }
  return d;
}
export function applyDelta(app, d) {
  const D = app.data;
  for (const [tk, t] of Object.entries(d.tables)) {
    if (t.absent) { delete D.tables[tk]; continue; }
    const arr = D.tables[tk] ||= [];
    for (const [i, r] of t.rows) if (r !== null && i < t.len) arr[i] = JSON.parse(JSON.stringify(r));
    arr.length = t.len;
  }
  for (const g of ['settings', 'state']) for (const [k, x] of Object.entries(d[g])) { D[g] ||= {}; if (x.absent) delete D[g][k]; else D[g][k] = JSON.parse(JSON.stringify(x.v)); }
  app.seq = d.seq;
}
export const isOptRef = v => v !== null && typeof v === 'object' && !Array.isArray(v) && typeof v.o === 'string' && Object.keys(v).length === 1;

// small seeded random, so tests are repeatable
function mulberry(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
