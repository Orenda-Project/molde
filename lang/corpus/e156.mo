app "Online orders" bag ocean
table order customer text, item text, amount money, status pick New|Packed|Shipped|Delivered = New
count(order where status = New) "new orders" head
row gap 1
  each options order.status as s
    stat count(order where status = s), s
each order where status != Delivered sort at as o
  row card gap 1 tap edit o
    stack grow
      o.customer bold
      o.item faint
    o.amount
    choice o.status
form order, "New order"
