app "Loyalty" tag plum
table customer name text, phone text?, card_no num 1..
each customer as c
  row card tap edit c swipe remove c
    c.name bold grow
    "Card" c.card_no
form customer, "Add customer"
"QR codes and scanning are not possible here." faint
