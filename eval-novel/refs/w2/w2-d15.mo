app "Tech debt" tool slate
table debt title text, days num 1..100, impact pick High|Med|Low, paid bool
let rank(r debt) = if(r.impact = High, 0, if(r.impact = Med, 1, 2))
stat sum(debt.days where paid = no), "days of debt"
"Fix first" head
each debt where paid = no sort rank(it) top 1 as f empty "All paid off"
  row card fill warn
    f.title bold grow
    f.impact
form debt, "Add debt"
each debt sort rank(it) as d
  row card swipe remove d opacity if(d.paid, 0.5, 1)
    toggle d.paid
    d.title grow
    d.impact faint
    d.days "d"
