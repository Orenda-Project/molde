import { BD } from './archs2.mjs';
import { theme, REMINDS, pretty, listPhrase } from './archs1.mjs';
const low = s => s.toLowerCase();
const noun = e => e.replace(/^an? /, '');
const rp = r => r.int(0, REMINDS.length - 1);
const rem = (s, text) => { const R = REMINDS[s.p.reminder % REMINDS.length]; return { lines: [[9, R.line(text)]], say: R.say, edit: R.say.map(x => x.replace(/^a /, 'add a ').replace(/^reminders/, 'add reminders')), rm: ['remove the reminder', 'stop the reminders'] }; };
const rows = s => s.trim().split('\n').map(l => l.split('|').map(x => x.trim()));

// ============ RING COUNTER (custom drawing) ============
export const H = {
  name: 'ringcounter',
  styles: ['custom_ui', 'custom_ui', 'detailed', 'multi_feature', 'short', 'typos', 'vague'],
  params: (d, r) => ({ name: d.app, icon: d.icon, theme: d.theme, target: d.goalWeek && d.goalWeek <= 40 ? Math.max(d.goalWeek, 3) : r.pick([5, 10, 20, 33, 100]), reminder: rp(r) }),
  base(s) {
    const { d, p } = s, T = d.tbl, ids = s.ids;
    const rounds = ids.includes('rounds');
    const lines = [[1, `setting target num = ${p.target} "${rounds ? 'Count to' : 'Target'}"`], [1, `let n = count(${T} today)`]];
    const draw = rounds
      ? `draw width 240 tap add ${T}\n  circle 44 stroke soft thick 8\n  arc 44, 0, 360 * (n % target) / target stroke accent thick 8\n  label 50, 46, n % target big\n  label 50, 64, "Round" floor(n / target) + 1 faint`
      : `draw width 240 tap add ${T}\n  circle 44 stroke soft thick 8\n  arc 44, 0, 360 * clamp(n / target, 0, 1) stroke accent thick 8\n  label 50, 46, n big\n  label 50, 64, "of" target faint`;
    lines.push([2, draw]);
    return { tables: [{ name: T, fields: [] }], lines, say: [`a big circle I tap to add ${d.ent}, with a ring that fills up to ${p.target}`, `one big round button that counts ${d.trk} with a progress ring`, `a tap circle with a progress ring toward ${p.target}`] };
  },
  opts: {
    undo: { dflt: true, make(s) { return { lines: [[3, `button "Undo" tap remove last(${s.d.tbl} today)`]], say: ['an undo button for a wrong tap', 'undo'], edit: ['add an undo button', 'I tap by mistake, add an undo'], rm: ['remove the undo button'] }; } },
    reset: { make(s) { return { lines: [[3, `button "Reset today" tap remove all ${s.d.tbl} today`]], say: ['a button to reset today', 'a reset button for the day'], edit: ['add a reset button for today', 'let me reset the counter'], rm: ['remove the reset button'] }; } },
    rounds: { excl: 'mode', make() { return { say: ['new rounds each time it reaches the target, with the round number shown'], edit: ['count rounds: start again when it reaches the target and show the round'], rm: [] }; } },
    notify: { make(s) { return { lines: [[9, `when n = target notify "Target reached"`]], say: ['a notice when I reach the target'], edit: ['tell me when I reach the target', 'show a message when the target is reached'], rm: ['remove the target message'] }; } },
    chart: { dflt: true, make(s) { return { lines: [[6, `daybars last 7 days, count(${s.d.tbl} on it)`]], say: ['a bar chart of the last 7 days underneath', 'a small weekly chart below'], edit: ['add a weekly chart under the ring', 'I want to see the last 7 days'], rm: ['remove the chart'] }; } },
    streak: { make(s) { return { lines: [[5, `stat streak(${s.d.tbl}), "day streak"`]], say: ['my day streak'], edit: ['add a day streak'], rm: ['remove the streak'] }; } },
    total: { make(s) { return { lines: [[5, `stat count(${s.d.tbl}), "all time"`]], say: ['the all-time total'], edit: ['show the all-time total'], rm: ['remove the all-time total'] }; } },
    remind: { make(s) { return rem(s, `Time for ${s.d.trk.replace(/^(my|the) /, '')}`); } },
  },
  np: s => [`a counter for ${s.d.trk}`, `a tap counter for ${s.d.trk}`, `a big round counter app`, `a counter with a progress ring`],
  npShort: s => [`a tap counter`, `a ring counter`, `a counter for ${s.d.trk}`],
  imp: s => [`count ${s.d.trk} with one big tap`, `help me count ${s.d.trk}`],
  impShort: s => [`count ${s.d.trk}`],
  wish: s => s.d.wish,
};
H.paramEdit = (before, after, r) => { const t = r.pick([5, 10, 20, 50, 100]); if (t === before.p.target) return null; after.p.target = t; return r.pick([`make the target ${t}`, `change the target to ${t}`, `count to ${t} instead`]); };

// ============ SCOREBOARD (custom drawing) ============
const IR = rows(`
Carrom|board|Us|Them|25|a carrom match|we play carrom every evening
Ludo|dice|Red|Blue|50|a ludo game|we argue about ludo scores
Badminton|ball|Ali|Sara|21|a badminton match|we play badminton on weekends
Table tennis|ball|Home|Away|11|a table tennis game|we keep a table tennis score on paper
Cards|cards|Us|Them|100|a card game|we play cards and lose track of points
Cricket match|ball|Eagles|Tigers|99|a street cricket match|my friends and I play cricket
Football|ball|Reds|Blues|10|a football game|we play five-a-side
Chess club|board|Zain|Omar|10|a chess match series|our chess club needs a scoreboard
Tennis|ball|Me|Rival|6|a tennis set|I play tennis with my brother
Basketball|ball|Team_A|Team_B|50|a basketball game|we play basketball after school
Volleyball|ball|North|South|25|a volleyball set|we play volleyball on the beach
Quiz night|trophy|Table_1|Table_2|30|a quiz night|I host a quiz night
Pool|game|Dad|Son|7|a pool match|dad and I play pool
Scrabble|board|Amina|Bilal|300|a scrabble game|we play scrabble every Sunday
Bowling|ball|Lane_1|Lane_2|200|a bowling game|my office goes bowling
Carrom tournament|trophy|Pair_A|Pair_B|29|a carrom tournament|we run a carrom tournament
Darts|target|Mum|Dad|301|a darts game|we play darts at home
Ping pong|ball|Left|Right|21|a ping pong game|we play ping pong in the office
Kabaddi|trophy|Team_1|Team_2|40|a kabaddi match|we play kabaddi in the village
Uno|cards|Hina|Farah|500|an uno game|we play uno with the cousins
`);
export const ID = IR.map(([app, icon, a, b, win, trk, wish]) => ({ key: 'i_' + app, app, icon, a, b, win: Number(win), trk, wish, theme: theme('i_' + app) }));
export const I = {
  name: 'scoreboard',
  styles: ['custom_ui', 'custom_ui', 'detailed', 'multi_feature', 'short', 'typos', 'vague'],
  params: (d, r) => ({ name: d.app, icon: d.icon, theme: d.theme, win: d.win, steps: r.pick([[2], [2, 3], [5], [10]]), reminder: 0 }),
  base(s) {
    const { d, p } = s, ids = s.ids, A = d.a, B = d.b;
    const col = t => { const btns = ids.includes('steps') ? p.steps : [];
      const row1 = `    button "+1" tap add point team = ${t}, pts = 1`;
      const more = btns.length ? `\n    row gap 1\n${btns.map(k => `      button "+${k}" tap add point team = ${t}, pts = ${k}`).join('\n')}` : '';
      return `  stack card grow align center\n    "${pretty(t)}" bold\n    text ${t === A ? 'a' : 'b'} big\n${row1}${more}`; };
    const lines = [[1, `let a = sum(point.pts where team = ${A})`], [1, `let b = sum(point.pts where team = ${B})`], [2, `row gap 2\n${col(A)}\n${col(B)}`], [3, `button "Undo" tap remove last(point)`], [3, `button "New game" tap remove all point`]];
    return { tables: [{ name: 'point', fields: [`team pick ${A}|${B}`, 'pts num 1..500 = 1'] }], lines, say: [`two big score boxes for ${pretty(A)} and ${pretty(B)} with plus 1 buttons, undo and a new game button`, `a scoreboard for ${pretty(A)} against ${pretty(B)} with +1, undo and new game`] };
  },
  opts: {
    steps: { make(s) { const k = s.p.steps; return { say: [`extra buttons for ${k.map(x => '+' + x).join(' and ')}`, `+${k.join(' and +')} buttons too`], edit: [`add ${k.map(x => '+' + x).join(' and ')} buttons`, `I want ${k.map(x => '+' + x).join(' and ')} buttons as well`], rm: ['remove the extra buttons'] }; } },
    win: { make(s) { const { d, p } = s; return { lines: [[1, `setting winat num = ${p.win} "Play to"`], [4, `if a >= winat\n  "${pretty(d.a)} win!" head color good\nif b >= winat\n  "${pretty(d.b)} win!" head color good`]], say: [`a winner message when someone reaches ${p.win}`, `play to ${p.win} and show who won`], edit: [`show who wins at ${p.win}`, `add a winner message when someone reaches ${p.win}`], rm: ['remove the winner message'] }; } },
    lead: { make(s) { const { d } = s; return { lines: [[4, `"Lead:" abs(a - b) faint`]], say: ['the lead between them'], edit: ['show the lead'], rm: ['remove the lead'] }; } },
    history: { make() { return { lines: [[8, `list point`]], say: ['a history of every point'], edit: ['add a list of every point scored', 'show the history of points'], rm: ['remove the history'] }; } },
  },
  np: s => [`a scoreboard for ${s.d.trk}`, `a score keeper for ${s.d.trk}`, `a scoreboard app`, `a two team score counter`],
  npShort: s => [`a scoreboard`, `a score keeper for ${s.d.trk}`],
  imp: s => [`keep the score of ${s.d.trk}`, `help me keep score in ${s.d.trk}`],
  impShort: s => [`keep score for ${s.d.trk}`],
  wish: s => s.d.wish,
};
I.paramEdit = (before, after, r) => { if (!before.ids.includes('win')) return null; const w = r.pick([11, 15, 21, 30, 50]); if (w === before.p.win) return null; after.p.win = w; return r.pick([`play to ${w}`, `make the winning score ${w}`]); };

// ============ TIMER ============
const JR = rows(`
Focus|timer|session|25m|Focus|my focus sessions|a focus session|I can't focus on anything
Plank|dumbbell|hold|1m|Plank|my planks|a plank|I want a strong core
Egg timer|food|egg_done|8m|Boil|my egg timer|an egg|I overcook my eggs
Meditation|moon|sit_done|10m|Breathe|my meditation|a sit|I want to meditate every day
Brush teeth|tooth|brush|2m|Brush|my tooth brushing|a brush|my kids brush too quickly
Reading sprint|book|sprint|20m|Read|my reading sprints|a sprint|I want to read without my phone
Stretching|run|stretch_done|5m|Stretch|my stretching|a stretch|my back is stiff
Tea timer|cup|steep|4m|Steep|my tea timer|a cup|my tea is always too strong or too weak
Study sprint|school|study_block|50m|Study|my study blocks|a block|I study better with a clock
Chore sprint|home|tidy|15m|Tidy|my cleaning sprints|a tidy-up|I need to clean in short bursts
Power nap|bed|nap|20m|Nap|my naps|a nap|I oversleep my naps
Piano practice|music|piano_done|30m|Practice|my piano practice|a practice|I never practice long enough
Interval round|bolt|round|45s|Work|my interval rounds|a round|I do interval training at home
Speaking practice|user|talk|3m|Speak|my speaking practice|a talk|I want to practice public speaking
`);
export const JD = JR.map(([app, icon, tbl, len, cap, trk, ent, wish]) => ({ key: 'j_' + app, app, icon, tbl, len, cap, trk, ent, wish, theme: theme('j_' + app) }));
const durWords = l => { const m = l.match(/^(\d+)([smh])$/); const n = Number(m[1]); return n + ' ' + { s: 'second', m: 'minute', h: 'hour' }[m[2]] + (n === 1 ? '' : 's'); };
export const J = {
  name: 'timer',
  styles: ['custom_ui', 'detailed', 'multi_feature', 'short', 'typos', 'vague'],
  params: (d, r) => ({ name: d.app, icon: d.icon, theme: d.theme, len: d.len, goal: r.pick([3, 4, 5, 8]), reminder: rp(r) }),
  base(s) {
    const { d, p } = s, T = d.tbl, ids = s.ids;
    const fields = [];
    const lines = [[1, `setting length dur = ${p.len} "${d.cap} length"`], [2, `timer length, "${d.cap}", add ${T} then notify "${d.cap} done"`], [2, `count(${T} today) "today" head`], [8, `list ${T} today`]];
    return { tables: [{ name: T, fields }], lines, say: [`a ${durWords(p.len)} timer that counts ${d.ent} when it finishes`, `a ${durWords(p.len)} countdown with start, pause and reset that logs each finished one and shows today's count`] };
  },
  opts: {
    goal: { dflt: true, make(s) { const { d, p } = s; return { lines: [[1, `setting target num = ${p.goal} "Daily goal"`], [2, `goal count(${d.tbl} today), target, "today", "done"`]], say: [`a daily goal of ${p.goal}`, `a target of ${p.goal} a day with a progress bar`], edit: [`add a daily goal of ${p.goal}`, `I want a goal of ${p.goal} a day`], rm: ['remove the goal'] }; } },
    chart: { dflt: true, make(s) { return { lines: [[6, `daybars last 7 days, count(${s.d.tbl} on it)`]], say: ['a bar chart of the last 7 days', 'a weekly chart'], edit: ['add a weekly chart', 'show a chart of the last 7 days'], rm: ['remove the chart'] }; } },
    rest: { make(s) { return { lines: [[3, `timer 5m, "Rest"`]], say: ['a second 5 minute timer for rests', 'a 5 minute rest timer'], edit: ['add a 5 minute rest timer', 'I need a break timer of 5 minutes'], rm: ['remove the rest timer'] }; } },
    note: { make(s) { return { fields: ['note text?'], say: ['an optional note for each one'], edit: ['let me add a note to each one', 'add an optional note'], rm: ['remove the note'] }; } },
    streak: { make(s) { return { lines: [[2, `stat streak(${s.d.tbl}), "day streak"`]], say: ['a day streak'], edit: ['add a day streak'], rm: ['remove the streak'] }; } },
    remind: { make(s) { return rem(s, `Time for ${s.d.trk.replace(/^(my|the) /, '')}`); } },
  },
  np: s => [`a timer app for ${s.d.trk}`, `a ${low(s.d.app)} timer`, `a countdown timer for ${s.d.trk}`],
  npShort: s => [`a ${low(s.d.app)} timer`, `a countdown timer`],
  imp: s => [`time ${s.d.trk}`, `count down for ${s.d.trk} and log them`],
  impShort: s => [`time ${s.d.trk}`],
  wish: s => s.d.wish,
};
J.paramEdit = (before, after, r) => { const o = r.pick(['1m', '2m', '5m', '10m', '15m', '20m', '30m', '45m', '60m']); if (o === before.p.len) return null; after.p.len = o; return r.pick([`make the timer ${durWords(o)}`, `change the length to ${durWords(o)}`, `I want ${durWords(o)} instead`]); };

// ============ LEDGER ============
const KR = rows(`
Khata|wallet|person|entry|my shop customers|customers|Gave|Got|owes you|you owe|People owe you|my customers owe me money and I forget
Money lent|wallet|borrower|loan_entry|the money I lend|people|Lent|Returned|owes you|you owe|Out in loans|I lend money and forget who owes what
Rent|home|tenant|rent_entry|my tenants' rent|tenants|Due|Paid|owes you|paid ahead|Rent owed|I collect rent from three flats
Tuition fees|school|student|fee_entry|my students' fees|students|Fee|Paid|owes you|paid ahead|Fees pending|parents keep forgetting to pay tuition
Committee|coin|member|pot_entry|our committee money|members|Due|Paid|owes|ahead|Still to collect|we run a monthly committee
Staff advances|users|worker|advance_entry|my staff advances|workers|Advance|Repaid|owes you|you owe|Advances out|I give advances to my workers
Milk account|milk|house|milk_entry|my milk customers|houses|Delivered|Paid|owes you|paid ahead|To collect|I sell milk door to door and the notebook is a mess
Tailor dues|bag|client|tailor_entry|my tailoring clients|clients|Bill|Paid|owes you|paid ahead|Balance due|clients pay in parts
Shared flat|home|flatmate|flat_entry|what flatmates owe|flatmates|Paid_for|Paid_back|owes you|you owe|Flat balance|we split bills in the flat and argue
Friends I owe|users|friend|friend_entry|who owes whom|friends|Gave|Got|owes you|you owe|Net with friends|I lose track of who paid for what
`);
export const KD = KR.map(([app, icon, ptbl, etbl, trk, plural, kA, kB, owes, owed, title, wish]) => ({ key: 'k_' + app, app, icon, ptbl, etbl, trk, plural, kA, kB, owes, owed, title, wish, theme: theme('k_' + app) }));
export const K = {
  name: 'ledger',
  styles: ['detailed', 'multi_feature', 'short', 'typos', 'vague', 'custom_ui'],
  params: (d, r) => ({ name: d.app, icon: d.icon, theme: d.theme, reminder: rp(r) }),
  base(s) {
    const { d } = s, ids = s.ids, P = d.ptbl, E = d.etbl;
    const pf = ['name text'];
    if (ids.includes('phone')) pf.push('phone text?');
    const ef = [`${P} ref ${P}`, 'amount money', `kind pick ${d.kA}|${d.kB}`];
    if (ids.includes('due')) ef.push('due date?');
    if (ids.includes('note')) ef.push('note text?');
    const bal = `sum(p.${E}.amount where kind = ${d.kA}) - sum(p.${E}.amount where kind = ${d.kB})`;
    const lines = [[2, `"${d.title}" sum(${E}.amount where kind = ${d.kA}) - sum(${E}.amount where kind = ${d.kB}) big`],
      [3, `each ${P} as p\n  let bal = ${bal}\n  stack card tap edit p\n    row\n      p.name bold grow\n      if(bal >= 0, "${d.owes}", "${d.owed}") abs(bal) color if(bal >= 0, good, bad)${ids.includes('last') ? `\n    "Last entry" last(p.${E}.at) faint` : ''}`],
      [4, `form ${P}, "Add ${pretty(P)}"`], [5, `form ${E}, "Add entry"`], [8, `log ${E}`]];
    return { tables: [{ name: P, fields: pf }, { name: E, fields: ef, }], lines, say: [`a list of ${d.plural} and for each an entry with amount and ${pretty(d.kA)} or ${pretty(d.kB)}, showing the balance`, `${d.plural} with entries (${pretty(d.kA)} or ${pretty(d.kB)}) and the balance for each`] };
  },
  opts: {
    phone: { make() { return { say: ['a phone number for each person'], edit: ['add a phone number to each person', 'I want to save phone numbers'], rm: [] }; } },
    note: { make() { return { say: ['a note on each entry'], edit: ['add a note to each entry', 'let me write a note with each entry'], rm: [] }; } },
    due: { make() { return { say: ['an optional due date on each entry'], edit: ['add a due date to each entry', 'I want an optional due date'], rm: [] }; } },
    last: { make() { return { say: ['the date of the last entry under each name'], edit: ['show the last entry date under each name'], rm: [] }; } },
  },
  np: s => [`a khata for ${s.d.trk}`, `a ledger for ${s.d.trk}`, `a ${low(s.d.app)} book`, `an app to track ${s.d.trk}`],
  npShort: s => [`a ${low(s.d.app)} ledger`, `a ${low(s.d.app)} book`],
  imp: s => [`track ${s.d.trk}`, `keep a record of ${s.d.trk}`],
  impShort: s => [`track ${s.d.trk}`],
  wish: s => s.d.wish,
};

// ============ DATE REMINDERS ============
const LR = rows(`
Bills|wallet|bill|name text; amount money; due date; paid bool|due|"A bill is due soon"|2d|my bills|bills pile up and I pay late
Subscriptions|phone|sub|name text; price money; renews date; cancelled bool|renews|"A subscription renews soon"|3d|my subscriptions|I pay for apps I forgot about
Appointments|calendar|appt|what text; day date; place text?; done bool|day|"You have an appointment tomorrow"|1d|my appointments|I miss my appointments
Birthdays|gift|bday|name text; day date; gift_idea text?; sent bool|day|"A birthday is coming"|1d|the birthdays I must remember|I forget birthdays every year
Vaccines|baby|shot|name text; due_on date; given bool|due_on|"A vaccine is due"|3d|my baby's vaccines|I do not want to miss a vaccine date
Documents|key|doc|name text; expires date; renewed bool|expires|"A document expires soon"|14d|my document expiry dates|my passport expired once and I never want that again
Library books|book|loan|title text; return_on date; returned bool|return_on|"Return the book"|1d|my library books|I always pay library fines
Car papers|car|paper|name text; expires date; renewed bool|expires|"Car paper expires soon"|7d|my car papers|I forget road tax and insurance
Assignments|school|work|title text; subject text?; deadline date; done bool|deadline|"An assignment is due"|1d|my assignments|I miss deadlines
Loan instalments|coin|instalment|name text; amount money; due date; paid bool|due|"An instalment is due"|3d|my loan instalments|I hate late fees
Warranties|tool|warranty|item text; ends date; claimed bool|ends|"A warranty ends soon"|30d|my warranties|I never remember when warranties end
Tasks with dates|list|dated|title text; due date; done bool|due|"A task is due"|1d|my dated tasks|I forget due dates
`);
export const LD = LR.map(([app, icon, tbl, fields, dateF, msg, lead, trk, wish]) => ({ key: 'l_' + app, app, icon, tbl, fields: fields.split(';').map(x => x.trim()), dateF, msg: msg.replace(/"/g, ''), lead, trk, wish, theme: theme('l_' + app) }));
export const L = {
  name: 'datereminder',
  styles: ['detailed', 'multi_feature', 'short', 'typos', 'vague'],
  params: (d, r) => ({ name: d.app, icon: d.icon, theme: d.theme, lead: d.lead }),
  base(s) {
    const { d, p } = s, T = d.tbl, ids = s.ids;
    const fnames = d.fields.map(f => f.split(' ')[0]), boolF = d.fields.find(f => /\bbool$/.test(f)).split(' ')[0], first = fnames[0], dateF = d.dateF;
    const num = d.fields.find(f => /\bmoney\b/.test(f));
    const ld = ids.includes('lead') ? ` - ${p.lead}` : '';
    const lines = [[2, `remind "${d.msg}" at ${T}.${dateF}${ld}${ld ? ' at 9:00' : ''}`]];
    if (num) lines.push([2, `count(${T} where ${boolF} = no) "open," sum(${T}.${num.split(' ')[0]} where ${boolF} = no) "in total" head`]);
    else lines.push([2, `count(${T} where ${boolF} = no) "open" head`]);
    lines.push([3, `each ${T} where ${boolF} = no sort ${dateF} as r\n  row card gap 2 tap edit r swipe remove r\n    toggle r.${boolF}\n    stack grow\n      r.${first} bold\n      r.${dateF} size small color if(r.${dateF} < today, bad, muted)`], [4, `form ${T}`], [7, `"Done" faint\nlist ${T} where ${boolF} = yes`]);
    return { tables: [{ name: T, fields: [...d.fields] }], lines, say: [`${d.trk} with ${d.fields.map(f => pretty(f.split(' ')[0])).slice(0, -1).join(', ')} and a tick when done, and a reminder on the ${pretty(dateF)} date`, `a list of ${d.trk} (${d.fields.map(f => pretty(f.split(' ')[0])).join(', ')}) with a reminder`] };
  },
  opts: {
    lead: { make(s) { const days = s.p.lead.replace('d', ''); return { say: [`the reminder ${days} day${days === '1' ? '' : 's'} before at 9 am`, `remind me ${days} day${days === '1' ? '' : 's'} ahead`], edit: [`remind me ${days} day${days === '1' ? '' : 's'} before instead of on the day`, `make the reminder come ${days} day${days === '1' ? '' : 's'} earlier`], rm: [] }; } },
  },
  np: s => [`a reminder app for ${s.d.trk}`, `an app that reminds me about ${s.d.trk}`, `a list of ${s.d.trk} with reminders`],
  npShort: s => [`a ${low(s.d.app)} reminder app`, `a ${low(s.d.app)} tracker`],
  imp: s => [`remind me about ${s.d.trk}`, `keep ${s.d.trk} and remind me`],
  impShort: s => [`remind me about ${s.d.trk}`],
  wish: s => s.d.wish,
};

// ring counters reuse the count-log domains
export const HD = BD.map(d => ({ ...d, key: 'h_' + d.key }));
export const ARCHS = [[H, HD, 8, 4], [I, ID, 10, 4], [J, JD, 10, 4], [K, KD, 10, 4], [L, LD, 8, 4]];
