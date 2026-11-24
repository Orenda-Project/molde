// re-verify v1 with the current language, build the item files the Haiku writers read
import { readFileSync, writeFileSync } from 'node:fs';
import { canon, verify, diff, sha, norm, rng, HELD, LANG, LANG_COMMIT, saveCache, migrateBatch } from '../../data-v1/gen/lib.mjs';
const { strip } = await import(LANG + '/format.mjs');
const { describe } = await import(LANG + '/describe.mjs');
const W = new URL('../work/', import.meta.url).pathname;
const IT = new URL('../items/', import.meta.url).pathname;
const v1 = readFileSync(new URL('../../data-v1/v1.jsonl', import.meta.url), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
const rows = [], drop = [];
const allp = v1.flatMap(r => r.program_before ? [r.program, r.program_before] : [r.program]);
const mig = migrateBatch(allp); const migMap = new Map(allp.map((t, i) => [t, mig[i]]));
for (const r0 of v1) {
  const r = { ...r0, program: migMap.get(r0.program), ...(r0.program_before ? { program_before: migMap.get(r0.program_before), before: migMap.get(r0.program_before) } : {}) };
  const p = canon(r.program); if (!p.ok) { drop.push({ id: r.id, why: p.errors[0] }); continue; }
  let b = null;
  if (r.task === 'edit') {
    const bc = canon(strip(canon(r.program_before).text || r.program_before)); if (!bc.ok) { drop.push({ id: r.id, why: 'before' }); continue; }
    b = bc.text;
  }
  const v = verify(p.text, b ? [b] : null); if (!v.ok) { drop.push({ id: r.id, why: v.why }); continue; }
  if (b) { const d = diff([b], p.text); if (d.verdict === 'refused' || b === p.text) { drop.push({ id: r.id, why: 'diff' }); continue; } }
  rows.push({ ...r, program: p.text, program_before: b || undefined, before: b || undefined });
}
saveCache();
writeFileSync(W + 'v1.r4.jsonl', rows.map(r => JSON.stringify(r)).join('\n') + '\n');
// items
const PERSONS = ['a shopkeeper', 'a university student', 'a busy mom', 'a taxi driver', 'a nurse', 'a school teacher', 'a farmer', 'a retired uncle', 'a freelance designer', 'a gym trainer', 'a teenager', 'a bank clerk', 'a baker', 'a call-centre agent', 'a hostel student', 'a tailor', 'a cricket coach', 'a new dad', 'a pharmacist', 'an electrician', 'a software developer', 'a housewife', 'a shop assistant', 'a delivery rider', 'an imam', 'a wedding planner'];
const TONES = ['polite', 'blunt', 'chatty', 'worried', 'cheerful', 'tired', 'in a hurry', 'curious', 'matter-of-fact', 'a bit confused'];
const HURRY = ['all lowercase, no punctuation, 2 to 8 words', 'lowercase with one or two typos, 3 to 10 words', 'terse like a search query, 2 to 6 words', 'a short question, 4 to 10 words', 'a single sentence of 6 to 12 words, casual', 'lowercase, abbreviations like pls/txt/mins, 3 to 9 words'];
const FULL = ['two sentences, 20 to 35 words', 'one long sentence of 18 to 30 words', 'three short sentences, 20 to 40 words', 'a sentence then a list of what is wanted, 20 to 35 words', 'chatty with a reason why the person needs it, 22 to 38 words', 'one sentence of 14 to 22 words, mentions the most special feature first'];
const ORDER = ['start with the most unusual feature', 'start with the problem or reason', 'start with who it is for', 'mention the last feature first', 'start with the numbers or units', 'mention the screen layout first if there is one'];
function hint(id) { const r = rng('v2hint' + id); return { persona: r.pick(PERSONS), tone: r.pick(TONES), hurried_style: r.pick(HURRY), fuller_style: r.pick(FULL), order: r.pick(ORDER) }; }
const items = { c: [], e: [], a: [], o: [] }; const seen = new Set();
const addC = (prog, src) => { const k = sha(prog); if (seen.has(k)) return; seen.add(k); items.c.push({ id: 'c' + k, kind: 'create', program: prog, describe: describe(prog), ...hint(k), src }); };
for (const r of rows) {
  if (r.task === 'create' && r.meta.style === 'ask') { const k = sha(r.program); if (!seen.has('a' + k)) { seen.add('a' + k); items.a.push({ id: 'a' + k, kind: 'ask', program: r.program, ...hint(k) }); } }
  else if (r.task === 'create' && r.meta.oos) { const k = sha(r.program + r.meta.oos + r.request); items.o.push({ id: 'o' + k, kind: 'oos', oos_kind: r.meta.oos, program: r.program, describe: describe(r.program), ...hint(k), src: r.source }); }
  else if (r.task === 'create') addC(r.program, r.source);
}
for (const r of rows) if (r.task === 'edit') { addC(r.program_before, 'before:' + r.source); addC(r.program, 'after:' + r.source); const k = sha(r.program_before + '\0' + r.program); const d = diff([r.program_before], r.program); items.e.push({ id: 'e' + k, kind: 'edit', before: r.program_before, after: r.program, changes: (d.changes || []).slice(0, 8), ...hint(k), src: r.source }); }
const shuf = (a, s) => { const r = rng(s); return r.shuffle(a); };
const out = {};
{ // choose ~3300 create programs: all hand + mutate families, a sample of template families
  const fam = x => { const f = x.src.split(':'); return f[0] === 'before' || f[0] === 'after' ? f[0] + ':' + f[1] : f[0]; };
  const quota = { template: 1300, 'before:edit-template': 150, 'after:edit-template': 150 };
  const cnt = {}; const keep = [];
  for (const x of shuf(items.c, 'selc')) { const f = fam(x); cnt[f] = (cnt[f] || 0) + 1; if (quota[f] !== undefined && cnt[f] > quota[f]) continue; keep.push(x); }
  items.c = keep;
}
for (const [k, list] of Object.entries(items)) {
  const L = shuf(list, 'shuf' + k); const per = k === 'a' ? 40 : 50;
  for (let i = 0; i * per < L.length; i++) writeFileSync(`${IT}in-${k}-${String(i).padStart(3, '0')}.jsonl`, L.slice(i * per, (i + 1) * per).map(x => JSON.stringify(x)).join('\n') + '\n');
  out[k] = { items: L.length, files: Math.ceil(L.length / per) };
}
console.log(JSON.stringify({ language_commit: LANG_COMMIT, v1_in: v1.length, kept: rows.length, dropped: drop.length, dropSample: drop.slice(0, 3), items: out }));
