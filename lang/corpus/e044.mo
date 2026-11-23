app "Bike Repair" bike slate
table job customer text, labour money
table part job ref job, name text, cost money
each job as j
  stack card gap 1
    j.customer head
    each j.part
      row
        it.name grow
        it.cost
    row
      "Labour" grow
      j.labour
    row
      "Invoice total" bold grow
      j.labour + sum(j.part.cost) bold big
form job, "New job card"
form part, "Add part"
