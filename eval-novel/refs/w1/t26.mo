app "Card orders" note plum
table order customer text, qty num 1.., rate money "Rate per card", design text, due date "Delivery date"
stat sum(order, it.qty * it.rate), "total order value"
"Due within a week:" count(order where due >= today and due <= today + 7) faint
form order, "Add order"
each order sort it.due empty "No orders yet"
  row card tap edit it swipe remove it
    stack grow gap 0
      it.customer bold
      it.qty "cards," it.design faint
      "Delivery" it.due faint
    it.qty * it.rate bold
