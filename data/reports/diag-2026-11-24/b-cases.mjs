// round 14: accent colour words are valid answers (green = mint, blue = ocean, purple = plum); `dark` is the fourth word of the app line
const ALIAS = { mint: ['mint', 'green'], ocean: ['ocean', 'blue'], plum: ['plum', 'purple'], ink: ['ink'] };
const theme = t => (b, a) => (ALIAS[t] || [t]).includes(hdr(a).theme);
const dark = () => (b, a) => hdr(a).mode === 'dark' || hdr(a).theme === 'ink';
const name = n => (b, a) => hdr(a).name === n;
const has = s => (b, a) => a.includes(s);
const hasNot = s => (b, a) => b.includes(s) && !a.includes(s);
const setting = (nm, v) => (b, a) => new RegExp(`^setting ${nm} \\w+ = ${v}\\b`, 'm').test(a);
const more = rx => (b, a) => (a.match(rx) || []).length > (b.match(rx) || []).length;
const fewer = rx => (b, a) => (a.match(rx) || []).length < (b.match(rx) || []).length;
const before = (rx1, rx2) => (b, a) => { const L = a.split('\n'); const i = L.findIndex(l => rx1.test(l)), j = L.findIndex(l => rx2.test(l)); return i >= 0 && j >= 0 && i < j; };
const newField = (t, nb) => (b, a) => { const f = s => ((s.match(new RegExp(`^table ${t} (.*)$`, 'm')) || [, ''])[1].split(',').length); return f(a) > f(b); };
const CHART = /^\s*(daybars|bars|trend|heat|pie|plot|draw)\b/gm, BIG = /\b(big|huge|large)\b/g;
export function hdr(p) { const m = p.match(/^app "([^"]*)"\s*(\w+)?\s*(\w+)?\s*(\w+)?/); return m ? { name: m[1], icon: m[2], theme: m[3], mode: m[4] } : {}; }
export const CASES = [
 ['demo/water.mo', 'theme', 'make it green', theme('mint')],
 ['demo/water.mo', 'title', 'call it Drink up', name('Drink up')],
 ['demo/water.mo', 'goal/default', 'change the goal to 3000', setting('goal', 3000)],
 ['demo/water.mo', 'remove', "remove the list of today's drinks", hasNot('each drink today')],
 ['demo/habits.mo', 'theme', 'change the colour to purple', theme('plum')],
 ['demo/habits.mo', 'theme-dark', 'dark theme', dark()],
 ['demo/habits.mo', 'add chart', 'add a bar chart of habits done each day this week', more(CHART)],
 ['demo/habits.mo', 'rename button', 'rename the Add habit button to New habit', (b, a) => a.includes('"New habit"') && !a.includes('"Add habit"')],
 ['demo/budget.mo', 'theme', 'make it blue', theme('ocean')],
 ['demo/budget.mo', 'add field', 'add a field for payment method', newField('spend')],
 ['demo/budget.mo', 'goal/default', 'change the monthly budget to 60000', setting('budget', 60000)],
 ['demo/budget.mo', 'title', 'call it Monthly spending', name('Monthly spending')],
 ['demo/tasbeeh.mo', 'theme', 'make it purple', theme('plum')],
 ['demo/tasbeeh.mo', 'goal/default', 'change the target to 100', setting('target', 100)],
 ['demo/tasbeeh.mo', 'add option', 'add Astaghfirullah to the phrases', has('Astaghfirullah')],
 ['demo/tasbeeh.mo', 'bigger', 'make the count bigger', more(BIG)],
 ['demo/savings.mo', 'theme', 'make it blue', theme('ocean')],
 ['demo/savings.mo', 'goal/default', 'change the goal to 500000', setting('goal', 500000)],
 ['demo/savings.mo', 'remove', 'remove the deposits list', fewer(/^\s*each deposit\b/gm)],
 ['demo/savings.mo', 'title', 'call it House fund', name('House fund')],
 ['c/attendance.model.mo', 'theme', 'make it green', theme('mint')],
 ['c/attendance.model.mo', 'title', 'rename it Class 5 attendance', name('Class 5 attendance')],
 ['c/attendance.model.mo', 'remove', 'remove the list at the bottom', fewer(/^\s*each student\b/gm)],
 ['c/attendance.model.mo', 'reorder', 'put the add student form at the top', before(/^form student/, /^\s*each student/)],
 ['c/journal.model.mo', 'theme', 'change the colour to green', theme('mint')],
 ['c/journal.model.mo', 'remove', 'remove the mood chart', hasNot('trend entry')],
 ['c/journal.model.mo', 'bigger', 'make the numbers bigger', more(BIG)],
 ['c/journal.model.mo', 'rename button', 'rename the Save entry button to Done', (b, a) => a.includes('"Done"') && !a.includes('"Save entry"')],
 ['c/reading.model.mo', 'theme', 'make it blue', theme('ocean')],
 ['c/reading.model.mo', 'add field', 'add a rating from 1 to 5 for each book', newField('book')],
 ['c/reading.model.mo', 'title', 'call it My books', name('My books')],
 ['c/reading.model.mo', 'reorder', 'show the add book form at the top', before(/^form book/, /^each book/)],
 ['c/medicine.model.mo', 'theme-dark', 'dark theme', dark()],
 ['c/medicine.model.mo', 'add chart', 'add a chart of medicines taken each day', more(CHART)],
 ['c/medicine.model.mo', 'title', 'rename it Pills', name('Pills')],
 ['c/medicine.model.mo', 'bigger', 'make the taken count bigger', more(BIG)],
 ['c/focus.model.mo', 'theme', 'make it green', theme('mint')],
 ['c/focus.model.mo', 'goal/default', 'change the focus time to 50 minutes', setting('work', '50m')],
 ['c/focus.model.mo', 'remove', 'remove the chart', hasNot('daybars')],
 ['c/focus.model.mo', 'reorder', 'put the list above the chart', before(/^list session/, /^daybars/)],
];
