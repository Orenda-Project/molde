app "Wedding" heart plum
table guest name text, side pick Bride|Groom = Bride, rsvp pick Waiting|Yes|No = Waiting, seat num 0.. = 0 "Table number"
table gift guest ref guest, item text
table thanks guest ref guest, sent bool
screen guests "Guests" users
  count(guest where rsvp = Yes) "coming," count(guest where rsvp = Waiting) "waiting" head
  each guest sort name as g
    row card tap edit g swipe remove g
      g.name bold grow
      g.rsvp color if(g.rsvp = Yes, good, if(g.rsvp = No, bad, muted))
  form guest, "Add guest"
screen tables "Seating" seat
  grid 2 gap 1
    each 1..10 as n
      stack card gap 0
        "Table" n bold
        count(guest where seat = n) "guests" faint
        each guest where seat = n as g
          g.name size small
screen gifts "Gifts" gift
  list gift
  form gift, "Add gift"
screen notes "Thank you" note
  each guest where rsvp = Yes as g
    row card
      toggle g.thanks
      g.name grow
  form thanks, "Add thank-you note"
