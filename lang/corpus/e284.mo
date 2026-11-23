app "Mera todo" list ink
table task title text, done bool
count(task where done = no) "baqi" head
each task where done = no as t
  row card swipe remove t
    toggle t.done
    t.title grow
form task, "Add task"
"Done" faint
list task where done = yes
