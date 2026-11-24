app "To do" list ink
table task title text, due date?, done bool, tag pick Home|Work|Other = Home
state adding bool = no
state showdone bool = no
state d new task
let late = count(task where done = no and due < today)
let open = count(task where done = no)
row
  button if(adding, "Close", "Add task") fill if(adding, soft, accent) tap set adding = not adding
if adding
  stack card gap 3
    field d.title "Task"
    field d.due "Due"
    choice d.tag
    button "Save task" fill accent tap save d then set adding = no
stack gap 0
  plural(open, "task") "open" head
  if late > 0
    "Late:" plural(late, "task") "past the due date" bold color bad
  else
    "Nothing is late" color good
if open = 0
  "All done. Add a task when something new comes up." color muted
each task where done = no sort due as t
  row card gap 2 tap edit t swipe remove t
    toggle t.done
    stack grow gap 0
      t.title bold
      if t.due < today
        "Late, was due" t.due "·" t.tag faint color bad
      else
        if t.due = today
          "Due today ·" t.tag faint color warn
        else
          t.due "·" t.tag faint
row gap 2 align center
  "Done" count(task where done = yes) head grow
  button if(showdone, "Hide", "Show") tap set showdone = not showdone
if showdone
  each task where done = yes as t
    row gap 2 swipe remove t
      toggle t.done
      t.title color muted grow
remind "You have tasks due today" at 8:00 if count(task where done = no and due = today) > 0
