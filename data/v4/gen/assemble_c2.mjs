// assemble_c2.mjs: append out/c2_rows.jsonl (edits computed by c2_edits.mjs) to v4.1.jsonl under data-v4/.lock
//   node gen/assemble_c2.mjs        (waits for the lock; other agents append too, so the base is re-read inside the lock)
import { readFileSync, writeFileSync, mkdirSync, rmdirSync, existsSync, appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { sha, norm } from '../../data-v1/gen/lib.mjs';
const { nearest, toks } = await import('../../data-v3/gen/simcheck.mjs');
const FH = '../failhunt/';
const rd = f => readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const LOCK = '.lock';
for (let i = 0; ; i++) { try { mkdirSync(LOCK); break; } catch (e) { if (e.code !== 'EEXIST') throw e; if (i > 360) throw new Error('lock held too long'); await sleep(5000); } }
try {
  const baseRows = rd('v4.1.jsonl'); const have = new Set(baseRows.map(r => r.id));
  const key = r => norm(r.request.replace(/\n/g, ' ')) + (r.task === 'edit' ? '|e|' + sha(r.program_before || '') : '|c');
  const baseKeys = new Set(baseRows.map(key));
  const log = {};
  let cur = rd('out/c2_rows.jsonl').filter(r => !have.has(r.id));
  { const seen = new Set(); const keep = []; for (const r of cur) { const k = key(r); if (seen.has(k) || baseKeys.has(k)) continue; seen.add(k); keep.push(r); } log.dup_requests = cur.length - keep.length; cur = keep; }
  const tmpf = 'out/_leak_tmp_c2.jsonl';
  for (let round = 0; round < 6; round++) {
    writeFileSync(tmpf, cur.map(r => JSON.stringify({ id: r.id, request: r.request, kind: r.task, before: r.program_before, program: r.program })).join('\n') + '\n');
    let outp = ''; try { outp = execFileSync('node', [FH + 'tools/leak_check.mjs', tmpf], { encoding: 'utf8', maxBuffer: 1 << 26 }); } catch (e) { outp = e.stdout || ''; }
    const ids = new Set([...outp.matchAll(/^LEAK \S+ (\S+) /gm)].map(m => m[1])); for (const m of outp.matchAll(/^LEAK base (\S+)/gm)) ids.add(m[1]);
    if (!ids.size) { log.leak_final = (outp.match(/(\d+) leaks/) || [])[1]; break; } log['leak_round_' + round] = ids.size; cur = cur.filter(r => !ids.has(r.id));
  }
  { const keep = []; let n = 0; for (const r of cur) { const w = toks(r.request).length; const m = nearest(r.request); if (m.sim >= (w <= 5 ? 0.6 : 0.75)) { n++; continue; } keep.push(r); } log.other_test_sets_dropped = n; cur = keep; }
  appendFileSync('v4.1.jsonl', cur.map(r => JSON.stringify(r)).join('\n') + '\n');
  writeFileSync('out/newc2.jsonl', cur.map(r => JSON.stringify(r)).join('\n') + '\n');
  const c = {}; for (const r of cur) c[r.class + (r.meta.long ? '/long' : '/short')] = (c[r.class + (r.meta.long ? '/long' : '/short')] || 0) + 1;
  writeFileSync('out/assemble_c2.json', JSON.stringify({ rows: cur.length, per_class: c, log }, null, 1));
  console.log(JSON.stringify({ rows: cur.length, per_class: c, log }));
} finally { rmdirSync(LOCK); }
