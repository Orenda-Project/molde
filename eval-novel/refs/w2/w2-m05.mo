app "Pocket money" coin mint
setting allowance num = 500 "Weekly allowance"
setting savegoal num = 5000 "Savings goal"
table move kid pick Ali|Sara, kind pick Allowance|Spend|Save, amount money
table chore kid pick Ali|Sara, job text, reward money
goal sum(move.amount where kind = Save), savegoal, "saved together", ""
each options move.kid as k
  stack card gap 1
    k head
    sum(move.amount where kid = k and kind = Allowance) + sum(chore.reward where kid = k) - sum(move.amount where kid = k and kind = Spend) - sum(move.amount where kid = k and kind = Save) big
    "balance" faint
    row gap 1
      button "Weekly allowance" tap add move kid = k, kind = Allowance, amount = allowance
      button "Chore +50" tap add chore kid = k, job = "Chore", reward = 50
"Record spending or saving" head
form move, "Save"
"Chores" head
form chore, "Add chore"
list chore
