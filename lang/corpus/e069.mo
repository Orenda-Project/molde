app "Exams" school ocean
table exam subject text, day date
remind "Exam today" at exam.day
each exam where day >= today sort day
  row card tap edit it swipe remove it
    it.subject grow bold
    it.day faint
    it.day - today "days left" bold
form exam, "Add exam"
