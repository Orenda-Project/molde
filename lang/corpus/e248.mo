app "Tailor" pencil plum
table order customer text, phone text?, garment pick Shirt|Trouser|Suit|Kameez|Other, chest num 0.., waist num 0.., length num 0.., fabric money, charge money, advance money = 0, delivery date
"Due this week" head
each order where delivery >= today and delivery <= today + 7 sort delivery as o
  row card tap edit o
    stack grow
      o.customer o.garment bold
      "Delivery" o.delivery o.phone faint
    "Balance" o.fabric + o.charge - o.advance bold
"Balance by customer" head
each order by customer
  row
    it.key grow
    sum(it.fabric) + sum(it.charge) - sum(it.advance) bold
form order, "New order"
"All orders" head
list order
