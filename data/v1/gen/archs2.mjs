import { B as Brows, C as Crows, D as Drows, E as Erows, F as Frows, G as Grows } from './domains.mjs';
import { theme, REMINDS, fieldSay, pretty, listPhrase } from './archs1.mjs';
const low = s => s.toLowerCase();
const noun = e => e.replace(/^an? /, '');
const sayRemind = (d, text, ord = 9) => { };
const rem = (s, text) => { const R = REMINDS[s.p.reminder % REMINDS.length]; return { lines: [[9, R.line(text)]], say: R.say, edit: R.say.map(x => x.replace(/^a /, 'add a ').replace(/^reminders/, 'add reminders')), rm: ['remove the reminder', 'stop the reminders'] }; };
const TABS = { tabs: { make() { return { say: ['two tabs: today and history', 'a separate History tab'], edit: ['put the history on its own tab', 'split it into two tabs'], rm: [] }; } } };
const rp = r => r.int(0, REMINDS.length - 1);

// ============ COUNT-ONLY LOG ============
export const BD = Brows.map(([app, icon, tbl, trk, ent, wish, gw, limit]) => ({ key: 'b_' + app, app, icon, tbl, trk, ent, wish, goalWeek: Number(gw), limit: limit === '1', theme: theme('b_' + app) }));
export const B = {
  name: 'countlog',
  params: (d, r) => ({ name: d.app, icon: d.icon, theme: d.theme, goal: d.goalWeek || r.pick([3, 5, 7]), reminder: rp(r) }),
  base(s) {
    const d = s.d;
    const hasField = s.ids.includes('note');
    return { tables: [{ name: d.tbl, fields: [] }], lines: [[4, hasField ? `form ${d.tbl}` : `button "Log ${noun(d.ent)}" tap add ${d.tbl}`], [8, s.ids.includes('log') ? `log ${d.tbl}` : `list ${d.tbl}`]] };
  },
  opts: {
    today: { excl: 'top', dflt: true, make(s) { const d = s.d; return { lines: [[2, `stat count(${d.tbl} today), "today"`]], say: ['a big count for today', "today's count"], edit: ['show how many I did today', "add today's count"], rm: ["remove today's count"] }; } },
    week: { excl: 'top', make(s) { const d = s.d; return { lines: [[2, `stat count(${d.tbl} week), "this week"`]], say: ['the count for this week', 'a weekly count'], edit: ['show the weekly count', 'add a count for this week'], rm: ['remove the weekly count'] }; } },
    goal: { excl: 'top', dflt: true, make(s) { const { d, p } = s; return { lines: [[1, `setting target num = ${p.goal} "${d.limit ? 'Weekly limit' : 'Weekly goal'}"`], [2, `goal count(${d.tbl} week), target, "this week", "times"`]], say: d.limit ? [`a weekly limit of ${p.goal}`, `a warning if I go over ${p.goal} a week`] : [`a weekly goal of ${p.goal}`, `a target of ${p.goal} a week with a progress bar`], edit: [`add a weekly ${d.limit ? 'limit' : 'goal'} of ${p.goal}`, `I want a target of ${p.goal} a week`], rm: ['remove the goal'] }; } },
    streak: { make(s) { const d = s.d; return { lines: [[2, `stat streak(${d.tbl}), "day streak"`]], say: ['a day streak', 'how many days in a row'], edit: ['add a day streak', 'show my streak of days'], rm: ['remove the streak'] }; } },
    since: { make(s) { const d = s.d; return { lines: [[2, `stat since(${d.tbl}), "days since the last one"`]], say: ['days since the last one', 'a counter of days since the last time'], edit: ['show the days since the last one'], rm: ['remove the days since counter'] }; } },
    chart: { excl: 'chart', dflt: true, make(s) { const d = s.d; return { lines: [[6, `daybars last 7 days, count(${d.tbl} on it)`]], say: ['a bar chart of the last 7 days', 'a weekly chart', 'bars for each day this week'], edit: ['add a chart of the last 7 days', 'I want a weekly chart'], rm: ['remove the chart'] }; } },
    heat: { excl: 'chart', make(s) { const d = s.d; return { lines: [[6, `heat last 70 days, count(${d.tbl} on it), 3`]], say: ['a heat map of the last 10 weeks', 'a colour grid of the last 70 days'], edit: ['add a heat map of the last 10 weeks'], rm: ['remove the heat map'] }; } },
    calendar: { excl: 'chart', make(s) { const d = s.d; return { lines: [[6, `calendar ${d.tbl}`]], say: ['a month calendar with the days marked', 'a calendar where days I did it are filled in'], edit: ['add a month calendar', 'show a calendar with the days marked'], rm: ['remove the calendar'] }; } },
    note: { make(s) { return { fields: ['note text?'], say: ['an optional note each time', 'a note field'], edit: ['add a note each time', 'let me add a note to each entry', 'add an optional note field'], rm: ['remove the note field'] }; } },
    log: { excl: 'view', make() { return { say: ['entries grouped by day'], edit: ['group the entries by day'], rm: [] }; } },
    remind: { make(s) { return rem(s, `Time to log ${s.d.trk.replace(/^(my|the) /, '')}`); } },
    ...TABS,
  },
  tabs: () => [{ name: 'main', label: 'Today', icon: 'home', split: 6 }, { name: 'past', label: 'History', icon: 'chart' }],
  np: s => [`a ${low(s.d.app)} tracker`, `an app to count ${s.d.trk}`, `a counter for ${s.d.trk}`, `a tiny app for ${s.d.trk}`],
  npShort: s => [`a ${low(s.d.app)} counter`, `a ${low(s.d.app)} tracker`],
  imp: s => [`count ${s.d.trk}`, `keep track of ${s.d.trk}`, `log ${s.d.ent} each time`],
  impShort: s => [`count ${s.d.trk}`, `track ${s.d.trk}`],
  wish: s => s.d.wish,
};

// ============ HABIT CHECKLIST ============
export const CD = Crows.map(([app, icon, hab, chk, trk, starter, wish]) => ({ key: 'c_' + app, app, icon, hab, chk, trk, starter, wish, theme: theme('c_' + app) }));
export const C = {
  name: 'habits',
  params: (d, r) => ({ name: d.app, icon: d.icon, theme: d.theme, reminder: rp(r) }),
  base(s) {
    const { d } = s, ids = s.ids;
    const blk = ['each ' + d.hab, '  row card gap 2 tap edit it swipe remove it', '    stack grow', '      it.name bold'];
    if (ids.includes('streak')) blk.push(`      streak(it.${d.chk}) "day streak" faint`);
    if (ids.includes('when')) blk.push('      it.part faint');
    blk.push(`    toggle it.${d.chk}`);
    const fieldsH = ['name text'];
    const lines = [[1, `let n = count(${d.hab})`], [2, `count(${d.chk} today) "of" n "done today" head`], [3, blk.join('\n')], [4, `form ${d.hab}`]];
    return { tables: [{ name: d.hab, fields: fieldsH }, { name: d.chk, fields: [`${d.hab} ref ${d.hab}`] }], lines, say: [`a checklist of ${d.trk} with a tick for each one every day`, `a daily tick box for each of ${d.trk}`, `a list where I tick off ${d.trk} each day`] };
  },
  opts: {
    streak: { dflt: true, make() { return { say: ['a streak count for each one', 'the streak for every item'], edit: ['show a streak for each one', 'add a streak count under each item'], rm: ['remove the streaks'] }; } },
    best: { make(s) { const d = s.d; return { lines: [[5, `stat maxof(${d.hab}, streak(it.${d.chk})), "best streak"`]], say: ['my best streak'], edit: ['show my best streak'], rm: ['remove the best streak'] }; } },
    pctw: { make(s) { const d = s.d; return { lines: [[5, `stat round(count(${d.chk} week) * 100 / (n * weekday(today))), "% done this week"`]], say: ['the percent done this week'], edit: ['show the percent done this week', 'add a weekly percentage'], rm: ['remove the weekly percentage'] }; } },
    pct30: { make(s) { const d = s.d; return { lines: [[5, `stat round(count(${d.chk} last 30 days) * 100 / (n * 30)), "% in 30 days"`]], say: ['the percent done in 30 days'], edit: ['show the percent for the last 30 days'], rm: ['remove the 30 day percentage'] }; } },
    heat: { dflt: true, make(s) { const d = s.d; return { lines: [[6, `heat last 70 days, count(${d.chk} on it), n`]], say: ['a heat map of the last 10 weeks', 'a colour grid of how I did over 70 days'], edit: ['add a heat map of the last 10 weeks', 'show a colour grid of the last 70 days'], rm: ['remove the heat map'] }; } },
    when: { make(s) { return { fields: ['part pick Morning|Afternoon|Evening = Morning'], say: ['a time of day for each one (morning, afternoon or evening)', 'morning, afternoon or evening for each item'], edit: ['let me pick morning, afternoon or evening for each one', 'add a time of day to each item'], rm: ['remove the time of day'] }; } },
    remind: { make(s) { return rem(s, `Time to tick off ${s.d.trk.replace(/^(my|the) /, '')}`); } },
    ...TABS,
  },
  tabs: () => [{ name: 'main', label: 'Today', icon: 'check', split: 5 }, { name: 'stats', label: 'Stats', icon: 'chart' }],
  np: s => [`a habit tracker for ${s.d.trk}`, `a checklist app for ${s.d.trk}`, `a daily checklist`, `a simple ${low(s.d.app)} tracker`],
  npShort: s => [`a ${low(s.d.app)} checklist`, `a ${low(s.d.app)} tracker`],
  imp: s => [`track ${s.d.trk} every day`, `help me tick off ${s.d.trk} daily`],
  impShort: s => [`track ${s.d.trk}`],
  wish: s => s.d.wish,
};

// ============ EXPENSES ============
export const DD = Drows.map(([app, icon, tbl, trk, c1, c2, c3, c4, c5, budget, wish]) => ({ key: 'd_' + app, app, icon, tbl, trk, cats: [c1, c2, c3, c4, c5], budget: Number(budget), wish, theme: theme('d_' + app) }));
export const D = {
  name: 'expenses',
  params: (d, r) => ({ name: d.app, icon: d.icon, theme: d.theme, budget: d.budget, reminder: rp(r) }),
  base(s) {
    const { d, p } = s, ids = s.ids;
    const W = ids.includes('monthnav') ? 'month of m' : 'month';
    const fields = ['what text', 'amount money'];
    if (ids.includes('cat')) fields.push(`category pick ${d.cats.join('|')}`);
    const lines = [];
    if (ids.includes('monthnav')) { lines.push([1, 'state m date = today'], [2, 'monthnav m']); }
    lines.push([1, `let spent = sum(${d.tbl}.amount ${W})`]);
    if (!ids.includes('budget')) lines.push([2, `"Spent" spent big`]);
    lines.push([4, `form ${d.tbl}`], [8, `log ${d.tbl} ${W}`]);
    s._W = W;
    return { tables: [{ name: d.tbl, fields }], lines, say: [`expenses with what it was for and the amount${ids.includes('cat') ? ' and a category' : ''}`, `each expense has a name and an amount${ids.includes('cat') ? ' and a category' : ''}`] };
  },
  opts: {
    cat: { dflt: true, make(s) { const d = s.d; return { say: [`categories: ${listPhrase(d.cats.map(pretty), null)}`, `a category for each expense (${d.cats.slice(0, -1).map(pretty).join(', ')} or ${pretty(d.cats[4])})`], edit: [`add categories: ${listPhrase(d.cats.map(pretty), null)}`, `I want to pick a category for each expense`], rm: [] }; } },
    budget: { dflt: true, make(s) { const { d, p } = s; const W = s.ids.includes('monthnav') ? 'month of m' : 'month'; return { lines: [[1, `setting budget money = ${p.budget} "Monthly budget"`], [2, `if(spent > budget, "Over budget by", "Left to spend") abs(budget - spent) big`], [2, `goal spent, budget, "spent"`]], say: [`a monthly budget of ${p.budget} that I can change`, `a monthly budget of ${p.budget} and how much is left`, `a budget bar for ${p.budget} a month`], edit: [`add a monthly budget of ${p.budget}`, `I want to set a budget of ${p.budget} and see what is left`], rm: ['remove the budget'] }; } },
    pace: { needs: 'budget', make(s) { return { lines: [[2, `"Safe to spend" round(max(budget - spent, 0) / (monthdays(today) - monthday(today) + 1)) "a day" faint`]], say: ['how much I can safely spend per day'], edit: ['show how much I can spend per day'], rm: ['remove the daily safe amount'] }; } },
    prev: { make(s) { const d = s.d; return { lines: [[2, `"Last month" sum(${d.tbl}.amount prev month) faint`]], say: ['last month for comparison', 'last month total next to this month'], edit: ['show last month for comparison', 'add last month total'], rm: ['remove last month'] }; } },
    share: { needs: 'cat', make(s) { const d = s.d; const W = s.ids.includes('monthnav') ? 'month of m' : 'month'; return { lines: [[6, `share ${d.tbl} ${W}, sum(it.amount), it.key`.replace(`${d.tbl} ${W},`, `${d.tbl} ${W} by category,`)]], say: ['a chart comparing the categories', 'bars that show which category costs most'], edit: ['add a chart by category', 'show which category costs the most'], rm: ['remove the category chart'] }; } },
    bars: { make(s) { const d = s.d; return { lines: [[6, `daybars last 7 days, sum(${d.tbl}.amount on it)`]], say: ['a chart of the last 7 days', 'bars for daily spending this week'], edit: ['add a chart of daily spending for the week'], rm: ['remove the chart'] }; } },
    note: { make() { return { fields: ['note text?'], say: ['an optional note'], edit: ['add a note to each expense', 'let me add a note'], rm: ['remove the note'] }; } },
    monthnav: { make() { return { say: ['arrows to go to other months'], edit: ['let me flip to other months'], rm: [] }; } },
    remind: { make(s) { return rem(s, `Add today's expenses`); } },
    ...TABS,
  },
  tabs: () => [{ name: 'main', label: 'Spend', icon: 'wallet', split: 6 }, { name: 'charts', label: 'Charts', icon: 'chart' }],
  np: s => [`a ${low(s.d.app)} tracker`, `an expense tracker for ${s.d.trk}`, `a simple app for ${s.d.trk}`, `a budget app for ${s.d.trk}`],
  npShort: s => [`a ${low(s.d.app)} tracker`, `an expense log`],
  imp: s => [`track ${s.d.trk}`, `track what I spend on ${s.d.trk.replace(/^(my|our) /, '')}`, `keep a record of ${s.d.trk}`],
  impShort: s => [`track ${s.d.trk}`],
  wish: s => s.d.wish,
};
// dependency filter for options that need others
export function prune(A, ids) {
  return ids.filter(id => { const o = A.opts[id]; const need = o.needs || (id === 'pace' ? 'budget' : id === 'share' ? 'cat' : null); return !need || ids.includes(need); });
}

// ============ MIXED LOG ============
export const ED = Erows.map(([app, icon, tbl, trk, fields, chartField, kind, wish]) => ({ key: 'e_' + app, app, icon, tbl, trk, fields: fields.split(';').map(x => x.trim().replace(/~/g, '|')), cf: chartField, kind, wish, theme: theme('e_' + app) }));
export const E = {
  name: 'mixedlog',
  params: (d, r) => ({ name: d.app, icon: d.icon, theme: d.theme, reminder: rp(r) }),
  base(s) {
    const d = s.d, T = d.tbl, F = d.cf;
    const fld = d.fields.map(f => f.split(' ')[0]);
    const lines = [[4, `form ${T}`], [8, s.ids.includes('log') ? `log ${T}` : `list ${T}`]];
    const say = [`each entry has ${listPhrase(d.fields.map(fieldSay))}`, `fields: ${listPhrase(d.fields.map(fieldSay))}`, `I want to enter ${listPhrase(d.fields.map(fieldSay))}`];
    return { tables: [{ name: T, fields: [...d.fields] }], lines, say };
  },
  opts: {
    chart: { dflt: true, make(s) {
      const d = s.d, T = d.tbl, F = d.cf, k = d.kind;
      const lines = k === 'trend' ? [[2, `stat last(${T}.${F}), "latest"`], [6, `trend ${T} last 90 days sort at, it.${F}`]]
        : k === 'avg' ? [[2, `stat round(avg(${T}.${F} last 30 days) * 10) / 10, "average, last 30 days"`], [6, `trend ${T} last 30 days sort at, it.${F}`]]
        : k === 'sum' ? [[2, `stat sum(${T}.${F} month), "this month"`], [6, `daybars last 7 days, sum(${T}.${F} on it)`]]
        : [[2, `stat count(${T} month), "this month"`], [6, `daybars last 7 days, count(${T} on it)`]];
      const nm = pretty(F);
      return { lines, say: k === 'trend' ? [`a line chart of ${nm} over time and the latest value`, `a graph of my ${nm}`] : k === 'avg' ? [`the average ${nm} and a line chart`, `a graph of ${nm} over the last month`] : k === 'sum' ? [`the total ${nm} this month and a weekly bar chart`, `a chart of ${nm} per day`] : [`how many entries this month and a weekly chart`, `a bar chart of entries per day`], edit: [`add a chart of ${nm}`, `I want a graph of ${nm}`, `show me a chart`], rm: ['remove the chart', 'take the chart off'] };
    } },
    since: { make(s) { return { lines: [[2, `stat since(${s.d.tbl}), "days since the last entry"`]], say: ['days since the last entry'], edit: ['show how many days since the last entry'], rm: ['remove the days counter'] }; } },
    log: { excl: 'view', make() { return { say: ['entries grouped by day'], edit: ['group the entries by day'], rm: [] }; } },
    note: { only: s => !s.d.fields.some(f => f.startsWith('note ')), make() { return { fields: ['memo text?'], say: ['an optional memo'], edit: ['add a memo field to each entry', 'let me add a memo to every entry'], rm: ['remove the memo'] }; } },
    remind: { make(s) { return rem(s, `Time to add ${s.d.trk.replace(/^(my|the) /, '')}`); } },
    ...TABS,
  },
  tabs: () => [{ name: 'main', label: 'Add', icon: 'plus', split: 6 }, { name: 'charts', label: 'Charts', icon: 'chart' }],
  np: s => [`a ${low(s.d.app)} log`, `a diary for ${s.d.trk}`, `an app to record ${s.d.trk}`, `a ${low(s.d.app)} tracker`],
  npShort: s => [`a ${low(s.d.app)} log`, `a ${low(s.d.app)} tracker`],
  imp: s => [`record ${s.d.trk}`, `keep a log of ${s.d.trk}`, `write down ${s.d.trk}`],
  impShort: s => [`log ${s.d.trk}`, `track ${s.d.trk}`],
  wish: s => s.d.wish,
};

// ============ STOCK ============
export const FD = Frows.map(([app, icon, tbl, trk, unitw]) => ({ key: 'f_' + app, app, icon, tbl, trk, unitw, theme: theme('f_' + app) }));
export const F = {
  name: 'stock',
  params: (d, r) => ({ name: d.app, icon: d.icon, theme: d.theme, low: r.pick([2, 3, 5, 5, 10]), qty: 'qty', reminder: rp(r) }),
  base(s) {
    const { d, p } = s, ids = s.ids, T = d.tbl, q = p.qty;
    const fields = ['name text', `${q} num 0..${p.was ? ' was ' + p.was : ''}`, `low num 0.. = ${p.low}`];
    if (ids.includes('price')) fields.push('price money?');
    if (ids.includes('kind')) fields.push(`kind pick ${d.kinds.join('|')}`);
    if (ids.includes('expiry')) fields.push('expires date?');
    const where = ids.includes('search') ? ' where has(name, q)' : '';
    const lines = [];
    if (ids.includes('search')) lines.push([1, 'state q text = ""']);
    lines.push([1, `let short = countof(${T}, it.${q} <= it.low)`], [2, `text short "${d.unitw} running low" head color if(short > 0, warn, good)`]);
    if (ids.includes('search')) lines.push([2, 'field q "Search"']);
    const exp = ids.includes('expiry') ? `\n      "Expires" i.expires faint color if(i.expires < today, bad, muted)` : '';
    const kind = ids.includes('kind') ? `\n      i.kind faint` : '';
    lines.push([3, `each ${T}${where} sort ${q} as i\n  row card gap 1 tap edit i swipe remove i\n    stack grow\n      i.name bold color if(i.${q} <= i.low, warn, ink)${kind}${exp}\n    button "-" tap set i.${q} = i.${q} - 1\n    i.${q} bold\n    button "+" tap set i.${q} = i.${q} + 1`]);
    if (ids.includes('price')) lines.push([5, `"Stock value" sumof(${T}, it.${q} * it.price) faint`]);
    lines.push([6, `form ${T}`]);
    return { tables: [{ name: T, fields }], lines, say: [`a list of ${d.unitw} with a count for each and plus and minus buttons`, `each item has a name, a count and a low-stock level; show a warning when it runs low`, `${d.unitw} with quantity and a minimum level, highlighted when low`] };
  },
  opts: {
    price: { make() { return { say: ['a price for each one and the total value', 'prices and the total value of everything'], edit: ['add a price to each item and show the total value', 'I want to put prices and see the total value'], rm: [] }; } },
    kind: { make(s) { return { say: [`a category (${s.d.kinds.map(pretty).join(', ')})`], edit: [`add a category with ${s.d.kinds.slice(0, -1).map(pretty).join(', ')} or ${pretty(s.d.kinds[s.d.kinds.length - 1])}`], rm: [] }; } },
    expiry: { make() { return { say: ['an expiry date shown red when passed', 'an expiry date for each item, red when it is over'], edit: ['add an expiry date to each item, red when passed'], rm: [] }; } },
    search: { make() { return { say: ['a search box'], edit: ['add a search box', 'let me search the list'], rm: [] }; } },
    remind: { make(s) { return { lines: [[9, `remind "Check your ${s.d.unitw}" at 9:00 on sat`]], say: ['a reminder every Saturday morning to check'], edit: ['remind me on Saturday morning to check the stock', 'add a weekly stock check reminder'], rm: ['remove the reminder'] }; } },
  },
  np: s => [`a ${low(s.d.app)} tracker`, `an app for ${s.d.trk}`, `a counter for ${s.d.trk}`, `a ${low(s.d.app)} inventory`],
  npShort: s => [`a ${low(s.d.app)} inventory`, `a ${low(s.d.app)} tracker`],
  imp: s => [`keep track of ${s.d.trk}`, `track ${s.d.trk}`, `count ${s.d.trk}`],
  impShort: s => [`track ${s.d.trk}`],
  wish: s => `I lose track of ${s.d.trk}`,
};
const KINDS = ['Food', 'Drinks', 'Other', 'Care'];
FD.forEach((d, i) => d.kinds = [['Dry', 'Fresh', 'Frozen'], ['Big', 'Small', 'Spare'], ['Home', 'Work', 'Other'], ['Daily', 'Weekly', 'Rare']][i % 4]);

// ============ TODO ============
export const GD = Grows.map(([app, icon, tbl, trk, t1, t2, t3, t4, wish]) => ({ key: 'g_' + app, app, icon, tbl, trk, tags: [t1, t2, t3, t4], wish, theme: theme('g_' + app) }));
export const G = {
  name: 'todo',
  params: (d, r) => ({ name: d.app, icon: d.icon, theme: d.theme, reminder: rp(r) }),
  base(s) {
    const { d } = s, ids = s.ids, T = d.tbl;
    const fields = ['title text', 'done bool'];
    if (ids.includes('tag')) fields.push(`tag pick ${d.tags.join('|')} = ${d.tags[0]}`);
    if (ids.includes('prio')) fields.push('priority pick Low|Normal|High = Normal');
    if (ids.includes('due')) fields.push('due date?');
    const sub = [];
    if (ids.includes('tag')) sub.push('t.tag');
    if (ids.includes('due')) sub.push('t.due');
    const sort = ids.includes('prio') ? ' sort priority desc' : ids.includes('due') ? ' sort due' : '';
    const meta = sub.length ? `\n    stack grow\n      t.title bold\n      ${sub.join(' ')} size small${ids.includes('due') ? ' color if(t.due < today, bad, muted)' : ' color muted'}` : `\n    t.title grow`;
    const lines = [[2, `count(${T} where done = no) "open" head`],
      [3, `each ${T} where done = no${sort} as t\n  row card gap 2 tap edit t swipe remove t\n    toggle t.done${meta}`],
      [4, `form ${T}`], [7, `"Done" faint\nlist ${T} where done = yes`]];
    if (ids.includes('clear')) lines.push([7, `button "Clear done" tap remove all ${T} where done = yes`]);
    return { tables: [{ name: T, fields }], lines, say: [`a list where I add items and tick them off`, `items with a tick box that move to done when ticked`] };
  },
  opts: {
    tag: { dflt: true, make(s) { const d = s.d; return { say: [`a tag for each item (${d.tags.slice(0, -1).map(pretty).join(', ')} or ${pretty(d.tags[3])})`, `tags: ${listPhrase(d.tags.map(pretty))}`], edit: [`add tags: ${listPhrase(d.tags.map(pretty))}`, `let me tag items as ${d.tags.slice(0, -1).map(pretty).join(', ')} or ${pretty(d.tags[3])}`], rm: [] }; } },
    prio: { make() { return { say: ['a priority (low, normal or high) with high first', 'priorities low, normal and high, high ones on top'], edit: ['add a priority: low, normal or high', 'I want high priority things at the top'], rm: [] }; } },
    due: { make() { return { say: ['an optional due date, red when late', 'a due date that turns red when it is late'], edit: ['add a due date, red when late', 'add an optional due date'], rm: [] }; } },
    clear: { make(s) { return { say: ['a button to clear everything that is done'], edit: ['add a button to clear the done items', 'a clear done button'], rm: [] }; } },
    remind: { make(s) { return { lines: [[9, `remind "Check your ${s.d.trk.replace(/^(my) /, '')}" at 8:00`]], say: ['a reminder every morning at 8', 'a morning reminder at 8'], edit: ['remind me every morning at 8', 'add a reminder at 8 am'], rm: ['remove the reminder'] }; } },
  },
  np: s => [`an app for ${s.d.trk}`, `a checklist for ${s.d.trk}`, `a to do list for ${s.d.trk}`, `a simple list for ${s.d.trk}`],
  npShort: s => [`a checklist for ${s.d.trk}`, `a to do list for ${s.d.trk}`],
  imp: s => [`help me manage ${s.d.trk}`, `keep ${s.d.trk} in an app`, `write down ${s.d.trk} and tick them off`],
  impShort: s => [`manage ${s.d.trk}`],
  wish: s => s.d.wish,
};

B.paramEdit = (before, after, r) => {
  if (!before.ids.includes('goal')) return null;
  const g = before.p.goal + r.pick([1, 2, 3]); after.p.goal = g;
  return r.pick([`make the weekly ${before.d.limit ? 'limit' : 'goal'} ${g}`, `change the target to ${g} a week`]);
};
D.paramEdit = (before, after, r) => {
  if (!before.ids.includes('budget')) return null;
  const g = Math.round(before.p.budget * r.pick([1.25, 1.5, 0.8, 2]) / 100) * 100; after.p.budget = g;
  return r.pick([`make the budget ${g}`, `change the monthly budget to ${g}`, `my budget is ${g} now`]);
};
F.paramEdit = (before, after, r) => {
  if (r.chance(0.5)) { const l = r.pick([1, 2, 3, 10, 20]); if (l === before.p.low) return null; after.p.low = l; return `make the default low level ${l}`; }
  const nn = r.pick(['left', 'stock', 'count', 'amount']); after.p.qty = nn; after.p.was = 'qty';
  return r.pick([`rename quantity to ${nn} but keep my numbers`, `call the qty field ${nn}`, `change "qty" to "${nn}"`]);
};
