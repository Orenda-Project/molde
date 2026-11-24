// node gen/checkitems.mjs FILE.jsonl [--limit=500]   items: {id, program, needs:[3..6 strings], topic, domain, ...}
import { readFileSync } from 'node:fs';
import { verify, canon, sha } from '../../data-v1/gen/lib.mjs';
import { tokenCounts } from '../../data-v1/gen/tokcount.mjs';
const f = process.argv[2]; const limit = Number((process.argv.find(a => a.startsWith('--limit=')) || '--limit=500').slice(8));
const rows = readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
const tk = tokenCounts(rows.map(r => r.program));
const st = { n: rows.length, bad: 0, over: 0, badNeeds: 0, dupProg: 0, topbar: 0, chart: 0, stateui: 0, form: 0, lines: [] };
const seen = new Set(); const probs = [];
rows.forEach((r, i) => {
  const c = canon(r.program); const v = c.ok ? verify(c.text) : { ok: false, why: c.errors[0] };
  if (!v.ok || c.text !== r.program) { st.bad++; probs.push(`${r.id}: ${v.why || 'not canonical'}`); return; }
  if (tk[i] > limit) { st.over++; probs.push(`${r.id}: ${tk[i]} tokens`); }
  if (!Array.isArray(r.needs) || r.needs.length < 3 || r.needs.length > 6 || r.needs.some(x => typeof x !== 'string' || x.length < 8)) { st.badNeeds++; probs.push(`${r.id}: needs`); }
  const k = sha(r.program); if (seen.has(k)) { st.dupProg++; } seen.add(k);
  const P = r.program; if (/^topbar /m.test(P)) st.topbar++; if (/^\s*(goalbars|daybars|bars|trend|heat|daygrid|plot|share|weekdots)/m.test(P)) st.chart++; if (/^state |^draw|^\s+draw/m.test(P)) st.stateui++; if (/^form /m.test(P)) st.form++;
  st.lines.push(P.trim().split('\n').length);
});
st.lines.sort((a, b) => a - b); const med = st.lines[Math.floor(st.lines.length / 2)] || 0;
console.log(JSON.stringify({ ...st, lines: undefined, median_lines: med, share_topbar: +(st.topbar / st.n).toFixed(2), share_chart: +(st.chart / st.n).toFixed(2), share_stateui: +(st.stateui / st.n).toFixed(2), share_alwaysform: +(st.form / st.n).toFixed(2), distinct_programs: seen.size }));
probs.slice(0, 15).forEach(p => console.log(p));
process.exit(st.bad || st.over || st.badNeeds ? 1 : 0);
