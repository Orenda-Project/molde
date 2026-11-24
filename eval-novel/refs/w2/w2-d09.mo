app "Release notes" note ink
table release version text, on date = today, new long, fixed long, changed long, published bool
stat count(release where published = no), "drafts"
form release, "Add release"
each release sort on desc as r empty "No releases yet"
  stack card gap 1 tap edit r swipe remove r
    row
      r.version bold grow
      r.on faint
      toggle r.published
    "New:" r.new
    "Fixed:" r.fixed
    "Changed:" r.changed
