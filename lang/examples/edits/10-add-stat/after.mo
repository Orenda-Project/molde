app "Khata" wallet slate
table person name text, phone text?
table entry person ref person, amount money, kind pick Gave|Got, note text?
text "People owe you" sum(entry.amount where kind = "Gave") - sum(entry.amount where kind = "Got") big
stat countof(person, sum(it.entry.amount where kind = "Gave") > sum(it.entry.amount where kind = "Got")), "people owe you"
each person as p
  let bal = sum(p.entry.amount where kind = "Gave") - sum(p.entry.amount where kind = "Got")
  stack card tap edit p
    row
      text p.name bold grow
      text if(bal >= 0, "owes you", "you owe") abs(bal) color if(bal >= 0, good, bad)
    text "Last entry" last(p.entry.at) faint
form person, "Add person"
form entry, "Add entry"
log entry
