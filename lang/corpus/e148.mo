app "Loans lent" wallet slate
table loan person text, amount money, given date = today, due date, returned money = 0
let owed = sumof(loan, it.amount - it.returned)
"Still owed to you" owed big
"Overdue people" head color bad
each loan where due < today and returned < amount sort due as l
  row card gap 1 tap edit l
    stack grow
      l.person bold
      l.due faint
    text today - l.due "days late" color bad
    l.amount - l.returned bold
"All loans" head
each loan sort due as l
  row card gap 1 tap edit l swipe remove l
    stack grow
      l.person bold
      "given" l.given "return by" l.due faint
    l.returned "of" l.amount
form loan, "Add loan"
