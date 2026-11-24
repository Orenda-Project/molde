app "Lent books" book plum
table lent title text, who text "Borrower", since date = today, back bool "Returned"
"Still out" head
each lent where back = no sort it.since empty "Everything is back home"
  row card
    stack grow gap 0
      it.title bold
      it.who faint
    text today - it.since "days" faint
    toggle it.back
form lent, "Lend a book"
"Returned" head
each lent where back = yes
  row
    it.title faint grow
    it.who faint
