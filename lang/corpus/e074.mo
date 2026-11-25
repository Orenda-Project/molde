app "Family Water" drop ocean
table person name text
table glass person ref person
setting target num = 8 "Target glasses a day"
remind "Drink water" at 11:00, 16:00
each person sort name
  stack card gap 1
    row
      it.name head grow
      button "+1 glass" tap add glass person = it
    goal count(it.glass today), target, "glasses today"
"This week" head
bars person, count(it.glass week), it.name
form person, "Add person"
