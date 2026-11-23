app "Weekly groceries" cart mint
table item name text, qty text?, got bool
count(item week where got = no) "to buy this week" head
each item week where got = no as i
  row card swipe remove i
    toggle i.got
    i.name i.qty grow
each item week where got = yes as i
  row swipe remove i
    toggle i.got
    i.name color muted
form item
