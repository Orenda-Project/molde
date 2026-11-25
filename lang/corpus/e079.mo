app "Dad Medicine" pill plum
table dose name text, pic image?
table given dose ref dose
remind "Dad's medicine time" at 8:00, 14:00, 21:00
"Doses given today" count(given today) "of" count(dose) * 3 head
each dose
  stack card gap 1
    row
      it.name bold grow
      count(it.given today) "of 3 today"
    image it.pic
    button "Given now" tap add given dose = it
form dose, "Add medicine"
