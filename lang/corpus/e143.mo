app "Kabaddi" game ink
table raid team pick A|B, pts num 0..7 = 0
setting team_a text = "Team A" "Team A name"
setting team_b text = "Team B" "Team B name"
row gap 2
  stack card grow align center gap 1
    team_a head
    sum(raid.pts where team = A) big size huge
    button "Raid point" tap add raid team = A, pts = 1
    button "Bonus point" tap add raid team = A, pts = 2
    button "Super raid" tap add raid team = A, pts = 3
    button "Empty raid" tap add raid team = A, pts = 0
  stack card grow align center gap 1
    team_b head
    sum(raid.pts where team = B) big size huge
    button "Raid point" tap add raid team = B, pts = 1
    button "Bonus point" tap add raid team = B, pts = 2
    button "Super raid" tap add raid team = B, pts = 3
    button "Empty raid" tap add raid team = B, pts = 0
button "Undo last raid" tap remove last(raid)
