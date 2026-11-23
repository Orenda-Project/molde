app "Groceries" cart mint
table item name text, qty text?, got bool
text count(item where got = no) "to buy" head
each item where got = no as i
  row card swipe remove i
    toggle i.got
    text i.name i.qty grow
text "In the cart" faint
each item where got = yes as i
  row swipe remove i
    toggle i.got
    text i.name color muted
form item
