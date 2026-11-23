app "School home" school ocean
table kid name text
table arrival kid ref kid
each kid as k
  row card gap 1
    stack grow
      k.name bold
      "Home today at" last(k.arrival.at today) faint
    button "Home now" tap add arrival kid = k
form kid, "Add child"
log arrival
