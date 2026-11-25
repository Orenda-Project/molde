app "Kids Routine" star mint
table task name text
table done task ref task
table star why text?
let stars = count(done today)
"Stars today" stars big
"Morning checklist" head
each task
  row card
    it.name grow
    toggle it.done
form task, "Add morning task"
"Weekly star chart" head
daybars last 7 days, count(done on it)
timer 20m, "Bedtime timer", notify "Time for bed"
