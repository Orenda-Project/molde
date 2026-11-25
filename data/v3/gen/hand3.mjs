// v3 hand files: records separated by a line "===".
//   @rich domain=NAME topic=short_topic [style=...]
//   request on one line (may be empty for programs whose request is written later: write "-")
//   needs: need one | need two | need three
//   ---
//   program
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { canon, verify, migrateBatch } from '../../data-v1/gen/lib.mjs';
export function readHand3(dir, filter) {
  const out = [], fails = [];
  for (const f of readdirSync(dir).filter(f => f.endsWith('.txt') && (!filter || f.startsWith(filter))).sort()) {
    const recs0 = readFileSync(dir + f, 'utf8').split(/^===\s*$/m).map(x => x.trim()).filter(Boolean);
    // migrate every program (older spellings, e.g. topbar "Title", TABLE) with the real mo.mjs migrate before checking
    const progIdx = recs0.map(rec => { const L = rec.split('\n'); const sep = L.findIndex(l => /^---\s*$/.test(l)); return sep < 0 ? null : { L, sep }; });
    const texts = progIdx.map(x => x ? x.L.slice(x.sep + 1).join('\n') + '\n' : ''); const mig = migrateBatch(texts);
    const recs = recs0.map((rec, i) => progIdx[i] ? [...progIdx[i].L.slice(0, progIdx[i].sep + 1), mig[i].replace(/\n$/, '')].join('\n') : rec);
    recs.forEach((rec, n) => {
      const L = rec.split('\n'); const id = `${f}#${n}`;
      const m = L[0].match(/^@(\w+)\s*(.*)$/); if (!m) { fails.push({ id, why: 'no header' }); return; }
      const meta = Object.fromEntries([...m[2].matchAll(/(\w+)=(\S+)/g)].map(x => [x[1], x[2]]));
      const sep = L.findIndex(l => /^---\s*$/.test(l)); if (sep < 0) { fails.push({ id, why: 'no ---' }); return; }
      const head = L.slice(1, sep); const request = (head[0] || '').trim();
      const nl = head.find(l => /^needs:/i.test(l)); const needs = nl ? nl.replace(/^needs:/i, '').split('|').map(x => x.trim()).filter(Boolean) : [];
      const c = canon(L.slice(sep + 1).join('\n') + '\n'); if (!c.ok) { fails.push({ id, request: request.slice(0, 50), why: c.errors.slice(0, 2).join(' | ') }); return; }
      out.push({ id, kind: m[1], request: request === '-' ? '' : request, needs, program: c.text, ...meta });
    });
  }
  return { out, fails };
}
