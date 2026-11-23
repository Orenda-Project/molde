app "Habits" check mint
table habit name text
table check habit ref habit
let n = count(habit)
let done = count(check today)
row gap 2
  ring done, n, "done today"
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
row gap 2
  stat round(count(check week) * 100 / (n * weekday(today))), "% this week"
  stat round(count(check last 30 days) * 100 / (n * 30)), "% last 30 days"
"Last 10 weeks" head
grid 7 gap 1
  each days last 70 days
    box height 12 radius 2 fill if(count(check on it) > 0, accent, soft) opacity clamp(count(check on it) / n, 0.3, 1)
"Each row is a week. Darker means more habits done." faint
form habit
