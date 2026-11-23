app "Water" drop ocean
table drink ml num 1..5000 unit "ml"
setting goal num = 2000 "Daily goal (ml)"
let ml = sum(drink.ml today)
let p = clamp(ml / goal, 0, 1)
row gap 3
  draw 56, 108 width 56
    rect 8, 104 - 100 * p, 40, 100 * p fill accent
    path "M6 4h44l-6 100H12z" stroke ink thick 2
  stack grow
    text ml "ml" big
    "Goal" goal "ml" faint tap edit goal
quick drink, ml, [250, 500]
form drink
daybars last 7 days, sum(drink.ml on it)
list drink
