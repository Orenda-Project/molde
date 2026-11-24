app "Habits" check mint
table habit name text
table check habit ref habit
let n = count(habit)
let done = count(check today)
topbar habit, "Add habit"
statcard done, "of" n "done today", n
each habit as h empty "No habits yet. Add one small thing you can do even on a busy day."
  stack card gap 2 tap edit h swipe remove h
    row gap 2
      stack grow gap 0
        h.name bold
        streak(h.check) "day streak," count(h.check last 30 days) "in 30 days" faint
      toggle h.check
    weekdots count(h.check on it) > 0
section "Last 6 weeks", "average" round(count(check last 42 days) * 100 / max(n * 42, 1)) "%"
  daygrid last 42 days, count(check on it), max(n, 1)
