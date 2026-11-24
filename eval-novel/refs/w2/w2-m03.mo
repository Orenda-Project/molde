app "Freelance tracker" wallet slate
table client name text
table project name text, client ref client, rate money
table entry project ref project, hours num 0.., note text?
table invoice client ref client, amount money, paid bool
stat sum(entry month, it.hours * it.project.rate), "earned this month"
stat sum(invoice.amount where paid = no), "unpaid invoices"
screen log "Time" timer
form entry, "Log hours"
list entry by day
screen work "Clients" users
form client, "Add client"
form project, "Add project"
list project
screen bill "Invoices" wallet
form invoice, "Add invoice"
each invoice as v empty "No invoices yet"
  row card tap edit v swipe remove v
    toggle v.paid
    v.client.name grow
    v.amount bold
