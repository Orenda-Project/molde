app "Library lending" book plum
table loan borrower text, title text, given date = today, returns date, back bool
remind "A borrowed book is due back" at loan.returns
let late = count(loan where back = no and returns < today)
text late "overdue books" head color if(late > 0, bad, good)
each loan where back = no sort returns as l
  row card gap 1 tap edit l
    stack grow
      l.title bold
      l.borrower faint
    if(l.returns < today, "Overdue", "Due") l.returns color if(l.returns < today, bad, ink)
    toggle l.back
form loan, "Lend a book"
