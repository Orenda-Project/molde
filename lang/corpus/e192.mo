app "Bachon ke kaam" check mint
table kid name text
table chore kid ref kid, what text, done bool
each kid as k
  stack card gap 1
    k.name head
    count(k.chore where done = yes) "of" count(k.chore) "kaam ho gaye" faint
    each k.chore as c
      row gap 1 swipe remove c
        toggle c.done
        c.what grow color if(c.done, muted, ink)
form kid, "Bacha add karein"
form chore, "Kaam add karein"
