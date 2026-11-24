app "Weekly meals" food mint
table meal day pick Mon|Tue|Wed|Thu|Fri|Sat|Sun, kind pick Breakfast|Lunch|Dinner, dish text, prep text?
"Today" head
each options meal.day as d
  if index + 1 = weekday(today)
    each meal where day = d as m empty "Nothing planned today"
      row card
        m.kind faint
        m.dish bold grow
        m.prep
form meal, "Add meal"
each options meal.day as d
  if count(meal where day = d) > 0
    d head
    each meal where day = d as m
      row card tap edit m swipe remove m
        m.kind faint
        m.dish grow
        m.prep faint
