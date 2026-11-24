app "Carrom" game ink
table point team pick A|B|C, n num 1..9 = 1
table board
let sa = sum(point.n where team = A)
let sb = sum(point.n where team = B)
let sc = sum(point.n where team = C)
row gap 2
  stack align center grow
    "Team A" bold
    sa huge
    row gap 1
      button "+1" tap add point team = A, n = 1
      button "+2" tap add point team = A, n = 2
      button "+3" tap add point team = A, n = 3
  stack align center grow
    "Team B" bold
    sb huge
    row gap 1
      button "+1" tap add point team = B, n = 1
      button "+2" tap add point team = B, n = 2
      button "+3" tap add point team = B, n = 3
  stack align center grow
    "Team C" bold
    sc huge
    row gap 1
      button "+1" tap add point team = C, n = 1
      button "+2" tap add point team = C, n = 2
      button "+3" tap add point team = C, n = 3
"Boards played:" count(board) big
row gap 1
  button "Undo last point" tap remove last(point)
  button "New board" tap add board then remove all point
  button "Reset everything" tap remove all point then remove all board
