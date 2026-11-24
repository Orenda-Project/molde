app "Hifz tracker" book mint
table memo surah text, ayahs num 1..300
table revision memo ref memo
remind "Revise today's lesson" at 6:30
row gap 2
  stat sum(memo.ayahs), "ayahs memorized"
  stat streak(revision), "day revision streak"
form memo, "Add memorization"
each memo as m empty "Nothing added yet"
  row card swipe remove m
    stack gap 0 grow
      m.surah bold
      m.ayahs "ayahs" faint
    count(m.revision) "revisions" faint
    toggle m.revision
"Revision this week" head
daybars last 7 days, count(revision on it)
