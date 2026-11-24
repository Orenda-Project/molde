app "Standup notes" note ocean
table standup yesterday long, doing long "Today"
stat count(standup today), "entries today"
form standup, "Save standup"
each standup as s empty "No standups yet"
  stack card gap 1 tap edit s swipe remove s
    s.at bold
    "Yesterday:" s.yesterday
    "Today:" s.doing
remind "Write today's standup" at 9:45 on mon tue wed thu fri
