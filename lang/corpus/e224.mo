app "Habit week" check mint
table did
"This week" head
row gap 1
  each days week as d
    stack grow align center tap toggle did on d
      draw width 44
        circle 50, 50, 44 fill if(count(did on d) > 0, accent, soft)
      dayname(d) size tiny
streak(did) "day streak" faint
