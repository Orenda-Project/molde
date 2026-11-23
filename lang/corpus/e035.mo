app "Fitness Coach" dumbbell ocean
table client name text, plan long
table checkin client ref client, weight num 20..300 unit "kg", note text?
table photo client ref client, pic image
table pay client ref client, status pick Paid|Due, amount money
each client as c
  stack card gap 1
    row
      c.name head grow
      last(c.pay.status) bold color if(last(c.pay.status) = Paid, good, warn)
    c.plan faint
    "Last check-in:" last(c.checkin.weight) "kg," since(c.checkin) "days ago" faint
    scroll
      each c.photo
        image it.pic
    button "Edit plan" tap edit c
form client, "Add client"
form checkin, "Weekly check-in"
form photo, "Add progress photo"
form pay, "Payment"
