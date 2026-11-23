app "Dad Medicine Chart" pill plum
table med time time, dose text
table given med ref med, who text
each med sort time
  row card
    stack grow
      it.time it.dose bold
      "Given today:" count(it.given today) "times. Last by" last(it.given.who) faint
    button "Given" tap add given med = it, who = "Me"
form med, "Add medicine time"
"Given log" head
list given
