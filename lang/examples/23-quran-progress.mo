app "Quran" book mint
table read juz num 1..30, pages num 1..
setting daily num = 4 "Pages a day"
let done = sum(read.pages)
goal done, 604, "pages read", "pages"
grid 10 gap 1
  each 1..30
    box height 22 radius 4 fill if(it <= max(read.juz), accent, soft)
      text it size tiny align center
"Today" sum(read.pages today) "of" daily "pages" faint
heat last 28 days, sum(read.pages on it), daily
"At this pace you finish in" round((604 - done) * 30 / sum(read.pages last 30 days)) "days" faint
form read
log read
