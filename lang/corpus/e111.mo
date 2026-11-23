app "Meri dukan" package slate
table item name text, qty num 0.., low num 0.. = 5, price money?
let short = count(item, it.qty <= it.low)
short "items running low" head color if(short > 0, warn, good)
each item sort qty as i
  row card gap 1 tap edit i swipe remove i
    i.name bold grow color if(i.qty <= i.low, warn, ink)
    button "-" tap set i.qty = i.qty - 1
    i.qty bold
    button "+" tap set i.qty = i.qty + 1
"Stock value" sum(item, it.qty * it.price) faint
form item, "Add item"
