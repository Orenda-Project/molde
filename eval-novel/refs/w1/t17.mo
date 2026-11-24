app "Starter log" bread mint
table feed fed when = now "Time", flour num 1.. unit "g", water num 1.. unit "g", temp num 0..45 unit "C" "Jar temp", doubled bool "Did it double?"
stat fixed(last(feed.water) / last(feed.flour), 2), "last water to flour ratio"
form feed, "Add feeding"
each feed as f empty "No feedings yet"
  row card tap edit f swipe remove f
    stack grow gap 0
      f.fed bold
      f.flour "g flour," f.water "g water" faint
      "ratio" fixed(f.water / f.flour, 2) f.temp "C" faint
    icon if(f.doubled, "check", "minus")
