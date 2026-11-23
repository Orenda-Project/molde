app "Loan" coin slate
setting loan money = 500000 "Loan amount"
table payment amount money
let paid = sum(payment.amount)
let p = clamp(paid / loan, 0, 1)
stack align center gap 1
  draw width 220
    circle 50, 50, 42 stroke soft thick 10
    arc 50, 50, 42, 0, 360 * p stroke accent thick 10
    label 50, 50, round(p * 100) "% paid" big
  "Balance left" faint
  if(loan > paid, loan - paid, 0) big huge
form payment, "Add payment"
log payment
