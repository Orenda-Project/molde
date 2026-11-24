app "Candidates" users plum
table cand name text, role text, stage pick Applied|Phone_screen|Onsite|Offer|Rejected = Applied, score num 1..5
stat avg(cand.score), "average score"
form cand, "Add candidate"
each options cand.stage as st
  row gap 1
    st head grow
    count(cand where stage = st) faint
  each cand where stage = st as c
    stack card gap 1 swipe remove c
      row
        c.name bold grow
        c.role faint
        c.score "/5"
      choice c.stage
