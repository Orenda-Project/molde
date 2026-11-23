app "Packing" bag ocean
table item name text, packed bool
count(item where packed = yes) "of" count(item) "packed" head
each item sort name as i
  row card swipe remove i
    toggle i.packed
    i.name grow color if(i.packed, muted, ink)
form item
