app "Cricket Coaching" ball ocean
table kid name text
table attend kid ref kid
table practice kid ref kid, shots num 1..200, correct num 0..200
"Present today" count(attend today) "of" count(kid) head
each kid sort name
  row card
    it.name grow
    toggle it.attend
form kid, "Add kid"
form practice, "Log batting practice"
"Monthly report" head
each kid as k
  stack card gap 1
    k.name bold
    "Days present" count(k.attend month) "| Shots" sum(k.practice.shots month) "| Correct" sum(k.practice.correct month) faint
    goal sum(k.practice.correct month), sum(k.practice.shots month), "shots correct"
