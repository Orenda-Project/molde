app "Shopping" cart mint
table item name text, price money?, got bool
"Total" sum(item.price) big
each item as i
  row card swipe remove i
    toggle i.got
    i.name grow
    i.price
form item
