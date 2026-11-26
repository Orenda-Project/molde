import { readFileSync } from 'node:fs';
const { parsePlan, coverage } = await import('./plan_check.mjs');
const H=new URL('../', import.meta.url).pathname;
const r3=new Map(readFileSync(H+'results/gemma-r3.jsonl','utf8').trim().split('\n').map(l=>JSON.parse(l)).filter(r=>r.type==='create').map(r=>[r.request,r]));
const r4=new Map(readFileSync(H+'results/gemma-r4ep2.jsonl','utf8').trim().split('\n').map(l=>JSON.parse(l)).filter(r=>r.type==='create').map(r=>[r.request,r]));
// evidence only (not training data): plans written for five TEST requests, applied to what r3 and r4 ep2 built for them
const PLANS = [
  ['paani peene ka hisaab', '# need: field drink, field ml, goal, quick buttons, chart, list'],
  ['a mood diary where i pick how i feel', '# need: option happy/ok/sad/angry, field note, chart month, list'],
  ['daily petrol log with litres, price per litre, odometer and a calculated mileage per litre and monthly cost', '# need: field litres, field price, field odometer, mileage, total month, list'],
  ['sals report', '# need: field amount, total today, total month, chart, list'],
  ['live cricket scores from the internet', '# need: cannot internet, field runs, field wickets, list'],
];
for (const [req, pl] of PLANS) {
  const plan = parsePlan(pl); const a = r3.get(req), b = r4.get(req);
  const f = r => r ? (r.ok ? (coverage(plan, r.program).length ? 'plan check FLAGS: ' + coverage(plan, r.program).join(' | ') : 'plan check passes') : 'checker fails') : 'not in the test set';
  console.log(req.slice(0, 40).padEnd(40), '| r3:', f(a), '| r4ep2:', f(b));
}
