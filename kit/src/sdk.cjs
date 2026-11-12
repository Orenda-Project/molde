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
  const META = Symbol.for('molde.meta');

  /* ---- adapter -------------------------------------------------------------
   * Adapter interface (sync; the WebView bridge keeps a write-through cache):
   *   rows(tbl)        -> [{id, at, deleted_at, data:{...cols}}]  every readable record, tombstones included
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
      rows: (tbl) => Array.from(T(tbl).values()).map(clone),
      put: (tbl, rec) => { T(tbl).set(rec.id, clone(rec)); },
      nextId: (tbl) => { let m = 0; for (const id of T(tbl).keys()) if (id > m) m = id; return m + 1; },
      kvGet: (k) => (kv.has(k) ? clone(kv.get(k)) : undefined),
      kvSet: (k, v) => { kv.set(k, clone(v)); },
    };
    if (seed) {
      for (const [tbl, list] of Object.entries(seed.tables || {})) list.forEach((r) => a.put(tbl, r));
      for (const [k, v] of Object.entries(seed.kv || {})) a.kvSet(k, v);
    }
    return a;
  }

  /* ---- schema --------------------------------------------------------------- */
  const TEXT_MAX = 200, LONG_MAX = 2000, NUM_MAX = 1e12;
  const p2 = (n) => String(n).padStart(2, '0');
  const ymd = (d) => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
  const YMD = /^\d{4}-\d{2}-\d{2}$/;
  const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
  const validYmd = (s) => typeof s === 'string' && YMD.test(s) && ymd(parseYmd(s)) === s;
  const addDays = (d, n) => { const x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; };
  const mondayOf = (d) => addDays(d, -((d.getDay() + 6) % 7));
  const clampNum = (v) => { const n = Number(v); if (Number.isNaN(n)) return 0; return Math.max(-NUM_MAX, Math.min(NUM_MAX, n)); };

  function colDef(type) {
    if (typeof type === 'string' && type.startsWith('pick:')) return { k: 'pick', opts: type.slice(5).split('|') };
    return { k: type };
  }
  /* strict: used for writes. loose: used for reading stored data (never throws, fills defaults). */
  function coerce(def, v, dflt, strict) {
    const miss = v === undefined || v === null;
    switch (def.k) {
      case 'text': return miss ? '' : String(v).slice(0, TEXT_MAX);
      case 'long': return miss ? '' : String(v).slice(0, LONG_MAX);
      case 'num': return miss ? 0 : clampNum(v);
      case 'bool': return miss ? false : v === 'false' ? false : !!v;
      case 'date':
        if (miss) return dflt();
        if (validYmd(v)) return v;
        if (strict) bad('E_ARG', 'date must be a real YYYY-MM-DD, got ' + JSON.stringify(String(v).slice(0, 20)));
        return dflt();
      case 'pick': return def.opts.includes(v) ? v : def.opts[0];
      default: return v;
    }
  }

  function createSDK(opts) {
    opts = opts || {};
    const adapter = opts.adapter || memoryAdapter();
    const manifest = opts.manifest || { tables: {} };
    const reactive = opts.reactive || ((o) => o);
    const now = opts.now || (() => Date.now());
    const timers = opts.timers || { setTimeout: (f, ms) => setTimeout(f, ms), clearTimeout: (h) => clearTimeout(h), setInterval: (f, ms) => setInterval(f, ms), clearInterval: (h) => clearInterval(h) };
    const host = opts.host || {};
    const locale = opts.locale || manifest.locale || (typeof navigator !== 'undefined' && navigator.language) || 'en';
    const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
    const tableNames = () => Object.keys(manifest.tables || {});

    /* today() is reactive across midnight: it reads clock.d (so Alpine re-runs) and answers from the live clock. */
    const clock = reactive({ d: ymd(new Date(now())) });
    const refresh = () => { const d = ymd(new Date(now())); if (clock.d !== d) clock.d = d; };
    const today = () => { void clock.d; return ymd(new Date(now())); };

    /* ---- app (#14, #15, #16) ---- */
    const notifications = [];
    const HOW = ['date', 'time', 'rel'];
    const app = {
      today,
      fmt(ts, how) {
        let d;
        if (ts instanceof Date) d = ts;
        else if (typeof ts === 'string' && YMD.test(ts)) { if (!validYmd(ts)) bad('E_ARG', 'app.fmt: not a real date: ' + ts); d = parseYmd(ts); }
        else if (typeof ts === 'number' || typeof ts === 'string') d = new Date(ts);
        else bad('E_ARG', 'app.fmt(ts, how): ts is a ms timestamp, a Date or "YYYY-MM-DD"');
        if (Number.isNaN(d.getTime())) bad('E_ARG', 'app.fmt: invalid time ' + String(ts).slice(0, 30));
        how = how === undefined ? 'date' : how;
        if (!HOW.includes(how)) bad('E_ARG', "app.fmt: how is one of 'date', 'time', 'rel'");
        const tf = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' });
        if (how === 'time') return tf.format(d);
        const t0 = new Date(now());
        if (how === 'rel') {
          const days = Math.round((parseYmd(ymd(t0)) - parseYmd(ymd(d))) / 864e5);
          const rt = (n) => new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(n, 'day').replace(/^./, (c) => c.toUpperCase());
          if (days === 0) return rt(0) + ', ' + tf.format(d);
          if (days === 1) return rt(-1) + ', ' + tf.format(d);
          if (days > 1 && days < 7) return new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(d) + ', ' + tf.format(d);
        }
        return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: d.getFullYear() === t0.getFullYear() ? undefined : 'numeric' }).format(d);
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
        const job = { at, text: String(text).slice(0, 140) };
        if (host.notify) host.notify(job); else notifications.push(job);
        return job;
      },
    };

    /* ---- ui (#12, #13) ---- */
    const uiState = reactive({ toasts: [] });
    let toastId = 0;
    const dismiss = (id) => { const i = uiState.toasts.findIndex((t) => t.id === id); if (i >= 0) uiState.toasts.splice(i, 1); };
    const ui = {
      toast(msg, undo) {
        if ((typeof msg !== 'string' && typeof msg !== 'number') || String(msg).trim() === '') bad('E_ARG', 'ui.toast(msg): msg must be a non-empty string');
        if (undo !== undefined && typeof undo !== 'function') bad('E_ARG', 'ui.toast: the second argument is an undo function');
        const id = ++toastId;
        uiState.toasts.push({ id, msg: String(msg).slice(0, 140), undo: undo || null });
        const h = timers.setTimeout(() => dismiss(id), undo ? 10000 : 3000);
        return () => { timers.clearTimeout(h); dismiss(id); };
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
              s.left = Math.max(0, s.left - 1);
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
      const needCol = (c, what) => { if (c != null && !(typeof c === 'string' && known(c) && !(c in Object.prototype))) bad('E_COL', "'" + String(c).slice(0, 40) + "' is not a column of '" + name + "' (" + what + '). Columns: ' + cols.join(', ')); };
      const needKey = (k, what) => {
        if (!isObj(k) || !Object.keys(k).length) bad('E_ARG', what + ': pass a key object like {habit: "Read"}');
        Object.keys(k).forEach((c) => needCol(c, what));
      };
      const needOpts = (o, what) => {
        if (o == null) return {};
        if (!isObj(o)) bad('E_ARG', what + ': options must be an object');
        if (o.since != null && !['day', 'week', 'month'].includes(o.since)) bad('E_ARG', what + ": since is 'day', 'week' or 'month'");
        if (o.where != null) { if (!isObj(o.where)) bad('E_ARG', what + ': where must be an object'); Object.keys(o.where).forEach((c) => needCol(c, what + ' where')); }
        return o;
      };
      const dflt = (rec) => () => ymd(new Date(rec ? rec.at : now()));
      const toRow = (rec) => {
        const row = { id: rec.id, at: rec.at };
        const data = isObj(rec.data) ? rec.data : {};
        for (const c of cols) row[c] = coerce(defs[c], data[c], dflt(rec), false);
        return row;
      };
      const st = reactive({ rows: adapter.rows(name).filter((r) => !r.deleted_at).sort((a, b) => a.at - b.at || a.id - b.id).map(toRow) });
      const live = () => st.rows;
      const day = (r) => (dateCol && r[dateCol]) || ymd(new Date(r.at));
      const record = (id) => adapter.rows(name).find((r) => r.id === id);

      function pickCols(obj, fill) {
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
        const from = o.since === 'day' ? t0 : o.since === 'week' ? addDays(t0, -6) : o.since === 'month' ? addDays(t0, -29) : null;
        const f = from ? ymd(from) : null;
        return live().filter((r) => (!o.where || eq(r, o.where)) && (!f || day(r) >= f));
      }
      function softDelete(id) {
        const i = st.rows.findIndex((r) => r.id === id);
        if (i < 0) return false;
        const rec = record(id); rec.deleted_at = now(); adapter.put(name, rec);
        st.rows.splice(i, 1);
        return true;
      }

      const h = {
        /* #3 */ add(row) {
          if (!isObj(row)) bad('E_ARG', 't.add(row): row is an object like {what: "Run", mins: 30}');
          refresh();
          const data = pickCols(row, true);
          const id = adapter.nextId(name);
          const at = Number.isFinite(row.at) ? row.at : now();
          const rec = { id, at, deleted_at: null, data };
          adapter.put(name, rec);
          st.rows.push(toRow(rec));
          return id;
        },
        /* #4 */ set(id, patch) {
          if (!Number.isInteger(id)) bad('E_ARG', 't.set(id, patch): id is the number returned by t.add');
          if (!isObj(patch)) bad('E_ARG', 't.set(id, patch): patch is an object');
          refresh();
          const rec = record(id);
          if (!rec || rec.deleted_at) bad('E_ROW', name + ' has no row ' + id);
          const data = pickCols(patch, false);
          rec.data = Object.assign(rec.data, data); adapter.put(name, rec);
          Object.assign(st.rows.find((r) => r.id === id), data);
          return true;
        },
        /* #5 */ remove(id) {
          if (!Number.isInteger(id)) bad('E_ARG', 't.remove(id): id is the number returned by t.add');
          refresh();
          if (!softDelete(id)) return false;
          ui.toast('Removed', () => {
            const rec = record(id); rec.deleted_at = null; adapter.put(name, rec);
            st.rows.push(toRow(rec)); st.rows.sort((a, b) => a.at - b.at || a.id - b.id);
          });
          return true;
        },
        /* #6 */ sum(col, o) { needCol(col, 't.sum'); o = needOpts(o, 't.sum'); return window_(o).reduce((s, r) => s + val(r, col), 0); },
        /* #7 */ series(col, o) {
          needCol(col, 't.series'); o = needOpts(o, 't.series');
          const by = o.by === undefined ? 'day' : o.by, op = o.op || (col == null ? 'count' : 'sum');
          if (!['day', 'week', 'month'].includes(by)) bad('E_ARG', "t.series: by is 'day', 'week' or 'month'");
          if (!['sum', 'count', 'avg'].includes(op)) bad('E_ARG', "t.series: op is 'sum', 'count' or 'avg'");
          let last = o.last === undefined ? 7 : Number(o.last);
          if (!Number.isFinite(last)) bad('E_ARG', 't.series: last is a number');
          last = Math.min(366, Math.max(1, Math.floor(last)));
          const t0 = parseYmd(today());
          const keys = [];
          for (let i = last - 1; i >= 0; i--) {
            if (by === 'day') keys.push(ymd(addDays(t0, -i)));
            else if (by === 'week') keys.push(ymd(addDays(mondayOf(t0), -7 * i)));
            else { const d = new Date(t0.getFullYear(), t0.getMonth() - i, 1, 12); keys.push(d.getFullYear() + '-' + p2(d.getMonth() + 1)); }
          }
          const bucket = (r) => { const d = parseYmd(day(r)); return by === 'day' ? ymd(d) : by === 'week' ? ymd(mondayOf(d)) : d.getFullYear() + '-' + p2(d.getMonth() + 1); };
          const acc = new Map(keys.map((k) => [k, { n: 0, s: 0 }]));
          for (const r of o.where ? live().filter((x) => eq(x, o.where)) : live()) {
            const a = acc.get(bucket(r));
            if (a) { a.n += 1; a.s += val(r, col); }
          }
          return keys.map((k) => { const a = acc.get(k); return { k, v: op === 'count' ? a.n : op === 'avg' ? (a.n ? a.s / a.n : 0) : a.s }; });
        },
        /* #8 */ group(col, valCol, o) {
          if (col == null) bad('E_COL', 't.group(col, valCol): col is required'); needCol(col, 't.group'); needCol(valCol, 't.group'); o = needOpts(o, 't.group');
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
        rows: { get: () => Object.freeze(st.rows.map((r) => Object.freeze(Object.assign({}, r)))) },
        [META]: { value: () => ({ schema: JSON.parse(JSON.stringify(schema)), cols: cols.slice(), dateCol }) },
      });
      handles.set(name, h);
      return h;
    }

    const store = {
      /* #1 */ t: table,
      /* #2 */ kv(key, dfl) {
        if (typeof key !== 'string' || !key || key.length > 60 || key in Object.prototype || key === 'prototype') bad('E_TABLE', "store.kv('" + String(key).slice(0, 40) + "'): key must be a plain name");
        if (boxes.has(key)) return boxes.get(key);
        const got = adapter.kvGet(key);
        const st = reactive({ v: got === undefined ? dfl : got });
        const box = { get v() { return st.v; }, set v(x) { st.v = x; adapter.kvSet(key, x); } };
        boxes.set(key, box);
        return box;
      },
    };

    /* host/kit-only surface: NOT part of the 16 calls and not put on window by components.js */
    const internal = { toasts: () => uiState.toasts, dismiss, refresh, notifications, locale, errors: () => adapter.errors || [], META };
    return { store, ui, app, MoldeError, internal };
  }

  const CALLS = ['store.t', 'store.kv', 't.add', 't.set', 't.remove', 't.sum', 't.series', 't.group', 't.has', 't.toggle', 't.streak', 'ui.toast', 'ui.timer', 'app.notify', 'app.fmt', 'app.today'];
  return { createSDK, memoryAdapter, MoldeError, CALLS, colDef, ymd, META };
});
