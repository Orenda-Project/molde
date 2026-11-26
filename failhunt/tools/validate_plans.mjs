import { readFileSync } from 'node:fs';
const APPJS = process.env.APPJS || '/tmp/molde-app/app/js';
const { check } = await import(`${APPJS}/vendor/lang/check.mjs`);
const { parsePlan, coverage } = await import('./plan_check.mjs');
let bad = 0, n = 0;
for (const l of readFileSync(process.argv[2], 'utf8').trim().split('\n')) {
  const r = JSON.parse(l); if (!r.plan) continue; n++; const why = [];
  const plan = parsePlan(r.plan); if (!plan) why.push('plan line not parsed');
  const c = check(r.program); if (!c.ok) why.push('program: ' + String(c.errors[0]).slice(0, 120));
  if (plan && c.ok) { const m = coverage(plan, r.program); if (m.length) why.push('plan items not in program: ' + m.join(' | ')); }
  console.log(r.id, why.length ? 'PROBLEM ' + why.join(' ; ') : 'ok');
  if (why.length) bad++;
}
console.log(n, 'examples,', bad, 'problems');
