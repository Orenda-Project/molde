// Scripted chat requests for the demo. There is no trained model yet, so each request maps to a
// program change written by hand: either a real edit pair from lang/examples/edits (the request
// text and the after-program are used as they are) or a small patch to the current program.
// Each request carries the sentence the reply shows (`says`); tests/check.mjs checks that every
// result type-checks, is data-safe and gets its sentence.

// Real edit pairs from lang/examples/edits apply only when the running program equals their
// before.mo. Every demo program is now the demo's own, so none match and none are offered; the
// mechanism stays for programs that are the language's examples.
export const EDIT_PAIRS = {};
export const EDIT_FILES = Object.values(EDIT_PAIRS).flat();
const PAIR_SAYS = {};

// patches: [find, replace] pairs applied in order to the current source; the request is offered
// only while every `find` is still present
export const PATCHES = {
  water: [
    { text: 'Change the quick buttons to 200, 330 and 500 ml', says: 'Quick buttons are now 200, 330 and 500 ml.',
      ops: [['button "+ 250 ml" fill accent grow tap add drink ml = 250', 'button "+ 330 ml" fill accent grow tap add drink ml = 330'], ['button "+ 150 ml" grow tap add drink ml = 150', 'button "+ 200 ml" grow tap add drink ml = 200'], ['Tap + 250 ml when', 'Tap + 330 ml when']] },
    { text: 'Add a note to each drink', says: 'Each drink can now have a note. It shows under the drink in today\'s list.',
      ops: [['kind pick Water|Tea|Juice|Milk = Water', 'kind pick Water|Tea|Juice|Milk = Water, note text?'], ['      d.kind grow\n', '      stack grow gap 0\n        d.kind\n        d.note faint\n']] },
    { text: "Call the goal 'Target for today'", says: 'The goal is now called "Target for today".',
      ops: [['"Daily goal (ml)"', '"Target for today (ml)"'], ['"of" goal "ml today"', '"Target for today:" goal "ml"']] },
  ],
  habits: [
    { text: 'Show the last 4 weeks instead of 6', says: 'The grid now shows the last 4 weeks.',
      ops: [['"Last 6 weeks"', '"Last 4 weeks"'], ['count(check last 42 days) * 100 / (n * 42)', 'count(check last 28 days) * 100 / (n * 28)'], ['dayname(today - 42 + it)', 'dayname(today - 28 + it)'], ['each days last 42 days', 'each days last 28 days']] },
    { text: 'Let me write why each habit matters', says: 'Each habit can now have a reason. It shows under its name.',
      ops: [['table habit name text', 'table habit name text, why text?'], ['          h.name bold\n', '          h.name bold\n          h.why faint\n']] },
  ],
  budget: [
    { text: 'Add a Rent category', says: 'Rent is now one of the categories.', ops: [['Health|Other = Groceries', 'Health|Rent|Other = Groceries']] },
    { text: 'Let me add a note to each expense', says: 'Each expense can now have a note. It shows next to the category.',
      ops: [['|Other = Groceries\n', '|Other = Groceries, note text?\n'], ['        r.category faint', '        r.category r.note faint']] },
  ],
  exercise: [
    { text: 'Add a 90 second rest timer', says: 'A 90 second rest timer is now under the buttons.',
      ops: [['\nif adding\n', '\ntimer 90s, "Rest between sets"\nif adding\n']] },
    { text: 'Track how hard each set felt', says: 'Each set can now say how it felt: easy, okay or hard.',
      ops: [['reps num 1..100', 'reps num 1..100, felt pick Easy|Okay|Hard = Okay'], ['      r.sets "x" r.reps color muted', '      r.sets "x" r.reps r.felt color muted']] },
  ],
  journal: [
    { text: 'Add one thing I am grateful for', says: 'Each entry can now hold one thing you are grateful for.',
      ops: [['table entry mood num 1..5, note long', 'table entry mood num 1..5, note long, grateful text?'], ['    field d.note "What happened today?"\n', '    field d.note "What happened today?"\n    field d.grateful "One thing you are grateful for"\n'], ['      r.note\n', '      r.note\n      r.grateful color muted\n']] },
  ],
  tasbeeh: [
    { text: 'Add Astaghfirullah to the phrases', says: 'Astaghfirullah is now one of the phrases.', ops: [['AllahuAkbar = SubhanAllah', 'AllahuAkbar|Astaghfirullah = SubhanAllah']] },
  ],
  cricket: [
    { text: 'Show the extras on the scoreboard', says: 'The scoreboard now shows the extras.', ops: [['  "Last six balls, newest first" faint\n', '  "Last six balls, newest first" faint\n  "Extras:" count(ball today where wide = yes) "wides" faint\n']] },
  ],
  savings: [
    { text: 'Change the buttons to 2,000 and 10,000', says: 'The quick buttons now add 2,000 and 10,000.',
      ops: [['button "+ 1,000" fill accent grow tap add deposit amount = 1000', 'button "+ 2,000" fill accent grow tap add deposit amount = 2000'], ['button "+ 5,000" grow tap add deposit amount = 5000', 'button "+ 10,000" grow tap add deposit amount = 10000'], ['Tap + 1,000 to', 'Tap + 2,000 to']] },
  ],
  pomodoro: [
    { text: 'Add a 5 minute break timer', says: 'A 5 minute break timer is now under the focus timer.',
      ops: [['  button "Reset" width 120 tap set going = no then set left = work\n', '  button "Reset" width 120 tap set going = no then set left = work\ntimer 5m, "Break"\n']] },
  ],
  attendance: [
    { text: 'Show the class in 4 columns', says: 'The class now shows in 4 columns.', ops: [['  grid 3 gap 1\n', '  grid 4 gap 1\n']] },
  ],
  reading: [
    { text: 'Let me search my books by title', says: 'You can now search your books by title.',
      ops: [['state d new book\n', 'state d new book\nstate q text = ""\n'], ['each book where status = tab sort title as b', 'field q "Search titles"\neach book where status = tab and has(title, q) sort title as b']] },
  ],
  todo: [
    { text: 'Add a priority: low, normal or high', says: 'Each task now has a priority: low, normal or high.',
      ops: [['tag pick Home|Work|Other = Home', 'tag pick Home|Work|Other = Home, priority pick Low|Normal|High = Normal'], ['    choice d.tag\n', '    choice d.tag\n    choice d.priority\n']] },
  ],
  medicine: [
    { text: 'Show how many days I took each one this week', says: 'Each medicine now shows how many days you took it this week.',
      ops: [['          m.time m.dose faint\n', '          m.time m.dose faint\n          text "Taken on" count(m.taken week) "days this week" faint\n']] },
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

// requests that make sense for this program now: [{text, says, apply(src) -> newSrc}]
export function requestsFor(id, src, sources) {
  const out = [];
  for (const name of EDIT_PAIRS[id] || []) {
    const before = sources['edit:' + name + ':before'], after = sources['edit:' + name + ':after'], req = sources['edit:' + name + ':request'];
    if (before && after && req && src.trim() === before.trim()) out.push({ text: req.trim(), says: PAIR_SAYS[name], apply: () => after });
  }
  for (const p of PATCHES[id] || []) {
    if (p.ops.every(([f]) => src.includes(f))) out.push({ text: p.text, says: p.says, apply: s => p.ops.reduce((acc, [f, r]) => acc.replace(f, r), s) });
  }
  const m = /^app "[^"]*"(?: [a-z]+)? (ocean|mint|plum|slate|ink)\b/.exec(src);
  if (m) {
    const to = NEXT[m[1]];
    out.push({ text: `Make it ${THEMES[to]}`, says: `The colours are now ${THEMES[to]}.`, apply: s => s.replace(/^(app "[^"]*"(?: [a-z]+)?) (ocean|mint|plum|slate|ink)\b/, `$1 ${to}`) });
  }
  return out.slice(0, 4);
}
export function newAppsFor(id) { return NEW_APPS.filter(n => n.to !== id).slice(0, 2); }
