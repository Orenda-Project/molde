// The programs the demo shows. `src` is relative to runtime/web/demo/. Eleven are written for
// the demo (demo/programs/); reading, to-do, attendance and medicine are the language's own
// examples, unchanged, so the real edit pairs in lang/examples/edits apply to them.
export const CATALOG = [
  { id: 'water', about: 'Tap a glass size each time you drink; the glass fills toward your daily goal.', title: 'Water', src: 'programs/water.mo', note: 'A glass drawn from a rect and a path, filled by a formula' },
  { id: 'habits', about: 'Tick off small daily habits and see your streaks and the last six weeks.', title: 'Habits', src: 'programs/habits.mo', note: 'Ring, 10-week heat grid and week strips from draw, grid and box' },
  { id: 'budget', about: 'Log what you spend and see how much is left this month, and where it went.', title: 'Budget', src: 'programs/budget.mo', note: 'Pace line from poly, category bars from rect, month navigation' },
  { id: 'exercise', about: 'Log each set and see your week and how your weights go up.', title: 'Workouts', src: 'programs/exercise.mo', note: 'Progress line per exercise, week strip, volume vs last week' },
  { id: 'journal', about: 'Pick a mood, write a line, and see how your month went.', title: 'Journal', src: 'programs/journal.mo', note: 'Mood picker drawn from bars, 30-day mood line, search' },
  { id: 'tasbeeh', about: 'Tap the circle to count; it tells you when a round of 33 is done.', title: 'Tasbeeh', src: 'programs/tasbeeh.mo', note: 'A tap ring counter from circle, arc and label, centred by the runtime' },
  { id: 'cricket', about: 'Tap the runs off each ball; it keeps the score, overs and run rate.', title: 'Cricket', src: 'programs/cricket.mo', note: 'A scoreboard, last-ball circles and a run pad from grid' },
  { id: 'tictactoe', about: 'Two players take turns on a 3 by 3 board; it spots the winner.', title: 'Tic tac toe', src: 'programs/tictactoe.mo', note: 'A 3x3 board, turns and a win check from a formula with values' },
  { id: 'quiz', about: 'Answer questions, see the right answer when you miss one, and start again.', title: 'Quiz', src: 'programs/quiz.mo', note: 'Question cards, the right answer after a wrong one, start again' },
  { id: 'savings', about: 'Add what you save and watch the thermometer rise toward your goal.', title: 'Savings', src: 'programs/savings.mo', note: 'A thermometer from rect and circle, monthly bars' },
  { id: 'reading', about: 'Keep books you want to read, are reading and have finished.', title: 'Reading', src: '../../../lang/examples/13-reading-list.mo', note: 'Status tabs from buttons, finish a book in one tap' },
  { id: 'todo', about: 'A list of tasks with due dates; late ones stand out.', title: 'To do', src: '../../../lang/examples/22-todo.mo', note: 'Late tasks in red, tick boxes, a reminder' },
  { id: 'attendance', about: 'Tap a name to mark a student absent for the day.', title: 'Attendance', src: '../../../lang/examples/30-attendance.mo', note: 'A class grid; tap a name to mark absent' },
  { id: 'pomodoro', about: 'A focus timer that logs each session you finish.', title: 'Focus timer', src: 'programs/focus.mo', note: 'A timer ring built from state, every and when' },
  { id: 'medicine', about: 'Your medicines with their times; tick each dose when you take it.', title: 'Medicine', src: '../../../lang/examples/11-medicine.mo', note: 'Doses with tick boxes and daily reminders' },
];
