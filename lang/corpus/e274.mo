app "Goats" paw mint
table goat name text, vaccinated date, next_due date
remind "A goat vaccine is due" at goat.next_due
each goat sort next_due as g
  stack card gap 1 tap edit g swipe remove g
    row gap 1
      g.name bold grow
      if g.next_due <= today
        box radius 6 pad 1 fill bad
          "Due" small bold color bg
    "Vaccinated" g.vaccinated ", next" g.next_due faint
form goat, "Add goat"
