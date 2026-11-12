// SDK unit tests: all 16 contract calls, run against BOTH adapters (in-memory test double and SQLite).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createSDK, memoryAdapter, CALLS, ymd } = require(process.env.MOLDE_SDK || '../src/sdk.cjs');
const { sqliteAdapter, ensureSchema } = require('../adapters/sqlite.cjs');
let Database = null; try { Database = require('better-sqlite3'); new Database(':memory:').close(); } catch (e) { console.log('# better-sqlite3 not available (' + e.message.split('\n')[0] + '): SQLite tests are skipped. Run `npm rebuild better-sqlite3`, see kit/README.md'); Database = null; }

const manifest = { tables: {
  log: { what: 'text', mins: 'num', kind: 'pick:run|swim|lift', note: 'long', ok: 'bool' },
  check: { habit: 'text', day: 'date' },
} };
const typed = (fn, code) => assert.throws(fn, (e) => e instanceof MoldeError && e.code === code && !(e instanceof TypeError), `expected MoldeError ${code}`);
const { MoldeError } = require(process.env.MOLDE_SDK || '../src/sdk.cjs');
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
  ...(Database ? { sqlite: () => { const db = new Database(':memory:'); ensureSchema(db); return { make: () => sqliteAdapter(db, 'app1'), reopen: () => sqliteAdapter(db, 'app1'), db }; } } : {}),
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
    const id = t.add({ what: 'x'.repeat(1000), mins: '30', kind: 'swim', note: 'n'.repeat(20000), ok: 1 });
    typed(() => t.add({ what: 'x'.repeat(1001) }), 'E_ARG'); typed(() => t.add({ note: 'n'.repeat(20001) }), 'E_ARG'); typed(() => t.set(id, { what: 'y'.repeat(1001) }), 'E_ARG');
    assert.throws(() => t.add({ what: 'x'.repeat(1001) }), /1001 characters.*limit.*1000/, 'the message says what to do');
    assert.equal(t.rows.length, 1, 'a rejected write leaves nothing behind');
    typed(() => t.add({ zzz: 1 }), 'E_COL'); typed(() => t.add({ what: Symbol('s') }), 'E_ARG'); typed(() => t.add({ x: Symbol() }), 'E_COL'); typed(() => t.add({ what: {} }), 'E_ARG'); typed(() => t.add({ mins: () => 1 }), 'E_ARG'); typed(() => t.add({ mins: 10n }), 'E_ARG');
    assert.equal(id, 1); assert.equal(t.add({ what: 'b' }), 2);
    const r = t.rows[0];
    assert.equal(r.what.length, 1000, 'never cut silently'); assert.equal(r.mins, 30); assert.equal(r.kind, 'swim'); assert.equal(r.note.length, 20000); assert.equal(r.ok, true); assert.ok(!('zzz' in r));
    assert.equal(r.at, T0); assert.equal(t.rows[1].mins, 0);
    assert.equal(createSDK({ adapter: a.ctx.reopen(a.adapter), manifest }).store.t('log').rows.length, 2);
    assert.equal(a.store.t('check').add({ habit: 'h' }) && a.store.t('check').rows[0].day, '2026-11-12'); // date defaults to today
  });

  test(`[${aname}] 4 t.set: patches and coerces, E_ROW for a missing row`, () => {
    const a = sdk(); const t = a.store.t('log'); const id = t.add({ what: 'run', mins: 10 });
    t.set(id, { mins: '45', what: 'long run' }); typed(() => t.set(id, { zzz: 9 }), 'E_COL');
    assert.equal(t.rows[0].mins, 45); assert.equal(t.rows[0].what, 'long run');
    assert.equal(createSDK({ adapter: a.ctx.reopen(a.adapter), manifest }).store.t('log').rows[0].mins, 45);
    assert.throws(() => t.set(99, { mins: 1 }), (e) => e.code === 'E_ROW');
  });

  test(`[${aname}] 5 t.remove: soft delete + 10 s Undo toast; nothing is hard-deleted`, () => {
    const a = sdk(); const t = a.store.t('log'); const id = t.add({ what: 'run', mins: 10 });
    assert.equal(t.remove(id), true); assert.equal(t.rows.length, 0);
    const rec = a.adapter.rows('log').find((r) => r.id === id);
    assert.ok(rec && rec.deleted_at, 'tombstone stays in storage');
    assert.equal(a.internal.toasts().length, 1); assert.ok(a.internal.toasts()[0].undo);
    a.timers.advance(9000); assert.equal(a.internal.toasts().length, 1);
    a.internal.toasts()[0].undo(); assert.equal(t.rows.length, 1); assert.equal(a.adapter.rows('log')[0].deleted_at, null);
    t.remove(id); a.timers.advance(10001); assert.equal(a.internal.toasts().length, 0, 'toast expires after 10 s');
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
    assert.equal(t.sum('mins', { since: 'week' }), 30 + 15 + 20 + 40, 'calendar week from Monday 9 Nov');
    assert.equal(t.sum('mins', { since: 'month' }), 30 + 15 + 20 + 40 + 10 + 99, 'calendar month from 1 Nov');
    assert.equal(t.sum('mins', { since: 'last7' }), 30 + 15 + 20 + 40 + 10); assert.equal(t.sum('mins', { since: 'last30' }), 219);
    assert.equal(t.sum('mins', { where: { kind: 'run' } }), 30 + 20 + 10 + 99);
    assert.equal(t.sum(null, { since: 'week', where: { kind: 'run' } }), 2);
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
    assert.equal(a.internal.toasts().length, 0, 'toggle never shows the remove toast');
  });

  test(`[${aname}] 11 t.streak: consecutive days, today may be pending, gaps break, needs a date column`, () => {
    const a = sdk(); const c = a.store.t('check');
    const day = (n) => { const d = new Date(T0); d.setDate(d.getDate() - n); return ymd(d); };
    assert.equal(c.streak({ habit: 'read' }), 0);
    [0, 1, 2, 4].forEach((n) => c.add({ habit: 'read', day: day(n) })); assert.equal(c.streak({ habit: 'read' }), 3);
    [1, 2, 3].forEach((n) => c.add({ habit: 'walk', day: day(n) })); assert.equal(c.streak({ habit: 'walk' }), 3, 'today not done yet keeps yesterday streak');
    for (let n = 0; n < 9; n++) c.add({ habit: 'long', day: day(n) }); assert.equal(c.streak({ habit: 'long' }), 9);
    for (let n = 1; n < 6; n++) c.add({ habit: 'five', day: day(n) }); assert.equal(c.streak({ habit: 'five' }), 5);
    c.add({ habit: 'old', day: day(2) }); assert.equal(c.streak({ habit: 'old' }), 0);
    assert.throws(() => a.store.t('log').streak({ what: 'x' }), (e) => e.code === 'E_COL');
  });

  test(`[${aname}] 12 ui.toast: shows, auto-dismisses after 3 s, returns a dismiss function`, () => {
    const a = sdk(); const off = a.ui.toast('Saved');
    assert.deepEqual(a.internal.toasts().map((t) => t.msg), ['Saved']); a.timers.advance(2999); assert.equal(a.internal.toasts().length, 1); a.timers.advance(2); assert.equal(a.internal.toasts().length, 0);
    const off2 = a.ui.toast('Again'); off2(); assert.equal(a.internal.toasts().length, 0); off();
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
    a.app.notify(new Date(T0 + 1000), 'a'); a.app.notify(T0 + 2000, 'b'); const j = a.app.notify('07:30', 'c'.repeat(200)); typed(() => a.app.notify('07:30', 'c'.repeat(201)), 'E_ARG');
    assert.deepEqual(got.map((x) => x.at).slice(0, 2), [T0 + 1000, T0 + 2000]);
    const d = new Date(j.at); assert.deepEqual([d.getHours(), d.getMinutes(), d.getDate()], [7, 30, 13], 'next occurrence');
    assert.equal(j.text.length, 200);
    assert.throws(() => a.app.notify('tomorrow', 'x'), (e) => e.code === 'E_ARG');
    const b = sdk(); b.app.notify(T0 + 5, 'x'); assert.equal(b.internal.notifications.length, 1);
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

test('the public surface is exactly the 16 contract calls (Object.keys), t.rows is a frozen copy', () => {
  assert.equal(CALLS.length, 16);
  const { store, ui, app } = createSDK({ manifest });
  const t = store.t('log');
  assert.deepEqual(Object.keys(store).sort(), ['kv', 't']);
  assert.deepEqual(Object.keys(ui).sort(), ['timer', 'toast']);
  assert.deepEqual(Object.keys(app).sort(), ['fmt', 'notify', 'today']);
  assert.deepEqual(Object.keys(t).sort(), ['add', 'group', 'has', 'remove', 'series', 'set', 'streak', 'sum', 'toggle']);
  const all = [...Object.keys(store).map((k) => 'store.' + k), ...Object.keys(t).map((k) => 't.' + k), ...Object.keys(ui).map((k) => 'ui.' + k), ...Object.keys(app).map((k) => 'app.' + k)];
  assert.deepEqual(all.sort(), [...CALLS].sort());
  t.add({ what: 'x' });
  assert.throws(() => t.rows.push({}), TypeError); assert.throws(() => { t.rows[0].what = 'y'; }, TypeError);
  assert.equal(t.rows[0].what, 'x'); assert.ok(Object.isFrozen(t.rows));
});

test('sqlite adapter issues no DDL for app tables and keeps apps apart', { skip: !Database }, () => {
  const db = new Database(':memory:'); ensureSchema(db);
  const before = db.prepare("select name from sqlite_master order by name").all();
  const A = createSDK({ adapter: sqliteAdapter(db, 'a'), manifest }), B = createSDK({ adapter: sqliteAdapter(db, 'b'), manifest });
  A.store.t('log').add({ what: 'mine' });
  assert.equal(B.store.t('log').rows.length, 0);
  assert.deepEqual(db.prepare("select name from sqlite_master order by name").all(), before, 'schema unchanged by app activity');
});


/* ---- round 2: data and argument hardening ---- */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

for (const [aname, mk] of Object.entries(adapters)) {
  const sdk2 = (m = manifest, adapter) => { const ctx = mk(); const ad = adapter || ctx.make(); return { ctx, adapter: ad, s: createSDK({ adapter: ad, manifest: m, now: () => T0, locale: 'en-US' }) }; };

  test(`[${aname}] a column added later: old rows read with type defaults (no NaN, no undefined)`, () => {
    const ctx = mk(); const adapter = ctx.make();
    const old = { tables: { log: { what: 'text' } } };
    const a = createSDK({ adapter, manifest: old, now: () => T0 }); a.store.t('log').add({ what: 'before', at: at(2) });
    const grown = { tables: { log: { what: 'text', mins: 'num', kind: 'pick:run|swim', ok: 'bool', note: 'long', when: 'date', extra: 'text' } } };
    const b = createSDK({ adapter: ctx.reopen(adapter), manifest: grown, now: () => T0 });
    const r = b.store.t('log').rows[0];
    assert.deepEqual([r.what, r.mins, r.kind, r.ok, r.note, r.extra], ['before', 0, 'run', false, '', '']);
    assert.equal(r.when, ymd(new Date(at(2))), 'missing date column falls back to the row\'s own day');
    assert.ok(Object.values(r).every((v) => v !== undefined && !(typeof v === 'number' && Number.isNaN(v))));
    assert.equal(b.store.t('log').sum('mins'), 0); assert.equal(b.store.t('log').series('mins', { last: 3 }).length, 3);
    const g = b.store.t('log').group('kind', 'mins'); assert.deepEqual(g, [{ k: 'run', v: 0 }]);
  });

  test(`[${aname}] reserved names: store.t / store.kv('constructor' | '__proto__' | 'toString') raise E_TABLE, prototype untouched`, () => {
    const { s } = sdk2();
    for (const k of ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf', 'prototype', '']) {
      typed(() => s.store.t(k), 'E_TABLE'); typed(() => s.store.kv(k, 1), 'E_TABLE');
    }
    typed(() => s.store.t(undefined), 'E_TABLE'); typed(() => s.store.kv(null, 1), 'E_TABLE');
    assert.equal(Object.keys(Object.prototype).length, 0); assert.equal({}.polluted, undefined);
    const box = s.store.kv('good_key', 3); box.v = 4; assert.equal(box.v, 4);
    const evil = createSDK({ manifest: { tables: { ['__proto__']: { a: 'text' }, ok: { constructor: 'text', toString: 'num' } } } });
    assert.ok(evil.store.t('ok')); typed(() => evil.store.t('ok').sum('toString2'), 'E_COL'); typed(() => evil.store.t('ok').has({ hasOwnProperty: 1 }), 'E_COL');
  });

  test(`[${aname}] numbers: finite magnitudes are clamped, NaN / Infinity / text / null / booleans are E_ARG; series(last) is capped at 366`, () => {
    const { s } = sdk2(); const t = s.store.t('log');
    t.add({ mins: 1e308 }); t.add({ mins: -1e308 }); t.add({ mins: -5 }); t.add({ mins: '12.5' }); t.add({ mins: ' 7 ' });
    assert.deepEqual(t.rows.map((r) => r.mins), [1e12, -1e12, -5, 12.5, 7]);
    for (const bad of [NaN, Infinity, -Infinity, 'abc', '', '  ', '1e', null, true, false, {}, [], [1], () => 1, 10n]) typed(() => t.add({ mins: bad }), 'E_ARG');
    assert.equal(t.rows.length, 5, 'a rejected write adds nothing');
    assert.equal(t.series('mins', { last: 100000 }).length, 366); assert.equal(t.series('mins', { last: 2.9 }).length, 2);
    for (const bad of [0, -5, '7', null, Infinity * 0]) typed(() => t.series('mins', { last: bad }), 'E_ARG');
    typed(() => t.series('mins', { last: NaN }), 'E_ARG'); typed(() => t.series('mins', { last: 'x' }), 'E_ARG'); assert.ok(Number.isFinite(t.sum('mins')));
  });

  test(`[${aname}] wrong types never turn into defaults: pick, bool, text, date, null`, () => {
    const { s } = sdk2(); const t = s.store.t('log'), c = s.store.t('check');
    typed(() => t.add({ kind: 'nope' }), 'E_ARG'); typed(() => t.add({ kind: 3 }), 'E_ARG'); typed(() => t.add({ kind: '' }), 'E_ARG'); assert.throws(() => t.add({ kind: 'zzz' }), /not one of run, swim, lift/);
    typed(() => t.add({ ok: 'yes' }), 'E_ARG'); typed(() => t.add({ ok: 2 }), 'E_ARG'); typed(() => t.add({ ok: null }), 'E_ARG');
    typed(() => t.add({ what: true }), 'E_ARG'); typed(() => t.add({ what: {} }), 'E_ARG'); typed(() => t.add({ what: null }), 'E_ARG'); typed(() => t.add({ note: false }), 'E_ARG'); typed(() => c.add({ day: null }), 'E_ARG');
    assert.equal(t.add({ what: 42, kind: 'lift', ok: 'false' }) > 0, true); assert.deepEqual([t.rows[0].what, t.rows[0].kind, t.rows[0].ok], ['42', 'lift', false]);
    const id = t.rows[0].id; typed(() => t.set(id, { mins: 'abc' }), 'E_ARG'); typed(() => t.set(id, { kind: 'x' }), 'E_ARG'); assert.equal(t.rows[0].kind, 'lift', 'a rejected set changes nothing');
    assert.equal(t.rows.length, 1);
  });

  test(`[${aname}] grouped removal: parent and children go in ONE step, one toast, one Undo restores all, streaks identical`, () => {
    const { s, adapter } = sdk2(); const h = s.store.t('log'), c = s.store.t('check'); const day = (n) => { const d = new Date(T0); d.setDate(d.getDate() - n); return ymd(d); };
    const a = h.add({ what: 'read' }), b = h.add({ what: 'walk' });
    for (let n = 0; n < 45; n++) c.add({ habit: String(a), day: day(n) }); for (let n = 0; n < 5; n++) c.add({ habit: String(b), day: day(n) });
    const streak = c.streak({ habit: String(a) }); assert.equal(streak, 45);
    const kids = c.rows.filter((r) => r.habit === String(a)).map((r) => r.id);
    assert.equal(s.internal.removeGroup([[c, kids], [h, [a]]]), 46);
    assert.equal(h.rows.length, 1); assert.equal(c.rows.length, 5); assert.equal(s.internal.toasts().length, 1, 'one toast for the whole step');
    s.ui.toast('later 1'); s.ui.toast('later 2'); s.ui.toast('later 3'); s.ui.toast('later 4');
    assert.ok(s.internal.toasts().some((x) => x.msg === 'Removed' && x.undo), 'a pending Undo is never evicted by plain toasts');
    s.internal.toasts().find((x) => x.undo).undo();
    assert.equal(h.rows.length, 2); assert.equal(c.rows.length, 50); assert.equal(c.streak({ habit: String(a) }), streak, 'streak identical after Undo');
    assert.deepEqual(h.rows.map((r) => r.what), ['read', 'walk']); assert.equal(adapter.rows('check').filter((r) => !r.deleted_at).length, 50);
    assert.equal(s.internal.removeGroup([[c, []], [h, [999]]]), 0, 'nothing to remove: no toast');
  });

  test(`[${aname}] toasts: plain ones are capped at 3 and newest wins, Undo toasts survive a flood`, () => {
    const tm = fakeTimers(); const a = createSDK({ manifest, timers: tm });
    a.ui.toast('u1', () => {}); a.ui.toast('u2', () => {}); for (let i = 0; i < 10; i++) a.ui.toast('p' + i);
    const msgs = a.internal.toasts().map((x) => x.msg); assert.ok(msgs.includes('u1') && msgs.includes('u2'), msgs.join()); assert.ok(msgs.includes('p9'), 'newest plain toast is visible'); assert.ok(msgs.length <= 3, msgs.join());
    for (let i = 0; i < 4; i++) a.ui.toast('v' + i, () => {}); assert.ok(a.internal.toasts().length <= 5, 'Undo toasts are bounded too'); void tm;
  });
  test(`[${aname}] bad arguments raise a typed MoldeError, never a raw TypeError, never silently act`, () => {
    const { s } = sdk2(); const t = s.store.t('log'), c = s.store.t('check');
    c.add({ habit: 'read' });
    typed(() => t.add('abc'), 'E_ARG'); typed(() => t.add(null), 'E_ARG'); typed(() => t.add([1]), 'E_ARG'); typed(() => t.add(), 'E_ARG');
    typed(() => c.add({ habit: 'x', day: '2026-02-31' }), 'E_ARG'); typed(() => c.add({ day: 'tomorrow' }), 'E_ARG'); typed(() => c.add({ day: '2026-13-01' }), 'E_ARG');
    typed(() => t.set('1', {}), 'E_ARG'); typed(() => t.set(1, 'x'), 'E_ARG'); typed(() => t.remove('a'), 'E_ARG'); typed(() => t.remove(undefined), 'E_ARG');
    typed(() => s.app.fmt(undefined), 'E_ARG'); typed(() => s.app.fmt(null, 'date'), 'E_ARG'); typed(() => s.app.fmt('nope'), 'E_ARG'); typed(() => s.app.fmt(NaN), 'E_ARG'); typed(() => s.app.fmt('2026-02-31'), 'E_ARG'); typed(() => s.app.fmt(1, 'long'), 'E_ARG');
    for (const bad of [NaN, -5, 0, Infinity, '3', undefined, null, 1e9]) typed(() => s.ui.timer(bad), 'E_ARG');
    typed(() => s.ui.timer(5, 'cb'), 'E_ARG');
    for (const w of ['25:99', '24:00', '12:60', 'noon', undefined, NaN, new Date('x')]) typed(() => s.app.notify(w, 'x'), 'E_ARG');
    typed(() => s.app.notify('10:00', ''), 'E_ARG'); typed(() => s.app.notify('10:00'), 'E_ARG');
    typed(() => s.ui.toast(undefined), 'E_ARG'); typed(() => s.ui.toast(''), 'E_ARG'); typed(() => s.ui.toast({}), 'E_ARG'); typed(() => s.ui.toast('x', 'undo'), 'E_ARG');
    assert.equal(c.rows.length, 1);
    typed(() => c.toggle(), 'E_ARG'); typed(() => c.toggle({}), 'E_ARG'); typed(() => c.toggle('read'), 'E_ARG'); typed(() => c.toggle({ nope: 1 }), 'E_COL');
    assert.equal(c.rows.length, 1, 'toggle() without a key must not remove anything'); assert.equal(c.has({ habit: 'read' }), true);
    typed(() => c.has(), 'E_ARG'); typed(() => c.streak(), 'E_ARG'); typed(() => c.streak({ nope: 1 }), 'E_COL');
    typed(() => t.sum('nope'), 'E_COL'); typed(() => t.sum('mins', { where: { nope: 1 } }), 'E_COL'); typed(() => t.sum('mins', { since: 'year' }), 'E_ARG'); typed(() => t.sum('mins', 5), 'E_ARG');
    typed(() => t.series('nope'), 'E_COL'); typed(() => t.series('mins', { by: 'hour' }), 'E_ARG'); typed(() => t.series('mins', { op: 'max' }), 'E_ARG');
    typed(() => t.group('nope'), 'E_COL'); typed(() => t.group(), 'E_COL'); typed(() => t.group('kind', 'nope'), 'E_COL');
    assert.equal(s.ui.toast('ok') instanceof Function, true);
  });
}

test('midnight: today() follows the clock, and the reactive clock is bumped by refresh() and by every action', () => {
  let nowMs = new Date(2026, 10, 12, 23, 59, 50).getTime(); const sets = [];
  const reactive = (o) => new Proxy(o, { set(t, k, v) { sets.push(k + ':' + v); t[k] = v; return true; } });
  const s = createSDK({ manifest, now: () => nowMs, reactive });
  assert.equal(s.app.today(), '2026-11-12');
  nowMs += 20000; assert.equal(s.app.today(), '2026-11-13', 'answers from the live clock');
  s.internal.refresh(); assert.ok(sets.includes('d:2026-11-13'), 'reactive clock changed so effects re-run');
  nowMs += 864e5; sets.length = 0; s.store.t('check').add({ habit: 'x' }); assert.ok(sets.includes('d:2026-11-14'), 'an action refreshes the clock');
  assert.equal(s.store.t('check').rows[0].day, '2026-11-14');
  nowMs += 864e5; sets.length = 0; s.store.t('check').toggle({ habit: 'x' }); assert.ok(sets.includes('d:2026-11-15'));
});

for (const tz of ['America/Los_Angeles', 'Asia/Karachi', 'UTC', 'Pacific/Kiritimati']) {
  test(`timezone ${tz}: date-only strings never shift a day; today() is the local day`, () => {
    const out = JSON.parse(execFileSync(process.execPath, [fileURLToPath(new URL('./tz-probe.cjs', import.meta.url))], { env: { ...process.env, TZ: tz } }).toString());
    assert.deepEqual(out.boundary, { month: 10, week: 11, last7: 11, series: ['2026-02:101', '2026-03:10'], today: '2026-03-01' }, 'month boundary, ' + tz);
    delete out.boundary;
    assert.deepEqual(out, { dateOnly: 'Nov 12', jan1: 'Jan 1', prevYear: 'Dec 31, 2025', rel: 'Yesterday', today: '2026-11-12', tz });
  });
}

test('sqlite: a corrupt JSON row is skipped and recorded, the rest of the table still loads', { skip: !Database }, () => {
  const db = new Database(':memory:'); ensureSchema(db);
  const ad = sqliteAdapter(db, 'a'); const s0 = createSDK({ adapter: ad, manifest, now: () => T0 });
  s0.store.t('log').add({ what: 'one', mins: 1 }); s0.store.t('log').add({ what: 'two', mins: 2 });
  db.prepare("insert into records(app_id,tbl,id,data,created_at,updated_at) values('a','log',50,'{not json',1,1)").run();
  db.prepare("insert into kv(app_id,key,val) values('a','goal','{bad')").run();
  const s = createSDK({ adapter: sqliteAdapter(db, 'a'), manifest, now: () => T0 });
  assert.deepEqual(s.store.t('log').rows.map((r) => r.what), ['one', 'two']);
  assert.equal(s.store.kv('goal', 7).v, 7, 'corrupt kv falls back to the default');
  const errs = s.internal.errors(); assert.equal(errs.length, 2); assert.ok(errs.some((e) => e.tbl === 'log' && e.id === 50));
  assert.equal(s.store.t('log').add({ what: 'three' }), 51, 'new ids still never collide with the unreadable row');
});

test('memory adapter parity: unreadable data in a row does not throw (loose read)', () => {
  const ad = memoryAdapter(); ad.put('log', { id: 1, at: T0, deleted_at: null, data: null }); ad.put('log', { id: 2, at: T0, deleted_at: null, data: { mins: 'zzz', kind: 7 } });
  const r = createSDK({ adapter: ad, manifest }).store.t('log').rows; assert.deepEqual([r[0].mins, r[1].mins, r[1].kind], [0, 0, 'run']);
});


/* ---- round 3 ---- */
for (const [aname, mk] of Object.entries(adapters)) {
  const mkS = (m = manifest, extra = {}) => { const ctx = mk(); return { ctx, s: createSDK({ adapter: ctx.make(), manifest: m, now: () => T0, locale: 'en-US', timers: fakeTimers(), ...extra }) }; };

  test(`[${aname}] more bad arguments: sum/series/group need number columns, where/since null, kv values, set on a null row`, () => {
    const { s, ctx } = mkS(); const t = s.store.t('log');
    t.add({ what: 'a', mins: 5 });
    typed(() => t.sum('what'), 'E_COL'); typed(() => t.sum('kind'), 'E_COL'); typed(() => t.series('what'), 'E_COL'); typed(() => t.group('kind', 'what'), 'E_COL');
    assert.equal(t.series('what', { op: 'count', last: 2 }).length, 2, 'count may use any column');
    typed(() => t.sum('mins', { where: null }), 'E_ARG'); typed(() => t.sum('mins', { since: null }), 'E_ARG'); typed(() => t.series('mins', { where: null }), 'E_ARG'); typed(() => t.group('kind', 'mins', { where: [] }), 'E_ARG');
    const box = s.store.kv('k', 1);
    for (const bad of [() => 1, Symbol('x'), 10n, undefined, NaN, Infinity, { f() {} }, [() => 1], new Date(), new Map(), { a: { b: () => 1 } }]) typed(() => { box.v = bad; }, 'E_ARG');
    typed(() => s.store.kv('k2', () => 1), 'E_ARG'); assert.equal(box.v, 1);
    box.v = { a: [1, 'x', null, true] }; assert.deepEqual(box.v, { a: [1, 'x', null, true] });
  });

  test(`[${aname}] t.set on a stored row whose data is null does not throw a raw TypeError`, () => {
    const ctx = mk(); const ad = ctx.make(); ad.put('log', { id: 1, at: T0, deleted_at: null, data: null });
    const s = createSDK({ adapter: ad, manifest, now: () => T0 }); const t = s.store.t('log');
    assert.equal(t.set(1, { what: 'fixed', mins: 3 }), true); assert.deepEqual([t.rows[0].what, t.rows[0].mins], ['fixed', 3]);
  });

  test(`[${aname}] ui.toast: at most 3 visible, the newest replaces the oldest, and removed timers do not fire late`, () => {
    const a = createSDK({ manifest, timers: fakeTimers() }); const dismissers = [1, 2, 3, 4, 5].map((i) => a.ui.toast('m' + i));
    assert.deepEqual(a.internal.toasts().map((x) => x.msg), ['m3', 'm4', 'm5']); dismissers[0](); assert.equal(a.internal.toasts().length, 3);
  });

  test(`[${aname}] calendar-aligned since: week starts Monday by default, month starts on the 1st, last7/last30 stay explicit, series agree`, () => {
    const m = { tables: { x: { n: 'num' } } }; const at2 = (y, mo, d, h = 12) => new Date(y, mo, d, h).getTime();
    const now = at2(2026, 2, 1, 9); // Sunday 1 March 2026
    const ctx = mk(); const s = createSDK({ adapter: ctx.make(), manifest: m, now: () => now }); const t = s.store.t('x');
    t.add({ n: 100, at: at2(2026, 1, 20) }); t.add({ n: 1, at: at2(2026, 1, 28, 23) }); t.add({ n: 10, at: at2(2026, 2, 1, 0) });
    assert.equal(t.sum('n', { since: 'month' }), 10, 'only March'); assert.equal(t.sum('n', { since: 'week' }), 11, 'Mon 23 Feb .. Sun 1 Mar');
    assert.equal(t.sum('n', { since: 'day' }), 10); assert.equal(t.sum('n', { since: 'last7' }), 11); assert.equal(t.sum('n', { since: 'last30' }), 111);
    const mon = t.series('n', { by: 'month', last: 2 }); assert.deepEqual(mon, [{ k: '2026-02', v: 101 }, { k: '2026-03', v: 10 }]);
    assert.equal(mon[1].v, t.sum('n', { since: 'month' }), 'series by month and since month agree');
    const wk = t.series('n', { by: 'week', last: 2 }); assert.equal(wk[1].k, '2026-02-23'); assert.equal(wk[1].v, t.sum('n', { since: 'week' }), 'series by week and since week agree');
    const sun = createSDK({ adapter: mk().make(), manifest: { ...m, weekStart: 0 }, now: () => now }); const t2 = sun.store.t('x'); t2.add({ n: 1, at: at2(2026, 1, 28) }); t2.add({ n: 5, at: at2(2026, 2, 1, 0) });
    assert.equal(t2.sum('n', { since: 'week' }), 5, 'Sunday-start week begins today'); assert.equal(t2.series('n', { by: 'week', last: 1 })[0].k, '2026-03-01');
    const loc = createSDK({ manifest: { ...m, weekStart: 'locale' }, now: () => now, locale: 'en-US' }); assert.equal(loc.internal.weekStart, 0, 'en-US weeks start on Sunday');
    typed(() => t.sum('n', { since: 'year' }), 'E_ARG');
  });

  test(`[${aname}] app.fmt: a date-only string never invents a time of day`, () => {
    const { s } = mkS();
    assert.equal(s.app.fmt('2026-11-12', 'rel'), 'Today'); assert.equal(s.app.fmt('2026-11-11', 'rel'), 'Yesterday'); assert.equal(s.app.fmt('2026-11-09', 'rel'), 'Monday');
    assert.equal(s.app.fmt('2026-11-01', 'rel'), 'Nov 1'); typed(() => s.app.fmt('2026-11-12', 'time'), 'E_ARG');
    assert.match(s.app.fmt(new Date(2026, 10, 12, 7), 'rel'), /Today, 7:00/);
  });
}

test('sqlite kv: writing a key twice keeps the last value, across a re-open, and apps stay apart', { skip: !Database }, () => {
  const db = new Database(':memory:'); ensureSchema(db);
  const a = createSDK({ adapter: sqliteAdapter(db, 'a'), manifest }), b = createSDK({ adapter: sqliteAdapter(db, 'b'), manifest });
  const box = a.store.kv('goal', 1); box.v = 2; box.v = { n: 3 }; box.v = 4; b.store.kv('goal', 9).v = 10;
  assert.equal(createSDK({ adapter: sqliteAdapter(db, 'a'), manifest }).store.kv('goal', 0).v, 4);
  assert.equal(createSDK({ adapter: sqliteAdapter(db, 'b'), manifest }).store.kv('goal', 0).v, 10);
  assert.equal(db.prepare("select count(*) c from kv where key='goal'").get().c, 2, 'one row per app and key (upsert, not insert)');
});

/* ---- round 4: boundaries and data integrity (written to kill mutants, see kit/tests/mutate.mjs) ---- */
for (const [aname, mk] of Object.entries(adapters)) {
  const mkS = (m = manifest, extra = {}) => { const ctx = mk(); const adapter = ctx.make(); return { ctx, adapter, s: createSDK({ adapter, manifest: m, now: () => T0, locale: 'en-US', timers: fakeTimers(), ...extra }) }; };

  test(`[${aname}] t.remove removes exactly one row, undo restores order by time then id, a removed row stays removed after a reopen`, () => {
    const { ctx, adapter, s } = mkS(); const t = s.store.t('log');
    const ids = [t.add({ what: 'a', at: at(3) }), t.add({ what: 'b', at: at(2) }), t.add({ what: 'c', at: at(2) }), t.add({ what: 'd', at: at(1) })];
    t.remove(ids[1]); assert.deepEqual(t.rows.map((r) => r.what), ['a', 'c', 'd'], 'one row only');
    s.internal.toasts()[0].undo(); assert.deepEqual(t.rows.map((r) => r.what), ['a', 'b', 'c', 'd'], 'same time: by id');
    t.remove(ids[0]); s.internal.toasts().at(-1).undo(); assert.deepEqual(t.rows.map((r) => r.what), ['a', 'b', 'c', 'd'], 'oldest back in front');
    t.remove(ids[2]); const again = createSDK({ adapter: ctx.reopen(adapter), manifest, now: () => T0 }); assert.deepEqual(again.store.t('log').rows.map((r) => r.what), ['a', 'b', 'd'], 'a tombstone is not read back');
  });

  test(`[${aname}] ids are never reused after a delete, set on a removed row is E_ROW, a missing id removes nothing`, () => {
    const { s } = mkS(); const t = s.store.t('log'); const a = t.add({ what: 'a' }), b = t.add({ what: 'b' });
    t.remove(b); assert.equal(t.add({ what: 'c' }), b + 1 === a + 2 ? b + 1 : b + 1, 'next id continues past the removed row'); assert.ok(t.add({ what: 'd' }) > b + 1);
    typed(() => t.set(b, { what: 'x' }), 'E_ROW'); assert.equal(t.remove(12345), false); assert.equal(t.rows.length, 3);
    typed(() => t.set(a + 0.5, {}), 'E_ARG');
  });

  test(`[${aname}] boolean coercion, pick fallback, date validity, at override, number clamps are exact at the boundary`, () => {
    const { s } = mkS(); const t = s.store.t('log'); const c = s.store.t('check');
    t.add({ ok: 'false' }); t.add({ ok: 'true' }); t.add({ ok: 0 }); t.add({ ok: 1 }); t.add({ kind: 'swim' }); typed(() => t.add({ ok: '' }), 'E_ARG'); typed(() => t.add({ kind: 'zzz' }), 'E_ARG');
    assert.deepEqual(t.rows.slice(0, 4).map((r) => r.ok), [false, true, false, true]); assert.equal(t.rows[4].kind, 'swim');
    t.add({ mins: 1e12 }); t.add({ mins: 1e12 + 1 }); t.add({ mins: -1e12 - 1 }); assert.deepEqual(t.rows.slice(5).map((r) => r.mins), [1e12, 1e12, -1e12]);
    c.add({ day: '2024-02-29' }); typed(() => c.add({ day: '2025-02-29' }), 'E_ARG'); typed(() => c.add({ day: '2026-4-01' }), 'E_ARG'); typed(() => c.add({ day: '2026-00-10' }), 'E_ARG');
    assert.equal(t.rows[0].at, T0); const id = t.add({ at: 12345 }); assert.equal(t.rows.find((r) => r.id === id).at, 12345); typed(() => t.add({ at: 'x' }), 'E_ARG');
  });

  test(`[${aname}] series: default length 7, clamp at 366, avg of an empty bucket is 0, week buckets, ties`, () => {
    const { s } = mkS(); const t = s.store.t('log'); t.add({ mins: 10, at: at(0) }); t.add({ mins: 20, at: at(0) });
    assert.equal(t.series('mins').length, 7); assert.equal(t.series('mins', { last: 366 }).length, 366); assert.equal(t.series('mins', { last: 367 }).length, 366); assert.equal(t.series('mins', { last: 1 }).length, 1);
    const avg = t.series('mins', { op: 'avg', last: 3 }); assert.deepEqual(avg.map((x) => x.v), [0, 0, 15]); assert.ok(avg.every((x) => Number.isFinite(x.v)));
    assert.deepEqual(t.series(null, { op: 'count', last: 2 }).map((x) => x.v), [0, 2]); assert.deepEqual(t.series('mins', { by: 'month', last: 1 }), [{ k: '2026-11', v: 30 }]);
  });

  test(`[${aname}] since windows are exact at their edges (day, calendar week, calendar month, last7, last30)`, () => {
    const { s } = mkS(); const t = s.store.t('log'); // T0 = Thu 12 Nov 2026
    const days = { day: 0, monday: 3, sunday: 4, first: 11, lastOct: 12, d6: 6, d7: 7, d29: 29, d30: 30 };
    for (const [k, d] of Object.entries(days)) t.add({ what: k, mins: 1, at: at(d) });
    const names = (since) => t.rows.filter((r) => t.sum('mins', { since, where: { what: r.what } }) > 0).map((r) => r.what).sort();
    assert.deepEqual(names('day'), ['day']); assert.deepEqual(names('week'), ['day', 'monday']); assert.deepEqual(names('month'), ['d6', 'd7', 'day', 'first', 'monday', 'sunday'].sort());
    assert.deepEqual(names('last7'), ['d6', 'day', 'monday', 'sunday'].sort()); assert.deepEqual(names('last30'), ['d29', 'd6', 'd7', 'day', 'first', 'lastOct', 'monday', 'sunday'].sort());
  });

  test(`[${aname}] streak counts every consecutive day (long runs), starts from yesterday, stops at a gap, needs the exact key`, () => {
    const { s } = mkS(); const c = s.store.t('check'); const day = (n) => { const d = new Date(T0); d.setDate(d.getDate() - n); return ymd(d); };
    for (let n = 1; n <= 12; n++) c.add({ habit: 'a', day: day(n) }); assert.equal(c.streak({ habit: 'a' }), 12);
    for (let n = 0; n <= 6; n++) c.add({ habit: 'b', day: day(n) }); c.add({ habit: 'b', day: day(8) }); assert.equal(c.streak({ habit: 'b' }), 7);
    c.add({ habit: 'c', day: day(2) }); assert.equal(c.streak({ habit: 'c' }), 0); assert.equal(c.streak({ habit: 'zzz' }), 0);
  });

  test(`[${aname}] toggle and has default the date to today and match every given key`, () => {
    const { s } = mkS(); const c = s.store.t('check');
    assert.equal(c.toggle({ habit: 'a' }), true); assert.equal(c.rows[0].day, '2026-11-12'); assert.equal(c.has({ habit: 'a' }), true); assert.equal(c.has({ habit: 'a', day: '2026-11-11' }), false);
    assert.equal(c.toggle({ habit: 'b', day: '2026-11-11' }), true); assert.equal(c.has({ habit: 'b' }), false, 'b is checked yesterday, not today'); assert.equal(c.has({ habit: 'a', day: '2026-11-12' }), true);
    assert.equal(c.toggle({ habit: 'a' }), false); assert.equal(c.has({ habit: 'a' }), false); assert.equal(c.rows.length, 1);
  });

  test(`[${aname}] group: sorted by total, count mode, window and where`, () => {
    const { s } = mkS(); const t = s.store.t('log');
    [['run', 5], ['swim', 50], ['run', 40], ['lift', 7]].forEach(([k, m]) => t.add({ kind: k, mins: m }));
    assert.deepEqual(t.group('kind', 'mins'), [{ k: 'swim', v: 50 }, { k: 'run', v: 45 }, { k: 'lift', v: 7 }]); assert.deepEqual(t.group('kind').map((x) => x.v), [2, 1, 1]);
    assert.deepEqual(t.group('kind', 'mins', { where: { kind: 'run' } }), [{ k: 'run', v: 45 }]);
  });

  test(`[${aname}] kv: falsy values persist, key and depth limits are exact`, () => {
    const { ctx, adapter, s } = mkS(); const b = s.store.kv('zero', 5); b.v = 0; b.v = false; b.v = '';
    const again = createSDK({ adapter: ctx.reopen(adapter), manifest }); assert.equal(again.store.kv('zero', 5).v, '', 'a stored empty string is not replaced by the default');
    s.store.kv('k'.repeat(60), 1); typed(() => s.store.kv('k'.repeat(61), 1), 'E_TABLE'); typed(() => s.store.kv('', 1), 'E_TABLE');
    const deep = (n) => { let o = 1; for (let i = 0; i < n; i++) o = [o]; return o; }; s.store.kv('d6', deep(6)); typed(() => s.store.kv('d8', deep(8)), 'E_ARG'); typed(() => { s.store.kv('d6').v = deep(8); }, 'E_ARG');
    const z = s.store.kv('z', 1); z.v = 0; assert.equal(z.v, 0); assert.equal(createSDK({ adapter: ctx.reopen(adapter), manifest }).store.kv('z', 9).v, 0);
  });

  test(`[${aname}] notify: time-of-day bounds, text bound, next occurrence is strictly in the future`, () => {
    const { s } = mkS();
    for (const ok of ['00:00', '23:59', '9:05', '12:59']) assert.ok(s.app.notify(ok, 'x').at > T0, ok);
    for (const bad of ['24:00', '23:60', '99:99', '1:5', '12:345', '']) typed(() => s.app.notify(bad, 'x'), 'E_ARG');
    s.app.notify('20:30', 'x'); const sameMinute = s.app.notify('20:30', 'x'); assert.equal(new Date(sameMinute.at).getDate(), 13, 'the same minute rolls to tomorrow');
    s.app.notify('c'.repeat(200).slice(0, 200) && '10:00', 'c'.repeat(200)); typed(() => s.app.notify('10:00', 'c'.repeat(201)), 'E_ARG'); typed(() => s.app.notify(Infinity, 'x'), 'E_ARG'); assert.ok(s.app.notify(5, 'x').at === 5);
  });

  test(`[${aname}] toast and timer: exact durations, limits and restart`, () => {
    const tmr = fakeTimers(); const a = createSDK({ manifest, timers: tmr }); a.timers = tmr;
    a.ui.toast('plain'); a.timers.advance(2999); assert.equal(a.internal.toasts().length, 1); a.timers.advance(1); assert.equal(a.internal.toasts().length, 0, 'a plain toast lasts 3000 ms');
    a.ui.toast('undo', () => {}); a.timers.advance(9999); assert.equal(a.internal.toasts().length, 1); a.timers.advance(1); assert.equal(a.internal.toasts().length, 0, 'an Undo toast lasts 10000 ms');
    a.ui.toast('x'.repeat(200)); typed(() => a.ui.toast('x'.repeat(201)), 'E_ARG');
    for (const sec of [1, 86400, 0.5]) assert.ok(a.ui.timer(sec)); for (const bad of [0, -1, 86401]) typed(() => a.ui.timer(bad), 'E_ARG');
    let n = 0; const tm = a.ui.timer(2, () => n++); tm.start(); tm.start(); a.timers.advance(1000); assert.equal(tm.left, 1, 'a second start() does not add a second interval'); a.timers.advance(1000); assert.equal(tm.left, 0); a.timers.advance(5000); assert.equal(tm.left, 0, 'never below zero'); assert.equal(n, 1);
    tm.start(); assert.equal(tm.left, 2); assert.equal(a.ui.timer(0.5).left, 1, 'fractions round up');
  });

  test(`[${aname}] fmt: all three forms, boundaries of the relative window`, () => {
    const { s } = mkS(); const f = (d, h) => s.app.fmt(at(d, h), 'rel');
    assert.match(f(0, 7), /^Today, 7:00/); assert.match(f(1, 7), /^Yesterday, 7:00/); assert.match(f(2, 7), /^Tuesday, 7:00/); assert.match(f(6, 7), /^Friday, 7:00/); assert.equal(f(7, 7), 'Nov 5'); assert.equal(f(30, 7), 'Oct 13');
    assert.equal(s.app.fmt(at(0, 7)), 'Nov 12'); assert.equal(s.app.fmt(new Date(2025, 10, 12)), 'Nov 12, 2025'); typed(() => s.app.fmt(at(0), 'other'), 'E_ARG'); assert.equal(s.app.fmt(T0 + 5 * 864e5, 'rel'), 'Nov 17');
  });

  test(`[${aname}] reads: each column type keeps well-formed stored values, and today() is the live local day`, () => {
    const ctx = mk(); const ad = ctx.make(); ad.put('check', { id: 1, at: T0, deleted_at: null, data: { habit: 'h', day: '2026-01-05' } }); ad.put('check', { id: 2, at: T0, deleted_at: null, data: { habit: 7, day: '2026-02-31' } });
    const c = createSDK({ adapter: ad, manifest, now: () => T0 }).store.t('check'); assert.deepEqual(c.rows.map((r) => [r.habit, r.day]), [['h', '2026-01-05'], ['7', '2026-11-12']]);
  });
}

for (const [aname, mk] of Object.entries(adapters)) {
  const mkS = (m = manifest, extra = {}) => { const ctx = mk(); const adapter = ctx.make(); return { ctx, adapter, s: createSDK({ adapter, manifest: m, now: () => T0, locale: 'en-US', timers: fakeTimers(), ...extra }) }; };
  test(`[${aname}] more boundaries: week start 6, whitespace-only notify text, count vs sum, kv depth 7, integer ids, boolean values`, () => {
    const sat = mkS({ ...manifest, weekStart: 6 }).s.store.t('log'); sat.add({ what: 'fri', mins: 1, at: at(6) }); sat.add({ what: 'sat', mins: 2, at: at(5) }); // T0 is Thu 12 Nov; Sat 7 Nov
    assert.equal(sat.sum('mins', { since: 'week' }), 2, 'weeks start on Saturday when weekStart is 6'); assert.equal(sat.series('mins', { by: 'week', last: 1 })[0].k, '2026-11-07');
    const bad = mkS({ ...manifest, weekStart: 7 }); assert.equal(bad.s.internal.weekStart, 1, 'an invalid weekStart falls back to Monday');
    const { s } = mkS(); typed(() => s.app.notify('10:00', '   '), 'E_ARG'); typed(() => s.app.notify('10:00', ' \n '), 'E_ARG');
    const t = s.store.t('log'); t.add({ mins: 10, at: at(0) }); t.add({ mins: 20, at: at(0) });
    assert.deepEqual(t.series('mins', { op: 'count', last: 1 }), [{ k: '2026-11-12', v: 2 }], 'count counts rows, it does not add the column');
    const deep = (n) => { let o = 1; for (let i = 0; i < n; i++) o = [o]; return o; }; s.store.kv('d6', deep(6)); typed(() => s.store.kv('d7', deep(7)), 'E_ARG');
    typed(() => t.remove(1.5), 'E_ARG'); typed(() => t.remove(NaN), 'E_ARG'); typed(() => t.remove('1'), 'E_ARG');
    const id = t.add({ ok: true }); assert.equal(t.rows.find((r) => r.id === id).ok, true); typed(() => t.add({ ok: {} }), 'E_ARG'); typed(() => t.add({ ok: [true] }), 'E_ARG');
  });
}

test('sqlite: a grouped removal (parent + children) runs inside ONE transaction and Undo restores it in one too', { skip: !Database }, () => {
  const db = new Database(':memory:'); ensureSchema(db); const base = sqliteAdapter(db, 'a'); let inTx = [], txs = 0;
  const ad = { ...base, batch: (fn) => { txs++; return base.batch(fn); }, put: (tbl, rec) => { inTx.push(db.inTransaction); return base.put(tbl, rec); } };
  const s = createSDK({ adapter: ad, manifest, now: () => T0 }); const h = s.store.t('log'), c = s.store.t('check');
  const a = h.add({ what: 'x' }); for (let i = 0; i < 12; i++) c.add({ habit: String(a), day: ymd(new Date(T0 - i * 864e5)) });
  inTx = []; txs = 0; assert.equal(s.internal.removeGroup([[c, c.rows.map((r) => r.id)], [h, [a]]]), 13);
  assert.equal(txs, 1, 'one transaction'); assert.equal(inTx.length, 13); assert.ok(inTx.every(Boolean), 'every write happened inside it');
  inTx = []; txs = 0; s.internal.toasts()[0].undo(); assert.equal(txs, 1); assert.ok(inTx.every(Boolean)); assert.equal(c.rows.length, 12);
  assert.equal(new Database(':memory:').open, true);
});

for (const [aname, mk] of Object.entries(adapters)) {
  test(`[${aname}] error messages say what to do; stored values beyond the clamp are clamped on read`, () => {
    const ctx = mk(); const ad = ctx.make(); ad.put('log', { id: 1, at: T0, deleted_at: null, data: { mins: 1e30 } }); ad.put('log', { id: 2, at: T0, deleted_at: null, data: { mins: -1e30 } }); ad.put('log', { id: 3, at: T0, deleted_at: null, data: { mins: 'abc' } });
    const t = createSDK({ adapter: ad, manifest, now: () => T0 }).store.t('log'); assert.deepEqual(t.rows.map((r) => r.mins), [1e12, -1e12, 0]);
    assert.throws(() => t.add({ mins: null }), /null is not a value for a num column; leave the key out/); assert.throws(() => t.add({ mins: NaN }), /finite number, got null/);
    assert.throws(() => t.add({ mins: 'abc' }), /finite number, got "abc"/); assert.throws(() => t.add({ kind: 'zzz' }), /"zzz" is not one of run, swim, lift/); assert.throws(() => t.add({ ok: 'yes' }), /true or false, not "yes"/);
    assert.throws(() => t.add({ what: {} }), /must be text, a number or true\/false/);
  });
}
