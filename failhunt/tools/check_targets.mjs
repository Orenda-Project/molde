// Checks that every DATA_SPEC edit example really does what its request asks, with the same predicates the hunt used (tools/preds.mjs).
import { readFileSync } from 'node:fs';
const P = await import('./preds.mjs');
const T = {
  af1: { k: 'addfield', word: 'note' }, af2: { k: 'addfield', word: 'method' }, af3: { k: 'addfield', word: 'due' },
  ao1: { k: 'addoption', word: 'Online' }, ao2: { k: 'addoption', word: 'Urgent' }, ao3: { k: 'addoption', word: 'Cash' },
  rm1: { k: 'remove', what: 'chart' }, rm2: { k: 'remove', what: 'list' }, rm3: { k: 'remove', what: 'goal' },
  ac1: { k: 'addchart' }, ac2: { k: 'addstat' }, ac3: { k: 'addstat' },
  se1: { k: 'sections' }, se2: { k: 'sections' }, se3: { k: 'sections' },
  sv1: { k: 'goalnum', n: 3000 }, sv2: { k: 'goalnum', n: 60000 }, sv3: { k: 'goalnum', n: 100 },
  rf1: { k: 'renamefield', to: 'amount', old: 'ml' }, rf2: { k: 'renamefield', to: 'item', old: 'what' }, rf3: { k: 'renamefield', to: 'task', old: 'title' },
  rb1: { k: 'btn', to: 'Spend', old: 'Add expense' }, rb2: { k: 'btn', to: 'New task', old: 'Add task' }, rb3: { k: 'btn', to: 'Weigh in', old: 'Add weight' },
  ro1: { k: 'reorder', a: 'form', b: 'stat' }, ro2: { k: 'reorder', a: 'chart', b: 'list' }, ro3: { k: 'reorder', a: 'stat', b: 'form' },
  id1: { k: 'refuse' }, id2: { k: 'refuse' }, id3: { k: 'refuse' },
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
