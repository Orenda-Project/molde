app "Wedding Planner" gift plum
table func name text, budget money
table guest name text, rsvp pick Pending|Yes|No = Pending
table vendor name text, phone text?, job text?
table chore name text, due date, done bool
remind "Wedding task due" at chore.due
"Guests coming" count(guest where rsvp = Yes) "of" count(guest) head
each guest sort name
  row card
    it.name grow
    it.rsvp bold color if(it.rsvp = Yes, good, if(it.rsvp = No, bad, muted))
    button "Change" tap edit it
form guest, "Add guest"
"Budget per function" head
each func
  row card
    it.name grow
    it.budget bold
form func, "Add function"
"Vendors" head
list vendor
form vendor, "Add vendor"
"Checklist" head
each chore sort due
  row card
    it.name grow
    it.due faint
    toggle it.done
form chore, "Add task"
