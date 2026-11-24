// re-run a jsonl through migrate(format)+check+eval+diff with the current language; write FILE.r3.jsonl and a drop log
import { readFileSync, writeFileSync } from 'node:fs';
import { canon, verify, diff, saveCache, LANG_COMMIT } from './lib.mjs';
import { tokenCounts } from './tokcount.mjs';
const f = process.argv[2];
const rows = readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
const keep = [], drop = [];
for (const r of rows) {
  const p = canon(r.program), b = r.program_before ? canon(r.program_before) : { ok: true };
  if (!p.ok || !b.ok) { drop.push({ id: r.id, why: (p.errors || b.errors)[0] }); continue; }
  const o = { ...r, program: p.text }; if (r.program_before) { o.program_before = b.text; o.before = b.text; }
  const v = verify(o.program, o.program_before ? [o.program_before] : null);
  if (!v.ok) { drop.push({ id: r.id, why: v.why }); continue; }
  if (o.program_before) { const d = diff([o.program_before], o.program); if (d.verdict === 'refused' || o.program_before === o.program) { drop.push({ id: r.id, why: 'diff' }); continue; } }
  keep.push(o);
}
const tc = tokenCounts(keep.flatMap(r => r.program_before ? [r.program, r.program_before] : [r.program]));
let i = 0; const out = [];
for (const r of keep) { const t = tc[i++], tb = r.program_before ? tc[i++] : 0; if (t > 400 || tb > 400) { drop.push({ id: r.id, why: 'tokens' }); continue; } r.meta = { ...r.meta, tokens: t, ...(tb ? { tokens_before: tb } : {}), language_commit: LANG_COMMIT }; out.push(r); }
writeFileSync(f.replace(/\.jsonl$/, '.r3.jsonl'), out.map(r => JSON.stringify(r)).join('\n') + '\n');
writeFileSync(f.replace(/\.jsonl$/, '.r3.drops.json'), JSON.stringify(drop, null, 1));
saveCache();
console.log(JSON.stringify({ language_commit: LANG_COMMIT, in: rows.length, kept: out.length, dropped: drop.length }));
