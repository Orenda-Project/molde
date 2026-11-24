app "Tuition" school plum
table student name text, class text, fee money "Fee per month", comes pick Mon|Tue|Wed|Thu|Fri|Sat|Sun, status pick Waiting was Unpaid|Paid = Waiting
state show pick All|Waiting = All
row gap 3
  stat sum(student.fee), "monthly fee income"
  stat sum(student where status = Paid, it.fee), "received"
form student, "Add student"
choice show
each student where show = All or status = Waiting sort it.name empty "No students yet"
  row card tap edit it
    stack grow gap 0
      it.name bold
      "Class" it.class "on" it.comes faint
    it.fee bold
    button it.status fill if(it.status = Paid, good, warn) tap set it.status = if(it.status = Paid, Waiting, Paid)
"Waiting this month" head
each student where status = Waiting
  text it.name it.fee
button "Start new month" tap set all student.status = Waiting
