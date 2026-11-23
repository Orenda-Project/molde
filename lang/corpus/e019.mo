app "Wedding Budget" gift plum
table func name text, budget money
table expense func ref func, vendor text, amount money
table guest name text, side pick Bride|Groom, count num 1..20 = 1
when countof(func, sum(it.expense.amount) > it.budget * 0.9) > 0 notify "A function passed 90 percent of its budget"
each func
  stack card gap 1
    row
      it.name head grow
      "left" it.budget - sum(it.expense.amount) bold color if(sum(it.expense.amount) > it.budget * 0.9, warn, good)
    goal sum(it.expense.amount), it.budget, "spent"
    each it.expense
      row
        it.vendor grow
        it.amount
form func, "Add function"
form expense, "Add expense"
"Guests" head
each guest by side
  stack card
    it.key sum(it.count) bold
    each it
      it.name
form guest, "Add guest"
