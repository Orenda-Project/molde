app "Match Scores" ball ocean
table ball runs num 0..6 = 0, wide bool, out bool
setting overs num = 20
let legal = count(ball today where wide = no)
let runs = sum(ball.runs today) + count(ball today where wide = yes)
let wkts = count(ball today where out = yes)
text runs "/" wkts big
"Overs" floor(legal / 6) + legal % 6 / 10 "of" overs faint
row gap 1
  each [0, 1, 2, 3, 4, 6]
    button it tap add ball runs = it
row gap 1
  button "Wide" tap add ball wide = yes
  button "Out" fill bad tap add ball out = yes
  button "Undo" tap remove last(ball today)
