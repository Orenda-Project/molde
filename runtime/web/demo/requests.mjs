// Scripted chat requests for the demo. There is no trained model yet, so each request maps to a
// program change written by hand: either a real edit pair from lang/examples/edits (the request
// text and the after-program are used as they are) or a small patch to the current program.
// Every result is checked by tests/check.mjs (it must type-check and keep data safe).

// real pairs: request.txt + after.mo, applied when the current program equals before.mo
export const EDIT_PAIRS = {
  pomodoro: ['06-add-goal'],
  todo: ['08-add-pick-field', '20-add-filter'],
  reading: ['09-add-search'],
  medicine: ['11-add-screen'],
};
export const EDIT_FILES = Object.values(EDIT_PAIRS).flat();

// patches: [find, replace] pairs applied in order to the current source; the request is offered
// only while every `find` is still present
export const PATCHES = {
  water: [
    { text: 'Add a note to each drink', ops: [['kind pick Water|Tea|Juice|Milk = Water', 'kind pick Water|Tea|Juice|Milk = Water, note text?'], ['      text d.kind grow', '      stack grow gap 0\n        text d.kind\n        text d.note faint']] },
    { text: 'Change the quick buttons to 200, 330 and 500 ml', ops: [['each [150, 250, 500]', 'each [200, 330, 500]']] },
    { text: "Call the goal 'Target for today'", ops: [['"Daily goal (ml)"', '"Target for today (ml)"']] },
  ],
  habits: [
    { text: 'Show the last 4 weeks instead of 10', ops: [['text "Last 10 weeks" head grow', 'text "Last 4 weeks" head grow'], ['each days last 70 days', 'each days last 28 days'], ['count(check last 70 days) * 100 / (n * 70)', 'count(check last 28 days) * 100 / (n * 28)']] },
    { text: 'Let me write why each habit matters', ops: [['table habit name text', 'table habit name text, why text?'], ['        text h.name bold\n', '        text h.name bold\n        text h.why faint\n']] },
  ],
  budget: [
    { text: 'Add a Rent category', ops: [['Health|Other = Groceries', 'Health|Rent|Other = Groceries']] },
    { text: 'Let me add a note to each expense', ops: [['= Groceries\n', '= Groceries, note text?\n'], ['        text r.category faint', '        text r.category r.note faint']] },
  ],
  exercise: [
    { text: 'Add a 90 second rest timer', ops: [['form lift, "Add set"\n', 'form lift, "Add set"\ntimer 90s, "Rest between sets"\n']] },
    { text: 'Track how hard each set felt', ops: [['reps num 1..100', 'reps num 1..100, felt pick Easy|Okay|Hard = Okay'], ['      text r.sets "x" r.reps color muted', '      text r.sets "x" r.reps r.felt color muted']] },
  ],
  journal: [
    { text: 'Add one thing I am grateful for', ops: [['table entry mood num 1..5, note long', 'table entry mood num 1..5, note long, grateful text?'], ['  field d.note "What happened today?"\n', '  field d.note "What happened today?"\n  field d.grateful "One thing you are grateful for"\n'], ['      text r.note\n', '      text r.note\n      text r.grateful color muted\n']] },
  ],
  tasbeeh: [
    { text: 'Count to 100 instead of 33', ops: [['setting target num = 33', 'setting target num = 100']] },
  ],
  cricket: [
    { text: 'Make it a 10 over match', ops: [['setting overs num = 20', 'setting overs num = 10']] },
  ],
  savings: [
    { text: 'Show my deposits as bars for each month', ops: [['quick deposit, amount', 'bars deposit last 6 months by month, sum(it.amount), monthname(it.key)\nquick deposit, amount']] },
  ],
  attendance: [
    { text: 'Show the class in 3 columns', ops: [['grid 4 gap 1', 'grid 3 gap 1']] },
  ],
};

// "make me a new app" requests switch to another example
export const NEW_APPS = [
  { text: 'Make me an app to count my zikr', to: 'tasbeeh' },
  { text: 'I want to keep score in a cricket match', to: 'cricket' },
  { text: 'Help me track my monthly spending', to: 'budget' },
  { text: 'Make a tracker for daily habits', to: 'habits' },
  { text: 'I want to log how much water I drink', to: 'water' },
];

const THEMES = { ocean: 'blue', mint: 'green', plum: 'purple', slate: 'steel blue', ink: 'indigo' };
const NEXT = { ocean: 'mint', mint: 'plum', plum: 'ocean', slate: 'ocean', ink: 'plum' };

// requests that make sense for this program right now: [{text, apply(src) -> newSrc} | {text, to}]
export function requestsFor(id, src, sources) {
  const out = [];
  for (const name of EDIT_PAIRS[id] || []) {
    const before = sources['edit:' + name + ':before'], after = sources['edit:' + name + ':after'], req = sources['edit:' + name + ':request'];
    if (before && after && req && src.trim() === before.trim()) out.push({ text: req.trim(), apply: () => after });
  }
  for (const p of PATCHES[id] || []) {
    if (p.ops.every(([f]) => src.includes(f))) out.push({ text: p.text, apply: s => p.ops.reduce((acc, [f, r]) => acc.replace(f, r), s) });
  }
  const m = /^app "[^"]*"(?: [a-z]+)? (ocean|mint|plum|slate|ink)\b/.exec(src);
  if (m) {
    const to = NEXT[m[1]];
    out.push({ text: `Make it ${THEMES[to]}`, apply: s => s.replace(/^(app "[^"]*"(?: [a-z]+)?) (ocean|mint|plum|slate|ink)\b/, `$1 ${to}`) });
  }
  return out.slice(0, 4);
}
export function newAppsFor(id) { return NEW_APPS.filter(n => n.to !== id).slice(0, 2); }
