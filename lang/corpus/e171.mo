app "Day planner" calendar ocean
table task what text, done bool
table appt what text, day date = today, at_time time
table shop item text, got bool
table prayer name text, time time
remind "Prayer time" at prayer.time
screen plan "Today" calendar
  count(task where done = no) "tasks left" head
  each appt where day = today sort at_time as a
    row card
      a.at_time bold
      a.what grow
  each task where done = no as t
    row card swipe remove t
      toggle t.done
      t.what grow
  form task, "Add task"
screen appts "Appointments" clock
  each appt where day >= today sort day as a
    row card tap edit a swipe remove a
      a.day a.at_time bold
      a.what grow
  form appt, "Add appointment"
screen shopping "Shopping" cart
  each shop as s
    row card swipe remove s
      toggle s.got
      s.item grow
  form shop, "Add item"
screen prayers "Prayers" mosque
  list prayer
  form prayer, "Add prayer time"
