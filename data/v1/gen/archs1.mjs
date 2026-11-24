import { Q as Qrows, B as Brows, C as Crows, D as Drows, E as Erows, F as Frows, G as Grows } from './domains.mjs';
import { sha } from './lib.mjs';
import { THEMES } from './frame.mjs';

export const theme = key => THEMES[parseInt(sha(key).slice(0, 2), 16) % 5];
export const hm = t => { const [h, m] = t.split(':').map(Number); const ap = h < 12 ? 'am' : 'pm'; const hh = h % 12 === 0 ? 12 : h % 12; return m ? `${hh}:${String(m).padStart(2, '0')} ${ap}` : `${hh} ${ap}`; };
const low = s => s.toLowerCase();
export const REMINDS = [
  { line: t => `remind "${t}" every 2h from 9:00 to 21:00`, say: ['a reminder every 2 hours during the day', 'a nudge every two hours while I am awake'] },
  { line: t => `remind "${t}" every 3h from 8:00 to 20:00`, say: ['a reminder every 3 hours', 'a reminder every three hours in the daytime'] },
  { line: t => `remind "${t}" at 8:00, 20:00`, say: ['a reminder at 8 am and 8 pm', 'reminders morning and evening, at 8 and 8', 'a reminder at 8 in the morning and 8 at night'] },
  { line: t => `remind "${t}" at 21:00`, say: ['a reminder at 9 pm', 'a 9 pm reminder every night', 'a reminder every evening at 9'] },
  { line: t => `remind "${t}" at 7:30`, say: ['a reminder at 7:30 every morning', 'a morning reminder at 7:30'] },
  { line: t => `remind "${t}" at 12:00, 18:00`, say: ['reminders at noon and 6 pm', 'a reminder at 12 and one at 6 in the evening'] },
  { line: t => `remind "${t}" at 22:00`, say: ['a late reminder at 10 pm', 'a reminder at 10 at night'] },
];

// ============ QUANTITY ============
export const QD = Qrows.map(([app, icon, tbl, fld, unit, range, quick, goal, trk, ent, wish, kind, limit]) => ({ key: 'q_' + app, app, icon, tbl, fld, unit, range, quick: quick.split(',').map(Number), goal: Number(goal), trk, ent, wish, kind, limit: limit === '1', theme: theme('q_' + app) }));
const up = d => d.unit === 'PKR' ? 'rupees' : d.unit;
const joinQ = q => q.length === 1 ? String(q[0]) : q.slice(0, -1).join(', ') + ' and ' + q[q.length - 1];
const remindText = d => `Time to log ${d.trk.replace(/^(my|the) /, '')}`.replace(/Time to log how much (.*)/, 'Time to log $1');
export const Q = {
  name: 'quantity',
  params(d, r, style) { const w = d.limit || style === 'vague' ? 'today' : r.pick(['today', 'today', 'week']); return { name: d.app, icon: d.icon, theme: d.theme, goal: d.goal * (w === 'week' ? 7 : 1), quick: d.quick, fld: d.fld, goalWin: w, reminder: r.int(0, REMINDS.length - 1) }; },
  base(s) {
    const d = s.d, p = s.p;
    const unit = d.unit && d.kind !== 'money' ? ` unit "${d.unit}"` : '';
    const type = d.kind === 'money' ? 'money' : 'num';
    return { tables: [{ name: d.tbl, fields: [`${p.fld} ${type} ${d.range}${unit}${p.was ? ' was ' + p.was : ''}`] }], lines: [[4, `form ${d.tbl}`], [8, s.ids.includes('log') ? `log ${d.tbl}` : `list ${d.tbl}`]] };
  },
  opts: {
    goal: { excl: 'goal', dflt: true, only: s => s.d.goal > 0, make(s) {
      const { d, p } = s, w = p.goalWin, lab = d.limit ? (w === 'week' ? 'Weekly limit' : 'Daily limit') : (w === 'week' ? 'Weekly goal' : 'Daily goal');
      const stype = d.kind === 'money' ? 'money' : 'num';
      const suf = d.kind === 'money' ? '' : `, "${d.unit}"`;
      const gline = `goal sum(${d.tbl}.${p.fld} ${w === 'week' ? 'week' : 'today'}), goal, "${w === 'week' ? 'this week' : 'today'}"${suf}`;
      const per = w === 'week' ? 'a week' : 'a day', u = up(d);
      return { lines: [[1, `setting goal ${stype} = ${p.goal} "${lab}${d.kind === 'money' ? '' : ` (${d.unit})`}"`], [2, gline]],
        say: d.limit ? [`a limit of ${p.goal} ${u} ${per}`, `a ${w === 'week' ? 'weekly' : 'daily'} limit of ${p.goal} ${u}`, `a warning when I go over ${p.goal} ${u} ${per}`] : [`a ${w === 'week' ? 'weekly' : 'daily'} goal of ${p.goal} ${u}`, `my goal is ${p.goal} ${u} ${per}`, `a progress bar toward ${p.goal} ${u} ${per}`, `a target of ${p.goal} ${u} ${per} that I can change`],
        edit: [`add a ${w === 'week' ? 'weekly' : 'daily'} ${d.limit ? 'limit' : 'goal'} of ${p.goal} ${u}`, `I want a ${d.limit ? 'limit' : 'goal'} of ${p.goal} ${u} ${per}`, `add a progress bar for ${p.goal} ${u} ${per}`], rm: [`remove the goal`, `I do not need the ${d.limit ? 'limit' : 'goal'} bar`] };
    } },
    ring: { excl: 'goal', only: s => s.d.goal > 0 && s.d.kind !== 'money', make(s) {
      const { d, p } = s;
      return { lines: [[1, `setting goal num = ${p.goal} "Daily goal (${d.unit})"`], [2, `ring sum(${d.tbl}.${p.fld} today), goal, "today"`]], say: [`a progress ring toward ${p.goal} ${up(d)}`, `a ring that fills up to ${p.goal} ${up(d)} each day`], edit: [`add a progress ring for ${p.goal} ${up(d)}`, `show a ring toward my daily ${p.goal}`], rm: ['remove the ring'] };
    } },
    quick: { dflt: true, make(s) {
      const { d, p } = s, q = p.quick;
      return { lines: [[3, `quick ${d.tbl}, ${p.fld}, [${q.join(', ')}]`]], say: [`quick buttons for ${joinQ(q)}`, `one-tap buttons: ${q.join(', ')}`, `buttons to add ${joinQ(q)} fast`, `tap-to-add buttons for ${joinQ(q)}`], edit: [`add quick buttons for ${joinQ(q)}`, `I want one-tap buttons for ${joinQ(q)}`], rm: ['remove the quick buttons', 'I do not need the one-tap buttons'] };
    } },
    chart: { excl: 'chart', dflt: true, make(s) {
      const { d, p } = s;
      return { lines: [[6, `daybars last 7 days, sum(${d.tbl}.${p.fld} on it)`]], say: ['a bar chart of the last 7 days', 'a weekly chart', 'a chart of this week day by day', 'bars for each of the last seven days'], edit: ['add a chart for the last 7 days', 'I want a weekly bar chart', 'show me a chart of the week'], rm: ['remove the chart', 'take the chart off'] };
    } },
    trend: { excl: 'chart', make(s) {
      const { d, p } = s;
      return { lines: [[6, `trend days last 14 days, sum(${d.tbl}.${p.fld} on it)`]], say: ['a line graph of the last two weeks', 'a trend line for 14 days', 'a line showing how I am doing over two weeks'], edit: ['add a trend line for the last 2 weeks', 'I want a line graph of the last 14 days'], rm: ['remove the line graph'] };
    } },
    heat: { excl: 'chart', make(s) {
      const { d, p } = s, peak = d.goal || Math.round(d.quick[d.quick.length - 1] * 2);
      return { lines: [[6, `heat last 70 days, sum(${d.tbl}.${p.fld} on it), ${peak}`]], say: ['a heat map of the last 10 weeks', 'a colour calendar grid of the last 70 days', 'a heat grid so I can see good and bad days'], edit: ['add a heat map of the last 10 weeks', 'I want a colour grid of the last 70 days'], rm: ['remove the heat map'] };
    } },
    note: { make(s) {
      const d = s.d;
      return { fields: ['note text?'], say: ['a note field on each entry', 'space for a short note with every entry', 'an optional note for each entry'], edit: [`add a note to each ${low(d.ent.replace(/^an? /, ''))}`, 'let me write a note with every entry', 'add an optional note field'], rm: ['remove the note field'] };
    } },
    week: { make(s) {
      const { d, p } = s;
      return { lines: [[2, `stat sum(${d.tbl}.${p.fld} week), "this week"`]], say: ['the total for this week', 'a weekly total', 'a big number for this week so far'], edit: ['show the total for the week', 'add a weekly total'], rm: ['remove the weekly total'] };
    } },
    avg: { make(s) {
      const { d, p } = s;
      return { lines: [[2, `stat round(avg(${d.tbl}.${p.fld} last 30 days)), "average entry, last 30 days"`]], say: ['the average over the last month', 'my average entry for 30 days'], edit: ['show my average over the last 30 days'], rm: ['remove the average'] };
    } },
    today: { excl: 'goal', make(s) {
      const { d, p } = s;
      return { lines: [[2, `stat sum(${d.tbl}.${p.fld} today), "today"`]], say: ['the total for today', "today's total as a big number"], edit: ['show the total for today at the top', 'add a big number for today'], rm: ['remove the total for today'] };
    } },
    streak: { make(s) {
      const d = s.d;
      return { lines: [[2, `stat streak(${d.tbl}), "day streak"`]], say: ['my streak of days in a row', 'a day streak counter'], edit: ['add a day streak counter', 'show how many days in a row I logged'], rm: ['remove the streak'] };
    } },
    log: { excl: 'view', make(s) { return { say: ['entries grouped by day', 'a history grouped by day'], edit: ['group the entries by day'], rm: [] }; } },
    remind: { make(s) {
      const R = REMINDS[s.p.reminder], d = s.d;
      return { lines: [[9, R.line(remindText(d))]], say: R.say, edit: R.say.map(x => x.replace(/^a /, 'add a ').replace(/^reminders/, 'add reminders')), rm: ['remove the reminder', 'stop the reminders'] };
    } },
    tabs: { make() { return { say: ['two tabs: today and history', 'a separate History tab'], edit: ['put the history on its own tab', 'split it into Today and History tabs'], rm: [] }; } },
  },
  tabs: s => [{ name: 'main', label: 'Today', icon: 'home', split: 6 }, { name: 'past', label: 'History', icon: 'chart' }],
  np: s => [`a ${low(s.d.app)} tracker`, `an app to track ${s.d.trk}`, `a simple ${low(s.d.app)} log`, `an app where I add ${s.d.ent} and see my total`, `a tracker for ${s.d.trk}`],
  npShort: s => [`a ${low(s.d.app)} tracker`, `a ${low(s.d.app)} log`, `a ${low(s.d.app)} counter`],
  imp: s => [`track ${s.d.trk}`, `log ${s.d.ent} every time I have one`, `keep a record of ${s.d.trk}`, `keep track of ${s.d.trk}`],
  impShort: s => [`track ${s.d.trk}`, `log ${s.d.trk}`],
  wish: s => s.d.wish,
};

// ============ helpers for field phrases ============
export const pretty = n => n.replace(/_/g, ' ');
export function fieldSay(f) {
  // f like: high num 50..250  | moment pick A|B|C = A | note text?
  const m = f.match(/^(\w+) (\w+)(\?)?\s*(.*)$/); const name = pretty(m[1]), type = m[2], opt = !!m[3], rest = m[4] || '';
  let out = name;
  if (type === 'pick') { const o = rest.split(/ = | "/)[0].split('|').map(x => pretty(x).toLowerCase()); out = `${name} (${o.slice(0, -1).join(', ')} or ${o[o.length - 1]})`; }
  else if (type === 'bool') out = `${name} yes or no`;
  else if (type === 'date') out = `${name} date`;
  else if (type === 'long') out = `${name} (long text)`;
  else if (type === 'money') out = `${name} (money)`;
  else { const u = rest.match(/unit "([^"]+)"/); if (u) out = `${name} in ${u[1]}`; }
  return opt ? `${out} (optional)` : out;
}
export const listPhrase = (arr, r) => arr.length === 1 ? arr[0] : arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1];

// parameter edits (change numbers, rename a field with `was`)
Q.paramEdit = (before, after, r) => {
  const d = before.d, ids = before.ids, k = r.int(0, 2);
  if (k === 0 && ids.includes('quick')) {
    const q = before.p.quick.map(x => Math.round(x * r.pick([2, 3, 0.5]) * 10) / 10).filter((x, i, a) => x > 0 && a.indexOf(x) === i).slice(0, 3);
    if (q.length < 1 || q.join() === before.p.quick.join()) return null;
    after.p.quick = q; return `change the quick buttons to ${joinQ(q)}`;
  }
  if (k === 1 && (ids.includes('goal') || ids.includes('ring'))) {
    const g = Math.round(before.p.goal * r.pick([1.5, 2, 0.5, 1.25]) / 5) * 5 || before.p.goal + 5;
    if (g === before.p.goal) return null;
    after.p.goal = g; return r.pick([`make the ${d.limit ? 'limit' : 'goal'} ${g} ${up(d)}`, `change the ${d.limit ? 'limit' : 'goal'} to ${g}`, `set the default ${d.limit ? 'limit' : 'goal'} to ${g} ${up(d)}`]);
  }
  if (k === 2) {
    const nn = r.pick(['amount', 'total', 'value', 'number']).replace(new RegExp('^' + d.fld + '$'), 'qty');
    if (nn === d.fld || nn === d.tbl) return null;
    after.p.fld = nn; after.p.was = before.p.fld;
    return r.pick([`rename the ${d.fld} field to ${nn}`, `call the ${d.fld} column ${nn} but keep my data`, `change "${d.fld}" to "${nn}"`]);
  }
  return null;
};
