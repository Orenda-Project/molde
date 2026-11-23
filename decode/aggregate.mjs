// Builds the results table (markdown) and the example blocks from decode/results/*.
//   node aggregate.mjs table | examples
import { readFileSync, existsSync, readdirSync } from 'node:fs';
const R = new URL('./results/', import.meta.url).pathname;
const load = t => existsSync(`${R}${t}.summary.json`) ? JSON.parse(readFileSync(`${R}${t}.summary.json`, 'utf8')) : null;
const rows = f => readFileSync(`${R}${f}`, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
const NAME = { A: 'A static grammar, one call (chat template, as r1 report)', Atok: 'A2 as A, real special-token ids', B: 'B lines + static grammar + resample', C: 'C lines + name grammar', D: 'D = C + resample', E: 'E = D + type filters (extra)' };
const pct = v => (100 * v).toFixed(1) + '%';
const mode = process.argv[2];
if (mode === 'table') {
  const out = ['| arm | quant | set | n | checker pass | intent score | intent auto | median lines (ref) | median s/app | median tok/s | median calls | one-line progs | first-error classes |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|'];
  for (const set of ['real', 'templ']) for (const q of ['Q8_0', 'Q4_K_M']) for (const arm of ['A', 'Atok', 'B', 'C', 'D', 'E']) {
    const s = load(`${arm}_${q}_${set}`); if (!s) continue;
    out.push(`| ${NAME[arm]} | ${q} | ${set === 'real' ? 'real wording' : 'templated'} | ${s.n} | ${pct(s.pass)} | ${s.intent_score} | ${pct(s.intent_auto)} | ${s.median_lines} (${s.median_ref_lines}) | ${s.median_s_per_app} | ${s.median_tok_s} | ${s.median_calls} | ${s.one_line_programs} | ${Object.entries(s.errors_first).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k.replace('E_', '')}:${v}`).join(' ')} |`);
  }
  console.log(out.join('\n'));
}
if (mode === 'examples') {
  const q = process.argv[3] || 'Q8_0';
  const A = rows(`A_${q}_real.scored.jsonl`), D = rows(`D_${q}_real.scored.jsonl`);
  const byId = new Map(D.map(x => [x.id, x]));
  const picks = A.filter(a => !a.pass_raw && byId.get(a.id).pass_raw && (byId.get(a.id).lines > 3)).slice(0, 6);
  const still = A.filter(a => !a.pass_raw && !byId.get(a.id).pass_raw).slice(0, 2);
  for (const a of [...picks, ...still]) {
    const d = byId.get(a.id);
    console.log(`#### ${a.id}\n\nRequest: ${a.request.slice(0, 300)}\n\nArm A (fails: \`${(a.err_first || '').slice(0, 200)}\`):\n\n\`\`\`\n${a.output.trimEnd()}\n\`\`\`\n\nArm D (${d.pass_raw ? 'passes' : 'fails: `' + (d.err_first || '').slice(0, 200) + '`'}, intent ${d.score}):\n\n\`\`\`\n${d.output.trimEnd()}\n\`\`\`\n`);
  }
}
