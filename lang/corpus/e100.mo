app "CSS Revision" school ocean
table topic subject text, name text, hours num 0..500, conf num 1..5
"Weakest topics" head
each topic sort conf top 5
  row card tap edit it
    stack grow
      it.name bold
      it.subject it.hours "h" faint
    "Confidence" it.conf bold color if(it.conf <= 2, bad, ink)
form topic, "Add topic"
"All topics" head
each topic sort conf
  row card tap edit it
    it.subject it.name grow
    it.conf
