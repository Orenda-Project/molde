app "Tea and coffee" coffee ink
table cup kind pick Tea|Coffee
setting limit num = 4 "Daily limit"
row gap 1
  each options cup.kind
    button "+" it tap add cup kind = it
goal count(cup today), limit, "cups today"
row gap 2
  stat count(cup today where kind = Tea), "tea"
  stat count(cup today where kind = Coffee), "coffee"
button "Undo last" tap remove last(cup today)
daybars last 7 days, count(cup on it)
