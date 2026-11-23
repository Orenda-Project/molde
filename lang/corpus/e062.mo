app "Tailor Shop" pen plum
table customer name text, phone text?, chest num 20..80, waist num 20..80, sleeve num 10..40
table orderx customer ref customer, what text, due date, ready bool
table fabric name text, meters num 0..
remind "Order due" at orderx.due
each orderx where ready = no sort due
  row card tap edit it
    stack grow
      it.customer.name it.what bold
      "due" it.due faint color if(it.due < today, bad, muted)
    toggle it.ready
"Fabric stock" head
list fabric
form customer, "Add customer"
form orderx, "Add order"
form fabric, "Add fabric"
