app "Mosque" mosque mint
table donation donor text, amount money, note text?
table expense what text, amount money
table notice title text, body long?
state m date = today
"Balance" sum(donation.amount) - sum(expense.amount) big
screen donations "Donations" money
  form donation
  log donation
screen expenses "Expenses" wallet
  form expense
  log expense
screen statement "Statement" chart
  monthnav m
  stat sum(donation.amount month of m), "donations"
  stat sum(expense.amount month of m), "expenses"
  stat sum(donation.amount month of m) - sum(expense.amount month of m), "net for the month"
  "Expenses by item" head
  each expense month of m as e
    row
      e.what grow
      e.amount
screen notices "Notices" bell
  form notice, "Post notice"
  each notice as n
    stack card gap 1 tap edit n swipe remove n
      n.title bold
      n.body faint
