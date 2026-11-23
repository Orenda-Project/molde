app "Restaurant" food plum
table dish name text, price money
table order table_no num 1..50, dish ref dish, qty num 1..20 = 1, served bool
screen menu "Menu" food
  list dish
  form dish, "Add dish"
screen orders "Orders" list
  form order, "Take order"
  log order
screen kitchen "Kitchen" bell
  count(order where served = no) "orders to cook" head
  each order where served = no sort at as o
    stack card gap 1
      "Table" o.table_no head
      o.qty "x" o.dish.name big
      row gap 1
        o.at faint grow
        button "Ready" tap set o.served = yes
screen sales "Sales" wallet
  stat sum(order today, it.qty * it.dish.price), "sales today"
  stat count(order today), "orders today"
  daybars last 7 days, sum(order on it, it.qty * it.dish.price)
