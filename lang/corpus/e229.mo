app "Borrowed" key slate
table loan tool text, who text, lent date = today, back bool
count(loan where back = no) "things still out" head
each loan where back = no sort lent as l
  row card gap 2 tap edit l
    stack grow
      l.tool bold
      l.who "for" today - l.lent "days" small color if(today - l.lent > 14, bad, muted)
    button "Got it back" tap set l.back = yes
form loan, "Lend something"
"Returned" faint
list loan where back = yes
