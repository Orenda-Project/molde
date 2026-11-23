app "Who cooks" food plum
table person name text, last_cooked date = today
"Cooks tonight" head
each person sort last_cooked top 1 as p
  stack card gap 1 align center
    p.name big size huge
    button "Cooked tonight" tap set p.last_cooked = today
each person sort last_cooked as p
  row card
    p.name grow
    p.last_cooked faint
form person, "Add person"
