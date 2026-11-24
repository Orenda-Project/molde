app "House shifting" box ocean
table box room pick Kitchen|Bedroom|Kids_room|Living|Store, contents text, packed bool
goal count(box where packed = yes), count(box), "boxes packed"
form box, "Add box"
each options box.room as rm
  if count(box where room = rm) > 0
    row gap 1
      rm head grow
      count(box where room = rm and packed = yes) "/" count(box where room = rm) faint
    each box where room = rm as b
      row card swipe remove b
        toggle b.packed
        b.contents grow
