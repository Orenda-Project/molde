app "Bugs" tool slate
table bug title text, severity pick High|Medium|Low, fixed bool
stat count(bug where fixed = no), "open bugs"
stat count(bug where fixed = no and severity = High), "open high"
form bug, "Add bug"
each options bug.severity as sv
  if count(bug where severity = sv) > 0
    sv head
    each bug where severity = sv sort fixed as b
      row card swipe remove b
        toggle b.fixed
        b.title grow
