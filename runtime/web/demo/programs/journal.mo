app "Journal" book plum
table entry mood num 1..5, note long
state d new entry
state q text = ""
stack card gap 3
  row
    text "How are you feeling?" head grow
    text count(entry week) "entries this week" faint
  row gap 1
    each ["Rough", "Low", "Okay", "Good", "Great"]
      stack grow gap 1 align center radius 10 pad 1 fill if(d.mood = index + 1, accent, soft) tap set d.mood = index + 1
        draw 20, 12 width 28
          each 1..5 as b
            rect 4 * b - 4, 12 - 2.4 * b, 3, 2.4 * b fill if(b <= index + 1, ink, edge) radius 0.6
        text it size small
  field d.note "What happened today?"
  row gap 2
    text "Saved on this device only" faint grow
    button "Save entry" fill accent tap save d
stack card gap 3
  row gap 3
    stack gap 0
      text "This week" faint
      text round(avg(entry.mood week) * 10) / 10 "of 5" head
      text "last week" round(avg(entry.mood prev week) * 10) / 10 faint
    stack gap 0
      text "Last 14 days" faint
      text countof(days last 14 days, count(entry on it) > 0) "of 14" head
      text "days written" faint
    stack gap 0
      text "Streak" faint
      text streak(entry) "days" head
      text if(count(entry today) > 0, "including today", "write today to keep it") faint
  divider
  text "Mood, last 30 days" head
  draw 100, 40
    line 0, 4, 100, 4 stroke edge thick 0.3
    line 0, 20, 100, 20 stroke edge thick 0.3
    line 0, 36, 100, 36 stroke edge thick 0.3
    poly stroke accent thick 1
      each entry last 30 days sort at
        pt 2 + 96 * index / max(count(entry last 30 days) - 1, 1), 36 - 8 * (it.mood - 1)
  row
    text "30 days ago" faint grow
    text "Today" faint
field q "Search entries"
if q != "" and count(entry where has(note, q)) = 0
  text "Nothing found. Try a shorter word." faint
each entry where has(note, q) by day as g
  text g.key bold faint
  each g as r
    stack card gap 1 tap edit r swipe remove r
      text if(r.mood >= 4, "Good day", if(r.mood = 3, "Okay day", "Hard day")) faint color if(r.mood >= 4, good, if(r.mood = 3, muted, warn))
      text r.note
