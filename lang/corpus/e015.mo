app "Shop Stock" bag slate
table item name text, buy money, sell money, qty num 0..
table sale item ref item, n num 1..
setting low num = 5 "Low stock level"
let sold = sum(sale today, it.n * it.item.sell)
let profit = sum(sale today, it.n * (it.item.sell - it.item.buy))
row gap 3
  stat sold, "sales today"
  stat profit, "profit today"
each item where qty <= low sort name
  row card
    "Low stock:" it.name it.qty color bad
each item sort name
  row card gap 1
    stack grow
      it.name bold
      "Buy" it.buy "Sell" it.sell faint
    it.qty bold color if(it.qty <= low, bad, ink)
    button "Sell 1" tap add sale item = it, n = 1 then set it.qty = it.qty - 1
form item, "Add item"
