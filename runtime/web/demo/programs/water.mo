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
stack card gap 2
  row
    "Today" head grow
    plural(count(drink today), "drink") faint
  each drink today as d empty "Nothing yet today. Tap + 250 ml when you have a glass."
    row tap edit d swipe remove d
      d.kind grow
      d.ml "ml" bold
stack card gap 3
  row
    "Last 7 days" head grow
    "Goal met on" countof(days last 7 days, sum(drink.ml on it) >= goal) "of 7 days" faint
  plot 0..7, 0..max(goal, maxof(days last 7 days, sum(drink.ml on it))) axes gridlines
    line 0, goal, 7, goal stroke ink thick 1
    each days last 7 days
      rect index + 0.15, 0, 0.7, sum(drink.ml on it) fill if(sum(drink.ml on it) >= goal, accent, muted) opacity if(sum(drink.ml on it) >= goal, 1, 0.5) radius 3
      tick index + 0.5, dayname(it)
  row gap 3
    row gap 1
      box width 14 height 14 radius 4 fill accent
      "Reached the goal (the dark line)" faint
    row gap 1
      box width 14 height 14 radius 4 fill muted opacity 0.5
      "Not yet" faint
