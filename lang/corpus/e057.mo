app "Editing Work" pen ocean
table job client text, project text, hours num 0..1000, rate money, paid bool
let owed = sum(job month where paid = no, it.hours * it.rate)
"Owed this month" owed big
each job sort at desc
  row card tap edit it
    stack grow
      it.client it.project bold
      it.hours "h at" it.rate faint
    it.hours * it.rate bold
    toggle it.paid
form job, "Add project"
