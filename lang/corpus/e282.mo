app "Goat vaccines" paw mint
table goat name text
table vaccine goat ref goat, name text, given date, next_due date
remind "A goat vaccine is due" at vaccine.next_due
each goat as g
  stack card gap 1 tap edit g
    g.name bold
    each g.vaccine sort given as v
      row gap 1
        v.name grow
        "given" v.given
        if v.next_due <= today
          "Due" bold color bad
form goat, "Add goat"
form vaccine, "Add vaccine given"
