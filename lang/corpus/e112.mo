app "School fees" school ocean
table child name text, school text?, fee money
table paid child ref child, note text?
count(child) - countof(child, count(it.paid month) > 0) "children with fee due this month" head
stat sumof(child, it.fee * count(it.paid month)), "collected this month"
each child as c
  row card gap 1
    stack grow
      c.name bold
      c.school faint
    c.fee
    if count(c.paid month) > 0
      "Paid" color good bold
    else
      button "Mark paid" tap add paid child = c
form child, "Add child"
log paid
