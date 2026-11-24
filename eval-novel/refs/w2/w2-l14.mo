app "Eid shopping" gift plum
table item name text, category pick Clothes|Shoes|Eidi|Sweets, price money?, bought bool
goal count(item where bought = yes), count(item), "bought"
stat sum(item.price where bought = yes), "spent"
form item, "Add item"
each item by category as g empty "Nothing on the list"
  g.key head
  each g as r
    row card swipe remove r
      toggle r.bought
      r.name grow
      r.price
