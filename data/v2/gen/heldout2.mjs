process.env.HAND_DIR = new URL('../heldout2/', import.meta.url).pathname;
import { writeFileSync } from 'node:fs';
const { readHand } = await import('../../data-v1/gen/hand.mjs');
const { verify, canon, diff, sha, LANG, LANG_COMMIT, migrateBatch } = await import('../../data-v1/gen/lib.mjs');
const { tokenCounts } = await import('../../data-v1/gen/tokcount.mjs');
const { strip } = await import(LANG + '/format.mjs');
const { out, fails } = readHand();
const rows = [], drop = [...fails]; const seenReq = new Set();
const tk = tokenCounts(out.flatMap(o => o.before ? [o.program, o.before] : [o.program]));
let i = 0;
for (const o of out) {
  const t = tk[i++], tb = o.before ? tk[i++] : 0;
  const before = o.before ? canon(strip(o.before)).text : undefined;
  const v = verify(o.program, before ? [before] : null);
  if (!v.ok || t > 400 || tb > 400) { drop.push({ id: o.id, why: v.why || 'tokens' }); continue; }
  if (before) { const d = diff([before], o.program); if (d.verdict === 'refused' || before === o.program) { drop.push({ id: o.id, why: 'diff' }); continue; } }
  const nk = o.request.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); if (seenReq.has(nk)) { drop.push({ id: o.id, why: 'duplicate request' }); continue; } seenReq.add(nk);
  const kind = o.task === 'edit' ? 'edit' : o.method === 'hand-ask' ? 'ask' : o.method === 'hand-oos' ? 'oos' : 'create';
  const r = { id: 'h2-' + sha(o.request + o.program).slice(0, 10), task: o.task, request: o.request, ...(before ? { program_before: before, before } : {}), program: o.program, source: 'heldout2', meta: { style: o.style, domain: o.domain, kind, tokens: t, ...(o.oos ? { oos: o.oos } : {}), language_commit: LANG_COMMIT } };
  rows.push(r);
}
writeFileSync(new URL('../heldout2.jsonl', import.meta.url).pathname, rows.map(r => JSON.stringify(r)).join('\n') + '\n');
const c = {}; for (const r of rows) c[r.meta.kind] = (c[r.meta.kind] || 0) + 1;
console.log(JSON.stringify({ total: rows.length, kinds: c, dropped: drop }));
