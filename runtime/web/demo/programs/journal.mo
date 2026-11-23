app "Journal" book plum
table entry mood num 1..5, note long
state d new entry
state q text = ""
state writing bool = no
let wrote = countof(days last 14 days, count(entry on it) > 0)
row gap 2 align center
  stack grow gap 0
    if count(entry today) > 0
      "You wrote today" head
    else
      "Nothing written today yet" head
    if streak(entry) > 0
      plural(streak(entry), "day") "in a row," wrote "of the last 14 days" faint
  button if(writing, "Close", "Write") fill if(writing, soft, accent) tap set writing = not writing
if writing
  stack card gap 3
    "How are you feeling?" head
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
      button "Save entry" fill accent tap save d then set writing = no
stack card gap 3
  row
    "Mood, last 30 days" head grow
    "This week" round(avg(entry.mood week) * 10) / 10 "of 5" faint
  if count(entry last 30 days) < 2
    "Write on two days to see your mood line." color muted
  else
    plot 0..30, 1..5 axes gridlines
      poly stroke accent thick 2
        each entry last 30 days sort at
          pt 30 - (now - it.at) / 1d, it.mood
      each entry last 30 days
        circle 30 - (now - it.at) / 1d, it.mood, 1 fill accent
      tick 1, today - 29
      tick 29, "Today"
    "Mood from 1 (rough) to 5 (great). Last week averaged" round(avg(entry.mood prev week) * 10) / 10 faint
"Recent" head
field q "Search entries"
if q != "" and count(entry where has(note, q)) = 0
  "Nothing found. Try a shorter word." faint
if q = "" and count(entry) = 0
  "No entries yet. Tap Write, pick a mood and write a line." color muted
each entry where has(note, q) by day as g
  g.key bold faint
  each g as r
    stack card gap 1 tap edit r swipe remove r
      if(r.mood >= 4, "Good day", if(r.mood = 3, "Okay day", "Hard day")) faint color if(r.mood >= 4, good, if(r.mood = 3, muted, warn))
      r.note
