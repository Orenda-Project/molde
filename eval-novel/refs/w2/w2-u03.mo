app "Ludo dice" dice mint
table throw face num 1..6
let face = if(count(throw) = 0, 1, last(throw.face))
draw 100, 100 width 160 middle tap add throw face = random(6)
  rect 4, 4, 92, 92 fill surface stroke ink thick 3 radius 16
  if face % 2 = 1
    circle 50, 50, 8 fill ink
  if face > 1
    circle 28, 28, 8 fill ink
    circle 72, 72, 8 fill ink
  if face > 3
    circle 72, 28, 8 fill ink
    circle 28, 72, 8 fill ink
  if face = 6
    circle 28, 50, 8 fill ink
    circle 72, 50, 8 fill ink
button "Roll" tap add throw face = random(6)
"Recent rolls" faint
row gap 1
  each throw top 8 as t
    t.face bold
