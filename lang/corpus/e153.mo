app "Farm calendar" leaf mint
table work crop text, job text, mth pick Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec = Jan, done bool
grid 2 gap 1
  each options work.mth as m
    stack card gap 1
      text m head
      each work where mth = m as w
        row gap 1
          toggle w.done
          w.crop w.job grow
form work, "Add farm work"
