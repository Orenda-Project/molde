// c2: request wording. Hand-written casual English phrasings per edit kind (40 or more each).
// Slots are filled only with names taken from the actual program (labels, field names, options, numbers):
//   {X} {Y} noun phrases for things (with article: "the bar chart", 'the "Undo" button')
//   {N} new label   {o} old name   {n} new name   {O} new option   {F} the pick   {A} {B} existing options
//   {V} value   {S} setting   {T} time or section title   {L} list of titles   {R} reminder   {K} quick values
// Typos in the template words are on purpose (a few per kind); more are injected by typo().
export const T = {
  remove: [
    'remove {X}', 'delete {X}', 'get rid of {X}', 'drop {X}', 'take {X} out', 'can you remove {X}?', 'could you delete {X} please',
    'please remove {X}', "i dont need {X} anymore", "i don't want {X}", '{X} can go', '{X} has to go', 'lose {X}', 'cut {X}',
    'remove {X} please', 'i want {X} gone', 'kill {X}', 'no need for {X}', 'take away {X}', 'can we drop {X}?', 'scrap {X}',
    "i'd like {X} gone", '{X} is useless, remove it', "{X} isnt needed, delete it", 'clear out {X}', 'strip out {X}', 'ditch {X}',
    'pls remove {X}', 'remvoe {X}', 'delte {X}', 'just remove {X}', 'i think we can do without {X}', 'this is too cluttered, remove {X}',
    'remove {X} from the screen', 'remove {X} from the app', 'hey, can you get rid of {X}', 'would you mind removing {X}?',
    'i never use {X}, delete it', 'not using {X}, remove it', '{X} is in the way, remove it', 'out with {X}', 'make {X} disappear',
    'stop showing {X}', "dont show {X}", 'can you take {X} off?', 'delete {X} from here', 'i do not need {X}, please take it out',
  ],
  remove_dep: [
    'remove {X} and everything that uses it', 'delete {X} and whatever depends on it', 'get rid of {X}, and anything that uses it too',
    'drop {X} along with the things that use it', 'take out {X} and what is built on it', 'i dont track {X} anymore, remove it and what uses it',
    '{X} has to go, with everything that uses it', 'remove {X}, the parts that need it can go too', 'delete {X}, and the lines that use it',
    'no more of {X}, take away what uses it as well', 'can you delete {X} and what relies on it?', 'remove {X} and its totals and charts',
  ],
  above: [
    'put {X} above {Y}', 'move {X} above {Y}', '{X} should come before {Y}', '{X} first, then {Y}', 'show {X} above {Y}',
    'can you put {X} on top of {Y}?', '{X} above {Y} please', 'i want {X} before {Y}', 'move {X} up, above {Y}', '{X} goes above {Y}',
    'put {X} over {Y}', 'bring {X} above {Y}', 'move {X} up above {Y}', 'could {X} be above {Y}?', 'swap them so {X} is over {Y}',
    'i want to see {X} before {Y}', '{X} should be higher than {Y}', 'place {X} ahead of {Y}', 'pls put {X} above {Y}', 'put {X} abvoe {Y}',
    'move {X} to just above {Y}', 'let {X} come first, before {Y}', '{X} should sit above {Y}', 'reorder: {X} then {Y}',
  ],
  below: [
    'put {X} below {Y}', 'move {X} under {Y}', '{X} should come after {Y}', '{X} goes under {Y}', 'show {X} after {Y}', '{X} below {Y} please',
    'move {X} down below {Y}', 'can you put {X} underneath {Y}?', 'i want {X} after {Y}', '{X} beneath {Y}', 'shift {X} to just under {Y}',
    'send {X} below {Y}', 'could {X} go under {Y}?', 'place {X} after {Y}', 'push {X} down under {Y}', '{X} should be lower than {Y}',
    'pls move {X} below {Y}', 'move {X} belwo {Y}', '{X} comes after {Y}', 'reorder: {Y} then {X}', 'i want {Y} first and {X} under it',
    'drop {X} below {Y}', 'put {X} right after {Y}', 'let {X} sit below {Y}',
  ],
  first: [
    'move {X} to the top', 'put {X} first', '{X} should be at the top', 'make {X} the first thing', 'show {X} first', 'i want {X} at the top',
    '{X} on top please', 'bring {X} to the top', 'move {X} up to the very top', 'put {X} before everything else', 'can you move {X} up to the top?',
    '{X} should come first', 'pls put {X} on top', 'make {X} show first', 'move {X} to the front', 'i want to see {X} first thing',
  ],
  last: [
    'move {X} to the bottom', 'put {X} last', '{X} should be at the bottom', '{X} goes at the end', 'show {X} last', 'send {X} to the bottom',
    'i want {X} at the bottom', 'put {X} at the very end', 'can you move {X} down to the bottom?', '{X} should come last', 'move {X} to the end',
    'pls put {X} at the bottom', 'push {X} to the bottom', 'make {X} the last thing', 'move {X} dwon to the bottom', 'i want {X} under everything',
  ],
  rename: [
    'rename {X} to "{N}"', 'rename {X} to {N}', 'call {X} "{N}" instead', '{X} should say {N}', 'make {X} say {N}', 'change {X} to say "{N}"',
    'change the text on {X} to {N}', '{X} should read "{N}"', 'can you rename {X} to {N}?', 'relabel {X} as {N}', 'change {X} to {N}',
    'let {X} say {N}', 'the label of {X} should be {N}', 'update {X} so it says {N}', 'make {X} read {N}', 'i want {X} to say {N}',
    'could {X} be called {N}?', "i'd rather {X} said {N}", 'set the text of {X} to {N}', 'put "{N}" on {X}', 'swap the word on {X} for {N}',
    'can {X} say {N} instead?', 'the wording on {X} is off, use {N}', 'change the name of {X} to {N}', 'retitle {X} as {N}',
    'text on {X} should be "{N}"', 'rename {X} "{N}"', 'rnemae {X} to {N}', 'chnage {X} to {N}', 'pls call {X} {N}', 'use "{N}" as the label for {X}',
    'make {X} say {N} instead', 'better if {X} said {N}', 'rename it, {X} should be {N}', 'i keep misreading {X}, call it {N}', 'switch {X} to {N}',
    'update the label: {X} becomes {N}', 'can you change {X} so it reads {N}?', '{X} -> {N}', 'edit the text of {X}, make it "{N}"',
    'make the wording on {X} "{N}"', 'let us call {X} {N}',
  ],
  rename_title: [
    'call this app {N}', 'rename the app to {N}', 'the app name should be {N}', 'change the app name to "{N}"', 'name it {N}', 'rename this to {N}',
    "let's call the app {N}", 'make the title {N}', 'title should be "{N}"', 'change the title to {N}', 'can you call the app {N}?', 'i want the app called {N}',
    'rename app {N}', 'pls rename the app: {N}',
  ],
  rename_field: [
    'rename {o} to {n}', 'rename the {o} field to {n}', 'call {o} {n} instead', '{o} should be called {n}', 'change {o} to {n}', 'make {o} be {n}',
    'can you rename {o} to {n}?', 'i want {o} called {n}', 'rename {o} -> {n}', 'the {o} field should be named {n}', 'turn {o} into {n}',
    '{o} to {n} please', 'rename field {o} to {n}', 'relabel the {o} column as {n}', 'change the name of {o} to {n}', 'rename {o} to {n} but keep my data',
    'rename {o} to {n}, keep the old entries', "call the {o} {n}, don't lose anything", '{o} is the wrong name, make it {n}', 'i prefer {n} over {o}',
    'can {o} be {n} instead?', 'rename the {o} box to {n}', 'use {n} instead of {o}', '{o}: rename to {n}', 'rename {o} as {n}', 'the {o} field is really {n}',
    'make the {o} field {n}', 'rnaem {o} to {n}', 'chnage {o} to {n}', 'update the field name {o} to {n}', 'i meant {n} not {o}',
    'wrong name, {o} should be {n}', 'keep the numbers but call {o} {n}', 'rename {o} to {n}, keeping what i entered', 'switch {o} over to {n}',
    'pls rename {o} to {n}', 'could you rename {o} to {n}?', 'the name {o} is confusing, call it {n}', 'call it {n} rather than {o}', 'rename the {o} to {n} please',
  ],
  add_option: [
    'add {O} to {F}', 'add {O} as an option', 'add {O} as an option to {F}', 'add {O} to the choices for {F}', 'also let me pick {O} for {F}',
    'i need {O} too in {F}', 'can you add {O} to {F}?', 'put {O} in {F}', 'include {O} in {F}', '{F} needs {O} as an option', 'add {O} option',
    'add an option called {O}', 'i want to choose {O} too', 'need one more choice: {O}', 'add {O} to the list of {F}', 'throw {O} into {F}',
    '{O} is missing from {F}, add it', 'also add {O}', 'one more for {F}: {O}', 'let me pick {O} as well', 'add {O} next to the others',
    'a new one for {F}: {O}', 'append {O} to {F}', 'add {O} to the {F} choices', 'make {O} one of the choices for {F}', 'add {O} to {F} please',
    'can i also pick {O}?', 'add the option {O}', 'add {O} too', 'ad {O} to {F}', 'add {O} to hte {F}', 'extra choice {O}',
    '{F} should have {O} as well', 'there should be {O} as a choice', 'pls add {O}', 'i also have {O}, add it', "sometimes it's {O}, so add that to {F}",
    'add another one: {O}', 'give me {O} as another choice', 'more choices: {O}', '{F}: add {O}', 'add {O} alongside {A} and {B}',
    'add {O} with {A} and {B}', 'i have {O} as well as {A} and {B}, add it',
  ],
  setting_value: [
    'make {S} {V}', 'set {S} to {V}', 'change {S} to {V}', '{S} should be {V}', 'i want {S} to be {V}', 'make my {S} {V} instead', 'update {S}: {V}',
    '{S} is {V} now', 'can you set {S} to {V}?', '{S} -> {V}', "i changed my mind, {S} is {V}", 'go with {V} for {S}', "let's make {S} {V}",
    'now {S} is {V}', 'pls change {S} to {V}', 'chnage {S} to {V}', 'set {S} to {V} please', '{S}: {V}', 'make {S} equal {V}', 'switch {S} to {V}',
    'the {S} needs to be {V}', 'can {S} be {V} instead?', 'adjust {S} to {V}', 'edit {S}, make it {V}',
    'new {S}: {V}', 'my {S} is {V} from now on', 'set {S} to {V} from now',
  ],
  setting_up: ['increase {S} to {V}', 'raise {S} to {V}', 'bump {S} up to {V}', 'make {S} bigger, {V}', 'up {S} to {V}', 'push {S} up to {V}'],
  setting_down: ['lower {S} to {V}', 'reduce {S} to {V}', 'drop {S} down to {V}', 'make {S} smaller, {V}', 'cut {S} to {V}', 'bring {S} down to {V}'],
  range: [
    'let me enter up to {V} for {F}', 'the {F} limit should be {V}', 'raise the max for {F} to {V}', 'allow {F} up to {V}', 'max {F} should be {V}',
    '{F} can go up to {V}', 'make the highest {F} {V}', 'set the top of the {F} range to {V}', 'cap {F} at {V}', 'change the {F} max to {V}',
    'i need {F} to go as high as {V}', 'the biggest {F} should be {V}', 'pls set the {F} limit to {V}', 'chnage the {F} max to {V}', 'limit {F} to {V}',
    'maximum {F}: {V}', 'make {V} the most i can enter for {F}', '{F} max {V}', 'let {F} reach {V}', 'update the {F} range, up to {V}',
    'the {F} range should end at {V}', 'i go past the {F} limit, make it {V}',
  ],
  quick_add: [
    'add {V} to the quick buttons', 'i need a {V} quick button too', 'add a {V} button to the quick add', 'put {V} in the quick buttons', 'one more quick button: {V}',
    'also give me a {V} quick button', 'add {V} to the quick add buttons', 'quick button for {V} please', 'can you add {V} to the quick ones?', 'add a one tap {V}',
  ],
  quick_change: [
    'change {A} to {B} in the quick buttons', 'replace the {A} button with {B}', 'swap {A} for {B} on the quick buttons', 'make the quick button that adds {A} add {B} instead',
    'the quick button for {A} should be for {B}', 'turn {A} into {B} in the quick add', 'i use {B} not {A}, change the quick button', 'quick button {A} -> {B}',
    'change the quick add from {A} to {B}', 'update the quick button {A}, make it {B}',
  ],
  quick_set: [
    'make the quick buttons {K}', 'set the quick buttons to {K}', 'quick buttons should be {K}', 'change the quick add to {K}', 'i want quick buttons {K}',
  ],
  time_set: [
    'move {R} to {T}', 'remind me at {T} instead', 'change the reminder time to {T}', 'make {R} go off at {T}', 'set the reminder to {T}', 'reminder at {T} please',
    'push {R} to {T}', '{R} should be at {T}', 'can you move {R} to {T}?', 'chnage {R} to {T}', 'i wake up later, make {R} {T}', 'reschedule {R} to {T}',
    'set {R} for {T}', 'shift {R} to {T}', 'ping me at {T} for {R}', 'update {R}: {T}',
  ],
  time_every: [
    'make {R} every {T}', 'remind me every {T} instead', 'change {R} to every {T}', '{R} should repeat every {T}', 'set {R} to every {T}',
    'change how often {R} goes off, every {T}', 'make the reminder interval {T}',
  ],
  time_before: ['remind me {T} before instead', 'make {R} {T} before', 'change {R} to {T} before the date', 'i need {R} {T} ahead, not the old gap'],
  time_month: ['make {R} go off on day {T}', 'move {R} to the {T} of the month', 'change the monthly day for {R} to {T}'],
  timer_set: ['make the timer {V}', 'set the timer to {V}', 'timer should be {V}', 'change the timer to {V}', 'i want a {V} timer', 'pls make the timer {V}', 'can the timer be {V}?', 'timer: {V}'],
  target_set: [
    'make the target for {X} {V}', 'set the target of {X} to {V}', 'change the goal on {X} to {V}', '{X} should aim for {V}', 'the goal for {X} is {V} now',
    'aim for {V} on {X}', 'change the target on {X} to {V}', 'make {X} aim at {V}', 'update the goal of {X}: {V}', 'set {X} goal to {V}',
  ],
  wrap: [
    'put {X} in a section called {T}', 'wrap {X} in a section titled {T}', 'give {X} its own section named {T}', 'group {X} under a heading {T}',
    'put {X} under the {T} heading', '{X} needs its own card called {T}', 'add the section {T} around {X}', 'make the {T} section for {X}',
    'separate {X} into a section: {T}', 'can you put {X} in a card titled {T}?', '{X} should sit under the {T} title', 'box {X} up in a section called {T}',
    'make {X} its own section, call it {T}', 'frame {X} with the {T} header', 'pls put {X} in the {T} section', 'put {X} in a secton called {T}',
    'i want {X} in its own card with the title {T}', 'give {X} a heading: {T}', 'section for {X}, name it {T}', 'make {X} stand out in the {T} section',
  ],
  split: [
    'split this into sections: {L}', 'organize into sections called {L}', 'group things into sections: {L}', 'make sections for {L}',
    'separate the screen into {L} sections', 'split the screen into cards for {L}', 'i want sections: {L}', 'tidy this up with sections, {L}',
    'add section headings: {L}', 'break this up into sections ({L})', 'group these into {L}', 'can you split this into sections? {L}',
    'put things in sections named {L}', 'give the screen sections: {L}', 'this is one long mess, make sections {L}', 'pls add sections {L}',
    'sections please: {L}', 'divide the screen into {L}', 'make it look organised with sections for {L}', 'use sections: {L}',
  ],
};

// typos injected into template words only (never into slot values)
export function typo(text, r) {
  const ws = text.split(' ');
  const idx = ws.map((w, i) => [w, i]).filter(([w]) => /^[a-z]{5,}$/.test(w));
  if (!idx.length) return text;
  const [w, i] = r.pick(idx);
  const k = 1 + r.int(0, w.length - 4);
  const mode = r.int(0, 2);
  let t;
  if (mode === 0) t = w.slice(0, k) + w[k + 1] + w[k] + w.slice(k + 2);
  else if (mode === 1) t = w.slice(0, k) + w.slice(k + 1);
  else t = w.slice(0, k) + w[k] + w.slice(k);
  if (t === w) return text;
  ws[i] = t; return ws.join(' ');
}

// synonyms for button and section words: first word or whole label -> alternatives
export const SYN = {
  add: ['Log', 'New', 'Record', 'Save', 'Enter', 'Put in'], new: ['Add', 'Fresh', 'Start'], log: ['Add', 'Record', 'Note', 'Enter'], save: ['Keep', 'Done', 'Store', 'Add'],
  start: ['Begin', 'Go', 'Kick off'], stop: ['End', 'Pause', 'Finish'], reset: ['Clear', 'Start over', 'Zero'], clear: ['Reset', 'Wipe', 'Empty'],
  done: ['Finished', 'Complete', 'All done', 'Tick off'], undo: ['Take back', 'Undo last', 'Step back', 'Revert'], delete: ['Remove', 'Erase'], remove: ['Delete', 'Take out'],
  next: ['Go on', 'Continue', 'Forward'], back: ['Previous', 'Go back', 'Return'], previous: ['Back', 'Earlier', 'Go back'], edit: ['Change', 'Update', 'Fix'],
  paid: ['Settled', 'Cleared', 'Mark paid', 'Received'], ready: ['Done', 'Finished', 'Ready now', 'Complete'], delivered: ['Handed over', 'Sent', 'Dropped off'],
  sold: ['Sold out', 'Gone', 'Sale'], returned: ['Given back', 'Came back', 'Back'], collected: ['Picked up', 'Taken', 'Got it'], fed: ['Fed today', 'Given food', 'Done feeding'],
  watered: ['Water done', 'Given water', 'Watered today'], play: ['Go', 'Start game', 'Begin'], roll: ['Throw', 'Spin', 'Go'], spin: ['Roll', 'Go', 'Twirl'],
  check: ['Tick', 'Mark', 'Done'], renew: ['Extend', 'Renew now'], approve: ['Accept', 'Okay it', 'Pass'], decline: ['Reject', 'Say no', 'Turn down'],
  finished: ['Done', 'Complete', 'Ended'], skip: ['Pass', 'Skip it', 'Leave'], lap: ['Split', 'Mark lap', 'Lap time'], won: ['Win', 'I won', 'Victory'], lost: ['Loss', 'I lost', 'Defeat'],
  details: ['More', 'Info', 'See more'], again: ['Once more', 'Repeat', 'Redo'], focus: ['Concentrate', 'Deep work', 'Start focus'], pass: ['Passed', 'Okay', 'Good'], fail: ['Failed', 'Not okay', 'Bad'],
  present: ['Here', 'In', 'Attended'], missed: ['Skipped', 'Not done', 'Forgot'], given: ['Handed out', 'Gave', 'Passed on'], got: ['Received', 'Took', 'Collected'],
  buy: ['Purchase', 'Get', 'Order'], bought: ['Purchased', 'Got it', 'Ordered'], order: ['Request', 'Book', 'Place order'], send: ['Post', 'Submit', 'Share'],
  update: ['Change', 'Refresh', 'Edit'], open: ['Start', 'Show', 'Unlock'], close: ['Shut', 'End', 'Lock'], join: ['Sign up', 'Enter', 'Add me'], pick: ['Choose', 'Select', 'Draw'],
  mark: ['Tick', 'Note', 'Flag'], home: ['Back home', 'Main', 'Start'], more: ['Extra', 'Add more', 'Plus'], refill: ['Top up', 'Fill again', 'Refilled'],
};
export const SEC_SYN = {
  'last 7 days': ['This week', 'Past week', 'Seven days', 'Weekly'], 'this week': ['Weekly', 'Past 7 days', 'Week so far'], today: ['Right now', 'Today so far', 'Daily'],
  'this month': ['Monthly', 'Month so far', 'Past 30 days'], history: ['Past entries', 'Log', 'Record'], trend: ['Trends', 'Progress', 'Over time'], progress: ['Trend', 'How it is going', 'Goals'],
  summary: ['Overview', 'Totals', 'At a glance'], totals: ['Summary', 'Numbers', 'Overview'], overview: ['Summary', 'At a glance', 'Totals'], upcoming: ['Coming up', 'Next up', 'Soon'],
  'coming up': ['Upcoming', 'Next up', 'Soon'], leaderboard: ['Standings', 'Scores', 'Ranking'], standings: ['Leaderboard', 'Table', 'Scores'], scores: ['Results', 'Points', 'Standings'],
  results: ['Scores', 'Outcomes', 'Standings'], items: ['Things', 'Stock', 'Entries'], entries: ['Records', 'Log', 'Items'], purchases: ['Buys', 'Spending', 'Bought items'],
  weight: ['Body weight', 'Weigh-ins', 'Scale'], 'per day': ['Daily', 'Each day', 'By day'], 'by kind': ['By type', 'Per kind', 'Kinds'], 'by category': ['By type', 'Per category', 'Categories'],
  'by subject': ['Per subject', 'Subjects', 'Each subject'], 'by status': ['Per status', 'Statuses', 'Stages'], 'by type': ['By kind', 'Types', 'Per type'], 'by topic': ['Per topic', 'Topics', 'Each topic'],
  mood: ['Moods', 'How I felt', 'Feelings'], latest: ['Newest', 'Recent', 'Last ones'], saved: ['Kept', 'Stored', 'Saved ones'], extras: ['Bonus', 'More', 'Other things'],
  field: ['Pitch', 'Ground', 'Playing field'], shares: ['Splits', 'Portions', 'Who pays'], 'per person': ['Each person', 'By person', 'Who has what'], 'who owes': ['Dues', 'Who has to pay', 'Owed'],
  'shopping list': ['To buy', 'Buy list', 'Things to buy'], ingredients: ['What goes in', 'Items needed', 'Shopping'], readings: ['Measurements', 'Values', 'Logged readings'], causes: ['Reasons', 'Triggers', 'Why'],
  money: ['Cash', 'Funds', 'Spending'], sales: ['Sold', 'Takings', 'Revenue'], finished: ['Completed', 'Done', 'Wrapped up'], paid: ['Settled', 'Cleared', 'Received'], done: ['Finished', 'Completed', 'Ticked off'],
  scoreboard: ['Scores', 'Points', 'Standings'], tonight: ['This evening', 'Evening', 'Later today'], pace: ['Speed', 'Rate', 'Tempo'], temperature: ['Temp', 'Heat', 'Readings'],
};
// extra word-level swaps used inside longer titles
export const WORD_SYN = {
  revenue: 'Income', income: 'Earnings', costs: 'Expenses', spending: 'Expenses', expenses: 'Spending', shop: 'Store', store: 'Shop', tracker: 'Log', log: 'Tracker', diary: 'Journal',
  journal: 'Diary', budget: 'Spending plan', planner: 'Plan', routine: 'Schedule', schedule: 'Timetable', list: 'Checklist', counter: 'Tally', tally: 'Counter', book: 'Ledger',
  ledger: 'Book', notes: 'Memos', records: 'Entries', sales: 'Takings', stock: 'Inventory', inventory: 'Stock', fees: 'Dues', chart: 'Graph', sleep: 'Rest', water: 'Hydration',
  workout: 'Training', fitness: 'Training', study: 'Learning', homework: 'Assignments', repairs: 'Fixes', orders: 'Requests', visitors: 'Guests', guests: 'Visitors', trips: 'Journeys',
  garden: 'Plants', plants: 'Garden', habits: 'Routines', goals: 'Targets', savings: 'Nest egg', loans: 'Debts', debts: 'Loans', gifts: 'Presents', farm: 'Field', pantry: 'Larder',
};
