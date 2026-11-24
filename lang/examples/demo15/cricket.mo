app "Cricket" ball ocean
table ball runs num 0..6 = 0, wide bool, out bool
setting overs num = 20
let legal = count(ball today where wide = no)
let runs = sum(ball.runs today) + count(ball today where wide = yes)
let wkts = count(ball today where out = yes)
section "Home side batting", "overs" floor(legal / 6) + legal % 6 / 10 "of" overs
  runs "/" wkts huge
  "Run rate" round(runs * 60 / max(legal, 1)) / 10 "· needs" overs * 6 - legal "more balls" faint
"Runs off this ball" head
grid 4 gap 1
  each [0, 1, 2, 3, 4, 6]
    button it tap add ball runs = it
  button "Wide" tap add ball wide = yes
  button "Out" fill bad tap add ball out = yes
button "Undo last ball" tap remove last(ball today)
