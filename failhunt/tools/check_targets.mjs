// Checks that every DATA_SPEC edit example really does what its request asks, with the same predicates the hunt used (tools/preds.mjs).
import { readFileSync } from 'node:fs';
const P = await import('./preds.mjs');
const T = {
  af1: { k: 'addfield', word: 'effort' }, af2: { k: 'addfield', word: 'who' }, af3: { k: 'addfield', word: 'year' },
  ao1: { k: 'addoption', word: 'Gifts' }, ao2: { k: 'addoption', word: 'Karahi' }, ao3: { k: 'addoption', word: 'Refund' },
  rm1: { k: 'remove', what: 'chart' }, rm2: { k: 'remove', what: 'chart' }, rm3: { k: 'remove', what: 'list' },
  ac1: { k: 'addchart' }, ac2: { k: 'addstat' }, ac3: { k: 'addchart' },
  se1: { k: 'sections' }, se2: { k: 'sections' }, se3: { k: 'sections' },
  sv1: { k: 'goalnum', n: 108 }, sv2: { k: 'goalnum', n: 18000 }, sv3: { k: 'goalnum', n: 150000 },
  rf1: { k: 'renamefield', to: 'bedtime', old: 'slept' }, rf2: { k: 'renamefield', to: 'who', old: 'name' }, rf3: { k: 'renamefield', to: 'group', old: 'kind' },
  rb1: { k: 'btn', to: 'Remember', old: 'Add person' }, rb2: { k: 'btn', to: 'Add one more', old: '+' }, rb3: { k: 'btn', to: 'Took it', old: 'Add medicine' },
  ro1: { k: 'reorder', a: 'chart', b: 'list' }, ro2: { k: 'reorder', a: 'form', b: 'list' }, ro3: { k: 'reorder', a: 'stat', b: 'list' },
  id2: { k: 'addstat' }, vg3: { k: 'addchart' },
};
let bad = 0, n = 0;
for (const l of readFileSync(process.argv[2], 'utf8').trim().split('\n')) {
  const r = JSON.parse(l); const st = T[r.id]; if (!st) continue; n++;
  const d = P.did(st, r.before, r.program);
  const ds = P.diffStats(r.before, r.program);
  const extra = (r.class === 'rename_field' || r.class === 'add_field' || r.class === 'add_option' || r.class === 'rename_button' || r.class === 'setting_value') ? 0 : ds.lost.length;
  console.log(r.id.padEnd(4), r.class.padEnd(16), d ? 'does it' : 'DOES NOT', 'kept', ds.kept_ratio, 'lost', ds.lost.length);
  if (!d) bad++;
}
console.log(n, 'checked,', bad, 'not detected by the predicate');
