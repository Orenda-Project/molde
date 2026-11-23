app "Rent and bills" wallet slate
table bill name text, tenant text?, amount money, due_day num 1..31, paid bool
let late = countof(bill, it.paid = no and it.due_day < monthday(today))
text late "late this month" head color if(late > 0, bad, good)
each bill sort due_day as b
  row card gap 1 tap edit b swipe remove b fill if(b.paid = no and b.due_day < monthday(today), bad, surface)
    stack grow
      b.name bold color if(b.paid = no and b.due_day < monthday(today), bg, ink)
      b.tenant "due on day" b.due_day size small color if(b.paid = no and b.due_day < monthday(today), bg, muted)
    b.amount color if(b.paid = no and b.due_day < monthday(today), bg, ink)
    toggle b.paid
form bill, "Add bill"
