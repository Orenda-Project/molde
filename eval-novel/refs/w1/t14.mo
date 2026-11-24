app "Van fees" bus mint
table child name text, fee money "Monthly fee"
table paid who ref child, ym num
state m date = today
let k = year(m) * 12 + month(m)
let collected = sum(paid where ym = k, it.who.fee)
monthnav m
row gap 3
  stat collected, "collected"
  stat sum(child.fee) - collected, "still to collect"
form child, "Add child"
each child
  row card
    it.name bold grow
    it.fee faint
    toggle it.paid all where ym = k
"Not paid this month" head
each child empty "Nobody yet"
  if count(it.paid where ym = k) = 0
    row card
      it.name grow
      it.fee bold color bad
