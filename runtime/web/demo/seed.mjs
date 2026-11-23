// Deterministic lived-in data for the demo. Every row goes in through the evaluator's own
// addRow (the same path a form save takes), backdated with an explicit `at`, so screens open
// with a few weeks of history instead of empty states. Same seed, same data, every time.

// the demo clock: Thursday 26 November 2026, 15:30 in the viewer's own time zone (apps load with
// tz: 'local'), so every row below lands on the same local day and hour on any machine
export const NOW = new Date(2026, 10, 26, 15, 30).getTime();
const DAY = 86400000;

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const dayStart = n => new Date(2026, 10, 26 - n).getTime();            // local midnight, n days ago
const at = (n, h, m = 0) => new Date(2026, 10, 26 - n, h, m).getTime(); // n days ago at h:m local
const ymd = n => { const d = new Date(2026, 10, 26 + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const pick = (r, list) => list[Math.floor(r() * list.length)];

function helper(app, seed) {
  const r = rng(seed);
  const add = (table, values, ms) => { if (ms > NOW) return null; const row = app.addRow(table, values, ms); return row; };
  return { r, add };
}

export const SEEDS = {
  water(app) {
    const { r, add } = helper(app, 11);
    for (let n = 20; n >= 0; n--) {
      const count = n === 0 ? 5 : 5 + Math.floor(r() * 5);
      let h = 7 + r() * 1.5;
      for (let i = 0; i < count; i++) {
        const ml = pick(r, [150, 250, 250, 250, 330, 500]);
        const kind = r() < 0.7 ? 'Water' : pick(r, ['Tea', 'Tea', 'Juice', 'Milk']);
        add('drink', { ml, kind }, at(n, Math.floor(h), Math.floor((h % 1) * 60)));
        h += 1.2 + r() * 2;
        if (h > 22.5) break;
      }
    }
  },

  habits(app) {
    const { r, add } = helper(app, 22);
    const list = [['Read 20 pages', .78], ['Walk 8,000 steps', .62], ['Pray Fajr on time', .84], ['No phone after 11 pm', .48], ['Drink 8 glasses of water', .7], ['Stretch for 10 minutes', .55]];
    const ids = list.map(([name], i) => add('habit', { name }, at(75, 9, i)).id);
    for (let n = 69; n >= 1; n--) {
      const lift = (69 - n) / 69 * 0.12;               // a little better lately
      ids.forEach((id, i) => { if (r() < list[i][1] + lift) add('check', { habit: id }, at(n, 8 + i, 15)); });
    }
    [0, 2, 4].forEach(i => add('check', { habit: ids[i] }, at(0, 7 + i, 30)));   // today so far
  },

  budget(app) {
    const { r, add } = helper(app, 33);
    const cats = {
      Groceries: [['Imtiaz weekly shop', 5200, 9800], ['Vegetables and fruit', 900, 2200], ['Milk and eggs', 650, 1100], ['Bakery', 300, 900]],
      Bills: [['Electricity bill', 9800, 14500], ['Gas bill', 1800, 3600], ['Internet', 3200, 3200], ['Mobile package', 1200, 1500]],
      Transport: [['Careem', 450, 1400], ['Petrol', 3000, 6000], ['Rickshaw', 200, 450]],
      Eating_out: [['Biryani with friends', 1200, 2600], ['Chai and samosa', 150, 400], ['Pizza night', 2400, 3800]],
      Health: [['Pharmacy', 600, 2400], ['Doctor visit', 2000, 3500]],
      Other: [['Haircut', 600, 900], ['Gift for Ammi', 2500, 5000], ['Books', 800, 2200]],
    };
    const fixed = [['Bills', 0, 'Internet', 3200, 3], ['Bills', 0, 'Mobile package', 1300, 5], ['Bills', 0, 'Electricity bill', 12400, 9], ['Bills', 0, 'Gas bill', 2600, 11]];
    for (let month = 1; month >= 0; month--) {
      const days = month === 1 ? 31 : 26;              // October, then November up to the 26th
      for (const [cat, , what, amt, d] of fixed) add('spend', { what, amount: amt + Math.round(r() * 400), category: cat }, new Date(2026, month === 1 ? 9 : 10, d, 14).getTime());
      for (let d = 1; d <= days; d++) {
        const k = r() < 0.6 ? 1 + Math.floor(r() * 1.6) : 0;
        for (let i = 0; i < k; i++) {
          const cat = pick(r, ['Groceries', 'Groceries', 'Groceries', 'Transport', 'Transport', 'Eating_out', 'Eating_out', 'Health', 'Other']);
          const [what, lo, hi] = pick(r, cats[cat]);
          const amount = Math.round((lo + r() * (hi - lo)) / 10) * 10;
          add('spend', { what, amount, category: cat }, new Date(2026, month === 1 ? 9 : 10, d, 10 + Math.floor(r() * 10)).getTime());
        }
      }
    }
  },

  exercise(app) {
    const { r, add } = helper(app, 44);
    const plan = [[['Bench press', 47.5, 2.5, 8], ['Overhead press', 27.5, 1.25, 8], ['Push-ups', 0, 0, 15]],
                  [['Squat', 60, 2.5, 6], ['Deadlift', 80, 5, 5]],
                  [['Pull-ups', 0, 0, 6], ['Bench press', 47.5, 2.5, 8], ['Squat', 60, 2.5, 6]]];
    let s = 0;
    for (let n = 34; n >= 1; n--) {
      const wd = new Date(dayStart(n)).getDay();
      if (![1, 3, 5, 6].includes(wd) || r() < 0.15) continue;
      const week = Math.floor((34 - n) / 7);
      for (const [ex, kg, step, reps] of plan[s % 3]) add('lift', { exercise: ex, kg: kg + step * week, sets: 3, reps: reps + (r() < 0.3 ? 1 : 0) }, at(n, 18, 30));
      s++;
    }
    add('lift', { exercise: 'Bench press', kg: 60, sets: 3, reps: 8 }, at(0, 7, 10));
    add('lift', { exercise: 'Overhead press', kg: 35, sets: 3, reps: 7 }, at(0, 7, 30));
  },

  journal(app) {
    const { r, add } = helper(app, 55);
    const notes = [
      [1, 'Power was out most of the evening. Could not finish the assignment and went to bed annoyed.'],
      [2, 'Tired after a long day at work. Skipped the walk.'],
      [2, 'Argued with my brother about money. Need to talk again when we are both calm.'],
      [3, 'Ordinary day. Office, traffic, dinner with family.'],
      [3, 'Rain all afternoon. Read a few chapters and slept early.'],
      [3, 'Spent the evening fixing the bike. Not much else.'],
      [4, 'Good meeting with my manager. The new project is mine.'],
      [4, 'Long walk with Hira in F-9 park. Felt lighter afterwards.'],
      [4, 'Cooked biryani for everyone. Ammi said it was almost as good as hers.'],
      [5, 'Finished the course and got the certificate. Celebrated with chai and samosas.'],
      [5, 'Cousins came over, laughed until midnight.'],
    ];
    let mood = 3;
    for (let n = 29; n >= 1; n--) {
      if (r() < 0.3) continue;
      mood = Math.max(1, Math.min(5, mood + Math.round((r() - 0.45) * 2.2)));
      const opts = notes.filter(x => x[0] === mood);
      add('entry', { mood, note: pick(r, opts)[1] }, at(n, 21, 30));
    }
  },

  tasbeeh(app) {
    const { r, add } = helper(app, 66);
    for (let n = 6; n >= 1; n--) for (const ph of ['SubhanAllah', 'Alhamdulillah', 'AllahuAkbar']) for (let i = 0; i < 33; i++) add('zikr', { phrase: ph }, at(n, 5, 20));
    for (let i = 0; i < 33; i++) add('zikr', { phrase: 'SubhanAllah' }, at(0, 5, 20));
    for (let i = 0; i < 21; i++) add('zikr', { phrase: 'SubhanAllah' }, at(0, 13, 40));
    for (let i = 0; i < 33; i++) add('zikr', { phrase: 'Alhamdulillah' }, at(0, 5, 25));
    void r;
  },

  cricket(app) {
    const { r, add } = helper(app, 77);
    let min = 0;
    for (let b = 0; b < 52; b++) {
      const x = r();
      const t = at(0, 13, 0) + (min += 1.2) * 60000;
      if (x < 0.05) add('ball', { wide: true }, t);
      else if (x < 0.09) add('ball', { out: true }, t);
      else add('ball', { runs: pick(r, [0, 0, 0, 1, 1, 1, 1, 2, 2, 3, 4, 4, 6]) }, t);
    }
  },

  tictactoe(app) {
    const { add } = helper(app, 88);
    [[5, 'X'], [1, 'O'], [9, 'X'], [3, 'O'], [2, 'O']].forEach(([cell, mark], i) => add('move', { game: 1, cell, mark }, at(0, 14, i)));
    [[5, 'X'], [2, 'O'], [7, 'X'], [3, 'O'], [1, 'X'], [9, 'O']].forEach(([cell, mark], i) => add('move', { game: 2, cell, mark }, at(0, 15, i)));
    app.data.settings.cur = 3;
    [[5, 'X'], [1, 'O'], [3, 'X']].forEach(([cell, mark], i) => add('move', { game: 3, cell, mark }, at(0, 15, 20 + i)));
  },

  quiz(app) {
    const { add } = helper(app, 99);
    const qs = [
      ['Which river flows through Lahore?', 'Ravi', 'Chenab', 'Jhelum', 'A'],
      ['How many players are in a cricket team on the field?', 'Nine', 'Eleven', 'Twelve', 'B'],
      ['What is 15% of 2,000?', '150', '300', '250', 'B'],
      ['Which planet is closest to the sun?', 'Venus', 'Mars', 'Mercury', 'C'],
      ['How many days are in a leap year?', '365', '366', '364', 'B'],
      ['What gas do plants take in from the air?', 'Oxygen', 'Nitrogen', 'Carbon dioxide', 'C'],
    ];
    const ids = qs.map(([question, a, b, c, right], i) => add('item', { question, a, b, c, right }, at(2, 10, i)).id);
    add('answer', { item: ids[0], chose: 'A' }, at(0, 9, 0));
    add('answer', { item: ids[1], chose: 'B' }, at(0, 9, 1));
    add('answer', { item: ids[2], chose: 'C' }, at(0, 9, 2));
  },

  savings(app) {
    const { r, add } = helper(app, 111);
    const notes = ['Salary day', 'Freelance logo job', 'Eid money', 'Skipped eating out', 'Sold old phone', null];
    for (let n = 120; n >= 1; n -= 5 + Math.floor(r() * 9)) add('deposit', { amount: pick(r, [1000, 2000, 2500, 5000, 5000, 7500]), note: pick(r, notes) }, at(n, 19, 0));
  },

  reading(app) {
    const { add } = helper(app, 122);
    const books = [['Atomic Habits', 'James Clear', 'Done', -40], ['Raja Gidh', 'Bano Qudsia', 'Reading', null], ['Sapiens', 'Yuval Noah Harari', 'Done', -90], ['Peer-e-Kamil', 'Umera Ahmed', 'Done', -150], ['Deep Work', 'Cal Newport', 'Want', null], ['The Kite Runner', 'Khaled Hosseini', 'Want', null], ['Thinking, Fast and Slow', 'Daniel Kahneman', 'Reading', null], ['Udas Naslain', 'Abdullah Hussain', 'Want', null]];
    books.forEach(([title, author, status, d], i) => add('book', { title, author, status, finished: d === null ? null : ymd(d) }, at(200 - i * 10, 20, 0)));
  },

  todo(app) {
    const { add } = helper(app, 133);
    const d = n => ymd(n);
    [['Pay the electricity bill', -2, false, 'Home'], ['Send the November report to Sana', 0, false, 'Work'], ['Book a dentist appointment', 3, false, 'Home'], ['Renew car token tax', 6, false, 'Other'], ['Review pull request for the login page', 1, false, 'Work'], ['Buy school shoes for Ali', -1, false, 'Home'], ['Call the plumber', -5, true, 'Home'], ['Prepare slides for Monday', -3, true, 'Work']]
      .forEach(([title, due, done, tag], i) => add('task', { title, due: d(due), done, tag }, at(10 - i, 9, 0)));
  },

  attendance(app) {
    const { r, add } = helper(app, 144);
    const names = ['Ayesha', 'Bilal', 'Fatima', 'Hamza', 'Hira', 'Imran', 'Iqra', 'Junaid', 'Kashif', 'Laiba', 'Maryam', 'Nadia', 'Omar', 'Saad', 'Sana', 'Zainab'];
    const ids = names.map((name, i) => add('student', { name }, at(60, 8, i)).id);
    for (let n = 25; n >= 0; n--) {
      const wd = new Date(dayStart(n)).getDay();
      if (wd === 0 || wd === 6) continue;
      ids.forEach((id, i) => { if (r() < (i === 7 ? 0.25 : 0.06)) add('absent', { student: id }, at(n, 8, 30)); });
    }
  },

  pomodoro(app) {
    const { r, add } = helper(app, 155);
    const tasks = ['Thesis chapter 3', 'Statistics homework', 'Read research paper', 'Emails', null];
    for (let n = 6; n >= 0; n--) { const k = n === 0 ? 2 : Math.floor(r() * 6); for (let i = 0; i < k; i++) add('session', { task: pick(r, tasks), mins: pick(r, [25, 25, 25, 50]) }, at(n, 9 + i, 25)); }
  },

  medicine(app) {
    const { add } = helper(app, 166);
    const meds = [['Metformin', '500 mg', '08:00'], ['Vitamin D', '1 tablet', '13:00'], ['Atorvastatin', '10 mg', '21:30']];
    const ids = meds.map(([name, dose, time], i) => add('med', { name, dose, time }, at(30, 9, i)).id);
    for (let n = 6; n >= 1; n--) ids.forEach(id => add('taken', { med: id }, at(n, 9, 0)));
    add('taken', { med: ids[0] }, at(0, 8, 5));
    add('taken', { med: ids[1] }, at(0, 13, 10));
  },
};
