app "Get it done" target ink
table task what text, done bool
setting work dur = 25m "Focus length"
table session task text?
state now_task text = ""
"Pick one thing. Just start." head
each task where done = no sort at top 3 as t
  row card gap 1
    toggle t.done
    t.what grow
    button "Focus" tap set now_task = t.what
"Now:" now_task bold
timer work, "Focus", add session task = now_task then notify "Nice. Take a break"
count(session today) "focus sessions today" big
form task, "Add task"
daybars last 7 days, count(session on it)
