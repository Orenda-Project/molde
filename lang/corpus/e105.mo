app "Card night" cards plum
table player name text
table score player ref player, pts num 0..1000
each player as p
  row card
    p.name bold grow
    sum(p.score.pts) big
    button "+10" tap add score player = p, pts = 10
    button "+1" tap add score player = p, pts = 1
form player, "Add player"
form score, "Add score"
list score by day
