app "Loan EMI" money slate
state amount money = 500000
state rate num = 15
state months num = 36
let r = rate / 1200
let emi = if(r = 0, amount / months, amount * r * pow(1 + r, months) / (pow(1 + r, months) - 1))
stack card gap 2
  field amount "Loan amount"
  field rate "Yearly interest rate (percent)"
  field months "Months"
stat round(emi), "monthly payment"
row gap 3
  stat round(emi * months - amount), "total interest"
  stat round(emi * months), "total repayment"
