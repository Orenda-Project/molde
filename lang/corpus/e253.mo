app "School fees" school ocean
table fee child text, amount money, paid date, receipt image?
"Paid this year" sum(fee.amount year) big
each fee sort paid desc as f
  row card tap edit f swipe remove f
    stack grow
      f.child bold
      f.paid faint
    f.amount
    image f.receipt
form fee, "Add receipt"
