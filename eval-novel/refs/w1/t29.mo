app "Quran paras" book mint
table finished para num 1..30
let left = 30 - count(finished)
setting eid date = 2027-03-10 "Eid date"
goal count(finished), 30, "paras finished"
row gap 3
  stat left, "paras left"
  stat eid - today, "days till Eid"
grid 2 gap 1
  each 1..30
    row card
      "Para" it bold grow
      last(finished.at where para = it) faint
      toggle finished all where para = it
