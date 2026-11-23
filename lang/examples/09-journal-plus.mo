app "Journal" book plum
table entry mood num 1..5, note long
state d new entry
"How are you feeling?" head
row gap 1
  each ["Awful", "Low", "Okay", "Good", "Great"]
    stack grow align center tap set d.mood = index + 1
      draw width 44
        circle 50, 50, 46 fill if(d.mood = index + 1, accent, soft)
        rect 30, 74 - 12 * index, 40, 8 + 12 * index fill bg radius 3
      it tiny
field d.note "What is on your mind?"
button "Save entry" tap save d
row gap 2
  stat streak(entry), if(count(entry today) > 0, "day streak, including today", "day streak; write today to keep it")
  stat count(days last 14 days, count(entry on it) > 0), "of 14 days written"
row gap 1
  each days last 14 days
    box grow height 10 radius 5 fill if(count(entry on it) > 0, accent, soft)
"Mood this week" round(avg(entry.mood week)) "vs" round(avg(entry.mood prev week)) "last week" faint
trend entry last 30 days sort at, it.mood
state q text = ""
field q "Search entries"
if q != "" and count(entry where has(note, q)) = 0
  "Nothing found. Try a shorter word." faint
list entry where has(note, q) by day
"Saved on this device only." faint
