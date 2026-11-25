app "Birthdays" gift plum
table person name text, born date, gift text?
each person sort name
  row card tap edit it
    stack grow
      it.name bold
      "Gift idea:" it.gift faint
    "Age" floor((today - it.born) / 365.25) bold
form person, "Add person"
