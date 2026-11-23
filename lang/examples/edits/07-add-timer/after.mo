app "Prayers" mosque mint
table prayer name pick Fajr|Zuhr|Asr|Maghrib|Isha
count(prayer today) "of 5 prayed today" head
each options prayer.name
  row card
    it grow
    toggle prayer today where name = it
timer 10m, "Quran after prayer"
daybars last 7 days, count(prayer on it)
"All five on" countof(days last 30 days, count(prayer on it) = 5) "of the last 30 days" faint
remind "Time to pray" at 5:00, 13:00, 16:30, 18:30, 20:00
