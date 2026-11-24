app "Gully over" ball mint
table ball over num 1.., runs num 0..6, out bool
state ov num = 1 keep
let nb = count(ball where over = ov)
"Over" ov head
row gap 1
  each 1..6 as k
    draw 40, 40 width 40
      circle 20, 20, 17 fill if(nb >= k, if(nth(ball where over = ov sort at, k).out, bad, accent), soft)
      label 20, 21, if(nb >= k, if(nth(ball where over = ov sort at, k).out, "W", join(nth(ball where over = ov sort at, k).runs)), "") bold
if nb < 6
  row gap 1
    each [0, 1, 2, 3, 4, 6] as v
      button v tap add ball over = ov, runs = v
    button "W" tap add ball over = ov, runs = 0, out = yes
else
  button "New over" tap set ov = ov + 1
row gap 2
  stat sum(ball.runs), "runs"
  stat count(ball where out = yes), "wickets"
"Overs completed:" ov - 1 + if(nb = 6, 1, 0) faint
