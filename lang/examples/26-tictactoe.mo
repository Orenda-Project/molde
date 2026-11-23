app "Tic tac toe" board ink
table move game num, cell num 1..9, mark pick X|O
setting cur num = 1 "Game"
let n = count(move where game = cur)
let turn = if(n % 2 = 0, "X", "O")
let win(m text) = countof([123, 456, 789, 147, 258, 369, 159, 357], count(move where game = cur and mark = m and (cell = floor(it / 100) or cell = floor(it / 10) % 10 or cell = it % 10)) = 3) > 0
let xw = win("X")
let ow = win("O")
if xw or ow
  if(xw, "X", "O") "wins!" big
else
  if(n = 9, "Draw", turn) if(n = 9, "", "to play") big
grid 3 gap 1
  each 1..9 as c
    if count(move where game = cur and cell = c) = 0 and not xw and not ow
      box height 80 radius 8 fill soft tap add move game = cur, cell = c, mark = turn
    else
      box height 80 radius 8 fill surface
        last(move.mark where game = cur and cell = c) big align center
button "New game" tap set cur = cur + 1
