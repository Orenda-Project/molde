app "Journal" book plum
table entry mood num 1..5, note long
state q text = ""
topbar "Journal", entry, "Write"
if(count(entry today) > 0, "You wrote today", "Nothing written today yet") head
streak(entry) "days in a row," count(days last 14 days, count(entry on it) > 0) "of the last 14 days" faint
section "Mood, last 30 days", "this week" round(avg(entry.mood week) * 10) / 10 "of 5"
  trend entry last 30 days sort at, it.mood
field q "Search entries"
list entry where has(note, q) by day, "No entries yet. Tap Write, pick a mood and write a line."
