app "Pets" paw mint
table pet name text, kind text?
table vaccine pet ref pet, name text, given date, next_due date?
table weigh pet ref pet, kg num 0..
table visit pet ref pet, reason text, cost money?
table supply item text, kind pick Food|Medicine, qty num 0.., low num 0.. = 2
remind "A pet vaccine is due" at vaccine.next_due
each pet as p
  stack card gap 1 tap edit p
    p.name head
    "Weight" last(p.weigh.kg) "kg. Last visit" last(p.visit.at) faint
    "Next vaccine" first(p.vaccine.next_due) faint
"Stock" head
each supply as s
  row card gap 1
    s.item bold grow color if(s.qty <= s.low, warn, ink)
    button "-" tap set s.qty = s.qty - 1
    s.qty bold
    button "+" tap set s.qty = s.qty + 1
form pet, "Add pet"
form vaccine, "Add vaccine"
form weigh, "Add weight"
form visit, "Add visit"
form supply, "Add stock"
