app "Focus" timer ink
table session task text, kind pick Work|Break = Work
setting work dur = 25m "Work length"
setting rest dur = 5m "Break length"
state cur text = ""
field cur "What are you working on?"
timer work, "Work", add session task = cur, kind = Work then notify "Work done. Take a break"
timer rest, "Break", add session task = Break, kind = Break then notify "Break over"
count(session today where kind = Work) "work sessions today" head
"Focus time today:" count(session today where kind = Work) * work / 1m "min" faint
daybars last 7 days, count(session on it where kind = Work)
list session where kind = Work by day
