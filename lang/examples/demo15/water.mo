app "Water" drop ocean
table drink ml num 1..5000 unit "ml", kind pick Water|Tea|Juice|Milk = Water
setting goal num = 2000 "Daily goal (ml)"
let ml = sum(drink.ml today)
let p = clamp(ml / goal, 0, 1)
row gap 4 align center
  draw 56, 108 width 88
    rect 8, 104 - 100 * p, 40, 100 * p fill accent
    path "M6 4h44l-6 100H12z" stroke ink thick 2
  stack grow gap 1
    ml "ml" big
    "of" goal "ml today" color muted tap edit goal
    if ml >= goal
      "Goal reached" bold color good
    else
      text goal - ml "ml to go" bold
row gap 1
  button "+ 250 ml" fill accent grow tap add drink ml = 250
  button "+ 150 ml" grow tap add drink ml = 150
  button "+ 500 ml" grow tap add drink ml = 500
section "Today", plural(count(drink today), "drink")
  each drink today as d empty "Nothing yet today. Tap + 250 ml when you have a glass."
    row tap edit d swipe remove d
      d.kind grow
      d.ml "ml" bold
section "Last 7 days", "Goal met on" count(days last 7 days, sum(drink.ml on it) >= goal) "of 7 days"
  goalbars last 7 days, sum(drink.ml on it), goal, "Reached the goal (the dark line)"
