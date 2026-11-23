app "Hostel money" school ocean
table student name text
table expense student ref student, kind pick Mess|Laundry|Pocket = Mess, amount money
each student as s
  stack card gap 1
    row
      s.name bold grow
      sum(s.expense.amount month) big
    row gap 2
      "Mess" sum(s.expense.amount month where kind = Mess) size small faint
      "Laundry" sum(s.expense.amount month where kind = Laundry) size small faint
      "Pocket" sum(s.expense.amount month where kind = Pocket) size small faint
stat sum(expense.amount month), "total this month"
form expense, "Add expense"
form student, "Add student"
log expense
