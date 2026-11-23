app "Shopping" cart mint
table item name text, aisle pick Produce|Dairy|Bakery|Meat|Pantry|Other = Produce, got bool
each options item.aisle as a
  if countof(item, it.aisle = a) > 0
    a head color accent size huge
    each item where aisle = a as i
      row swipe remove i
        toggle i.got
        i.name grow color if(i.got, muted, ink)
form item
