// Builds failhunt/cases.jsonl: creates from src/creates_*.txt (deduped against data-v31/v3.1.jsonl) and update chains.
// Deterministic (seeded). node tools/make_cases.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
const H = new URL('..', import.meta.url).pathname;
const TRAIN = '/home/oye/Documents/free_work/molde-model/data-v31/v3.1.jsonl';
const norm = s => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
const trainSets = []; const trainExact = new Map();
for (const l of readFileSync(TRAIN, 'utf8').split('\n')) {
  if (!l) continue; const r = JSON.parse(l); const req = String(r.request || '').split('\nQuestion:')[0];
  const w = norm(req); const k = w.join(' '); trainSets.push([new Set(w), k, req]); trainExact.set(k, req);
}
const jac = (a, b) => { let i = 0; for (const x of a) if (b.has(x)) i++; return i / (a.size + b.size - i || 1); };
const nearest = req => {
  const w = norm(req), s = new Set(w), k = w.join(' ');
  if (trainExact.has(k)) return { sim: 1, exact: true, train: trainExact.get(k) };
  let best = 0, bt = ''; for (const [ts, , r] of trainSets) { if (!ts.size) continue; const j = jac(s, ts); if (j > best) { best = j; bt = r; } }
  return { sim: +best.toFixed(2), exact: false, train: bt };
};
// ---- creates
const creates = []; const dropped = [];
for (const f of readdirSync(H + 'src').filter(f => /^creates_.*\.txt$/.test(f)).sort()) {
  for (const l of readFileSync(H + 'src/' + f, 'utf8').split('\n')) {
    if (!l.trim()) continue; const [style, cat, request, needs] = l.split('|');
    const nn = nearest(request);
    const thr = norm(request).length <= 2 ? 0.99 : 0.75;      // very short prompts: only an exact match is a duplicate
    if (nn.exact || nn.sim >= thr) { dropped.push({ request, sim: nn.sim, train: nn.train }); continue; }
    creates.push({ type: 'create', style, cat, request, needs: needs.split(' ').filter(Boolean), nearest_train_sim: nn.sim });
  }
}
// dedupe inside the set
const seen = new Set(); const uniq = [];
for (const c of creates) { const k = norm(c.request).join(' '); if (seen.has(k)) continue; seen.add(k); uniq.push(c); }
uniq.forEach((c, i) => { c.id = 'c' + String(i + 1).padStart(3, '0'); });
// ---- chains
let seed = 20261126; const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const pick = a => a[Math.floor(rnd() * a.length)];
const COL = ['green', 'purple', 'blue', 'orange', 'pink', 'red', 'teal', 'yellow'];
const TITLES = ['My Daily Log', 'Home Hub', 'Daily Habits', 'Shop Book', 'Study Buddy', 'Family Plan', 'Weekly Check', 'Little Ledger'];
const BTNX = ['New entry', 'Add item', 'Save it', 'Log it', 'Add now', 'Create'];
const FIELDS = [['note', 'add a note field'], ['notes', 'i also want to record notes'], ['rating', 'add a rating from 1 to 5'], ['location', 'add location to each entry'], ['priority', 'can you add a priority'], ['tag', 'add a tag field'], ['due', 'add a due date'], ['photo', 'add a photo to each one'], ['category', 'add a category for each entry'], ['amount', 'add an amount field']];
const OPTS = ['Other', 'Cash', 'Weekly', 'Urgent', 'Snacks', 'Maybe', 'Gym', 'Online'];
const RENX = ['details', 'label', 'what', 'item_name', 'info'];
const STEPS = {
  theme: () => { const c = pick(COL); return { k: 'theme', route: 'direct', color: c, request: pick([`make it ${c}`, `change the colour to ${c}`, `i want a ${c} theme`, `${c} please`]) }; },
  dark: () => ({ k: 'dark', route: 'direct', request: pick(['dark mode', 'make it dark', 'use a dark theme', 'night mode please']) }),
  title: () => { const t = pick(TITLES); return { k: 'title', route: 'direct', to: t, request: pick([`call it ${t}`, `rename the app to ${t}`, `change the title to ${t}`]) }; },
  size: () => ({ k: 'size', route: 'direct', request: pick(['make the text bigger', 'bigger text please', 'make everything a bit smaller']) }),
  btn: () => { const x = pick(BTNX); return { k: 'btn', to: x, request: pick(['rename the {BTN} button to X', 'change the {BTN} button to say X', 'the {BTN} button should say X']).replace('X', x) }; },
  addfield: () => { const [f, r] = pick(FIELDS); return { k: 'addfield', word: f, request: r }; },
  addoption: () => { const o = pick(OPTS); return { k: 'addoption', word: o, request: pick([`add ${o} as an option`, `add ${o} to the choices`, `also let me pick ${o}`]) }; },
  remove: () => { const w = pick(['chart', 'chart', 'list', 'stat', 'goal']); const r = { chart: ['remove the chart', "i don't need the chart", 'get rid of the graph'], list: ['remove the list at the bottom', 'hide the history list'], stat: ['remove the totals', 'delete the big numbers at the top'], goal: ['remove the goal'] }[w]; return { k: 'remove', what: w, request: pick(r) }; },
  reorder: () => { const [a, b, r] = pick([['form', 'list', 'put the add form at the top'], ['form', 'list', 'show the form above the list'], ['chart', 'list', 'put the chart above the list'], ['stat', 'form', 'move the totals to the top'], ['list', 'chart', 'put the list above the chart']]); return { k: 'reorder', a, b, request: r }; },
  addchart: () => ({ k: 'addchart', request: pick(['add a bar chart of this week', 'add a chart showing the last 7 days', 'show a trend line', 'add a heat map of the month', 'i want to see a graph']) }),
  goalnum: () => { const n = pick([500, 1500, 3000, 4000, 8000, 25000, 60000]); return { k: 'goalnum', n, route: 'maybe-direct', request: pick([`change the goal to ${n}`, `set the target to ${n}`, `make my goal ${n}`, `i want to aim for ${n} instead`]) }; },
  addstat: () => ({ k: 'addstat', request: pick(['add a stat for the total', 'show the average too', 'add a count of entries this week', 'show the highest one']) }),
  sections: () => ({ k: 'sections', request: pick(['split it into sections', 'group things into sections with titles', 'organise this with section headings']) }),
  undo: () => ({ k: 'undo', request: pick(['undo that', 'go back to how it was', 'undo the last change']) }),
  vague: () => ({ k: 'vague', request: pick(['make it nicer', 'make it simpler', 'make it look more professional', 'make it more fun', 'clean it up', 'improve it', 'this is too busy']) }),
  refuse: () => ({ k: 'refuse', request: pick(['email me a report every week', 'sync this with google drive', 'add a password lock', 'delete everything and start fresh', 'connect it to my bank', 'make it work for 3 people at once', 'send a whatsapp when i miss a day']) }),
  renamefield: () => { const x = pick(RENX); return { k: 'renamefield', to: x, request: `rename {FIELD} to ${x}` }; },
};
const WEIGHT = { theme: 1, dark: 1, title: 1, size: 0.5, btn: 2, addfield: 3, addoption: 2, remove: 2.5, reorder: 2, addchart: 2, goalnum: 1.5, addstat: 2, sections: 1.2, undo: 1.2, vague: 2, refuse: 1.5, renamefield: 1.2 };
const bag = []; for (const [k, w] of Object.entries(WEIGHT)) for (let i = 0; i < Math.round(w * 4); i++) bag.push(k);
const mkSteps = n => { const used = new Set(); const out = []; while (out.length < n) { const k = pick(bag); if (used.has(k) && rnd() < 0.8) continue; if (k === 'undo' && !out.length) continue; used.add(k); out.push(STEPS[k]()); } return out; };
// seed apps: well-formed requests that Gemma is likely to build (the chain starts from the program the model itself wrote for the same create case)
const seedPool = uniq.filter(c => ['medium', 'long', 'mixed', 'roman'].includes(c.style) && !['unsupported', 'vague'].includes(c.cat));
const chains = []; const take = [...seedPool];
for (let i = take.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [take[i], take[j]] = [take[j], take[i]]; }
const nModel = 120;
for (let i = 0; i < nModel; i++) chains.push({ type: 'chain', id: 'h' + String(i + 1).padStart(3, '0'), seed: { from_create: take[i].id, request: take[i].request }, steps: mkSteps(3 + Math.floor(rnd() * 4)) });
const longs = readdirSync(H + 'data/long').filter(f => f.endsWith('.mo'));
let li = 0; for (const f of longs) for (let r = 0; r < 4 && li < 28; r++, li++) chains.push({ type: 'chain', id: 'L' + String(li + 1).padStart(3, '0'), seed: { long_file: 'data/long/' + f }, long: true, steps: mkSteps(3 + Math.floor(rnd() * 4)) });
const out = [...uniq, ...chains].map(x => JSON.stringify(x)).join('\n') + '\n';
writeFileSync(H + 'cases.jsonl', out);
writeFileSync(H + 'cases.dropped_as_duplicates.json', JSON.stringify(dropped, null, 1));
const sha = createHash('sha256').update(out).digest('hex'); writeFileSync(H + 'cases.sha256', sha + '  cases.jsonl\n');
const by = {}; uniq.forEach(c => by[c.style] = (by[c.style] || 0) + 1);
console.log({ creates: uniq.length, dropped: dropped.length, chains: chains.length, steps: chains.reduce((a, c) => a + c.steps.length, 0), by, sha });
