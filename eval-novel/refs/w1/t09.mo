app "Kite stock" box ocean
table item name text, kind pick Patang|Dor|Manjha, size text?, qty num 0.. unit "pcs", buy money, sell money
stat sum(item, it.qty * it.buy), "stock value at cost"
"Low stock (under 20):" count(item where qty < 20) color if(count(item where qty < 20) > 0, warn, ink)
form item, "Add item"
each item sort it.qty
  row card fill if(it.qty < 20, warn, surface) tap edit it
    stack grow gap 0
      it.name bold
      it.kind it.size faint
    button "-" tap set it.qty = it.qty - 1
    it.qty bold
    button "+" tap set it.qty = it.qty + 1
