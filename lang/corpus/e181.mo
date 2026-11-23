app "Board exam" school ocean
table subject name text
table topic subject ref subject, name text, studied bool, conf num 1..5 = 3 "Confidence"
setting exam date = today "Exam date"
exam - today "days to the exam" big
count(topic where studied = yes) "of" count(topic) "topics studied" head
"Today's plan: next 3 topics" head
each topic where studied = no sort conf top 3 as t
  row card gap 1
    stack grow
      t.name bold
      t.subject.name "confidence" t.conf faint
    toggle t.studied
each subject as s
  stack card gap 1
    s.name bold
    count(s.topic where studied = yes) "of" count(s.topic) "studied" faint
    each s.topic as t
      row gap 1 tap edit t
        toggle t.studied
        t.name grow
        t.conf "/ 5"
form subject, "Add subject"
form topic, "Add topic"
