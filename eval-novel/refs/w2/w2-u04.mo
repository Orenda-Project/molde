app "Seating" seat slate
table seat rw num 1..5, cl num 1..6, name text
state sr num = 1
state sc num = 1
state nm text
stat count(1..30, count(seat where rw = floor((it - 1) / 6) + 1 and cl = (it - 1) % 6 + 1) > 0), "seats filled"
grid 6 gap 1
  each 1..5 as rr
    each 1..6 as cc
      let cn = last(seat where rw = rr and cl = cc)
      box height 44 radius 8 tap set sr = rr then set sc = cc fill if(count(seat where rw = rr and cl = cc) > 0, accent, soft) stroke if(sr = rr and sc = cc, ink, edge)
        cn.name tiny align center
"Row" sr "seat" sc bold
field nm "Student name"
row gap 1
  button "Seat here" tap add seat rw = sr, cl = sc, name = nm then set nm = ""
  button "Clear seat" tap remove all seat where rw = sr and cl = sc
