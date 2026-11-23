app "What I read" book plum
table book title text, author text?
table note book ref book, idea long, revisited date?
"Revisit one today" head
each note sort revisited top 1 as n
  stack card gap 1
    n.book.title faint
    n.idea
    button "Revisited" tap set n.revisited = today
"All notes" head
each book as b
  stack card gap 1
    b.title bold
    each b.note as n
      n.idea small
form book, "Add book"
form note, "Add what I learned"
