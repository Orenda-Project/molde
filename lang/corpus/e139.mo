app "Study" school ocean
table subject name text
table lesson subject ref subject, day pick Mon|Tue|Wed|Thu|Fri|Sat = Mon, start time, mins num 15..180 = 45
table studied subject ref subject, mins num 1..
table flash word text, meaning text
setting work dur = 25m "Focus length"
state i num = 0
state flipped bool = no
state sub ref subject
screen plan "Timetable" calendar
  each options lesson.day as dd
    stack gap 1
      dd bold
      each lesson where day = dd sort start as l
        row card tap edit l swipe remove l
          l.start l.subject.name grow
          l.mins "min"
  form lesson, "Add lesson"
  form subject, "Add subject"
screen focus "Focus" timer
  choice sub
  timer work, "Focus", add studied subject = sub, mins = 25 then notify "Break time"
  sum(studied.mins today) "min studied today" head
screen cards "Cards" cards
  each flash sort at as c
    if index = i
      stack card gap 2 pad 4 align center tap set flipped = not flipped
        if flipped
          c.meaning big
        else
          c.word big
  row gap 1
    button "Previous" tap set i = clamp(i - 1, 0, count(flash) - 1) then set flipped = no
    button "Next" tap set i = clamp(i + 1, 0, count(flash) - 1) then set flipped = no
  form flash, "Add card"
screen progress "Progress" chart
  daybars last 7 days, sum(studied.mins on it)
  share subject, sum(it.studied.mins week), it.name
