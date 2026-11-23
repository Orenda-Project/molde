app "Storage" phone slate
setting total num 1..4000 = 128 "Total storage (GB)"
setting free num 0..4000 = 50 "Free storage (GB)"
let frac = clamp(free / total, 0, 1)
draw 100, 40 width 220
  rect 2, 6, 88, 28 stroke ink thick 2 radius 5
  rect 92, 14, 5, 12 fill ink radius 2
  rect 5, 9, 82 * frac, 22 fill if(frac < 0.15, bad, good) radius 3
free "GB free of" total "GB" big
field free "Free storage (GB)"
field total "Total storage (GB)"
