app "Study notes" book plum
table note topic text, source text, points long, revised bool
"To revise, by week studied" head
each note where revised = no by week as g
  g.key bold faint
  each g as n
    row card tap edit n
      toggle n.revised
      stack grow
        n.topic bold
        n.source n.at faint
"All notes" head
list note
form note, "Add note"
