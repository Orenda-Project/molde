// Forced suite v2: the kinds the critic flagged (add option, rename button, remove totals/goal) rebuilt so they fit the app.
//  add option: only for a choice field whose option set is a known family, and the new option is one that belongs to that family (Sat after Mon..Fri, Before_meal after Fasting|After_meal|Bedtime ...).
//  rename button: the label occurs exactly once in the program (no "+1" twice, no label that is also a text line).
//  remove totals / goal: the program has exactly one number element (stat, statcard, goal, or a big total line), so the referent is unambiguous.
// Unaffected kinds (reorder, remove chart, remove list) keep their v1 steps and results.   node tools/make_forced_v2.mjs
import { readFileSync, writeFileSync } from 'node:fs';
const H = new URL('..', import.meta.url).pathname;
const APPJS = process.env.APPJS || '/tmp/molde-app/app/js';
const { check } = await import(`${APPJS}/vendor/lang/check.mjs`);
const P = await import('./preds.mjs');
let seed = 91; const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const pick = a => a[Math.floor(rnd() * a.length)];
const FAMILY = { 'Food|Bills|Travel|Fun|Health': 'Education', 'Food|Bills|Travel|Fun|Health|Other': 'Education', 'Food|Bills|Travel|Fun|Other': 'Education', 'SubhanAllah|Alhamdulillah|AllahuAkbar': 'Astaghfirullah', 'Mon|Tue|Wed|Thu|Fri': 'Sat', 'Mon|Tue|Wed|Thu|Fri|Sat': 'Sun', 'New|Packed|Shipped|Delivered': 'Cancelled', 'Low|Medium|High': 'Urgent', 'Low|Normal|High': 'Urgent', 'Morning|Afternoon|Evening': 'Night', 'Maths|English|Science|History|Art': 'Urdu', 'Maths|English|Science|Urdu|Islamiat|Other': 'Computer', 'Clothes|Papers|Tech|Toiletries': 'Medicine', 'Tech|Home|Clothes|Fun': 'Books', 'Action|Comedy|Drama|Horror|Family|Other': 'Romance', 'Stress|Sleep|Food|Screen|Weather|Unknown': 'Noise', 'Fever|Cough|Pain|Nausea|Fatigue|Other': 'Headache', 'Tea|Snack|Ride|Other': 'Lunch', 'Tea|Coffee': 'Juice', 'Vegetables|Dairy|Meat|Dry_goods|Other': 'Fruit', 'Home|Work|Other': 'School', 'Birthday|Anniversary': 'Graduation', 'Fasting|After_meal|Bedtime': 'Before_meal' };
const progs = readFileSync(H + 'results/gemma-r3.jsonl', 'utf8').trim().split('\n').map(l => JSON.parse(l)).filter(r => r.type === 'create' && r.ok && r.lines >= 4 && r.lines <= 30).map(r => ({ id: r.id, p: r.program })).sort(() => rnd() - 0.5);
const out = []; const used = {};
const okp = p => { try { return check(p).ok; } catch (e) { return false; } };
for (const { id, p } of progs) {
  const L = p.trimEnd().split('\n');
  // add option in context
  const tl = L.filter(l => /^table .*\bpick\b/.test(l)); const sets = tl.flatMap(l => [...l.matchAll(/\bpick ([A-Za-z_|]+)/g)].map(m => m[1])).filter(s => FAMILY[s]);
  if ((used.ao || 0) < 70 && sets.length === 1 && tl.length >= 1) { const o = FAMILY[sets[0]]; if (!p.includes(o)) { out.push({ type: 'edit1', id: `F2-ao-${id}`, before: p, step: { k: 'addoption', word: o, request: pick([`add ${o} as one more choice`, `let me pick ${o} as well`, `${o} should be in the list of choices too`]) } }); used.ao = (used.ao || 0) + 1; } }
  // rename a button with a unique label
  if ((used.bt || 0) < 40) { const ms = [...p.matchAll(/^\s*(?:form|topbar)\s+\w+,\s*"([^"]+)"/gm), ...p.matchAll(/^\s*button\s+"([^"]+)"/gm)]; const m = ms.length === 1 ? ms[0] : null; if (m && p.split('"' + m[1] + '"').length === 2 && !/^[+\-<>]/.test(m[1])) { const x = pick(['Add now', 'Save it', 'Log it', 'New one']); out.push({ type: 'edit1', id: `F2-bt-${id}`, before: p, step: { k: 'btn', old: m[1], to: x, request: pick([`rename the ${m[1]} button to ${x}`, `the ${m[1]} button should say ${x}`]) } }); used.bt = (used.bt || 0) + 1; } }
  // remove the only number element
  const nums = L.filter(l => (P.RX.stat.test(l) && !/^\s/.test(l)) || /^"[^"]*"\s+(sum|count|avg|last)\(.*\s(big|head)$/.test(l) || /^(sum|count|avg|last)\(.*\s(big|head)$/.test(l));
  if (nums.length === 1 && (used.rs || 0) < 45) { const line = nums[0]; const after = L.filter(l => l !== line).join('\n') + '\n'; const goal = /^\s*goal\b/.test(line); if (okp(after)) { out.push({ type: 'edit1', id: `F2-${goal ? 'rg' : 'rs'}-${id}`, before: p, step: { k: 'remove', what: goal ? 'goal' : 'stat', request: goal ? pick(['remove the goal', 'i do not want a goal bar']) : pick(['remove the number at the top', 'take away the total']) } }); used.rs = (used.rs || 0) + 1; } }
}
const v1 = readFileSync(H + 'controls/forced_cases.jsonl', 'utf8').trim().split('\n').map(l => JSON.parse(l));
const keep = v1.filter(c => c.id.startsWith('F-ro-') || c.id.startsWith('F-rm-') || c.id.startsWith('F-rl-'));
writeFileSync(H + 'controls/forced_v2_new_cases.jsonl', out.map(o => JSON.stringify(o)).join('\n') + '\n');
writeFileSync(H + 'controls/forced_v1_cases.jsonl', v1.map(o => JSON.stringify(o)).join('\n') + '\n');
writeFileSync(H + 'controls/forced_cases.jsonl', [...keep, ...out].map(o => JSON.stringify(o)).join('\n') + '\n');
const c = {}; for (const o of out) c[o.step.k + (o.step.what ? ':' + o.step.what : '')] = (c[o.step.k + (o.step.what ? ':' + o.step.what : '')] || 0) + 1; console.log('new', out.length, c, 'kept from v1', keep.length);
