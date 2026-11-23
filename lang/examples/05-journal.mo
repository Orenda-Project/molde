app "Journal" book plum
table entry mood num 1..5, note long
state d new entry
row gap 1
  each ["awful", "low", "okay", "good", "great"]
    button it fill if(d.mood = index + 1, accent, soft) tap set d.mood = index + 1
field d.note "What is on your mind?"
button "Save entry" tap save d
streak(entry) "day streak," count(entry last 7 days) "entries in 7 days" head
heat last 7 days, count(entry on it)
"Mood, last 30 days. Average" round(avg(entry.mood last 30 days)) faint
trend entry last 30 days sort at, it.mood
state q text = ""
field q "Search entries"
log entry where has(note, q)
