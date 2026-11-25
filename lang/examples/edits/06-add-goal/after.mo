app "Focus" timer ink
table session task text?
setting work dur = 25m "Focus length"
setting daily num = 8 "Sessions a day"
timer work, "Focus", add session then notify "Take a short break"
timer 5m, "Break"
goal count(session today), daily, "focus sessions today"
daybars last 7 days, count(session on it)
list session today
