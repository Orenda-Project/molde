app "English cards" cards plum
table card word text, meaning text
table mark card ref card, result pick Known|Again
state i num = 1
state flip bool = no
stat count(mark where result = Known), "known"
form card, "Add card"
if count(card) > 0
  let cur = nth(card sort at, i)
  stack card align center gap 2 tap set flip = not flip
    cur.word huge
    if flip
      cur.meaning large
    else
      "Tap to flip" faint
  row gap 1
    button "Again" tap add mark card = nth(card sort at, i), result = Again then set flip = no then set i = i % count(card) + 1
    button "Known" tap add mark card = nth(card sort at, i), result = Known then set flip = no then set i = i % count(card) + 1
  button "Next card" tap set flip = no then set i = i % count(card) + 1
