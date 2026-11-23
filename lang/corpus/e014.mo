app "Cousin Debt" wallet slate
table loan amount money, due date, note text?
table payback amount money
let owed = sum(loan.amount all) - sum(payback.amount all)
"He owes me" owed big
each loan sort due
  row card
    it.amount grow
    "due" it.due color if(it.due < today, bad, ink)
form loan, "Add loan"
form payback, "He paid back"
list payback by day
