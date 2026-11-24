app "Focus" timer ink
table session task text?, mins num 1..180 = 25
setting work dur = 25m "Focus length"
state left dur = work
state going bool = no
state task text = ""
every 1s if going set left = left - 1s
when going and left <= 0s set going = no then add session task = task, mins = work / 1m then set left = work then notify "Focus done. Take a short break."
draw width 260
  circle 44 stroke soft thick 6
  arc 44, 0, 360 * (1 - left / work) stroke accent thick 6
  label 50, 46, left huge
  label 50, 64, if(going, "focusing", "ready") color muted
row gap 1 align center
  button if(going, "Pause", "Start") fill accent width 140 tap set going = not going
  button "Reset" width 120 tap set going = no then set left = work
field task "Working on"
stack card gap 2
  row
    "Today" head grow
    plural(count(session today), "session") "," sum(session.mins today) "min" faint
  plot 0..7, 0..max(60, max(days last 7 days, sum(session.mins on it))) axes gridlines
    each days last 7 days
      rect index + 0.15, 0, 0.7, sum(session.mins on it) fill if(it = today, accent, muted) radius 3
      tick index + 0.5, dayname(it)
  "Minutes of focus per day" faint
if count(session today) = 0
  "No sessions yet today. Press Start when you sit down to work." color muted
each session today as s
  row card tap edit s swipe remove s
    s.task grow
    s.mins "min" bold
