app "Special days" gift plum
table event name text, kind pick Birthday|Anniversary = Birthday, day date, alert date, gift text?, budget money?
state n text = ""
state k pick Birthday|Anniversary = Birthday
state dt date = today
state g text = ""
state b money = 0
field n "Name"
choice k
field dt "Date"
field g "Gift idea"
field b "Budget"
button "Add" tap add event name = n, kind = k, day = dt, alert = dt - 7, gift = g, budget = b then set n = "" then set g = ""
remind "An event is coming in a week" at event.alert
remind "Event today" at event.day
each event sort day as e
  row card gap 1 tap edit e swipe remove e
    stack grow
      e.name bold
      e.kind e.day faint
      e.gift faint
    e.budget
    if e.day < today
      button "Next year" tap set e.day = addmonths(e.day, 12) then set e.alert = addmonths(e.alert, 12)
"Budget for upcoming" sum(event where day >= today, it.budget) faint
