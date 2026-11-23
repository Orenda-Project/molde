app "Insta orders" bag plum
table order customer text, item text, paid bool
count(order where paid = no) "unpaid orders" head
each order sort at as o
  row card gap 2 tap edit o swipe remove o
    toggle o.paid
    stack grow
      o.customer bold
      o.item faint
    if(o.paid, "Paid", "Unpaid") color if(o.paid, good, bad)
form order, "Add order"
