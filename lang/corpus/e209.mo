app "Ask the doctor" heart plum
table q question text, asked bool
count(q where asked = no) "things to ask" head
each q where asked = no as x
  row card swipe remove x
    toggle x.asked
    x.question grow
form q, "Add a question"
"Asked" faint
each q where asked = yes as x
  row swipe remove x
    toggle x.asked
    x.question color muted
