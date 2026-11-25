app "Rentals" home slate
table flat name text, rent money, due_day num 1..31 = 1
table tenant name text, flat ref flat, phone text?
table rentpay flat ref flat, amount money, receipt image?
table repair flat ref flat, what text, cost money?, done bool
screen units "Flats" home
  each flat as u
    row card gap 1 tap edit u
      stack grow
        u.name bold
        "rent" u.rent "due on day" u.due_day faint
      if count(u.rentpay month) > 0
        "Paid" color good
      else
        "Unpaid" color if(monthday(today) > u.due_day, bad, warn)
  form flat, "Add flat"
screen tenants "Tenants" users
  list tenant
  form tenant, "Add tenant"
screen rents "Rent" wallet
  stat sum(rentpay.amount month), "collected this month"
  form rentpay, "Record rent and receipt"
  each rentpay as r
    row card tap edit r
      r.flat.name bold grow
      r.amount
      image r.receipt
screen repairs "Repairs" pen
  each repair where done = no as r
    row card tap edit r
      toggle r.done
      r.flat.name r.what grow
  form repair, "Add repair"
  list repair where done = yes by day
