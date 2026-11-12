// Deterministic lived-in demo data for the 5 fixtures. `d` = days before "now", h/m = time of day. Run: node kit/fixtures/gen-seeds.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
let s = 7; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const out = (name, o) => writeFileSync(join(here, name, 'seed.json'), JSON.stringify(o).replace(/\},\{/g, '},\n{').replace('"tables":{', '"tables":{\n') + '\n');

// habits: 6 habits x 60 days
const habits = [['Read 20 pages', 0.8], ['Walk 30 minutes', 0.62], ['Stretch', 0.5], ['No sugar in tea', 0.7], ['Drink 2 L of water', 0.75], ['Write in journal', 0.45]];
const check = [];
habits.forEach(([name, p], hi) => { for (let d = 59; d >= 0; d--) { let on = rnd() < p; if (hi === 0) on = d < 12 || (d > 12 && rnd() < 0.8); if (hi === 0 && d === 12) on = false; if (hi === 3 && d < 5) on = true; if (on) check.push({ d, h: 7 + hi, m: (d * 7) % 60, habit: String(hi + 1) }); } });
out('habits', { tables: { habit: habits.map(([name], i) => ({ d: 60, h: 8, m: i, habit: name })), check } });

// exercise: ~3 weeks, A/B split with progressive overload (weights and reps change from session to session)
const A = [['Bench press', 40, 8], ['Barbell row', 45, 10], ['Overhead press', 27.5, 8]], B = [['Squat', 60, 8], ['Deadlift', 80, 5], ['Leg press', 90, 12]];
const set = [], sessions = [[20, 'A'], [18, 'B'], [15, 'A'], [13, 'B'], [11, 'A'], [8, 'B'], [6, 'A'], [4, 'B'], [1, 'A'], [0, 'B']];
const seen = {};
sessions.forEach(([d, kind]) => { (kind === 'A' ? A : B).forEach(([ex, kg0, reps0], ei) => {
  const n = (seen[ex] = (seen[ex] || 0) + 1) - 1, step = ex === 'Deadlift' ? 5 : 2.5, kg = kg0 + step * Math.floor(n * 0.8);
  const sets = n % 2 === 0 ? [reps0, reps0 - 1, reps0 - 1] : [reps0 + 1, reps0, reps0 - 2];
  sets.forEach((reps, k) => set.push({ d, h: 17, m: ei * 12 + k * 3, exercise: ex, kg: k === 2 && n % 3 === 1 ? kg - step : kg, reps: Math.max(4, reps + (rnd() < 0.3 ? 1 : 0)) }));
}); });
out('exercise', { tables: { set } });

// water: 7 days
const cup = []; [[6, 7], [5, 8], [4, 6], [3, 9], [2, 7], [1, 8], [0, 5]].forEach(([d, n]) => { const hrs = [7, 9, 11, 13, 15, 17, 19, 21, 22]; for (let i = 0; i < n; i++) cup.push({ d, h: hrs[i], m: (i * 13) % 50, volume: i % 3 === 2 ? 500 : 250 }); });
out('water', { tables: { cup }, kv: { goal: 2000 } });

// journal: 14 entries incl. Urdu and Roman Urdu
const E = [[0, 8, 20, 'good', 'Quiet morning, chai on the balcony before work.'], [0, 7, 5, 'great', 'آج صبح کی سیر بہت اچھی رہی، دل ہلکا ہو گیا۔'], [1, 21, 15, 'great', 'Called my sister. We planned the trip north for March.'], [1, 13, 40, 'okay', 'Aaj office mein kaam bohat tha, lunch bhi late kiya.'],
  [2, 19, 45, 'good', 'Cooked dinner with Amna. The daal came out right for once.'], [3, 22, 0, 'low', 'Neend nahi aayi, shaam ko chai zyada pi li thi.'], [4, 20, 10, 'good', 'Finished the quarterly report early and walked home through the park.'],
  [5, 12, 30, 'okay', 'میٹنگ لمبی ہو گئی اور دوپہر کا کھانا رہ گیا۔'], [6, 18, 20, 'great', 'Abbu ke saath bazaar gaya, unhone naye jootay dilaye.'], [8, 21, 0, 'awful', 'Bad day. Missed the bus, spilled tea on my notes, and the printer jammed twice.'],
  [9, 9, 10, 'okay', 'Slow start. Answered emails until ten.'], [11, 20, 30, 'good', 'ماں کے ہاتھ کی کھچڑی کھائی، بچپن یاد آ گیا۔'], [13, 17, 15, 'low', 'Ghar ki yaad aa rahi thi, phone par ammi se baat ki.'], [15, 19, 0, 'good', 'Long walk after Maghrib. Legs sore but the head is clear.']].map(([d, h, m, mood, note]) => ({ d, h, m, mood, note }));
out('journal', { tables: { entry: E } });

// budget: 45 days, varied descriptions and categories, one refund
const shops = { Food: [['Groceries at Imtiaz', 2400, 7800], ['Fruit and vegetables', 350, 1400], ['Chai and samosas', 150, 650], ['Lunch at the office canteen', 300, 700], ['Bakery', 220, 900]], Travel: [['Petrol', 2500, 5200], ['Rickshaw', 250, 900], ['Careem to the airport', 1400, 2600]], Fun: [['Dinner out', 1800, 4600], ['Cinema tickets', 1200, 2600], ['Book from the bazaar', 600, 1800]], Health: [['Pharmacy', 380, 2900], ['Doctor visit', 1500, 3000]], Bills: [['Phone top-up', 500, 1500], ['Gas bill', 1100, 2800]] };
const pr = { Food: 0.9, Travel: 0.42, Fun: 0.16, Health: 0.1, Bills: 0.05 };
const spend = [{ d: 40, h: 19, m: 10, description: 'Electricity bill', amount: 8400, category: 'Bills' }, { d: 14, h: 18, m: 5, description: 'Electricity bill', amount: 9150, category: 'Bills' }, { d: 12, h: 10, m: 30, description: 'Internet bill', amount: 3500, category: 'Bills' }, { d: 9, h: 15, m: 0, description: 'Refund: shoes (wrong size)', amount: -2800, category: 'Fun' }, { d: 10, h: 16, m: 20, description: 'Running shoes', amount: 7200, category: 'Fun' }];
for (let d = 44; d >= 0; d--) for (const [cat, list] of Object.entries(shops)) if (rnd() < pr[cat] * 0.55) { const [desc, lo, hi] = pick(list); spend.push({ d, h: 8 + Math.floor(rnd() * 12), m: Math.floor(rnd() * 60), description: desc, amount: Math.round((lo + rnd() * (hi - lo)) / 10) * 10, category: cat }); }
out('budget', { tables: { spend }, kv: { budget: 80000 } });
console.log('habit checks', check.length, 'sets', set.length, 'cups', cup.length, 'journal', E.length, 'spend', spend.length);
