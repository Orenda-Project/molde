app "Umrah bag" bag mint
table item name text, category pick Clothes|Documents|Medicines|Other = Other, packed bool
goal count(item where packed = yes), count(item), "items packed"
stat count(item where packed = no), "left to pack"
form item, "Add item"
each item by category as g empty "Nothing in the bag yet"
  g.key head
  each g as r
    row card swipe remove r
      toggle r.packed
      r.name grow
