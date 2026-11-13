/* Molde SDK, contract v1: 16 calls on three globals (store, ui, app).
 * UMD: a classic script in the WebView (window.MoldeSDK) and require() in node tests.
 * The host owns storage. This file only talks to an adapter (see memoryAdapter).
 * Every bad argument raises a MoldeError with a code (E_ARG, E_TABLE, E_COL, E_ROW); nothing throws a raw TypeError. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MoldeSDK = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  class MoldeError extends Error {
    constructor(code, msg) { super(code + ': ' + msg); this.name = 'MoldeError'; this.code = code; }
  }
  const bad = (code, msg) => { throw new MoldeError(code, msg); };
  const isObj = (o) => o !== null && typeof o === 'object' && !Array.isArray(o);
  const META = Symbol.for('molde.meta'), TX = Symbol.for('molde.tx');

  /* ---- adapter -------------------------------------------------------------
   * Adapter interface (sync; the WebView bridge keeps a write-through cache):
   *   rows(tbl)        -> [{id, at, deleted_at, data:{...cols}}]  every readable record, tombstones included
   *   get(tbl, id)     -> one record or undefined (optional; falls back to scanning rows)
 *   put(tbl, rec)    -> insert or replace one record by id (rec has the same shape)
   *   nextId(tbl)      -> integer id not used before in this table
   *   kvGet(key)       -> stored value or undefined
   *   kvSet(key, val)  -> store a JSON-able value
   *   errors           -> optional array; an adapter that skips unreadable rows pushes {tbl, id, msg} here
   * No call drops, truncates or hard-deletes anything (contract data-survival rule 1). */
  function memoryAdapter(seed) {
    const tables = new Map(), kv = new Map(), errors = [];
    const T = (n) => { if (!tables.has(n)) tables.set(n, new Map()); return tables.get(n); };
    const clone = (x) => JSON.parse(JSON.stringify(x));
    const a = {
      errors,
      rows: (tbl) => Array.from(T(tbl).values()),
      get: (tbl, id) => T(tbl).get(id),
      put: (tbl, rec) => { T(tbl).set(rec.id, clone(rec)); },
      nextId: (tbl) => { let m = 0; for (const id of T(tbl).keys()) if (id > m) m = id; return m + 1; },
      kvGet: (k) => (kv.has(k) ? clone(kv.get(k)) : undefined),
      kvSet: (k, v) => { kv.set(k, clone(v)); },
    };
    if (seed) {
      for (const [tbl, list] of Object.entries(seed.tables || {})) list.forEach((r) => T(tbl).set(r.id, r)); /* trusted seed: no copy */
      for (const [k, v] of Object.entries(seed.kv || {})) a.kvSet(k, v);
    }
    return a;
  }

  /* ---- schema --------------------------------------------------------------- */
  const TEXT_MAX = 1000, LONG_MAX = 20000, NUM_MAX = 1e12, NOTE_MAX = 200; /* limits are errors, never silent cuts */
  const p2 = (n) => String(n).padStart(2, '0');
  const ymd = (d) => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
  const YMD = /^\d{4}-\d{2}-\d{2}$/;
  const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
  const validYmd = (s) => typeof s === 'string' && YMD.test(s) && ymd(parseYmd(s)) === s;
  const addDays = (d, n) => { const x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; };
  const clampNum = (v) => { const n = Number(v); if (Number.isNaN(n)) return 0; return Math.max(-NUM_MAX, Math.min(NUM_MAX, n)); };

  /* parseNum(text, max): the typed number in the reader's own notation, or NaN. Digits may be Latin, Arabic-Indic (U+0660..9) or Persian (U+06F0..9).
   * '.' is always a decimal point. ',' (or the Arabic comma/decimal mark) is a decimal comma ('82,5' = 82.5) except when it is unambiguous
   * grouping: '1,234' and '1,234,567' (groups of exactly 3 digits, no leading 0) are read as 1234 and 1234567 UNLESS that exceeds `max` and
   * the decimal reading ('1.234') fits, so a weight field that stops at 500 reads '1,500' as 1.5. Spaces and apostrophes are ignored. */
  function parseNum(text, max) {
    let t = String(text == null ? '' : text).trim();
    if (!t) return NaN;
    t = t.replace(/[\u0660-\u0669]/g, (c) => c.charCodeAt(0) - 0x660).replace(/[\u06f0-\u06f9]/g, (c) => c.charCodeAt(0) - 0x6f0)
      .replace(/[\u066b\u060c]/g, ',').replace(/\u066c/g, ',').replace(/[\s\u00a0\u202f'\u2019]/g, '').replace(/\u2212/g, '-');
    const sign = t[0] === '-' || t[0] === '+' ? t[0] : ''; if (sign) t = t.slice(1);
    const lim = typeof max === 'number' && Number.isFinite(max) ? max : Infinity;
    let dec;
    if (t.includes(',') && t.includes('.')) { /* the last mark is the decimal one, the other must be grouping */
      const d = Math.max(t.lastIndexOf(','), t.lastIndexOf('.')), head = t.slice(0, d), seps = head.replace(/\d/g, '');
      if (!/^[1-9]\d{0,2}(?:[.,]\d{3})*$/.test(head) || seps.includes(t[d]) || new Set(seps).size > 1) return NaN;
      dec = head.replace(/[.,]/g, '') + '.' + t.slice(d + 1);
    } else if (t.includes(',')) {
      const parts = t.split(',');
      const group = /^[1-9]\d{0,2}(,\d{3})+$/.test(t);
      const asGroup = group ? Number(t.replace(/,/g, '')) : NaN;
      if (group && (asGroup <= lim || parts.length > 2)) dec = t.replace(/,/g, '');
      else if (parts.length === 2) dec = parts[0] + '.' + parts[1];
      else return NaN;
    } else dec = t;
    if (!/^(\d+\.?\d*|\.\d+)$/.test(dec)) return NaN;
    const n = Number(dec); if (!Number.isFinite(n)) return NaN;
    return sign === '-' ? -n : n;
  }
  function colDef(type) {
    if (typeof type === 'string' && type.startsWith('pick:')) return { k: 'pick', opts: type.slice(5).split('|') };
    if (type === 'num?') return { k: 'num', opt: true }; /* optional number: empty is allowed and stored as null */
    return { k: type };
  }
  /* Writes are strict: a value that is not what the column holds raises E_ARG (a number column does not accept NaN, "abc", "", null,
   * true or Infinity; a pick column only its options; text only text or a number). Finite numbers beyond +-1e12 are clamped (the one
   * documented clip). Reads are lenient: stored data is filled with type defaults and never throws. */
  function coerceStrict(def, v, dflt) {
    if (v === undefined) return coerceLoose(def, v, dflt);
    const shown = () => JSON.stringify(typeof v === 'string' ? v.slice(0, 20) : v);
    if (v === null && def.opt) return null;
    if (v === null) bad('E_ARG', 'null is not a value for a ' + def.k + ' column; leave the key out to get the default');
    switch (def.k) {
      case 'text': case 'long': {
        if (typeof v !== 'string' && !(typeof v === 'number' && Number.isFinite(v))) bad('E_ARG', 'a ' + def.k + ' column holds text, not ' + typeof v);
        const max = def.k === 'text' ? TEXT_MAX : LONG_MAX, s = String(v);
        if (s.length > max) bad('E_ARG', 'text is ' + s.length + ' characters; the limit for a ' + def.k + ' column is ' + max);
        return s;
      }
      case 'num': {
        const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
        if (!Number.isFinite(n)) bad('E_ARG', 'a number column holds a finite number, got ' + shown());
        return Math.max(-NUM_MAX, Math.min(NUM_MAX, n));
      }
      case 'bool':
        if (typeof v === 'boolean') return v; if (v === 1 || v === 0) return v === 1; if (v === 'true' || v === 'false') return v === 'true';
        return bad('E_ARG', 'a bool column holds true or false, not ' + shown());
      case 'date':
        if (validYmd(v)) return v;
        return bad('E_ARG', 'date must be a real YYYY-MM-DD, got ' + shown());
      case 'pick':
        if (def.opts.includes(v)) return v;
        return bad('E_ARG', shown() + ' is not one of ' + def.opts.join(', '));
      default: return v;
    }
  }
  function coerceLoose(def, v, dflt) {
    const miss = v === undefined || v === null;
    switch (def.k) {
      case 'text': case 'long': return miss ? '' : String(v);
      case 'num': return miss ? (def.opt ? null : 0) : clampNum(v);
      case 'bool': return miss ? false : v === 'false' ? false : !!v;
      case 'date': return miss ? dflt() : validYmd(v) ? v : dflt();
      case 'pick': return def.opts.includes(v) ? v : def.opts[0];
      default: return v;
    }
  }
  const coerce = (def, v, dflt, strict) => (strict ? coerceStrict(def, v, dflt) : coerceLoose(def, v, dflt));

  function createSDK(opts) {
    opts = opts || {};
    const adapter = opts.adapter || memoryAdapter();
    const manifest = opts.manifest || { tables: {} };
    const reactive = opts.reactive || ((o) => o);
    const now = opts.now || (() => Date.now());
    const timers = opts.timers || { setTimeout: (f, ms) => setTimeout(f, ms), clearTimeout: (h) => clearTimeout(h), setInterval: (f, ms) => setInterval(f, ms), clearInterval: (h) => clearInterval(h) };
    const host = opts.host || {};
    const locale = opts.locale || manifest.locale || (typeof navigator !== 'undefined' && navigator.language) || 'en';
    /* week start: manifest.weekStart (0=Sunday..6) or 'locale'; default Monday. since:'week' and series by:'week' both use it. */
    let ws = opts.weekStart !== undefined ? opts.weekStart : manifest.weekStart !== undefined ? manifest.weekStart : 1;
    if (ws === 'locale') { try { const wi = new Intl.Locale(locale); const f = (wi.getWeekInfo ? wi.getWeekInfo() : wi.weekInfo || {}).firstDay; ws = f ? f % 7 : 1; } catch (e) { ws = 1; } }
    ws = Number.isInteger(ws) && ws >= 0 && ws <= 6 ? ws : 1;
    const startOfWeek = (d) => addDays(d, -((d.getDay() - ws + 7) % 7));
    const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
    const tableNames = () => Object.keys(manifest.tables || {});

    /* today() is reactive across midnight: it reads clock.d (so Alpine re-runs) and answers from the live clock. */
    const clock = reactive({ d: ymd(new Date(now())) });
    const refresh = () => { const d = ymd(new Date(now())); if (clock.d !== d) clock.d = d; };
    const today = () => { void clock.d; return ymd(new Date(now())); };

    /* ---- app (#14, #15, #16) ---- */
    const notifications = [];
    const fm = new Map(); const dtf = (o) => { const k = JSON.stringify(o); if (!fm.has(k)) fm.set(k, new Intl.DateTimeFormat(locale, o)); return fm.get(k); }; /* formatters are costly to build: one per option set */
    const HOW = ['date', 'time', 'rel', 'wd', 'day', 'dm', 'month']; /* wd: Mon, day: 17, dm: Mon 17 Nov, month: November 2026 */
    const app = {
      today,
      fmt(ts, how) {
        let d, dateOnly = false;
        if (ts instanceof Date) d = ts;
        else if (typeof ts === 'string' && YMD.test(ts)) { if (!validYmd(ts)) bad('E_ARG', 'app.fmt: not a real date: ' + ts); d = parseYmd(ts); dateOnly = true; }
        else if (typeof ts === 'number' || typeof ts === 'string') d = new Date(ts);
        else bad('E_ARG', 'app.fmt(ts, how): ts is a ms timestamp, a Date or "YYYY-MM-DD"');
        if (Number.isNaN(d.getTime())) bad('E_ARG', 'app.fmt: invalid time ' + String(ts).slice(0, 30));
        how = how === undefined ? 'date' : how;
        if (!HOW.includes(how)) bad('E_ARG', "app.fmt: how is one of " + HOW.map((x) => "'" + x + "'").join(', '));
        const part = { wd: { weekday: 'short' }, day: { day: 'numeric' }, dm: { weekday: 'short', day: 'numeric', month: 'short' }, month: { month: 'long', year: 'numeric' } }[how];
        if (part) return dtf(part).format(d);
        const tf = dtf({ hour: 'numeric', minute: '2-digit' });
        if (how === 'time') { if (dateOnly) bad('E_ARG', 'app.fmt: a date-only string has no time of day'); return tf.format(d); }
        const withTime = (s) => (dateOnly ? s : s + ', ' + tf.format(d));
        const t0 = new Date(now());
        if (how === 'rel') {
          const days = Math.round((parseYmd(ymd(t0)) - parseYmd(ymd(d))) / 864e5);
          const rt = (n) => new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(n, 'day').replace(/^./, (c) => c.toUpperCase());
          if (days === 0) return withTime(rt(0));
          if (days === 1) return withTime(rt(-1));
          if (days > 1 && days < 7) return withTime(dtf({ weekday: 'long' }).format(d));
        }
        return dtf({ day: 'numeric', month: 'short', year: d.getFullYear() === t0.getFullYear() ? undefined : 'numeric' }).format(d);
      },
      notify(when, text) {
        let at;
        if (when instanceof Date) at = when.getTime();
        else if (typeof when === 'number') at = when;
        else if (typeof when === 'string' && /^\d{1,2}:\d{2}$/.test(when)) {
          const [h, m] = when.split(':').map(Number);
          if (h > 23 || m > 59) bad('E_ARG', 'app.notify: "' + when + '" is not a time of day');
          const d = new Date(now()); d.setHours(h, m, 0, 0);
          if (d.getTime() <= now()) d.setDate(d.getDate() + 1);
          at = d.getTime();
        } else bad('E_ARG', 'app.notify(when, text): when is a Date, a ms timestamp or "HH:MM"');
        if (!Number.isFinite(at)) bad('E_ARG', 'app.notify: when is not a valid time');
        if ((typeof text !== 'string' && typeof text !== 'number') || String(text).trim() === '') bad('E_ARG', 'app.notify: text must be a non-empty string');
        if (String(text).length > NOTE_MAX) bad('E_ARG', 'app.notify: text is limited to ' + NOTE_MAX + ' characters');
        const job = { at, text: String(text) };
        if (host.notify) host.notify(job); else notifications.push(job);
        return job;
      },
    };

    /* ---- ui (#12, #13) ---- */
    const uiState = reactive({ toasts: [] });
    let toastId = 0;
    const toastTimers = new Map();
    const dismiss = (id) => { const i = uiState.toasts.findIndex((t) => t.id === id); if (i >= 0) uiState.toasts.splice(i, 1); if (toastTimers.has(id)) { timers.clearTimeout(toastTimers.get(id)); toastTimers.delete(id); } };
    const ui = {
      toast(msg, undo) {
        if ((typeof msg !== 'string' && typeof msg !== 'number') || String(msg).trim() === '') bad('E_ARG', 'ui.toast(msg): msg must be a non-empty string');
        if (String(msg).length > NOTE_MAX) bad('E_ARG', 'ui.toast: msg is limited to ' + NOTE_MAX + ' characters');
        if (undo !== undefined && typeof undo !== 'function') bad('E_ARG', 'ui.toast: the second argument is an undo function');
        const id = ++toastId;
        for (;;) { /* at most 3 plain toasts: the newest replaces the oldest plain one. A pending Undo is NEVER evicted: it leaves only when used or when its own timer ends */
          const plain = uiState.toasts.filter((x) => !x.undo);
          if (plain.length < 3) break;
          dismiss(plain[0].id);
        }
        uiState.toasts.push({ id, msg: String(msg), undo: undo || null });
        toastTimers.set(id, timers.setTimeout(() => dismiss(id), undo ? 10000 : 3000));
        return () => dismiss(id);
      },
      timer(sec, cb) {
        if (typeof sec !== 'number' || !Number.isFinite(sec) || sec <= 0 || sec > 86400) bad('E_ARG', 'ui.timer(sec, cb): sec is a number from 1 to 86400');
        if (cb !== undefined && typeof cb !== 'function') bad('E_ARG', 'ui.timer: cb must be a function');
        sec = Math.ceil(sec);
        const s = reactive({ left: sec, running: false });
        let h = null;
        const stop = () => { if (h != null) timers.clearInterval(h); h = null; s.running = false; };
        return {
          get left() { return s.left; },
          get running() { return s.running; },
          start() {
            if (s.running) return;
            if (s.left <= 0) s.left = sec;
            s.running = true;
            h = timers.setInterval(() => {
              s.left -= 1; /* the interval stops at 0, so it never goes below */
              if (s.left === 0) { stop(); if (cb) cb(); }
            }, 1000);
          },
          stop,
        };
      },
    };

    /* ---- store ---- */
    const handles = new Map(), boxes = new Map();
    function table(name) {
      if (typeof name !== 'string' || !own(manifest.tables || {}, name)) bad('E_TABLE', "store.t('" + String(name).slice(0, 40) + "') not in tables [" + tableNames().join(', ') + ']. Use one of those');
      if (handles.has(name)) return handles.get(name);
      const schema = manifest.tables[name];
      const defs = Object.create(null); let dateCol = null;
      for (const [c, ty] of Object.entries(schema)) { defs[c] = colDef(ty); if (!dateCol && defs[c].k === 'date') dateCol = c; }
      const cols = Object.keys(defs);
      const known = (k) => k === 'id' || k === 'at' || k in defs;
      const needCol = (c, what) => { if (c != null && !(typeof c === 'string' && known(c))) bad('E_COL', "'" + String(c).slice(0, 40) + "' is not a column of '" + name + "' (" + what + '). Columns: ' + cols.join(', ')); };
      const needNum = (c, what) => { if (c != null && !(defs[c] ? defs[c].k === 'num' : c === 'id' || c === 'at')) bad('E_COL', "'" + c + "' is not a number column of '" + name + "' (" + what + ')'); };
      const needKey = (k, what) => {
        if (!isObj(k) || !Object.keys(k).length) bad('E_ARG', what + ': pass a key object like {name: "Read"}');
        Object.keys(k).forEach((c) => needCol(c, what));
      };
      const needOpts = (o, what) => {
        if (o == null) return {};
        if (!isObj(o)) bad('E_ARG', what + ': options must be an object');
        if ('since' in o && !['day', 'week', 'month', 'last7', 'last30'].includes(o.since)) bad('E_ARG', what + ": since is 'day', 'week', 'month' (calendar-aligned) or 'last7', 'last30'");
        if ('month' in o && !(Number.isInteger(o.month) && o.month <= 0 && o.month >= -1200)) bad('E_ARG', what + ': month is 0 (this month), -1 (last month) and so on');
        if ('where' in o) { if (!isObj(o.where)) bad('E_ARG', what + ': where must be an object'); Object.keys(o.where).forEach((c) => needCol(c, what + ' where')); }
        return o;
      };
      const dflt = (rec) => () => ymd(new Date(rec ? rec.at : now()));
      const DATE = /^\d{4}-\d{2}-\d{2}$/;
      const toRow = (rec) => {
        const row = { id: rec.id, at: rec.at };
        const data = isObj(rec.data) ? rec.data : {};
        for (const c of cols) {
          const d = defs[c], v = data[c], k = d.k; /* fast path for well-formed stored values, full coercion otherwise */
          row[c] = (k === 'text' || k === 'long') && typeof v === 'string' ? v : k === 'num' && typeof v === 'number' && v === v && v <= NUM_MAX && v >= -NUM_MAX ? v : k === 'bool' && typeof v === 'boolean' ? v : k === 'date' && typeof v === 'string' && DATE.test(v) && validYmd(v) ? v : coerce(d, v, dflt(rec), false);
        }
        return row;
      };
      const st = reactive({ ver: 0, rows: adapter.rows(name).filter((r) => !r.deleted_at).sort((a, b) => a.at - b.at || a.id - b.id).map(toRow) });
      let snap = null, snapVer = -1; /* t.rows is a frozen copy, rebuilt only when the table changed */
      const live = () => st.rows;
      const day = (r) => (dateCol && r[dateCol]) || ymd(new Date(r.at));
      const record = (id) => (adapter.get ? adapter.get(name, id) : adapter.rows(name).find((r) => r.id === id));

      function pickCols(obj, fill, allowAt) {
        for (const [k, v] of Object.entries(obj)) {
          if (!(k in defs) && !(allowAt && k === 'at')) bad('E_COL', "'" + k.slice(0, 40) + "' is not a column of '" + name + "'. Columns: " + cols.join(', '));
          if (v !== undefined && v !== null && !['string', 'number', 'boolean'].includes(typeof v)) bad('E_ARG', "t.add/t.set: the value of '" + k + "' must be text, a number or true/false");
        }
        const data = {};
        for (const c of cols) {
          if (c in obj) data[c] = coerce(defs[c], obj[c], today, true);
          else if (fill) data[c] = coerce(defs[c], undefined, today, true);
        }
        return data;
      }
      const eq = (r, o) => Object.entries(o).every(([k, v]) => r[k] === v);
      const keyOf = (k, withDay) => { const o = Object.assign({}, k); if (withDay && dateCol && !(dateCol in o)) o[dateCol] = today(); return o; };
      const val = (r, col) => (col == null ? 1 : Number(r[col]) || 0);
      function window_(o) {
        const t0 = parseYmd(today());
        const from = o.since === 'day' ? t0 : o.since === 'week' ? startOfWeek(t0) : o.since === 'month' ? new Date(t0.getFullYear(), t0.getMonth(), 1, 12) : o.since === 'last7' ? addDays(t0, -6) : o.since === 'last30' ? addDays(t0, -29) : null;
        let f = from ? ymd(from) : null, to = null;
        if (o.month !== undefined) { f = ymd(new Date(t0.getFullYear(), t0.getMonth() + o.month, 1, 12)); to = ymd(new Date(t0.getFullYear(), t0.getMonth() + o.month + 1, 1, 12)); } /* one whole calendar month */
        return live().filter((r) => (!o.where || eq(r, o.where)) && (!f || day(r) >= f) && (!to || day(r) < to));
      }
      function restore(id) {
        const rec = record(id); if (!rec || !rec.deleted_at) return false;
        rec.deleted_at = null; adapter.put(name, rec);
        st.rows.push(toRow(rec)); st.rows.sort((a, b) => a.at - b.at || a.id - b.id); st.ver++;
        return true;
      }
      function softDelete(id) {
        const i = st.rows.findIndex((r) => r.id === id);
        if (i < 0) return false;
        const rec = record(id); rec.deleted_at = now(); adapter.put(name, rec);
        st.rows.splice(i, 1); st.ver++;
        return true;
      }

      const h = {
        /* #3 */ add(row) {
          if (!isObj(row)) bad('E_ARG', 't.add(row): row is an object like {what: "Run", mins: 30}');
          refresh();
          const data = pickCols(row, true, true);
          const id = adapter.nextId(name);
          if ('at' in row && row.at !== undefined && !Number.isFinite(row.at)) bad('E_ARG', 't.add: at is a ms timestamp');
          const at = Number.isFinite(row.at) ? row.at : now();
          const rec = { id, at, deleted_at: null, data };
          adapter.put(name, rec);
          st.rows.push(toRow(rec)); st.ver++;
          return id;
        },
        /* #4 */ set(id, patch) {
          if (!Number.isInteger(id)) bad('E_ARG', 't.set(id, patch): id is the number returned by t.add');
          if (!isObj(patch)) bad('E_ARG', 't.set(id, patch): patch is an object');
          refresh();
          const rec = record(id);
          if (!rec || rec.deleted_at) bad('E_ROW', name + ' has no row ' + id);
          const data = pickCols(patch, false);
          rec.data = Object.assign(isObj(rec.data) ? rec.data : {}, data); adapter.put(name, rec);
          Object.assign(st.rows.find((r) => r.id === id), data); st.ver++;
          return true;
        },
        /* #5 */ remove(id) {
          if (!Number.isInteger(id)) bad('E_ARG', 't.remove(id): id is the number returned by t.add');
          refresh();
          if (!softDelete(id)) return false;
          const rec = record(id), nm = rec && isObj(rec.data) ? Object.entries(rec.data).find(([c, v]) => defs[c] && (defs[c].k === 'text' || defs[c].k === 'long') && typeof v === 'string' && v.trim()) : null;
          ui.toast('Removed' + (nm ? ' ' + nm[1].trim().slice(0, 30) : ''), () => { restore(id); });
          return true;
        },
        /* #6 */ sum(col, o) { needCol(col, 't.sum'); needNum(col, 't.sum'); o = needOpts(o, 't.sum'); return window_(o).reduce((s, r) => s + val(r, col), 0); },
        /* #7 */ series(col, o) {
          needCol(col, 't.series'); o = needOpts(o, 't.series');
          const by = o.by === undefined ? 'day' : o.by, op = o.op || (col == null ? 'count' : 'sum');
          if (!['day', 'week', 'month'].includes(by)) bad('E_ARG', "t.series: by is 'day', 'week' or 'month'");
          if (!['sum', 'count', 'avg'].includes(op)) bad('E_ARG', "t.series: op is 'sum', 'count' or 'avg'");
          let last = o.last === undefined ? 7 : o.last;
          if (o.weeks !== undefined) { /* whole weeks: from the first day of the week (weeks - 1) weeks ago through today, so rows of seven line up with the weekday */
            if (typeof o.weeks !== 'number' || !Number.isFinite(o.weeks) || o.weeks < 1 || o.weeks > 52) bad('E_ARG', 't.series: weeks is a number from 1 to 52');
            if (by !== 'day') bad('E_ARG', "t.series: weeks goes with by 'day'");
            const t = parseYmd(today()); last = Math.round((t - addDays(startOfWeek(t), -7 * (Math.floor(o.weeks) - 1))) / 864e5) + 1;
          }
          if (typeof last !== 'number' || !Number.isFinite(last) || last < 1) bad('E_ARG', 't.series: last is a number from 1 to 366');
          last = Math.min(366, Math.floor(last));
          if (op !== 'count') needNum(col, 't.series');
          const t0 = parseYmd(today());
          const keys = [];
          for (let i = last - 1; i >= 0; i--) {
            if (by === 'day') keys.push(ymd(addDays(t0, -i)));
            else if (by === 'week') keys.push(ymd(addDays(startOfWeek(t0), -7 * i)));
            else { const d = new Date(t0.getFullYear(), t0.getMonth() - i, 1, 12); keys.push(d.getFullYear() + '-' + p2(d.getMonth() + 1)); }
          }
          const bucket = (r) => { const d = parseYmd(day(r)); return by === 'day' ? ymd(d) : by === 'week' ? ymd(startOfWeek(d)) : d.getFullYear() + '-' + p2(d.getMonth() + 1); };
          const acc = new Map(keys.map((k) => [k, { n: 0, s: 0 }]));
          for (const r of o.where ? live().filter((x) => eq(x, o.where)) : live()) {
            const a = acc.get(bucket(r));
            if (a) { a.n += 1; a.s += val(r, col); }
          }
          return keys.map((k) => { const a = acc.get(k); return { k, v: op === 'count' ? a.n : op === 'avg' ? (a.n ? a.s / a.n : 0) : a.s }; });
        },
        /* #8 */ group(col, valCol, o) {
          if (col == null) bad('E_COL', 't.group(col, valCol): col is required'); needCol(col, 't.group'); needCol(valCol, 't.group'); needNum(valCol, 't.group'); o = needOpts(o, 't.group');
          const m = new Map();
          for (const r of window_(o)) m.set(r[col], (m.get(r[col]) || 0) + val(r, valCol));
          return Array.from(m, ([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v);
        },
        /* #9 */ has(k) { needKey(k, 't.has'); const o = keyOf(k, true); return live().some((r) => eq(r, o)); },
        /* #10 */ toggle(k) {
          needKey(k, 't.toggle'); refresh();
          const o = keyOf(k, true);
          const hit = live().find((r) => eq(r, o));
          if (hit) { softDelete(hit.id); return false; }
          h.add(o); return true;
        },
        /* #11 */ streak(k) {
          needKey(k, 't.streak');
          if (!dateCol) bad('E_COL', "t.streak needs a date column; table '" + name + "' has none");
          const o = keyOf(k, false); delete o[dateCol];
          const days = new Set(live().filter((r) => eq(r, o)).map((r) => r[dateCol]));
          let d = parseYmd(today()), n = 0;
          if (!days.has(ymd(d))) d = addDays(d, -1);
          while (days.has(ymd(d))) { n++; d = addDays(d, -1); }
          return n;
        },
      };
      /* non-enumerable: Object.keys(handle) is exactly the 9 table calls. rows is a frozen read-only copy. */
      Object.defineProperties(h, {
        name: { value: name },
        toJSON: { value: () => name },
        cols: { get: () => cols.slice() },
        rows: { get: () => { const v = st.ver; if (snapVer !== v || !snap) { snap = Object.freeze(st.rows.map((r) => Object.freeze(Object.assign({}, r)))); snapVer = v; } return snap; } },
        [TX]: { value: () => ({ del: softDelete, undel: restore, ids: (col, val) => st.rows.filter((r) => String(r[col]) === String(val)).map((r) => r.id) }) }, /* a function: a reactive proxy must not have to wrap the value */
        [META]: { value: () => ({ schema: JSON.parse(JSON.stringify(schema, (k, v) => (v === 'num?' ? 'num' : v))), cols: cols.slice(), dateCol, opt: cols.filter((c) => defs[c].opt) }) },
      });
      handles.set(name, h);
      return h;
    }

    const store = {
      /* #1 */ t: table,
      /* #2 */ kv(key, dfl) {
        const jsonable = (x, depth) => { if (depth > 6) return false; if (x === null || ['string', 'boolean'].includes(typeof x)) return true; if (typeof x === 'number') return Number.isFinite(x); if (Array.isArray(x)) return x.every((y) => jsonable(y, depth + 1)); if (isObj(x) && (Object.getPrototypeOf(x) === Object.prototype || Object.getPrototypeOf(x) === null)) return Object.values(x).every((y) => jsonable(y, depth + 1)); return false; };
        if (typeof key !== 'string' || !key || key.length > 60 || key in Object.prototype || key === 'prototype') bad('E_TABLE', "store.kv('" + String(key).slice(0, 40) + "'): key must be a plain name");
        if (boxes.has(key)) return boxes.get(key);
        if (!jsonable(dfl, 0)) bad('E_ARG', 'store.kv: the default must be JSON data (text, number, true/false, list, plain object)');
        const got = adapter.kvGet(key);
        const st = reactive({ v: got === undefined ? dfl : got });
        const box = { get v() { return st.v; }, set v(x) { if (!jsonable(x, 0)) bad('E_ARG', 'store.kv(' + key + ').v: only JSON data can be stored'); st.v = x; adapter.kvSet(key, x); } };
        boxes.set(key, box);
        return box;
      },
    };

    /* host/kit-only surface: NOT part of the 16 calls and not put on window by components.js */
    /* One undoable step for a parent and the child rows that point at it: one toast, one Undo, one adapter transaction. Not a public call. */
    const batch = (fn) => (adapter.batch ? adapter.batch(fn) : fn());
    const removeGroup = (items, msg) => {
      refresh(); const done = [];
      batch(() => items.forEach(([tb, ids]) => { const x = tb[TX](); ids.forEach((id) => { if (x.del(id)) done.push([x, id]); }); }));
      if (!done.length) return 0;
      ui.toast(msg || 'Removed', () => batch(() => done.forEach(([x, id]) => x.undel(id))));
      return done.length;
    };
    const internal = { parseNum, removeGroup, TX, weekStart: ws, toasts: () => uiState.toasts, dismiss, refresh, notifications, locale, errors: () => adapter.errors || [], META };
    return { store, ui, app, MoldeError, internal };
  }

  const LIMITS = { text: TEXT_MAX, long: LONG_MAX, num: NUM_MAX, note: NOTE_MAX };
  const CALLS = ['store.t', 'store.kv', 't.add', 't.set', 't.remove', 't.sum', 't.series', 't.group', 't.has', 't.toggle', 't.streak', 'ui.toast', 'ui.timer', 'app.notify', 'app.fmt', 'app.today'];
  return { createSDK, memoryAdapter, MoldeError, CALLS, colDef, ymd, META, TX, LIMITS };
});
