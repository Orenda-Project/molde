app "Goats" paw mint
table goat tag text, breed text, born date
table weight goat ref goat, kg num 0..200 unit "kg"
table vaccine goat ref goat, name text, due date
table deworm goat ref goat
"Vaccines due in 7 days" countof(vaccine, it.due - today <= 7 and it.due >= today) big color if(countof(vaccine, it.due - today <= 7 and it.due >= today) > 0, warn, ink)
each vaccine where due - today <= 7 and due >= today sort due
  row card
    it.goat.tag it.name grow
    it.due bold color warn
remind "Vaccine due" at vaccine.due
each goat as g
  stack card gap 1
    g.tag g.breed head
    "Born" g.born "| Last dewormed" last(g.deworm.at) faint
    "Weight by month" faint
    trend g.weight, it.kg
    button "Dewormed today" tap add deworm goat = g
form goat, "Add goat"
form weight, "Log weight"
form vaccine, "Add vaccine"
