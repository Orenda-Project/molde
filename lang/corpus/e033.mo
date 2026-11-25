app "Gym" dumbbell slate
table member name text, fee money, due date, ends date
table checkin member ref member
table trainer who text, day pick Mon|Tue|Wed|Thu|Fri|Sat|Sun, start time
"Check-ins today" count(checkin today) big
"Fees due" head
each member where due <= today sort due
  row card
    it.name grow
    it.fee bold color bad
"Memberships ending in 14 days" head
each member where ends - today <= 14 and ends >= today sort ends
  row card
    it.name grow
    it.ends color warn
"Members" head
each member sort name
  row card
    it.name grow
    button "Check in" tap add checkin member = it
    button "Paid" tap set it.due = addmonths(it.due, 1)
"Trainer schedule" head
each trainer sort start
  row card tap edit it
    it.day it.start it.who
form member, "Add member"
form trainer, "Add trainer slot"
