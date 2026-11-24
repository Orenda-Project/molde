app "Dialysis log" heart ocean
table session day date = today, start time, hours num 0.5..12 unit "h", before num 20..200 unit "kg" "Weight before", after num 20..200 unit "kg" "Weight after", note long? "Cramps or low BP notes"
stat last(session.before) - last(session.after), "fluid removed last session (kg)"
form session, "Add session"
"Weight after each session" head
trend session, it.after
each session as s empty "No sessions yet"
  row card tap edit s swipe remove s
    stack grow gap 0
      s.day bold
      "Start" s.start "for" s.hours "h" faint
      s.note faint
    "removed" fixed(s.before - s.after, 1) "kg" bold
