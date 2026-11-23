app "Grocery" cart mint
table item name text, cat pick Vegetables|Dairy|Grains|Spices|Cleaning|Medicine, qty num 1.. = 1, price money?, got bool
"Estimated total" sumof(item, it.qty * it.price) big
"In the cart" sumof(item where got = yes, it.qty * it.price) faint
each options item.cat as k
  if count(item where cat = k) > 0
    k head
    each item where cat = k as i
      row card swipe remove i
        toggle i.got
        i.name "x" i.qty grow color if(i.got, muted, ink)
        i.qty * i.price
form item, "Add item"
