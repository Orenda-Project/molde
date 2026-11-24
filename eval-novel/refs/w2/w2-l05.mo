app "School supplies" pencil ocean
table supply name text, child pick Hamza|Zara, price money, bought bool
row gap 2
  stat sum(supply.price), "total cost"
  stat sum(supply.price where bought = no), "still to buy"
form supply, "Add item"
each options supply.child as k
  row gap 1
    k head grow
    sum(supply.price where child = k) faint
  each supply where child = k as s
    row card swipe remove s
      toggle s.bought
      s.name grow
      s.price
