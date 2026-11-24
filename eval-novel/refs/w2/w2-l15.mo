app "Lent tools" tool slate
table lent what text, person text, lent_on date = today, due date, returned bool
stat count(lent where returned = no and due < today), "overdue"
form lent, "Add lent item"
each lent where returned = no sort due as l empty "Nothing lent out"
  row card fill if(l.due < today, warn, surface)
    toggle l.returned
    stack gap 0 grow
      l.what bold
      l.person faint
    if l.due < today
      text today - l.due "days overdue"
    else
      "back by" l.due faint
