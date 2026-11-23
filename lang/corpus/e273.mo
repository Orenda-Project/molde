app "Holiday bingo" star mint
table square task text, done bool
count(square where done = yes) "of 25 done" head
grid 5 gap 1
  each square sort at top 25 as s
    box height 64 radius 8 fill if(s.done, accent, soft) tap set s.done = not s.done
      s.task size tiny align center color if(s.done, bg, ink)
form square, "Add square"
