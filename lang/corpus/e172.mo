app "Birthdays" gift plum
table bday name text, day date
remind "Birthday today" at bday.day
each bday sort day as b
  row card gap 1 tap edit b swipe remove b
    stack grow
      b.name bold
      b.day faint
    b.day - today "days" color if(b.day - today <= 7, warn, muted)
    if b.day < today
      button "Next year" tap set b.day = addmonths(b.day, 12)
form bday, "Add birthday"
