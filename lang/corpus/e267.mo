app "Chores" home mint
table chore name text, who text, day pick Mon|Tue|Wed|Thu|Fri|Sat|Sun
table did chore ref chore
each options chore.day as dd
  if count(chore where day = dd) > 0
    dd head
    each chore where day = dd as c
      row card tap edit c swipe remove c
        toggle c.did week
        c.name bold grow
        c.who faint
form chore, "Add chore"
