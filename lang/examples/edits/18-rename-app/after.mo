app "Shopping" cart mint
table item name text, qty text?, got bool
count(item where got = no) "to buy" head
each item where got = no as i
  row card swipe remove i
    toggle i.got
    i.name i.qty grow
"In the cart" faint
each item where got = yes as i
  row swipe remove i
    toggle i.got
    i.name color muted
form item
