app "Ramadan 30" moon plum
table day taraweeh num 0..40, pages num 0..604, charity money = 0
form day, "Add today"
"Days logged" count(day) "of 30" head
if count(day) >= 30
  stack card gap 1
    "Eid Mubarak. Your Ramadan" head
    "Taraweeh total" sum(day.taraweeh all) bold
    "Quran pages" sum(day.pages all) bold
    "Charity given" sum(day.charity all) bold
daybars last 30 days, sum(day.pages on it)
list day by day
