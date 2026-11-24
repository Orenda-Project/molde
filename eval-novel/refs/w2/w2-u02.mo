app "Volleyball" ball ocean
table rally side pick Home|Away, set num 1..5
state cur num = 1 keep
let hs(s num) = count(rally where set = s and side = Home)
let as_(s num) = count(rally where set = s and side = Away)
let won(a num, b num) = a >= 25 and a - b >= 2
let home = hs(cur)
let away = as_(cur)
let over = won(home, away) or won(away, home)
row gap 2
  stack align center grow
    "Home" bold
    home huge
    count(1..5, won(hs(it), as_(it))) "sets" faint
    button "+1" tap add rally side = Home, set = cur
  stack align center grow
    "Away" bold
    away huge
    count(1..5, won(as_(it), hs(it))) "sets" faint
    button "+1" tap add rally side = Away, set = cur
"Set" cur "of 5" faint
if over
  "Set won" bold color good
  button "Next set" tap set cur = min(cur + 1, 5)
button "Reset match" tap remove all rally then set cur = 1
