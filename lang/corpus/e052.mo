app "Spend Light" bell slate
table spend amount money, note text?
setting limit money = 2000 "Daily spending limit"
let s = sum(spend.amount today)
row gap 2 align center
  draw 40, 120 width 70
    rect 5, 0, 30, 120 fill ink radius 8
    circle 20, 20, 11 fill if(s > limit, bad, soft)
    circle 20, 60, 11 fill if(s <= limit and s > limit * 0.8, warn, soft)
    circle 20, 100, 11 fill if(s <= limit * 0.8, good, soft)
  stack gap 1
    text s big
    if(s > limit, "Over your limit", "Under your limit") "of" limit head
form spend, "Add spending"
