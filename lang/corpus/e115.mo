app "Salon" tag plum
table client name text, phone text?
table service name text, price money
table product name text, qty num 0.., low num 0.. = 3
table visit client ref client, service ref service, paid money
let income = sum(visit.paid month)
screen home "Today" calendar
  stat income, "income this month"
  stat count(visit today), "appointments today"
  form visit, "Book appointment"
  each visit today as v
    row card
      v.client.name bold grow
      v.service.name
      v.paid
screen clients "Clients" users
  each client sort name as c
    row card tap edit c swipe remove c
      c.name bold grow
      count(c.visit) "visits" faint
  form client, "Add client"
screen prices "Prices" tag
  list service
  form service, "Add service"
screen stock "Stock" package
  each product sort qty as p
    row card gap 1 tap edit p
      p.name bold grow color if(p.qty <= p.low, warn, ink)
      button "-" tap set p.qty = p.qty - 1
      p.qty bold
      button "+" tap set p.qty = p.qty + 1
  form product, "Add product"
screen money "Income" wallet
  stat income, "this month"
  stat sum(visit.paid prev month), "last month"
  daybars last 7 days, sum(visit.paid on it)
  list visit by day
