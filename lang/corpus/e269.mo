app "Sleep diary" bed ink
table night bed time, asleep time, woke time, rested num 1..5 = 3
"Average sleep, this week" faint
sumof(night week, if(it.woke < it.asleep, it.woke - it.asleep + 24h, it.woke - it.asleep)) / count(night week) big
"Rested by weekday (lowest is worst)" head
each ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as w
  row
    text w grow color if(count(night where weekday(at) = index + 1) > 0 and avg(night.rested where weekday(at) = index + 1) = minof(1..7, if(count(night where weekday(at) = it) > 0, avg(night.rested where weekday(at) = it), 5)), bad, ink)
    round(avg(night.rested where weekday(at) = index + 1) * 10) / 10 "of 5"
form night
log night
