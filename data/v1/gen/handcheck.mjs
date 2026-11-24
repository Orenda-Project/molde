// node gen/handcheck.mjs hand/FILE.txt  -> per-record result for one hand file (check, canonical, eval, tokens<=400, edit diff)
import { readFileSync } from 'node:fs';
import { canon, verify } from './lib.mjs';
import { tokenCounts } from './tokcount.mjs';
import { readHand } from './hand.mjs';
const only = process.argv[2];
const { out, fails } = readHand(only ? { only } : {});
const bad = fails.filter(f => !only || f.id.startsWith(only.split('/').pop()));
const mine = out.filter(o => !only || o.id.startsWith(only.split('/').pop()));
const tk = tokenCounts(mine.flatMap(o => o.before ? [o.program, o.before] : [o.program]));
let i = 0, over = 0, ev = 0;
for (const o of mine) { const t = tk[i++], tb = o.before ? tk[i++] : 0; const v = verify(o.program, o.before ? [o.before] : null); if (t > 400 || tb > 400) { over++; console.log('TOO LONG', o.id, t, tb); } if (!v.ok) { ev++; console.log('EVAL', o.id, v.why); } }
for (const f of bad) console.log('FAIL', f.id, '|', (f.request || '').slice(0, 60), '|', f.why);
console.log(`ok=${mine.length - over - ev} fail=${bad.length} over400=${over} evalfail=${ev}`);
