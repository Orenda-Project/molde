app "Grocery list" cart mint
table item name text, price money?, qty num 1.. = 1, got bool
count(item where got = no) "to buy. Total" sumof(item, it.price * it.qty) head
each item where got = no as i
  row card swipe remove i
    toggle i.got
    i.name grow
    i.qty "x" i.price
"Already in the cart" faint
each item where got = yes as i
  row swipe remove i
    toggle i.got
    i.name color muted grow
    i.price color muted
form item
