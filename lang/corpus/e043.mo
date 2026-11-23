app "Savings Thermometer" coin mint
table saved amount money
setting goal money = 50000 "Goal"
let total = sum(saved.amount all)
row gap 3 align center
  draw 40, 120 width 80
    rect 15, 5, 10, 90 stroke edge thick 1 radius 5
    rect 16, 95 - 88 * clamp(total / goal, 0, 1), 8, 88 * clamp(total / goal, 0, 1) fill accent radius 4
    circle 20, 105, 12 fill accent
  stack grow gap 1
    text total big
    "of" goal faint
    round(100 * clamp(total / goal, 0, 1)) "% there" head
quick saved, amount, [500, 1000, 5000]
form saved, "Add savings"
list saved
