app "Water changes" drop ocean
table change day date = today, pct num 1..100 unit "%" "Percent changed", tank pick Big|Small, ph num 0..14, ammonia num 0.. unit "ppm"
remind "Water change day" at 9:00 on sun
row gap 3
  each options change.tank as t
    stack gap 0
      t bold
      text last(change.day where tank = t) faint
form change, "Log water change"
list change by day
