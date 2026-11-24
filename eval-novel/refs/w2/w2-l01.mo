app "Wedding guests" users plum
table guest name text, side pick Bride|Groom, rsvp pick Yes|No|Pending = Pending
stat count(guest where rsvp = Yes), "total headcount (said yes)"
row gap 2
  stat count(guest where side = Bride), "bride side"
  stat count(guest where side = Groom), "groom side"
form guest, "Add guest"
each guest as g empty "No guests yet"
  row card tap edit g swipe remove g
    g.name bold grow
    g.side faint
    g.rsvp fill if(g.rsvp = Yes, good, soft)
