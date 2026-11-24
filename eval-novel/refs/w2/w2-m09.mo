app "Sprint dashboard" target ocean
table story title text, points num 1..21, status pick Todo|Doing|Done = Todo
table bug title text, severity pick High|Medium|Low, fixed bool
table retro kind pick Went_well|To_improve, note text
setting sprint num = 40 "Sprint points"
goal sum(story.points where status = Done), sprint, "points done"
stat count(bug where fixed = no), "open bugs"
form story, "Add story"
each story as s
  row card swipe remove s
    s.title grow
    s.points faint
    choice s.status
"Bugs" head
form bug, "Add bug"
each bug where fixed = no sort severity as b
  row card swipe remove b
    toggle b.fixed
    b.title grow
    b.severity faint
screen notes "Retro" note
form retro, "Add note"
each options retro.kind as k
  k head
  each retro where kind = k as r
    row card swipe remove r
      r.note grow
