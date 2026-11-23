app "Journal" book plum
table entry mood num 1..5, note long
state d new entry
state q text = ""
let wrote = countof(days last 14 days, count(entry on it) > 0)
stack card gap 3
  row
    "How are you feeling?" head grow
    if streak(entry) > 0
      streak(entry) if(streak(entry) = 1, "day", "days") "in a row" faint
  row gap 1
    each ["Rough", "Low", "Okay", "Good", "Great"]
      stack grow gap 1 align center radius 10 pad 1 fill if(d.mood = index + 1, accent, soft) tap set d.mood = index + 1
        draw 20, 12 width 28
          each 1..5 as b
            rect 4 * b - 4, 12 - 2.4 * b, 3, 2.4 * b fill if(b <= index + 1, ink, edge) radius 0.6
        text it size small
  field d.note "What happened today?"
  row gap 2
    "Saved on this device only" faint grow
    button "Save entry" fill accent tap save d
stack card gap 3
  row
    "Mood, last 30 days" head grow
    text wrote "of 14 days written" faint
  if count(entry last 30 days) < 2
    "Write on two days to see your mood line." color muted
  else
    draw 110, 60
      line 24, 6, 108, 6 stroke edge thick 0.3
      line 24, 26, 108, 26 stroke edge thick 0.3
      line 24, 46, 108, 46 stroke edge thick 0.3
      label 10, 6, "Great" size tiny color muted
      label 10, 26, "Okay" size tiny color muted
      label 10, 46, "Rough" size tiny color muted
      poly stroke accent thick 1
        each entry last 30 days sort at
          pt 106 - 80 * ((now - it.at) / 1d) / 30, 46 - 10 * (it.mood - 1)
      each entry last 30 days
        circle 106 - 80 * ((now - it.at) / 1d) / 30, 46 - 10 * (it.mood - 1), 1.3 fill accent
      label 34, 56, today - 29 size tiny color muted
      label 100, 56, "Today" size tiny color muted
    "This week averages" round(avg(entry.mood week) * 10) / 10 "out of 5; last week" round(avg(entry.mood prev week) * 10) / 10 faint
field q "Search entries"
if q != "" and count(entry where has(note, q)) = 0
  "Nothing found. Try a shorter word." faint
if q = "" and count(entry) = 0
  "No entries yet. Pick a mood and write a line to start." color muted
each entry where has(note, q) by day as g
  g.key bold faint
  each g as r
    stack card gap 1 tap edit r swipe remove r
      if(r.mood >= 4, "Good day", if(r.mood = 3, "Okay day", "Hard day")) faint color if(r.mood >= 4, good, if(r.mood = 3, muted, warn))
      r.note
