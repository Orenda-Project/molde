app "Pot ring" users plum
table member name text, ord num 1..10
table payout member ref member
setting contribution money = 5000 "Monthly contribution"
count(payout last 10 months) "of" count(member) "have received the pot this round" head
draw 100, 100 width 320
  circle 50.0, 14.0, 9 fill if(count(payout last 10 months where member.ord = 1) > 0, good, soft)
  label 50.0, 14.0, first(member.name where ord = 1) size tiny
  circle 71.2, 20.9, 9 fill if(count(payout last 10 months where member.ord = 2) > 0, good, soft)
  label 71.2, 20.9, first(member.name where ord = 2) size tiny
  circle 84.2, 38.9, 9 fill if(count(payout last 10 months where member.ord = 3) > 0, good, soft)
  label 84.2, 38.9, first(member.name where ord = 3) size tiny
  circle 84.2, 61.1, 9 fill if(count(payout last 10 months where member.ord = 4) > 0, good, soft)
  label 84.2, 61.1, first(member.name where ord = 4) size tiny
  circle 71.2, 79.1, 9 fill if(count(payout last 10 months where member.ord = 5) > 0, good, soft)
  label 71.2, 79.1, first(member.name where ord = 5) size tiny
  circle 50.0, 86.0, 9 fill if(count(payout last 10 months where member.ord = 6) > 0, good, soft)
  label 50.0, 86.0, first(member.name where ord = 6) size tiny
  circle 28.8, 79.1, 9 fill if(count(payout last 10 months where member.ord = 7) > 0, good, soft)
  label 28.8, 79.1, first(member.name where ord = 7) size tiny
  circle 15.8, 61.1, 9 fill if(count(payout last 10 months where member.ord = 8) > 0, good, soft)
  label 15.8, 61.1, first(member.name where ord = 8) size tiny
  circle 15.8, 38.9, 9 fill if(count(payout last 10 months where member.ord = 9) > 0, good, soft)
  label 15.8, 38.9, first(member.name where ord = 9) size tiny
  circle 28.8, 20.9, 9 fill if(count(payout last 10 months where member.ord = 10) > 0, good, soft)
  label 28.8, 20.9, first(member.name where ord = 10) size tiny
each member sort ord as m
  row card gap 1
    m.ord bold
    m.name grow
    if count(m.payout last 10 months) = 0
      button "Got the pot" tap add payout member = m
    else
      "Received" color good
form member, "Add member"
