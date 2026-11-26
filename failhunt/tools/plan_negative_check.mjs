import { readFileSync } from 'node:fs';
const { parsePlan, coverage } = await import('./plan_check.mjs');
const H=new URL('../', import.meta.url).pathname;
const r3=new Map(readFileSync(H+'results/gemma-r3.jsonl','utf8').trim().split('\n').map(l=>JSON.parse(l)).filter(r=>r.type==='create').map(r=>[r.request,r]));
const r4=new Map(readFileSync(H+'results/gemma-r4ep2.jsonl','utf8').trim().split('\n').map(l=>JSON.parse(l)).filter(r=>r.type==='create').map(r=>[r.request,r]));
for (const l of readFileSync(H+'spec/plans.jsonl','utf8').trim().split('\n')) {
  const p=JSON.parse(l); const plan=parsePlan(p.plan);
  const a=r3.get(p.request), b=r4.get(p.request);
  const f=r=>r? (r.ok? (coverage(plan,r.program).length? 'plan check FLAGS: '+coverage(plan,r.program).join(' | '):'plan check passes'):'checker fails') : 'request not in the test set';
  console.log(p.id, p.request.slice(0,40).padEnd(40),'| r3:',f(a),'| r4ep2:',f(b));
}
