app "Seating" users plum
table guest name text, seat num? 1..10
"Table of 10" head
grid 5 gap 1
  each 1..10 as n
    box height 70 radius 12 fill if(count(guest where seat = n) > 0, accent, soft)
      text n size tiny align center
      last(guest.name where seat = n) bold align center
each guest sort name as g
  row card gap 2
    g.name bold grow
    field g.seat "Seat"
form guest, "Add guest"
