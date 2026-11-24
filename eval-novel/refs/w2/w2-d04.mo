app "On-call log" bell slate
table page service text, minutes num 0.., fix long
row gap 2
  stat avg(page.minutes), "avg minutes to resolve"
  stat count(page week), "pages this week"
form page, "Log page"
each page as p empty "No pages yet"
  stack card gap 0 tap edit p swipe remove p
    row
      p.service bold grow
      p.minutes "min"
    p.at faint
    p.fix
