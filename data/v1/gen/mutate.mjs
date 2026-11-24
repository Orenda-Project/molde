// program-first variants: safe text transformations of the corpus + examples (never held-out ones)
import { readFileSync, readdirSync } from 'node:fs';
import { LANG, HELD, rng, canon, diff, cap, sha } from './lib.mjs';
import { typo, THEMES, THEME_WORDS } from './frame.mjs';

const REQ = process.env.REQS || '/home/oye/Documents/free_work/molde-design/archive-2026-11-23/requests-en/requests.jsonl';
const reqs = {}; for (const l of readFileSync(REQ, 'utf8').split('\n')) if (l.trim()) { const j = JSON.parse(l); reqs[j.id] = j; }
const ROMAN = /\b(karna|karni|rozana|hai|hain|mujhe|chahiye|chahiye|ka|ke|ki|kar|bhi|nahi|paisa|paise|hisaab|hisab|kitab|mera|meri|mere|dukan|ghar|bachon|namaz|kharcha|kharch|liye|wala|wali|roz|aur|sab|kitne|kitna)\b/i;
const HELD_EX = new Set(['09-add-search', '12-change-quick', '14-remove-view', '19-add-per-row-total']);
export function seeds() {
  const out = [];
  for (const f of readdirSync(LANG + '/corpus').filter(f => /^e\d+\.mo$/.test(f)).sort()) {
    const id = f.slice(0, -3); if (HELD.has(id) || !reqs[id]) continue;
    if (ROMAN.test(reqs[id].text)) continue;
    out.push({ id, program: readFileSync(LANG + '/corpus/' + f, 'utf8'), request: reqs[id].text, style: reqs[id].style, domain: reqs[id].domain });
  }
  const er = JSON.parse(readFileSync(new URL('/tmp/molde-p2/train/data/example_requests.json', import.meta.url), 'utf8'));
  for (const f of readdirSync(LANG + '/examples').filter(f => f.endsWith('.mo')).sort()) out.push({ id: 'x' + f.slice(0, -3), program: readFileSync(LANG + '/examples/' + f, 'utf8'), request: er[f], style: 'detailed', domain: 'example' });
  return out;
}
const hasColor = t => /\b(blue|green|purple|pink|dark|black|grey|gray|red|orange|colou?r|theme)\b/i.test(t);
const TH = [w => `Make it ${w}.`, w => `I want it ${w}.`, w => `Use a ${w} look.`, w => `Colour: ${w}.`, w => `${cap(w)} theme please.`];
const sentence = (req, add, r) => { const base = req.replace(/[\s.]+$/, ''); return r.chance(0.5) ? `${base}. ${add}` : `${base}, ${add.charAt(0).toLowerCase() + add.slice(1)}`; };
const lines = p => p.replace(/\n$/, '').split('\n');

export function mutateCreate(seed, n) {
  const r = rng('mut' + seed.id + n);
  const L = lines(seed.program), head = L[0].match(/^app "([^"]*)"( \w+)?( \w+)?$/);
  if (!head) return null;
  const opts = [];
  if (head[3] && !hasColor(seed.request)) opts.push('theme');
  if (!/call it|named|name/i.test(seed.request)) opts.push('name');
  if (L.some(l => /^quick \w+, \w+, \[/.test(l))) opts.push('quick');
  if (L.some(l => /^setting \w+ (num|money) = \d+ "/.test(l)) ) opts.push('goal');
  if (!opts.length) return null;
  const k = r.pick(opts);
  let prog = L.slice(), add;
  if (k === 'theme') { const t = r.pick(THEMES.filter(x => x !== head[3].trim())); prog[0] = `app "${head[1]}"${head[2] || ''} ${t}`; add = r.pick(TH)(r.pick(THEME_WORDS[t])); }
  else if (k === 'name') { const nn = r.pick([`My ${head[1]}`, `${head[1]} Buddy`, `Daily ${head[1]}`, `${head[1]} Pro`, `${head[1]} Plus`]); prog[0] = `app "${nn}"${head[2] || ''}${head[3] || ''}`; add = r.pick([`Call it ${nn}.`, `Name the app "${nn}".`, `I want to call it ${nn}.`]); }
  else if (k === 'quick') {
    const i = prog.findIndex(l => /^quick \w+, \w+, \[/.test(l));
    const m = prog[i].match(/^(quick \w+, \w+, )\[([^\]]*)\]$/); const vals = m[2].split(', ').map(Number);
    if (vals.some(isNaN)) return null;
    const f = r.pick([2, 3, 0.5, 4]); const nv = vals.map(v => Math.round(v * f * 10) / 10).filter((v, j, a) => v > 0 && a.indexOf(v) === j);
    if (nv.join() === vals.join()) return null;
    prog[i] = m[1] + '[' + nv.join(', ') + ']';
    const list = nv.length > 1 ? nv.slice(0, -1).join(', ') + ' and ' + nv[nv.length - 1] : String(nv[0]);
    add = r.pick([`Quick buttons for ${list}.`, `Make the one-tap buttons ${list}.`, `I want buttons for ${list}.`]);
  } else {
    const i = prog.findIndex(l => /^setting \w+ (num|money) = \d+ "/.test(l));
    const m = prog[i].match(/^(setting \w+ (?:num|money) = )(\d+)( ".*)$/); const v = Number(m[2]);
    const nv = Math.round(v * r.pick([1.5, 2, 0.5, 3]) / 5) * 5 || v + 5; if (nv === v) return null;
    prog[i] = m[1] + nv + m[3];
    const lab = m[3].match(/"([^"]*)"/)[1];
    add = r.pick([`Set "${lab}" to ${nv}.`, `Start the ${lab.toLowerCase().replace(/ \(.*\)/, '')} at ${nv}.`, `Default ${lab.toLowerCase().replace(/ \(.*\)/, '')} ${nv}.`]);
  }
  const c = canon(prog.join('\n') + '\n'); if (!c.ok) return { err: c.errors };
  let req = sentence(seed.request, add, r); if (r.chance(0.1)) req = typo(req, r, 1);
  return { task: 'create', request: req, program: c.text, style: seed.style, domain: seed.domain, method: 'mutate:' + k, seed: seed.id };
}

const topTable = L => { for (const l of L) { const m = l.match(/^table (\w+)(?: was \w+)? (?:"[^"]*" )?(.*)$/); if (m) return { name: m[1], rest: m[2], i: L.indexOf(l) }; } };
export function mutateEdit(seed, n) {
  const r = rng('mute' + seed.id + n);
  const L = lines(seed.program), head = L[0].match(/^app "([^"]*)"( \w+)?( \w+)?$/);
  if (!head) return null;
  const hasScreen = L.some(l => /^screen /.test(l));
  const ops = ['theme', 'name', 'remind', 'remove'];
  if (!hasScreen) ops.push('chart', 'note', 'chart', 'note');
  if (L.some(l => /^quick \w+, \w+, \[/.test(l))) ops.push('quick');
  const k = r.pick(ops);
  let prog = L.slice(), req;
  const T = topTable(L);
  if (k === 'theme' && head[3]) { const t = r.pick(THEMES.filter(x => x !== head[3].trim())); prog[0] = `app "${head[1]}"${head[2] || ''} ${t}`; req = r.pick([`make it ${r.pick(THEME_WORDS[t])}`, `change the colour to ${r.pick(THEME_WORDS[t])}`, `${r.pick(THEME_WORDS[t])} theme please`]); }
  else if (k === 'name') { const nn = r.pick([`My ${head[1]}`, `${head[1]} Buddy`, `Daily ${head[1]}`, `${head[1]} Pro`]); prog[0] = `app "${nn}"${head[2] || ''}${head[3] || ''}`; req = r.pick([`rename the app to ${nn}`, `call it ${nn}`]); }
  else if (k === 'remind') {
    if (L.some(l => /^remind /.test(l))) return null;
    const R = r.pick([['remind "Time to check in" at 8:00', 'remind me every morning at 8'], ['remind "Time to check in" at 20:00', 'add a reminder at 8 pm'], ['remind "Time to check in" at 9:00', 'a daily reminder at 9 in the morning'], ['remind "Do not forget to log" at 21:00', 'remind me at 9 every night']]);
    prog.push(R[0]); req = R[1];
  } else if (k === 'remove') {
    const ix = prog.map((l, i) => [l, i]).filter(([l]) => /^(daybars|heat|trend|quick|stat|ring|remind|calendar|share) /.test(l));
    if (!ix.length) return null;
    const [l, i] = r.pick(ix); const w = l.split(' ')[0];
    const names = { daybars: ['the bar chart', 'the weekly chart'], heat: ['the heat map'], trend: ['the line graph', 'the trend line'], quick: ['the quick buttons', 'the one-tap buttons'], stat: ['the big number at the top', 'one of the stats'], ring: ['the ring'], remind: ['the reminder'], calendar: ['the calendar'], share: ['the category bars'] };
    prog.splice(i, 1); req = r.pick([`remove ${r.pick(names[w])}`, `I do not need ${r.pick(names[w])}`, `take away ${r.pick(names[w])}`, `get rid of ${r.pick(names[w])}`]);
  } else if (k === 'quick') {
    const i = prog.findIndex(l => /^quick \w+, \w+, \[/.test(l)); const m = prog[i].match(/^(quick \w+, \w+, )\[([^\]]*)\]$/); const vals = m[2].split(', ').map(Number);
    if (vals.some(isNaN)) return null;
    const f = r.pick([2, 3, 0.5]); const nv = vals.map(v => Math.round(v * f * 10) / 10).filter((v, j, a) => v > 0 && a.indexOf(v) === j);
    if (nv.join() === vals.join()) return null; prog[i] = m[1] + '[' + nv.join(', ') + ']';
    req = `change the quick buttons to ${nv.length > 1 ? nv.slice(0, -1).join(', ') + ' and ' + nv[nv.length - 1] : nv[0]}`;
  } else if (k === 'note' && T) {
    if (/\b(note|memo)\b/.test(T.rest) || /\bwas\b/.test(T.rest)) return null;
    prog[T.i] = prog[T.i] + ', note text?'; req = r.pick([`add a note to each ${T.name.replace(/_/g, ' ')}`, 'let me write a note with every entry', 'add an optional note field']);
  } else if (k === 'chart' && T) {
    const nf = T.rest.match(/(?:^|, )(\w+) (num|money)\b/);
    if (L.some(l => /^daybars /.test(l))) return null;
    prog.push(nf ? `daybars last 7 days, sum(${T.name}.${nf[1]} on it)` : `daybars last 7 days, count(${T.name} on it)`);
    req = r.pick(['add a chart for the last 7 days', 'I want a weekly bar chart', 'show me a chart of the week']);
  } else return null;
  const before = canon(seed.program), after = canon(prog.join('\n') + '\n');
  if (!before.ok || !after.ok) return { err: (after.errors || []).slice(0, 2) };
  if (before.text === after.text) return null;
  const v = diff([before.text], after.text); if (v.verdict === 'refused') return { err: ['refused'] };
  const t = r.chance(0.1) ? typo(req, r, 1) : req;
  return { task: 'edit', request: t.charAt(0).toLowerCase() + t.slice(1), before: before.text, program: after.text, style: 'plain', domain: seed.domain, method: 'mutate-edit:' + k, seed: seed.id, verdict: v.verdict };
}
