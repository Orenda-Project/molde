app "Salary and bills" wallet slate
setting salary money = 100000 "Monthly salary"
table bill name text, amount money, paid bool
let billed = sum(bill.amount month)
"Left after bills" salary - billed big color if(salary < billed, bad, good)
row gap 3
  stat salary, "salary"
  stat billed, "bills this month"
  stat sum(bill.amount month where paid = no), "still to pay"
each bill month sort at desc as b
  row card gap 1 swipe remove b
    toggle b.paid
    b.name bold grow
    b.amount
form bill, "Add bill"
