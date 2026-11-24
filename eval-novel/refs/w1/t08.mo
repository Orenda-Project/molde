app "Pigeon loft" paw mint
table bird ring text, colour text, gender pick Cock|Hen, partner text? "Pair partner (ring)"
table clutch bird ref bird, kind pick Egg|Chick, n num 1..4 = 2, day date = today
stat count(bird), "birds in the loft"
form bird, "Add bird"
each bird empty "No birds yet"
  row card tap edit it
    stack grow gap 0
      it.ring bold
      it.colour it.gender faint
    "pair" it.partner faint
    "eggs/chicks" sum(it.clutch.n) faint
"Egg and chick log" head
form clutch, "Log eggs or chicks"
list clutch by day
