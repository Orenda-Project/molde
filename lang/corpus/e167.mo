app "Gym members" dumbbell ink
table member name text, joined date = today, expires date, fee money
table visit member ref member
remind "A gym membership is expiring" at member.expires
count(member where expires >= today) "active members" head
each member sort expires as m
  row card gap 1 tap edit m
    stack grow
      m.name bold
      "joined" m.joined "expires" m.expires faint
    count(m.visit) "visits"
    if(m.expires < today, "Expired", "Active") color if(m.expires < today, bad, good)
    button "Here" tap add visit member = m
form member, "Add member"
