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
  label 50, 46, left size huge
  label 50, 64, if(going, "focusing", "ready") color muted
row gap 1 align center
  button if(going, "Pause", "Start") fill accent width 140 tap set going = not going
  button "Reset" width 120 tap set going = no then set left = work
field task "Working on"
stack card gap 2
  row
    "Today" head grow
    count(session today) if(count(session today) = 1, "session,", "sessions,") sum(session.mins today) "min" faint
  row gap 1 align end
    each days last 7 days
      stack grow gap 1 align center
        sum(session.mins on it) size tiny color muted
        draw 10, 56
          rect 0, 0, 10, 56 fill soft radius 3
          rect 0, 56 - 56 * clamp(sum(session.mins on it) / 150, 0, 1), 10, 56 * clamp(sum(session.mins on it) / 150, 0, 1) fill if(it = today, accent, muted) radius 3
        dayname(it) size tiny color if(it = today, ink, muted)
  "Minutes of focus per day" faint
if count(session today) = 0
  "No sessions yet today. Press Start when you sit down to work." color muted
each session today as s
  row card tap edit s swipe remove s
    s.task grow
    s.mins "min" bold
