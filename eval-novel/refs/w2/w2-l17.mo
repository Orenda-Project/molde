app "School bag" school ocean
table bag day pick Mon|Tue|Wed|Thu|Fri, item text, packed bool
"Tomorrow" head
each options bag.day as d
  if index = if(weekday(today) >= 5, 0, weekday(today))
    each bag where day = d as b empty "Nothing listed"
      row card
        toggle b.packed
        b.item grow
form bag, "Add item"
each options bag.day as d
  d head
  each bag where day = d as b
    row card swipe remove b
      toggle b.packed
      b.item grow
