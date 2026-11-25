app "Events" calendar plum
table event name text, day date
each event where day >= today sort day
  stack card gap 1
    draw 100, 6
      rect 0, 0, 100, 6 fill soft radius 3
      rect 0, 0, 100 * clamp(1 - (it.day - today) / 30, 0.05, 1), 6 fill if(it.day - today <= 3, bad, if(it.day - today <= 10, warn, good)) radius 3
    row
      it.name bold grow
      it.day - today "days left"
form event, "Add event"
