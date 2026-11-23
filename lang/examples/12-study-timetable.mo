app "Study" school ocean
table lesson subject pick Maths|English|Science|History|Art, day pick Mon|Tue|Wed|Thu|Fri, start time, mins num 15..180 = 45
table studied lesson ref lesson
text "Today" head
each lesson where day = dayname(today) sort start
  row card
    text it.start it.subject grow
    toggle it.studied
grid 5 gap 1
  each options lesson.day as dd
    stack gap 1
      text dd bold align center
      each lesson where day = dd sort start as l
        stack radius 6 pad 1 fill if(l.subject = "Maths", accent, if(l.subject = "English", good, if(l.subject = "Science", warn, soft))) tap edit l
          text l.subject size small bold
          text l.start l.mins "min" size tiny
form lesson
