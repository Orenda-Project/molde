app "Tiffin" food mint
table income amount money, note text?
table expense amount money, what text?
"Profit this week" sum(income.amount week) - sum(expense.amount week) big
each 0..7 as k
  let d0 = today - 7 * k
  row
    "Weeks back:" k grow
    sum(income.amount week of d0) - sum(expense.amount week of d0) bold
form income, "Add income"
form expense, "Add expense"
log income month
log expense month
