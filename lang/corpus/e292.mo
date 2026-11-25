app "Garden routine" plant mint
table task name text, day pick Mon|Tue|Wed|Thu|Fri|Sat|Sun
table done task ref task
remind "Garden jobs today" at 8:00 if count(task where day = dayname(today)) > 0
"Today" head
each task where day = dayname(today) as t
  row card
    toggle t.done
    t.name grow
"The week" head
each options task.day as dd
  if count(task where day = dd) > 0
    dd bold
    each task where day = dd as t
      row tap edit t swipe remove t
        t.name grow
form task, "Add a garden job"
