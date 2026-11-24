app "Diesel tank" bolt ink
table run hours num 0..
table refill
let used = if(count(refill) = 0, sum(run.hours), sum(run.hours where at > last(refill.at)))
let left = max(20 - 1.5 * used, 0)
draw 100, 100 width 140 middle
  rect 20, 10, 60, 80 fill soft stroke ink thick 3 radius 8
  rect 22, 88 - 76 * left / 20, 56, 76 * left / 20 fill if(left < 4, bad, accent) radius 5
  label 50, 50, fixed(left, 1) "L" bold
stat left, "litres left"
form run, "Log hours run"
button "Refill tank" tap add refill
