app "Standup notes" note ocean
table standup yesterday long, doing long "Today", blockers long = ""
stat count(standup where len(blockers) > 0), "entries with blockers"
form standup, "Save standup"
each standup as s empty "No standups yet"
  stack card gap 1 tap edit s swipe remove s
    s.at bold
    "Yesterday:" s.yesterday
    "Today:" s.doing
    if len(s.blockers) > 0
      "Blocked:" s.blockers color bad
remind "Write today's standup" at 9:45 on mon tue wed thu fri
