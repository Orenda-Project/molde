app "To do" list ink
table task title text, due date?, done bool, tag pick Home|Work|Other = Home
let late = count(task where done = no and due < today)
topbar "To do", task, "Add task"
plural(count(task where done = no), "task") "open," late "late" head color if(late > 0, bad, ink)
each task where done = no sort due as t empty "All done. Add a task when something new comes up."
  row card gap 2 tap edit t swipe remove t
    toggle t.done
    stack grow gap 0
      t.title bold
      t.due "·" t.tag faint color if(t.due < today, bad, muted)
section "Done", count(task where done = yes)
  list task where done = yes, "Nothing done yet."
remind "You have tasks due today" at 8:00 if count(task where done = no and due = today) > 0
