app "Sleep" bed plum
table sleep bed when, wake when, caffeine bool "Caffeine after 4pm"
table nap len dur
let best = maxof(sleep last 7 days, (it.wake - it.bed) / 1h)
let worst = minof(sleep last 7 days, (it.wake - it.bed) / 1h)
"Average sleep" round(sumof(sleep last 7 days, (it.wake - it.bed) / 1h) / count(sleep last 7 days)) "h" big
daybars last 7 days, sumof(sleep on it, (it.wake - it.bed) / 1h)
each sleep last 7 days sort at desc
  row card
    it.at grow
    round((it.wake - it.bed) / 1h) "h" bold color if((it.wake - it.bed) / 1h = best, good, if((it.wake - it.bed) / 1h = worst, bad, ink))
    if(it.caffeine, "caffeine", "") faint
form sleep, "Log night"
form nap, "Log nap"
"Naps this week:" count(nap last 7 days) faint
