app "Who pays" coin plum
table person name text
table paid who text
form person, "Add colleague"
draw 100, 100 width 220 middle
  circle 50, 50, 46 fill soft stroke accent thick 2
  each person as p
    label 50 + 32 * sin(360 * index / max(count(person), 1)), 50 - 32 * cos(360 * index / max(count(person), 1)), p.name small
  label 50, 50, last(paid.who) bold
button "Spin" tap add paid who = random(person).name
"Pays today:" last(paid.who) huge
"History" faint
each paid top 5 as h
  h.who
