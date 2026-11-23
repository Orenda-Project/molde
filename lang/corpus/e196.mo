app "Tiffin" food mint
table customer name text
table order customer ref customer, meal pick Lunch|Dinner = Lunch, price money, delivery money = 0
row gap 2
  stat sum(order.price week), "income this week"
  stat sum(order.delivery week), "delivery cost"
  stat sum(order.price week) - sum(order.delivery week), "profit"
"Today's orders" head
each order today as o
  row card
    o.customer.name bold grow
    o.meal
    o.price
"Customers this week" head
each customer as c
  let pr = sum(c.order.price week) - sum(c.order.delivery week)
  row card gap 1 fill if(pr > 0 and pr = max(customer, sum(it.order.price week) - sum(it.order.delivery week)), good, surface)
    c.name bold grow
    count(c.order week) "orders"
    pr bold
    button "+ Lunch" tap add order customer = c, meal = Lunch, price = last(c.order.price)
form customer, "Add customer"
form order, "Add order"
