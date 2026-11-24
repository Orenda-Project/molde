app "Habits" check mint
table habit name text
table check habit ref habit
state adding bool = no
state sel date = today
let n = count(habit)
let done = count(check today)
row bar
  button if(adding, "Close", "Add habit") fill if(adding, soft, accent) tap set adding = not adding
if adding
  form habit, "Save habit"
if n = 0
  stack card gap 2
    "No habits yet" head
    "Add one small thing you can do even on a busy day, like reading two pages." color muted
else
  row gap 4 align center
    draw width 104
      circle 42 stroke soft thick 10
      arc 42, 0, 360 * clamp(done / n, 0, 1) stroke accent thick 10
      label 50, 50, done "/" n head
    stack grow gap 1
      done "of" n "done today" head
      if done >= n
        "All done. See you tomorrow." color good
      else
        n - done "left for today" color muted
  each habit as h
    stack card gap 2 tap edit h swipe remove h
      row gap 2
        stack grow gap 0
          h.name bold
          if streak(h.check) > 0
            streak(h.check) "day streak," round(count(h.check last 30 days) * 100 / 30) "% in 30 days" faint
          else
            "Not started yet. Tick it today." faint
        toggle h.check
      row gap 1
        each days last 7 days
          stack grow gap 0 align center
            dayname(it) tiny color muted
            box height 10 width 24 radius 5 fill if(count(h.check on it) > 0, accent, soft)
  stack card gap 3
    row gap 3
      stack gap 0
        "This week" faint
        round(count(check week) * 100 / (n * weekday(today))) "%" head
        "of all ticks" faint
      stack gap 0
        "Last 30 days" faint
        round(count(check last 30 days) * 100 / (n * 30)) "%" head
        "of all ticks" faint
      stack gap 0
        "Best streak" faint
        plural(max(habit, streak(it.check)), "day") head
        "running now" faint
  row
    "Last 6 weeks" head grow
    "Average" round(count(check last 42 days) * 100 / (n * 42)) "%" faint
  grid 7 gap 0
    each 1..7
      dayname(today - 42 + it) tiny color muted align center
    each days last 42 days
      box height 44 pad 1 radius 8 stroke if(sel = it, ink, bg) thick 2 tap set sel = it
        box height 28 radius 6 fill if(count(check on it) > 0, accent, soft) opacity if(count(check on it) > 0, clamp(count(check on it) / n, 0.3, 1), 1)
        it "," count(check on it) "of" n "habits done" opacity 0
  row gap 1 align center
    "Less" faint
    box width 16 height 16 radius 4 fill soft
    box width 16 height 16 radius 4 fill accent opacity 0.3
    box width 16 height 16 radius 4 fill accent opacity 0.65
    box width 16 height 16 radius 4 fill accent
    "More" faint
    space
    sel bold
    count(check on sel) "of" n "done" color muted
