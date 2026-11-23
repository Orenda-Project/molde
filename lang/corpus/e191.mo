app "Habits" check mint
table habit name text
table check habit ref habit
let n = count(habit)
let done = count(check today)
row gap 2
  goal done, n, "done today"
  stack grow
    if(done = n and n > 0, "All done today", "Keep going") head
    "Best streak" max(habit, streak(it.check)) "days" faint
if n = 0
  "Start with one small thing you can do on a busy day." faint
each habit as h
  stack card gap 1 tap edit h swipe remove h
    row gap 2
      h.name bold grow
      streak(h.check) "days" faint
      toggle h.check
    row gap 1
      each days last 7 days
        stack grow align center tap toggle h.check on it
          dayname(it) tiny color muted
          box height 10 radius 5 fill if(count(h.check on it) > 0, accent, soft)
remind "Check your habits" at 20:00
form habit
