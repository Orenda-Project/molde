app "Cricket" ball ocean
table ball runs num 0..6 = 0, wide bool, out bool
setting overs num = 20
let legal = count(ball today where wide = no)
let runs = sum(ball.runs today) + count(ball today where wide = yes)
let wkts = count(ball today where out = yes)
stack card gap 2 align center
  "Home side batting" color muted
  runs "/" wkts huge
  floor(legal / 6) + legal % 6 / 10 "of" overs "overs" bold
  "Run rate" round(runs * 60 / legal) / 10 "· needs" overs * 6 - legal "more balls" faint
  row gap 1 align center
    each ball today sort at desc top 6
      draw width 40
        circle 46 fill if(it.out, bad, if(it.runs >= 4, good, soft))
        if it.out
          label 50, 50, "W" bold
        else
          if it.wide
            label 50, 50, "wd" bold
          else
            label 50, 50, it.runs bold
  "Last six balls, newest first" faint
"Runs off this ball" head
grid 4 gap 1
  each [0, 1, 2, 3, 4, 6]
    button it tap add ball runs = it
  button "Wide" tap add ball wide = yes
  button "Out" fill bad tap add ball out = yes
button "Undo last ball" tap remove last(ball today)
