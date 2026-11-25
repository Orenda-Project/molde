app "Club accounts" users slate
table member name text
table fee member ref member, amount money
table expense what text, amount money, category pick Rent|Events|Supplies|Utilities|Other = Other
let income = sum(fee.amount)
let spent = sum(expense.amount)
screen sheet "Balance" chart
  stat income, "fees received"
  stat spent, "expenses"
  "Balance" income - spent big color if(income < spent, bad, good)
  "This month: in" sum(fee.amount month) ", out" sum(expense.amount month) faint
  each member sort name as m
    row card
      m.name grow
      sum(m.fee.amount year) "this year"
screen entry "Add" plus
  form fee, "Add fee"
  form expense, "Add expense"
  form member, "Add member"
screen yearly "Year" calendar
  "Yearly summary" head
  share expense year by category, sum(it.amount), it.key
  stat sum(fee.amount year), "fees this year"
  stat sum(expense.amount year), "expenses this year"
  "Net for the year" sum(fee.amount year) - sum(expense.amount year) big
  daybars last 7 days, sum(fee.amount on it) - sum(expense.amount on it)
