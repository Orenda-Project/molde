app "To do" list ink
table task title text, due date?, done bool, tag pick Home|Work|Other = Home
let late = count(task where done = no and due < today)
text count(task where done = no) "open," late "late" head color if(late > 0, warn, ink)
state tg text = "Home"
row gap 1
  each options task.tag
    button it fill if(tg = it, accent, soft) tap set tg = it
each task where done = no and tag = tg sort due as t
  row card gap 2 tap edit t swipe remove t
    toggle t.done
    stack grow
      text t.title bold
      text t.tag t.due size small color if(t.due < today, bad, muted)
remind "You have tasks due today" at 8:00 if count(task where done = no and due = today) > 0
form task
text "Done" faint
list task where done = yes
