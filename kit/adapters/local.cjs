/* localStorage adapter for the standalone demo page and tests: the memory adapter plus "save the whole state after every write".
 * The host's real adapter (SQLite) is unchanged and wins whenever window.moldeHost.adapter is given; this is only the fallback so a person who opens a
 * fixture sees their data survive a reload. First visit: the seed. After that: what was saved. Storage that throws (private mode, quota) degrades to memory only.
 * localAdapter(storage, key, seed) -> an adapter with the same interface as memoryAdapter. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../src/sdk.cjs'));
  else root.MoldeLocal = factory(root.MoldeSDK);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (S) {
  'use strict';
  function localAdapter(storage, key, seed) {
    let saved = null;
    try { const raw = storage && storage.getItem(key); if (raw) { const v = JSON.parse(raw); if (v && typeof v === 'object' && v.tables) saved = v; } } catch (e) { saved = null; }
    const a = S.memoryAdapter(saved || seed);
    let queued = false;
    const save = () => { if (queued) return; queued = true; Promise.resolve().then(() => { queued = false; try { storage.setItem(key, JSON.stringify(a.dump())); } catch (e) { a.errors.push({ tbl: 'local', id: key, msg: 'not saved: ' + e.message }); } }); };
    const put = a.put, kvSet = a.kvSet;
    a.put = (t, r) => { put(t, r); save(); };
    a.kvSet = (k, v) => { kvSet(k, v); save(); };
    return a;
  }
  return { localAdapter };
});
