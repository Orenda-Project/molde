app "Sprint points" target ocean
table story title text, points num 1..21, status pick Todo|Doing|Done = Todo
goal sum(story.points where status = Done), 40, "points done in sprint of 40"
stat 40 - sum(story.points where status = Done), "points remaining"
"Points per status" head
bars options story.status, sum(story.points where status = it), it
form story, "Add story"
each options story.status as st
  row gap 1
    st head grow
    sum(story.points where status = st) "pts" faint
  each story where status = st as s
    row card swipe remove s
      s.title grow
      s.points
      choice s.status
