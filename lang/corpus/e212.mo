app "Checkups" heart plum
table checkup what text, due date, done bool
let late = count(checkup where done = no and due < today)
count(checkup where done = no) "checkups to do," late "overdue" head color if(late > 0, warn, ink)
remind "A health checkup is due today" at checkup.due
each checkup where done = no sort due as c
  row card tap edit c swipe remove c
    toggle c.done
    stack grow
      c.what bold
      c.due size small color if(c.due < today, bad, muted)
form checkup
"Done" faint
list checkup where done = yes
