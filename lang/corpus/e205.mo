app "Fasts" moon plum
table fast
"My fasts, last 30 days" head
grid 6 gap 1
  each days last 30 days as d
    box height 40 radius 6 fill if(count(fast on d) > 0, accent, soft) tap toggle fast on d
      monthday(d) size tiny align center color if(count(fast on d) > 0, bg, ink)
row align center
  "Streak" faint grow
  streak(fast) big color accent
