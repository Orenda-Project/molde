app "To do" list ink
table task title text, due date?, done bool, tag pick Home|Work|Other = Home
let late = count(task where done = no and due < today)
count(task where done = no) "open," late "late" head color if(late > 0, warn, ink)
each task where done = no sort due as t
  row card gap 2 tap edit t swipe remove t
    toggle t.done
    stack grow
      t.title bold
      t.tag t.due small color if(t.due < today, bad, muted)
remind "You have tasks due today" at 8:00 if count(task where done = no and due = today) > 0
form task
"Done" faint
list task where done = yes
