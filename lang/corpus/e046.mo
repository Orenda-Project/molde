app "Timetable" school ocean
table cell day pick Mon|Tue|Wed|Thu|Fri, period num 1..8, subject pick Maths|English|Science|Urdu|Islamiat|Free = Free
grid 5 gap 1
  each options cell.day as dd
    stack gap 1
      dd bold align center
      each 1..8 as p
        if count(cell where day = dd and period = p) = 0
          box height 40 radius 6 fill soft tap add cell day = dd, period = p
            p size tiny color muted align center
        each cell where day = dd and period = p as c
          box height 40 radius 6 fill if(c.subject = Maths, accent, if(c.subject = English, good, if(c.subject = Science, warn, if(c.subject = Urdu, bad, if(c.subject = Islamiat, ink, soft))))) tap edit c
            c.subject size tiny bold align center color bg
