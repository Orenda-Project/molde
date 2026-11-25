app "Prayers" mosque mint
table prayer name pick Fajr|Zuhr|Asr|Maghrib|Isha
table ptime name pick Fajr|Zuhr|Asr|Maghrib|Isha, at_time time
table sunnah name text, on_ bool
remind "Prayer time" at ptime.at_time
count(prayer today) "of 5 prayed today" head
each options prayer.name
  row card
    it grow
    toggle prayer today where name = it
count(prayer week) "prayers this week" faint
daybars last 7 days, count(prayer on it)
"Prayer times (enter for your city)" head
list ptime
form ptime, "Add prayer time"
"Sunnah prayers" head
each sunnah as s
  row card
    toggle s.on_
    s.name grow
form sunnah, "Add sunnah prayer"
