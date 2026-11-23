app "Focus" timer ink
table session task text?
setting work dur = 25m "Focus length"
timer work, "Focus", add session then notify "Take a short break"
timer 5m, "Break"
text count(session today) "focus sessions today" head
daybars last 7 days, count(session on it)
list session today
