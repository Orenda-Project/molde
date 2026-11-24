app "Camping gear" tree mint
table gear name text, carrier text, kg num 0..50 unit "kg", packed bool
stat sum(gear.kg), "total kg"
form gear, "Add gear"
each gear by carrier as g empty "No gear yet"
  row gap 1
    g.key head grow
    sum(g.kg) "kg" faint
  each g as r
    row card swipe remove r
      toggle r.packed
      r.name grow
      r.kg "kg" faint
