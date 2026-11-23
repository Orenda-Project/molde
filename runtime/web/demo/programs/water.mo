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
    text ml "ml" big
    "of" goal "ml today" color muted tap edit goal
    if ml >= goal
      "Goal reached" bold color good
    else
      text goal - ml "ml to go" bold
row gap 1
  button "+ 250 ml" fill accent grow tap add drink ml = 250
  button "+ 150 ml" grow tap add drink ml = 150
  button "+ 500 ml" grow tap add drink ml = 500
stack card gap 3
  row
    "Last 7 days" head grow
    "Goal met" countof(days last 7 days, sum(drink.ml on it) >= goal) "of 7" faint
  row gap 1 align end
    each days last 7 days
      stack grow gap 1 align center
        round(sum(drink.ml on it) / 100) / 10 size tiny color muted
        draw 10, 64
          rect 0, 0, 10, 64 fill soft radius 3
          rect 0, 64 - 64 * clamp(sum(drink.ml on it) / goal, 0, 1), 10, 64 * clamp(sum(drink.ml on it) / goal, 0, 1) fill if(sum(drink.ml on it) >= goal, accent, muted) radius 3 opacity if(sum(drink.ml on it) >= goal, 1, 0.55)
        dayname(it) size tiny color if(it = today, ink, muted)
  "Litres per day. A full bar is the goal; blue bars reached it." faint
stack card gap 2
  row
    "Today" head grow
    count(drink today) if(count(drink today) = 1, "drink", "drinks") faint
  if count(drink today) = 0
    "Nothing yet today. Tap + 250 ml when you have a glass." color muted
  each drink today as d
    row tap edit d swipe remove d
      d.kind grow
      d.ml "ml" bold
