app "Tailoring orders" pen plum
table order customer text, suit pick Shalwar_kameez|Three_piece|Waistcoat|Sherwani|Other, note long?, due date, price money, advance money = 0, delivered bool
let owed = sum(order where delivered = no, it.price - it.advance)
stat owed, "still owed to me"
"Due this week:" count(order where delivered = no and due >= today and due <= today + 7) faint
form order, "Add order"
"Who still owes me" head
each order where delivered = no and price > advance sort due
  row card tap edit it
    stack grow gap 0
      it.customer bold
      it.suit faint
      "Due" it.due faint
    it.price - it.advance bold color bad
    toggle it.delivered
list order
