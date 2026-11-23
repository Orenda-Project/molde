app "Reading Club" book plum
table member name text
table pick_ title text
table meeting day date, place text?
table vote member ref member, chosen ref pick_
table progress member ref member, pct num 0..100
remind "Book club meeting" at meeting.day
"Book of the month" head
each pick_ sort at desc top 1
  it.title big
"Votes" head
each pick_
  row
    it.title grow
    count(it.vote) "votes" bold
"Reading progress" head
bars member, last(it.progress.pct), it.name
"Meetings" head
each meeting where day >= today sort day
  it.day it.place
form member, "Add member"
form pick_, "Add book option"
form vote, "Cast vote"
form progress, "Update progress"
form meeting, "Add meeting"
