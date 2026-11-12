/* Molde SDK, contract v1: 16 calls on three globals (store, ui, app).
 * UMD: a classic script in the WebView (window.MoldeSDK) and require() in node tests.
 * The host owns storage. This file only talks to an adapter (see memoryAdapter). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MoldeSDK = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  class MoldeError extends Error {
    constructor(code, msg) { super(code + ': ' + msg); this.code = code; }
  }

  /* ---- adapter -------------------------------------------------------------
   * Adapter interface (sync; the WebView bridge keeps a write-through cache):
   *   rows(tbl)        -> [{id, at, deleted_at, data:{...cols}}]  every record, tombstones included
   *   put(tbl, rec)    -> insert or replace one record by id (rec has the same shape)
   *   nextId(tbl)      -> integer id not used before in this table
   *   kvGet(key)       -> stored value or undefined
   *   kvSet(key, val)  -> store a JSON-able value
   * No call drops, truncates or hard-deletes anything (contract data-survival rule 1). */
  function memoryAdapter(seed) {
    const tables = {}, kv = {};
    const T = (n) => tables[n] || (tables[n] = new Map());
    const a = {
      rows: (tbl) => Array.from(T(tbl).values()).map((r) => JSON.parse(JSON.stringify(r))),
      put: (tbl, rec) => { T(tbl).set(rec.id, JSON.parse(JSON.stringify(rec))); },
      nextId: (tbl) => { let m = 0; for (const id of T(tbl).keys()) if (id > m) m = id; return m + 1; },
      kvGet: (k) => (k in kv ? JSON.parse(JSON.stringify(kv[k])) : undefined),
      kvSet: (k, v) => { kv[k] = JSON.parse(JSON.stringify(v)); },
    };
    if (seed) {
      for (const [tbl, list] of Object.entries(seed.tables || {})) list.forEach((r) => a.put(tbl, r));
      for (const [k, v] of Object.entries(seed.kv || {})) a.kvSet(k, v);
    }
    return a;
  }

  /* ---- schema --------------------------------------------------------------- */
  const TEXT_MAX = 200, LONG_MAX = 2000;
  function colDef(type) {
    if (typeof type === 'string' && type.startsWith('pick:')) return { k: 'pick', opts: type.slice(5).split('|') };
    return { k: type };
  }
  function coerce(def, v, today) {
    switch (def.k) {
      case 'text': return v == null ? '' : String(v).slice(0, TEXT_MAX);
      case 'long': return v == null ? '' : String(v).slice(0, LONG_MAX);
      case 'num': { const n = Number(v); return Number.isFinite(n) ? n : 0; }
      case 'bool': return v === 'false' ? false : !!v;
      case 'date': return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : today();
      case 'pick': return def.opts.includes(v) ? v : def.opts[0];
      default: return v;
    }
  }

  /* ---- dates (all local time) ------------------------------------------------ */
  const p2 = (n) => String(n).padStart(2, '0');
  const ymd = (d) => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
  const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
  const addDays = (d, n) => { const x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; };
  const mondayOf = (d) => addDays(d, -((d.getDay() + 6) % 7));

  function createSDK(opts) {
    opts = opts || {};
    const adapter = opts.adapter || memoryAdapter();
    const manifest = opts.manifest || { tables: {} };
    const reactive = opts.reactive || ((o) => o);
    const now = opts.now || (() => Date.now());
    const timers = opts.timers || { setTimeout: (f, ms) => setTimeout(f, ms), clearTimeout: (h) => clearTimeout(h), setInterval: (f, ms) => setInterval(f, ms), clearInterval: (h) => clearInterval(h) };
    const host = opts.host || {};
    const locale = opts.locale || manifest.locale || (typeof navigator !== 'undefined' && navigator.language) || 'en';

    const today = () => ymd(new Date(now()));

    /* ---- app (#15, #16, #14) ---- */
    const app = {
      today,
      fmt(ts, how) {
        const d = ts instanceof Date ? ts : new Date(ts);
        if (how === 'time') return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(d);
        if (how === 'rel') {
          const t0 = new Date(now());
          const days = Math.round((parseYmd(ymd(t0)) - parseYmd(ymd(d))) / 864e5);
          const time = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(d);
          if (days === 0) return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(0, 'day').replace(/^./, (c) => c.toUpperCase()) + ', ' + time;
          if (days === 1) return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-1, 'day').replace(/^./, (c) => c.toUpperCase()) + ', ' + time;
          if (days > 1 && days < 7) return new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(d) + ', ' + time;
        }
        return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: d.getFullYear() === new Date(now()).getFullYear() ? undefined : 'numeric' }).format(d);
      },
      notify(when, text) {
        let at;
        if (when instanceof Date) at = when.getTime();
        else if (typeof when === 'number') at = when;
        else if (typeof when === 'string' && /^\d{1,2}:\d{2}$/.test(when)) {
          const [h, m] = when.split(':').map(Number); const d = new Date(now()); d.setHours(h, m, 0, 0);
          if (d.getTime() <= now()) d.setDate(d.getDate() + 1);
          at = d.getTime();
        } else throw new MoldeError('E_ARG', 'app.notify(when, text): when is a Date, a ms timestamp or "HH:MM"');
        const job = { at, text: String(text).slice(0, 140) };
        if (host.notify) host.notify(job); else (app._notifications = app._notifications || []).push(job);
        return job;
      },
    };

    /* ---- ui (#12, #13) ---- */
    const uiState = reactive({ toasts: [] });
    let toastId = 0;
    const ui = {
      get toasts() { return uiState.toasts; },
      toast(msg, undo) {
        const id = ++toastId;
        uiState.toasts.push({ id, msg: String(msg), undo: typeof undo === 'function' ? undo : null });
        const h = timers.setTimeout(() => ui._dismiss(id), undo ? 10000 : 3000);
        return () => { timers.clearTimeout(h); ui._dismiss(id); };
      },
      _dismiss(id) { const i = uiState.toasts.findIndex((t) => t.id === id); if (i >= 0) uiState.toasts.splice(i, 1); },
      timer(sec, cb) {
        const s = reactive({ left: sec, running: false });
        let h = null;
        const stop = () => { if (h != null) timers.clearInterval(h); h = null; s.running = false; };
        const tm = {
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
        return tm;
      },
    };

    /* ---- store ---- */
    const handles = {}, boxes = {};
    function table(name) {
      if (handles[name]) return handles[name];
      const schema = manifest.tables && manifest.tables[name];
      if (!schema) throw new MoldeError('E_TABLE', "store.t('" + name + "') not in tables [" + Object.keys(manifest.tables || {}).join(', ') + ']. Use one of those');
      const defs = {}; let dateCol = null;
      for (const [c, ty] of Object.entries(schema)) { defs[c] = colDef(ty); if (!dateCol && defs[c].k === 'date') dateCol = c; }
      const toRow = (rec) => Object.assign({ id: rec.id, at: rec.at }, rec.data);
      const all = adapter.rows(name);
      const st = reactive({ rows: all.filter((r) => !r.deleted_at).sort((a, b) => a.at - b.at || a.id - b.id).map(toRow) });
      const live = () => st.rows;
      const day = (r) => (dateCol && r[dateCol]) || ymd(new Date(r.at));
      const record = (id) => adapter.rows(name).find((r) => r.id === id);

      function pickCols(obj, fillDefaults) {
        const data = {};
        for (const [c, def] of Object.entries(defs)) {
          if (obj && c in obj) data[c] = coerce(def, obj[c], today);
          else if (fillDefaults) data[c] = coerce(def, undefined, today);
        }
        return data;
      }
      const eq = (r, o) => Object.entries(o).every(([k, v]) => r[k] === v);
      const keyOf = (k, withDay) => { const o = Object.assign({}, k); if (withDay && dateCol && !(dateCol in o)) o[dateCol] = today(); return o; };
      function window_(o) {
        const t0 = parseYmd(today());
        const since = o && o.since;
        const from = since === 'day' ? t0 : since === 'week' ? addDays(t0, -6) : since === 'month' ? addDays(t0, -29) : null;
        const f = from ? ymd(from) : null;
        return live().filter((r) => (!o || !o.where || eq(r, o.where)) && (!f || day(r) >= f));
      }
      const val = (r, col) => (col == null ? 1 : Number(r[col]) || 0);

      function softDelete(id) {
        const i = st.rows.findIndex((r) => r.id === id);
        if (i < 0) return false;
        const rec = record(id); rec.deleted_at = now(); adapter.put(name, rec);
        st.rows.splice(i, 1);
        return true;
      }

      const h = {
        name,
        toJSON: () => name,
        get rows() { return st.rows; },
        get cols() { return Object.keys(defs); },
        _schema: () => JSON.parse(JSON.stringify(schema)),
        /* #3 */ add(row) {
          const id = adapter.nextId(name);
          const at = row && Number.isFinite(row.at) ? row.at : now();
          const rec = { id, at, deleted_at: null, data: pickCols(row, true) };
          adapter.put(name, rec);
          st.rows.push(toRow(rec));
          return id;
        },
        /* #4 */ set(id, patch) {
          const rec = record(id);
          if (!rec || rec.deleted_at) throw new MoldeError('E_ROW', name + ' has no row ' + id);
          const data = pickCols(patch, false);
          rec.data = Object.assign(rec.data, data); adapter.put(name, rec);
          Object.assign(st.rows.find((r) => r.id === id), data);
          return true;
        },
        /* #5 */ remove(id) {
          if (!softDelete(id)) return false;
          ui.toast('Removed', () => {
            const rec = record(id); rec.deleted_at = null; adapter.put(name, rec);
            st.rows.push(toRow(rec)); st.rows.sort((a, b) => a.at - b.at || a.id - b.id);
          });
          return true;
        },
        /* #6 */ sum(col, o) { return window_(o).reduce((s, r) => s + val(r, col), 0); },
        /* #7 */ series(col, o) {
          o = o || {};
          const by = o.by || 'day', last = o.last || 7, op = o.op || (col == null ? 'count' : 'sum');
          const t0 = parseYmd(today());
          const keys = [];
          for (let i = last - 1; i >= 0; i--) {
            if (by === 'day') keys.push(ymd(addDays(t0, -i)));
            else if (by === 'week') keys.push(ymd(addDays(mondayOf(t0), -7 * i)));
            else { const d = new Date(t0.getFullYear(), t0.getMonth() - i, 1, 12); keys.push(d.getFullYear() + '-' + p2(d.getMonth() + 1)); }
          }
          const bucket = (r) => {
            const d = parseYmd(day(r));
            return by === 'day' ? ymd(d) : by === 'week' ? ymd(mondayOf(d)) : d.getFullYear() + '-' + p2(d.getMonth() + 1);
          };
          const acc = new Map(keys.map((k) => [k, { n: 0, s: 0 }]));
          for (const r of o.where ? live().filter((x) => eq(x, o.where)) : live()) {
            const a = acc.get(bucket(r));
            if (a) { a.n += 1; a.s += val(r, col); }
          }
          return keys.map((k) => { const a = acc.get(k); return { k, v: op === 'count' ? a.n : op === 'avg' ? (a.n ? a.s / a.n : 0) : a.s }; });
        },
        /* #8 */ group(col, valCol, o) {
          const m = new Map();
          for (const r of window_(o)) m.set(r[col], (m.get(r[col]) || 0) + val(r, valCol));
          return Array.from(m, ([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v);
        },
        /* #9 */ has(k) { const o = keyOf(k, true); return live().some((r) => eq(r, o)); },
        /* #10 */ toggle(k) {
          const o = keyOf(k, true);
          const hit = live().find((r) => eq(r, o));
          if (hit) { softDelete(hit.id); return false; }
          h.add(o); return true;
        },
        /* #11 */ streak(k) {
          if (!dateCol) throw new MoldeError('E_COL', "t.streak needs a date column; table '" + name + "' has none");
          const o = keyOf(k, false); delete o[dateCol];
          const days = new Set(live().filter((r) => eq(r, o)).map((r) => r[dateCol]));
          let d = parseYmd(today()), n = 0;
          if (!days.has(ymd(d))) d = addDays(d, -1);
          while (days.has(ymd(d))) { n++; d = addDays(d, -1); }
          return n;
        },
      };
      return (handles[name] = h);
    }

    const store = {
      /* #1 */ t: table,
      /* #2 */ kv(key, dflt) {
        if (boxes[key]) return boxes[key];
        const got = adapter.kvGet(key);
        const st = reactive({ v: got === undefined ? dflt : got });
        return (boxes[key] = { get v() { return st.v; }, set v(x) { st.v = x; adapter.kvSet(key, x); } });
      },
    };

    return { store, ui, app, MoldeError };
  }

  const CALLS = ['store.t', 'store.kv', 't.add', 't.set', 't.remove', 't.sum', 't.series', 't.group', 't.has', 't.toggle', 't.streak', 'ui.toast', 'ui.timer', 'app.notify', 'app.fmt', 'app.today'];
  return { createSDK, memoryAdapter, MoldeError, CALLS, colDef, ymd };
});
