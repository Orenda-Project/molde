app "Hifz" book mint
table surah name text, verses num 1..286, revised date?
table revision surah ref surah
"Revise today" head
each surah sort revised top 1 as s
  stack card gap 1
    s.name big
    if(s.revised = today, "Revised today", "Last revised") s.revised faint
    button "Revised today" tap set s.revised = today then add revision surah = s
"All surahs" head
each surah sort revised as s
  row card tap edit s
    stack grow
      s.name bold
      s.verses "verses memorised" faint
    if(count(s.revision) = 0, "never revised", "revised days ago:") color if(since(s.revision) > 7, warn, ink)
    since(s.revision) bold
form surah, "Add surah"
