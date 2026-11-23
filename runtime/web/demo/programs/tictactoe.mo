app "Tic tac toe" board ink
table move game num, cell num 1..9, mark pick X|O
setting cur num = 1 "Game"
let n = count(move where game = cur)
let turn = if(n % 2 = 0, "X", "O")
let won(m text) = countof([123, 456, 789, 147, 258, 369, 159, 357], count(move where game = cur and mark = m and (cell = floor(it / 100) or cell = floor(it / 10) % 10 or cell = it % 10)) = 3) > 0
let xw = won(X)
let ow = won(O)
stack gap 4 align center
  stack gap 0 align center
    if xw or ow
      if(xw, "X", "O") "wins this one" big color good
    else
      if(n = 9, "A draw", turn) if(n = 9, "", "to play") big
    "Game" cur "· move" n + 1 color muted
  grid 3 gap 1 width 312
    each 1..9 as c
      if count(move where game = cur and cell = c) = 0 and not xw and not ow
        box height 96 radius 12 fill soft tap add move game = cur, cell = c, mark = turn
      else
        box height 96 radius 12 fill surface
          last(move.mark where game = cur and cell = c) size huge align center color if(last(move.mark where game = cur and cell = c) = X, accent, ink)
  button "New game" fill accent tap set cur = cur + 1
