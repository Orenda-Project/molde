app "Bakery" bread plum
table order customer text, item text, qty num 1.., price money, due date = today, delivered bool
table ingredient name text, qty num 0.., low num 0..
stat sum(order.price week), "sales this week"
stat count(ingredient where qty <= low), "ingredients low"
"Today's deliveries" head
each order where due = today and delivered = no as o empty "Nothing to deliver today"
  row card
    toggle o.delivered
    o.customer bold grow
    o.qty "x" o.item
form order, "Add order"
each order sort due as o
  row card tap edit o swipe remove o opacity if(o.delivered, 0.5, 1)
    toggle o.delivered
    o.customer grow
    o.item faint
    o.due faint
"Ingredient stock" head
form ingredient, "Add ingredient"
each ingredient as i
  row card swipe remove i fill if(i.qty <= i.low, warn, surface)
    i.name bold grow
    button "-" tap set i.qty = i.qty - 1
    i.qty
    button "+" tap set i.qty = i.qty + 1
