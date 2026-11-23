// The programs the demo shows. `src` is relative to runtime/web/demo/. The five apps the
// baseline compares against use richer programs written for the demo (demo/programs/); the
// rest are the language's own examples, unchanged.
export const CATALOG = [
  { id: 'water', title: 'Water', src: 'programs/water.mo', note: 'A glass drawn from a rect and a path, filled by a formula' },
  { id: 'habits', title: 'Habits', src: 'programs/habits.mo', note: 'Ring, 10-week heat grid and week strips from draw, grid and box' },
  { id: 'budget', title: 'Budget', src: 'programs/budget.mo', note: 'Pace line from poly, category bars from rect, month navigation' },
  { id: 'exercise', title: 'Workouts', src: 'programs/exercise.mo', note: 'Progress line per exercise, week strip, volume vs last week' },
  { id: 'journal', title: 'Journal', src: 'programs/journal.mo', note: 'Mood picker drawn from bars, 30-day mood line, search' },
  { id: 'tasbeeh', title: 'Tasbeeh', src: '../../../lang/examples/27-tasbeeh.mo', note: 'Tap ring counter from circle, arc and label' },
  { id: 'cricket', title: 'Cricket', src: '../../../lang/examples/19-cricket-score.mo', note: 'Scoreboard and last-ball circles' },
  { id: 'tictactoe', title: 'Tic tac toe', src: '../../../lang/examples/26-tictactoe.mo', note: 'A 3x3 board, turns and a win check from formulas' },
  { id: 'quiz', title: 'Quiz', src: '../../../lang/examples/20-quiz.mo', note: 'Question cards with answer buttons and a score' },
  { id: 'savings', title: 'Savings', src: '../../../lang/examples/24-savings-thermometer.mo', note: 'A thermometer from rect and circle' },
  { id: 'reading', title: 'Reading', src: '../../../lang/examples/13-reading-list.mo', note: 'Status tabs from buttons, finish a book in one tap' },
  { id: 'todo', title: 'To do', src: '../../../lang/examples/22-todo.mo', note: 'Late tasks in red, tick boxes, a reminder' },
  { id: 'attendance', title: 'Attendance', src: '../../../lang/examples/30-attendance.mo', note: 'A class grid; tap a name to mark absent' },
  { id: 'pomodoro', title: 'Focus timer', src: '../../../lang/examples/28-pomodoro.mo', note: 'Two timers from the standard library' },
  { id: 'medicine', title: 'Medicine', src: '../../../lang/examples/11-medicine.mo', note: 'Doses with tick boxes and daily reminders' },
];
