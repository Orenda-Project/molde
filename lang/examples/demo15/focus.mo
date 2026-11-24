app "Focus" timer ink
table session task text?, mins num 1..180 = 25
setting work dur = 25m "Focus length"
timer work, "Focus", add session mins = work / 1m then notify "Focus done. Take a short break."
section "Today", "minutes:" sum(session.mins today)
  goalbars last 7 days, sum(session.mins on it), 60
list session today, "No sessions yet today. Press Start when you sit down to work."
