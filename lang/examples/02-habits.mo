app "Habits" check mint
table habit name text
table check habit ref habit
let n = count(habit)
count(check today) "of" n "done today" head
if n = 0
  "Nothing to track yet. Add one." faint
each habit
  row card gap 2 tap edit it swipe remove it
    stack grow
      it.name bold
      streak(it.check) "day streak," round(count(it.check last 30 days) * 100 / 30) "% in 30 days" faint
    toggle it.check
row gap 2
  stat round(count(check week) * 100 / (n * weekday(today))), "% this week"
  stat round(count(check last 30 days) * 100 / (n * 30)), "% in 30 days"
  stat max(habit, streak(it.check)), "best streak"
heat last 70 days, count(check on it), n
form habit
