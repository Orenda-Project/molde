app "Ludo turns" dice ink
table six p num 0..3
state turn num = 0 keep
grid 2 gap 2
  each ["Red", "Green", "Yellow", "Blue"] as nm
    stack card align center gap 1 fill if(index = 0, red, if(index = 1, green, if(index = 2, yellow, blue))) opacity if(index = turn, 1, 0.35)
      nm bold
      if(index = turn, "Your turn", "") small
      count(six where p = index) "sixes" small
"Sixes rolled:" count(six) big
row gap 1
  button "Rolled a 6" tap add six p = turn
  button "Next turn" tap set turn = (turn + 1) % 4
button "Reset game" tap remove all six then set turn = 0
