app "Habits" check mint
table habit name text
table check habit ref habit
let n = count(habit)
let done = count(check today)
def kpi label text, value num, unit text, note text
  stack gap 0
    text label faint
    text value unit head
    text note faint
stack card gap 4
  row gap 4
    draw width 104
      circle 50, 50, 42 stroke soft thick 10
      arc 50, 50, 42, 0, 360 * clamp(done / n, 0, 1) stroke accent thick 10
      label 50, 50, done "/" n head
    stack grow gap 1
      text done "of" n "done today" head
      if done >= n and n > 0
        text "All done. See you tomorrow." color good
      else
        text n - done "left for today" color muted
  divider
  row gap 3
    kpi "This week", round(count(check week) * 100 / (n * weekday(today))), "%", "of all checks"
    kpi "Last 30 days", round(count(check last 30 days) * 100 / (n * 30)), "%", "of all checks"
    kpi "Best streak", maxof(habit, streak(it.check)), "days", "running now"
stack card gap 3
  row
    text "Last 10 weeks" head grow
    text "Average" round(count(check last 70 days) * 100 / (n * 70)) "%" faint
  grid 7 gap 1
    each days last 70 days
      box height 22 radius 4 fill if(count(check on it) > 0, accent, soft) opacity if(count(check on it) > 0, clamp(count(check on it) / n, 0.3, 1), 1)
  text "One square per day, oldest first. Darker means more habits done." faint
row
  text "Today" head grow
  text n - done "left" faint
each habit as h
  stack card gap 2 tap edit h swipe remove h
    row gap 2
      stack grow gap 0
        text h.name bold
        text streak(h.check) "day streak," round(count(h.check last 30 days) * 100 / 30) "% in 30 days" faint
      toggle h.check
    row gap 1
      each days last 7 days
        stack grow gap 0 align center
          text dayname(it) size tiny color muted
          box height 10 width 24 radius 5 fill if(count(h.check on it) > 0, accent, soft)
form habit, "Add habit"
