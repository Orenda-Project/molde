app "Sleep" moon ink
table night slept time, woke time
setting need dur = 8h "Sleep goal"
let avg7 = sum(night last 7 days, (it.woke - it.slept)) / count(night last 7 days)
"Average per week" faint
avg7 big color if(avg7 >= need, good, warn)
"Last wake-up" last(night.woke) faint
daybars last 7 days, sum(night on it, (it.woke - it.slept) / 1h)
form night
list night by day
