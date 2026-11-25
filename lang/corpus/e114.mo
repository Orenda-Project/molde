app "Juz progress" book mint
table read juz num 1..30, pages num 1..20 = 20
let total = sum(read.pages)
round(100 * total / 604) "% of the Quran read" big
draw 100, 4
  rect 0, 0, 100, 4 fill soft radius 2
  rect 0, 0, 100 * clamp(total / 604, 0, 1), 4 fill accent radius 2
each 1..30 as j
  let got = sum(read.pages where juz = j)
  stack card gap 1
    row
      "Juz" j bold grow
      round(100 * clamp(got / 20, 0, 1)) "%" faint
    draw 100, 4
      rect 0, 0, 100, 4 fill soft radius 2
      rect 0, 0, 100 * clamp(got / 20, 0, 1), 4 fill good radius 2
    if got < 20
      button "Mark read" tap add read juz = j, pages = 20 - got
