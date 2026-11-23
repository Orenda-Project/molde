app "Bills" bell slate
table bill name text, amount money, due date
remind "Bill due" at bill.due
each bill where due >= today sort due
  row card tap edit it swipe remove it
    stack grow
      it.name bold
      "due" it.due faint
    it.amount
form bill, "Add bill"
