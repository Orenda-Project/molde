app "Seating" seat mint
table absent seat num 1..30
"Absent today" count(absent today) "of 30" head
grid 6 gap 1
  each 1..30
    box height 44 radius 6 fill if(count(absent today where seat = it) > 0, bad, good) tap toggle absent today where seat = it
      text it bold align center
