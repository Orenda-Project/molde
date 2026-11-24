// independent verifier: node verify.mjs FILE.jsonl  -> writes FILE.verify.md and prints a summary
import { readFileSync, writeFileSync } from 'node:fs';
import { verify, diff, norm, sha, LANG_COMMIT } from '../../data-v1/gen/lib.mjs';
import { tokenCounts } from '../../data-v1/gen/tokcount.mjs';
const file = process.argv[2];
const rows = readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
const fails = [], res = { language_commit: LANG_COMMIT, total: rows.length, pass: 0, check_eval_fail: 0, tokens_over: 0, diff_refused: 0, bad_request: 0, dup_request: 0, dup_edit_pair: 0, edit_before_equals_after: 0, missing_fields: 0 };
const tc = tokenCounts([...new Set(rows.flatMap(r => r.program_before ? [r.program, r.program_before] : [r.program]))]);
const tm = new Map([...new Set(rows.flatMap(r => r.program_before ? [r.program, r.program_before] : [r.program]))].map((p, i) => [p, tc[i]]));
const seenReq = new Set(), seenEdit = new Set();
const toks = [];
for (const r of rows) {
  let bad = null;
  if (!r.id || !r.task || !r.request || !r.program || !r.source || !r.meta || (r.task === 'edit' && !r.program_before)) { res.missing_fields++; bad = 'missing fields'; }
  else {
    const v = verify(r.program, r.program_before ? [r.program_before] : null); const vb = r.program_before ? verify(r.program_before) : { ok: true };
    if (!v.ok || !vb.ok) { res.check_eval_fail++; bad = (v.why || vb.why); }
    else if (tm.get(r.program) > 400 || (r.program_before && tm.get(r.program_before) > 400)) { res.tokens_over++; bad = 'tokens'; }
    else if (r.task === 'edit') {
      const d = diff([r.program_before], r.program);
      if (d.verdict === 'refused') { res.diff_refused++; bad = 'diff refused'; }
      else if (r.program_before === r.program) { res.edit_before_equals_after++; bad = 'no-op edit'; }
      const k = sha(r.program_before + '\0' + r.program + '\0' + norm(r.request)); if (seenEdit.has(k)) { res.dup_edit_pair++; bad = bad || 'dup edit pair'; } seenEdit.add(k);
    }
    if (!/^[\x20-\x7e\n]*$/.test(r.request) || r.request.length < 3 || r.request.length > 600) { res.bad_request++; bad = bad || 'request not plain English ascii'; }
    const nr = norm(r.request); if (seenReq.has(nr)) { res.dup_request++; bad = bad || 'dup request'; } seenReq.add(nr);
  }
  if (bad) fails.push({ id: r.id, why: bad }); else { res.pass++; toks.push(tm.get(r.program)); }
}
// cross-check a sample with the real CLI (mo.mjs check + format) in a fresh scratch dir
import { mkdtempSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { LANG } from '../../data-v1/gen/lib.mjs';
{
  const dir = mkdtempSync((process.env.SCRATCH || tmpdir()) + '/molde-verify-');
  const sample = rows.filter((_, i) => i % Math.max(1, Math.floor(rows.length / 150)) === 0).slice(0, 150);
  const files = sample.map((r, i) => { const p = `${dir}/${i}.mo`; writeFileSync(p, r.program); return p; });
  const c = spawnSync('node', [LANG + '/mo.mjs', 'check', ...files], { encoding: 'utf8' });
  const mg = spawnSync('node', [LANG + '/mo.mjs', 'migrate', ...files], { encoding: 'utf8' });
  res.cli_migrate_changed = (mg.stderr.match(/^migrated/gm) || []).length;
  res.cli_sample = sample.length; res.cli_check_errors = (c.stdout.match(/^ERRORS/gm) || []).length;
  let fmtDiff = 0; for (let i = 0; i < files.length; i++) { const f = spawnSync('node', [LANG + '/mo.mjs', 'format', files[i]], { encoding: 'utf8' }); if (f.stdout !== sample[i].program) fmtDiff++; }
  res.cli_format_mismatch = fmtDiff;
}
toks.sort((a, b) => a - b);
const q = p => toks[Math.floor((toks.length - 1) * p)];
res.pass_rate = +(res.pass / res.total).toFixed(4);
res.tokens = { n: toks.length, mean: +(toks.reduce((a, b) => a + b, 0) / toks.length).toFixed(1), median: q(.5), p90: q(.9), max: toks[toks.length - 1] };
const md = ['# Verifier report', '', `file: ${file}`, '', '```json', JSON.stringify(res, null, 1), '```', '', `failures: ${fails.length}`, ...fails.slice(0, 40).map(f => `- ${f.id}: ${f.why}`)].join('\n');
writeFileSync(file.replace(/\.jsonl$/, '.verify.md'), md + '\n');
console.log(JSON.stringify(res));
