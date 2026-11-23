app "Clinic Visits" pill ocean
table visit doctor text, reason text, medicine text?, next date?
remind "Appointment" at visit.next
each visit where next >= today sort next top 1
  stack card
    "Next appointment" faint
    it.next it.doctor bold
form visit
log visit
