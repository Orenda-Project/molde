/* SQLite adapter for the Molde SDK (contract section 2: generic `records` + `kv` tables).
 * Takes an open better-sqlite3 style handle (prepare/exec/get/all/run). node:sqlite (node >= 22.5)
 * has the same shape, so it works too. node 20 has no node:sqlite, so tests use better-sqlite3.
 * ensureSchema() is HOST bookkeeping, run once. No DDL ever runs for a mini-app's own tables. */
'use strict';

function ensureSchema(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS records(
    app_id TEXT NOT NULL, tbl TEXT NOT NULL, id INTEGER NOT NULL, data TEXT NOT NULL,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, deleted_at INTEGER,
    PRIMARY KEY(app_id, tbl, id));
  CREATE TABLE IF NOT EXISTS kv(app_id TEXT NOT NULL, key TEXT NOT NULL, val TEXT NOT NULL, PRIMARY KEY(app_id, key));`);
}

function sqliteAdapter(db, appId) {
  const sel = db.prepare('SELECT id, data, created_at, deleted_at FROM records WHERE app_id=? AND tbl=? ORDER BY id');
  const up = db.prepare(`INSERT INTO records(app_id,tbl,id,data,created_at,updated_at,deleted_at) VALUES(?,?,?,?,?,?,?)
    ON CONFLICT(app_id,tbl,id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at, deleted_at=excluded.deleted_at`);
  const one = db.prepare('SELECT id, data, created_at, deleted_at FROM records WHERE app_id=? AND tbl=? AND id=?');
  const nx = db.prepare('SELECT COALESCE(MAX(id),0)+1 AS n FROM records WHERE app_id=? AND tbl=?');
  const kg = db.prepare('SELECT val FROM kv WHERE app_id=? AND key=?');
  const ks = db.prepare('INSERT INTO kv(app_id,key,val) VALUES(?,?,?) ON CONFLICT(app_id,key) DO UPDATE SET val=excluded.val');
  const errors = [];
  return {
    errors,
    // a row whose JSON is corrupt is skipped and recorded in `errors`; it never makes the whole table throw
    rows: (tbl) => {
      const out = [];
      for (const r of sel.all(appId, tbl)) {
        try { out.push({ id: r.id, at: r.created_at, deleted_at: r.deleted_at, data: JSON.parse(r.data) }); }
        catch (e) { errors.push({ tbl, id: r.id, msg: 'unreadable row skipped: ' + e.message }); }
      }
      return out;
    },
    get: (tbl, id) => { const r = one.get(appId, tbl, id); if (!r) return undefined; try { return { id: r.id, at: r.created_at, deleted_at: r.deleted_at, data: JSON.parse(r.data) }; } catch (e) { errors.push({ tbl, id, msg: 'unreadable row skipped: ' + e.message }); return undefined; } },
    put: (tbl, rec) => { up.run(appId, tbl, rec.id, JSON.stringify(rec.data), rec.at, Date.now(), rec.deleted_at == null ? null : rec.deleted_at); },
    nextId: (tbl) => nx.get(appId, tbl).n,
    kvGet: (k) => { const r = kg.get(appId, k); if (!r) return undefined; try { return JSON.parse(r.val); } catch (e) { errors.push({ tbl: 'kv', id: k, msg: 'unreadable value skipped: ' + e.message }); return undefined; } },
    kvSet: (k, v) => { ks.run(appId, k, JSON.stringify(v)); },
  };
}
module.exports = { sqliteAdapter, ensureSchema };
