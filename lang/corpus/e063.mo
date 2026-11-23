app "Bill Dates" bell slate
table bill name text, due date, amount money, paid bool
remind "Bill due" at bill.due
each bill where paid = no sort due
  row card tap edit it
    stack grow
      it.name it.amount bold
      "due" it.due faint color if(it.due < today, bad, muted)
    toggle it.paid
form bill, "Add bill"
