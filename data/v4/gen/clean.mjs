// v3.1 -> cleaned rows (DATA_SPEC_r5 section 2 + L4). deterministic (seeded)
import { readFileSync, writeFileSync } from 'node:fs';
import { rng, sha, norm } from '../../data-v1/gen/lib.mjs';
const rows = readFileSync('../data-v31/v3.1.jsonl', 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
const R = rng('v4clean');
const log = {}; const drop = (k, n = 1) => { log[k] = (log[k] || 0) + n; };
const isAsk = r => r.program.startsWith('ask ');
const title = r => ((r.program.match(/^app "([^"]*)"/) || [])[1] || '').toLowerCase();
const words = s => new Set(norm(s.split('\nQuestion:')[0]).split(' ').filter(Boolean));
const jac = (a, b) => { let i = 0; for (const x of a) if (b.has(x)) i++; return i / (a.size + b.size - i || 1); };
let cur = rows;
// 1. template rows
{ const keep = cur.filter(r => !r.source.includes('template')); drop('template_rows', cur.length - keep.length); cur = keep; }
// 2. long requests answered by thin programs
{ const keep = cur.filter(r => !(r.task === 'create' && !isAsk(r) && r.request.split(/\s+/).length >= 18 && r.program.trim().split('\n').length <= 5)); drop('long_request_thin_program', cur.length - keep.length); cur = keep; }
// 3. labels that leak from other apps
const LEAK = [['Quiz night', /quiz/i], ['Ludo', /ludo/i], ['Table_1', /table/i], ['Add homework mark', /homework|mark/i], ['A bank connection is not possible here', /bank/i], ['Played', /played|games?|match/i], ['Seated', /seat|table/i], ['Gross', /gross/i], ['Needs a visit', /visit/i], ['Add dua', /dua|prayer/i], ['Log study time', /study/i]];
{ const keep = cur.filter(r => { if (r.task !== 'create' || isAsk(r)) return true; for (const [s, rx] of LEAK) if (r.program.includes(s) && !rx.test(r.request) && !rx.test(title(r))) return false; return true; }); drop('leaked_label_rows', cur.length - keep.length); cur = keep; }
// 4. app-line edits (colour, dark, title, size): keep 300 with unusual wording
const appline = r => { if (r.task !== 'edit' || isAsk(r)) return false; const a = r.program_before.trim().split('\n'), b = r.program.trim().split('\n'); if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) { if (i !== 0 && !/^\s*topbar/.test(a[i])) return false; d++; } return d >= 1 && a[0] !== b[0]; };
{ const al = cur.filter(appline); const usual = /^(make it|change the colou?r|call it|rename the app|name it|change the name|dark|light|bigger|larger)\b/i;
  const unusual = al.filter(r => !usual.test(r.request)), common = al.filter(r => usual.test(r.request));
  const keepSet = new Set([...R.shuffle(unusual), ...R.shuffle(common)].slice(0, 300)); const keep = cur.filter(r => !appline(r) || keepSet.has(r)); drop('appline_edits_dropped', cur.length - keep.length); log.appline_edits_total = al.length; cur = keep; }
// 5. duplicate program bodies: at most 3 per body (the 3 most different requests)
{ const by = new Map(); for (const r of cur) if (r.task === 'create' && !isAsk(r)) (by.get(r.program) || by.set(r.program, []).get(r.program)).push(r);
  const out = new Set(); for (const [p, list] of by) if (list.length > 3) { const ch = []; for (const x of R.shuffle(list)) { const w = words(x.request); if (ch.every(c => jac(w, c.w) < 0.6)) ch.push({ x, w }); if (ch.length === 3) break; } const k = new Set(ch.map(c => c.x)); for (const x of list) if (!k.has(x)) out.add(x); }
  const keep = cur.filter(r => !out.has(r)); drop('duplicate_body_rows', cur.length - keep.length); cur = keep; }
// 6. skeleton families: cap 120, keep rows whose request names the topic
const FAM = [['ring_counter', r => r.program.includes('draw width 240 tap add'), /count|ring|tasbeeh|zikr|tap|tally|round/i], ['point_team_scoreboard', r => /table point\b/.test(r.program), /score|team|match|game|points?|play/i], ['mosque_beads', r => /^app "[^"]*" (mosque|beads)\b/.test(r.program), /prayer|namaz|salah|dua|zikr|dhikr|tasbeeh|quran|mosque|fast|ramadan|roza/i]];
for (const [name, fn, topic] of FAM) { const fam = cur.filter(r => r.task === 'create' && !isAsk(r) && fn(r)); const named = R.shuffle(fam.filter(r => topic.test(r.request))), other = fam.filter(r => !topic.test(r.request)); const keepSet = new Set(named.slice(0, 120)); const gone = fam.filter(r => !keepSet.has(r)); const gs = new Set(gone); const keep = cur.filter(r => !gs.has(r)); log['family_' + name + '_before'] = fam.length; drop('family_cap_rows', cur.length - keep.length); log['family_' + name + '_kept'] = keepSet.size; cur = keep; }
// 7. at most 15 creates per app title
{ const by = new Map(); for (const r of cur) if (r.task === 'create' && !isAsk(r)) { const t = title(r); (by.get(t) || by.set(t, []).get(t)).push(r); }
  const out = new Set(); let over = 0; for (const [t, list] of by) if (list.length > 15) { over++; for (const x of R.shuffle(list).slice(15)) out.add(x); }
  const keep = cur.filter(r => !out.has(r)); log.titles_over_cap = over; drop('title_cap_rows', cur.length - keep.length); cur = keep; }
writeFileSync('out/cleaned.jsonl', cur.map(r => JSON.stringify(r)).join('\n') + '\n');
const c = {}; for (const r of cur) c[r.task] = (c[r.task] || 0) + 1;
console.log(JSON.stringify({ in: rows.length, out: cur.length, tasks: c, log }, null, 1));
