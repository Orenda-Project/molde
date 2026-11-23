app "Cricket" ball ocean
table ball team pick A|B = A, runs num 0..6 = 0, wide bool, out bool
setting name_a text = "Team A" "Team A name"
setting name_b text = "Team B" "Team B name"
state bat pick A|B = A
let la = count(ball where team = A and wide = no)
let lb = count(ball where team = B and wide = no)
let ra = sum(ball.runs where team = A) + count(ball where team = A and wide = yes)
let rb = sum(ball.runs where team = B) + count(ball where team = B and wide = yes)
row gap 2
  stack card grow
    name_a head
    ra "/" count(ball where team = A and out = yes) big
    "Overs" floor(la / 6) + la % 6 / 10 faint
  stack card grow
    name_b head
    rb "/" count(ball where team = B and out = yes) big
    "Overs" floor(lb / 6) + lb % 6 / 10 faint
choice bat
row gap 1
  each [0, 1, 2, 3, 4, 6]
    button it tap add ball team = bat, runs = it
row gap 1
  button "Wide" tap add ball team = bat, wide = yes
  button "Out" fill bad tap add ball team = bat, out = yes
  button "Undo" tap remove last(ball)
"Last balls" faint
row gap 1
  each ball sort at desc top 6
    draw width 36
      circle 50, 50, 46 fill if(it.out, bad, if(it.runs >= 4, good, soft))
      if it.out
        label 50, 50, "W" bold
      else
        label 50, 50, it.runs bold
