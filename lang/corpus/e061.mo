app "Wholesale" package slate
table supplier name text, phone text?
table invoice supplier ref supplier, inv text, amount money, due date, paid bool
table stock item text, qty num 0.., cost money
"Stock value" sumof(stock, it.qty * it.cost) big
"Unpaid invoices" sum(invoice.amount where paid = no) head
each invoice where paid = no sort due
  row card tap edit it
    stack grow
      it.supplier.name it.inv bold
      "due" it.due faint color if(it.due < today, bad, muted)
    it.amount bold
    toggle it.paid
remind "Invoice due" at invoice.due
form supplier, "Add supplier"
form invoice, "Add invoice"
form stock, "Add stock item"
list stock
