app "Homework" school ocean
table kid name text
table hw kid ref kid, subject text, due date, done bool
each kid as k
  let wk = count(k.hw where due >= today - weekday(today) + 1 and due <= today - weekday(today) + 7)
  let wd = count(k.hw where done = yes and due >= today - weekday(today) + 1 and due <= today - weekday(today) + 7)
  stack card gap 1
    row
      k.name head grow
      "Week score" round(wd * 100 / wk) "%" bold
    each k.hw where done = no sort due as h
      row gap 1
        toggle h.done
        h.subject grow
        h.due small color if(h.due < today, bad, muted)
form kid, "Add child"
form hw, "Add homework"
