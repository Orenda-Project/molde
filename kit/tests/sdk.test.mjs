// SDK unit tests: all 16 contract calls, run against BOTH adapters (in-memory test double and SQLite).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createSDK, memoryAdapter, CALLS, ymd } = require('../src/sdk.cjs');
const { sqliteAdapter, ensureSchema } = require('../adapters/sqlite.cjs');
const Database = require('better-sqlite3');

const manifest = { tables: {
  log: { what: 'text', mins: 'num', kind: 'pick:run|swim|lift', note: 'long', ok: 'bool' },
  check: { habit: 'text', day: 'date' },
} };
const DAY = 864e5;
const T0 = new Date(2026, 10, 12, 20, 30).getTime(); // Thu 12 Nov 2026, 20:30 local
const at = (daysAgo, h = 9) => { const d = new Date(T0); d.setDate(d.getDate() - daysAgo); d.setHours(h, 0, 0, 0); return d.getTime(); };

function fakeTimers() {
  let now = 0, id = 0; const jobs = new Map();
  return {
    setTimeout: (f, ms) => { jobs.set(++id, { f, at: now + ms, rep: 0 }); return id; },
    clearTimeout: (h) => jobs.delete(h),
    setInterval: (f, ms) => { jobs.set(++id, { f, at: now + ms, rep: ms }); return id; },
    clearInterval: (h) => jobs.delete(h),
    advance(ms) { const end = now + ms; for (;;) { const due = [...jobs].filter(([, j]) => j.at <= end).sort((a, b) => a[1].at - b[1].at)[0]; if (!due) break; const [k, j] = due; now = j.at; if (j.rep) j.at += j.rep; else jobs.delete(k); j.f(); } now = end; },
  };
}

const adapters = {
  memory: () => ({ make: () => memoryAdapter(), reopen: (a) => a }),
  sqlite: () => { const db = new Database(':memory:'); ensureSchema(db); return { make: () => sqliteAdapter(db, 'app1'), reopen: () => sqliteAdapter(db, 'app1'), db }; },
};

for (const [aname, mk] of Object.entries(adapters)) {
  const sdk = (extra = {}) => { const ctx = mk(); const adapter = extra.adapter || ctx.make(); const timers = fakeTimers(); const s = createSDK({ adapter, manifest, now: () => T0 + (extra.dt || 0), timers, locale: 'en-US', ...extra }); return { ...s, adapter, timers, ctx }; };

  test(`[${aname}] 1 store.t: handle, and E_TABLE for unknown names`, () => {
    const { store } = sdk();
    assert.equal(store.t('log'), store.t('log'));
    assert.throws(() => store.t('logs'), (e) => e.code === 'E_TABLE' && /not in tables \[log, check\]/.test(e.message));
    assert.deepEqual(store.t('log').rows, []);
  });

  test(`[${aname}] 2 store.kv: default, set, persists across a new SDK`, () => {
    const a = sdk(); const box = a.store.kv('goal', 150);
    assert.equal(box.v, 150); box.v = 200; assert.equal(box.v, 200);
    assert.equal(a.store.kv('goal', 1), box);
    const b = createSDK({ adapter: a.ctx.reopen(a.adapter), manifest });
    assert.equal(b.store.kv('goal', 150).v, 200);
  });

  test(`[${aname}] 3 t.add: coerces, clips, drops unknown columns, returns ids, persists`, () => {
    const a = sdk(); const t = a.store.t('log');
    const id = t.add({ what: 'x'.repeat(500), mins: '30', kind: 'nope', note: 'n'.repeat(3000), ok: 1, zzz: 1 });
    assert.equal(id, 1); assert.equal(t.add({ what: 'b' }), 2);
    const r = t.rows[0];
    assert.equal(r.what.length, 200); assert.equal(r.mins, 30); assert.equal(r.kind, 'run'); assert.equal(r.note.length, 2000); assert.equal(r.ok, true); assert.ok(!('zzz' in r));
    assert.equal(r.at, T0); assert.equal(t.rows[1].mins, 0);
    assert.equal(createSDK({ adapter: a.ctx.reopen(a.adapter), manifest }).store.t('log').rows.length, 2);
    assert.equal(a.store.t('check').add({ habit: 'h' }) && a.store.t('check').rows[0].day, '2026-11-12'); // date defaults to today
  });

  test(`[${aname}] 4 t.set: patches and coerces, E_ROW for a missing row`, () => {
    const a = sdk(); const t = a.store.t('log'); const id = t.add({ what: 'run', mins: 10 });
    t.set(id, { mins: '45', what: 'long run', zzz: 9 });
    assert.equal(t.rows[0].mins, 45); assert.equal(t.rows[0].what, 'long run');
    assert.equal(createSDK({ adapter: a.ctx.reopen(a.adapter), manifest }).store.t('log').rows[0].mins, 45);
    assert.throws(() => t.set(99, { mins: 1 }), (e) => e.code === 'E_ROW');
  });

  test(`[${aname}] 5 t.remove: soft delete + 10 s Undo toast; nothing is hard-deleted`, () => {
    const a = sdk(); const t = a.store.t('log'); const id = t.add({ what: 'run', mins: 10 });
    assert.equal(t.remove(id), true); assert.equal(t.rows.length, 0);
    const rec = a.adapter.rows('log').find((r) => r.id === id);
    assert.ok(rec && rec.deleted_at, 'tombstone stays in storage');
    assert.equal(a.ui.toasts.length, 1); assert.ok(a.ui.toasts[0].undo);
    a.timers.advance(9000); assert.equal(a.ui.toasts.length, 1);
    a.ui.toasts[0].undo(); assert.equal(t.rows.length, 1); assert.equal(a.adapter.rows('log')[0].deleted_at, null);
    t.remove(id); a.timers.advance(10001); assert.equal(a.ui.toasts.length, 0, 'toast expires after 10 s');
    assert.equal(t.remove(99), false);
  });

  const filled = () => {
    const a = sdk(); const t = a.store.t('log');
    [[0, 30, 'run'], [0, 15, 'swim'], [1, 20, 'run'], [3, 40, 'lift'], [6, 10, 'run'], [7, 99, 'run'], [20, 5, 'swim']].forEach(([d, m, k]) => t.add({ what: k + d, mins: m, kind: k, at: at(d) }));
    return { a, t };
  };

  test(`[${aname}] 6 t.sum: count, sum, since day/week/month, where`, () => {
    const { t } = filled();
    assert.equal(t.sum(null), 7); assert.equal(t.sum('mins'), 219);
    assert.equal(t.sum('mins', { since: 'day' }), 45);
    assert.equal(t.sum('mins', { since: 'week' }), 30 + 15 + 20 + 40 + 10);
    assert.equal(t.sum('mins', { since: 'month' }), 219);
    assert.equal(t.sum('mins', { where: { kind: 'run' } }), 30 + 20 + 10 + 99);
    assert.equal(t.sum(null, { since: 'week', where: { kind: 'run' } }), 3);
  });

  test(`[${aname}] 7 t.series: zero-filled buckets by day/week/month, ops, where`, () => {
    const { t } = filled();
    const d = t.series('mins', { by: 'day', last: 7 });
    assert.equal(d.length, 7); assert.equal(d[6].k, '2026-11-12'); assert.equal(d[0].k, '2026-11-06');
    assert.deepEqual(d.map((x) => x.v), [10, 0, 0, 40, 0, 20, 45]);
    assert.deepEqual(t.series(null, { last: 3 }).map((x) => x.v), [0, 1, 2]);
    assert.equal(t.series('mins', { last: 7, op: 'avg' })[6].v, 22.5);
    assert.deepEqual(t.series('mins', { last: 7, where: { kind: 'run' } }).map((x) => x.v), [10, 0, 0, 0, 0, 20, 30]);
    const w = t.series('mins', { by: 'week', last: 2 }); assert.equal(w[1].k, '2026-11-09'); assert.equal(w[1].v, 45 + 20 + 40); assert.equal(w[0].v, 10 + 99);
    const m = t.series('mins', { by: 'month', last: 2 }); assert.deepEqual(m.map((x) => x.k), ['2026-10', '2026-11']); assert.equal(m[1].v, 219 - 5 + 0); // 20 days ago = 23 Oct
    assert.equal(m[0].v, 5);
  });

  test(`[${aname}] 8 t.group: totals per category, sorted, filtered`, () => {
    const { t } = filled();
    assert.deepEqual(t.group('kind', 'mins'), [{ k: 'run', v: 159 }, { k: 'lift', v: 40 }, { k: 'swim', v: 20 }]);
    assert.deepEqual(t.group('kind'), [{ k: 'run', v: 4 }, { k: 'swim', v: 2 }, { k: 'lift', v: 1 }]);
    assert.deepEqual(t.group('kind', 'mins', { since: 'day' }), [{ k: 'run', v: 30 }, { k: 'swim', v: 15 }]);
  });

  test(`[${aname}] 9 t.has: matches key rows; date column defaults to today`, () => {
    const a = sdk(); const c = a.store.t('check');
    assert.equal(c.has({ habit: 'read' }), false);
    c.add({ habit: 'read', day: '2026-11-11' }); assert.equal(c.has({ habit: 'read' }), false);
    assert.equal(c.has({ habit: 'read', day: '2026-11-11' }), true);
    c.add({ habit: 'read' }); assert.equal(c.has({ habit: 'read' }), true); assert.equal(c.has({ habit: 'walk' }), false);
  });

  test(`[${aname}] 10 t.toggle: adds, then soft-removes, then adds again`, () => {
    const a = sdk(); const c = a.store.t('check');
    assert.equal(c.toggle({ habit: 'read' }), true); assert.equal(c.rows.length, 1);
    assert.equal(c.toggle({ habit: 'read' }), false); assert.equal(c.rows.length, 0);
    assert.equal(a.adapter.rows('check').length, 1, 'tombstone, not hard delete');
    assert.equal(c.toggle({ habit: 'read' }), true); assert.equal(c.has({ habit: 'read' }), true);
    assert.equal(a.ui.toasts.length, 0, 'toggle never shows the remove toast');
  });

  test(`[${aname}] 11 t.streak: consecutive days, today may be pending, gaps break, needs a date column`, () => {
    const a = sdk(); const c = a.store.t('check');
    const day = (n) => { const d = new Date(T0); d.setDate(d.getDate() - n); return ymd(d); };
    assert.equal(c.streak({ habit: 'read' }), 0);
    [0, 1, 2, 4].forEach((n) => c.add({ habit: 'read', day: day(n) })); assert.equal(c.streak({ habit: 'read' }), 3);
    [1, 2, 3].forEach((n) => c.add({ habit: 'walk', day: day(n) })); assert.equal(c.streak({ habit: 'walk' }), 3, 'today not done yet keeps yesterday streak');
    c.add({ habit: 'old', day: day(2) }); assert.equal(c.streak({ habit: 'old' }), 0);
    assert.throws(() => a.store.t('log').streak({ what: 'x' }), (e) => e.code === 'E_COL');
  });

  test(`[${aname}] 12 ui.toast: shows, auto-dismisses after 3 s, returns a dismiss function`, () => {
    const a = sdk(); const off = a.ui.toast('Saved');
    assert.deepEqual(a.ui.toasts.map((t) => t.msg), ['Saved']); a.timers.advance(2999); assert.equal(a.ui.toasts.length, 1); a.timers.advance(2); assert.equal(a.ui.toasts.length, 0);
    const off2 = a.ui.toast('Again'); off2(); assert.equal(a.ui.toasts.length, 0); off();
  });

  test(`[${aname}] 13 ui.timer: counts down, fires cb once, stop and restart`, () => {
    const a = sdk(); let fired = 0; const tm = a.ui.timer(3, () => fired++);
    assert.deepEqual([tm.left, tm.running], [3, false]);
    tm.start(); a.timers.advance(1000); assert.equal(tm.left, 2); tm.stop(); a.timers.advance(5000); assert.equal(tm.left, 2); assert.equal(tm.running, false);
    tm.start(); a.timers.advance(2000); assert.equal(tm.left, 0); assert.equal(fired, 1); assert.equal(tm.running, false);
    tm.start(); assert.equal(tm.left, 3); assert.equal(tm.running, true); tm.stop();
  });

  test(`[${aname}] 14 app.notify: Date, ms and HH:MM; goes to the host bridge; rejects other input`, () => {
    const got = []; const a = sdk({ host: { notify: (j) => got.push(j) } });
    a.app.notify(new Date(T0 + 1000), 'a'); a.app.notify(T0 + 2000, 'b'); const j = a.app.notify('07:30', 'c'.repeat(300));
    assert.deepEqual(got.map((x) => x.at).slice(0, 2), [T0 + 1000, T0 + 2000]);
    const d = new Date(j.at); assert.deepEqual([d.getHours(), d.getMinutes(), d.getDate()], [7, 30, 13], 'next occurrence');
    assert.equal(j.text.length, 140);
    assert.throws(() => a.app.notify('tomorrow', 'x'), (e) => e.code === 'E_ARG');
    const b = sdk(); b.app.notify(T0 + 5, 'x'); assert.equal(b.app._notifications.length, 1);
  });

  test(`[${aname}] 15 app.fmt: date, time, rel, and Urdu digits`, () => {
    const a = sdk(); const ts = at(0, 7);
    assert.equal(a.app.fmt(ts, 'date'), 'Nov 12'); assert.match(a.app.fmt(ts, 'time'), /^7:00\sAM$/);
    assert.match(a.app.fmt(ts, 'rel'), /^Today, 7:00\sAM$/); assert.match(a.app.fmt(at(1, 18), 'rel'), /^Yesterday, 6:00\sPM$/);
    assert.match(a.app.fmt(at(3, 18), 'rel'), /^Monday, 6:00\sPM$/); assert.equal(a.app.fmt(at(10), 'rel'), 'Nov 2');
    const ur = sdk({ locale: 'ur-PK-u-nu-arabext' }); assert.match(ur.app.fmt(ts, 'time'), /[۰-۹]/);
  });

  test(`[${aname}] 16 app.today: local YYYY-MM-DD from the injected clock`, () => {
    const a = sdk(); assert.equal(a.app.today(), '2026-11-12');
    assert.equal(sdk({ dt: DAY }).app.today(), '2026-11-13');
  });

  test(`[${aname}] reactivity hook: rows are read through the injected reactive()`, () => {
    let wrapped = 0; const a = sdk({ reactive: (o) => { wrapped++; return o; } }); a.store.t('log'); a.store.kv('k', 1);
    assert.ok(wrapped >= 3, 'ui state, table rows and kv box all go through reactive()');
  });
}

test('the public surface is exactly the 16 contract calls', () => {
  assert.equal(CALLS.length, 16);
  const { store, ui, app } = createSDK({ manifest });
  const t = store.t('log');
  const pub = (o, pre) => Object.keys(o).filter((k) => typeof o[k] === 'function' && !k.startsWith('_') && k !== 'toJSON').map((k) => pre + '.' + k);
  const got = [...pub(store, 'store'), ...pub(t, 't'), ...pub(ui, 'ui'), ...pub(app, 'app')].sort();
  assert.deepEqual(got, CALLS.map((c) => c).sort());
});

test('sqlite adapter issues no DDL for app tables and keeps apps apart', () => {
  const db = new Database(':memory:'); ensureSchema(db);
  const before = db.prepare("select name from sqlite_master order by name").all();
  const A = createSDK({ adapter: sqliteAdapter(db, 'a'), manifest }), B = createSDK({ adapter: sqliteAdapter(db, 'b'), manifest });
  A.store.t('log').add({ what: 'mine' });
  assert.equal(B.store.t('log').rows.length, 0);
  assert.deepEqual(db.prepare("select name from sqlite_master order by name").all(), before, 'schema unchanged by app activity');
});
