// Skeleton cap: names, strings, numbers and the app line are erased; programs (creates: program, edits: before) with the same
// remaining shape count as one skeleton. No skeleton may appear in more than CAP (default 2) spec items.   node tools/skeleton_check.mjs spec/*.jsonl
import { readFileSync } from 'node:fs';
const KW = new Set(('table setting state let each if else row stack card grid box list form quick topbar goal stat statcard section daybars bars trend heat share goalbars daygrid weekdots plot draw rect circle label poly pt arc line path tick path screen choice field slider button toggle timer every when remind notify calendar monthnav reveal quiz reader stepper flashcards lesson blocks notes scroll divider ' +
  'sum count avg max min last first streak since round abs floor clamp pow random plural dayname monthname monthday monthdays year month day hour minute addmonths due has by sort desc as on it index and or not yes no then set add remove edit save go ' +
  'today now week days prev all top empty num money text long bool date time dur image ref pick unit was keep new tap swipe grow bold faint big head small tiny muted good bad warn ink accent soft bg color fill stroke thick radius gap pad align center opacity width height at where options key ask app').split(/\s+/));
export const skeleton = p => p.split('\n').slice(1).filter(l => l.trim()).map(l => l.replace(/"[^"]*"/g, 'S').replace(/\b\d+(\.\d+)?\b/g, 'N').replace(/[A-Za-z_][A-Za-z0-9_]*/g, w => KW.has(w) ? w : 'X')).join('\n');
if (process.argv[1].endsWith('skeleton_check.mjs')) {
  const CAP = +(process.env.CAP || 2); const g = new Map(); const seen = new Set();  // an ask pair and its follow-ups share one program: it counts once
  for (const f of process.argv.slice(2)) for (const l of readFileSync(f, 'utf8').trim().split('\n')) {
    const r = JSON.parse(l); const body = r.kind.startsWith('edit') ? r.before : r.program; if (!body || body.startsWith('ask ')) continue;
    if (seen.has(body)) { const k0 = skeleton(body); g.get(k0).push(r.id + '(same program)'); continue; } seen.add(body); const k = skeleton(body); if (!g.has(k)) g.set(k, []); g.get(k).push(r.id);
  }
  let bad = 0; for (const [k, ids] of g) if (ids.filter(x => !x.endsWith('(same program)')).length > CAP) { bad++; console.log('SKELETON x' + ids.length, ids.join(' ')); }
  console.log([...g.values()].reduce((a, v) => a + v.length, 0), 'programs,', g.size, 'skeletons,', bad, 'over the cap of', CAP);
  process.exit(bad ? 1 : 0);
}
