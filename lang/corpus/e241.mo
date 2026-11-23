app "Meal plan" food mint
table meal dish text, cost money
setting budget money = 20000 "Food budget for the month"
goal sum(meal.cost month), budget, "planned this month"
each days month as d
  if count(meal on d) > 0
    stack card gap 1
      dayname(d) monthday(d) bold
      each meal on d as m
        row tap edit m swipe remove m
          m.dish grow
          m.cost
form meal, "Plan a meal"
