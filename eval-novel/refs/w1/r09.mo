app "Morning routine" sun mint
table stepdone step pick Wake_up|Wudu|Fajr|Quran_10_min|Exercise|Shower|Breakfast
let full(d date) = count(stepdone on d) = 7
let off = if(full(today), 0, 1)
let run(k num) = count(1..k, full(today - it + 1 - off)) = k
let streak_days = count(1..60, run(it))
stat streak_days, "day streak of full mornings"
goal count(stepdone today), 7, "done today"
each options stepdone.step as s
  row card
    s grow
    toggle stepdone where step = s
