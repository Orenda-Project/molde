app "Freelance" bag slate
table project client text, name text, deadline date, rate money, sent bool, invoiced date?, paid bool, received date?
table hours project ref project, hrs num 0..24
"Unpaid invoices over 30 days" head
each project where sent = yes and paid = no and invoiced < today - 30 sort invoiced as p
  row card tap edit p
    p.client p.name bold grow
    sum(p.hours.hrs) * p.rate color bad
"All projects" head
each project where not (sent = yes and paid = no and invoiced < today - 30) sort deadline as p
  stack card gap 1 tap edit p
    row
      p.client p.name bold grow
      "due" p.deadline faint
    sum(p.hours.hrs) "h at" p.rate ", total" sum(p.hours.hrs) * p.rate faint
form project, "Add project"
form hours, "Log hours"
